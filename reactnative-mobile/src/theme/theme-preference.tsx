import * as SystemUI from "expo-system-ui";
import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Appearance, useWindowDimensions } from "react-native";

import { type ColorSchemeName, type ColorTokens } from "./colors";
import {
  DEFAULT_FONT_FAMILY,
  isFamilyLoaded,
  loadCoreFonts,
  loadFamily,
} from "./appearance/fonts";
import {
  DEFAULT_APPEARANCE_DRAFT,
  type AppearanceDraft,
  type DisplayMode,
} from "@/screens/fighter/redesign/appearance-model";
import {
  displayModeFromBrightness,
  fighterDraftToShared,
  readFighterAppearance,
  unsavedFighterBaseline,
  writeAppliedFighterAppearance,
} from "./fighter-appearance";
import {
  DEFAULT_APPEARANCE,
  LEGACY_THEME_PREFERENCE_KEY,
  readAppearance,
  withBrightnessMode,
  writeAppearance,
  type AppearanceLoadResult,
  type AppearanceLoadSource,
  type AppliedAppearance,
  type BrightnessMode,
  type FontFamilyId,
} from "./appearance/settings";
import {
  buildColors,
  buildLayout,
  nativeMode,
  buildTypography,
  toSemantic,
  type ColorVariant,
  type LayoutTokens,
  type SemanticColors,
  type TypographyTokens,
} from "./appearance/tokens";
import { setLiveTypography } from "./typography";

export const THEME_PREFERENCE_KEY = LEGACY_THEME_PREFERENCE_KEY;

export type ThemePreference = "light" | "dark" | "system";

/** Storage or font loading must never hold the native splash forever. */
const HYDRATE_TIMEOUT_MS = 3000;
const FONT_TIMEOUT_MS = 4000;

type ThemePreferenceContextValue = {
  preference: ThemePreference;
  setPreference: (next: ThemePreference) => void;
  resolvedScheme: ColorSchemeName;
  colors: ColorTokens;
};

export type ColorsValue = {
  scheme: ColorSchemeName;
  variant: ColorVariant;
  colors: ColorTokens;
  semantic: SemanticColors;
};

export type AppearanceState = {
  applied: AppliedAppearance;
  /** Applied value before the last Apply; drives "undo". */
  previousApplied: AppliedAppearance | null;
  /** Saved settings and the applied body font are loaded; the splash may hide. */
  ready: boolean;
  loadSource: AppearanceLoadSource | null;
  systemScheme: ColorSchemeName;
  osFontScale: number;
  persistError: boolean;
  /** Last font id whose registration failed; text falls back to the default body font. */
  fontUnavailable: FontFamilyId | null;
  /** Fighter appearance currently applied. Draft edits do not change this until save. */
  fighterApplied: AppearanceDraft;
  /** True after a successful local save or a reload of that save. */
  fighterPersisted: boolean;
};

export type AppearanceActions = {
  /**
   * Draft → applied, then persisted. Resolves after the chosen font is registered (or failed).
   * `false` means this call did not save (a newer apply won, or storage rejected).
   * The in-memory applied value still updates when this call commits; storage failure sets `persistError`.
   */
  applyAppearance: (next: AppliedAppearance) => Promise<boolean>;
  /** Quick brightness toggle: writes `applied` directly, no draft. */
  setMode: (mode: BrightnessMode) => void;
  /** Restores the previous applied value once; a second call is a no-op until the next Apply. */
  undoLastApply: () => Promise<void>;
  /** Registers one body family. Never rejects; `false` means it failed and `fontUnavailable` is set. */
  registerFont: (id: FontFamilyId) => Promise<boolean>;
  /**
   * Saves the fighter draft on this device for the signed-in user, then applies it.
   * Rejects without changing applied state when storage fails.
   */
  applyFighterAppearance: (draft: AppearanceDraft) => Promise<void>;
  /** Loads that user's saved appearance. Passing null restores the device fallback. */
  bindAppearanceOwner: (userId: string | null) => void;
};

const ThemePreferenceContext = createContext<ThemePreferenceContextValue | null>(null);
const ColorsContext = createContext<ColorsValue | null>(null);
const TypographyContext = createContext<TypographyTokens | null>(null);
const LayoutContext = createContext<LayoutTokens | null>(null);
const AppearanceStateContext = createContext<AppearanceState | null>(null);
const AppearanceActionsContext = createContext<AppearanceActions | null>(null);

function appearanceToScheme(value: string | null | undefined): ColorSchemeName {
  return value === "dark" ? "dark" : "light";
}

export function resolveScheme(
  preference: ThemePreference,
  appearanceScheme: string | null | undefined,
): ColorSchemeName {
  if (preference === "light" || preference === "dark") return preference;
  return appearanceToScheme(appearanceScheme);
}

function applyNativeScheme(mode: BrightnessMode) {
  // RN web / some builds omit setColorScheme; theme still resolves via React tokens.
  const setColorScheme = Appearance.setColorScheme;
  if (typeof setColorScheme !== "function") return;
  setColorScheme(mode === "system" ? "unspecified" : mode === "trueBlack" ? "dark" : mode);
}

function applyRootBackground(color: string) {
  try {
    void SystemUI.setBackgroundColorAsync(color).catch(() => undefined);
  } catch {
    // Root background is cosmetic (visible only behind screens).
  }
}

function readAppearanceScheme(): ColorSchemeName {
  return appearanceToScheme(Appearance.getColorScheme());
}

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        clearTimeout(timer);
        resolve(fallback);
      },
    );
  });
}

function toPreference(mode: BrightnessMode): ThemePreference {
  return mode === "trueBlack" ? "dark" : mode;
}

export function ThemePreferenceProvider({ children }: { children: ReactNode }) {
  const [applied, setApplied] = useState<AppliedAppearance>(DEFAULT_APPEARANCE);
  const [previousApplied, setPreviousApplied] = useState<AppliedAppearance | null>(null);
  const [appearanceScheme, setAppearanceScheme] = useState<ColorSchemeName>(readAppearanceScheme);
  const [ready, setReady] = useState(false);
  const [loadSource, setLoadSource] = useState<AppearanceLoadSource | null>(null);
  const [persistError, setPersistError] = useState(false);
  const [fontEpoch, setFontEpoch] = useState(0);
  const [fontUnavailable, setFontUnavailable] = useState<FontFamilyId | null>(null);
  const [fighterApplied, setFighterApplied] = useState<AppearanceDraft>(DEFAULT_APPEARANCE_DRAFT);
  const [fighterPersisted, setFighterPersisted] = useState(false);
  const [ownerEpoch, setOwnerEpoch] = useState(0);
  const { fontScale: osFontScale } = useWindowDimensions();
  const appliedRef = useRef(applied);
  appliedRef.current = applied;
  const previousRef = useRef(previousApplied);
  previousRef.current = previousApplied;
  const fighterRef = useRef(fighterApplied);
  fighterRef.current = fighterApplied;
  const fighterPersistedRef = useRef(false);
  const ownerRef = useRef<string | null>(null);
  /** `undefined` until `bindAppearanceOwner` runs; null is the device fallback. */
  const boundOwnerRef = useRef<string | null | undefined>(undefined);
  const scopeSeqRef = useRef(0);
  /** A user change before hydration finishes wins over the stored value. */
  const touchedRef = useRef(false);
  /** Only the latest Apply / Undo may commit after its font finishes loading. */
  const applySeqRef = useRef(0);

  const publishFighter = useCallback((next: AppearanceDraft, persisted: boolean) => {
    fighterRef.current = next;
    fighterPersistedRef.current = persisted;
    setFighterApplied(next);
    setFighterPersisted(persisted);
  }, []);

  const target = useMemo(
    () => buildColors(applied.settings, appearanceScheme),
    [applied.settings, appearanceScheme],
  );
  // Published once per palette change; per-frame fades would re-render every consumer.
  const colors = target.colors;

  const registerFont = useCallback(async (id: FontFamilyId) => {
    const wasLoaded = isFamilyLoaded(id);
    const ok = wasLoaded || (await loadFamily(id));
    if (ok) {
      setFontUnavailable((current) => (current === id ? null : current));
      if (!wasLoaded) setFontEpoch((n) => n + 1);
      return true;
    }
    if (id !== DEFAULT_FONT_FAMILY) await loadFamily(DEFAULT_FONT_FAMILY);
    setFontUnavailable(id);
    return false;
  }, []);

  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      setAppearanceScheme(appearanceToScheme(colorScheme));
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    let cancelled = false;
    const fallback: AppearanceLoadResult = { applied: DEFAULT_APPEARANCE, source: "default" };

    const hydrate = async () => {
      const userId = ownerRef.current;
      const result = await withTimeout(readAppearance(userId), HYDRATE_TIMEOUT_MS, fallback);
      if (cancelled) return;
      const fighterSaved = await readFighterAppearance(userId).catch(() => null);
      const adopt = ownerEpoch > 0 || !touchedRef.current;
      const resolved: DisplayMode = readAppearanceScheme() === "dark" ? "dark" : "light";
      const nextFighter = fighterSaved ?? unsavedFighterBaseline(result.applied, resolved);
      const sharedSaved = result.source === "stored" || result.source === "legacy";
      const nextShared = sharedSaved
        ? result.applied
        : fighterSaved
          ? fighterDraftToShared(fighterSaved, result.applied)
          : result.applied;
      const next = adopt ? nextShared : appliedRef.current;
      await withTimeout(
        Promise.all([loadCoreFonts(), loadFamily(next.settings.fontFamily)]),
        FONT_TIMEOUT_MS,
        [false, false],
      );
      if (cancelled) return;
      if (adopt) {
        setApplied(nextShared);
        applyNativeScheme(nativeMode(nextShared.settings));
        if (nextShared.settings.mode === "system") setAppearanceScheme(readAppearanceScheme());
        publishFighter(nextFighter, fighterSaved != null);
      }
      setLoadSource(result.source);
      setFontEpoch((n) => n + 1);
      setReady(true);

      // Other body families load only on demand via `registerFont`. If the
      // applied one timed out or failed, finish it in the background and flag it.
      if (!isFamilyLoaded(next.settings.fontFamily)) void registerFont(next.settings.fontFamily);
    };

    void hydrate();
    return () => {
      cancelled = true;
    };
  }, [ownerEpoch, publishFighter, registerFont]);

  const persist = useCallback(async (next: AppliedAppearance) => {
    try {
      await writeAppearance(next, ownerRef.current);
      setPersistError(false);
      return true;
    } catch {
      setPersistError(true);
      return false;
    }
  }, []);

  const commit = useCallback(
    async (next: AppliedAppearance) => {
      touchedRef.current = true;
      setApplied(next);
      applyNativeScheme(nativeMode(next.settings));
      const scheme = readAppearanceScheme();
      if (next.settings.mode === "system") setAppearanceScheme(scheme);
      applyRootBackground(buildColors(next.settings, scheme).colors.bg);
      return persist(next);
    },
    [persist],
  );

  const applyAppearance = useCallback(
    async (next: AppliedAppearance) => {
      const seq = ++applySeqRef.current;
      if (!isFamilyLoaded(next.settings.fontFamily)) {
        await registerFont(next.settings.fontFamily);
        if (seq !== applySeqRef.current) return false;
      }
      setPreviousApplied(appliedRef.current);
      return commit(next);
    },
    [commit, registerFont],
  );

  const setMode = useCallback(
    (mode: BrightnessMode) => {
      const resolved: DisplayMode = readAppearanceScheme() === "dark" ? "dark" : "light";
      const displayMode = displayModeFromBrightness(mode, resolved);
      if (fighterPersistedRef.current && (mode === "light" || mode === "dark")) {
        const nextFighter = { ...fighterRef.current, mode: displayMode };
        const shared = withBrightnessMode(appliedRef.current, mode);
        const owner = ownerRef.current;
        void (async () => {
          try {
            await writeAppliedFighterAppearance(owner, nextFighter, shared);
          } catch {
            if (ownerRef.current === owner) setPersistError(true);
            return;
          }
          if (ownerRef.current !== owner) return;
          setPersistError(false);
          publishFighter(nextFighter, true);
          touchedRef.current = true;
          setApplied(shared);
          applyNativeScheme(nativeMode(shared.settings));
          applyRootBackground(buildColors(shared.settings, readAppearanceScheme()).colors.bg);
        })();
        return;
      }
      if (mode === "light" || mode === "dark" || mode === "trueBlack") {
        publishFighter({ ...fighterRef.current, mode: displayMode }, fighterPersistedRef.current);
      }
      void commit(withBrightnessMode(appliedRef.current, mode));
    },
    [commit, publishFighter],
  );

  const applyFighterAppearance = useCallback(async (draft: AppearanceDraft) => {
    const owner = ownerRef.current;
    const shared = fighterDraftToShared(draft, appliedRef.current);
    try {
      await writeAppliedFighterAppearance(owner, draft, shared);
    } catch (error) {
      if (ownerRef.current === owner) setPersistError(true);
      throw error;
    }
    if (ownerRef.current !== owner) return;
    setPersistError(false);
    publishFighter(draft, true);
    touchedRef.current = true;
    setPreviousApplied(appliedRef.current);
    setApplied(shared);
    applyNativeScheme(nativeMode(shared.settings));
    const scheme = readAppearanceScheme();
    if (shared.settings.mode === "system") setAppearanceScheme(scheme);
    applyRootBackground(buildColors(shared.settings, scheme).colors.bg);
    if (!isFamilyLoaded("inter")) void registerFont("inter");
  }, [publishFighter, registerFont]);

  const bindAppearanceOwner = useCallback((userId: string | null) => {
    const next = userId?.trim() ? userId : null;
    if (boundOwnerRef.current === next) return;
    boundOwnerRef.current = next;
    ownerRef.current = next;
    scopeSeqRef.current += 1;
    setOwnerEpoch((n) => n + 1);
  }, []);

  const undoLastApply = useCallback(async () => {
    const prev = previousRef.current;
    if (!prev) return;
    const seq = ++applySeqRef.current;
    previousRef.current = null;
    setPreviousApplied(null);
    if (!isFamilyLoaded(prev.settings.fontFamily)) {
      await registerFont(prev.settings.fontFamily);
      if (seq !== applySeqRef.current) return;
    }
    commit(prev);
  }, [commit, registerFont]);

  const setPreference = useCallback((next: ThemePreference) => setMode(next), [setMode]);

  // Re-read on every render; `fontEpoch` bumps trigger one after each font load.
  void fontEpoch;
  const familyAvailable = isFamilyLoaded(applied.settings.fontFamily);
  const typography = useMemo(
    () => buildTypography(applied.settings, osFontScale, familyAvailable),
    [applied.settings, osFontScale, familyAvailable],
  );
  const liveRef = useRef<TypographyTokens | null>(null);
  if (liveRef.current !== typography) {
    liveRef.current = typography;
    setLiveTypography(typography);
  }
  const layout = useMemo(() => buildLayout(applied.settings), [applied.settings]);

  const colorsValue = useMemo<ColorsValue>(
    () => ({
      scheme: target.scheme,
      variant: target.variant,
      colors,
      semantic: toSemantic(colors),
    }),
    [target.scheme, target.variant, colors],
  );

  const state = useMemo<AppearanceState>(
    () => ({
      applied,
      previousApplied,
      ready,
      loadSource,
      systemScheme: appearanceScheme,
      osFontScale,
      persistError,
      fontUnavailable,
      fighterApplied,
      fighterPersisted,
    }),
    [
      applied,
      previousApplied,
      ready,
      loadSource,
      appearanceScheme,
      osFontScale,
      persistError,
      fontUnavailable,
      fighterApplied,
      fighterPersisted,
    ],
  );

  const actions = useMemo<AppearanceActions>(
    () => ({
      applyAppearance,
      setMode,
      undoLastApply,
      registerFont,
      applyFighterAppearance,
      bindAppearanceOwner,
    }),
    [applyAppearance, setMode, undoLastApply, registerFont, applyFighterAppearance, bindAppearanceOwner],
  );

  const preference = toPreference(applied.settings.mode);
  // Legacy consumers read the module-level `type` styles, so they must also
  // re-render when typography changes.
  const legacy = useMemo<ThemePreferenceContextValue>(() => {
    void typography;
    return { preference, setPreference, resolvedScheme: target.scheme, colors };
  }, [preference, setPreference, target.scheme, colors, typography]);

  return (
    <AppearanceActionsContext.Provider value={actions}>
      <AppearanceStateContext.Provider value={state}>
        <ColorsContext.Provider value={colorsValue}>
          <TypographyContext.Provider value={typography}>
            <LayoutContext.Provider value={layout}>
              <ThemePreferenceContext.Provider value={legacy}>
                {children}
              </ThemePreferenceContext.Provider>
            </LayoutContext.Provider>
          </TypographyContext.Provider>
        </ColorsContext.Provider>
      </AppearanceStateContext.Provider>
    </AppearanceActionsContext.Provider>
  );
}

/**
 * Overrides colors / typography / layout for a subtree only (the Appearance
 * preview renders draft tokens through this; the rest of the app never sees them).
 */
export function ThemeScope({
  colors,
  typography,
  layout,
  children,
}: {
  colors: ColorsValue;
  typography: TypographyTokens;
  layout: LayoutTokens;
  children: ReactNode;
}) {
  return (
    <ColorsContext.Provider value={colors}>
      <TypographyContext.Provider value={typography}>
        <LayoutContext.Provider value={layout}>{children}</LayoutContext.Provider>
      </TypographyContext.Provider>
    </ColorsContext.Provider>
  );
}

function required<T>(value: T | null, name: string): T {
  if (!value) throw new Error(`${name} must be used within ThemePreferenceProvider`);
  return value;
}

export function useThemePreference() {
  return required(use(ThemePreferenceContext), "useThemePreference");
}

export function useColors() {
  return required(use(ColorsContext), "useColors");
}

export function useTypography() {
  return required(use(TypographyContext), "useTypography");
}

export function useLayoutTokens() {
  return required(use(LayoutContext), "useLayoutTokens");
}

export function useAppearanceState() {
  return required(use(AppearanceStateContext), "useAppearanceState");
}

export function useAppearanceActions() {
  return required(use(AppearanceActionsContext), "useAppearanceActions");
}

export function useAppearanceReady() {
  return useAppearanceState().ready;
}
