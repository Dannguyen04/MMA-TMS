import * as THREE from "three";

import type { BodyRegion } from "@/lib/domain/types";

/**
 * Body regions on a 3D figure, in metres: soles on y = 0, facing the camera (+Z), 1.75 m tall. Like
 * the 2D body map, the athlete's right side is on the viewer's left, so "right_*" sits at -X.
 *
 * Regions are not separate meshes. Each one is one or two soft "spots" (a centre and a radius) the
 * shader lights on the surface, so a highlight blends into the body instead of floating on it, and a
 * posterior region (lower back, hamstrings) sits behind the body's midline and shows from the back.
 */

export interface RegionSpot {
    region: BodyRegion;
    center: THREE.Vector3;
    radius: number;
    /** Outward direction of the surface under the spot, for label placement and facing tests. */
    normal: THREE.Vector3;
}

/** A figure the body map can draw: its surface and where each region sits on it. */
export interface BodyModel {
    kind: BodyModelKind;
    geometry: THREE.BufferGeometry;
    /** In `SPOT_REGIONS` order: the shader's uniform arrays are indexed by it. */
    spots: RegionSpot[];
}

/**
 * "muscular": the scanned anatomy model (`public/models/fighter-body.glb`), male.
 * "mannequin": the procedural capsule figure, sex-neutral; used for female fighters and as the
 * fallback while (or if) the model cannot load.
 */
export type BodyModelKind = "muscular" | "mannequin";

/** Every model lists its spots in this order; ribs take two spots, one on each flank. */
export const SPOT_REGIONS: readonly BodyRegion[] = [
    "head",
    "neck",
    "left_shoulder",
    "right_shoulder",
    "left_elbow",
    "right_elbow",
    "left_hand",
    "right_hand",
    "chest",
    "ribs",
    "ribs",
    "lower_back",
    "left_hip",
    "right_hip",
    "left_hamstring",
    "right_hamstring",
    "left_knee",
    "right_knee",
    "left_shin",
    "right_shin",
    "left_ankle",
    "right_ankle",
];

export const SPOT_COUNT = SPOT_REGIONS.length;

export const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

export function spot(region: BodyRegion, center: THREE.Vector3, radius: number, normal: THREE.Vector3): RegionSpot {
    return { region, center, radius, normal: normal.normalize() };
}

/** A left-side spot (+X) and its mirror on the right (-X). */
export function pair(left: BodyRegion, right: BodyRegion, center: THREE.Vector3, radius: number, normal: THREE.Vector3): RegionSpot[] {
    return [spot(left, center.clone(), radius, normal.clone()), spot(right, v(-center.x, center.y, center.z), radius, v(-normal.x, normal.y, normal.z))];
}

/** The first spot of each region: the label anchor and the camera target when a region is selected. */
export function regionAnchors(spots: readonly RegionSpot[]): Map<BodyRegion, RegionSpot> {
    const anchors = new Map<BodyRegion, RegionSpot>();
    for (const s of spots) if (!anchors.has(s.region)) anchors.set(s.region, s);
    return anchors;
}

/** The region under a point on the body (model space), or null between regions. */
export function regionAt(spots: readonly RegionSpot[], point: THREE.Vector3): BodyRegion | null {
    let best: { region: BodyRegion; score: number } | null = null;
    for (const s of spots) {
        const score = point.distanceTo(s.center) / s.radius;
        if (score < 1.1 && (!best || score < best.score)) best = { region: s.region, score };
    }
    return best?.region ?? null;
}

/** Height every model is built at; a fighter's own height scales the whole figure. */
export const MODEL_HEIGHT = 1.75;
