import meta from "./regions-v6e.json";
import type { BodyModelMeta } from "./types";

/** Cùng asset + metadata với mobile (assets/models/muscular-v6e-meshopt.glb, regions-v6e.json). */
export const BODY_MODEL = {
  url: "/models/muscular-v6e-meshopt.glb",
  meta: meta as unknown as BodyModelMeta,
  face: [0, -0.0005, 0.008, 0.0175, 0.0045] as const,
} as const;

export const BODY_MODEL_CREDIT = {
  title: "Male base muscular anatomy",
  author: "Harshit Prajapati",
  site: "Sketchfab",
  license: "CC BY 4.0",
  source: "https://sketchfab.com/3d-models/male-base-muscular-anatomy-0954aa04666d45aab9633009318f7b66",
} as const;
