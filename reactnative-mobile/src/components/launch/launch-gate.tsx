import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Platform, StatusBar as RNStatusBar, StyleSheet, View } from "react-native";
import * as SplashScreen from "expo-splash-screen";
import * as SystemUI from "expo-system-ui";
import { NavigationBar, setVisibilityAsync as setNavVisibilityAsync } from "expo-navigation-bar";

import { runSplashBootstrap } from "@/bootstrap/load-core";
import { MmaSplash } from "@/components/launch/mma-splash";
import { SplashErrorBoundary } from "@/components/launch/splash-error-boundary";
import { SplashLockContext } from "@/components/launch/splash-lock";
import {
  SPLASH_STORAGE_TASK_COUNT,
  splashAggregateLoadPct,
} from "@/components/launch/splash-shatter-gate";
import { useSession } from "@/session/session-context";
import { palettes } from "@/theme/colors";
import { splash } from "@/theme/splash";
import { splashPhoneGlassFlags } from "@/components/launch/splash-glass-mesh";
import { splashBrandFlags } from "@/components/launch/splash-landing-marks";

function LaunchSplashFallback({
  onLayoutReady,
  onFinish,
}: {
  onLayoutReady: () => void;
  onFinish: () => void;
}) {
  useEffect(() => {
    onLayoutReady();
  }, [onLayoutReady]);

  useEffect(() => {
    const done = setTimeout(onFinish, splash.hapticAtMs);
    return () => clearTimeout(done);
  }, [onFinish]);

  return <View onLayout={onLayoutReady} style={styles.fallback} />;
}

export function LaunchGate({ children }: { children: ReactNode }) {
  /**
   * There is **no phase swap of the children's parent** any more. `children`
   * live in exactly one React position (MmaSplash's home host) from the moment
   * they mount until the app is closed. `splashActive` only decides whether the
   * *splash layers* (black bed, VideoView, shutter, ice, shards) are rendered,
   * so `onFinish` cannot remount the app tree — which is what produced the
   * flash at the hand-off.
   */
  const { gate, restoreSettled } = useSession();
  const sessionReady = gate !== "loading";
  const [splashActive, setSplashActive] = useState(true);
  const [homeMounted, setHomeMounted] = useState(false);
  const [flyStarted, setFlyStarted] = useState(false);
  const [storageSettled, setStorageSettled] = useState(0);
  const loadPeakRef = useRef(0);
  /**
   * One aggregate for the splash: 3 AsyncStorage reads + SessionProvider
   * restore (started there at mount, concurrent with the intro). Latched
   * monotonic so a repeat report can never move the bar backward.
   */
  const loadProgress = Math.max(
    loadPeakRef.current,
    splashAggregateLoadPct(storageSettled, restoreSettled || sessionReady),
  );
  loadPeakRef.current = loadProgress;
  const dismissed = useRef(false);
  const splashActiveRef = useRef(true);
  const homeMountedRef = useRef(false);
  const flyStartedRef = useRef(false);
  const hangSkipLoggedRef = useRef(false);
  const glassLockedAtRef = useRef(0);
  const homePaintedRef = useRef(false);
  const loadSettledRef = useRef(false);
  const pendingLiveRef = useRef(false);
  const sessionReadyRef = useRef(sessionReady);
  splashActiveRef.current = splashActive;
  homeMountedRef.current = homeMounted;
  sessionReadyRef.current = sessionReady;
  loadSettledRef.current = loadProgress >= 100;

  useEffect(() => {
    let cancelled = false;
    void runSplashBootstrap((completed) => {
      if (!cancelled) setStorageSettled((prev) => Math.max(prev, completed));
    })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setStorageSettled(SPLASH_STORAGE_TASK_COUNT);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const dismissNativeSplash = useCallback((why: string) => {
    console.log(
      "[splash] hideAsync launchGate failsafe",
      why,
      "splashUntilPlaying",
      true,
      ...Object.entries({ ...splashPhoneGlassFlags(), ...splashBrandFlags() }).flat(),
    );
    void SplashScreen.hideAsync();
  }, []);

  const onLayoutReady = useCallback(() => {
    console.log("[splash] onLayoutReady hideAsync", false, "splashUntilPlaying", true, "seekAfterVisible", false, ...Object.entries({ ...splashPhoneGlassFlags(), ...splashBrandFlags() }).flat());
  }, []);

  useEffect(() => {
    console.log("[splash] hideAsync launchGate mount", false, "splashUntilPlaying", true, ...Object.entries({ ...splashPhoneGlassFlags(), ...splashBrandFlags() }).flat());
    console.log(
      "[splash] SystemChrome launchGate mount",
      "navHidden",
      true,
      "hidden true",
      "translucent true",
      "WHEN mount",
    );
    void SystemUI.setBackgroundColorAsync(splash.canvas);
    if (Platform.OS === "android") {
      RNStatusBar.setHidden(true);
      RNStatusBar.setTranslucent(true);
      RNStatusBar.setBackgroundColor("transparent", false);
      RNStatusBar.setBarStyle("light-content", false);
      NavigationBar.setHidden(true);
      void setNavVisibilityAsync("hidden");
    }
    return () => {
      if (Platform.OS === "android" && dismissed.current) {
        console.log(
          "[splash] SystemChrome launchGate unmount",
          "navHidden",
          false,
          "hidden false",
          "translucent false",
          "WHEN cleanup after onFinish",
        );
        RNStatusBar.setHidden(false);
        RNStatusBar.setTranslucent(false);
        RNStatusBar.setBackgroundColor(splash.canvas, false);
        NavigationBar.setHidden(false);
        void setNavVisibilityAsync("visible");
      }
    };
  }, []);

  /**
   * Ice is locked. Mount REAL home children under the ice NOW — not after
   * floorPainted, not after fly, not on a liveHost swap. MmaSplash still waits
   * for this wrapper's onLayout + paintExtraFrames before sheetRelease.
   */
  const onAppCovered = useCallback(() => {
    glassLockedAtRef.current = Date.now();
    console.log(
      "[splash] onAppCovered launchGate — mount home children",
      "navHidden",
      true,
      "chrome hidden/translucent unchanged",
      "WHEN lock",
      ...Object.entries({ ...splashPhoneGlassFlags(), ...splashBrandFlags() }).flat(),
    );
    setHomeMounted(true);
  }, []);

  /** Real home content has a size and has been given `paintExtraFrames`. */
  const onHomeContentPainted = useCallback((width: number, height: number) => {
    if (homePaintedRef.current) return;
    homePaintedRef.current = true;
    console.log("[splash] home children painted", width, height, "— under ice, before sheetRelease", ...Object.entries({ ...splashPhoneGlassFlags(), ...splashBrandFlags() }).flat());
  }, []);

  const onFlyStarted = useCallback(() => {
    console.log("[splash] flyStarted launchGate", ...Object.entries({ ...splashPhoneGlassFlags(), ...splashBrandFlags() }).flat());
    flyStartedRef.current = true;
    setFlyStarted(true);
  }, []);

  const enterLive = useCallback(() => {
    if (dismissed.current) return;
    /**
     * Shatter / hang may finish before SessionProvider restore settles. Hold
     * glass until gate is known so a cold-start session never flashes login.
     */
    if (!sessionReadyRef.current) {
      pendingLiveRef.current = true;
      console.log("[splash] enterLive held — session gate still loading");
      return;
    }
    pendingLiveRef.current = false;
    dismissed.current = true;
    hangSkipLoggedRef.current = true;
    console.log("[splash] onFinish launchGate — splash layers off, home stays mounted", ...Object.entries({ ...splashPhoneGlassFlags(), ...splashBrandFlags() }).flat());
    console.log("[splash] SystemChrome enterLive / onFinish", "navHidden", false, "hidden false later via splashActive", "WHEN onFinish");
    void SystemUI.setBackgroundColorAsync(palettes.dark.bg);
    setHomeMounted(true);
    setSplashActive(false);
  }, []);

  const onFinish = useCallback(() => {
    enterLive();
  }, [enterLive]);

  useEffect(() => {
    if (!sessionReady || !pendingLiveRef.current || dismissed.current) return;
    console.log("[splash] enterLive resume — session gate settled", gate);
    enterLive();
  }, [enterLive, gate, sessionReady]);

  useEffect(() => {
    if (!homeMounted) return;
    const hang = setTimeout(() => {
      if (dismissed.current) return;
      if (flyStartedRef.current) {
        if (!hangSkipLoggedRef.current) {
          hangSkipLoggedRef.current = true;
          console.log("[splash] hang launchGate skipped — fly", "flyStarted true");
        }
        return;
      }
      if (!loadSettledRef.current) {
        console.log("[splash] hang launchGate skipped — load in flight", "loadProgress", loadProgress);
        return;
      }
      console.log("[splash] hang launchGate after glassLocked", splash.splashHangMs);
      dismissNativeSplash("hang");
      enterLive();
    }, splash.splashHangMs);
    return () => clearTimeout(hang);
  }, [dismissNativeSplash, enterLive, homeMounted, loadProgress]);

  useEffect(() => {
    if (!flyStarted) return;
    const leave = setTimeout(() => {
      if (dismissed.current || !splashActiveRef.current) return;
      console.log("[splash] lockLeaveTimeout launchGate");
      dismissNativeSplash("lockLeaveTimeout");
      enterLive();
    }, splash.lockLeaveTimeoutMs);
    return () => clearTimeout(leave);
  }, [dismissNativeSplash, enterLive, flyStarted]);

  useEffect(() => {
    if (splashActive || Platform.OS !== "android") return;
    console.log(
      "[splash] SystemChrome after onFinish",
      "navHidden",
      false,
      "hidden false",
      "translucent false",
      "WHEN splashActive false",
    );
    RNStatusBar.setHidden(false);
    RNStatusBar.setTranslucent(false);
    NavigationBar.setHidden(false);
    void setNavVisibilityAsync("visible");
  }, [splashActive]);

  return (
    <SplashLockContext.Provider value={splashActive}>
      <View
        collapsable={false}
        needsOffscreenAlphaCompositing={false}
        renderToHardwareTextureAndroid={false}
        style={styles.root}
      >
        <SplashErrorBoundary
          fallback={<LaunchSplashFallback onLayoutReady={onLayoutReady} onFinish={onFinish} />}
        >
          <MmaSplash
            splashActive={splashActive}
            onLayoutReady={onLayoutReady}
            onFinish={onFinish}
            onAppCovered={onAppCovered}
            onFlyStarted={onFlyStarted}
            onHomeContentPainted={onHomeContentPainted}
            loadProgress={loadProgress}
            homeSlot={
              homeMounted ? (
                <View collapsable={false} style={styles.homeSlot}>
                  {children}
                </View>
              ) : null
            }
          />
        </SplashErrorBoundary>
      </View>
    </SplashLockContext.Provider>
  );
}

const styles = StyleSheet.create({
  // App background, not #000: with the children never remounting this is only
  // ever visible behind a transparent splash root. #000 under the fighter comes
  // from MmaSplash `blackBehind`.
  root: {
    flex: 1,
    backgroundColor: palettes.dark.bg,
  },
  // flex:1 so expo-router ScreenContainer can paint; absoluteFill inside an
  // elevated splash host was a sized wrapper with no Dashboard pixels.
  homeSlot: {
    flex: 1,
  },
  fallback: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: splash.canvas,
  },
});
