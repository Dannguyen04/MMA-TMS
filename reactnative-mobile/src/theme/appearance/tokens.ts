import { palettes, trueBlackPalette, type ColorSchemeName, type ColorTokens, type CoreColorKey } from "../colors";
import { radius as baseRadius } from "../radius";
import { spacing as baseSpacing } from "../spacing";
import {
  contentRoles,
  type ContentRole,
  type LiveTypography,
} from "../typography";
import {
  bestOnColor,
  contrastRatio,
  CONTRAST_BODY,
  CONTRAST_LARGE,
  ensureContrast,
  isDarkColor,
  isLargeText,
  mixHex,
} from "./color-math";
import { isThemedPalette, STATUS_COLORS, THEME_PALETTES, THEME_SPECS, type PaletteId } from "./theme-palettes";
import { BODY_FONTS, DEFAULT_FONT_FAMILY } from "./fonts";
import {
  MAX_TOTAL_FONT_SCALE,
  type AppearanceSettings,
  type Density,
  type FontFamilyId,
  type RadiusScale,
} from "./settings";

export type ColorVariant = "light" | "dark" | "trueBlack";

export function resolveVariant(
  settings: Pick<AppearanceSettings, "mode" | "systemDarkVariant">,
  systemScheme: ColorSchemeName,
): ColorVariant {
  if (settings.mode === "system") {
    return systemScheme === "dark" ? settings.systemDarkVariant : "light";
  }
  // "Kiểu tối" (Tối / Đen tuyền) applies to Tối as well as to Hệ thống at night.
  if (settings.mode === "dark") return settings.systemDarkVariant;
  return settings.mode;
}

function basePalette(variant: ColorVariant, paletteId: PaletteId): ColorTokens {
  if (isThemedPalette(paletteId)) return THEME_PALETTES[paletteId];
  if (variant === "trueBlack") return trueBlackPalette;
  return palettes[variant];
}

/** Brightness mode to hand to the OS: themed palettes force their own scheme. */
export function nativeMode(settings: Pick<AppearanceSettings, "mode" | "paletteId">): AppearanceSettings["mode"] {
  return isThemedPalette(settings.paletteId) ? THEME_SPECS[settings.paletteId].scheme : settings.mode;
}

export type BuiltColors = { scheme: ColorSchemeName; variant: ColorVariant; colors: ColorTokens };

/**
 * Preset palette plus user overrides. With no color overrides the preset
 * palette is returned untouched, so defaults stay identical to the fixed themes.
 */
export function buildColors(
  settings: AppearanceSettings,
  systemScheme: ColorSchemeName,
): BuiltColors {
  const paletteId = settings.paletteId;
  // Themed palettes are fixed single-scheme looks; brightness only drives the classic Figma palette.
  const variant: ColorVariant = isThemedPalette(paletteId)
    ? THEME_SPECS[paletteId].scheme
    : resolveVariant(settings, systemScheme);
  const base = basePalette(variant, paletteId);
  const { textColor, backgroundColor, surfaceColor, accentColor } = settings;
  const variantScheme: ColorSchemeName = variant === "light" ? "light" : "dark";

  if (!textColor && !backgroundColor && !surfaceColor && !accentColor) {
    return { scheme: variantScheme, variant, colors: base };
  }

  const bg = backgroundColor ?? base.bg;
  const scheme: ColorSchemeName = backgroundColor
    ? isDarkColor(bg)
      ? "dark"
      : "light"
    : variantScheme;
  const ink = textColor ?? (backgroundColor ? ensureContrast(base.ink, bg, CONTRAST_BODY) : base.ink);
  const surface =
    surfaceColor ?? (backgroundColor ? mixHex(bg, ink, 0.05) : base.surface);
  const neutralChanged = Boolean(textColor || backgroundColor || surfaceColor);

  const next: ColorTokens = { ...base, bg, ink, surface };
  // Fixed extras of the default palette belong to its own neutrals/accent: drop them once those change.
  if (textColor || backgroundColor || surfaceColor) {
    delete next.infoSoft;
    delete next.tabPill;
    delete next.tabActive;
    delete next.skeletonBase;
    delete next.skeletonHighlight;
  }

  if (neutralChanged) {
    const derive = (t: number) => {
      const mixed = mixHex(ink, bg, t);
      const onBg = ensureContrast(mixed, bg, CONTRAST_BODY);
      return contrastRatio(onBg, surface) >= CONTRAST_BODY ? onBg : ensureContrast(onBg, surface, CONTRAST_BODY);
    };
    next.inkMuted = derive(0.3);
    next.inkSubtle = derive(0.42);
    next.surfaceMuted = mixHex(surface, ink, 0.08);
    next.line = mixHex(bg, ink, 0.16);
    next.controlBorder = mixHex(bg, ink, 0.5);
    next.disabledFill = mixHex(bg, ink, 0.1);
    next.disabledInk = mixHex(bg, ink, 0.45);
    if (scheme !== variantScheme) {
      // The custom background flipped light/dark: take the status colours made for that scheme.
      const status = STATUS_COLORS[scheme];
      const success = scheme === "dark" ? "#6BC48F" : "#1E6B49";
      next.danger = ensureContrast(status.danger, bg, CONTRAST_BODY);
      next.warning = ensureContrast(status.warning, bg, CONTRAST_BODY);
      next.success = ensureContrast(success, bg, CONTRAST_BODY);
      next.dangerSoft = mixHex(bg, next.danger, 0.16);
      next.warningSoft = mixHex(bg, next.warning, 0.16);
      next.successSoft = mixHex(bg, next.success, 0.16);
    }
    if (!accentColor) {
      if (contrastRatio(base.lotus, bg) < CONTRAST_BODY) {
        // Light ground + accent too pale to read (lime on white): text and links use ink, the accent stays a fill.
        next.lotus =
          scheme === "light" && contrastRatio(ink, bg) >= CONTRAST_BODY
            ? ink
            : ensureContrast(base.lotus, bg, CONTRAST_BODY);
        next.ring = next.lotus;
      }
      // A preset CTA that vanishes into a custom background falls back to ink-on-bg,
      // except a light ground where the label on the fill is still readable (lime button, Bio Black text).
      const fillKept = scheme === "light" && contrastRatio(base.onCta, base.cta) >= CONTRAST_BODY;
      if (contrastRatio(base.cta, bg) < CONTRAST_LARGE && !fillKept) {
        next.cta = ink;
        next.onCta = bg;
      }
    }
  }

  if (accentColor) {
    delete next.tabPill;
    delete next.tabActive;
    next.lotus = accentColor;
    next.ring = accentColor;
    next.cta = accentColor;
    next.onCta = bestOnColor(accentColor);
  }

  return { scheme, variant, colors: next };
}

/** Semantic names from the plan, aliased onto the legacy token names. */
export type SemanticColors = {
  background: string;
  surface: string;
  surfaceMuted: string;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  accent: string;
  onAccent: string;
  link: string;
  border: string;
  controlBorder: string;
  focusRing: string;
  danger: string;
  dangerSurface: string;
  success: string;
  successSurface: string;
  disabledSurface: string;
  disabledText: string;
  brandCage: string;
};

export function toSemantic(colors: ColorTokens): SemanticColors {
  return {
    background: colors.bg,
    surface: colors.surface,
    surfaceMuted: colors.surfaceMuted,
    textPrimary: colors.ink,
    textSecondary: colors.inkMuted,
    textTertiary: colors.inkSubtle,
    accent: colors.cta,
    onAccent: colors.onCta,
    link: colors.lotus,
    border: colors.line,
    controlBorder: colors.controlBorder,
    focusRing: colors.ring,
    danger: colors.danger,
    dangerSurface: colors.dangerSoft,
    success: colors.success,
    successSurface: colors.successSoft,
    disabledSurface: colors.disabledFill,
    disabledText: colors.disabledInk,
    brandCage: colors.cage,
  };
}

export type TypographyTokens = LiveTypography & {
  family: FontFamilyId;
  /** User setting (0.85–1.6) before the OS cap. */
  fontScale: number;
  osFontScale: number;
};

/**
 * `sizeFactor` is the in-app scale, reduced when needed so that
 * in-app × OS text scale stays ≤ MAX_TOTAL_FONT_SCALE.
 */
export function buildTypography(
  settings: AppearanceSettings,
  osFontScale: number,
  familyAvailable: boolean,
): TypographyTokens {
  const family = familyAvailable ? settings.fontFamily : DEFAULT_FONT_FAMILY;
  const os = osFontScale > 0 ? osFontScale : 1;
  const sizeFactor = Math.min(settings.fontScale, MAX_TOTAL_FONT_SCALE / os);
  return {
    family,
    fontScale: settings.fontScale,
    osFontScale: os,
    faces: BODY_FONTS[family].faces,
    sizeFactor: Math.round(sizeFactor * 1000) / 1000,
    lineHeight: settings.lineHeight,
    letterSpacingEm: settings.letterSpacing,
    bold: settings.fontWeight === "bold",
  };
}

const DENSITY_FACTOR: Record<Density, number> = { compact: 0.85, comfortable: 1, spacious: 1.15 };
const RADIUS_FACTOR: Record<RadiusScale, number> = { sharp: 0.5, default: 1, round: 1.5 };

/** Touch targets never shrink below this, whatever the density. */
export const MIN_TOUCH_TARGET = 44;

type SpacingTokens = { [K in keyof typeof baseSpacing]: number };
type RadiusTokens = { [K in keyof typeof baseRadius]: number };

export type LayoutTokens = {
  density: Density;
  radiusScale: RadiusScale;
  spacing: SpacingTokens;
  radius: RadiusTokens;
  minTouchTarget: number;
};

export function buildLayout(settings: AppearanceSettings): LayoutTokens {
  const d = DENSITY_FACTOR[settings.density];
  const r = RADIUS_FACTOR[settings.radiusScale];
  const spacing = Object.fromEntries(
    Object.entries(baseSpacing).map(([key, value]) => [key, Math.round(value * d)]),
  ) as SpacingTokens;
  const radius: RadiusTokens = {
    field: Math.round(baseRadius.field * r),
    panel: Math.round(baseRadius.panel * r),
    pill: baseRadius.pill,
  };
  return {
    density: settings.density,
    radiusScale: settings.radiusScale,
    spacing,
    radius,
    minTouchTarget: MIN_TOUCH_TARGET,
  };
}

export type ContrastPairId =
  | "textOnBackground"
  | "textOnSurface"
  | "secondaryOnBackground"
  | "secondaryOnSurface"
  | "tertiaryOnBackground"
  | "tertiaryOnSurface"
  | "onAccent"
  | "linkOnBackground";

export type ContrastLevel = "ok" | "warn" | "severe";

export type ContrastCheck = {
  id: ContrastPairId;
  fg: string;
  bg: string;
  ratio: number;
  required: number;
  level: ContrastLevel;
};

const PAIRS: {
  id: ContrastPairId;
  fg: CoreColorKey;
  bg: CoreColorKey;
  role: ContentRole;
}[] = [
  { id: "textOnBackground", fg: "ink", bg: "bg", role: "body" },
  { id: "textOnSurface", fg: "ink", bg: "surface", role: "body" },
  { id: "secondaryOnBackground", fg: "inkMuted", bg: "bg", role: "body" },
  { id: "secondaryOnSurface", fg: "inkMuted", bg: "surface", role: "body" },
  { id: "tertiaryOnBackground", fg: "inkSubtle", bg: "bg", role: "caption" },
  { id: "tertiaryOnSurface", fg: "inkSubtle", bg: "surface", role: "caption" },
  { id: "onAccent", fg: "onCta", bg: "cta", role: "cta" },
  { id: "linkOnBackground", fg: "lotus", bg: "bg", role: "link" },
];

/**
 * 4.5:1 for normal text, 3:1 when the role renders as WCAG "large" text at
 * the current scale. Anything under 3:1 is `severe` (extra confirmation).
 */
export function contrastReport(colors: ColorTokens, typography: LiveTypography): ContrastCheck[] {
  return PAIRS.map(({ id, fg, bg, role }) => {
    const def = contentRoles[role];
    const size = def.fontSize * typography.sizeFactor;
    const bold = typography.bold || def.slot === "semibold" || def.slot === "bold";
    const required = isLargeText(size, bold) ? CONTRAST_LARGE : CONTRAST_BODY;
    const ratio = contrastRatio(colors[fg], colors[bg]);
    const level: ContrastLevel =
      ratio >= required ? "ok" : ratio < CONTRAST_LARGE ? "severe" : "warn";
    return { id, fg: colors[fg], bg: colors[bg], ratio, required, level };
  });
}
