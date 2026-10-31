import AsyncStorage from "@react-native-async-storage/async-storage";

import { normalizeHex } from "./color-math";

/** Legacy device-global key. Read once for migration; new writes use a scoped key. */
export const APPEARANCE_STORAGE_KEY = "mma.ui.appearance.v1";
/**
 * Fallback when no authenticated user id exists yet (cold start, logged out).
 * Never copied onto the next account. Logout does not delete a user's key.
 */
export const APPEARANCE_DEVICE_KEY = "mma.ui.appearance.v1.device";
export const APPEARANCE_CORRUPT_KEY = "mma.ui.appearance.corrupt";
/** Legacy bare-string key (`"light" | "dark" | "system"`); read once for migration, never deleted here. */
export const LEGACY_THEME_PREFERENCE_KEY = "mma.ui.themePreference";
export const APPEARANCE_SCHEMA_VERSION = 1;

export type BrightnessMode = "light" | "dark" | "system" | "trueBlack";
export type DarkVariant = "dark" | "trueBlack";
export type FontFamilyId =
  | "ibmPlexSans"
  | "inter"
  | "beVietnamPro"
  | "notoSans"
  | "literata"
  | "sourceSerif4"
  | "lexend";
/** Only Regular and Bold faces are bundled for the added families, so no "light" step. */
export type FontWeightSetting = "regular" | "bold";
export type RadiusScale = "sharp" | "default" | "round";
export type Density = "compact" | "comfortable" | "spacious";

export type AppearanceSettings = {
  mode: BrightnessMode;
  systemDarkVariant: DarkVariant;
  fontFamily: FontFamilyId;
  fontScale: number;
  fontWeight: FontWeightSetting;
  lineHeight: number;
  letterSpacing: number;
  textColor: string | null;
  backgroundColor: string | null;
  surfaceColor: string | null;
  accentColor: string | null;
  radiusScale: RadiusScale;
  density: Density;
};

export const BRIGHTNESS_MODES: readonly BrightnessMode[] = ["light", "dark", "system", "trueBlack"];
export const DARK_VARIANTS: readonly DarkVariant[] = ["dark", "trueBlack"];
export const FONT_FAMILY_IDS: readonly FontFamilyId[] = [
  "ibmPlexSans",
  "inter",
  "beVietnamPro",
  "notoSans",
  "literata",
  "sourceSerif4",
  "lexend",
];
export const FONT_WEIGHTS: readonly FontWeightSetting[] = ["regular", "bold"];
export const RADIUS_SCALES: readonly RadiusScale[] = ["sharp", "default", "round"];
export const DENSITIES: readonly Density[] = ["compact", "comfortable", "spacious"];

export type NumericSettingKey = "fontScale" | "lineHeight" | "letterSpacing";

export const NUMERIC_RANGES: Record<NumericSettingKey, { min: number; max: number; step: number }> = {
  fontScale: { min: 0.85, max: 1.6, step: 0.05 },
  lineHeight: { min: 1.35, max: 1.8, step: 0.05 },
  letterSpacing: { min: 0, max: 0.12, step: 0.01 },
};

/** In-app scale × OS text scale never exceeds this. */
export const MAX_TOTAL_FONT_SCALE = 2;

export const DEFAULT_SETTINGS: AppearanceSettings = {
  mode: "system",
  systemDarkVariant: "dark",
  fontFamily: "ibmPlexSans",
  fontScale: 1,
  fontWeight: "regular",
  lineHeight: 1.35,
  letterSpacing: 0,
  textColor: null,
  backgroundColor: null,
  surfaceColor: null,
  accentColor: null,
  radiusScale: "default",
  density: "comfortable",
};

export type PresetId =
  | "system"
  | "light"
  | "dark"
  | "trueBlack"
  | "paper"
  | "mint"
  | "highContrastLight"
  | "highContrastDark"
  | "largeText"
  | "lowVision"
  | "compact"
  | "readable";

const PAPER_COLORS = {
  mode: "light",
  backgroundColor: "#F4ECD8",
  surfaceColor: "#FBF6EA",
  textColor: "#3B2F20",
  accentColor: "#8A5A1F",
} as const satisfies Partial<AppearanceSettings>;

const HIGH_CONTRAST_LIGHT = {
  mode: "light",
  backgroundColor: "#FFFFFF",
  surfaceColor: "#FFFFFF",
  textColor: "#000000",
  accentColor: "#5E4520",
} as const satisfies Partial<AppearanceSettings>;

export const PRESETS: Record<PresetId, Partial<AppearanceSettings>> = {
  system: { mode: "system" },
  light: { mode: "light" },
  dark: { mode: "dark" },
  trueBlack: { mode: "trueBlack" },
  paper: { ...PAPER_COLORS, fontFamily: "literata" },
  mint: {
    mode: "light",
    backgroundColor: "#E3EFE3",
    surfaceColor: "#F2F8F2",
    textColor: "#13241A",
    accentColor: "#1F6B3A",
  },
  highContrastLight: HIGH_CONTRAST_LIGHT,
  highContrastDark: {
    mode: "dark",
    backgroundColor: "#000000",
    surfaceColor: "#000000",
    textColor: "#FFFFFF",
    accentColor: "#F0D9A8",
  },
  largeText: { fontScale: 1.3, lineHeight: 1.5, density: "spacious" },
  lowVision: { ...HIGH_CONTRAST_LIGHT, fontScale: 1.5, fontWeight: "bold", lineHeight: 1.6 },
  compact: { fontScale: 0.9, density: "compact" },
  readable: { ...PAPER_COLORS, fontFamily: "lexend", letterSpacing: 0.05, lineHeight: 1.6 },
};

export const PRESET_IDS = Object.keys(PRESETS) as PresetId[];

export type AppliedAppearance = {
  presetId: PresetId;
  settings: AppearanceSettings;
};

export const DEFAULT_APPEARANCE: AppliedAppearance = {
  presetId: "system",
  settings: DEFAULT_SETTINGS,
};

export function resolvePreset(presetId: PresetId): AppearanceSettings {
  return { ...DEFAULT_SETTINGS, ...PRESETS[presetId] };
}

function isOneOf<T extends string>(options: readonly T[], value: unknown): value is T {
  return typeof value === "string" && (options as readonly string[]).includes(value);
}

export function snapNumber(key: NumericSettingKey, value: number): number {
  const { min, max, step } = NUMERIC_RANGES[key];
  const clamped = Math.min(max, Math.max(min, value));
  const snapped = min + Math.round((clamped - min) / step) * step;
  return Math.round(snapped * 100) / 100;
}

/**
 * Validates each field independently; invalid fields are dropped so partial
 * data keeps whatever is still valid. Numbers are clamped and snapped.
 */
export function sanitizeSettings(raw: unknown): Partial<AppearanceSettings> {
  if (!raw || typeof raw !== "object") return {};
  const src = raw as Record<string, unknown>;
  const out: Partial<AppearanceSettings> = {};
  if (isOneOf(BRIGHTNESS_MODES, src.mode)) out.mode = src.mode;
  if (isOneOf(DARK_VARIANTS, src.systemDarkVariant)) out.systemDarkVariant = src.systemDarkVariant;
  if (isOneOf(FONT_FAMILY_IDS, src.fontFamily)) out.fontFamily = src.fontFamily;
  if (isOneOf(FONT_WEIGHTS, src.fontWeight)) out.fontWeight = src.fontWeight;
  if (isOneOf(RADIUS_SCALES, src.radiusScale)) out.radiusScale = src.radiusScale;
  if (isOneOf(DENSITIES, src.density)) out.density = src.density;
  for (const key of ["fontScale", "lineHeight", "letterSpacing"] as const) {
    const value = src[key];
    if (typeof value === "number" && Number.isFinite(value)) out[key] = snapNumber(key, value);
  }
  for (const key of ["textColor", "backgroundColor", "surfaceColor", "accentColor"] as const) {
    const value = src[key];
    if (value === null) out[key] = null;
    else if (typeof value === "string") {
      const hex = normalizeHex(value);
      if (hex) out[key] = hex;
    }
  }
  return out;
}

export function settingsEqual(a: AppearanceSettings, b: AppearanceSettings): boolean {
  return (Object.keys(DEFAULT_SETTINGS) as (keyof AppearanceSettings)[]).every(
    (key) => a[key] === b[key],
  );
}

export function appearanceEqual(a: AppliedAppearance, b: AppliedAppearance): boolean {
  return a.presetId === b.presetId && settingsEqual(a.settings, b.settings);
}

/**
 * Quick Sáng/Tối (and the other brightness modes). Only `mode` changes.
 * Preset id changes only when the current preset is itself a brightness preset,
 * so accent, font, contrast colors, density, and other overrides stay.
 */
export function withBrightnessMode(current: AppliedAppearance, mode: BrightnessMode): AppliedAppearance {
  const modePreset =
    current.presetId === "system" ||
    current.presetId === "light" ||
    current.presetId === "dark" ||
    current.presetId === "trueBlack";
  return {
    presetId: modePreset ? mode : current.presetId,
    settings: { ...current.settings, mode },
  };
}

export type AppearanceSectionId = "theme" | "text" | "colors" | "layout";

export const APPEARANCE_SECTION_KEYS: Record<
  AppearanceSectionId,
  readonly (keyof AppearanceSettings)[]
> = {
  theme: ["mode", "systemDarkVariant"],
  text: ["fontFamily", "fontScale", "fontWeight", "lineHeight", "letterSpacing"],
  colors: ["textColor", "backgroundColor", "surfaceColor", "accentColor"],
  layout: ["radiusScale", "density"],
};

/** Draft-only. Does not write storage and does not change other groups. */
export function resetAppearanceSection(
  draft: AppliedAppearance,
  section: AppearanceSectionId,
): AppliedAppearance {
  const defaults = DEFAULT_APPEARANCE.settings;
  const settings = { ...draft.settings };
  for (const key of APPEARANCE_SECTION_KEYS[section]) {
    (settings as Record<string, unknown>)[key] = defaults[key];
  }
  return { presetId: draft.presetId, settings };
}

export function shouldAnnounceApplySuccess(saved: boolean): boolean {
  return saved;
}

/** Only keys that differ from the preset are stored. */
function overridesFor(applied: AppliedAppearance): Partial<AppearanceSettings> {
  const base = resolvePreset(applied.presetId);
  const out: Partial<AppearanceSettings> = {};
  (Object.keys(base) as (keyof AppearanceSettings)[]).forEach((key) => {
    if (applied.settings[key] !== base[key]) {
      (out as Record<string, unknown>)[key] = applied.settings[key];
    }
  });
  return out;
}

export type StoredAppearanceV1 = {
  version: 1;
  presetId: PresetId;
  overrides: Partial<AppearanceSettings>;
  updatedAt: string;
};

export function serializeAppearance(applied: AppliedAppearance, now = new Date()): string {
  const payload: StoredAppearanceV1 = {
    version: APPEARANCE_SCHEMA_VERSION,
    presetId: applied.presetId,
    overrides: overridesFor(applied),
    updatedAt: now.toISOString(),
  };
  return JSON.stringify(payload);
}

export type AppearanceLoadSource = "stored" | "legacy" | "default" | "corrupt" | "future";

export type AppearanceLoadResult = {
  applied: AppliedAppearance;
  source: AppearanceLoadSource;
};

/**
 * Future schema versions migrate here in order (`version` → `version + 1`).
 * Empty today: v1 is the first versioned schema.
 */
const MIGRATIONS: Record<number, (old: Record<string, unknown>) => Record<string, unknown>> = {};

function fromLegacy(legacy: string | null): AppliedAppearance | null {
  if (legacy !== "light" && legacy !== "dark" && legacy !== "system") return null;
  return { presetId: legacy, settings: { ...resolvePreset(legacy), mode: legacy } };
}

export function parseStoredAppearance(
  raw: string | null,
  legacy: string | null,
): AppearanceLoadResult {
  if (raw == null) {
    const migrated = fromLegacy(legacy);
    return migrated
      ? { applied: migrated, source: "legacy" }
      : { applied: DEFAULT_APPEARANCE, source: "default" };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { applied: DEFAULT_APPEARANCE, source: "corrupt" };
  }
  if (!parsed || typeof parsed !== "object") {
    return { applied: DEFAULT_APPEARANCE, source: "corrupt" };
  }

  let doc = parsed as Record<string, unknown>;
  let version = typeof doc.version === "number" ? doc.version : NaN;
  if (!Number.isInteger(version) || version < 1) {
    return { applied: DEFAULT_APPEARANCE, source: "corrupt" };
  }
  if (version > APPEARANCE_SCHEMA_VERSION) {
    return { applied: DEFAULT_APPEARANCE, source: "future" };
  }
  while (version < APPEARANCE_SCHEMA_VERSION) {
    const step = MIGRATIONS[version];
    if (!step) return { applied: DEFAULT_APPEARANCE, source: "corrupt" };
    doc = step(doc);
    version += 1;
  }

  const presetId = isOneOf(PRESET_IDS, doc.presetId) ? doc.presetId : "system";
  const settings = { ...resolvePreset(presetId), ...sanitizeSettings(doc.overrides) };
  return { applied: { presetId, settings }, source: "stored" };
}

/** AsyncStorage-safe owner id. Empty means the device fallback key. */
export function sanitizeAppearanceUserId(userId: string | null | undefined): string | null {
  const trimmed = userId?.trim() ?? "";
  if (!trimmed) return null;
  const safe = trimmed.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 128);
  return safe.length > 0 ? safe : null;
}

/** Per-user key, or `APPEARANCE_DEVICE_KEY` when there is no user id. */
export function appearanceStorageKey(userId?: string | null): string {
  const id = sanitizeAppearanceUserId(userId);
  if (!id) return APPEARANCE_DEVICE_KEY;
  return `mma.ui.appearance.v1.user.${id}`;
}

export async function readAppearance(userId: string | null = null): Promise<AppearanceLoadResult> {
  const key = appearanceStorageKey(userId);
  const scoped = await AsyncStorage.getItem(key);
  const scopedUser = sanitizeAppearanceUserId(userId);
  if (scopedUser) {
    const result = parseStoredAppearance(scoped, null);
    if (result.source === "corrupt" && scoped != null) {
      void AsyncStorage.setItem(APPEARANCE_CORRUPT_KEY, scoped).catch(() => undefined);
    }
    return result;
  }

  const [legacyGlobal, legacyPref] = await Promise.all([
    scoped == null ? AsyncStorage.getItem(APPEARANCE_STORAGE_KEY) : Promise.resolve(null),
    AsyncStorage.getItem(LEGACY_THEME_PREFERENCE_KEY),
  ]);
  const raw = scoped ?? legacyGlobal;
  const result = parseStoredAppearance(raw, legacyPref);
  if (result.source === "corrupt" && raw != null) {
    void AsyncStorage.setItem(APPEARANCE_CORRUPT_KEY, raw).catch(() => undefined);
  }
  if (scoped == null && (result.source === "stored" || result.source === "legacy")) {
    void AsyncStorage.setItem(APPEARANCE_DEVICE_KEY, serializeAppearance(result.applied)).catch(
      () => undefined,
    );
  }
  return result;
}

export async function writeAppearance(
  applied: AppliedAppearance,
  userId: string | null = null,
): Promise<void> {
  await AsyncStorage.setItem(appearanceStorageKey(userId), serializeAppearance(applied));
}
