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
  const j = (medical.joint as Record<string, string>)[code];
  return j ?? `Vùng khác (${humaniseCode(code)})`;
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
  const put = (joint: string, status: PaintStatus | null, statusText: string, detail: string) => {
    const prev = map.get(joint);
    const better = !prev || (status && (!prev.status || RANK[status] > RANK[prev.status]));
    if (!better) return;
    map.set(joint, { joint, label: jointLabelVi(joint), status, statusText, mapped: joint in JOINT_REGIONS, detail });
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
  const order = Object.keys(JOINT_REGIONS);
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
    const cfg = JOINT_REGIONS[r.joint];
    if (!cfg || !r.status) continue;
    out[cfg.region] = { color: STATUS_COLOR[r.status], R: cfg.R, core: cfg.core ?? PAINT.core };
  }
  return out;
}

