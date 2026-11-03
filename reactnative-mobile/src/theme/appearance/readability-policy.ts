import { DEFAULT_SETTINGS, snapNumber, type AppliedAppearance, type NumericSettingKey } from "./settings";

export const READING_CONTROLS: readonly NumericSettingKey[] = ["fontScale", "letterSpacing", "lineHeight"];

/** Retire legacy palette/layout/font overrides at the provider boundary, for every role. */
export function simplifyAppearance(value: AppliedAppearance): AppliedAppearance {
  const old = value.settings;
  const mode = old.mode === "trueBlack" ? "dark" : old.mode === "light" || old.mode === "dark" ? old.mode : "system";
  const number = (key: NumericSettingKey) => Number.isFinite(old[key]) ? snapNumber(key, old[key]) : DEFAULT_SETTINGS[key];
  return { presetId: "system", settings: { ...DEFAULT_SETTINGS, mode,
    fontScale: number("fontScale"), letterSpacing: number("letterSpacing"), lineHeight: number("lineHeight") } };
}
