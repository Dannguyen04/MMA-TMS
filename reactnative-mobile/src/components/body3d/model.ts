/**
 * Mô hình 3D v6e và metadata vùng. model-asset(.web).ts chọn file theo nền tảng:
 * native dùng buffer đã giải nén, web giữ Meshopt; hình học và kênh tô màu giống nhau.
 */
/* eslint-disable @typescript-eslint/no-require-imports */
import { BODY_MODEL_ASSET } from "./model-asset";

export const BODY_MODEL = {
  glb: BODY_MODEL_ASSET,
  meta: require("./regions-v6e.json") as BodyModelMeta,
  /** Tâm + bán kính vùng mặt (toạ độ mô hình) và mặt cắt z: tắt viền fresnel ở mặt. */
  face: [0, -0.0005, 0.008, 0.0175, 0.0045] as const,
} as const;

/** Ghi công mô hình (CC BY 4.0) — lấy từ metadata asset.extras của GLB gốc. */
export const BODY_MODEL_CREDIT = {
  /** Chốt 31/10: tên hiển thị tiếng Việt. Tên gốc của tác phẩm giữ ở originalTitle (CC BY). */
  title: "Mô hình cơ thể",
  originalTitle: "Male base muscular anatomy",
  author: "Harshit Prajapati",
  site: "Sketchfab",
  license: "CC BY 4.0",
  /** Trang giấy phép chính thức (chốt 31/10). */
  licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
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
