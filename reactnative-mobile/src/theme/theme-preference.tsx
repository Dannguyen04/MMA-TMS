import AsyncStorage from "@react-native-async-storage/async-storage";
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
import { AccessibilityInfo, Animated, Appearance, Easing } from "react-native";

import { palettes, type ColorSchemeName, type ColorTokens } from "./colors";
import { lerpTokens } from "./interpolate-tokens";
import { motion } from "./motion";

export const THEME_PREFERENCE_KEY = "mma.ui.themePreference";

export type ThemePreference = "light" | "dark" | "system";

type ThemePreferenceContextValue = {
  preference: ThemePreference;
  setPreference: (next: ThemePreference) => void;
  resolvedScheme: ColorSchemeName;
  colors: ColorTokens;
};

const ThemePreferenceContext = createContext<ThemePreferenceContextValue | null>(
  null,
);

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

function applyNativeScheme(preference: ThemePreference) {
  // RN web / some builds omit setColorScheme; theme still resolves via React tokens.
  const setColorScheme = Appearance.setColorScheme;
  if (typeof setColorScheme !== "function") return;
  setColorScheme(preference === "system" ? "unspecified" : preference);
}

function readAppearanceScheme(): ColorSchemeName {
  return appearanceToScheme(Appearance.getColorScheme());
}

export function ThemePreferenceProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>("system");
  const [appearanceScheme, setAppearanceScheme] = useState<ColorSchemeName>(readAppearanceScheme);
  const [hydrated, setHydrated] = useState(false);
  const skipLaunchMotion = useRef(true);
  const resolvedScheme = resolveScheme(preference, appearanceScheme);
  const targetColors = palettes[resolvedScheme];
  const [colors, setColors] = useState<ColorTokens>(targetColors);
  const colorsRef = useRef(colors);
  const progress = useRef(new Animated.Value(1)).current;
  const fromRef = useRef<ColorTokens>(targetColors);
  const toRef = useRef<ColorTokens>(targetColors);

  colorsRef.current = colors;

  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      setAppearanceScheme(appearanceToScheme(colorScheme));
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(THEME_PREFERENCE_KEY).then((stored) => {
      if (cancelled) return;
      if (stored === "light" || stored === "dark" || stored === "system") {
        setPreferenceState(stored);
        applyNativeScheme(stored);
        if (stored === "system") setAppearanceScheme(readAppearanceScheme());
      } else {
        applyNativeScheme("system");
      }
      setHydrated(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const preferenceRef = useRef(preference);
  preferenceRef.current = preference;

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    applyNativeScheme(next);
    if (next === "system") setAppearanceScheme(readAppearanceScheme());
    void AsyncStorage.setItem(THEME_PREFERENCE_KEY, next);
  }, []);

  useEffect(() => {
    const next = palettes[resolvedScheme];
    if (!hydrated) {
      fromRef.current = next;
      toRef.current = next;
      setColors(next);
      return;
    }
    if (skipLaunchMotion.current) {
      skipLaunchMotion.current = false;
      fromRef.current = next;
      toRef.current = next;
      setColors(next);
      applyNativeScheme(preferenceRef.current);
      return;
    }
    if (next.bg === colorsRef.current.bg && next.ink === colorsRef.current.ink && next.cta === colorsRef.current.cta) {
      applyNativeScheme(preferenceRef.current);
      return;
    }

    let listener: string | undefined;
    let cancelled = false;

    const detach = () => {
      if (listener) {
        progress.removeListener(listener);
        listener = undefined;
      }
    };

    const finish = (tokens: ColorTokens) => {
      fromRef.current = tokens;
      toRef.current = tokens;
      setColors(tokens);
      applyNativeScheme(preferenceRef.current);
    };

    const run = async () => {
      const reduced = await AccessibilityInfo.isReduceMotionEnabled();
      if (cancelled) return;
      if (reduced) {
        progress.stopAnimation();
        finish(next);
        return;
      }

      fromRef.current = colorsRef.current;
      toRef.current = next;
      progress.stopAnimation();
      detach();
      progress.setValue(0);
      listener = progress.addListener(({ value }) => {
        setColors(lerpTokens(fromRef.current, toRef.current, value));
      });
      if (cancelled) {
        detach();
        return;
      }
      Animated.timing(progress, {
        toValue: 1,
        duration: motion.theme,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: false,
      }).start(({ finished }) => {
        detach();
        if (finished && !cancelled) finish(next);
      });
    };

    void run();

    return () => {
      cancelled = true;
      progress.stopAnimation();
      detach();
    };
  }, [hydrated, progress, resolvedScheme]);

  const value = useMemo<ThemePreferenceContextValue>(
    () => ({
      preference,
      setPreference,
      resolvedScheme,
      colors,
    }),
    [preference, setPreference, resolvedScheme, colors],
  );

  return (
    <ThemePreferenceContext.Provider value={value}>
      {children}
    </ThemePreferenceContext.Provider>
  );
}

export function useThemePreference() {
  const ctx = use(ThemePreferenceContext);
  if (!ctx) {
    throw new Error("useThemePreference must be used within ThemePreferenceProvider");
  }
  return ctx;
}
