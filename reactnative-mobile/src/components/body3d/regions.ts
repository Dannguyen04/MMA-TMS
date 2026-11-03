import type { MedicalJointState } from "@/api/types";
import { medical } from "@/i18n/medical";

/**
 * Bảng cấu hình: mã khớp từ API (BODY_JOINTS, 13 giá trị) → vùng trên mô hình + bán kính (theo H).
 * Backend thêm mã mới: Designer vẽ vùng trên mô hình, Mobile thêm MỘT dòng ở đây.
 * Thông số theo doctor-detail-v2.md "Bản 6" (CHỐT 01:17).
 */
export type RegionCfg = { region: string; R: number; core?: number };
export const JOINT_REGIONS: Record<string, RegionCfg> = {
  LEFT_SHOULDER: { region: "L_SHOULDER", R: 0.1 },
  RIGHT_SHOULDER: { region: "R_SHOULDER", R: 0.1 },
  LEFT_ELBOW: { region: "L_ELBOW", R: 0.07 },
  RIGHT_ELBOW: { region: "R_ELBOW", R: 0.07 },
  LEFT_WRIST: { region: "L_WRIST", R: 0.05 },
  RIGHT_WRIST: { region: "R_WRIST", R: 0.05 },
  LEFT_HIP: { region: "L_HIP", R: 0.08 },
  RIGHT_HIP: { region: "R_HIP", R: 0.08 },
  LEFT_KNEE: { region: "L_KNEE", R: 0.08 },
  RIGHT_KNEE: { region: "R_KNEE", R: 0.08 },
  LEFT_ANKLE: { region: "L_ANKLE", R: 0.06 },
  RIGHT_ANKLE: { region: "R_ANKLE", R: 0.06 },
  SPINE_CORE: { region: "SPINE", R: 0.05, core: 0.1 },
};

/**
 * Vùng phụ: đầu, cổ, ngực, xương sườn (port từ web doctor, body3d/regions.ts EXTRA_REGIONS).
 * Mô hình có hình học các vùng này nhưng regions-v6e.json và _geo0–3 chỉ nướng 13 khớp của API
 * (slot 3 ch 2–3 trống), nên tô theo khoảng cách Euclid tới tâm, toạ độ thế giới của mô hình
 * (cùng hệ "centre" trong regions json; GLB native và Meshopt có cùng phép dời/tỉ lệ ở node lưới).
 * R là bán kính tuyệt đối (đơn vị mô hình). Màu, falloff, nhịp như 13 khớp.
 */
export type ExtraCfg = { region: string; centres: [number, number, number][]; R: number };
export const EXTRA_REGIONS: Record<string, ExtraCfg> = {
  HEAD: { region: "HEAD", centres: [[0, 0.001, 0.0005]], R: 0.0155 },
  NECK: { region: "NECK", centres: [[0, -0.0105, 0]], R: 0.0085 },
  CHEST: { region: "CHEST", centres: [[0.0085, -0.027, 0.011], [-0.0085, -0.027, 0.011]], R: 0.011 },
  RIBS: { region: "RIBS", centres: [[0.0155, -0.046, 0.007], [-0.0155, -0.046, 0.007]], R: 0.0095 },
};
const EXTRA_VI: Record<string, string> = { HEAD: "Đầu", NECK: "Cổ", CHEST: "Ngực", RIBS: "Xương sườn" };
/** Cách viết khác (bodyRegion kiểu web "head", FACE…) → mã vùng phụ. */
const EXTRA_ALIAS: Record<string, string> = { FACE: "HEAD", SKULL: "HEAD", RIB: "RIBS", LEFT_RIBS: "RIBS", RIGHT_RIBS: "RIBS" };
/** Chuẩn hoá mã: "head" → "HEAD", "FACE" → "HEAD"; 13 mã khớp và mã lạ giữ nguyên. */
export function normaliseJoint(code: string): string {
  if (code in JOINT_REGIONS) return code;
  const u = code.trim().toUpperCase().replace(/[\s-]+/g, "_");
  const a = EXTRA_ALIAS[u] ?? u;
  return a in EXTRA_REGIONS ? a : code;
}
export const isMappedJoint = (j: string) => j in JOINT_REGIONS || j in EXTRA_REGIONS;

/** Thông số tô (Bản 6). */
export const PAINT = {
  peak: 0.5,
  core: 0.25,
  emissive: 0.25,
  occluded: 0.2,
  spineEnd: 0.08,
  bodyOpacity: 0.18,
} as const;

export type PaintStatus = "injury" | "recovering" | "healed";
export const STATUS_COLOR: Record<PaintStatus, string> = { injury: "#FF6B7A", recovering: "#5CC8F0", healed: "#6EE07A" };
const RANK: Record<PaintStatus, number> = { healed: 1, recovering: 2, injury: 3 };

export const STATUS_TEXT: Record<PaintStatus, string> = { injury: "Chấn thương", recovering: "Đang phục hồi", healed: "Đã khỏi" };

export type JointRow = {
  joint: string;
  label: string;
  /** null = không tô (vd. chỉ nghi ngờ) — vẫn hiện trong danh sách. */
  status: PaintStatus | null;
  statusText: string;
  /** Có vùng trên mô hình hay không. */
  mapped: boolean;
  detail: string;
};

/** "LEFT_HAND" → "left hand" (chữ thường dễ đọc, không hiện mã thô). */
export function humaniseCode(code: string): string {
  return code.replace(/[_-]+/g, " ").trim().toLowerCase();
}

export function jointLabelVi(code: string): string {
  if (code === "SPINE_CORE") return "Cột sống";
  if (EXTRA_VI[code]) return EXTRA_VI[code]!;
  const j = (medical.joint as Record<string, string>)[code];
  // Never show the raw joint code (31/10).
  return j ?? "Vùng khác";
}

function injuryStatus(s: string): PaintStatus | null {
  if (s === "ACTIVE") return "injury";
  if (s === "RECOVERING") return "recovering";
  if (s === "RESOLVED") return "healed";
  return null;
}

/**
 * Gộp chấn thương + trạng thái khớp thành danh sách theo khớp (nặng nhất thắng).
 * Chấn thương: ACTIVE → đỏ, RECOVERING → xanh dương, RESOLVED → xanh lá.
 * Trạng thái khớp: CONFIRMED_IMPAIRMENT → đỏ; SUSPECTED* → không tô (mô hình chỉ có 3 màu), chỉ liệt kê.
 */
export function buildJointRows(
  injuries: readonly { affectedJoint: string; status: string; injuryType: string; severity: string }[],
  jointStates: readonly Pick<MedicalJointState, "joint" | "currentState">[],
  stateText: (s: string) => string = (s) => s,
  severityText: (s: string) => string = (s) => s,
): JointRow[] {
  const map = new Map<string, JointRow>();
  const put = (raw: string, status: PaintStatus | null, statusText: string, detail: string) => {
    const joint = normaliseJoint(raw);
    const prev = map.get(joint);
    const better = !prev || (status && (!prev.status || RANK[status] > RANK[prev.status]));
    if (!better) return;
    map.set(joint, { joint, label: jointLabelVi(joint), status, statusText, mapped: isMappedJoint(joint), detail });
  };
  for (const i of injuries) {
    const st = injuryStatus(i.status);
    put(i.affectedJoint, st, st ? STATUS_TEXT[st] : stateText(i.status), [i.injuryType, severityText(i.severity)].filter(Boolean).join(" · "));
  }
  for (const s of jointStates) {
    if (s.currentState === "HEALTHY") continue;
    put(s.joint, s.currentState === "CONFIRMED_IMPAIRMENT" ? "injury" : null, stateText(s.currentState), "");
  }
  // Vùng có trên mô hình trước, theo thứ tự cấu hình; mã lạ cuối danh sách.
  const order = [...Object.keys(EXTRA_REGIONS), ...Object.keys(JOINT_REGIONS)];
  return [...map.values()].sort((a, b) => {
    const ia = order.indexOf(a.joint);
    const ib = order.indexOf(b.joint);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });
}

/** Vùng cần tô trên mô hình: tên vùng → {màu, R, core}. */
export function paintRegions(rows: readonly JointRow[]): Record<string, { color: string; R: number; core: number }> {
  const out: Record<string, { color: string; R: number; core: number }> = {};
  for (const r of rows) {
    const cfg: RegionCfg | ExtraCfg | undefined = JOINT_REGIONS[r.joint] ?? EXTRA_REGIONS[r.joint];
    if (!cfg || !r.status) continue;
    out[cfg.region] = { color: STATUS_COLOR[r.status], R: cfg.R, core: ("core" in cfg && cfg.core) || PAINT.core };
  }
  return out;
}

