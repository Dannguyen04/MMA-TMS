import * as THREE from "three";

import { MODEL_HEIGHT, pair, spot, v, type BodyModel, type RegionSpot } from "./regions";

/**
 * The scanned anatomy model ("Male base muscular anatomy", Harshit Prajapati, CC BY 4.0; see
 * `public/models/ATTRIBUTION.md`): male, A-pose, about 35k triangles, no rig.
 *
 * The file is quantised and sits at its own scale and offset; `muscularModelFrom` rebuilds it in app
 * space (soles on y = 0, 1.75 m, facing +Z, centred on its mean x/z). The spots below were measured on
 * the model in that space: joint centres from the file's own joint masks (`_GEO0`–`_GEO3`), the other
 * regions from slices of the surface. Radii are trimmed so neighbouring regions do not swallow each other.
 */

export const MUSCULAR_MODEL_URL = "/models/fighter-body.glb";

export const MUSCULAR_SPOTS: RegionSpot[] = [
    spot("head", v(0, 1.6, -0.019), 0.16, v(0, 0.3, 1)),
    spot("neck", v(0, 1.505, -0.007), 0.075, v(0, 0, 1)),
    ...pair("left_shoulder", "right_shoulder", v(0.21, 1.403, -0.035), 0.095, v(1, 0.6, 0.3)),
    ...pair("left_elbow", "right_elbow", v(0.338, 1.084, -0.04), 0.085, v(1, 0, -0.2)),
    ...pair("left_hand", "right_hand", v(0.502, 0.792, 0.007), 0.1, v(1, -0.2, 0.3)),
    spot("chest", v(0, 1.283, 0.08), 0.15, v(0, 0, 1)),
    spot("ribs", v(0.126, 1.144, -0.022), 0.11, v(1, 0, 0.4)),
    spot("ribs", v(-0.126, 1.144, -0.022), 0.11, v(-1, 0, 0.4)),
    spot("lower_back", v(0, 1.02, -0.138), 0.12, v(0, 0, -1)),
    ...pair("left_hip", "right_hip", v(0.194, 0.835, -0.011), 0.1, v(1, 0, 0.6)),
    ...pair("left_hamstring", "right_hamstring", v(0.119, 0.688, -0.105), 0.12, v(0.2, 0, -1)),
    ...pair("left_knee", "right_knee", v(0.175, 0.507, -0.013), 0.09, v(0.2, 0, 1)),
    ...pair("left_shin", "right_shin", v(0.194, 0.311, 0.02), 0.1, v(0.2, 0, 1)),
    ...pair("left_ankle", "right_ankle", v(0.226, 0.085, -0.012), 0.075, v(1, 0, 0.4)),
];

/**
 * Rebuilds the first mesh of a loaded glTF scene in app space with plain float positions and
 * normals (the file's are quantised integers, which cannot hold the rescaled values).
 */
export function muscularModelFrom(root: THREE.Object3D): BodyModel {
    root.updateMatrixWorld(true);
    let source: THREE.Mesh | null = null;
    root.traverse((object) => {
        if (!source && (object as THREE.Mesh).isMesh) source = object as THREE.Mesh;
    });
    if (!source) throw new Error("The body model has no mesh.");
    const mesh: THREE.Mesh = source;
    const positions = mesh.geometry.getAttribute("position");
    const normals = mesh.geometry.getAttribute("normal");
    const matrix = mesh.matrixWorld;
    const normalMatrix = new THREE.Matrix3().getNormalMatrix(matrix);

    const count = positions.count;
    const out = new Float32Array(count * 3);
    const point = new THREE.Vector3();
    let minY = Infinity;
    let maxY = -Infinity;
    let sumX = 0;
    let sumZ = 0;
    for (let i = 0; i < count; i++) {
        point.fromBufferAttribute(positions, i).applyMatrix4(matrix);
        out.set([point.x, point.y, point.z], i * 3);
        minY = Math.min(minY, point.y);
        maxY = Math.max(maxY, point.y);
        sumX += point.x;
        sumZ += point.z;
    }
    const scale = MODEL_HEIGHT / (maxY - minY);
    const meanX = sumX / count;
    const meanZ = sumZ / count;
    for (let i = 0; i < count; i++) {
        out[i * 3] = (out[i * 3] - meanX) * scale;
        out[i * 3 + 1] = (out[i * 3 + 1] - minY) * scale;
        out[i * 3 + 2] = (out[i * 3 + 2] - meanZ) * scale;
    }

    const outNormals = new Float32Array(count * 3);
    const normal = new THREE.Vector3();
    for (let i = 0; i < count; i++) {
        normal.fromBufferAttribute(normals, i).applyMatrix3(normalMatrix).normalize();
        outNormals.set([normal.x, normal.y, normal.z], i * 3);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(out, 3));
    geometry.setAttribute("normal", new THREE.BufferAttribute(outNormals, 3));
    const index = mesh.geometry.getIndex();
    if (index) geometry.setIndex(index.clone());
    geometry.computeBoundingSphere();
    geometry.computeBoundingBox();
    return { kind: "muscular", geometry, spots: MUSCULAR_SPOTS };
}
