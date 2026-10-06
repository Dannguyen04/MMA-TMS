import { lerpHex, relativeLuminance } from "../interpolate-tokens";

export const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;

export const CONTRAST_BODY = 4.5;
export const CONTRAST_LARGE = 3;

/** Accepts `#RGB`, `RGB`, `#RRGGBB`, `RRGGBB`; returns `#RRGGBB` uppercase or null. */
export function normalizeHex(input: string): string | null {
  const raw = input.trim().replace(/^#/, "");
  if (/^[0-9A-Fa-f]{3}$/.test(raw)) {
    return `#${raw
      .split("")
      .map((ch) => ch + ch)
      .join("")
      .toUpperCase()}`;
  }
  if (/^[0-9A-Fa-f]{6}$/.test(raw)) return `#${raw.toUpperCase()}`;
  return null;
}

/** WCAG 2.x contrast ratio. Never round before comparing against a threshold. */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

export function isDarkColor(hex: string): boolean {
  return contrastRatio(hex, "#FFFFFF") > contrastRatio(hex, "#000000");
}

export function mixHex(from: string, to: string, t: number): string {
  return lerpHex(from, to, t).toUpperCase();
}

/** Black or white, whichever reads better on `bg`. */
export function bestOnColor(bg: string): string {
  return isDarkColor(bg) ? "#FFFFFF" : "#000000";
}

/**
 * Moves `fg` toward black or white (whichever increases contrast with `bg`)
 * in small steps until `min` is met. Returns the extreme if unreachable.
 */
export function ensureContrast(fg: string, bg: string, min: number): string {
  if (contrastRatio(fg, bg) >= min) return fg.toUpperCase();
  const target = bestOnColor(bg);
  for (let step = 1; step <= 20; step += 1) {
    const next = mixHex(fg, target, step / 20);
    if (contrastRatio(next, bg) >= min) return next;
  }
  return target;
}

/** WCAG large text: ≥ 18pt (24px) regular or ≥ 14pt (≈18.66px) bold. */
export function isLargeText(fontSizePx: number, bold: boolean): boolean {
  return fontSizePx >= 24 || (bold && fontSizePx >= 18.66);
}

export type Hsv = { h: number; s: number; v: number };

function hexChannels(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function hexToHsv(hex: string): Hsv {
  const [r, g, b] = hexChannels(hex).map((c) => c / 255) as [number, number, number];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: max === 0 ? 0 : (d / max) * 100, v: max * 100 };
}

export function hsvToHex({ h, s, v }: Hsv): string {
  const sat = Math.min(100, Math.max(0, s)) / 100;
  const val = Math.min(100, Math.max(0, v)) / 100;
  const hue = ((h % 360) + 360) % 360;
  const c = val * sat;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = val - c;
  const [r1, g1, b1] =
    hue < 60
      ? [c, x, 0]
      : hue < 120
        ? [x, c, 0]
        : hue < 180
          ? [0, c, x]
          : hue < 240
            ? [0, x, c]
            : hue < 300
              ? [x, 0, c]
              : [c, 0, x];
  const hex = (n: number) =>
    Math.round((n + m) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${hex(r1)}${hex(g1)}${hex(b1)}`.toUpperCase();
}
