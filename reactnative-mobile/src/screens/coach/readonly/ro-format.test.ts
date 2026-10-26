import type { FighterMeasurement, TrainingPlan } from "@/api/types";
import { MEDICAL_STATUSES } from "@/api/types";
import { palettes } from "@/theme/colors";
import { SYNTHETIC_LIGHT, THEME_PALETTES } from "@/theme/appearance/theme-palettes";
import { contrastRatio } from "@/theme/appearance/color-math";
import { FILTER_MUTED, paletteFromTokens, STATUS_INFO } from "@/screens/fighter/redesign/palette";
import {
  ageFromDob,
  chipContrast,
  clampPct,
  dayLabel,
  durationText,
  groupByDay,
  initials,
  kgText,
  MEDICAL_CHIP,
  mergePage,
  nameMap,
  planPct,
  PLAN_CHIP,
  SESSION_CHIP,
  timeHm,
  vnDate,
  weightChange,
  weightSeries,
  type Tone,
} from "./ro-format";

const m = (id: string, at: string, kg: number, superseded = false): FighterMeasurement => ({
  id, fighterId: "f", recordedById: "u", measuredAt: at, measurementContext: "TRAINING", weightKg: kg,
  heightCm: null, reachCm: null, notes: null, supersedesId: null, isSuperseded: superseded, createdAt: at,
});

describe("màu trạng thái dùng chung", () => {
  it("xanh Phục hồi: #6EB5FF tối, #1B5FB8 sáng; chữ nhãn bộ lọc #9AA8A0 tối, #4A5550 sáng", () => {
    expect(STATUS_INFO).toEqual({ dark: "#6EB5FF", light: "#1B5FB8" });
    expect(FILTER_MUTED).toEqual({ dark: "#9AA8A0", light: "#4A5550" });
    expect(paletteFromTokens(THEME_PALETTES.synthetic).info).toBe("#6EB5FF");
    expect(paletteFromTokens(SYNTHETIC_LIGHT).info).toBe("#1B5FB8");
  });

  it("chữ nhãn bộ lọc xám đạt ≥ 4,5:1 trên nền và thẻ (Synthetic tối/sáng, Figma tối/sáng)", () => {
    for (const tokens of [THEME_PALETTES.synthetic, SYNTHETIC_LIGHT, palettes.light, palettes.dark]) {
      const p = paletteFromTokens(tokens);
      expect(contrastRatio(p.filterMuted, p.bg)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(p.filterMuted, p.surface)).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe("chip trạng thái y tế", () => {
  it("5 trạng thái có nhãn theo thiết kế và biểu tượng riêng", () => {
    expect(MEDICAL_CHIP.HEALTHY.label).toBe("Khỏe");
    expect(MEDICAL_CHIP.MONITORING.label).toBe("Theo dõi");
    expect(MEDICAL_CHIP.RECOVERY.label).toBe("Phục hồi");
    expect(MEDICAL_CHIP.INJURED.label).toBe("Chấn thương");
    expect(MEDICAL_CHIP.NOT_CLEARED.label).toBe("Chưa cho phép");
    const icons = MEDICAL_STATUSES.map((s) => MEDICAL_CHIP[s].icon);
    expect(new Set(icons).size).toBe(5);
    expect(MEDICAL_CHIP.HEALTHY.tone).toBe("success");
    expect(MEDICAL_CHIP.MONITORING.tone).toBe("attention");
    expect(MEDICAL_CHIP.RECOVERY.tone).toBe("info");
    expect(MEDICAL_CHIP.INJURED.tone).toBe("danger");
    expect(MEDICAL_CHIP.NOT_CLEARED.tone).toBe("danger");
  });

  it("mọi chip đạt ≥ 4,5:1 ở tối (Synthetic) và sáng (Synthetic sáng, Figma sáng)", () => {
    const tones: Tone[] = ["success", "attention", "info", "danger", "neutral"];
    for (const tokens of [THEME_PALETTES.synthetic, SYNTHETIC_LIGHT, palettes.light, palettes.dark]) {
      const p = paletteFromTokens(tokens);
      for (const tone of tones) {
        expect(chipContrast({ ...p, attention: p.attention }, tone)).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it("chip buổi tập và giáo án đều có chữ tiếng Việt và biểu tượng", () => {
    for (const chip of [...Object.values(SESSION_CHIP), ...Object.values(PLAN_CHIP)]) {
      expect(chip.label.length).toBeGreaterThan(2);
      expect(chip.icon).toBeTruthy();
      expect(chip.label).not.toMatch(/^[A-Z_]+$/);
    }
  });
});

describe("định dạng", () => {
  it("tên viết tắt, số kg, thời lượng", () => {
    expect(initials("Nguyễn Minh Khang")).toBe("NK");
    expect(initials("Khang")).toBe("K");
    expect(initials("  ")).toBe("?");
    expect(kgText(68.5)).toBe("68,5");
    expect(kgText(65)).toBe("65,0");
    expect(durationText(3600)).toBe("60 phút");
    expect(durationText(null)).toBeNull();
    expect(durationText(0)).toBeNull();
  });

  it("tuổi và ngày theo giờ Việt Nam", () => {
    expect(ageFromDob("2000-10-19", new Date("2026-10-18T00:00:00"))).toBe(25);
    expect(ageFromDob("2000-10-18", new Date("2026-10-18T00:00:00"))).toBe(26);
    expect(ageFromDob("không phải ngày")).toBeNull();
    expect(vnDate("2026-10-18T20:00:00Z")).toBe("19/10/2026");
    expect(vnDate(null)).toBe("—");
    expect(timeHm("2026-10-18T10:30:00Z")).toBe("17:30");
  });
});

describe("nhóm buổi tập theo ngày", () => {
  const now = new Date("2026-10-18T05:00:00Z"); // 12:00 giờ VN, CN 18/10
  it("nhãn ngày", () => {
    expect(dayLabel("2026-10-18T10:00:00Z", now)).toBe("Hôm nay");
    expect(dayLabel("2026-10-19T02:00:00Z", now)).toBe("Ngày mai");
    expect(dayLabel("2026-10-17T02:00:00Z", now)).toBe("Hôm qua");
    expect(dayLabel("2026-10-21T02:00:00Z", now)).toBe("T4, 21/10");
  });

  it("nhóm theo ngày VN, ngày và giờ tăng dần; 18h VN thuộc ngày hôm đó", () => {
    const rows = [
      { id: "c", scheduledAt: "2026-10-19T10:00:00Z" },
      { id: "a", scheduledAt: "2026-10-18T11:30:00Z" }, // 18:30 VN
      { id: "b", scheduledAt: "2026-10-18T23:30:00Z" }, // 06:30 VN ngày 19
    ];
    const groups = groupByDay(rows, now);
    expect(groups.map((g) => g.label)).toEqual(["Hôm nay · CN, 18/10", "Ngày mai"]);
    expect(groups[0]!.items.map((r) => r.id)).toEqual(["a"]);
    expect(groups[1]!.items.map((r) => r.id)).toEqual(["b", "c"]);
    expect(groupByDay([], now)).toEqual([]);
  });

  it('nhóm "Hôm nay" luôn đứng đầu dù có buổi của hôm qua; không có hôm nay thì không thêm nhóm rỗng', () => {
    const rows = [
      { id: "past", scheduledAt: "2026-10-16T03:00:00Z" },
      { id: "today", scheduledAt: "2026-10-18T11:00:00Z" },
      { id: "later", scheduledAt: "2026-10-22T03:00:00Z" },
    ];
    const groups = groupByDay(rows, now);
    expect(groups.map((g) => g.items[0]!.id)).toEqual(["today", "past", "later"]);
    expect(groups[0]!.label).toContain("Hôm nay");
    expect(groupByDay(rows.filter((r) => r.id !== "today"), now).map((g) => g.items[0]!.id)).toEqual(["past", "later"]);
  });
});

describe("cân nặng", () => {
  it("bỏ số đo bị thay thế, sắp cũ → mới, tính thay đổi", () => {
    const s = weightSeries([m("3", "2026-10-03T00:00:00Z", 68), m("1", "2026-10-01T00:00:00Z", 70), m("x", "2026-10-02T00:00:00Z", 99, true), m("2", "2026-10-02T12:00:00Z", 69)]);
    expect(s.map((r) => r.id)).toEqual(["1", "2", "3"]);
    expect(weightChange(s)).toBe(-1);
    expect(weightChange(s.slice(0, 1))).toBeNull();
    expect(weightChange([])).toBeNull();
  });
});

describe("tiến độ giáo án và phân trang", () => {
  it("tỉ lệ luôn trong 0..100", () => {
    expect(clampPct(62.4)).toBe(62);
    expect(clampPct(140)).toBe(100);
    expect(clampPct(-5)).toBe(0);
    expect(clampPct(undefined)).toBe(0);
    expect(planPct({ progress: { totalSessions: 10, completedSessions: 5, completionPercentage: 50 } } as TrainingPlan)).toBe(50);
    expect(planPct({} as TrainingPlan)).toBe(0);
  });

  it("gộp trang: trang 1 thay thế, trang sau nối và bỏ trùng", () => {
    const p1 = { data: [{ id: "a" }, { id: "b" }], total: 3, hasNextPage: true };
    const p2 = { data: [{ id: "b" }, { id: "c" }], total: 3, hasNextPage: false };
    const first = mergePage([{ id: "old" }], p1, 1);
    expect(first.map((r) => r.id)).toEqual(["a", "b"]);
    expect(mergePage(first, p2, 2).map((r) => r.id)).toEqual(["a", "b", "c"]);
  });

  it("map tên võ sĩ", () => {
    expect(nameMap([{ id: "1", firstName: "Nguyễn", lastName: "Khang" }])).toEqual({ "1": "Nguyễn Khang" });
  });
});
