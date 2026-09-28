import * as THREE from "three";

import { CAGE } from "../story";

/** Octagon measurements shared by the mat and the cage: flat sides face ±X and ±Z. */
export const CIRCUMRADIUS = CAGE.apothem / Math.cos(Math.PI / 8);
export const SIDE_LENGTH = 2 * CAGE.apothem * Math.tan(Math.PI / 8);

/** Corner k of the octagon, on the ground plane (x, z). */
export function corner(k: number, radius = CIRCUMRADIUS): THREE.Vector2 {
    const angle = Math.PI / 8 + (k * Math.PI) / 4;
    return new THREE.Vector2(Math.cos(angle) * radius, Math.sin(angle) * radius);
}

export function octagonShape(radius: number): THREE.Shape {
    const shape = new THREE.Shape();
    for (let k = 0; k < 8; k++) {
        const point = corner(k, radius);
        if (k === 0) shape.moveTo(point.x, point.y);
        else shape.lineTo(point.x, point.y);
    }
    shape.closePath();
    return shape;
}
