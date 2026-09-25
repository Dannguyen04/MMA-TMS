/**
 * The landing page's scroll story as plain numbers: which chapter the reader is in and how far
 * through it, turned into a stage description (camera, lights and effect strengths) for the WebGL
 * scene. Pure and deterministic so the choreography is unit-tested without a browser.
 *
 * World space: the fighter stands at the origin on y = 0 in the middle of an octagon cage whose flat
 * side faces +Z. He is a 2.5D cutout, so he always turns to face the camera.
 */

export const CHAPTERS = ["hero", "analysis", "training", "performance", "medicine", "roles", "cta"] as const;
export type ChapterId = (typeof CHAPTERS)[number];
export type Vec3 = [number, number, number];

export interface StoryState {
    /** Chapter position: 2.4 is 40% of the way from chapter 2 to chapter 3. */
    position: number;
    /** Progress through each chapter's pinned scroll, 0–1. */
    local: Record<ChapterId, number>;
    /** Normalised pointer, -1…1 with +y up. */
    pointer: { x: number; y: number };
    /** Page-load intro, 0 → 1. */
    intro: number;
    /** Narrow, portrait layout: the fighter is framed in the centre. */
    compact: boolean;
}

/** A camera orbiting the fighter's vertical axis, which is how every chapter frames him. */
export interface Shot {
    /** Angle around the fighter from his front (+Z), radians; positive swings toward his left (+X). */
    azimuth: number;
    /** Angle above the horizon, radians. */
    elevation: number;
    distance: number;
    /** Height the camera looks at on the fighter's axis, metres. */
    height: number;
    /** Slides the whole shot sideways so the fighter sits right (+) or left (−) of centre, leaving room for copy. */
    shift: number;
    fov: number;
    /** Fighter yaw away from facing the camera, radians; small, so the relief reads without showing the flat back. */
    turn: number;
}

export interface CameraPose {
    position: Vec3;
    target: Vec3;
    fov: number;
    /** Fighter yaw: toward the camera, plus the shot's turn. */
    facing: number;
}

export interface RimLight {
    left: Vec3;
    right: Vec3;
    strength: number;
}

export interface StageFrame {
    camera: CameraPose;
    rim: RimLight;
    /** 0 while the arena lights are off during the intro, 1 once they are on. */
    lights: number;
    /** How far the cage's LED strips and the mat markings have lit up. */
    strips: number;
    /** Height of the analysis scan line in metres, and how bright it is. */
    scanY: number;
    scan: number;
    /** Pose keypoints and bones, the measured elbow angle, the technique bars. */
    skeleton: number;
    angle: number;
    bars: number;
    /** Hologram look and the pulsing focus region for sports medicine. */
    xray: number;
    focus: number;
    /** The four role light beams. */
    beams: number;
}

const RED: Vec3 = [0.84, 0.2, 0.25];
const BLUE: Vec3 = [0.18, 0.49, 0.88];
const CYAN: Vec3 = [0.2, 0.85, 0.95];
const AMBER: Vec3 = [0.98, 0.62, 0.22];
const ICE: Vec3 = [0.75, 0.9, 1];

/** The octagon: distance from the centre to each flat side of the fence, and the fence height. */
export const CAGE = { apothem: 4.6, fenceHeight: 1.85 } as const;

/** How far a floor point is from the centre in "octagon distance": equal to the apothem on the fence. */
export function cageReach(x: number, z: number): number {
    let reach = -Infinity;
    for (let side = 0; side < 8; side++) {
        const angle = Math.PI / 2 + (side * Math.PI) / 4;
        reach = Math.max(reach, x * Math.cos(angle) + z * Math.sin(angle));
    }
    return reach;
}

/**
 * Per-chapter framing. Wide layouts leave room for copy on one side; compact (portrait) layouts put
 * the fighter below the hero copy, then above each chapter's copy. Every close shot stays inside the
 * cage; the wide roles shot looks down over the fence.
 */
const WIDE: Record<ChapterId, Shot> = {
    hero: { azimuth: 0.18, elevation: 0.03, distance: 4.1, height: 0.98, shift: 0.88, fov: 32, turn: 0 },
    analysis: { azimuth: -0.3, elevation: 0.05, distance: 3.5, height: 1.0, shift: -0.7, fov: 34, turn: 0 },
    training: { azimuth: 0.85, elevation: -0.05, distance: 3.7, height: 1.05, shift: 0, fov: 34, turn: -0.3 },
    performance: { azimuth: 0, elevation: 0.42, distance: 4.0, height: 0.7, shift: 0, fov: 36, turn: 0 },
    medicine: { azimuth: 0.4, elevation: 0.06, distance: 3.6, height: 0.95, shift: -0.72, fov: 32, turn: 0 },
    roles: { azimuth: 0.25, elevation: 0.5, distance: 10, height: 0.3, shift: 0, fov: 34, turn: 0 },
    cta: { azimuth: -0.2, elevation: 0.03, distance: 4.1, height: 0.98, shift: -0.88, fov: 32, turn: 0 },
};

const COMPACT: Record<ChapterId, Shot> = {
    hero: { azimuth: 0.15, elevation: 0.02, distance: 4.2, height: 2.1, shift: 0, fov: 56, turn: 0 },
    analysis: { azimuth: -0.3, elevation: 0.05, distance: 4.2, height: 0.35, shift: 0, fov: 46, turn: 0 },
    training: { azimuth: 0.85, elevation: -0.02, distance: 4.2, height: 0.4, shift: 0, fov: 46, turn: -0.3 },
    performance: { azimuth: 0, elevation: 0.45, distance: 4.2, height: 0.1, shift: 0, fov: 48, turn: 0 },
    medicine: { azimuth: 0.4, elevation: 0.05, distance: 4.2, height: 0.35, shift: 0, fov: 46, turn: 0 },
    roles: { azimuth: 0.25, elevation: 0.54, distance: 11, height: -0.2, shift: 0, fov: 44, turn: 0 },
    cta: { azimuth: -0.15, elevation: 0.02, distance: 4.2, height: 0.35, shift: 0, fov: 46, turn: 0 },
};

/** Where the camera starts before the intro: high above the arena, craning down over the fence. */
const INTRO_START: Shot = { azimuth: 0.9, elevation: 0.42, distance: 13, height: 1.0, shift: 0, fov: 28, turn: 0 };

const RIMS: Record<ChapterId, RimLight> = {
    hero: { left: BLUE, right: RED, strength: 1 },
    analysis: { left: CYAN, right: BLUE, strength: 0.9 },
    training: { left: BLUE, right: ICE, strength: 0.85 },
    performance: { left: AMBER, right: RED, strength: 0.95 },
    medicine: { left: CYAN, right: ICE, strength: 0.8 },
    roles: { left: BLUE, right: RED, strength: 0.9 },
    cta: { left: RED, right: BLUE, strength: 1 },
};

/** Top and bottom of the analysis scan sweep, just above the head to just below the feet. */
export const SCAN_TOP = 1.92;
export const SCAN_BOTTOM = -0.05;

export function initialStory(compact = false): StoryState {
    return {
        position: 0,
        local: Object.fromEntries(CHAPTERS.map((id) => [id, 0])) as Record<ChapterId, number>,
        pointer: { x: 0, y: 0 },
        intro: 0,
        compact,
    };
}

export function chapterIndex(id: ChapterId): number {
    return CHAPTERS.indexOf(id);
}

/** 1 while the reader is in `id`, falling to 0 one chapter away in either direction. */
export function presence(position: number, id: ChapterId): number {
    return clamp01(1 - Math.abs(position - chapterIndex(id)));
}

export function stageAt(story: StoryState): StageFrame {
    const position = Math.min(Math.max(story.position, 0), CHAPTERS.length - 1);
    const from = Math.floor(position);
    const to = Math.min(from + 1, CHAPTERS.length - 1);
    const blend = easeInOut(position - from);
    const shots = story.compact ? COMPACT : WIDE;

    let shot = mixShot(shots[CHAPTERS[from]], shots[CHAPTERS[to]], blend);
    const intro = clamp01(story.intro);
    shot = mixShot(INTRO_START, shot, easeOutQuart(intro));
    // A little parallax from the pointer, never enough to lose the framing.
    shot = { ...shot, azimuth: shot.azimuth + story.pointer.x * 0.07, elevation: shot.elevation + story.pointer.y * 0.035 };
    const camera = poseFromShot(shot);

    const rimFrom = RIMS[CHAPTERS[from]];
    const rimTo = RIMS[CHAPTERS[to]];
    const rim: RimLight = {
        left: mix3(rimFrom.left, rimTo.left, blend),
        right: mix3(rimFrom.right, rimTo.right, blend),
        strength: lerp(rimFrom.strength, rimTo.strength, blend),
    };

    // The pose overlay leaves early, so no half-faded skeleton lingers on the next chapter.
    const analysis = smoothstep(0.55, 1, presence(position, "analysis"));
    const scanProgress = smoothstep(0.02, 0.5, story.local.analysis);
    const performance = presence(position, "performance");
    const medicine = presence(position, "medicine");

    return {
        camera,
        rim,
        lights: flicker(intro),
        strips: smoothstep(0.35, 1, intro),
        scanY: lerp(SCAN_TOP, SCAN_BOTTOM, scanProgress),
        scan: analysis * (scanProgress > 0 && scanProgress < 1 ? 1 : 0.35),
        skeleton: analysis,
        angle: analysis * smoothstep(0.55, 0.75, story.local.analysis),
        bars: performance * smoothstep(0.05, 0.6, story.local.performance),
        xray: medicine,
        focus: medicine * smoothstep(0.15, 0.55, story.local.medicine),
        beams: presence(position, "roles"),
    };
}

/** Lights snap on part-way through the intro with a short stutter, like arena rigs warming up. */
function flicker(intro: number): number {
    if (intro < 0.18) return 0;
    if (intro < 0.24) return 0.55;
    if (intro < 0.28) return 0.1;
    return smoothstep(0.28, 0.6, intro);
}

/**
 * Orbit interpolation: the camera swings round the fighter instead of cutting through him. Moving
 * out it rises before it pulls back, moving in it closes the distance before it drops, so the
 * camera cranes over the fence rather than passing through it.
 */
function mixShot(a: Shot, b: Shot, t: number): Shot {
    let turnaround = b.azimuth - a.azimuth;
    turnaround = Math.atan2(Math.sin(turnaround), Math.cos(turnaround));
    const outward = b.distance > a.distance;
    const rise = outward ? easeOutCubic(t) : easeInCubic(t);
    const travel = outward ? easeInCubic(t) : easeOutCubic(t);
    return {
        azimuth: a.azimuth + turnaround * t,
        elevation: lerp(a.elevation, b.elevation, rise),
        distance: lerp(a.distance, b.distance, travel),
        height: lerp(a.height, b.height, t),
        shift: lerp(a.shift, b.shift, t),
        fov: lerp(a.fov, b.fov, t),
        turn: lerp(a.turn, b.turn, t),
    };
}

export function poseFromShot(shot: Shot): CameraPose {
    const direction: Vec3 = [Math.sin(shot.azimuth) * Math.cos(shot.elevation), Math.sin(shot.elevation), Math.cos(shot.azimuth) * Math.cos(shot.elevation)];
    // Camera right on the ground plane; sliding along it moves the fighter across the frame.
    const right: Vec3 = [Math.cos(shot.azimuth), 0, -Math.sin(shot.azimuth)];
    const target: Vec3 = [-right[0] * shot.shift, shot.height, -right[2] * shot.shift];
    const position: Vec3 = [target[0] + direction[0] * shot.distance, target[1] + direction[1] * shot.distance, target[2] + direction[2] * shot.distance];
    return { position, target, fov: shot.fov, facing: Math.atan2(position[0], position[2]) + shot.turn };
}

function mix3(a: Vec3, b: Vec3, t: number): Vec3 {
    return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}

function lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
}

function clamp01(value: number): number {
    return Math.min(1, Math.max(0, value));
}

function smoothstep(edge0: number, edge1: number, value: number): number {
    const t = clamp01((value - edge0) / (edge1 - edge0));
    return t * t * (3 - 2 * t);
}

function easeInOut(t: number): number {
    return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

function easeOutQuart(t: number): number {
    return 1 - (1 - t) ** 4;
}

function easeInCubic(t: number): number {
    return t * t * t;
}

function easeOutCubic(t: number): number {
    return 1 - (1 - t) ** 3;
}
