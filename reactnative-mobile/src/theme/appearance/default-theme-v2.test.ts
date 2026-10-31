import { palettes, trueBlackPalette } from "../colors";
import { contrastRatio } from "./color-math";
import {
  APPEARANCE_SCHEMA_VERSION,
  DEFAULT_APPEARANCE,
  PRESET_IDS,
  parseStoredAppearance,
  resolvePreset,
  serializeAppearance,
} from "./settings";
import { DEFAULT_PALETTE_ID, THEME_SPECS } from "./theme-palettes";
import { buildColors } from "./tokens";
import { appearance as appearanceVi } from "@/i18n/appearance";
import { paletteFromTokens } from "@/screens/fighter/redesign/palette";
import { toneColors } from "@/screens/coach/readonly/ro-format";

const v1 = (presetId: string, overrides: Record<string, unknown> = {}) =>
  JSON.stringify({ version: 1, presetId, overrides, updatedAt: "2026-10-01T00:00:00.000Z" });

describe("default-theme-v2: Đỏ võ đài là mặc định", () => {
  it("bảng token sáng đúng spec", () => {
    expect(palettes.light).toEqual(
      expect.objectContaining({
        bg: "#F6F6F8",
        surface: "#FFFFFF",
        surfaceMuted: "#ECECEF",
        ink: "#18181B",
        inkMuted: "#616169",
        inkSubtle: "#5F6B75",
        line: "#E4E6E9",
        controlBorder: "#8A8A93",
        cta: "#C23A22",
        onCta: "#FFFFFF",
        lotus: "#C23A22",
        danger: "#B4123F",
        dangerSoft: "#FFEDF1",
        warning: "#7A4F00",
        warningSoft: "#FFF3D9",
        success: "#21664B",
        successSoft: "#E0EEE7",
        info: "#1B5FB8",
        infoSoft: "#E4ECF6",
        tabActive: "#C23A22",
        tabPill: "#F9EBE9",
        skeletonBase: "#ECECEF",
        skeletonHighlight: "#F6F6F8",
      }),
    );
  });

  it("bảng token tối đúng spec; chữ/link nhấn dùng #FF8066", () => {
    expect(palettes.dark).toEqual(
      expect.objectContaining({
        bg: "#0A0A0C",
        surface: "#16161A",
        surfaceMuted: "#1E1E24",
        ink: "#F4F4F5",
        inkMuted: "#A1A1AA",
        inkSubtle: "#8A8A94",
        line: "#303038",
        controlBorder: "#6A6A74",
        cta: "#C23A22",
        onCta: "#FFFFFF",
        lotus: "#FF8066",
        ring: "#FF8066",
        danger: "#FF6B81",
        dangerSoft: "#331A21",
        warning: "#FFB020",
        warningSoft: "#33280F",
        success: "#6BC48F",
        successSoft: "#163022",
        info: "#6EB5FF",
        infoSoft: "#1A2533",
        tabActive: "#FF8066",
        tabPill: "#3B2726",
        skeletonBase: "#1E1E24",
        skeletonHighlight: "#26262D",
      }),
    );
    expect(trueBlackPalette.cta).toBe("#C23A22");
    expect(trueBlackPalette.danger).toBe("#FF6B81");
  });

  it("mọi cặp chữ/nền chính ≥ 4.5:1 ở cả sáng và tối", () => {
    for (const c of [palettes.light, palettes.dark]) {
      const p = paletteFromTokens(c);
      const pairs: [string, string][] = [
        [c.onCta, c.cta],
        [c.lotus, c.bg],
        [c.lotus, c.surface],
        [c.ink, c.bg],
        [c.inkMuted, c.surface],
        [c.inkSubtle, c.bg],
        [c.inkSubtle, c.surface],
        [c.danger, c.dangerSoft],
        [c.danger, c.surface],
        [c.warning, c.warningSoft],
        [c.success, c.successSoft],
        [c.info!, c.infoSoft!],
        [p.activeInk, p.accentSoft],
        [p.activeInk, c.bg],
        [p.muted, c.bg],
      ];
      for (const [fg, bg] of pairs) expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("thanh tab và chip trạng thái dùng token chốt sẵn", () => {
    const light = paletteFromTokens(palettes.light);
    const dark = paletteFromTokens(palettes.dark);
    expect([light.activeInk, light.accentSoft]).toEqual(["#C23A22", "#F9EBE9"]);
    expect([dark.activeInk, dark.accentSoft]).toEqual(["#FF8066", "#3B2726"]);
    expect(toneColors(light, "danger").bg).toBe("#FFEDF1");
    expect(toneColors(light, "info")).toEqual({ fg: "#1B5FB8", bg: "#E4ECF6" });
    expect(toneColors(dark, "success").bg).toBe("#163022");
  });

  it("mặc định = figma theo hệ thống, nằm đầu danh sách; Synthetic Lime là lựa chọn riêng", () => {
    expect(DEFAULT_PALETTE_ID).toBe("figma");
    expect(DEFAULT_APPEARANCE.presetId).toBe("system");
    expect(PRESET_IDS[0]).toBe("system");
    expect(PRESET_IDS).toContain("synthetic");
    expect(THEME_SPECS.synthetic.name).toBe("Synthetic Lime");
    expect(appearanceVi.presets.system).toBe("Đỏ võ đài (mặc định)");
    expect(appearanceVi.presets.synthetic).toBe("Synthetic Lime");
    const labels = Object.values(appearanceVi.presets);
    expect(labels.filter((l) => /Figma|Cổ điển/.test(l))).toEqual([]);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it("lưu theo schema hiện hành (v4)", () => {
    expect(APPEARANCE_SCHEMA_VERSION).toBe(4);
    expect(JSON.parse(serializeAppearance(DEFAULT_APPEARANCE)).version).toBe(4);
  });
});

describe("default-theme-v2: chuyển dữ liệu đã lưu (v1 → v2)", () => {
  it("chưa từng lưu → mặc định mới", () => {
    expect(parseStoredAppearance(null, null).applied).toEqual(DEFAULT_APPEARANCE);
  });

  it("đang ở mặc định ngầm (Synthetic, không chỉnh màu) → Đỏ võ đài, giữ chỉnh chữ", () => {
    const r = parseStoredAppearance(v1("synthetic", { fontFamily: "lexend", fontScale: 1.2 }), null);
    expect(r.source).toBe("stored");
    expect(r.applied.presetId).toBe("system");
    expect(r.applied.settings.paletteId).toBe("figma");
    expect(r.applied.settings.mode).toBe("system");
    expect(r.applied.settings.fontFamily).toBe("lexend");
    expect(r.applied.settings.fontScale).toBe(1.2);
  });

  it("Synthetic có màu tự chọn → giữ nguyên", () => {
    const r = parseStoredAppearance(v1("synthetic", { backgroundColor: "#FFFFFF", textColor: "#06110D" }), null);
    expect(r.applied.presetId).toBe("synthetic");
    expect(r.applied.settings.paletteId).toBe("synthetic");
    expect(r.applied.settings.backgroundColor).toBe("#FFFFFF");
  });

  it("đã chọn bộ khác → giữ nguyên", () => {
    for (const id of ["toxicViolet", "system", "paper", "mint"]) {
      const r = parseStoredAppearance(v1(id), null);
      expect(r.applied.presetId).toBe(id);
      expect(r.applied.settings).toEqual(resolvePreset(id as never));
    }
  });

  it("accent cũ #D9492F đã lưu → #C23A22; accent khác giữ nguyên", () => {
    expect(parseStoredAppearance(v1("light", { accentColor: "#D9492F" }), null).applied.settings.accentColor).toBe(
      "#C23A22",
    );
    expect(parseStoredAppearance(v1("light", { accentColor: "#1F5FBF" }), null).applied.settings.accentColor).toBe(
      "#1F5FBF",
    );
  });

  it("đặt lại mặc định trả về Đỏ võ đài", () => {
    const built = buildColors(DEFAULT_APPEARANCE.settings, "light");
    expect(built.colors).toBe(palettes.light);
    expect(buildColors(DEFAULT_APPEARANCE.settings, "dark").colors).toBe(palettes.dark);
  });
});
