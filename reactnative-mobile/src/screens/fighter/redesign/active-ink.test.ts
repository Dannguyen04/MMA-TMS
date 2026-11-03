import { isHiddenTab, tabBarBottomPadding, TAB_BAR_MIN_HEIGHT } from "@/components/role-tab-bar";
import { activeInkOn, paletteFromTokens } from "@/screens/fighter/redesign/palette";
import { contrastRatio } from "@/theme/appearance/color-math";
import { buildColors } from "@/theme/appearance/tokens";
import { resolvePreset } from "@/theme/appearance/settings";
import { palettes } from "@/theme/colors";
import { THEME_PALETTES, THEME_SPECS, type ThemedPaletteId } from "@/theme/appearance/theme-palettes";

describe("màu mục đang chọn của tab bar", () => {
  it("Synthetic tối giữ xanh chanh #C8FF00", () => {
    expect(activeInkOn(THEME_PALETTES.synthetic).toUpperCase()).toBe("#C8FF00");
  });

  it("Synthetic sáng (nền trắng) dùng #06110D, nền pill vẫn là xanh chanh nhạt", () => {
    const light = buildColors({ ...resolvePreset("synthetic"), backgroundColor: "#FFFFFF", textColor: "#06110D" }, "dark");
    const palette = paletteFromTokens(light.colors);
    expect(palette.activeInk.toUpperCase()).toBe("#06110D");
    expect(palette.accentSoft).not.toBe(palette.activeInk);
    expect(contrastRatio(palette.activeInk, light.colors.bg)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(palette.activeInk, palette.accentSoft)).toBeGreaterThanOrEqual(4.5);
  });

  it("mọi bảng màu: mục đang chọn ≥ 4.5:1 trên nền thanh tab", () => {
    const all = [
      palettes.light,
      palettes.dark,
      buildColors({ ...resolvePreset("system"), mode: "light" }, "light").colors,
      ...(Object.keys(THEME_SPECS) as ThemedPaletteId[]).map((id) => THEME_PALETTES[id]),
    ];
    for (const colors of all) {
      const palette = paletteFromTokens(colors);
      expect(contrastRatio(palette.activeInk, colors.bg)).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe("thanh tab Coach/Admin dùng chung", () => {
  it("cao tối thiểu 56dp và đệm dưới ≥ 8dp theo vùng an toàn", () => {
    expect(TAB_BAR_MIN_HEIGHT).toBeGreaterThanOrEqual(56);
    expect(tabBarBottomPadding(0)).toBe(8);
    expect(tabBarBottomPadding(34)).toBe(34);
  });

  it("tab href:null (display none) bị ẩn khỏi thanh", () => {
    expect(isHiddenTab({ display: "none" })).toBe(true);
    expect(isHiddenTab([{ display: "flex" }, { display: "none" }])).toBe(true);
    expect(isHiddenTab(undefined)).toBe(false);
    expect(isHiddenTab({ opacity: 1 })).toBe(false);
  });

  it("viên thuốc đang chọn ở nền sáng là xanh chanh nhạt (không xám) và chữ #06110D đọc được trên đó", () => {
    const light = buildColors({ ...resolvePreset("synthetic"), backgroundColor: "#FFFFFF", textColor: "#06110D" }, "dark");
    const palette = paletteFromTokens(light.colors);
    const hex = palette.accentSoft.replace("#", "");
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
    expect(g - b).toBeGreaterThanOrEqual(12); // ngả vàng-xanh, không phải xám trung tính
    expect(g).toBeGreaterThanOrEqual(r);
    expect(palette.activeInk.toUpperCase()).toBe("#06110D");
    expect(contrastRatio(palette.activeInk, palette.accentSoft)).toBeGreaterThanOrEqual(4.5);
  });
});
