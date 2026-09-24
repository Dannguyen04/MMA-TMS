export type FighterAction = "idle" | "uppercut" | "hook-left" | "hook-right" | "jab-cross";

export interface FighterPose {
    rootY: number;
    rootYaw: number;
    torsoPitch: number;
    torsoYaw: number;
    headYaw: number;
    leftShoulder: [number, number, number];
    rightShoulder: [number, number, number];
    leftElbow: number;
    rightElbow: number;
    leftHip: [number, number, number];
    rightHip: [number, number, number];
    leftKnee: number;
    rightKnee: number;
    impact: number;
}

export interface PointerPosition {
    x: number;
    y: number;
}

export interface FighterSample {
    action: FighterAction;
    progress: number;
}

export interface FighterController {
    trigger(action: FighterAction, now: number): boolean;
    sample(now: number): FighterSample;
}

const ACTION_DURATION_MS: Record<Exclude<FighterAction, "idle">, number> = {
    uppercut: 880,
    "hook-left": 780,
    "hook-right": 780,
    "jab-cross": 980,
};

const GESTURE_THRESHOLD = 42;
const DIRECTION_DOMINANCE = 1.25;

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const smoothstep = (value: number) => {
    const t = clamp(value);
    return t * t * (3 - 2 * t);
};
const pulse = (progress: number, center: number, width: number) => smoothstep(1 - Math.abs(progress - center) / width);
const mix = (from: number, to: number, amount: number) => from + (to - from) * amount;
const mixTuple = (from: [number, number, number], to: [number, number, number], amount: number): [number, number, number] => [
    mix(from[0], to[0], amount),
    mix(from[1], to[1], amount),
    mix(from[2], to[2], amount),
];

function idlePose(idleTime: number, pointer: PointerPosition): FighterPose {
    const breath = Math.sin(idleTime * 1.8);
    const settle = Math.sin(idleTime * 0.9);
    return {
        rootY: breath * 0.012,
        rootYaw: -0.16 + pointer.x * 0.035,
        torsoPitch: -0.03 + breath * 0.015 - pointer.y * 0.02,
        torsoYaw: pointer.x * 0.045,
        headYaw: pointer.x * 0.12,
        leftShoulder: [-0.78 + breath * 0.015, -0.12, -0.42],
        rightShoulder: [-0.82 - breath * 0.012, 0.1, 0.46],
        leftElbow: -1.72 + settle * 0.025,
        rightElbow: 1.68 - settle * 0.025,
        leftHip: [0.05, 0.08, -0.07],
        rightHip: [-0.08, -0.08, 0.07],
        leftKnee: 0.16 - settle * 0.02,
        rightKnee: 0.24 + settle * 0.02,
        impact: 0,
    };
}

function blendPose(base: FighterPose, target: Partial<FighterPose>, amount: number): FighterPose {
    const result = { ...base };
    for (const key of Object.keys(target) as (keyof FighterPose)[]) {
        const from = base[key];
        const to = target[key];
        if (to === undefined) continue;
        if (Array.isArray(from) && Array.isArray(to)) {
            (result[key] as [number, number, number]) = mixTuple(from, to, amount);
        } else {
            (result[key] as number) = mix(from as number, to as number, amount);
        }
    }
    return result;
}

function strikeAmount(progress: number, impactAt: number) {
    if (progress <= impactAt) return smoothstep(progress / impactAt);
    return smoothstep((1 - progress) / (1 - impactAt));
}

/** Maps a completed pointer or touch gesture to an attack without stealing normal downward scrolling. */
export function gestureAction(deltaX: number, deltaY: number): FighterAction | null {
    const horizontal = Math.abs(deltaX);
    const vertical = Math.abs(deltaY);
    if (Math.max(horizontal, vertical) < GESTURE_THRESHOLD) return null;
    if (horizontal > vertical * DIRECTION_DOMINANCE) return deltaX > 0 ? "hook-right" : "hook-left";
    if (deltaY < 0 && vertical > horizontal * DIRECTION_DOMINANCE) return "uppercut";
    return null;
}

/** Produces a complete pose for the articulated fighter. Progress is always treated as 0..1. */
export function poseForAction(action: FighterAction, progress: number, idleTime: number, pointer: PointerPosition): FighterPose {
    const t = clamp(progress);
    const base = idlePose(idleTime, action === "idle" ? pointer : { x: 0, y: 0 });
    if (action === "idle") return base;

    if (action === "uppercut") {
        const amount = strikeAmount(t, 0.48);
        return blendPose(
            base,
            {
                rootY: 0.13,
                rootYaw: -0.04,
                torsoPitch: -0.22,
                torsoYaw: -0.34,
                headYaw: 0.04,
                rightShoulder: [-2.45, 0.08, 0.15],
                rightElbow: 1.05,
                leftShoulder: [-0.62, -0.08, -0.55],
                leftElbow: -1.9,
                rightKnee: 0.08,
                impact: pulse(t, 0.48, 0.13),
            },
            amount,
        );
    }

    const side = action === "hook-left" ? -1 : 1;
    if (action === "hook-left" || action === "hook-right") {
        const amount = strikeAmount(t, 0.5);
        const strikingShoulder: [number, number, number] = [-1.38, side * 0.9, side * 0.12];
        return blendPose(
            base,
            {
                rootYaw: -0.16 + side * 0.42,
                torsoPitch: -0.08,
                torsoYaw: side * 0.82,
                headYaw: side * -0.05,
                ...(side < 0
                    ? { leftShoulder: strikingShoulder, leftElbow: -1.42, rightShoulder: [-0.7, 0.08, 0.52] as [number, number, number] }
                    : { rightShoulder: strikingShoulder, rightElbow: 1.42, leftShoulder: [-0.7, -0.08, -0.52] as [number, number, number] }),
                leftKnee: side < 0 ? 0.08 : 0.25,
                rightKnee: side > 0 ? 0.08 : 0.25,
                impact: pulse(t, 0.5, 0.12),
            },
            amount,
        );
    }

    const firstPunch = pulse(t, 0.3, 0.25);
    const secondPunch = pulse(t, 0.68, 0.25);
    const pose = blendPose(
        base,
        {
            torsoYaw: mix(-0.28, 0.45, secondPunch),
            leftShoulder: [-1.52, -0.1, -0.08],
            leftElbow: -0.12,
            rightShoulder: [-1.5, 0.12, 0.08],
            rightElbow: 0.12,
        },
        Math.max(firstPunch, secondPunch),
    );
    pose.leftShoulder = mixTuple(base.leftShoulder, [-1.52, -0.1, -0.08], firstPunch);
    pose.leftElbow = mix(base.leftElbow, -0.12, firstPunch);
    pose.rightShoulder = mixTuple(base.rightShoulder, [-1.5, 0.12, 0.08], secondPunch);
    pose.rightElbow = mix(base.rightElbow, 0.12, secondPunch);
    pose.impact = Math.max(pulse(t, 0.3, 0.09), pulse(t, 0.68, 0.09));
    return pose;
}

/** Small timestamp-based controller that serializes attacks and exposes animation progress. */
export function createFighterController({ reducedMotion, cooldownMs }: { reducedMotion: boolean; cooldownMs: number }): FighterController {
    let active: Exclude<FighterAction, "idle"> | null = null;
    let startedAt = 0;
    let lockedUntil = 0;

    const expire = (now: number) => {
        if (active && now - startedAt >= ACTION_DURATION_MS[active]) active = null;
    };

    return {
        trigger(action: FighterAction, now: number) {
            expire(now);
            if (reducedMotion || action === "idle" || active || now < lockedUntil) return false;
            active = action;
            startedAt = now;
            lockedUntil = now + Math.max(ACTION_DURATION_MS[action], cooldownMs);
            return true;
        },
        sample(now: number): FighterSample {
            expire(now);
            if (!active) return { action: "idle", progress: 0 };
            return { action: active, progress: clamp((now - startedAt) / ACTION_DURATION_MS[active]) };
        },
    };
}
