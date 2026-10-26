import { palettes, type ColorTokens } from "./colors";

function hexToRgb(hex: string): [number, number, number] {
  const raw = hex.replace("#", "");
  const full =
    raw.length === 3
      ? raw
          .split("")
          .map((ch) => ch + ch)
          .join("")
      : raw;
  const n = Number.parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function toHex(value: number) {
  return value.toString(16).padStart(2, "0");
}

export function lerpHex(from: string, to: string, t: number): string {
  const clamped = Math.min(1, Math.max(0, t));
  const [fr, fg, fb] = hexToRgb(from);
  const [tr, tg, tb] = hexToRgb(to);
  const r = Math.round(fr + (tr - fr) * clamped);
  const g = Math.round(fg + (tg - fg) * clamped);
  const b = Math.round(fb + (tb - fb) * clamped);
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function lerpTokens(from: ColorTokens, to: ColorTokens, t: number): ColorTokens {
  const next = { ...to };
  (Object.keys(from) as (keyof ColorTokens)[]).forEach((key) => {
    const a = from[key];
    const b = to[key];
    if (a && b) next[key] = lerpHex(a, b, t);
  });
  return next;
}

export function relativeLuminance(hex: string): number {
  const channel = (value: number) => {
    const s = value / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const [r, g, b] = hexToRgb(hex);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

const chromeMidLuminance = relativeLuminance(
  lerpHex(palettes.light.bg, palettes.dark.bg, 0.5),
);

/** Light status/nav icons once interpolated bg crosses the theme lerp midpoint. */
export function chromeLightIcons(bg: string): boolean {
  return relativeLuminance(bg) < chromeMidLuminance;
}
