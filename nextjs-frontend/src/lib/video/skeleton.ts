import type { Limb, PoseFrame, PoseKeypoint } from "@/lib/domain/types";

/** COCO-17 keypoint indices, as produced by YOLOv8-pose and the synthetic reconstruction. */
export const KEYPOINT = {
    nose: 0,
    leftEye: 1,
    rightEye: 2,
    leftEar: 3,
    rightEar: 4,
    leftShoulder: 5,
    rightShoulder: 6,
    leftElbow: 7,
    rightElbow: 8,
    leftWrist: 9,
    rightWrist: 10,
    leftHip: 11,
    rightHip: 12,
    leftKnee: 13,
    rightKnee: 14,
    leftAnkle: 15,
    rightAnkle: 16,
} as const;

export const KEYPOINT_COUNT = 17;

/** Bones drawn between keypoints (face bones excluded — the head is drawn as a circle). */
export const SKELETON_EDGES: readonly (readonly [number, number])[] = [
    [KEYPOINT.leftShoulder, KEYPOINT.rightShoulder],
    [KEYPOINT.leftShoulder, KEYPOINT.leftHip],
    [KEYPOINT.rightShoulder, KEYPOINT.rightHip],
    [KEYPOINT.leftHip, KEYPOINT.rightHip],
    [KEYPOINT.leftShoulder, KEYPOINT.leftElbow],
    [KEYPOINT.leftElbow, KEYPOINT.leftWrist],
    [KEYPOINT.rightShoulder, KEYPOINT.rightElbow],
    [KEYPOINT.rightElbow, KEYPOINT.rightWrist],
    [KEYPOINT.leftHip, KEYPOINT.leftKnee],
    [KEYPOINT.leftKnee, KEYPOINT.leftAnkle],
    [KEYPOINT.rightHip, KEYPOINT.rightKnee],
    [KEYPOINT.rightKnee, KEYPOINT.rightAnkle],
];

/** Root, middle joint and end effector of each limb. */
export const LIMB_CHAIN: Record<Limb, { root: number; joint: number; end: number }> = {
    left_arm: { root: KEYPOINT.leftShoulder, joint: KEYPOINT.leftElbow, end: KEYPOINT.leftWrist },
    right_arm: { root: KEYPOINT.rightShoulder, joint: KEYPOINT.rightElbow, end: KEYPOINT.rightWrist },
    left_leg: { root: KEYPOINT.leftHip, joint: KEYPOINT.leftKnee, end: KEYPOINT.leftAnkle },
    right_leg: { root: KEYPOINT.rightHip, joint: KEYPOINT.rightKnee, end: KEYPOINT.rightAnkle },
};

/** Keypoints below this confidence are treated as not visible. */
export const MIN_KEYPOINT_CONFIDENCE = 0.25;

/**
 * Angle at `b` (degrees) between normalised keypoints. `aspect` (width / height) corrects
 * for x and y being normalised against different frame dimensions.
 */
export function jointAngleDeg(a: PoseKeypoint, b: PoseKeypoint, c: PoseKeypoint, aspect = 16 / 9): number {
    const abx = (a.x - b.x) * aspect;
    const aby = a.y - b.y;
    const cbx = (c.x - b.x) * aspect;
    const cby = c.y - b.y;
    const denom = Math.hypot(abx, aby) * Math.hypot(cbx, cby);
    if (denom === 0) return 0;
    const cos = Math.min(1, Math.max(-1, (abx * cbx + aby * cby) / denom));
    return (Math.acos(cos) * 180) / Math.PI;
}

/** Index of the last frame at or before `timeMs` in a time-sorted list; -1 when the list is empty or starts later. */
export function indexAtOrBefore(frames: readonly Pick<PoseFrame, "timeMs">[], timeMs: number): number {
    let lo = 0;
    let hi = frames.length - 1;
    let found = -1;
    while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (frames[mid].timeMs <= timeMs) {
            found = mid;
            lo = mid + 1;
        } else hi = mid - 1;
    }
    return found;
}

/** The frame closest to `timeMs` in a time-sorted list, or null for an empty list. */
export function nearestFrame(frames: PoseFrame[], timeMs: number): PoseFrame | null {
    if (frames.length === 0) return null;
    const index = indexAtOrBefore(frames, timeMs);
    if (index < 0) return frames[0];
    const before = frames[index];
    const after = frames[Math.min(index + 1, frames.length - 1)];
    return Math.abs(before.timeMs - timeMs) <= Math.abs(after.timeMs - timeMs) ? before : after;
}

/** True when the keypoint exists and is confident enough to draw. */
export function isVisible(point: PoseKeypoint | undefined): point is PoseKeypoint {
    return point !== undefined && point.conf >= MIN_KEYPOINT_CONFIDENCE;
}
