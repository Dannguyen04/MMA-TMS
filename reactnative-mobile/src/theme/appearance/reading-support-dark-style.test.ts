import { contrastRatio } from "./color-math";
import {
  DEFAULT_APPEARANCE,
  hasDarkStyle,
  MODE_OPTIONS,
  parseStoredAppearance,
  PRESET_IDS,
  READING_SUPPORT_IDS,
  resolvePreset,
  THEME_LIST_IDS,
  withBrightnessMode,
} from "./settings";
import { buildColors, resolveVariant } from "./tokens";
import { palettes, trueBlackPalette } from "../colors";
import { appearance } from "@/i18n/appearance";

const doc = (version: number, presetId: string, overrides: Record<string, unknown> = {}) =>
  JSON.stringify({ version, presetId, overrides, updatedAt: "2026-10-01T00:00:00.000Z" });

describe("batch32: nhóm Hỗ trợ đọc", () => {
  it("nhóm riêng dưới danh sách chủ đề, đủ 6 mục, không trùng", () => {
    expect(appearance.sections.readingSupport).toBe("Hỗ trợ đọc");
    expect(READING_SUPPORT_IDS.map((id) => appearance.presets[id])).toEqual([
      "Tương phản cao (sáng)",
      "Tương phản cao (tối)",
      "Chữ lớn",
      "Thị lực kém",
      "Gọn",
      "Dễ đọc",
    ]);
    const all = [...THEME_LIST_IDS, ...READING_SUPPORT_IDS];
    expect(new Set(all).size).toBe(all.length);
    expect([...all].sort()).toEqual([...PRESET_IDS].sort());
  });
});

describe("batch32: Độ sáng + Kiểu tối", () => {
  it("Kiểu tối hiện khi Tối hoặc Hệ thống, ẩn khi Sáng", () => {
    expect(MODE_OPTIONS).toEqual(["system", "light", "dark"]);
    expect(hasDarkStyle("dark")).toBe(true);
    expect(hasDarkStyle("system")).toBe(true);
    expect(hasDarkStyle("light")).toBe(false);
    expect(appearance.sections.darkVariant).toBe("Kiểu tối");
    expect(appearance.darkVariants).toEqual({ dark: "Tối", trueBlack: "Đen tuyền" });
  });

  it("Kiểu tối áp dụng cho Tối và cho Hệ thống ban đêm", () => {
    const base = resolvePreset("system");
    expect(resolveVariant({ mode: "dark", systemDarkVariant: "trueBlack" }, "light")).toBe("trueBlack");
    expect(resolveVariant({ mode: "dark", systemDarkVariant: "dark" }, "light")).toBe("dark");
    expect(resolveVariant({ mode: "system", systemDarkVariant: "trueBlack" }, "dark")).toBe("trueBlack");
    expect(resolveVariant({ mode: "system", systemDarkVariant: "trueBlack" }, "light")).toBe("light");
    expect(buildColors({ ...base, mode: "light", systemDarkVariant: "trueBlack" }, "dark").colors).toBe(palettes.light);
    expect(buildColors({ ...base, mode: "dark" }, "light").colors).toBe(palettes.dark);
  });

  it("đặt lại = Đỏ võ đài + Hệ thống + kiểu tối Tối", () => {
    expect(DEFAULT_APPEARANCE.presetId).toBe("system");
    expect(DEFAULT_APPEARANCE.settings.mode).toBe("system");
    expect(DEFAULT_APPEARANCE.settings.systemDarkVariant).toBe("dark");
  });

  it("chọn nhanh Đen tuyền (từ chỗ khác) = Tối + kiểu tối Đen tuyền", () => {
    const next = withBrightnessMode(DEFAULT_APPEARANCE, "trueBlack");
    expect(next.settings.mode).toBe("dark");
    expect(next.settings.systemDarkVariant).toBe("trueBlack");
  });

  it("chữ trên nền Đen tuyền vẫn ≥ 4.5:1", () => {
    const c = trueBlackPalette;
    for (const [fg, bg] of [[c.ink, c.bg], [c.inkSubtle, c.bg], [c.lotus, c.bg], [c.onCta, c.cta], [c.ink, c.surfaceMuted]]) {
      expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe("batch32: chuyển dữ liệu (v3 → v4)", () => {
  it("chế độ Đen tuyền đã lưu → Tối + kiểu tối Đen tuyền, giữ chỉnh khác", () => {
    const r = parseStoredAppearance(doc(3, "system", { mode: "trueBlack", fontFamily: "lexend" }), null).applied;
    expect([r.presetId, r.settings.mode, r.settings.systemDarkVariant]).toEqual(["system", "dark", "trueBlack"]);
    expect(r.settings.fontFamily).toBe("lexend");
  });

  it("chuỗi đầy đủ từ v1/v2: bộ Đen tuyền cũ → Đỏ võ đài, Tối, Đen tuyền", () => {
    for (const v of [1, 2]) {
      const r = parseStoredAppearance(doc(v, "trueBlack"), null).applied;
      expect([r.presetId, r.settings.mode, r.settings.systemDarkVariant]).toEqual(["system", "dark", "trueBlack"]);
    }
  });

  it("Tối đã lưu giữ nguyên vẻ tối thường; Hệ thống giữ kiểu tối ban đêm", () => {
    const dark = parseStoredAppearance(doc(3, "system", { mode: "dark", systemDarkVariant: "trueBlack" }), null).applied;
    expect([dark.settings.mode, dark.settings.systemDarkVariant]).toEqual(["dark", "dark"]);
    const sys = parseStoredAppearance(doc(3, "system", { systemDarkVariant: "trueBlack" }), null).applied;
    expect([sys.settings.mode, sys.settings.systemDarkVariant]).toEqual(["system", "trueBlack"]);
    const hc = parseStoredAppearance(doc(3, "highContrastDark"), null).applied;
    expect(hc.settings).toEqual(resolvePreset("highContrastDark"));
    const light = parseStoredAppearance(doc(3, "system", { mode: "light" }), null).applied;
    expect(light.settings.mode).toBe("light");
  });
});
