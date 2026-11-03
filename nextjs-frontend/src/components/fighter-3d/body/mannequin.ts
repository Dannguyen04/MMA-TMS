import * as THREE from "three";

import { ball, limb, mergeParts, mirrored } from "../primitives";
import { pair, spot, v, type BodyModel, type RegionSpot } from "./regions";

/** A jointed mannequin built from capsules and spheres, standing in a relaxed A-pose. Sex-neutral. */

export const MANNEQUIN_SPOTS: RegionSpot[] = [
    spot("head", v(0, 1.64, 0.02), 0.15, v(0, 0.3, 1)),
    spot("neck", v(0, 1.5, 0), 0.08, v(0, 0, 1)),
    ...pair("left_shoulder", "right_shoulder", v(0.215, 1.41, 0), 0.1, v(1, 0.6, 0.3)),
    ...pair("left_elbow", "right_elbow", v(0.27, 1.11, -0.01), 0.075, v(1, 0, -0.2)),
    ...pair("left_hand", "right_hand", v(0.3, 0.79, 0.01), 0.09, v(1, -0.2, 0.3)),
    spot("chest", v(0, 1.33, 0.11), 0.16, v(0, 0, 1)),
    spot("ribs", v(0.155, 1.17, 0.02), 0.1, v(1, 0, 0.4)),
    spot("ribs", v(-0.155, 1.17, 0.02), 0.1, v(-1, 0, 0.4)),
    spot("lower_back", v(0, 1.04, -0.11), 0.14, v(0, 0, -1)),
    ...pair("left_hip", "right_hip", v(0.12, 0.93, 0.03), 0.1, v(1, 0, 0.6)),
    ...pair("left_hamstring", "right_hamstring", v(0.105, 0.68, -0.07), 0.115, v(0.2, 0, -1)),
    ...pair("left_knee", "right_knee", v(0.112, 0.49, 0.03), 0.075, v(0.2, 0, 1)),
    ...pair("left_shin", "right_shin", v(0.114, 0.3, 0.04), 0.095, v(0.2, 0, 1)),
    ...pair("left_ankle", "right_ankle", v(0.116, 0.085, 0), 0.065, v(1, 0, 0.4)),
];

export function createMannequinModel(): BodyModel {
    const parts: THREE.BufferGeometry[] = [
        // Head and neck
        ball(v(0, 1.635, 0.005), 0.1, v(0.92, 1.12, 1)),
        ball(v(0, 1.57, 0.06), 0.052, v(1.2, 0.8, 1)), // jaw
        limb(v(0, 1.46, -0.005), v(0, 1.53, 0), 0.052),
        // Torso: rib cage, waist, pelvis
        limb(v(0, 1.2, 0), v(0, 1.36, 0), 0.155, v(1.2, 1, 0.74)),
        limb(v(0, 1.02, 0), v(0, 1.12, 0), 0.125, v(1.1, 1, 0.72)),
        limb(v(-0.07, 0.92, 0), v(0.07, 0.92, 0), 0.115, v(1, 1, 0.78)),
        // Arms in a relaxed A-pose
        ...mirrored((s) => ball(v(0.205 * s, 1.405, 0), 0.068)),
        ...mirrored((s) => limb(v(0.225 * s, 1.37, 0), v(0.265 * s, 1.13, -0.01), 0.05)),
        ...mirrored((s) => ball(v(0.268 * s, 1.11, -0.01), 0.043)),
        ...mirrored((s) => limb(v(0.272 * s, 1.09, -0.005), v(0.292 * s, 0.86, 0.01), 0.041)),
        ...mirrored((s) => ball(v(0.298 * s, 0.79, 0.012), 0.046, v(0.8, 1.45, 1))),
        // Legs
        ...mirrored((s) => ball(v(0.1 * s, 0.9, 0), 0.085)),
        ...mirrored((s) => limb(v(0.103 * s, 0.86, 0), v(0.11 * s, 0.52, 0.005), 0.078, v(1, 1, 1.05))),
        ...mirrored((s) => ball(v(0.111 * s, 0.49, 0.012), 0.058)),
        ...mirrored((s) => limb(v(0.112 * s, 0.46, 0.005), v(0.116 * s, 0.11, -0.005), 0.056)),
        ...mirrored((s) => ball(v(0.116 * s, 0.085, 0), 0.045)),
        ...mirrored((s) => limb(v(0.118 * s, 0.035, -0.02), v(0.122 * s, 0.035, 0.11), 0.036, v(1.15, 1, 1))),
    ];
    return { kind: "mannequin", geometry: mergeParts(parts), spots: MANNEQUIN_SPOTS };
}
