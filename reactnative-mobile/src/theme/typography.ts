import type { TextStyle } from "react-native";

export const fonts = {
  display: "BarlowCondensed_700Bold",
  displayBlack: "BarlowCondensed_900Black",
  displayExtraBold: "BarlowCondensed_800ExtraBold",
  displaySemi: "BarlowCondensed_600SemiBold",
  ui: "IBMPlexSans_400Regular",
  uiMedium: "IBMPlexSans_500Medium",
  uiSemi: "IBMPlexSans_600SemiBold",
} as const;

/** Vietnamese diacritics need extra leading. Never set UI lineHeight below this. */
export function viLineHeight(fontSize: number) {
  return Math.ceil(fontSize * 1.35);
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
  title: {
    fontFamily: fonts.displaySemi,
    fontSize: 22,
    letterSpacing: 0.4,
    lineHeight: viLineHeight(22),
    textTransform: "uppercase",
  },
  body: {
    fontFamily: fonts.ui,
    fontSize: 16,
    lineHeight: viLineHeight(16),
  },
  label: {
    fontFamily: fonts.uiMedium,
    fontSize: 13,
    lineHeight: viLineHeight(13),
  },
  link: {
    fontFamily: fonts.uiMedium,
    fontSize: 14,
    lineHeight: viLineHeight(14),
  },
  caption: {
    fontFamily: fonts.ui,
    fontSize: 12,
    lineHeight: viLineHeight(12),
  },
  cta: {
    fontFamily: fonts.uiSemi,
    fontSize: 16,
    letterSpacing: 0.2,
    lineHeight: viLineHeight(16),
  },
} as const satisfies Record<string, TextStyle>;
