export type ColorSchemeName = "light" | "dark";

export type ColorTokens = {
  bg: string;
  surface: string;
  surfaceMuted: string;
  ink: string;
  inkMuted: string;
  inkSubtle: string;
  line: string;
  controlBorder: string;
  cage: string;
  lotus: string;
  cta: string;
  onCta: string;
  ring: string;
  danger: string;
  dangerSoft: string;
  /** Cảnh báo (chưa vượt hạn mức): luôn đi kèm biểu tượng + chữ. */
  warning: string;
  warningSoft: string;
  success: string;
  successSoft: string;
  disabledFill: string;
  disabledInk: string;
  /** Tùy chọn (bảng "Đỏ võ đài" chốt sẵn); thiếu thì màn tự suy ra. Xanh "Phục hồi" + nền. */
  info?: string;
  infoSoft?: string;
  /** Tab đang chọn (icon + chữ) và viên thuốc phía sau. */
  tabActive?: string;
  tabPill?: string;
  /** Khung xương tải: nền / vệt sáng. */
  skeletonBase?: string;
  skeletonHighlight?: string;
};

/** Tokens every palette defines (excludes the optional extras above). */
export type CoreColorKey = {
  [K in keyof ColorTokens]-?: undefined extends ColorTokens[K] ? never : K;
}[keyof ColorTokens];

/**
 * Palette mặc định "Đỏ võ đài" (default-theme-v2, 19/10/2026) = Figma (file wacRZnXD7F1lY2pDMEnKP1, page 9:131 — "Trang chủ",
 * "Giao diện — Tùy chỉnh / Sáng|Tối", "Manager · Quản lý").
 * Biến Figma: color/bg, color/surface, color/surface-2, color/text (redesign/text-on-light),
 * color/muted (redesign/muted-on-light). Accent cam-đỏ #C23A22 (bản gốc #D9492F trượt AA; chữ accent trên nền tối #FF8066).
 * Lỗi #B4123F (sáng) / #FF6B81 (tối); chữ nhạt sáng #5F6B75. Nền, chữ, đường kẻ giữ nguyên bản gốc.
 * Tùy chỉnh của người dùng (Appearance) vẫn override lên trên các giá trị này.
 */
export const palettes: Record<ColorSchemeName, ColorTokens> = {
  light: {
    bg: "#F6F6F8",
    surface: "#FFFFFF",
    surfaceMuted: "#ECECEF",
    ink: "#18181B",
    inkMuted: "#616169",
    inkSubtle: "#5F6B75",
    line: "#E4E6E9",
    controlBorder: "#8A8A93",
    cage: "#20252B",
    lotus: "#C23A22",
    cta: "#C23A22",
    onCta: "#FFFFFF",
    ring: "#C23A22",
    danger: "#B4123F",
    dangerSoft: "#FFEDF1",
    warning: "#7A4F00",
    warningSoft: "#FFF3D9",
    success: "#21664B",
    successSoft: "#E0EEE7",
    disabledFill: "#ECECEF",
    disabledInk: "#8A8A93",
    info: "#1B5FB8",
    infoSoft: "#E4ECF6",
    tabActive: "#C23A22",
    tabPill: "#F9EBE9",
    skeletonBase: "#ECECEF",
    skeletonHighlight: "#F6F6F8",
  },
  dark: {
    bg: "#0A0A0C",
    surface: "#16161A",
    surfaceMuted: "#1E1E24",
    ink: "#F4F4F5",
    inkMuted: "#A1A1AA",
    inkSubtle: "#8A8A94",
    line: "#303038",
    controlBorder: "#6A6A74",
    cage: "#24242C",
    lotus: "#FF8066",
    cta: "#C23A22",
    onCta: "#FFFFFF",
    ring: "#FF8066",
    danger: "#FF6B81",
    dangerSoft: "#331A21",
    warning: "#FFB020",
    warningSoft: "#33280F",
    success: "#6BC48F",
    successSoft: "#163022",
    disabledFill: "#24242C",
    disabledInk: "#6E6E78",
    info: "#6EB5FF",
    infoSoft: "#1A2533",
    tabActive: "#FF8066",
    tabPill: "#3B2726",
    skeletonBase: "#1E1E24",
    skeletonHighlight: "#26262D",
  },
};

/** OLED preset: dark tokens on pure black. */
export const trueBlackPalette: ColorTokens = {
  ...palettes.dark,
  bg: "#000000",
  surface: "#101013",
};
