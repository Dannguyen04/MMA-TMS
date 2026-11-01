/** Ngưỡng cân nặng hợp lệ khi võ sĩ tự ghi cân (kg). */
export const WEIGHT_MIN_KG = 30;
export const WEIGHT_MAX_KG = 200;

export type WeightParseResult =
  | { ok: true; kg: number }
  | { ok: false; reason: "empty" | "format" | "range" };

/**
 * Đọc số cân từ ô nhập. Chấp nhận "66,5" và "66.5" (một dấu thập phân),
 * khoảng trắng hai đầu và đơn vị "kg" ở cuối. Làm tròn 1 chữ số thập phân.
 */
export function parseWeightInput(raw: string): WeightParseResult {
  const text = raw.trim().replace(/\s*kg$/i, "").trim();
  if (!text) return { ok: false, reason: "empty" };
  if (!/^\d+(?:[.,]\d+)?$/.test(text)) return { ok: false, reason: "format" };
  const value = Number(text.replace(",", "."));
  if (!Number.isFinite(value)) return { ok: false, reason: "format" };
  const kg = Math.round(value * 10) / 10;
  if (kg < WEIGHT_MIN_KG || kg > WEIGHT_MAX_KG) return { ok: false, reason: "range" };
  return { ok: true, kg };
}

/** Hiển thị kiểu Việt Nam: 66,5 (bỏ ",0" thừa khi tròn số, trừ khi `fixed`). */
export function formatKg(kg: number, fixed = false): string {
  const rounded = Math.round(kg * 10) / 10;
  const text = fixed || !Number.isInteger(rounded) ? rounded.toFixed(1) : String(rounded);
  return text.replace(".", ",");
}
