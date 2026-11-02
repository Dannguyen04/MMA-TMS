import { bestOnColor, contrastRatio, CONTRAST_BODY, isDarkColor, mixHex } from "@/theme/appearance/color-math";
import type { ColorTokens } from "@/theme/colors";
import { useColors } from "@/theme";

/** Màu "thông tin / phục hồi" dùng chung cho chip trạng thái (Designer batch27). */
export const STATUS_INFO = { dark: "#6EB5FF", light: "#1B5FB8" } as const;
/** Chữ nhãn bộ lọc dạng xám nhạt được phép (Designer batch27); luôn ≥ 4,5:1 trên nền/ thẻ của theme. */
export const FILTER_MUTED = { dark: "#9AA8A0", light: "#4A5550" } as const;

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
  /** Lỗi / vượt hạng cân (màu lỗi của theme). */
  danger: string;
  dangerSoft: string;
  /** Cảnh báo nhẹ (token `warning`: hổ phách trên nền tối). Luôn kèm biểu tượng + chữ. */
  attention: string;
  attentionSoft: string;
  /** Chữ / biểu tượng nhấn: đọc được trên nền (nền sáng dùng màu chữ, không dùng xanh chanh). */
  link: string;
  /** Màu mục đang chọn (tab bar…): ≥ 4.5:1 trên nền; nền sáng + xanh chanh → màu chữ. */
  activeInk: string;
  /** Xanh dương trạng thái "Phục hồi" / thông tin (có đủ độ tương phản trên nền & thẻ). */
  info: string;
  /** Nền chip "Phục hồi" / thông tin. */
  infoSoft: string;
  /** Chữ nhãn bộ lọc (xám nhạt cho phép). */
  filterMuted: string;
  /** Viền focus 2px. */
  ring: string;
  disabled: string;
  disabledInk: string;
};

/**
 * Maps the applied appearance tokens onto the fighter screen palette.
 * There is no separate warning token in `ColorTokens`; warnings use `danger`
 * and screens keep a text label so state is not color-only.
 */
/** Accent nếu đọc được trên nền (≥ 4.5:1), không thì màu link, cuối cùng là màu chữ. */
export function activeInkOn(colors: ColorTokens): string {
  for (const candidate of [colors.cta, colors.lotus]) {
    if (contrastRatio(candidate, colors.bg) >= CONTRAST_BODY) return candidate;
  }
  return colors.ink;
}

export function paletteFromTokens(colors: ColorTokens): FighterPalette {
  const onCage = bestOnColor(colors.cage);
  const cageIsDark = isDarkColor(colors.cage);
  const scheme: "light" | "dark" = isDarkColor(colors.bg) ? "dark" : "light";
  return {
    scheme,
    bg: colors.bg,
    surface: colors.surface,
    surface2: colors.surfaceMuted,
    ink: colors.ink,
    muted: colors.inkMuted,
    line: colors.line,
    accent: colors.cta,
    accentSoft: colors.tabPill ?? mixHex(colors.bg, colors.cta, 0.16),
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
    danger: colors.danger,
    dangerSoft: colors.dangerSoft,
    attention: colors.warning,
    attentionSoft: colors.warningSoft,
    link: colors.lotus,
    info: colors.info ?? STATUS_INFO[scheme],
    infoSoft: colors.infoSoft ?? mixHex(colors.surface, colors.info ?? STATUS_INFO[scheme], 0.18),
    filterMuted: FILTER_MUTED[scheme],
    ring: colors.ring,
    activeInk: colors.tabActive ?? activeInkOn(colors),
    disabled: colors.disabledFill,
    disabledInk: colors.disabledInk,
  };
}

export function useFighterPalette(): FighterPalette {
  const { colors } = useColors();
  return paletteFromTokens(colors);
}
