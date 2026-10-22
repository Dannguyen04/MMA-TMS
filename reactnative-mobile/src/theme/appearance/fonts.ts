import { BarlowCondensed_600SemiBold } from "@expo-google-fonts/barlow-condensed/600SemiBold";
import { BarlowCondensed_700Bold } from "@expo-google-fonts/barlow-condensed/700Bold";
import { BarlowCondensed_800ExtraBold } from "@expo-google-fonts/barlow-condensed/800ExtraBold";
import { BarlowCondensed_900Black } from "@expo-google-fonts/barlow-condensed/900Black";
import { BeVietnamPro_400Regular } from "@expo-google-fonts/be-vietnam-pro/400Regular";
import { BeVietnamPro_700Bold } from "@expo-google-fonts/be-vietnam-pro/700Bold";
import { IBMPlexSans_400Regular } from "@expo-google-fonts/ibm-plex-sans/400Regular";
import { IBMPlexSans_500Medium } from "@expo-google-fonts/ibm-plex-sans/500Medium";
import { IBMPlexSans_600SemiBold } from "@expo-google-fonts/ibm-plex-sans/600SemiBold";
import { IBMPlexSans_700Bold } from "@expo-google-fonts/ibm-plex-sans/700Bold";
import { Inter_400Regular } from "@expo-google-fonts/inter/400Regular";
import { Inter_700Bold } from "@expo-google-fonts/inter/700Bold";
import { Lexend_400Regular } from "@expo-google-fonts/lexend/400Regular";
import { Lexend_700Bold } from "@expo-google-fonts/lexend/700Bold";
import { Literata_400Regular } from "@expo-google-fonts/literata/400Regular";
import { Literata_700Bold } from "@expo-google-fonts/literata/700Bold";
import { NotoSans_400Regular } from "@expo-google-fonts/noto-sans/400Regular";
import { NotoSans_700Bold } from "@expo-google-fonts/noto-sans/700Bold";
import { SourceSerif4_400Regular } from "@expo-google-fonts/source-serif-4/400Regular";
import { SourceSerif4_700Bold } from "@expo-google-fonts/source-serif-4/700Bold";
import * as Font from "expo-font";

import type { FontFamilyId } from "./settings";

/**
 * Per-weight subpath imports keep Metro from bundling every weight in each
 * package (the package root `require`s all of them). All sources are local
 * assets — never pass a remote URI to `loadAsync` here (offline requirement).
 */

export type FaceSlot = "regular" | "medium" | "semibold" | "bold";
export type FontFaces = Record<FaceSlot, string>;

type BodyFontDef = {
  label: string;
  serif: boolean;
  faces: FontFaces;
  sources: Record<string, number>;
};

function twoWeights(regular: string, bold: string, regularSrc: number, boldSrc: number) {
  return {
    faces: { regular, medium: regular, semibold: bold, bold },
    sources: { [regular]: regularSrc, [bold]: boldSrc },
  };
}

export const BODY_FONTS: Record<FontFamilyId, BodyFontDef> = {
  ibmPlexSans: {
    label: "IBM Plex Sans",
    serif: false,
    faces: {
      regular: "IBMPlexSans_400Regular",
      medium: "IBMPlexSans_500Medium",
      semibold: "IBMPlexSans_600SemiBold",
      bold: "IBMPlexSans_700Bold",
    },
    sources: {
      IBMPlexSans_400Regular,
      IBMPlexSans_500Medium,
      IBMPlexSans_600SemiBold,
      IBMPlexSans_700Bold,
    },
  },
  inter: {
    label: "Inter",
    serif: false,
    ...twoWeights("Inter_400Regular", "Inter_700Bold", Inter_400Regular, Inter_700Bold),
  },
  beVietnamPro: {
    label: "Be Vietnam Pro",
    serif: false,
    ...twoWeights(
      "BeVietnamPro_400Regular",
      "BeVietnamPro_700Bold",
      BeVietnamPro_400Regular,
      BeVietnamPro_700Bold,
    ),
  },
  notoSans: {
    label: "Noto Sans",
    serif: false,
    ...twoWeights("NotoSans_400Regular", "NotoSans_700Bold", NotoSans_400Regular, NotoSans_700Bold),
  },
  literata: {
    label: "Literata",
    serif: true,
    ...twoWeights("Literata_400Regular", "Literata_700Bold", Literata_400Regular, Literata_700Bold),
  },
  sourceSerif4: {
    label: "Source Serif 4",
    serif: true,
    ...twoWeights(
      "SourceSerif4_400Regular",
      "SourceSerif4_700Bold",
      SourceSerif4_400Regular,
      SourceSerif4_700Bold,
    ),
  },
  lexend: {
    label: "Lexend",
    serif: false,
    ...twoWeights("Lexend_400Regular", "Lexend_700Bold", Lexend_400Regular, Lexend_700Bold),
  },
};

export const DEFAULT_FONT_FAMILY: FontFamilyId = "ibmPlexSans";

/** Brand display faces plus the default body family; loaded before the splash can hide. */
export const CORE_FONT_SOURCES: Record<string, number> = {
  BarlowCondensed_600SemiBold,
  BarlowCondensed_700Bold,
  BarlowCondensed_800ExtraBold,
  BarlowCondensed_900Black,
  ...BODY_FONTS.ibmPlexSans.sources,
};

export function isFamilyLoaded(id: FontFamilyId): boolean {
  return Object.keys(BODY_FONTS[id].sources).every((name) => Font.isLoaded(name));
}

/** Resolves `true` when every face of the family is usable. */
export async function loadFamily(id: FontFamilyId): Promise<boolean> {
  if (isFamilyLoaded(id)) return true;
  try {
    await Font.loadAsync(BODY_FONTS[id].sources);
    return true;
  } catch {
    return false;
  }
}

export async function loadCoreFonts(): Promise<boolean> {
  try {
    await Font.loadAsync(CORE_FONT_SOURCES);
    return true;
  } catch {
    return false;
  }
}
