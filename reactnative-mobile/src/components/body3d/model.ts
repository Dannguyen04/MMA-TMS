/**
 * Mô hình 3D dùng cho sơ đồ cơ thể — ĐỔI MÔ HÌNH CHỈ Ở ĐÂY (file .glb + file vùng đi cùng nó).
 * Hiện dùng v6e (bản đầu cuối cùng).
 */
/* eslint-disable @typescript-eslint/no-require-imports */
export const BODY_MODEL = {
  glb: require("../../../assets/models/muscular-v6e-meshopt.glb") as number,
  meta: require("./regions-v6e.json") as BodyModelMeta,
  /** Tâm + bán kính vùng mặt (toạ độ mô hình) và mặt cắt z: tắt viền fresnel ở mặt. */
  face: [0, -0.0005, 0.008, 0.0175, 0.0045] as const,
} as const;

/** Ghi công mô hình (CC BY 4.0) — lấy từ metadata asset.extras của GLB gốc. */
export const BODY_MODEL_CREDIT = {
  title: "Male base muscular anatomy",
  author: "Harshit Prajapati",
  site: "Sketchfab",
  license: "CC BY 4.0",
  source: "https://sketchfab.com/3d-models/male-base-muscular-anatomy-0954aa04666d45aab9633009318f7b66",
} as const;

export type ModelRegion = { slot: number; ch: number; centre: [number, number, number]; normal: [number, number, number]; seeds: number };
export type BodyModelMeta = {
  H: number;
  minY: number;
  /** Khoảng cách trên da ứng với giá trị 8-bit = 255 (đơn vị mô hình). */
  DMAX: number;
  regions: Record<string, ModelRegion>;
  spine: { y0: number; y1: number };
  /** Kênh mặt nạ bẹn/hạ bộ: không tô ở đó. */
  mask: { slot: number; ch: number };
};
