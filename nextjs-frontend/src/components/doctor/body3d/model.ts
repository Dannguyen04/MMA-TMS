import type { Sex } from "@/lib/domain/types";

import { EXTRA_REGIONS } from "./regions";
import femaleMeta from "./regions-female.json";
import meta from "./regions-v6e.json";
import type { BodyModelMeta } from "./types";

type Point = [number, number, number];

/** One body the doctor map can paint: the file, its region fields and the web-only regions placed on it. */
export type DoctorBody = {
  url: string;
  /** The region fields (_geo0–_geo3) as a separate file, four Uint8 VEC4 blocks; absent when the GLB carries them. */
  fields?: string;
  meta: BodyModelMeta;
  /** The face, where the rim glow is turned off: centre x, y, z, radius, and the depth in front of which it applies. */
  face: readonly [number, number, number, number, number];
  /** Head, neck, chest and ribs on this body (see EXTRA_REGIONS): centres in its own space. */
  extras: Record<string, Point[]>;
  /** EXTRA_REGIONS radii are in male-model units; this scales them to this body. */
  extraScale: number;
};

/** Cùng asset + metadata với mobile (assets/models/muscular-v6e-meshopt.glb, regions-v6e.json). */
export const BODY_MODEL: DoctorBody = {
  url: "/models/muscular-v6e-meshopt.glb",
  meta: meta as unknown as BodyModelMeta,
  face: [0, -0.0005, 0.008, 0.0175, 0.0045],
  extras: Object.fromEntries(Object.entries(EXTRA_REGIONS).map(([key, x]) => [key, x.centres])),
  extraScale: 1,
};

/**
 * The female model (public/models/fighter-body-female.glb, app space: soles on y = 0, 1.75 m). Its region
 * fields are baked by `scripts/bake-female-regions.mjs` into the same slots as the male file.
 */
export const FEMALE_BODY_MODEL: DoctorBody = {
  url: "/models/fighter-body-female.glb",
  fields: "/models/fighter-body-female.regions.bin",
  meta: femaleMeta as unknown as BodyModelMeta,
  face: [0, 1.6, 0.084, 0.13, 0.05],
  extras: {
    HEAD: [[0, 1.625, 0.005]],
    NECK: [[0, 1.505, -0.025]],
    CHEST: [[0.07, 1.33, 0.1], [-0.07, 1.33, 0.1]],
    RIBS: [[0.115, 1.17, 0.035], [-0.115, 1.17, 0.035]],
  },
  extraScale: 8.6,
};

export function doctorBodyFor(sex: Sex | null | undefined): DoctorBody {
  return sex === "female" ? FEMALE_BODY_MODEL : BODY_MODEL;
}
