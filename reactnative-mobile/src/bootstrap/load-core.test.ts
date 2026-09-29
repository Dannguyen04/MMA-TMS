import AsyncStorage from "@react-native-async-storage/async-storage";

import { DASHBOARD_CACHE_KEY, runSplashBootstrap, SESSION_KEY } from "@/bootstrap/load-core";
import { THEME_PREFERENCE_KEY } from "@/theme/theme-preference";

describe("runSplashBootstrap", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it("reports 33 / 67 / 100 as each storage task settles", async () => {
    const ticks: number[] = [];
    await runSplashBootstrap((_completed, _total, pct) => {
      ticks.push(pct);
    });
    expect(ticks).toEqual([33, 67, 100]);
  });

  it("reads the three known keys", async () => {
    await AsyncStorage.setItem(THEME_PREFERENCE_KEY, "dark");
    await AsyncStorage.setItem(SESSION_KEY, '{"token":"x"}');
    await AsyncStorage.setItem(DASHBOARD_CACHE_KEY, "{}");

    const result = await runSplashBootstrap();
    expect(result.core.themePreference).toBe("dark");
    expect(result.core.session).toBe('{"token":"x"}');
    expect(result.dashboard.cache).toBe("{}");
  });

  it("counts a rejected storage task as finished", async () => {
    const original = AsyncStorage.getItem.bind(AsyncStorage);
    AsyncStorage.getItem = (async (key: string) => {
      if (key === THEME_PREFERENCE_KEY) throw new Error("theme boom");
      return original(key);
    }) as typeof AsyncStorage.getItem;

    try {
      const ticks: number[] = [];
      const result = await runSplashBootstrap((_c, _t, pct) => ticks.push(pct));
      expect(ticks[ticks.length - 1]).toBe(100);
      expect(result.core.themePreference).toBeNull();
      expect(result.dashboard.ready).toBe(true);
    } finally {
      AsyncStorage.getItem = original;
    }
  });
});
