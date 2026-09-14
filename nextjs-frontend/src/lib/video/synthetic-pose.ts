import type { AIAnalysis, CameraAngle, Detection, Limb, MovementEvent, PoseFrame, PoseKeypoint, Stance } from "@/lib/domain/types";
import { clamp } from "@/lib/utils";
import { KEYPOINT, KEYPOINT_COUNT, LIMB_CHAIN } from "./skeleton";

/**
 * Deterministic pose reconstruction for analyses whose original footage isn't stored.
 *
 * A small 3D stick fighter stands in guard and is keyframed from the analysis: every detection
 * drives its limb to the recorded joint angle at the recorded peak time, movement events drive
 * guard drops, slips, rolls, steps and pivots. The 3D pose is projected through the recorded
 * camera angle into normalised COCO-17 keypoints, exactly like pose-estimation output.
 * Pure and client-safe: the same inputs always give the same frames.
 */

type Vec3 = { x: number; y: number; z: number };
type Role = "lead" | "rear";
type Orientation = "orthodox" | "southpaw";
type Analysis = Pick<AIAnalysis, "detections" | "movementEvents" | "durationMs">;

export interface SyntheticPose {
    keypoints: PoseKeypoint[];
    /** Detection being animated at this time, if any. */
    detectionId: string | null;
    /** Elbow or knee of the striking limb, with its angle in degrees. */
    activeJoint: { index: number; angleDeg: number } | null;
    /** Wrist or ankle of the striking limb. */
    activeEnd: number | null;
    trackingLost: boolean;
}

export type SyntheticPoseSampler = (timeMs: number) => SyntheticPose;

export interface SyntheticPoseOptions {
    cameraAngle?: CameraAngle;
}

/* ─── Vector helpers ──────────────────────────────────────────────────────── */

const vec = (x: number, y: number, z: number): Vec3 => ({ x, y, z });
const add = (a: Vec3, b: Vec3): Vec3 => vec(a.x + b.x, a.y + b.y, a.z + b.z);
const sub = (a: Vec3, b: Vec3): Vec3 => vec(a.x - b.x, a.y - b.y, a.z - b.z);
const mul = (a: Vec3, s: number): Vec3 => vec(a.x * s, a.y * s, a.z * s);
const dot = (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z;
const length = (a: Vec3): number => Math.hypot(a.x, a.y, a.z);
const normalize = (a: Vec3): Vec3 => mul(a, 1 / (length(a) || 1));
const mix = (a: Vec3, b: Vec3, t: number): Vec3 => add(a, mul(sub(b, a), t));
const smooth = (t: number): number => {
    const c = clamp(t, 0, 1);
    return c * c * (3 - 2 * c);
};

/** Rotation about the vertical axis. Positive yaw turns the fighter to their right. */
function rotY(p: Vec3, deg: number): Vec3 {
    const r = (deg * Math.PI) / 180;
    const c = Math.cos(r);
    const s = Math.sin(r);
    return vec(p.x * c + p.z * s, p.y, -p.x * s + p.z * c);
}

function angleAt(joint: Vec3, a: Vec3, b: Vec3): number {
    const u = normalize(sub(a, joint));
    const w = normalize(sub(b, joint));
    return (Math.acos(clamp(dot(u, w), -1, 1)) * 180) / Math.PI;
}

/** Straight-line reach of a two-segment limb bent to `angleDeg`. */
function reachFor(angleDeg: number, upper: number, lower: number): number {
    const r = (angleDeg * Math.PI) / 180;
    return Math.sqrt(upper * upper + lower * lower - 2 * upper * lower * Math.cos(r));
}

/** Two-bone inverse kinematics: middle joint and clamped end for a target, bending toward `pole`. */
function solveLimb(root: Vec3, target: Vec3, upper: number, lower: number, pole: Vec3): { joint: Vec3; end: Vec3 } {
    const toTarget = sub(target, root);
    const dist = clamp(length(toTarget), Math.abs(upper - lower) + 0.001, upper + lower - 0.001);
    const dir = normalize(toTarget);
    const along = (upper * upper - lower * lower + dist * dist) / (2 * dist);
    const height = Math.sqrt(Math.max(0, upper * upper - along * along));
    let bend = sub(pole, mul(dir, dot(pole, dir)));
    if (length(bend) < 1e-6) bend = sub(vec(0, -1, 0), mul(dir, -dir.y));
    return { joint: add(add(root, mul(dir, along)), mul(normalize(bend), height)), end: add(root, mul(dir, dist)) };
}

/* ─── Body model (metres; x = fighter's right, y = up, z = toward the target) ─ */

const UPPER_ARM = 0.3;
const FOREARM = 0.28;
const THIGH = 0.47;
const SHIN = 0.46;
const PELVIS_HEIGHT = 0.86;
const SHOULDER_RISE = 0.47;
const SHOULDER_HALF = 0.19;
const HIP_HALF = 0.11;
const TORSO_BLADE_DEG = 32;
const HIP_BLADE_DEG = 24;
const KICK_CHAMBER_DEG = 62;

/** Canonical x sign of a body side: the lead side is on the left (orthodox), mirrored later. */
const SIDE_SIGN: Record<Role, number> = { lead: -1, rear: 1 };

/** Fists at cheekbone height (head centre is ~0.19 m above the shoulder line), lead hand further out. */
const GUARD_WRIST: Record<Role, Vec3> = { lead: vec(-0.05, 0.17, 0.3), rear: vec(0.09, 0.15, 0.19) };
const GUARD_ELBOW_POLE: Record<Role, Vec3> = { lead: vec(-0.35, -1, -0.15), rear: vec(0.45, -1, -0.2) };
const ANKLE: Record<Role, Vec3> = { lead: vec(-0.13, 0.08, 0.34), rear: vec(0.17, 0.08, -0.3) };

/** Camera azimuth from the fighter's front toward their rear (open) side, degrees. */
const CAMERA_AZIMUTH: Record<CameraAngle, number> = { front: 30, diagonal: 58, side: 82 };
/** Share of the recorded hip rotation shown on the torso — keeps the chest readable on camera. */
const ROTATION_DISPLAY = 0.85;
/** Normalised frame height per metre, ground line, horizontal centre and camera elevation (depth → height). */
const PROJECTION = { scale: 0.48, ground: 0.9, centerX: 0.44, elevation: 0.24 };

/* ─── Timeline preparation ────────────────────────────────────────────────── */

interface Travel {
    x: number;
    z: number;
    yaw: number;
}

interface TravelKey {
    startMs: number;
    endMs: number;
    from: Travel;
    to: Travel;
}

interface Prepared {
    detections: Detection[];
    orientations: Orientation[];
    events: MovementEvent[];
    eventIndex: Map<string, number>;
    travel: TravelKey[];
    azimuth: number;
}

const limbSide = (limb: Limb): "left" | "right" => (limb.startsWith("left") ? "left" : "right");

function orientationFromLeadSide(side: "left" | "right"): Orientation {
    return side === "left" ? "orthodox" : "southpaw";
}

/** Stance per detection. Switch fighters take it from the jab (lead) or cross (rear) of each combination. */
function detectionOrientations(detections: Detection[], stance: Stance): Orientation[] {
    if (stance !== "switch") return detections.map(() => stance);
    const byCombination = new Map<string, Orientation>();
    const infer = (group: Detection[]): Orientation | null => {
        const jab = group.find((d) => d.type === "jab");
        if (jab) return orientationFromLeadSide(limbSide(jab.limb));
        const cross = group.find((d) => d.type === "cross");
        if (cross) return orientationFromLeadSide(limbSide(cross.limb) === "left" ? "right" : "left");
        return null;
    };
    let previous: Orientation = "orthodox";
    return detections.map((detection) => {
        let orientation: Orientation | null = null;
        if (detection.combinationId) {
            if (!byCombination.has(detection.combinationId)) {
                const inferred = infer(detections.filter((d) => d.combinationId === detection.combinationId));
                if (inferred) byCombination.set(detection.combinationId, inferred);
            }
            orientation = byCombination.get(detection.combinationId) ?? null;
        } else {
            orientation = infer([detection]);
        }
        previous = orientation ?? previous;
        return previous;
    });
}

function buildTravel(events: MovementEvent[]): TravelKey[] {
    const keys: TravelKey[] = [];
    let current: Travel = { x: 0, z: 0, yaw: 0 };
    events.forEach((event, index) => {
        const next = { ...current };
        const alternate = index % 2 === 0 ? 1 : -1;
        if (event.type === "step_in") next.z = clamp(current.z + 0.2, -0.35, 0.35);
        else if (event.type === "step_out") next.z = clamp(current.z - 0.2, -0.35, 0.35);
        else if (event.type === "lateral_step") {
            const dir = current.x > 0.05 ? -1 : current.x < -0.05 ? 1 : alternate;
            next.x = clamp(current.x + dir * 0.18, -0.3, 0.3);
        } else if (event.type === "pivot") {
            const dir = current.yaw > 5 ? -1 : current.yaw < -5 ? 1 : alternate;
            next.yaw = clamp(current.yaw + dir * 28, -35, 35);
        } else return;
        keys.push({ startMs: event.startMs, endMs: Math.max(event.endMs, event.startMs + 1), from: current, to: next });
        current = next;
    });
    return keys;
}

function travelAt(keys: TravelKey[], timeMs: number): Travel {
    let lo = 0;
    let hi = keys.length - 1;
    let found = -1;
    while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (keys[mid].startMs <= timeMs) {
            found = mid;
            lo = mid + 1;
        } else hi = mid - 1;
    }
    if (found < 0) return { x: 0, z: 0, yaw: 0 };
    const key = keys[found];
    if (timeMs >= key.endMs) return key.to;
    const t = smooth((timeMs - key.startMs) / (key.endMs - key.startMs));
    return {
        x: key.from.x + (key.to.x - key.from.x) * t,
        z: key.from.z + (key.to.z - key.from.z) * t,
        yaw: key.from.yaw + (key.to.yaw - key.from.yaw) * t,
    };
}

/** Index of the last detection starting at or before `timeMs`, or -1. */
function lastStartedIndex(detections: Detection[], timeMs: number): number {
    let lo = 0;
    let hi = detections.length - 1;
    let found = -1;
    while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (detections[mid].startMs <= timeMs) {
            found = mid;
            lo = mid + 1;
        } else hi = mid - 1;
    }
    return found;
}

/** Mirror factor: 1 orthodox, -1 southpaw, blended across stance switches between strikes. */
function mirrorAt(p: Prepared, timeMs: number): number {
    if (p.detections.length === 0) return 1;
    const sign = (o: Orientation) => (o === "orthodox" ? 1 : -1);
    const index = lastStartedIndex(p.detections, timeMs);
    if (index < 0) return sign(p.orientations[0]);
    const current = p.orientations[index];
    const nextIndex = index + 1;
    if (nextIndex >= p.detections.length || p.orientations[nextIndex] === current) return sign(current);
    const gapStart = p.detections[index].endMs;
    const gapEnd = p.detections[nextIndex].startMs;
    const mid = (gapStart + gapEnd) / 2;
    const half = Math.min(160, Math.max(1, (gapEnd - gapStart) / 2));
    const t = smooth((timeMs - (mid - half)) / (2 * half));
    return sign(current) + (sign(p.orientations[nextIndex]) - sign(current)) * t;
}

/* ─── Pose at a time ──────────────────────────────────────────────────────── */

interface StrikeState {
    detection: Detection;
    role: Role;
    /** 0 at guard, 1 at the peak. */
    intensity: number;
    /** Normalised progress: 0–1 before the peak, 1–2 after. */
    progress: number;
}

function strikeAt(p: Prepared, timeMs: number, orientation: Orientation): StrikeState | null {
    const index = lastStartedIndex(p.detections, timeMs);
    if (index < 0) return null;
    const detection = p.detections[index];
    if (timeMs > detection.endMs) return null;
    const leadSide = orientation === "orthodox" ? "left" : "right";
    const role: Role = limbSide(detection.limb) === leadSide ? "lead" : "rear";
    const before = timeMs <= detection.peakMs;
    const progress = before
        ? clamp((timeMs - detection.startMs) / Math.max(1, detection.peakMs - detection.startMs), 0, 1)
        : 1 + clamp((timeMs - detection.peakMs) / Math.max(1, detection.endMs - detection.peakMs), 0, 1);
    return { detection, role, intensity: before ? smooth(progress) : 1 - smooth(progress - 1), progress };
}

function activeEvents(p: Prepared, timeMs: number): MovementEvent[] {
    return p.events.filter((e) => e.startMs <= timeMs && timeMs <= e.endMs);
}

function envelope(event: MovementEvent, timeMs: number, rampIn: number, rampOut: number): number {
    return clamp(Math.min((timeMs - event.startMs) / rampIn, (event.endMs - timeMs) / rampOut, 1), 0, 1);
}

function samplePose(p: Prepared, timeMs: number): SyntheticPose {
    const mirror = mirrorAt(p, timeMs);
    const orientation: Orientation = mirror >= 0 ? "orthodox" : "southpaw";
    const strike = strikeAt(p, timeMs, orientation);
    const events = activeEvents(p, timeMs);
    const travel = travelAt(p.travel, timeMs);
    const seconds = timeMs / 1000;
    const isKick = strike?.detection.type === "kick";

    // Idle rhythm: bounce, weight shift and a slight torso sway.
    const bounce = Math.sin(2 * Math.PI * 1.6 * seconds) * (isKick ? 0.003 : 0.012);
    const sway = Math.sin(2 * Math.PI * 0.5 * seconds) * 0.02;
    const yawSway = Math.sin(2 * Math.PI * 0.5 * seconds + 1) * 3;

    // Head movement.
    let headLateral = 0;
    let headDip = 0;
    let headForward = 0;
    for (const event of events) {
        const index = p.eventIndex.get(event.id) ?? 0;
        const dir = index % 2 === 0 ? 1 : -1;
        const progress = clamp((timeMs - event.startMs) / Math.max(1, event.endMs - event.startMs), 0, 1);
        if (event.type === "slip") {
            const env = Math.sin(Math.PI * progress);
            headLateral += dir * 0.13 * env;
            headDip += 0.05 * env;
        } else if (event.type === "roll") {
            headDip += 0.17 * Math.sin(Math.PI * progress);
            headLateral += dir * 0.12 * Math.cos(Math.PI * progress);
            headForward += 0.04 * Math.sin(Math.PI * progress);
        }
    }

    // Strike-driven rotation (lead actions turn right, rear actions turn left).
    let hipYaw = HIP_BLADE_DEG;
    let torsoYaw = TORSO_BLADE_DEG + yawSway;
    let lean = vec(0, 0, 0);
    if (strike) {
        const { detection, role, intensity } = strike;
        const direction = role === "lead" ? 1 : -1;
        const rotation = detection.type === "jab" ? Math.min(14, detection.hipRotationDeg) : detection.hipRotationDeg;
        hipYaw += direction * rotation * intensity * ROTATION_DISPLAY * (detection.type === "kick" && role === "lead" ? 0.8 : 1);
        // Rear-hand punches drive the rear shoulder through to the target.
        torsoYaw += direction * rotation * intensity * ROTATION_DISPLAY * (isKick ? 0.9 : role === "rear" ? 1.6 : 1.15);
        if (isKick) lean = mul(vec(-SIDE_SIGN[role] * 0.06, -0.02, -0.11), intensity);
        else if (detection.type !== "hook") lean = mul(vec(0, -0.02, role === "rear" ? 0.1 : 0.06), intensity);
    }

    const pelvis = vec(sway + travel.x, PELVIS_HEIGHT + bounce - headDip * 0.55 + (isKick ? 0.03 * (strike?.intensity ?? 0) : 0), travel.z);
    const shoulderCenter = add(pelvis, add(vec(headLateral * 0.7, SHOULDER_RISE - headDip * 0.4, headForward), lean));

    const shoulder = (role: Role) => add(shoulderCenter, rotY(vec(SIDE_SIGN[role] * SHOULDER_HALF, 0, 0), torsoYaw));
    const hip = (role: Role) => add(pelvis, rotY(vec(SIDE_SIGN[role] * HIP_HALF, 0, 0), hipYaw));

    // Arms.
    const arm = (role: Role): { shoulder: Vec3; elbow: Vec3; wrist: Vec3 } => {
        const s = shoulder(role);
        const sideSign = SIDE_SIGN[role];
        const handBob = Math.sin(2 * Math.PI * 1.6 * seconds + 0.6) * 0.01;
        let target = add(shoulderCenter, rotY(add(GUARD_WRIST[role], vec(0, handBob, 0)), torsoYaw));
        let pole = rotY(GUARD_ELBOW_POLE[role], torsoYaw);

        if (strike && strike.detection.type !== "kick" && strike.role === role) {
            const { detection, intensity } = strike;
            const reach = reachFor(detection.jointAngleDeg, UPPER_ARM, FOREARM);
            if (detection.type === "hook") {
                const aim = add(pelvis, vec(-0.02, 0.5, 0.55));
                const peak = add(s, mul(normalize(sub(aim, s)), reach));
                const control = add(s, rotY(vec(sideSign * 0.3, 0.02, 0.2), torsoYaw));
                const u = intensity;
                target = add(add(mul(target, (1 - u) * (1 - u)), mul(control, 2 * (1 - u) * u)), mul(peak, u * u));
                pole = mix(pole, vec(sideSign, 0.5, -0.3), intensity);
            } else {
                const aim = add(pelvis, vec(-0.04, 0.53, 1.3));
                target = mix(target, add(s, mul(normalize(sub(aim, s)), reach)), intensity);
                pole = mix(pole, vec(sideSign * 0.25, -1, 0), intensity);
            }
        } else if (strike && isKick && strike.role === role && !strike.detection.guardMaintained) {
            target = mix(target, add(s, vec(sideSign * 0.1, -0.5, -0.22)), strike.intensity);
            pole = mix(pole, vec(sideSign, -0.3, -0.6), strike.intensity);
        }

        for (const event of events) {
            if (event.type !== "guard_drop") continue;
            const actual = event.detail.toLowerCase().startsWith("left") ? "left" : event.detail.toLowerCase().startsWith("right") ? "right" : null;
            const leadSide = orientation === "orthodox" ? "left" : "right";
            const dropRole: Role = actual === null ? "rear" : actual === leadSide ? "lead" : "rear";
            if (dropRole !== role) continue;
            const striking = strike?.role === role ? strike.intensity : 0;
            const env = envelope(event, timeMs, 90, 200) * (1 - striking);
            target = mix(target, add(s, rotY(vec(sideSign * 0.1, -0.36, 0.12), torsoYaw)), env);
            pole = mix(pole, vec(sideSign * 0.4, -1, 0.1), env);
        }

        const solved = solveLimb(s, target, UPPER_ARM, FOREARM, pole);
        return { shoulder: s, elbow: solved.joint, wrist: solved.end };
    };

    // Legs.
    const leg = (role: Role): { hip: Vec3; knee: Vec3; ankle: Vec3 } => {
        const h = hip(role);
        const sideSign = SIDE_SIGN[role];
        const planted = add(vec(travel.x, 0, travel.z), ANKLE[role]);
        let target = planted;
        let pole = vec(sideSign * 0.2, 0, 1);

        if (strike && isKick && strike.role === role) {
            const { detection, progress } = strike;
            const rotationFactor = clamp(detection.hipRotationDeg / 60, 0.2, 1);
            const chamber = add(h, mul(normalize(vec(sideSign * 0.35, -0.45, 0.55)), reachFor(KICK_CHAMBER_DEG, THIGH, SHIN)));
            const extended = add(h, mul(normalize(vec(-sideSign * 0.6 * rotationFactor, 0.28, 0.75)), reachFor(detection.jointAngleDeg, THIGH, SHIN)));
            const chamberPole = vec(0, 0.4, 1);
            const strikePole = vec(-sideSign * 0.3, 1, 0.2);
            if (progress <= 0.45) {
                const t = smooth(progress / 0.45);
                target = mix(planted, chamber, t);
                pole = mix(pole, chamberPole, t);
            } else if (progress <= 1) {
                const t = smooth((progress - 0.45) / 0.55);
                target = mix(chamber, extended, t);
                pole = mix(chamberPole, strikePole, t);
            } else if (progress <= 1.5) {
                const t = smooth((progress - 1) / 0.5);
                target = mix(extended, chamber, t);
                pole = mix(strikePole, chamberPole, t);
            } else {
                const t = smooth((progress - 1.5) / 0.5);
                target = mix(chamber, planted, t);
                pole = mix(chamberPole, pole, t);
            }
        }

        const solved = solveLimb(h, target, THIGH, SHIN, pole);
        return { hip: h, knee: solved.joint, ankle: solved.end };
    };

    const lead = { arm: arm("lead"), leg: leg("lead") };
    const rear = { arm: arm("rear"), leg: leg("rear") };

    // Head: looks toward the target, follows slips and rolls.
    const neck = add(shoulderCenter, vec(headLateral * 0.3, 0.1 - headDip * 0.3, 0.02));
    const headCenter = add(neck, vec(0, 0.09, 0.03));
    const faceYaw = torsoYaw * 0.35;
    const face = (local: Vec3) => add(headCenter, rotY(local, faceYaw));
    const nose = face(vec(0, -0.01, 0.1));
    const eye = (role: Role) => face(vec(SIDE_SIGN[role] * 0.035, 0.03, 0.08));
    const ear = (role: Role) => face(vec(SIDE_SIGN[role] * 0.075, 0, -0.01));

    // Canonical lead/rear → COCO left/right for the current stance.
    const leftRole: Role = orientation === "orthodox" ? "lead" : "rear";
    const rightRole: Role = leftRole === "lead" ? "rear" : "lead";
    const body = { lead, rear };
    const world: Vec3[] = new Array<Vec3>(KEYPOINT_COUNT);
    world[KEYPOINT.nose] = nose;
    world[KEYPOINT.leftEye] = eye(leftRole);
    world[KEYPOINT.rightEye] = eye(rightRole);
    world[KEYPOINT.leftEar] = ear(leftRole);
    world[KEYPOINT.rightEar] = ear(rightRole);
    world[KEYPOINT.leftShoulder] = body[leftRole].arm.shoulder;
    world[KEYPOINT.rightShoulder] = body[rightRole].arm.shoulder;
    world[KEYPOINT.leftElbow] = body[leftRole].arm.elbow;
    world[KEYPOINT.rightElbow] = body[rightRole].arm.elbow;
    world[KEYPOINT.leftWrist] = body[leftRole].arm.wrist;
    world[KEYPOINT.rightWrist] = body[rightRole].arm.wrist;
    world[KEYPOINT.leftHip] = body[leftRole].leg.hip;
    world[KEYPOINT.rightHip] = body[rightRole].leg.hip;
    world[KEYPOINT.leftKnee] = body[leftRole].leg.knee;
    world[KEYPOINT.rightKnee] = body[rightRole].leg.knee;
    world[KEYPOINT.leftAnkle] = body[leftRole].leg.ankle;
    world[KEYPOINT.rightAnkle] = body[rightRole].leg.ankle;

    const trackingLost = events.some((e) => e.type === "tracking_lost");
    const chain = strike ? LIMB_CHAIN[strike.detection.limb] : null;
    const pivot = vec(travel.x, 0, travel.z);
    const azimuth = (p.azimuth * Math.PI) / 180;

    const keypoints = world.map<PoseKeypoint>((point, index) => {
        const turned = add(pivot, rotY(sub(point, pivot), travel.yaw));
        const x = turned.x * mirror;
        const toward = turned.z * Math.cos(azimuth) + x * Math.sin(azimuth);
        const screenX = -x * Math.cos(azimuth) + turned.z * Math.sin(azimuth);
        const screenY = turned.y - toward * PROJECTION.elevation;
        const striking = chain !== null && (index === chain.root || index === chain.joint || index === chain.end);
        const base = 0.9 + 0.06 * Math.sin(index * 1.7 + seconds * 0.8);
        const conf = trackingLost ? 0.1 : striking && strike ? Math.min(base, strike.detection.confidence + 0.05) : base;
        return {
            x: clamp(PROJECTION.centerX + screenX * PROJECTION.scale * (9 / 16), 0.01, 0.99),
            y: clamp(PROJECTION.ground - screenY * PROJECTION.scale, 0.01, 0.99),
            conf: Math.round(conf * 1000) / 1000,
        };
    });

    let activeJoint: SyntheticPose["activeJoint"] = null;
    if (strike && chain) {
        const role = strike.role;
        const limb = isKick ? body[role].leg : null;
        const armPart = body[role].arm;
        activeJoint = limb
            ? { index: chain.joint, angleDeg: Math.round(angleAt(limb.knee, limb.hip, limb.ankle)) }
            : { index: chain.joint, angleDeg: Math.round(angleAt(armPart.elbow, armPart.shoulder, armPart.wrist)) };
    }

    return {
        keypoints,
        detectionId: strike?.detection.id ?? null,
        activeJoint,
        activeEnd: chain?.end ?? null,
        trackingLost,
    };
}

/* ─── Public API ──────────────────────────────────────────────────────────── */

/** Continuous-time pose sampler for playback (cheap enough to call every animation frame). */
export function createSyntheticPoseSampler(analysis: Analysis, stance: Stance, options: SyntheticPoseOptions = {}): SyntheticPoseSampler {
    const detections = [...analysis.detections].sort((a, b) => a.startMs - b.startMs);
    const events = [...analysis.movementEvents].sort((a, b) => a.startMs - b.startMs);
    const prepared: Prepared = {
        detections,
        orientations: detectionOrientations(detections, stance),
        events,
        eventIndex: new Map(events.map((e, i) => [e.id, i])),
        travel: buildTravel(events),
        azimuth: CAMERA_AZIMUTH[options.cameraAngle ?? "diagonal"],
    };
    return (timeMs) => samplePose(prepared, clamp(timeMs, 0, analysis.durationMs));
}

/** A believable COCO-17 pose track sampled at `fps` for the whole analysis. */
export function buildSyntheticPoseTrack(analysis: Analysis, stance: Stance, fps = 30, options: SyntheticPoseOptions = {}): PoseFrame[] {
    const sample = createSyntheticPoseSampler(analysis, stance, options);
    const step = 1000 / fps;
    const count = Math.floor((analysis.durationMs * fps) / 1000 + 1e-6) + 1;
    return Array.from({ length: count }, (_, i) => {
        const timeMs = Math.round(i * step * 10) / 10;
        return { timeMs, keypoints: sample(timeMs).keypoints };
    });
}
