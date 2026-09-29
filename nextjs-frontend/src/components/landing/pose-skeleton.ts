/**
 * The COCO-17 pose skeleton (the keypoint layout YOLOv8-pose predicts) measured on the guard-stance
 * fighter image. Model space is metres: the fighter stands on y = 0 and faces the camera (+Z), so
 * +X is image right, which is the fighter's left.
 */

export type Point3 = readonly [number, number, number];

/** The cutout the stage is built from, and where the fighter sits in it. */
export const FIGHTER_IMAGE = {
    url: "/images/landing/fighter-guard.webp",
    width: 1024,
    height: 1536,
    /** Pixel column of the body's centre line and pixel row of the soles. */
    centerX: 512,
    feetY: 1504,
    /** The fighter stands 1.72 m tall in his guard, head to sole. */
    metresPerPixel: 1.72 / 1483,
} as const;

export const KEYPOINT_NAMES = [
    "nose",
    "left eye",
    "right eye",
    "left ear",
    "right ear",
    "left shoulder",
    "right shoulder",
    "left elbow",
    "right elbow",
    "left wrist",
    "right wrist",
    "left hip",
    "right hip",
    "left knee",
    "right knee",
    "left ankle",
    "right ankle",
] as const;

/** Keypoints in image pixels (x right, y down), in KEYPOINT_NAMES order. */
const KEYPOINT_PIXELS: readonly (readonly [number, number])[] = [
    [554, 200],
    [584, 160],
    [526, 160],
    [612, 156],
    [460, 152],
    [680, 340],
    [380, 320],
    [744, 524],
    [252, 516],
    [688, 364],
    [368, 400],
    [595, 700],
    [430, 700],
    [705, 997],
    [367, 1004],
    [674, 1285],
    [249, 1360],
];

/** Image pixel → model-space metres on the image plane (z = 0). */
export function pixelToModel(x: number, y: number): Point3 {
    const { centerX, feetY, metresPerPixel } = FIGHTER_IMAGE;
    return [(x - centerX) * metresPerPixel, (feetY - y) * metresPerPixel, 0];
}

export const KEYPOINTS: readonly Point3[] = KEYPOINT_PIXELS.map(([x, y]) => pixelToModel(x, y));

/** Keypoint index pairs joined by a bone, in the standard COCO order. */
export const BONES: readonly (readonly [number, number])[] = [
    [15, 13],
    [13, 11],
    [16, 14],
    [14, 12],
    [11, 12],
    [5, 11],
    [6, 12],
    [5, 6],
    [5, 7],
    [6, 8],
    [7, 9],
    [8, 10],
    [1, 2],
    [0, 1],
    [0, 2],
    [1, 3],
    [2, 4],
    [3, 5],
    [4, 6],
];

export const LEFT_HIP = 11;
export const LEFT_KNEE = 13;
export const LEFT_ANKLE = 15;

/** The angle at `vertex` between the segments to `a` and `b`, in degrees. */
export function jointAngle(a: Point3, vertex: Point3, b: Point3): number {
    const u = [a[0] - vertex[0], a[1] - vertex[1], a[2] - vertex[2]];
    const v = [b[0] - vertex[0], b[1] - vertex[1], b[2] - vertex[2]];
    const dot = u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
    const length = Math.hypot(...u) * Math.hypot(...v);
    if (length === 0) return 0;
    return (Math.acos(Math.min(1, Math.max(-1, dot / length))) * 180) / Math.PI;
}

/** Left knee bend (hip–knee–ankle), the joint angle the analysis chapter measures on screen. */
export const LEFT_KNEE_ANGLE = Math.round(jointAngle(KEYPOINTS[LEFT_HIP], KEYPOINTS[LEFT_KNEE], KEYPOINTS[LEFT_ANKLE]));
