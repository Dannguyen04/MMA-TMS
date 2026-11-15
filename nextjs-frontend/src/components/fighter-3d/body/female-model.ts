import type * as THREE from "three";

import { pair, spot, v, type BodyModel, type RegionSpot } from "./regions";
import { scannedModelFrom } from "./scanned-model";

/**
 * The female body model, made by the team in Blender (14/11/2026) (see `public/models/ATTRIBUTION.md`):
 * a muscular anatomy figure in a sports top and shorts, A-pose, facing +Z, no rig. The app's file
 * merges the body (36k triangles) with the outfit simplified to 14k triangles, and is stored already in
 * app space (soles on y = 0, 1.75 m, centred on its mean x/z).
 *
 * The spots were measured from horizontal slices of that surface (limb centres, the narrowest point of
 * wrist and knee, the widest of hip and calf) and checked on renders from the front, side and back.
 */

export const FEMALE_MODEL_URL = "/models/fighter-body-female.glb";
/** The wireframe: edges of the model simplified to 5k triangles, into the model's vertex order (Uint16 pairs). */
export const FEMALE_WIRE_URL = "/models/fighter-body-female.wire.bin";

export const FEMALE_SPOTS: RegionSpot[] = [
    spot("head", v(0, 1.63, 0), 0.14, v(0, 0.3, 1)),
    spot("neck", v(0, 1.515, -0.01), 0.065, v(0, 0, 1)),
    ...pair("left_shoulder", "right_shoulder", v(0.18, 1.395, -0.03), 0.085, v(1, 0.6, 0.3)),
    ...pair("left_elbow", "right_elbow", v(0.285, 1.15, -0.03), 0.07, v(1, 0, -0.2)),
    ...pair("left_hand", "right_hand", v(0.41, 0.895, 0.032), 0.085, v(1, -0.2, 0.3)),
    spot("chest", v(0, 1.31, 0.1), 0.14, v(0, 0, 1)),
    spot("ribs", v(0.1, 1.19, 0.02), 0.095, v(1, 0, 0.4)),
    spot("ribs", v(-0.1, 1.19, 0.02), 0.095, v(-1, 0, 0.4)),
    spot("lower_back", v(0, 1.06, -0.1), 0.11, v(0, 0, -1)),
    ...pair("left_hip", "right_hip", v(0.165, 0.89, 0), 0.095, v(1, 0, 0.6)),
    ...pair("left_hamstring", "right_hamstring", v(0.095, 0.66, -0.07), 0.11, v(0.2, 0, -1)),
    ...pair("left_knee", "right_knee", v(0.083, 0.53, 0), 0.07, v(0.2, 0, 1)),
    ...pair("left_shin", "right_shin", v(0.086, 0.31, -0.03), 0.09, v(0.2, 0, 1)),
    ...pair("left_ankle", "right_ankle", v(0.09, 0.085, -0.06), 0.06, v(1, 0, 0.4)),
];

export function femaleModelFrom(root: THREE.Object3D): BodyModel {
    return scannedModelFrom(root, "female", FEMALE_SPOTS);
}
