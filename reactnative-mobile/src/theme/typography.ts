import type { StyleSheet, TextStyle } from "react-native";

export const fonts = {
  display: "BarlowCondensed_700Bold",
  displayBlack: "BarlowCondensed_900Black",
  displayExtraBold: "BarlowCondensed_800ExtraBold",
  displaySemi: "BarlowCondensed_600SemiBold",
  ui: "IBMPlexSans_400Regular",
  uiMedium: "IBMPlexSans_500Medium",
  uiSemi: "IBMPlexSans_600SemiBold",
  uiBold: "IBMPlexSans_700Bold",
} as const;

/** Vietnamese diacritics need extra leading. Never set UI lineHeight below this. */
export function viLineHeight(fontSize: number) {
  return Math.ceil(fontSize * 1.35);
}

export type BodyFaceSlot = "regular" | "medium" | "semibold" | "bold";

/**
 * Resolved typography settings that drive body/content text. Headings keep the
 * Barlow Condensed brand face; only their size follows `sizeFactor`.
 */
export type LiveTypography = {
  faces: Record<BodyFaceSlot, string>;
  /** Effective in-app multiplier (already capped against the OS text scale). */
  sizeFactor: number;
  /** Line height as a multiple of font size; floored by `viLineHeight`. */
  lineHeight: number;
  /** Extra tracking in em, added to each role's own letter spacing. */
  letterSpacingEm: number;
  bold: boolean;
};

export const DEFAULT_LIVE_TYPOGRAPHY: LiveTypography = {
  faces: {
    regular: fonts.ui,
    medium: fonts.uiMedium,
    semibold: fonts.uiSemi,
    bold: fonts.uiBold,
  },
  sizeFactor: 1,
  lineHeight: 1.35,
  letterSpacingEm: 0,
  bold: false,
};

export type ContentRole = "body" | "label" | "link" | "caption" | "cta";

export const contentRoles: Record<
  ContentRole,
  { slot: BodyFaceSlot; fontSize: number; letterSpacing: number }
> = {
  body: { slot: "regular", fontSize: 16, letterSpacing: 0 },
  label: { slot: "medium", fontSize: 13, letterSpacing: 0 },
  link: { slot: "medium", fontSize: 14, letterSpacing: 0 },
  caption: { slot: "regular", fontSize: 12, letterSpacing: 0 },
  cta: { slot: "semibold", fontSize: 16, letterSpacing: 0.2 },
};

export type ContentTextStyle = {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  letterSpacing: number;
};

export type TitleTextStyle = ContentTextStyle & { textTransform: "uppercase" };

function scaledSize(base: number, factor: number) {
  return factor === 1 ? base : Math.round(base * factor * 10) / 10;
}

export function contentTextStyle(role: ContentRole, live: LiveTypography): ContentTextStyle {
  const def = contentRoles[role];
  const fontSize = scaledSize(def.fontSize, live.sizeFactor);
  const slot = live.bold ? "bold" : def.slot;
  return {
    fontFamily: live.faces[slot],
    fontSize,
    lineHeight: Math.max(viLineHeight(fontSize), Math.ceil(fontSize * live.lineHeight)),
    letterSpacing: def.letterSpacing + Math.round(live.letterSpacingEm * fontSize * 100) / 100,
  };
}

export function titleTextStyle(live: LiveTypography): TitleTextStyle {
  const fontSize = scaledSize(22, live.sizeFactor);
  return {
    fontFamily: fonts.displaySemi,
    fontSize,
    letterSpacing: 0.4,
    lineHeight: viLineHeight(fontSize),
    textTransform: "uppercase",
  };
}

type LiveStyles = { title: TitleTextStyle } & Record<ContentRole, ContentTextStyle>;

function buildLiveStyles(live: LiveTypography): LiveStyles {
  return {
    title: titleTextStyle(live),
    body: contentTextStyle("body", live),
    label: contentTextStyle("label", live),
    link: contentTextStyle("link", live),
    caption: contentTextStyle("caption", live),
    cta: contentTextStyle("cta", live),
  };
}

let liveStyles = buildLiveStyles(DEFAULT_LIVE_TYPOGRAPHY);
let currentTypography = DEFAULT_LIVE_TYPOGRAPHY;

/** Legacy role components use getters so reading preferences are never snapshotted. */
export function readableTextStyle(base: number, bold = false): ContentTextStyle {
  return textStyleWith(currentTypography, base, bold);
}

/** Same as `readableTextStyle`, for an explicit typography (the appearance preview draws from the unsaved draft). */
export function textStyleWith(live: LiveTypography, base: number, bold = false): ContentTextStyle {
  const fontSize = scaledSize(base, live.sizeFactor);
  return { fontFamily: live.faces[bold ? "bold" : "regular"], fontSize,
    lineHeight: Math.max(viLineHeight(fontSize), Math.ceil(fontSize * live.lineHeight)),
    letterSpacing: live.letterSpacingEm * fontSize };
}

/**
 * Called by the appearance provider during render, before its children render,
 * so existing `type.body`-style call sites pick up the applied typography on
 * their next render. Module-level `StyleSheet.create` snapshots are not updated.
 */
export function setLiveTypography(live: LiveTypography) {
  currentTypography = live;
  liveStyles = buildLiveStyles(live);
}

/** Big display numbers and headings grow half as fast, so a large text setting does not blow up cards. */
const DISPLAY_FROM = 24;

function displayFactor(base: number, factor: number) {
  return base >= DISPLAY_FROM ? 1 + (factor - 1) / 2 : factor;
}

/**
 * A fixed design size that follows the saved text-size setting. Read during render (or inside `liveSheet`),
 * so the whole app changes the moment the setting is saved instead of after a restart. `max` caps text that
 * shares a fixed width with its neighbours (five tab labels across a phone).
 */
export function fz(base: number, max = Infinity): number {
  return Math.min(fzWith(currentTypography, base), max);
}

/** `fz` for an explicit typography (the appearance preview draws from the unsaved draft). */
export function fzWith(live: Pick<LiveTypography, "sizeFactor">, base: number): number {
  return scaledSize(base, displayFactor(base, live.sizeFactor));
}

/** The line height paired with a `fz` size; scales with it so larger text is never clipped. */
export function lh(base: number, max = Infinity): number {
  return Math.min(lhWith(currentTypography, base), max);
}

/** `lh` for an explicit typography. */
export function lhWith(live: Pick<LiveTypography, "sizeFactor">, base: number): number {
  const f = live.sizeFactor;
  return f === 1 ? base : Math.ceil(base * displayFactor(base, f));
}

/**
 * `StyleSheet.create` replacement for sheets that hold text sizes: the factory reruns whenever the applied
 * typography changes, so module-level styles stay live too.
 */
export function liveSheet<T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(
  factory: () => T & StyleSheet.NamedStyles<any>,
): T {
  let builtFor: LiveTypography | null = null;
  let sheet = {} as T;
  const current = () => {
    if (builtFor !== currentTypography) {
      builtFor = currentTypography;
      sheet = factory();
    }
    return sheet;
  };
  return new Proxy({} as T, {
    get: (_t, key) => current()[key as keyof T],
    has: (_t, key) => key in current(),
    ownKeys: () => Reflect.ownKeys(current()),
    getOwnPropertyDescriptor: (_t, key) => {
      const d = Reflect.getOwnPropertyDescriptor(current(), key);
      return d ? { ...d, configurable: true } : undefined;
    },
  });
}

export const type = {
  wordmark: {
    fontFamily: fonts.display,
    fontSize: 34,
    letterSpacing: 1.2,
    lineHeight: viLineHeight(34),
    textTransform: "uppercase",
  },
  wordmarkAcronym: {
    fontFamily: fonts.display,
    fontSize: 44,
    letterSpacing: 1.6,
    lineHeight: 52,
    textTransform: "uppercase",
  },
  wordmarkLockup: {
    fontFamily: fonts.displaySemi,
    fontSize: 11,
    letterSpacing: 1.6,
    lineHeight: viLineHeight(11),
    marginTop: 6,
    textTransform: "uppercase",
  },
  wordmarkExpansion: {
    fontFamily: fonts.uiMedium,
    fontSize: 12,
    letterSpacing: 2.4,
    lineHeight: viLineHeight(12),
    textTransform: "uppercase",
  },
  wordmarkAcronymCompact: {
    fontFamily: fonts.display,
    fontSize: 28,
    letterSpacing: 1.2,
    lineHeight: 36,
    textTransform: "uppercase",
  },
  wordmarkLockupCompact: {
    fontFamily: fonts.displaySemi,
    fontSize: 9,
    letterSpacing: 1.4,
    lineHeight: viLineHeight(9),
    marginTop: 3,
    textTransform: "uppercase",
  },
  wordmarkExpansionCompact: {
    fontFamily: fonts.uiMedium,
    fontSize: 10,
    letterSpacing: 1.8,
    lineHeight: viLineHeight(10),
    textTransform: "uppercase",
  },
  academy: {
    fontFamily: fonts.uiMedium,
    fontSize: 13,
    letterSpacing: 0.6,
    lineHeight: viLineHeight(13),
  },
  get title(): TitleTextStyle {
    return liveStyles.title;
  },
  get body(): ContentTextStyle {
    return liveStyles.body;
  },
  get label(): ContentTextStyle {
    return liveStyles.label;
  },
  get link(): ContentTextStyle {
    return liveStyles.link;
  },
  get caption(): ContentTextStyle {
    return liveStyles.caption;
  },
  get cta(): ContentTextStyle {
    return liveStyles.cta;
  },
} as const satisfies Record<string, TextStyle>;
