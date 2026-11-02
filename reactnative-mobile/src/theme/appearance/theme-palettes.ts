import type { ColorTokens } from "../colors";
import {
  contrastRatio,
  CONTRAST_BODY,
  CONTRAST_LARGE,
  ensureContrast,
  mixHex,
} from "./color-math";

/**
 * "figma" = "Đỏ võ đài" — the default (default-theme-v2): original Figma light/dark tokens with AA fixes,
 * follows Sáng/Tối/Hệ thống. "synthetic" (Synthetic Lime) is now a selectable preset.
 * Every other id is a fixed single-scheme palette derived from two base colours.
 */
export type PaletteId =
  | "figma"
  | "synthetic"
  | "toxicViolet"
  | "warmLime"
  | "chromeViolet"
  | "carbonTeal"
  | "hyperCobalt";

export const DEFAULT_PALETTE_ID: PaletteId = "figma";
export const PALETTE_IDS: readonly PaletteId[] = [
  "figma",
  "synthetic",
  "toxicViolet",
  "warmLime",
  "chromeViolet",
  "carbonTeal",
  "hyperCobalt",
];

export type ThemedPaletteId = Exclude<PaletteId, "figma">;

type Spec = {
  name: string;
  scheme: "light" | "dark";
  /** The two colours as given. */
  pair: readonly [string, string];
  bg: string;
  /** Text colour: one of the pair, or derived from it when the pair colour is too weak as text. */
  ink: string;
  /** Primary accent (button fill, links); always one of the pair. */
  accent: string;
  /** Secondary text, when the design fixes it instead of deriving it. */
  inkMuted?: string;
};

/** Bio Black: the text colour used on lime fills and as text on light grounds. */
export const BIO_BLACK = "#06110D";

/** Error / warning colours fixed by the design, per scheme. Always shown with an icon + text. */
export const STATUS_COLORS = {
  dark: { danger: "#FF5A5F", warning: "#FFB020" },
  light: { danger: "#B3261E", warning: "#7A4F00" },
} as const;

const darken = (hex: string, t: number) => mixHex(hex, "#000000", t);

/**
 * Light-mode twin of combo 6 (not a preset). Lime fails as text on white (1.18),
 * so text and links use Bio Black and lime stays a button fill only.
 */
export const SYNTHETIC_LIGHT_SPEC: Spec = {
  name: "Synthetic Lime (sáng)",
  scheme: "light",
  pair: ["#C8FF00", "#06110D"],
  bg: "#FFFFFF",
  ink: BIO_BLACK,
  accent: "#C8FF00",
};

export const THEME_SPECS: Record<ThemedPaletteId, Spec> = {
  // 6 · default: Bio Black ground, lime is the single accent.
  synthetic: {
    name: "Synthetic Lime",
    scheme: "dark",
    pair: ["#C8FF00", "#06110D"],
    bg: "#06110D",
    ink: "#F5F7F2",
    inkMuted: "#9AA8A0",
    accent: "#C8FF00",
  },
  toxicViolet: {
    name: "Toxic Violet",
    scheme: "dark",
    pair: ["#3D007A", "#E8ECF1"],
    bg: "#3D007A",
    ink: "#E8ECF1",
    accent: "#E8ECF1",
  },
  warmLime: {
    name: "Warm Lime / Olive Ink",
    scheme: "light",
    pair: ["#CFFF74", "#2F3A1D"],
    bg: "#CFFF74",
    ink: "#2F3A1D",
    accent: "#2F3A1D",
  },
  chromeViolet: {
    name: "Chrome Violet / Glass Blue",
    scheme: "light",
    pair: ["#5F2CFF", "#DFF6FF"],
    bg: "#DFF6FF",
    ink: darken("#5F2CFF", 0.6),
    accent: "#5F2CFF",
  },
  carbonTeal: {
    name: "Carbon Teal / Mint Foam",
    scheme: "dark",
    pair: ["#042F32", "#D6FFCB"],
    bg: "#042F32",
    ink: "#D6FFCB",
    accent: "#D6FFCB",
  },
  hyperCobalt: {
    name: "Hyper Cobalt / Skin Sand",
    scheme: "light",
    pair: ["#0038FF", "#FFD8B8"],
    bg: "#FFD8B8",
    ink: darken("#0038FF", 0.65),
    accent: "#0038FF",
  },
};

/** Moves `fg` until it reads on every background in `bgs` at `min`. */
function fit(fg: string, bgs: readonly string[], min: number): string {
  let out = fg.toUpperCase();
  for (let pass = 0; pass < 2; pass += 1) {
    for (const bg of bgs) out = ensureContrast(out, bg, min);
  }
  return out;
}

export function derivePalette(spec: Spec): ColorTokens {
  const dark = spec.scheme === "dark";
  const { bg } = spec;
  const ink = fit(spec.ink, [bg], CONTRAST_BODY);
  const surface = dark ? mixHex(bg, ink, 0.07) : mixHex(bg, "#FFFFFF", 0.6);
  const surfaceMuted = dark ? mixHex(bg, ink, 0.13) : mixHex(bg, "#FFFFFF", 0.3);
  const grounds = [bg, surface, surfaceMuted];
  const inkFinal = fit(ink, grounds, CONTRAST_BODY);

  const inkMuted = fit(spec.inkMuted ?? mixHex(inkFinal, bg, 0.3), grounds, CONTRAST_BODY);
  const inkSubtle = fit(mixHex(inkFinal, bg, 0.42), grounds, CONTRAST_BODY);
  const line = mixHex(bg, inkFinal, dark ? 0.22 : 0.18);
  const controlBorder = fit(mixHex(bg, inkFinal, 0.55), [bg, surface], CONTRAST_LARGE);

  const cta = spec.accent.toUpperCase();
  // Light ground: an accent that cannot be read as text (lime on white) is never used as text; ink is.
  const accentReadable = contrastRatio(cta, bg) >= CONTRAST_BODY && contrastRatio(cta, surface) >= CONTRAST_BODY;
  const lotus = dark || accentReadable ? fit(cta, [bg, surface], CONTRAST_BODY) : inkFinal;
  // Text on the accent fill: white or Bio Black, whichever reads better (white on cobalt, Bio Black on lime).
  const onCta = contrastRatio("#FFFFFF", cta) >= contrastRatio(BIO_BLACK, cta) ? "#FFFFFF" : BIO_BLACK;

  const dangerBase = STATUS_COLORS[spec.scheme].danger;
  const warningBase = STATUS_COLORS[spec.scheme].warning;
  const successBase = dark ? "#6BC48F" : "#1E6B49";
  const dangerSoft0 = mixHex(bg, dangerBase, 0.16);
  const successSoft0 = mixHex(bg, successBase, 0.16);
  const warningSoft0 = mixHex(bg, warningBase, 0.16);
  const danger = fit(dangerBase, [...grounds, dangerSoft0], CONTRAST_BODY);
  const warning = fit(warningBase, [...grounds, warningSoft0], CONTRAST_BODY);
  const success = fit(successBase, [...grounds, successSoft0], CONTRAST_BODY);

  return {
    bg,
    surface,
    surfaceMuted,
    ink: inkFinal,
    inkMuted,
    inkSubtle,
    line,
    controlBorder,
    cage: dark ? mixHex(bg, inkFinal, 0.1) : darken(inkFinal, 0.2),
    lotus,
    cta,
    onCta,
    ring: lotus,
    danger,
    dangerSoft: dangerSoft0,
    warning,
    warningSoft: warningSoft0,
    success,
    successSoft: successSoft0,
    disabledFill: mixHex(bg, inkFinal, 0.1),
    disabledInk: mixHex(bg, inkFinal, 0.45),
  };
}

export const SYNTHETIC_LIGHT = derivePalette(SYNTHETIC_LIGHT_SPEC);

export const THEME_PALETTES = Object.fromEntries(
  (Object.keys(THEME_SPECS) as ThemedPaletteId[]).map((id) => [id, derivePalette(THEME_SPECS[id])]),
) as Record<ThemedPaletteId, ColorTokens>;

export function isThemedPalette(id: PaletteId): id is ThemedPaletteId {
  return id !== "figma";
}

export type ContrastRow = { pair: string; ratio: number; required: number; ok: boolean };

/** Every text / icon pair a screen uses, with the WCAG minimum it must meet. */
export function paletteContrastRows(c: ColorTokens): ContrastRow[] {
  const row = (pair: string, fg: string, bg: string, required: number): ContrastRow => {
    const ratio = contrastRatio(fg, bg);
    return { pair, ratio, required, ok: ratio >= required };
  };
  return [
    row("ink/bg", c.ink, c.bg, CONTRAST_BODY),
    row("ink/surface", c.ink, c.surface, CONTRAST_BODY),
    row("ink/surfaceMuted", c.ink, c.surfaceMuted, CONTRAST_BODY),
    row("inkMuted/bg", c.inkMuted, c.bg, CONTRAST_BODY),
    row("inkMuted/surface", c.inkMuted, c.surface, CONTRAST_BODY),
    row("inkMuted/surfaceMuted", c.inkMuted, c.surfaceMuted, CONTRAST_BODY),
    row("inkSubtle/bg", c.inkSubtle, c.bg, CONTRAST_BODY),
    row("inkSubtle/surface", c.inkSubtle, c.surface, CONTRAST_BODY),
    row("onCta/cta", c.onCta, c.cta, CONTRAST_BODY),
    row("cta/bg (button edge, icon)", c.cta, c.bg, CONTRAST_LARGE),
    row("cta/surface", c.cta, c.surface, CONTRAST_LARGE),
    row("lotus/bg (link)", c.lotus, c.bg, CONTRAST_BODY),
    row("lotus/surface", c.lotus, c.surface, CONTRAST_BODY),
    row("ring/bg", c.ring, c.bg, CONTRAST_LARGE),
    row("controlBorder/bg", c.controlBorder, c.bg, CONTRAST_LARGE),
    row("controlBorder/surface", c.controlBorder, c.surface, CONTRAST_LARGE),
    row("danger/bg", c.danger, c.bg, CONTRAST_BODY),
    row("danger/surface", c.danger, c.surface, CONTRAST_BODY),
    row("danger/dangerSoft", c.danger, c.dangerSoft, CONTRAST_BODY),
    row("warning/bg", c.warning, c.bg, CONTRAST_BODY),
    row("warning/surface", c.warning, c.surface, CONTRAST_BODY),
    row("warning/warningSoft", c.warning, c.warningSoft, CONTRAST_BODY),
    row("success/bg", c.success, c.bg, CONTRAST_BODY),
    row("success/surface", c.success, c.surface, CONTRAST_BODY),
    row("success/successSoft", c.success, c.successSoft, CONTRAST_BODY),
  ];
}
