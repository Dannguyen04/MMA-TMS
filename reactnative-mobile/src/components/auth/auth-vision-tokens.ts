import { palettes, type ColorSchemeName } from "@/theme/colors";
import { fonts } from "@/theme/typography";

/**
 * Auth colors come from the DEFAULT palette (Figma tokens), never the saved
 * Appearance: before sign-in there is no owner, and a shared device must not
 * show the previous user's theme. Light/dark follows the system.
 */
export type AuthColors = {
  canvas: string;
  surface: string;
  ink: string;
  muted: string;
  line: string;
  accent: string;
  field: string;
  fieldBorder: string;
  fieldFocus: string;
  /** Soft red fill for a field in error (text below carries the message). */
  fieldError: string;
  /** Focused input: a soft tint of the brand accent instead of a border. */
  fieldActive: string;
  buttonOn: string;
  buttonOnText: string;
  buttonOff: string;
  buttonOffText: string;
  danger: string;
  dark: boolean;
};

export function authPalette(scheme: ColorSchemeName): AuthColors {
  const p = palettes[scheme];
  return {
    canvas: p.bg,
    surface: p.surface,
    ink: p.ink,
    muted: p.inkMuted,
    line: p.line,
    accent: p.lotus,
    field: p.surfaceMuted,
    fieldBorder: p.controlBorder,
    fieldFocus: p.ring,
    fieldError: p.dangerSoft,
    fieldActive: `${p.lotus}24`,
    buttonOn: p.cta,
    buttonOnText: p.onCta,
    buttonOff: p.disabledFill,
    buttonOffText: p.disabledInk,
    danger: p.danger,
    dark: scheme === "dark",
  };
}

/** System scheme only (no saved Appearance). */
/** Auth screens (login/register/forgot/reset) keep one fixed dark look whatever the app or system theme. */
export function useAuthColors(): AuthColors {
  return authPalette("dark");
}

/** Kept for callers that need a static dark value (status bar fallbacks). */
export const authDark = authPalette("dark");

/** Default bundled faces. These do not follow the user's saved font, scale, or accent. */
export const authType = {
  title: { fontFamily: fonts.uiBold, fontSize: 28, lineHeight: 34 },
  lead: { fontFamily: fonts.ui, fontSize: 15, lineHeight: 23 },
  body: { fontFamily: fonts.ui, fontSize: 16, lineHeight: 22 },
  label: { fontFamily: fonts.uiSemi, fontSize: 14, lineHeight: 20 },
  caption: { fontFamily: fonts.ui, fontSize: 12, lineHeight: 17 },
  link: { fontFamily: fonts.uiSemi, fontSize: 14, lineHeight: 20 },
  wordmark: { fontFamily: fonts.uiBold, fontSize: 16, lineHeight: 22 },
  cta: { fontFamily: fonts.uiSemi, fontSize: 16, lineHeight: 22 },
} as const;

/** Phone-width auth column. Wider windows center this; they do not stretch the form. */
export const AUTH_CANVAS_MAX_WIDTH = 430;

export function authCanvasSize(windowWidth: number, windowHeight: number): { width: number; height: number } {
  const width = Math.min(Math.max(windowWidth, 0), AUTH_CANVAS_MAX_WIDTH);
  const height = Math.max(windowHeight, 0);
  return { width, height };
}

const VISION_LEAVES = new Set(["login", "register", "forgot-password"]);

/** Login, enter-email, enter-code, and forgot-password. Unknown group leaves stay dark too. */
export function isVisionAuthLeaf(leaf: string | undefined): boolean {
  return leaf == null || leaf === "(auth)" || VISION_LEAVES.has(leaf);
}

/** Auth canvas ignores the saved background: default palette for the system scheme. */
export function visionAuthCanvas(leaf: string | undefined, savedBackground: string, scheme: ColorSchemeName = "dark"): string {
  void leaf;
  void savedBackground;
  return authPalette(scheme).canvas;
}
