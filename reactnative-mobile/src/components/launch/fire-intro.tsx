/**
 * Launch intro "Than lửa" (approved preview: design-previews/intro-than-lua.html).
 *
 * The app icon sits on black, catches fire and burns into embers; the embers
 * turn into a sphere, burst, and fly together into MMA VISION, which burns
 * while the app loads. Then the intro fades out over the app.
 *
 * Drawn with expo-gl: every particle's path is a function of time evaluated in
 * the vertex shader (see `fire-intro-scene.ts`), so a frame costs a few uniform
 * writes and draw calls. There is no other version: if GL cannot start at
 * all, the intro stays black and the app still opens on time.
 *
 * Contract with LaunchGate is unchanged: home children mount under the intro
 * early (`onAppCovered`), and the exit waits for the aggregate load to reach
 * 100% and for home to paint.
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { PixelRatio, Pressable, StyleSheet, View, useWindowDimensions, type LayoutChangeEvent } from "react-native";
import { GLView, type ExpoWebGLRenderingContext } from "expo-gl";
import * as Haptics from "expo-haptics";
import * as SplashScreen from "expo-splash-screen";
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

import { vi } from "@/i18n/common/vi";
import { splash, splashIntro as I } from "@/theme/splash";
import { devLog } from "@/utils/dev-log";

import { loadIntroTextures } from "./fire-intro-load";
import { buildFireScene, FireRenderer } from "./fire-intro-scene";

type FireIntroProps = {
  onLayoutReady: () => void;
  onFinish: () => void;
  /** LaunchGate mounts the real home children (under the intro) when this fires. */
  onAppCovered?: () => void;
  /** Called when the exit (fade into the app) starts. */
  onFlyStarted?: () => void;
  onHomeContentPainted?: (width: number, height: number) => void;
  splashActive?: boolean;
  /** 0–100 aggregate load (storage reads + session restore). */
  loadProgress?: number;
  homeSlot?: ReactNode;
};

const SCENE = buildFireScene();

function runFrameChain(count: number, then: () => void): () => void {
  let cancelled = false;
  let left = Math.max(count, 1);
  const tick = () => {
    if (cancelled) return;
    left -= 1;
    if (left <= 0) then();
    else requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  return () => {
    cancelled = true;
  };
}

const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

export function FireIntro({
  onLayoutReady,
  onFinish,
  onAppCovered,
  onFlyStarted,
  onHomeContentPainted,
  splashActive = true,
  loadProgress = 0,
  homeSlot = null,
}: FireIntroProps) {
  const { width, height } = useWindowDimensions();
  const [glReady, setGlReady] = useState(false);

  const [overlayAlive, setOverlayAlive] = useState(true);
  const [holdReached, setHoldReached] = useState(false);
  const [homeReady, setHomeReady] = useState(false);
  const [laidOut, setLaidOut] = useState(false);
  const startedRef = useRef(false);
  const exitStartedRef = useRef(false);
  const finishedRef = useRef(false);
  const homeLaidOutRef = useRef(false);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  // GL clock: ms since start (0 = the icon frame shown before start).
  const t0Ref = useRef<number | null>(null);
  const viewRef = useRef({ w: width, h: height, dpr: PixelRatio.get() });
  viewRef.current = { w: width, h: height, dpr: PixelRatio.get() };

  const exit = useSharedValue(0);

  const finish = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    setOverlayAlive(false);
    onFinish();
  }, [onFinish]);

  const start = useCallback(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    void SplashScreen.hideAsync().catch(() => undefined);
    // Home mounts now, under the intro, so it has the whole intro to paint.
    onAppCovered?.();
    t0Ref.current = now();
    const at = (ms: number, fn: () => void) => timersRef.current.push(setTimeout(fn, ms));
    at(I.nameLandMs, () => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined));
    at(I.holdAtMs, () => setHoldReached(true));
  }, [onAppCovered]);

  useEffect(() => {
    const timers = timersRef.current;
    return () => timers.forEach(clearTimeout);
  }, []);

  const onRootLayout = useCallback(() => {
    if (laidOut) return;
    setLaidOut(true);
    onLayoutReady();
  }, [laidOut, onLayoutReady]);

  // Start once laid out and the GL scene has drawn its first frame, so the fire
  // always plays from the top. The give-up only keeps a device whose GL never
  // comes from sitting on the launch screen; it does not switch to another intro.
  useEffect(() => {
    if (!laidOut || startedRef.current) return;
    if (glReady) {
      requestAnimationFrame(start);
      const backstop = setTimeout(start, 120);
      return () => clearTimeout(backstop);
    }
    const giveUp = setTimeout(() => {
      if (!startedRef.current) {
        devLog("[intro] GL not ready, opening the app without the intro");
        start();
      }
    }, I.glReadyGiveUpMs);
    return () => clearTimeout(giveUp);
  }, [glReady, laidOut, start]);

  // ----- GL scene
  const onContextCreate = useCallback(async (gl: ExpoWebGLRenderingContext) => {
    let renderer: FireRenderer;
    try {
      renderer = new FireRenderer(gl, SCENE);
      renderer.setTextures(await loadIntroTextures());
      renderer.render(0, viewRef.current);
    } catch (e) {
      devLog("[intro] GL setup failed", e);
      return;
    }
    setGlReady(true);
    let alive = true;
    const loop = () => {
      if (!alive || finishedRef.current) return;
      const t0 = t0Ref.current;
      try {
        renderer.render(t0 == null ? 0 : now() - t0, viewRef.current);
      } catch (e) {
        alive = false;
        devLog("[intro] GL frame failed", e);
        return;
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }, []);

  // ----- home
  useEffect(() => {
    if (homeSlot == null || homeReady) return;
    const giveUp = setTimeout(() => setHomeReady(true), splash.homeContentGiveUpMs);
    return () => clearTimeout(giveUp);
  }, [homeReady, homeSlot]);

  const onHomeLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const { width: w, height: h } = e.nativeEvent.layout;
      if (homeLaidOutRef.current || w <= 0 || h <= 0) return;
      homeLaidOutRef.current = true;
      runFrameChain(splash.paintExtraFrames, () => {
        setHomeReady(true);
        onHomeContentPainted?.(w, h);
      });
    },
    [onHomeContentPainted],
  );

  // ----- exit: fade the intro off the app
  const startExit = useCallback(() => {
    if (exitStartedRef.current) return;
    exitStartedRef.current = true;
    onFlyStarted?.();
    exit.value = withTiming(1, { duration: I.exitMs, easing: Easing.inOut(Easing.cubic) }, (done) => {
      if (done) runOnJS(finish)();
    });
    // Never hang on the animation callback (e.g. no frames while the app is not drawing).
    timersRef.current.push(setTimeout(finish, I.exitMs + 300));
  }, [exit, finish, onFlyStarted]);

  const loaded = loadProgress >= 100;
  useEffect(() => {
    if (overlayAlive && holdReached && loaded && homeReady) startExit();
  }, [holdReached, homeReady, loaded, overlayAlive, startExit]);

  // LaunchGate's own watchdog took the app live: drop the overlay at once.
  useEffect(() => {
    if (!splashActive && overlayAlive) {
      finishedRef.current = true;
      setOverlayAlive(false);
    }
  }, [overlayAlive, splashActive]);

  const onSkip = useCallback(() => {
    if (!startedRef.current) return;
    if (loaded && homeReady) {
      startExit();
      return;
    }
    // Not ready yet: jump to the burning name instead of replaying the embers.
    t0Ref.current = now() - I.holdAtMs;
    setHoldReached(true);
  }, [homeReady, loaded, startExit]);

  // ----- styles
  const overlayStyle = useAnimatedStyle(() => ({ opacity: 1 - exit.value }));

  return (
    <View style={styles.root} onLayout={onRootLayout} collapsable={false}>
      {homeSlot != null ? (
        <View style={styles.fill} collapsable={false} onLayout={onHomeLayout}>
          {homeSlot}
        </View>
      ) : null}

      {overlayAlive ? (
        <Animated.View style={[styles.fill, overlayStyle]}>
          <Pressable
            accessibilityRole="image"
            accessibilityLabel={vi.a11y.splash}
            accessibilityHint={vi.a11y.splashLoading}
            onPress={onSkip}
            style={[styles.fill, styles.black]}
          >
            <GLView pointerEvents="none" style={styles.fill} onContextCreate={onContextCreate} />
          </Pressable>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: splash.canvas },
  fill: { position: "absolute", left: 0, top: 0, right: 0, bottom: 0 },
  black: { backgroundColor: splash.canvas },
});
