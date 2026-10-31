import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/** Building blocks for the procedural mannequins, in metres. */

export const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

const UP = v(0, 1, 0);

/** Segment counts: "high" for one large interactive stage, "low" for small portraits drawn many times. */
export type Detail = "high" | "low";
const SEGMENTS: Record<Detail, { cap: number; radial: number; sphere: [number, number] }> = {
    high: { cap: 8, radial: 20, sphere: [28, 20] },
    low: { cap: 4, radial: 12, sphere: [16, 12] },
};

/** A capsule from one joint to another, optionally scaled across (x, z) to flatten a torso. */
export function limb(from: THREE.Vector3, to: THREE.Vector3, radius: number, scale = v(1, 1, 1), detail: Detail = "high"): THREE.BufferGeometry {
    const dir = to.clone().sub(from);
    const { cap, radial } = SEGMENTS[detail];
    const geometry = new THREE.CapsuleGeometry(radius, dir.length(), cap, radial, 1);
    const matrix = new THREE.Matrix4().compose(
        from.clone().add(to).multiplyScalar(0.5),
        new THREE.Quaternion().setFromUnitVectors(UP, dir.normalize()),
        scale,
    );
    return geometry.applyMatrix4(matrix);
}

export function ball(center: THREE.Vector3, radius: number, scale = v(1, 1, 1), detail: Detail = "high"): THREE.BufferGeometry {
    const geometry = new THREE.SphereGeometry(radius, ...SEGMENTS[detail].sphere);
    return geometry.applyMatrix4(new THREE.Matrix4().compose(center, new THREE.Quaternion(), scale));
}

/** Left-side part and its mirror. */
export function mirrored(make: (sign: 1 | -1) => THREE.BufferGeometry): THREE.BufferGeometry[] {
    return [make(1), make(-1)];
}

/** Capsules and spheres differ in attributes; plain triangles without uv merge into one geometry. */
export function mergeParts(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
    const merged = mergeGeometries(
        parts.map((part) => {
            const flat = part.index ? part.toNonIndexed() : part;
            flat.deleteAttribute("uv");
            return flat;
        }),
        false,
    );
    merged.computeBoundingSphere();
    return merged;
}
