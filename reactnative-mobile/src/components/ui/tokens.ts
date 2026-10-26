/** Raw values for props that cannot take a className (ActivityIndicator color, placeholderTextColor). Keep in sync with tailwind.config.js. */
export const uiColors = {
  background: "#0B0B0D",
  surface: "#141417",
  surfaceElevated: "#1C1C21",
  border: "#2A2A31",
  text: "#F4F4F5",
  muted: "#9A9AA5",
  primary: "#F97316",
  success: "#22C55E",
  warning: "#F59E0B",
  danger: "#EF4444",
  info: "#3B82F6",
} as const;

export const uiMotion = {
  pressMs: 150,
  pressScale: 0.98,
  enterMs: 250,
  enterOffsetY: 8,
  pulseMs: 800,
} as const;

export type StatusTone = "success" | "warning" | "danger" | "info";

export const tabularNums = { fontVariant: ["tabular-nums" as const] };

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}
