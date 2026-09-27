import { memo, useEffect, useMemo } from "react";

import { vi } from "@/i18n/vi";
import { splash } from "@/theme/splash";
import { fonts } from "@/theme/typography";
import { FACE_FILLS } from "./splash-glass-mesh";

/**
 * Legacy asset path retained for splash diagnostics only.
 * Fracture Title lockup does **not** render brand-mark.png.
 */
export const BRAND_MARK_ASSET = "assets/splash/brand-mark.png";
export const BRAND_MARK_EXISTS = false;
/** Poster no longer mounts the PNG lockup. */
export const FRACTURE_TITLE_USES_BRAND_MARK = false;

/**
 * Backup sheet only — frosted milky pane. Facet polygons use FACE_FILLS; this must
 * not paint a unifying Rect over every cell.
 */
export const POSTER_SHEET_BG = splash.glassFillColor;
const SHEET_BG = POSTER_SHEET_BG;
const TITLE_INK = "#090A0C";

const LINE_MMA = vi.brand.wordmarkAcronym.toUpperCase();
const LINE_VISION = vi.brand.wordmarkLockup.toUpperCase();

export const WORDMARK_FONT = fonts.displayBlack;
export const WORDMARK_FONT_FALLBACK = fonts.displayExtraBold;
export const BRAND_ABOVE_CRACKS = false;
/** @deprecated Live HUD is no longer clipped inside shards. */
export const BRAND_IN_CLIP = false;
export const CRACKS_OVER_GLYPHS = true;

const BRAND_MARGIN = 24;
const TITLE_TRACK = 4.2;
const SLIT_H = 2;
const BAR_WIDTH_RATIO = 0.42;
const LABEL_SIZE = 11;

let landingMarksLogged = false;

function estimateLineWidth(text: string, size: number, track: number): number {
  const n = text.length;
  return n * size * 0.52 + track * Math.max(0, n - 1);
}

export function splashBrandFlags(layout?: {
  titleSize?: number;
  brandClipped?: boolean;
  wordmarkOnScreen?: boolean;
  overlayW?: number;
  brandCx?: number;
}): Record<string, boolean | number | string> {
  return {
    brandAboveCracks: BRAND_ABOVE_CRACKS,
    brandInClip: BRAND_IN_CLIP,
    cracksOverGlyphs: CRACKS_OVER_GLYPHS,
    fractureTitle: true,
    brandMarkPrimary: FRACTURE_TITLE_USES_BRAND_MARK,
    titleSize: layout?.titleSize ?? 56,
    font: WORDMARK_FONT,
    brandClipped: layout?.brandClipped ?? false,
    wordmarkOnScreen: layout?.wordmarkOnScreen ?? true,
    textAnchor: "middle",
    margin: BRAND_MARGIN,
  };
}

export function fractureTitleLayout(width: number, height: number) {
  const overlayW = width;
  const brandCx = overlayW / 2;
  const maxLine = Math.max(48, overlayW - BRAND_MARGIN * 2);
  const rawSize = Math.min(64, Math.max(44, overlayW * 0.155));
  const mmaW = estimateLineWidth(LINE_MMA, rawSize, TITLE_TRACK);
  const visionW = estimateLineWidth(LINE_VISION, rawSize, TITLE_TRACK);
  const fit = Math.max(mmaW, visionW) > maxLine ? maxLine / Math.max(mmaW, visionW) : 1;
  const titleSize = rawSize * fit;
  const lineGap = titleSize * 0.12;
  const blockH = titleSize * 2 + lineGap + SLIT_H;
  const titleTop = height * 0.34 - blockH / 2;
  const mmaY = titleTop + titleSize * 0.78;
  const slitY = titleTop + titleSize + lineGap / 2;
  const visionY = slitY + SLIT_H + lineGap / 2 + titleSize * 0.78;
  const barW = overlayW * BAR_WIDTH_RATIO;
  const barX = brandCx - barW / 2;
  const labelY = visionY + titleSize * 0.55;
  const barY = labelY + LABEL_SIZE * 0.9;
  const slitW = Math.min(overlayW * 0.28, Math.max(mmaW, visionW) * fit * 0.55);
  return {
    overlayW,
    brandCx,
    titleSize,
    mmaY,
    visionY,
    slitY,
    slitX: brandCx - slitW / 2,
    slitW,
    barX,
    barY,
    barW,
    labelY,
    brandClipped: false,
    wordmarkOnScreen: true,
  };
}

/** @deprecated Prefer fractureTitleLayout — kept for mesh diagnostics. */
export function brandLayout(width: number, height: number, _punchX: number) {
  const layout = fractureTitleLayout(width, height);
  return {
    overlayW: layout.overlayW,
    brandCx: layout.brandCx,
    markCy: layout.mmaY,
    markX: layout.brandCx,
    markY: layout.mmaY,
    wordmarkX: layout.brandCx,
    wordmarkY: layout.visionY,
    wordmarkSize: layout.titleSize,
    wordmarkTrack: TITLE_TRACK,
    wordmarkW: layout.barW,
    punchX: _punchX,
    offsetApplied: false as const,
    brandClipped: layout.brandClipped,
    wordmarkOnScreen: layout.wordmarkOnScreen,
    margin: BRAND_MARGIN,
    font: WORDMARK_FONT,
  };
}

/**
 * Legacy Fracture Title helpers (layout / diagnostics).
 * Live hold poster is `SplashHudOverlay` — mounted once above the crack mesh,
 * not clipped inside FacetShard hosts.
 */
export const SplashLandingMarks = memo(function SplashLandingMarks({
  width,
  height,
  hostId = "poster",
}: {
  width: number;
  height: number;
  originX?: number;
  originY?: number;
  insetTop?: number;
  hostId?: string;
  /** @deprecated Hold HUD no longer mounts per-shard progress. */
  loadProgress?: number;
  /** @deprecated Hold HUD no longer mounts per-shard progress. */
  showHoldProgress?: boolean;
}) {
  const layout = useMemo(() => fractureTitleLayout(width, height), [height, width]);
  const notBlack = SHEET_BG.toLowerCase() !== "#090a0c" && SHEET_BG.toLowerCase() !== "#000000";

  useEffect(() => {
    if (!(width > 0 && height > 0)) return;
    if (landingMarksLogged) return;
    landingMarksLogged = true;
    console.log(
      "[splash] landingMarks built",
      "landingKind",
      "legacyFractureTitle",
      "liveOverlay",
      "SplashHudOverlay",
      "brandMarkPrimary",
      FRACTURE_TITLE_USES_BRAND_MARK,
      "brand-mark path exists",
      BRAND_MARK_EXISTS,
      "brand-mark",
      BRAND_MARK_ASSET,
      "pngOnGlass",
      false,
      "slogan",
      false,
      "FACE_FILLS count",
      FACE_FILLS.length,
      "sheet",
      SHEET_BG,
      "notBlack",
      notBlack,
      "ink",
      TITLE_INK,
      "crimsonSlit",
      splash.crimson,
      "hostId",
      hostId,
      "W",
      width,
      "H",
      height,
      "fontFamily",
      WORDMARK_FONT,
      ...Object.entries(splashBrandFlags(layout)).flat(),
    );
  }, [height, hostId, layout, notBlack, width]);

  // No longer painted inside shards — HUD lives in SplashHudOverlay.
  return null;
});
