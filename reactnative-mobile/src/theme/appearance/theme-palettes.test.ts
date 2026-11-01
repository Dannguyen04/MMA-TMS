import { palettes } from "../colors";
import { contrastRatio } from "./color-math";
import {
  DEFAULT_APPEARANCE,
  DEFAULT_SETTINGS,
  resolvePreset,
  withBrightnessMode,
  parseStoredAppearance,
  serializeAppearance,
} from "./settings";
import {
  BIO_BLACK,
  paletteContrastRows,
  STATUS_COLORS,
  SYNTHETIC_LIGHT,
  THEME_PALETTES,
  THEME_SPECS,
  type ThemedPaletteId,
} from "./theme-palettes";
import { buildColors } from "./tokens";

const IDS = Object.keys(THEME_SPECS) as ThemedPaletteId[];

describe("built-in preset palettes", () => {
  it.each(IDS)("%s keeps its two base colours and meets WCAG on every pair", (id) => {
    const colors = THEME_PALETTES[id];
    const spec = THEME_SPECS[id];
    expect(spec.pair).toContain(spec.bg);
    expect(spec.pair).toContain(spec.accent);
    expect(colors.bg).toBe(spec.bg);
    expect(colors.cta).toBe(spec.accent);
    for (const row of paletteContrastRows(colors)) {
      expect({ pair: row.pair, ok: row.ok, ratio: row.ratio.toFixed(2) }).toEqual({
        pair: row.pair,
        ok: true,
        ratio: row.ratio.toFixed(2),
      });
    }
  });

  it.each(IDS)("%s primary button text is white or Bio Black, whichever reads better", (id) => {
    const { onCta, cta } = THEME_PALETTES[id];
    expect(["#FFFFFF", BIO_BLACK]).toContain(onCta);
    const other = onCta === "#FFFFFF" ? BIO_BLACK : "#FFFFFF";
    expect(contrastRatio(onCta, cta)).toBeGreaterThanOrEqual(contrastRatio(other, cta));
    expect(contrastRatio(onCta, cta)).toBeGreaterThanOrEqual(4.5);
  });
});

describe("Designer FINAL contrast spec", () => {
  const ratio = (a: string, b: string) => contrastRatio(a, b);

  it("raw hex pairs match the spec numbers", () => {
    expect(ratio("#000000", "#0038FF")).toBeCloseTo(3.01, 1); // black on cobalt fails
    expect(ratio("#FFFFFF", "#0038FF")).toBeCloseTo(6.98, 1); // white on cobalt
    expect(ratio("#0038FF", BIO_BLACK)).toBeLessThan(3); // cobalt text on dark: never
    expect(ratio("#C8FF00", "#FFFFFF")).toBeLessThan(1.5); // lime text on white fails
    expect(ratio(BIO_BLACK, "#C8FF00")).toBeGreaterThanOrEqual(4.5);
    expect(ratio(BIO_BLACK, "#FFFFFF")).toBeGreaterThanOrEqual(4.5);
  });

  it("combo 6 dark tokens: primary #F5F7F2, secondary #9AA8A0, lime button with Bio Black text", () => {
    const c = THEME_PALETTES.synthetic;
    expect(c.bg).toBe("#06110D");
    expect(c.ink).toBe("#F5F7F2");
    expect(c.inkMuted).toBe("#9AA8A0");
    expect(c.cta).toBe("#C8FF00");
    expect(c.onCta).toBe("#06110D");
    expect(c.danger).toBe("#FF5A5F");
    expect(c.warning).toBe("#FFB020");
    for (const [fg, bg] of [
      [c.ink, c.bg],
      [c.ink, c.surface],
      [c.inkMuted, c.bg],
      [c.inkMuted, c.surface],
      [c.inkMuted, c.surfaceMuted],
      [c.onCta, c.cta],
      [c.danger, c.bg],
      [c.danger, c.surface],
      [c.danger, c.surfaceMuted],
      [c.warning, c.bg],
      [c.warning, c.surface],
    ] as const) {
      expect(ratio(fg, bg)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("error and warning colours per scheme, all readable on their own grounds", () => {
    expect(STATUS_COLORS.dark.danger).toBe("#FF5A5F");
    expect(STATUS_COLORS.dark.warning).toBe("#FFB020");
    expect(STATUS_COLORS.light.danger).toBe("#B3261E");
    expect(ratio("#B3261E", "#FFFFFF")).toBeGreaterThanOrEqual(4.5);
    expect(ratio(SYNTHETIC_LIGHT.danger, SYNTHETIC_LIGHT.bg)).toBeGreaterThanOrEqual(4.5);
    expect(SYNTHETIC_LIGHT.danger).toBe("#B3261E");
    expect(ratio(SYNTHETIC_LIGHT.warning, SYNTHETIC_LIGHT.bg)).toBeGreaterThanOrEqual(4.5);
    for (const id of IDS) {
      const c = THEME_PALETTES[id];
      expect(ratio(c.danger, c.bg)).toBeGreaterThanOrEqual(4.5);
      expect(ratio(c.warning, c.bg)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("light mode: lime is only a button fill, text and links use Bio Black", () => {
    const c = SYNTHETIC_LIGHT;
    expect(c.cta).toBe("#C8FF00");
    expect(c.onCta).toBe("#06110D");
    expect(c.lotus).toBe(c.ink);
    expect(c.ink).toBe("#06110D");
    expect(c.lotus).not.toBe("#C8FF00");
    for (const row of paletteContrastRows(c).filter((r) => !r.pair.startsWith("cta/"))) {
      expect({ pair: row.pair, ok: row.ok }).toEqual({ pair: row.pair, ok: true });
    }
  });

  it("white text on Hyper Cobalt buttons, and cobalt is never text on a dark ground", () => {
    expect(THEME_PALETTES.hyperCobalt.onCta).toBe("#FFFFFF");
    for (const id of IDS) {
      const c = THEME_PALETTES[id];
      if (THEME_SPECS[id].scheme === "dark") expect(c.lotus.toUpperCase()).not.toBe("#0038FF");
    }
  });
});

describe("default and priority", () => {
  it("defaults to Đỏ võ đài (Figma) following the system, Synthetic Lime stays selectable", () => {
    expect(DEFAULT_APPEARANCE.presetId).toBe("system");
    expect(DEFAULT_SETTINGS.paletteId).toBe("figma");
    expect(DEFAULT_SETTINGS.mode).toBe("system");
    expect(buildColors(DEFAULT_SETTINGS, "light").colors).toBe(palettes.light);
    expect(buildColors(DEFAULT_SETTINGS, "dark").colors).toBe(palettes.dark);
    const synthetic = buildColors(resolvePreset("synthetic"), "light");
    expect(synthetic.scheme).toBe("dark");
    expect(synthetic.colors.bg).toBe("#06110D");
    expect(synthetic.colors.cta).toBe("#C8FF00");
    expect(synthetic.colors.onCta).toBe("#06110D");
  });

  it("a custom light background on Synthetic keeps lime as fill only and swaps in light status colours", () => {
    const light = buildColors({ ...resolvePreset("synthetic"), backgroundColor: "#FFFFFF", textColor: "#06110D" }, "dark");
    expect(light.scheme).toBe("light");
    expect(light.colors.cta).toBe("#C8FF00");
    expect(light.colors.onCta).toBe("#06110D");
    expect(light.colors.lotus).toBe("#06110D");
    expect(light.colors.danger).toBe("#B3261E");
    expect(contrastRatio(light.colors.warning, "#FFFFFF")).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps the old Figma palette selectable and unchanged", () => {
    expect(buildColors({ ...resolvePreset("system"), mode: "light" }, "dark").colors).toBe(palettes.light);
    expect(buildColors(resolvePreset("system"), "dark").colors).toBe(palettes.dark);
  });

  it("lets user custom colours override a preset", () => {
    const custom = buildColors({ ...resolvePreset("toxicViolet"), accentColor: "#1F6B3A" }, "dark");
    expect(custom.colors.cta).toBe("#1F6B3A");
    const bg = buildColors({ ...resolvePreset("carbonTeal"), backgroundColor: "#FFFFFF" }, "dark");
    expect(bg.colors.bg).toBe("#FFFFFF");
  });

  it("picking Sáng/Tối leaves the themed palette; reset returns to the default", () => {
    const light = withBrightnessMode(DEFAULT_APPEARANCE, "light");
    expect(light.settings.paletteId).toBe("figma");
    expect(buildColors(light.settings, "dark").colors).toBe(palettes.light);
    expect(resolvePreset(DEFAULT_APPEARANCE.presetId)).toEqual(DEFAULT_SETTINGS);
  });

  it("round-trips every preset through storage", () => {
    for (const id of ["synthetic", "toxicViolet", "warmLime", "chromeViolet", "carbonTeal", "hyperCobalt", "system"] as const) {
      const applied = { presetId: id, settings: resolvePreset(id) };
      const back = parseStoredAppearance(serializeAppearance(applied), null).applied;
      expect(back).toEqual(applied);
    }
  });
});
