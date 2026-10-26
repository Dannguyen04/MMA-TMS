import { fonts } from "@/theme/typography";

/** Fixed dark surfaces for login, enter-email, and enter-code. Not the saved appearance. */
export const authDark = {
  canvas: "#0A0A0C",
  ink: "#F2F2F4",
  muted: "#A9A9B3",
  line: "#44444E",
  gold: "#D5B16B",
  field: "#16161A",
  fieldFill: "rgba(18,18,22,0.82)",
  fieldFillFocus: "rgba(38,38,44,0.94)",
  form: "rgba(12,13,16,0.94)",
  buttonOff: "#33333C",
  buttonOffText: "#ACACB6",
  buttonOnText: "#121316",
  danger: "#F0A8A8",
} as const;

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

/**
 * The four dark auth screens ignore the saved background.
 * `savedBackground` is accepted so callers can prove it is not applied.
 */
export function visionAuthCanvas(leaf: string | undefined, savedBackground: string): string {
  void leaf;
  void savedBackground;
  return authDark.canvas;
}
