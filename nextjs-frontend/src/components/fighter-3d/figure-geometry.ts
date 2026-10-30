import type * as THREE from "three";

import type { FigureParams } from "./figure-params";
import { ball as ballHigh, limb as limbHigh, mergeParts, v, type Detail } from "./primitives";

/**
 * A fighter's own figure in a fighting guard: chin down, lead hand forward at eye level, rear hand at the
 * chin, lead foot forward, knees soft. Built at 1.75 m and scaled to the fighter's height; sex sets the
 * frame (shoulders, hips, head), BMI the thickness, body fat the waist. Faces +Z, soles on y = 0.
 *
 * Joints are written for an orthodox stance (left side, +X, leads); a southpaw mirrors every x.
 */

const FRAME = {
    male: { shoulder: 0.2, hip: 0.095, chest: 1.22, waist: 1.06, head: 0.1, neck: 0.056 },
    female: { shoulder: 0.176, hip: 0.112, chest: 1.08, waist: 0.95, head: 0.094, neck: 0.046 },
} as const;

export function createFigureGeometry(params: FigureParams, detail: Detail = "low"): THREE.BufferGeometry {
    const ball = (center: THREE.Vector3, radius: number, scale?: THREE.Vector3) => ballHigh(center, radius, scale, detail);
    const limb = (from: THREE.Vector3, to: THREE.Vector3, radius: number, scale?: THREE.Vector3) => limbHigh(from, to, radius, scale, detail);
    const k = params.height / 1.75;
    const s = params.lead === "left" ? 1 : -1;
    const b = params.bulk;
    const frame = FRAME[params.sex];
    // Joint position: orthodox coordinates, mirrored for a southpaw, scaled to height.
    const j = (x: number, y: number, z: number) => v(x * s * k, y * k, z * k);

    const hipLead = j(frame.hip, 0.9, 0.03);
    const hipRear = j(-frame.hip, 0.9, -0.03);
    const kneeLead = j(0.14, 0.5, 0.17);
    const kneeRear = j(-0.15, 0.49, -0.1);
    const ankleLead = j(0.15, 0.085, 0.24);
    const ankleRear = j(-0.19, 0.085, -0.22);
    const shoulderLead = j(frame.shoulder, 1.38, 0.05);
    const shoulderRear = j(-frame.shoulder, 1.37, 0);
    const elbowLead = j(0.2, 1.17, 0.22);
    const elbowRear = j(-0.17, 1.14, 0.12);
    const fistLead = j(0.11, 1.41, 0.33);
    const fistRear = j(-0.08, 1.42, 0.19);
    const torso = v(frame.chest * b, 1, 0.74 * b);
    const waist = v((frame.waist + params.softness) * b, 1, (0.72 + params.softness) * b);

    const parts: THREE.BufferGeometry[] = [
        // Head tucked behind the lead shoulder, neck, and (female) a hair bun at the back.
        ball(j(0.01, 1.585, 0.08), frame.head * k, v(0.92, 1.12, 1)),
        ball(j(0.01, 1.525, 0.13), frame.head * 0.5 * k, v(1.2, 0.8, 1)),
        limb(j(0, 1.44, 0.04), j(0.005, 1.52, 0.07), frame.neck * k * b),
        // Torso: rib cage leaning slightly forward, waist, pelvis.
        limb(j(0, 1.2, 0.01), j(0, 1.34, 0.04), 0.15 * k, torso),
        limb(j(0, 1.0, 0), j(0, 1.11, 0.005), 0.122 * k, waist),
        limb(j(-0.065, 0.92, -0.01), j(0.065, 0.92, 0.01), 0.112 * k * b, v(1, 1, 0.8)),
        // Arms: shoulder caps, upper arms, forearms, gloved fists.
        ball(shoulderLead, 0.066 * k * b),
        ball(shoulderRear, 0.066 * k * b),
        limb(shoulderLead, elbowLead, 0.048 * k * b),
        limb(shoulderRear, elbowRear, 0.048 * k * b),
        limb(elbowLead, fistLead, 0.04 * k * b),
        limb(elbowRear, fistRear, 0.04 * k * b),
        ball(fistLead, 0.054 * k, v(1, 0.95, 1.15)),
        ball(fistRear, 0.054 * k, v(1, 0.95, 1.15)),
        // Legs: hips, thighs, knees, shins, ankles, feet (rear foot turned out).
        ball(hipLead, 0.084 * k * b),
        ball(hipRear, 0.084 * k * b),
        limb(hipLead, kneeLead, 0.076 * k * b),
        limb(hipRear, kneeRear, 0.076 * k * b),
        ball(kneeLead, 0.056 * k * b),
        ball(kneeRear, 0.056 * k * b),
        limb(kneeLead, ankleLead, 0.054 * k * b),
        limb(kneeRear, ankleRear, 0.054 * k * b),
        ball(ankleLead, 0.044 * k),
        ball(ankleRear, 0.044 * k),
        limb(j(0.15, 0.035, 0.22), j(0.165, 0.035, 0.35), 0.036 * k),
        limb(j(-0.19, 0.035, -0.21), j(-0.29, 0.035, -0.15), 0.036 * k),
    ];
    if (params.sex === "female") parts.push(ball(j(0.01, 1.65, -0.035), 0.046 * k));

    return mergeParts(parts);
}
