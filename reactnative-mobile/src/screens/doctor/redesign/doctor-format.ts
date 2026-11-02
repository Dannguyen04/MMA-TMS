import type { MedicalStatus, PublicFighter } from "@/api/types";

/** "Cần chú ý" = Chấn thương + Chưa cho phép (doctor-redesign-v1). */
export const ATTENTION_STATUSES: readonly MedicalStatus[] = ["INJURED", "NOT_CLEARED"];

export type RosterStatusFilter = "" | "attention" | MedicalStatus;

/** Chức danh tiếng Anh thường gặp → tiếng Việt. Không có trong bảng thì giữ nguyên chuỗi gốc. */
const TITLE_VI: Record<string, string> = {
  "head of sports medicine": "Bác sĩ trưởng Y học thể thao",
  "chief of sports medicine": "Bác sĩ trưởng Y học thể thao",
  "chief sports medicine physician": "Bác sĩ trưởng Y học thể thao",
  "lead sports medicine physician": "Bác sĩ trưởng Y học thể thao",
  "sports medicine lead": "Bác sĩ trưởng Y học thể thao",
  "head team physician": "Bác sĩ trưởng đội",
  "team physician": "Bác sĩ đội",
  "sports medicine": "Y học thể thao",
  "sports medicine physician": "Bác sĩ Y học thể thao",
  "sports physician": "Bác sĩ thể thao",
  "sports doctor": "Bác sĩ thể thao",
  physiotherapy: "Vật lý trị liệu",
  physiotherapist: "Chuyên viên vật lý trị liệu",
  "physical therapy": "Vật lý trị liệu",
  "physical therapist": "Chuyên viên vật lý trị liệu",
  orthopedics: "Chấn thương chỉnh hình",
  orthopaedics: "Chấn thương chỉnh hình",
  "orthopedic surgeon": "Bác sĩ phẫu thuật chỉnh hình",
  "general practitioner": "Bác sĩ đa khoa",
  "general medicine": "Đa khoa",
  nutrition: "Dinh dưỡng",
  nutritionist: "Chuyên gia dinh dưỡng",
  "rehabilitation medicine": "Phục hồi chức năng",
  rehabilitation: "Phục hồi chức năng",
  cardiology: "Tim mạch",
  neurology: "Thần kinh",
};

/** Chức danh để hiển thị; `null` khi không có dữ liệu (ẩn dòng). */
export function doctorTitleVi(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const text = raw.trim();
  if (!text) return null;
  const key = text.toLowerCase().replace(/\s+/g, " ");
  return TITLE_VI[key] ?? text;
}

/** Hai ô lối tắt trên màn Tôi. `null` (hiển thị "–") khi danh sách lỗi hoặc trống. */
export function rosterTiles(
  roster: { items: readonly Pick<PublicFighter, "currentMedicalStatus">[]; total: number; error: string; loaded: boolean },
): { total: number | null; attention: number | null } {
  if (!roster.loaded || roster.error || roster.items.length === 0) return { total: null, attention: null };
  return {
    total: Math.max(roster.total, roster.items.length),
    attention: roster.items.filter((f) => ATTENTION_STATUSES.includes(f.currentMedicalStatus)).length,
  };
}

export function tileText(value: number | null): string {
  return value === null ? "–" : String(value);
}

/** Lọc danh sách đã tải: tên (không dấu, không phân biệt hoa thường), hạng cân, trạng thái y tế. */
export function filterRoster<T extends Pick<PublicFighter, "firstName" | "lastName" | "weightClass" | "currentMedicalStatus">>(
  rows: readonly T[],
  f: { search: string; weightClass: string; status: RosterStatusFilter },
): T[] {
  const q = fold(f.search);
  return rows.filter((row) => {
    if (f.weightClass && row.weightClass !== f.weightClass) return false;
    if (f.status === "attention" && !ATTENTION_STATUSES.includes(row.currentMedicalStatus)) return false;
    if (f.status && f.status !== "attention" && row.currentMedicalStatus !== f.status) return false;
    return !q || fold(`${row.firstName} ${row.lastName}`).includes(q) || fold(`${row.lastName} ${row.firstName}`).includes(q);
  });
}

function fold(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/\s+/g, " ");
}

/** Tham số `status` trên đường dẫn tab Võ sĩ. */
export function statusFromParam(value: unknown): RosterStatusFilter | null {
  if (value === "attention") return "attention";
  if (value === "all") return "";
  if (value === "HEALTHY" || value === "MONITORING" || value === "RECOVERY" || value === "INJURED" || value === "NOT_CLEARED") return value;
  return null;
}

/** Thông báo gắn võ sĩ → id võ sĩ (payload.target {type:"FIGHTER", id}). */
export function notificationFighterId(payload: Record<string, unknown> | null | undefined): string | null {
  const target = payload?.target;
  if (!target || typeof target !== "object") return null;
  const { type, id } = target as { type?: unknown; id?: unknown };
  return type === "FIGHTER" && typeof id === "string" && id ? id : null;
}

/** "Cần chú ý": số võ sĩ khác nhau (trong danh sách phụ trách) bị chấn thương/chưa cho phép HOẶC có cảnh báo suy giảm AI. */
export function attentionUnion(items: readonly { id: string; currentMedicalStatus: MedicalStatus }[], impairedFighterIds: readonly string[]): number {
  const mine = new Set(items.map((f) => f.id));
  const ids = new Set(items.filter((f) => ATTENTION_STATUSES.includes(f.currentMedicalStatus)).map((f) => f.id));
  for (const id of impairedFighterIds) if (mine.has(id)) ids.add(id);
  return ids.size;
}
