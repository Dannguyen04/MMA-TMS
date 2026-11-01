/// <reference types="jest" />
import { DEFAULT_SETTINGS, parseStoredAppearance, serializeAppearance } from "./settings";
import { simplifyAppearance } from "./readability-policy";
import { buildColors } from "./tokens";

describe("one reading policy for every mobile role", () => {
  it("migrates an old fixed palette without letting it lock the light/dark switch", () => {
    const old = parseStoredAppearance(JSON.stringify({ version: 4, presetId: "synthetic", overrides: {
      mode: "system", fontScale: 1.25, lineHeight: 1.6, letterSpacing: 0.04,
      backgroundColor: "#FFFFFF", accentColor: "#00FF00", fontFamily: "literata", density: "compact",
    } }), null).applied;
    const migrated = simplifyAppearance(old);
    expect(migrated.settings).toEqual({ ...DEFAULT_SETTINGS, fontScale: 1.25, lineHeight: 1.6, letterSpacing: 0.04 });
    expect(buildColors(migrated.settings, "dark").scheme).toBe("dark");
    expect(buildColors(migrated.settings, "light").scheme).toBe("light");
  });
  it("keeps the old OLED choice as ordinary dark and drops custom layout overrides", () => {
    const migrated = simplifyAppearance({ presetId: "paper", settings: { ...DEFAULT_SETTINGS,
      mode: "trueBlack", systemDarkVariant: "trueBlack", radiusScale: "round", density: "spacious" } });
    expect(migrated.settings.mode).toBe("dark");
    expect(migrated.settings.systemDarkVariant).toBe("dark");
    expect(migrated.settings.radiusScale).toBe(DEFAULT_SETTINGS.radiusScale);
    expect(migrated.settings.density).toBe(DEFAULT_SETTINGS.density);
  });
  it("bounds corrupt/extreme numeric settings before a screen renders", () => {
    const migrated = simplifyAppearance({ presetId: "system", settings: { ...DEFAULT_SETTINGS,
      fontScale: Infinity, letterSpacing: -2, lineHeight: 300 } });
    expect(migrated.settings.fontScale).toBe(1);
    expect(migrated.settings.letterSpacing).toBe(0);
    expect(migrated.settings.lineHeight).toBe(1.8);
  });
  it("persists only the supported choices after migration, and round-trips unchanged", () => {
    const applied = simplifyAppearance({ presetId: "paper", settings: { ...DEFAULT_SETTINGS,
      mode: "dark", fontScale: 1.3, lineHeight: 1.5, letterSpacing: 0.02, accentColor: "#00FF00" } });
    const stored = serializeAppearance(applied);
    expect(JSON.parse(stored).overrides).toEqual({ mode: "dark", fontScale: 1.3, lineHeight: 1.5, letterSpacing: 0.02 });
    expect(simplifyAppearance(parseStoredAppearance(stored, null).applied)).toEqual(applied);
  });
});
