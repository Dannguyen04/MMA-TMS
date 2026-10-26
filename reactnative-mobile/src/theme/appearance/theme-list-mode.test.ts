import { contrastRatio } from "./color-math";
import {
  DEFAULT_APPEARANCE,
  hasModeSelector,
  matchesPreset,
  MODE_OPTIONS,
  parseStoredAppearance,
  PRESET_IDS,
  resolvePreset,
  THEME_LIST_IDS,
  withBrightnessMode,
} from "./settings";
import { buildColors } from "./tokens";
import { palettes, trueBlackPalette } from "../colors";
import { appearance } from "@/i18n/appearance";

const doc = (version: number, presetId: string, overrides: Record<string, unknown> = {}) =>
  JSON.stringify({ version, presetId, overrides, updatedAt: "2026-10-01T00:00:00.000Z" });

describe("batch31: danh sách chủ đề + chế độ riêng", () => {
  it("danh sách = Đỏ võ đài, 6 bộ màu, Bạc hà, Giấy — không còn Sáng/Tối/Đen tuyền trùng lặp", () => {
    expect(THEME_LIST_IDS).toEqual([
      "system",
      "synthetic",
      "toxicViolet",
      "warmLime",
      "chromeViolet",
      "carbonTeal",
      "hyperCobalt",
      "mint",
      "paper",
    ]);
    expect(THEME_LIST_IDS.map((id) => appearance.presets[id])).toEqual([
      "Đỏ võ đài (mặc định)",
      "Synthetic Lime",
      "Toxic Violet",
      "Warm Lime / Olive Ink",
      "Chrome Violet / Glass Blue",
      "Carbon Teal / Mint Foam",
      "Hyper Cobalt / Skin Sand",
      "Bạc hà",
      "Giấy",
    ]);
    expect(PRESET_IDS as string[]).not.toEqual(expect.arrayContaining(["light"]));
    expect(PRESET_IDS as string[]).not.toContain("dark");
    expect(PRESET_IDS as string[]).not.toContain("trueBlack");
  });

  it("Độ sáng: Hệ thống / Sáng / Tối, chỉ cho Đỏ võ đài", () => {
    expect(MODE_OPTIONS.map((m) => appearance.modes[m])).toEqual(["Hệ thống", "Sáng", "Tối"]);
    expect(hasModeSelector("system")).toBe(true);
    for (const id of THEME_LIST_IDS.filter((x) => x !== "system")) expect(hasModeSelector(id)).toBe(false);
  });

  it("mặc định và đặt lại = Đỏ võ đài + Hệ thống", () => {
    expect(DEFAULT_APPEARANCE.presetId).toBe("system");
    expect(DEFAULT_APPEARANCE.settings.mode).toBe("system");
    expect(DEFAULT_APPEARANCE.settings.paletteId).toBe("figma");
  });

  it("đổi chế độ không biến Đỏ võ đài thành tùy chỉnh", () => {
    for (const mode of MODE_OPTIONS) {
      const next = withBrightnessMode(DEFAULT_APPEARANCE, mode);
      expect(next.presetId).toBe("system");
      expect(matchesPreset(next)).toBe(true);
    }
    expect(matchesPreset({ presetId: "synthetic", settings: { ...resolvePreset("synthetic"), mode: "light" } })).toBe(false);
  });

  it("mỗi chế độ cho đúng bảng màu, chữ trên nút chọn ≥ 4.5:1", () => {
    const at = (mode: (typeof MODE_OPTIONS)[number], scheme: "light" | "dark") =>
      buildColors({ ...resolvePreset("system"), mode }, scheme).colors;
    expect(at("light", "dark")).toBe(palettes.light);
    expect(at("dark", "light")).toBe(palettes.dark);
    expect(buildColors({ ...resolvePreset("system"), mode: "dark", systemDarkVariant: "trueBlack" }, "light").colors).toBe(
      trueBlackPalette,
    );
    expect(at("system", "light")).toBe(palettes.light);
    for (const c of [palettes.light, palettes.dark, trueBlackPalette]) {
      expect(contrastRatio(c.onCta, c.cta)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(c.ink, c.surfaceMuted)).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe("batch31: chuyển dữ liệu đã lưu", () => {
  it.each(["light", "dark", "trueBlack"] as const)("bộ %s cũ (v2) → Đỏ võ đài với chế độ đó, giữ chỉnh khác", (mode) => {
    const r = parseStoredAppearance(doc(2, mode, { fontFamily: "lexend", accentColor: "#1F5FBF" }), null);
    expect(r.source).toBe("stored");
    expect(r.applied.presetId).toBe("system");
    expect(r.applied.settings.mode).toBe(mode === "trueBlack" ? "dark" : mode);
    expect(r.applied.settings.systemDarkVariant).toBe(mode === "trueBlack" ? "trueBlack" : "dark");
    expect(r.applied.settings.paletteId).toBe("figma");
    expect(r.applied.settings.fontFamily).toBe("lexend");
    expect(r.applied.settings.accentColor).toBe("#1F5FBF");
  });

  it("bộ Sáng cũ từ v1 cũng chuyển qua cả hai bước", () => {
    const r = parseStoredAppearance(doc(1, "light", { accentColor: "#D9492F" }), null);
    expect(r.applied.presetId).toBe("system");
    expect(r.applied.settings.mode).toBe("light");
    expect(r.applied.settings.accentColor).toBe("#C23A22");
  });

  it("giữ nguyên các lựa chọn khác", () => {
    expect(parseStoredAppearance(doc(2, "synthetic"), null).applied.presetId).toBe("synthetic");
    expect(parseStoredAppearance(doc(2, "paper"), null).applied).toEqual({ presetId: "paper", settings: resolvePreset("paper") });
    const sys = parseStoredAppearance(doc(2, "system", { mode: "dark" }), null).applied;
    expect([sys.presetId, sys.settings.mode]).toEqual(["system", "dark"]);
  });

  it("tùy chọn cũ mma.ui.themePreference → Đỏ võ đài với chế độ đó", () => {
    const r = parseStoredAppearance(null, "dark");
    expect(r.source).toBe("legacy");
    expect(r.applied.presetId).toBe("system");
    expect(r.applied.settings.mode).toBe("dark");
  });
});
