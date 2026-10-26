import { bestOnColor, isDarkColor, mixHex } from "@/theme/appearance/color-math";
import type { ColorTokens } from "@/theme/colors";
import { useColors } from "@/theme";

/** Semantic colors from the fighter redesign (light reference + dark Settings/Appearance). */
export type FighterPalette = {
  scheme: "light" | "dark";
  bg: string;
  surface: string;
  surface2: string;
  ink: string;
  muted: string;
  line: string;
  accent: string;
  accentSoft: string;
  onAccent: string;
  agenda: string;
  agendaInk: string;
  agendaMuted: string;
  day: string;
  marker: string;
  success: string;
  successSoft: string;
  warning: string;
  warningSoft: string;
  disabled: string;
  disabledInk: string;
};

/**
 * Maps the applied appearance tokens onto the fighter screen palette.
 * There is no separate warning token in `ColorTokens`; warnings use `danger`
 * and screens keep a text label so state is not color-only.
 */
export function paletteFromTokens(colors: ColorTokens): FighterPalette {
  const onCage = bestOnColor(colors.cage);
  const cageIsDark = isDarkColor(colors.cage);
  return {
    scheme: isDarkColor(colors.bg) ? "dark" : "light",
    bg: colors.bg,
    surface: colors.surface,
    surface2: colors.surfaceMuted,
    ink: colors.ink,
    muted: colors.inkMuted,
    line: colors.line,
    accent: colors.cta,
    accentSoft: mixHex(colors.bg, colors.cta, 0.16),
    onAccent: colors.onCta,
    agenda: colors.cage,
    agendaInk: onCage,
    agendaMuted: mixHex(onCage, colors.cage, 0.35),
    day: mixHex(colors.cage, onCage, cageIsDark ? 0.14 : 0.08),
    marker: mixHex(onCage, colors.cage, 0.45),
    success: colors.success,
    successSoft: colors.successSoft,
    warning: colors.danger,
    warningSoft: colors.dangerSoft,
    disabled: colors.disabledFill,
    disabledInk: colors.disabledInk,
  };
}

export function useFighterPalette(): FighterPalette {
  const { colors } = useColors();
  return paletteFromTokens(colors);
}
