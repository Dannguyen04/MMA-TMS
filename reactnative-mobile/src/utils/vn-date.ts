/** Ngày giờ theo múi giờ Asia/Ho_Chi_Minh (UTC+7, không có giờ mùa hè), không phụ thuộc Intl. */
const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
const WEEKDAYS = ["Chủ nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];

function vnParts(iso: string | number | Date) {
  const ms = new Date(iso).getTime();
  if (Number.isNaN(ms)) return null;
  const d = new Date(ms + VN_OFFSET_MS);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    weekday: d.getUTCDay(),
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes(),
    dayIndex: Math.floor((ms + VN_OFFSET_MS) / 86_400_000),
  };
}

const pad = (n: number) => String(n).padStart(2, "0");

/** "24/10" */
export function vnShortDate(iso: string | number | Date): string {
  const p = vnParts(iso);
  return p ? `${p.day}/${p.month}` : "";
}

/** "Thứ Bảy, 24/10/2026" */
export function vnLongDate(iso: string | number | Date): string {
  const p = vnParts(iso);
  return p ? `${WEEKDAYS[p.weekday]}, ${pad(p.day)}/${pad(p.month)}/${p.year}` : "";
}

/** "14:00, 24/10" */
export function vnTimeAndDate(iso: string | number | Date): string {
  const p = vnParts(iso);
  return p ? `${pad(p.hour)}:${pad(p.minute)}, ${pad(p.day)}/${pad(p.month)}` : "";
}

/** Số ngày lịch (theo giờ VN) từ `now` đến `iso`; âm nếu đã qua. */
export function vnDaysUntil(iso: string | number | Date, now: number | Date = Date.now()): number {
  const a = vnParts(iso);
  const b = vnParts(now);
  return a && b ? a.dayIndex - b.dayIndex : 0;
}
