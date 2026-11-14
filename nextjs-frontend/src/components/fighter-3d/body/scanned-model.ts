import * as THREE from "three";

import { MODEL_HEIGHT, type BodyModel, type BodyModelKind, type RegionSpot } from "./regions";

/**
 * Rebuilds the first mesh of a loaded glTF scene in app space (soles on y = 0, `MODEL_HEIGHT` tall,
 * centred on its mean x/z) with plain float positions and normals: a quantised file's integers cannot
 * hold the rescaled values. A file already in app space comes out unchanged.
 */
export function scannedModelFrom(root: THREE.Object3D, kind: BodyModelKind, spots: RegionSpot[]): BodyModel {
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
    return { kind, geometry, spots };
}
