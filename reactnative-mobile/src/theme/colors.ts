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
  success: string;
  successSoft: string;
  disabledFill: string;
  disabledInk: string;
};

export const palettes: Record<ColorSchemeName, ColorTokens> = {
  light: {
    bg: "#E8E6E1",
    surface: "#F6F5F2",
    surfaceMuted: "#DEDBD4",
    ink: "#121316",
    inkMuted: "#5C5E66",
    inkSubtle: "#62646C",
    line: "#C9C6BE",
    controlBorder: "#7E7B74",
    cage: "#1C1E22",
    lotus: "#735A30",
    cta: "#16181C",
    onCta: "#F6F5F2",
    ring: "#8F7040",
    danger: "#C42B32",
    dangerSoft: "#F8E6E7",
    success: "#1F6B3A",
    successSoft: "#E4F3E9",
    disabledFill: "#D4D1CA",
    disabledInk: "#8A8C92",
  },
  dark: {
    bg: "#090A0C",
    surface: "#14161A",
    surfaceMuted: "#1C1F24",
    ink: "#F3F1EC",
    inkMuted: "#A8ABB3",
    inkSubtle: "#7E8188",
    line: "#2A2E35",
    controlBorder: "#6A6E76",
    cage: "#D4C4A0",
    lotus: "#C9A86C",
    cta: "#C9A86C",
    onCta: "#121316",
    ring: "#D4B57A",
    danger: "#E85A62",
    dangerSoft: "#3A181B",
    success: "#6BC48F",
    successSoft: "#163022",
    disabledFill: "#2A2D33",
    disabledInk: "#6E7178",
  },
};

/** OLED preset: dark tokens on pure black. */
export const trueBlackPalette: ColorTokens = {
  ...palettes.dark,
  bg: "#000000",
  surface: "#0E0F11",
};
