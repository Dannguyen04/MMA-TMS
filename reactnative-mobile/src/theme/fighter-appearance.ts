import {
  DEFAULT_APPEARANCE_DRAFT,
  draftsEqual,
  previewPalette,
  TYPE_SCALE,
  type AccentId,
  type AppearanceDraft,
  type DisplayMode,
  type ReadingSupport,
  type ThemeId,
  type TypeSize,
} from "@/screens/fighter/redesign/appearance-model";
import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  appearanceStorageKey,
  sanitizeAppearanceUserId,
  serializeAppearance,
  snapNumber,
  type AppliedAppearance,
} from "@/theme/appearance/settings";

/**
 * Device fallback used only when no authenticated user id is available
 * (before session restore, or after logout). It is not copied onto the next
 * account. A signed-in user is stored at `mma.ui.fighterAppearance.v1.user.<id>`.
 * Logout does not delete that user key.
 */
export const FIGHTER_APPEARANCE_DEVICE_KEY = "mma.ui.fighterAppearance.v1.device";

export const APPEARANCE_SAVE_ERROR = "Không lưu được trên điện thoại. Thử lại.";

const THEMES: readonly ThemeId[] = ["default", "paper", "mint"];
const ACCENTS: readonly AccentId[] = ["red", "green", "blue", "purple"];
const SIZES: readonly TypeSize[] = ["small", "medium", "large"];
const READINGS: readonly ReadingSupport[] = ["standard", "highContrast"];
const MODES: readonly DisplayMode[] = ["light", "dark"];

export function fighterAppearanceStorageKey(userId?: string | null): string {
  const id = sanitizeAppearanceUserId(userId);
  if (!id) return FIGHTER_APPEARANCE_DEVICE_KEY;
  return `mma.ui.fighterAppearance.v1.user.${id}`;
}

export type AppearanceKeyValue = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  multiSet(pairs: readonly (readonly [string, string])[]): Promise<void>;
};

function isOneOf<T extends string>(options: readonly T[], value: unknown): value is T {
  return typeof value === "string" && (options as readonly string[]).includes(value);
}

export function parseFighterAppearance(raw: string | null): AppearanceDraft | null {
  if (raw == null) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const doc = parsed as { version?: unknown; applied?: unknown };
  if (doc.version !== 1 || !doc.applied || typeof doc.applied !== "object") return null;
  const applied = doc.applied as Record<string, unknown>;
  if (!isOneOf(MODES, applied.mode)) return null;
  if (!isOneOf(THEMES, applied.theme)) return null;
  if (!isOneOf(ACCENTS, applied.accent)) return null;
  if (!isOneOf(SIZES, applied.typeSize)) return null;
  if (!isOneOf(READINGS, applied.reading)) return null;
  return {
    mode: applied.mode,
    theme: applied.theme,
    accent: applied.accent,
    typeSize: applied.typeSize,
    reading: applied.reading,
  };
}

export function serializeFighterAppearance(applied: AppearanceDraft, now = new Date()): string {
  return JSON.stringify({
    version: 1,
    applied,
    updatedAt: now.toISOString(),
  });
}

export function displayModeFromBrightness(
  mode: AppliedAppearance["settings"]["mode"],
  resolved: DisplayMode,
): DisplayMode {
  if (mode === "dark" || mode === "trueBlack") return "dark";
  if (mode === "light") return "light";
  return resolved;
}

/** In-memory baseline before the user has saved. Does not write storage. */
export function unsavedFighterBaseline(
  shared: AppliedAppearance,
  resolved: DisplayMode,
): AppearanceDraft {
  return {
    ...DEFAULT_APPEARANCE_DRAFT,
    mode: displayModeFromBrightness(shared.settings.mode, resolved),
  };
}

/**
 * Maps a saved fighter draft onto the shared appearance document so mode,
 * accent, theme colors, and type size drive tokens outside the preview.
 */
export function fighterDraftToShared(
  draft: AppearanceDraft,
  current: AppliedAppearance,
): AppliedAppearance {
  const palette = previewPalette(draft);
  return {
    presetId: "system",
    settings: {
      ...current.settings,
      paletteId: "figma",
      mode: draft.mode,
      fontFamily: "inter",
      fontScale: snapNumber("fontScale", TYPE_SCALE[draft.typeSize]),
      textColor: palette.ink,
      backgroundColor: palette.bg,
      surfaceColor: palette.surface,
      accentColor: palette.accent,
    },
  };
}

export const asyncStorageAppearance: AppearanceKeyValue = {
  getItem: (key) => AsyncStorage.getItem(key),
  setItem: (key, value) => AsyncStorage.setItem(key, value),
  multiSet: (pairs) => AsyncStorage.multiSet(pairs.map((pair) => [pair[0], pair[1]])),
};

export async function readFighterAppearance(
  userId: string | null,
  storage: AppearanceKeyValue = asyncStorageAppearance,
): Promise<AppearanceDraft | null> {
  const raw = await storage.getItem(fighterAppearanceStorageKey(userId));
  return parseFighterAppearance(raw);
}

/**
 * Writes the fighter draft and the shared appearance together.
 * Throws without claiming success when storage rejects the write.
 */
export async function writeAppliedFighterAppearance(
  userId: string | null,
  draft: AppearanceDraft,
  shared: AppliedAppearance,
  storage: AppearanceKeyValue = asyncStorageAppearance,
): Promise<void> {
  await storage.multiSet([
    [fighterAppearanceStorageKey(userId), serializeFighterAppearance(draft)],
    [appearanceStorageKey(userId), serializeAppearance(shared)],
  ]);
}

export type EditorSnapshot = {
  applied: AppearanceDraft;
  draft: AppearanceDraft;
  saving: boolean;
  error: string | null;
};

export function editorIsClean(snapshot: EditorSnapshot): boolean {
  return draftsEqual(snapshot.draft, snapshot.applied);
}

export function beginAppearanceApply(snapshot: EditorSnapshot): EditorSnapshot {
  if (snapshot.saving || editorIsClean(snapshot)) return snapshot;
  return { ...snapshot, saving: true, error: null };
}

export function finishAppearanceApply(snapshot: EditorSnapshot, applied: AppearanceDraft): EditorSnapshot {
  return { applied, draft: applied, saving: false, error: null };
}

export function failAppearanceApply(snapshot: EditorSnapshot): EditorSnapshot {
  return { ...snapshot, saving: false, error: APPEARANCE_SAVE_ERROR };
}
