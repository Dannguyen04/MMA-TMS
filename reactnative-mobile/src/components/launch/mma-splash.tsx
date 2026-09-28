import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  Dimensions,
  Platform,
  StatusBar as RNStatusBar,
  StyleSheet,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
} from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  runOnJS,
  useAnimatedStyle,
  useFrameCallback,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { NavigationBar, setVisibilityAsync as setNavVisibilityAsync } from "expo-navigation-bar";
import * as SystemUI from "expo-system-ui";

import { punchScreenOrigin, splash, splashFlyClockMs, splashVideoLayout } from "@/theme/splash";
import { palettes } from "@/theme/colors";
import { vi } from "@/i18n/vi";

import { SplashErrorBoundary } from "./splash-error-boundary";
import { COLOR_RADIAL_PUNCH, FACE_FILLS, FACE_FILLS_UNUSED, GROW_JS_PROPS_MAX, splashPhoneGlassFlags } from "./splash-glass-mesh";
import { BRAND_MARK_ASSET, BRAND_MARK_EXISTS, splashBrandFlags } from "./splash-landing-marks";
import { SplashHudOverlay, type SplashHudPhase } from "./splash-hud-overlay";
import { canStartShardFly, shouldShowBackupIceSheet } from "./splash-shatter-gate";
import { shardCellOpacity, SplashGlassShatter } from "./splash-glass-shatter";
import { SplashVideoPlayer } from "./splash-video-player";
import { loadBundledSplashVideo } from "./splash-video-source";
import type { SplashVideoSource } from "./splash-video-types";

const splashVideoSource: SplashVideoSource | null = (() => {
  try {
    const source = loadBundledSplashVideo();
    if (source == null) return null;
    if (source.assetId != null || (source.uri != null && source.uri.length > 0)) {
      return source;
    }
    return null;
  } catch {
    return null;
  }
})();

function shatterBoxFromSize(width: number, height: number) {
  const w = width > 1 ? width : 360;
  const h = height > 1 ? height : 640;
  const origin = punchScreenOrigin(w, h);
  const video = splashVideoLayout(w, h);
  return { width: w, height: h, ox: origin.x, oy: origin.y, video };
}

type MmaSplashProps = {
  onLayoutReady: () => void;
  onFinish: () => void;
  /**
   * Ice sheet is locked opaque. LaunchGate must mount REAL home children now,
   * under the ice — not after fly / onFinish / a liveHost swap.
   */
  onAppCovered?: () => void;
  /** Sheet dropped and shard fly started — LaunchGate may arm lockLeaveTimeout. */
  onFlyStarted?: () => void;
  /** Home children wrapper laid out + paintExtraFrames, still under ice. */
  onHomeContentPainted?: (width: number, height: number) => void;
  /** Splash layers flag from LaunchGate. Never tears overlay down mid-fly. */
  splashActive?: boolean;
  /** 0–100 aggregate: 3 AsyncStorage splash reads + session restore. */
  loadProgress?: number;
  /** MMA Vision children. Mounted under ice at lock; empty floor is backup behind them. */
  homeSlot?: ReactNode;
};

function SplashFallback() {
  return <View style={[styles.fallback, { pointerEvents: "none" }]} />;
}

function windowShatterBox() {
  const win = Dimensions.get("window");
  return shatterBoxFromSize(win.width, win.height);
}

function runFrameChain(count: number, then: () => void): () => void {
  let cancelled = false;
  let left = Math.max(count, 1);
  const tick = () => {
    if (cancelled) return;
    left -= 1;
    if (left <= 0) {
      then();
      return;
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  return () => {
    cancelled = true;
  };
}

export function MmaSplash({
  onLayoutReady,
  onFinish,
  onAppCovered,
  onFlyStarted,
  onHomeContentPainted,
  splashActive = true,
  loadProgress = 0,
  homeSlot = null,
}: MmaSplashProps) {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const punchDoneRef = useRef(false);
  const punchAtRef = useRef(0);
  const glassCoveredRef = useRef(false);
  const appCoveredFiredRef = useRef(false);
  const fadingRef = useRef(false);
  const transitionedRef = useRef(false);
  const growTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const growArmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const facetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fillLockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const coverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const paintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const probeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelFloorFramesRef = useRef<(() => void) | null>(null);
  const cancelHomeFramesRef = useRef<(() => void) | null>(null);
  const cancelFinishFramesRef = useRef<(() => void) | null>(null);
  const cancelShardFramesRef = useRef<(() => void) | null>(null);
  const wipeProgress = useSharedValue(0);
  const panelH = useSharedValue(Math.max(windowShatterBox().height * 0.52, 1));
  const glassFill = useSharedValue(0);
  /**
   * Cell ice-in (0→1) and fly elapsed-ms clocks. Both are consumed by
   * `useAnimatedStyle` on the shard hosts — the native props registry survives
   * React commits. Never `jsProps` on an SVG fill (see splash-launch.md).
   */
  const fillClock = useSharedValue(0);
  const growClock = useSharedValue(0);
  const growFrameArmed = useSharedValue(0);
  const growFrameT0 = useSharedValue(0);
  const flyMs = useSharedValue(0);
  /** Origin-ray strokes fade instead of unmounting, so no shard node re-renders. */
  const strokeFade = useSharedValue(1);
  useFrameCallback((frame) => {
    "worklet";
    if (growFrameArmed.value !== 1) return;
    if (growFrameT0.value === 0) {
      growFrameT0.value = frame.timestamp;
    }
    const elapsed = frame.timestamp - growFrameT0.value;
    const t = Math.min(1, elapsed / splash.crackGrowMs);
    if (t > growClock.value) {
      growClock.value = t;
    }
    if (t >= 1) {
      growClock.value = 1;
      growFrameArmed.value = 2;
    }
  });
  const [videoFailed, setVideoFailed] = useState(splashVideoSource == null);
  const [hasPunchFinished, setHasPunchFinished] = useState(false);
  const [growClockArmed, setGrowClockArmed] = useState(false);
  const [iceHostsReady, setIceHostsReady] = useState(false);
  const [floorMounted, setFloorMounted] = useState(false);
  const [floorPainted, setFloorPainted] = useState(false);
  const [homeContentPainted, setHomeContentPainted] = useState(false);
  const [glassHoldDone, setGlassHoldDone] = useState(false);
  const [sheetReleased, setSheetReleased] = useState(false);
  const [glassLocked, setGlassLocked] = useState(false);
  /** Hold HUD bar has displayed 100% (real follow or fast-forward). */
  const [hudBarFilled, setHudBarFilled] = useState(false);
  const [hudPhase, setHudPhase] = useState<SplashHudPhase>("enter");
  const [hudExitDone, setHudExitDone] = useState(false);
  const [keepVideo, setKeepVideo] = useState(true);
  const [overlayAlive, setOverlayAlive] = useState(true);
  const [shatterBox, setShatterBox] = useState(windowShatterBox);
  const [floorCover, setFloorCover] = useState(() => {
    const box = windowShatterBox();
    return {
      width: box.video.width > 1 ? box.video.width : box.width,
      height: box.video.height > 1 ? box.video.height : box.height,
      source: "videoLayout",
    };
  });
  const [shutterMounted, setShutterMounted] = useState(false);
  const [shutterDone, setShutterDone] = useState(true);
  const splashClockRef = useRef(Date.now());
  const shutterHoldTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const iceHostsReadyRef = useRef(false);
  const sheetReleasedRef = useRef(false);
  const floorLaidOutRef = useRef(false);
  const floorPaintedRef = useRef(false);
  const homeSlotLaidOutRef = useRef(false);
  const homeContentPaintedRef = useRef(false);
  const homeContentGaveUpRef = useRef(false);
  const glassHoldDoneRef = useRef(false);
  const glassCoveredAtRef = useRef(0);
  const holdEndAtRef = useRef(0);
  const fillStartedAtRef = useRef(0);
  const growStartedAtRef = useRef(0);
  const growPaintDoneRef = useRef(false);
  const fillRampDoneRef = useRef(false);
  const shutterDoneRef = useRef(true);
  const wipeStartedRef = useRef(false);
  const punchPtsRef = useRef(-1);
  const hangSkipLoggedRef = useRef(new Set<string>());
  const cinematicPhaseRef = useRef<"pre" | "grow" | "fill" | "hold" | "fly" | "done">("pre");
  const glassLockedAtRef = useRef(0);
  const homePaintedAtRef = useRef(0);
  const floorFallbackAppliedRef = useRef(false);
  const rootSizeRef = useRef({ width: 0, height: 0 });
  const videoSizeRef = useRef({ width: 0, height: 0 });
  const coverSizeRef = useRef(floorCover);
  const overlayAliveRef = useRef(true);
  const keepVideoRef = useRef(true);
  const glassLockedRef = useRef(false);
  const homeSlotRef = useRef(homeSlot);
  const loadProgressRef = useRef(loadProgress);
  const hudBarFilledRef = useRef(false);
  const hudPhaseRef = useRef<SplashHudPhase>("enter");
  const hudExitDoneRef = useRef(false);
  homeSlotRef.current = homeSlot;
  loadProgressRef.current = loadProgress;
  overlayAliveRef.current = overlayAlive;
  keepVideoRef.current = keepVideo;
  glassLockedRef.current = glassLocked;
  coverSizeRef.current = floorCover;
  videoSizeRef.current = {
    width: shatterBox.video.width,
    height: shatterBox.video.height,
  };

  /**
   * Follow the live phone/browser viewport so shatter/video boxes track device
   * size changes (Chrome device mode, resized browser, different phones).
   * Root onLayout still applies measured flex layout when it reports.
   */
  useEffect(() => {
    if (windowWidth <= 1 || windowHeight <= 1) return;
    const next = shatterBoxFromSize(windowWidth, windowHeight);
    setShatterBox((prev) =>
      prev.width === next.width &&
      prev.height === next.height &&
      prev.video.width === next.video.width &&
      prev.video.height === next.video.height &&
      prev.video.left === next.video.left &&
      prev.video.top === next.video.top
        ? prev
        : next,
    );
    videoSizeRef.current = { width: next.video.width, height: next.video.height };
    panelH.value = Math.max(next.height * 0.52, 1);
    setFloorCover((prev) =>
      prev.width === next.width && prev.height === next.height
        ? prev
        : { width: next.width, height: next.height, source: "window" },
    );
  }, [panelH, windowHeight, windowWidth]);

  /** Every cinematic beat is logged as a delta from `punch`, in ms. */
  const beat = useCallback((name: string, ...rest: unknown[]) => {
    const at = punchAtRef.current > 0 ? Date.now() - punchAtRef.current : -1;
    console.log(`[splash] ${name} +${at}ms`, ...rest);
  }, []);

  const logGateFlags = useCallback(
    (label: string, extra?: Record<string, unknown>) => {
      beat(
        label,
        "glassLocked",
        glassLockedRef.current,
        "sheetUp",
        !sheetReleasedRef.current && overlayAliveRef.current,
        "overlayAlive",
        overlayAliveRef.current,
        "keepVideo",
        keepVideoRef.current,
        "floorPainted",
        floorPaintedRef.current,
        "homePainted",
        homeContentPaintedRef.current,
        "iceHostsReady",
        iceHostsReadyRef.current,
        "transitionedRef",
        transitionedRef.current,
        "flyStarted",
        fadingRef.current,
        "homeSlot",
        homeSlotRef.current == null ? "null" : "mounted",
        "phoneGlassMesh",
        splashPhoneGlassFlags().phoneGlassMesh,
        "concentricRings",
        splashPhoneGlassFlags().concentricRings,
        "shardSizeByPunchDist",
        splashPhoneGlassFlags().shardSizeByPunchDist,
        "frostEpicenter",
        splashPhoneGlassFlags().frostEpicenter,
        "dentEpicenter",
        splashPhoneGlassFlags().dentEpicenter,
        "crushWhite",
        splashPhoneGlassFlags().crushWhite,
        "fillOpaque",
        splashPhoneGlassFlags().fillOpaque,
        "seeThrough",
        splashPhoneGlassFlags().seeThrough,
        "colorRandomIndex",
        splashPhoneGlassFlags().colorRandomIndex,
        "growJsProps",
        GROW_JS_PROPS_MAX,
        "crackGrowMs",
        splash.crackGrowMs,
        "veinStaggerMs",
        splash.veinStaggerMs,
        ...Object.entries(splashBrandFlags()).flat(),
        ...(extra ? Object.entries(extra).flat() : []),
      );
    },
    [beat],
  );

  const skipFinishLog = useCallback(
    (key: string, extra?: Record<string, unknown>) => {
      if (hangSkipLoggedRef.current.has(key)) return;
      hangSkipLoggedRef.current.add(key);
      logGateFlags(key, extra);
    },
    [logGateFlags],
  );

  /** Ice sheet + hosts are the only cover. Never overlay-off in this state. */
  const iceLockIsOnlyCover = useCallback(
    () =>
      overlayAliveRef.current &&
      !sheetReleasedRef.current &&
      iceHostsReadyRef.current &&
      !fadingRef.current,
    [],
  );

  /**
   * Parent Yoga can be 384×0 (absoluteFill top+bottom stretch). Prefer root
   * onLayout, then VideoView's measured box, then window.
   */
  const pickCoverSize = useCallback(() => {
    const root = rootSizeRef.current;
    const video = videoSizeRef.current;
    const win = Dimensions.get("window");
    if (root.width > 0 && root.height > 0) {
      return { width: root.width, height: root.height, source: "root" };
    }
    if (video.width > 0 && video.height > 0) {
      return { width: video.width, height: video.height, source: "videoLayout" };
    }
    if (win.width > 1 && win.height > 1) {
      return { width: win.width, height: win.height, source: "window" };
    }
    const box = windowShatterBox();
    return { width: box.width, height: box.height, source: "shatterBox" };
  }, []);

  const applyFloorHeightFallback = useCallback(
    (why: string) => {
      const next = pickCoverSize();
      coverSizeRef.current = next;
      beat(
        "floor height fallback",
        next.height,
        "source",
        next.source,
        "w",
        next.width,
        "h",
        next.height,
        "why",
        why,
      );
      floorFallbackAppliedRef.current = true;
      setFloorCover((prev) =>
        prev.width === next.width && prev.height === next.height && prev.source === next.source
          ? prev
          : next,
      );
      return next;
    },
    [beat, pickCoverSize],
  );

  const markFloorPaintedFromFallback = useCallback(() => {
    if (floorLaidOutRef.current) return;
    const cover = coverSizeRef.current.height > 0 ? coverSizeRef.current : pickCoverSize();
    if (!(cover.width > 0 && cover.height > 0)) {
      beat("floorPainted skipped — no cover size");
      return;
    }
    floorLaidOutRef.current = true;
    cancelFloorFramesRef.current?.();
    cancelFloorFramesRef.current = runFrameChain(splash.paintExtraFrames, () => {
      if (fadingRef.current) return;
      floorPaintedRef.current = true;
      logGateFlags("floorPainted", {
        via: "height fallback",
        source: cover.source,
        w: cover.width,
        h: cover.height,
      });
      setFloorPainted(true);
    });
  }, [beat, logGateFlags, pickCoverSize]);

  const floorOrVideoSized = useCallback(
    () => floorPaintedRef.current || coverSizeRef.current.height > 0 || videoSizeRef.current.height > 0,
    [],
  );

  /**
   * Reads the clocks the UI thread is actually painting and reports the
   * effective ice-cell opacity. This is the probe that proves whether the fly
   * has pixels — a `0` here at `shardBreak` means the cells were blanked again.
   */
  const probeCell = useCallback(
    (label: string) => {
      const fc = fillClock.value;
      const fm = flyMs.value;
      beat(
        `probe ${label}`,
        "fillClock",
        Number(fc.toFixed(3)),
        "flyMs",
        Math.round(fm),
        "flyMs>0",
        fm > 0,
        "cellOpacity",
        Number(shardCellOpacity(fc, fm).toFixed(3)),
        "cellOpacity1",
        shardCellOpacity(fc, fm) >= 0.999,
        "strokeFade",
        Number(strokeFade.value.toFixed(3)),
        "FACE_FILLS unused",
        FACE_FILLS_UNUSED,
        "FACE_FILLS count",
        FACE_FILLS.length,
        "iceFillUsed",
        true,
        "pngOnGlass",
        "logoOnly",
        true,
        "slogan",
        false,
        "premountHosts",
        true,
        "punchMountsShards",
        false,
        "pauseAtPunch",
        false,
        "leakSheetWithFill",
        true,
        "fillOpaque",
        true,
        "seeThrough",
        false,
        "colorRadialPunch",
        COLOR_RADIAL_PUNCH,
        ...Object.entries({ ...splashPhoneGlassFlags(), ...splashBrandFlags() }).flat(),
        "crackGrowMs",
        splash.crackGrowMs,
        "growJsProps",
        GROW_JS_PROPS_MAX,
      );
    },
    [beat, fillClock, flyMs, strokeFade],
  );

  /** Ice is dissolving: keep bars HIDDEN until onFinish. Do not show nav mid-cinematic. */
  const darkenSystemChrome = useCallback(() => {
    beat(
      "SystemChrome darken at sheetRelease",
      "navHidden",
      true,
      "hidden true",
      "translucent unchanged",
      "WHEN sheetRelease",
      "bg",
      palettes.dark.bg,
    );
    try {
      void SystemUI.setBackgroundColorAsync(palettes.dark.bg);
    } catch {
      // Best effort.
    }
    if (Platform.OS !== "android") return;
    try {
      RNStatusBar.setHidden(true);
      RNStatusBar.setBarStyle("light-content", false);
      NavigationBar.setHidden(true);
      void setNavVisibilityAsync("hidden");
    } catch {
      // Best effort — never break the cinematic on chrome.
    }
  }, [beat]);

  const finishToApp = useCallback(
    (reason: string) => {
      const phase = cinematicPhaseRef.current;
      if (phase === "grow" || phase === "fill" || phase === "hold") {
        skipFinishLog(`finishToApp skipped — ${phase}`, { reason });
        return;
      }
      if (fadingRef.current && reason !== "cinematic") {
        if (!(reason === "enterLive" && !transitionedRef.current && phase === "fly")) {
          skipFinishLog("finishToApp skipped — fly in progress", { reason });
          return;
        }
        logGateFlags("finishToApp enterLive — force after fly window", { reason });
      }
      if (iceLockIsOnlyCover() && reason !== "cinematic" && reason !== "videoFailed") {
        skipFinishLog("finishToApp skipped — hold ice lock", { reason });
        return;
      }
      if (reason === "videoFailed" && iceLockIsOnlyCover()) {
        console.log("[splash] fallthrough after videoFailed — leave ice lock");
      }
      if (transitionedRef.current) {
        skipFinishLog("finishToApp skipped — already transitioned", { reason });
        return;
      }
      transitionedRef.current = true;
      cinematicPhaseRef.current = "done";
      // Hang / videoFailed used to tear overlay while home still lived
      // only inside floorMounted. Put home in the tree first, then unmount
      // VideoView under cover, then overlay off.
      if (!appCoveredFiredRef.current) {
        appCoveredFiredRef.current = true;
        logGateFlags("onAppCovered", { reason });
        onAppCovered?.();
      }
      setFloorMounted(true);
      const tearDownVideoThenOverlay = () => {
        logGateFlags("keepVideo off", { reason });
        keepVideoRef.current = false;
        setKeepVideo(false);
        const cancel = runFrameChain(splash.paintExtraFrames, () => {
          logGateFlags("overlay off", { reason });
          overlayAliveRef.current = false;
          setOverlayAlive(false);
          beat("liveReveal", "floor unmounted", "homeHost flex elevation 0");
          requestAnimationFrame(() => {
            logGateFlags("onFinish", { reason });
            onLayoutReady();
            onFinish();
          });
        });
        cancelFinishFramesRef.current = cancel;
      };
      // Parent homeSlot setState must commit before TextureView/overlay die.
      const homeInTree = homeSlotRef.current != null;
      const framesBeforeVideoOff = homeInTree ? 1 : splash.paintExtraFrames;
      cancelFinishFramesRef.current = runFrameChain(framesBeforeVideoOff, tearDownVideoThenOverlay);
    },
    [beat, iceLockIsOnlyCover, logGateFlags, onAppCovered, onFinish, onLayoutReady, skipFinishLog],
  );

  const goHomeNow = useCallback(() => {
    const phase = cinematicPhaseRef.current;
    if (phase === "grow" || phase === "fill" || phase === "hold" || phase === "fly") {
      skipFinishLog("hang skipped — cinematic", { phase });
      return;
    }
    logGateFlags("hang");
    finishToApp("hang");
  }, [finishToApp, logGateFlags, skipFinishLog]);

  const finishCinematic = useCallback(() => {
    finishToApp("cinematic");
  }, [finishToApp]);

  /**
   * `pastLoadGate` is the hang escape only: a session restore that never
   * settles must not hold the ice forever. Paint readiness is still required.
   */
  const startShardFly = useCallback((pastLoadGate = false) => {
    if (fadingRef.current) {
      logGateFlags("startShardFly skipped", { why: "fly already started" });
      return;
    }
    if (transitionedRef.current && !overlayAliveRef.current) {
      logGateFlags("startShardFly skipped", { why: "overlay already off" });
      return;
    }
    const sheetUp = !sheetReleasedRef.current && overlayAliveRef.current;
    const coverH = coverSizeRef.current.height;
    const videoH = videoSizeRef.current.height;
    const floorOk = floorOrVideoSized();
    if (!iceHostsReadyRef.current || !sheetUp || !floorOk) {
      logGateFlags("startShardFly skipped", {
        why: "missing flags",
        iceHostsReady: iceHostsReadyRef.current,
        sheetUp,
        floorPainted: floorPaintedRef.current,
        coverH,
        videoH,
        homePainted: homeContentPaintedRef.current,
        homeGaveUp: homeContentGaveUpRef.current,
      });
      return;
    }
    if (!homeContentPaintedRef.current && !homeContentGaveUpRef.current) {
      logGateFlags("startShardFly skipped", { why: "home children not painted" });
      return;
    }
    const paintReady =
      iceHostsReadyRef.current &&
      floorOk &&
      (homeContentPaintedRef.current || homeContentGaveUpRef.current);
    const gate = {
      crackPipelineDone: glassCoveredRef.current,
      minDwellDone: glassHoldDoneRef.current,
      loadProgress: pastLoadGate ? 100 : loadProgressRef.current,
      barFilled: pastLoadGate || hudBarFilledRef.current,
      overlayExitDone: pastLoadGate || hudExitDoneRef.current,
      paintReady,
    };
    const flyBlockedByHold = !canStartShardFly(gate);
    beat(
      "flyBlockedByHold",
      flyBlockedByHold,
      "holdMs",
      splash.glassHoldMs,
      "holdDone",
      glassHoldDoneRef.current,
      "loadProgress",
      loadProgressRef.current,
      "barFilled",
      hudBarFilledRef.current,
      "overlayExit",
      hudExitDoneRef.current,
      "pastLoadGate",
      pastLoadGate,
      "crackDone",
      glassCoveredRef.current,
      "homePainted",
      homeContentPaintedRef.current,
      "floorPainted",
      floorPaintedRef.current,
    );
    if (flyBlockedByHold) {
      const why =
        !gate.crackPipelineDone
          ? "crack pipeline"
          : !gate.minDwellDone
            ? "glass hold"
            : gate.loadProgress < 100
              ? "load progress"
              : !gate.barFilled
                ? "hud bar"
                : !gate.overlayExitDone
                  ? "overlay exit"
                  : "paint gate";
      logGateFlags("startShardFly skipped", { why, ...gate });
      return;
    }
    fadingRef.current = true;
    cinematicPhaseRef.current = "fly";
    const homeAt = homePaintedAtRef.current;
    const holdAt = holdEndAtRef.current;
    beat(
      "sheetRelease",
      "flyMs",
      splashFlyClockMs,
      "sheet hex",
      palettes.dark.bg,
      "is090A0C",
      palettes.dark.bg === "#090A0C",
      "notIce",
      palettes.dark.bg.toLowerCase() !== "#b8c3d0",
      "holdMs",
      splash.glassHoldMs,
      "homePaintedVsHoldEndVsRelease",
      "homePainted",
      homeAt > 0 ? homeAt - (glassCoveredAtRef.current || punchAtRef.current) : -1,
      "holdEnd",
      holdAt > 0 ? holdAt - (glassCoveredAtRef.current || punchAtRef.current) : -1,
      "homeBeforeHoldEnd",
      homeAt > 0 && holdAt > 0 ? homeAt <= holdAt : false,
      "holdBeforeRelease",
      true,
      "firstLaunchSkip used",
      false,
    );
    strokeFade.value = withTiming(0, { duration: 360, easing: Easing.out(Easing.quad) });
    darkenSystemChrome();
    probeCell("sheetRelease");
    onFlyStarted?.();
    // Drop the solid pale backup sheet on the same beat as flyMs. Leaving it up
    // for part of the clock fills every gap with #c8d4cc, then unmount = white blink.
    // Shards alone must cover; strokes fade, never unmount.
    sheetReleasedRef.current = true;
    setSheetReleased(true);
    beat("shardBreak", "flyMs", splashFlyClockMs, "flyClockMs", splashFlyClockMs, "cellOpacity", 1, "flyMs>0", flyMs.value > 0);
    flyMs.value = 0;
    flyMs.value = withTiming(splashFlyClockMs, {
      duration: splashFlyClockMs,
      easing: Easing.linear,
    });
    probeCell("shardBreak");
    if (probeTimerRef.current) clearTimeout(probeTimerRef.current);
    probeTimerRef.current = setTimeout(() => probeCell("shardBreak+360"), 360);
    if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
    fadeTimerRef.current = setTimeout(() => {
      probeCell("flyEnd");
      finishCinematic();
    }, splashFlyClockMs + splash.leaveAfterBreakMs);
  }, [
    beat,
    darkenSystemChrome,
    finishCinematic,
    floorOrVideoSized,
    flyMs,
    logGateFlags,
    onFlyStarted,
    probeCell,
    strokeFade,
  ]);

  const markGlassCovered = useCallback(() => {
    if (glassCoveredRef.current) return;
    glassCoveredRef.current = true;
    glassFill.value = 1;
    fillClock.value = 1;
    glassLockedRef.current = true;
    cinematicPhaseRef.current = "hold";
    glassLockedAtRef.current = Date.now();
    // Crack pipeline done: reveal the hold HUD as the single load indicator.
    // It follows the real aggregate (or fast-forwards if already 100).
    hudBarFilledRef.current = false;
    hudPhaseRef.current = "enter";
    hudExitDoneRef.current = false;
    setHudBarFilled(false);
    setHudPhase("enter");
    setHudExitDone(false);
    setGlassLocked(true);
    logGateFlags("glassCovered");
    glassCoveredAtRef.current = Date.now();
    beat(
      "hold start",
      "holdMs",
      splash.glassHoldMs,
      "loadProgressAtReveal",
      loadProgressRef.current,
      "hudFastForwardMs",
      splash.hudFastForwardMs,
      "after glassCovered",
      "firstLaunchSkip used",
      false,
    );
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    holdTimerRef.current = setTimeout(() => {
      if (glassHoldDoneRef.current) return;
      glassHoldDoneRef.current = true;
      holdEndAtRef.current = Date.now();
      beat(
        "hold end",
        "holdMs",
        splash.glassHoldMs,
        "homePainted",
        homeContentPaintedRef.current,
        "floorPainted",
        floorPaintedRef.current,
        "firstLaunchSkip used",
        false,
      );
      setGlassHoldDone(true);
    }, splash.glassHoldMs);
    // Mount REAL home under the ice now. Do not wait for fly / onFinish / live.
    if (!appCoveredFiredRef.current) {
      appCoveredFiredRef.current = true;
      logGateFlags("onAppCovered");
      onAppCovered?.();
    }
    if (lockTimerRef.current) clearTimeout(lockTimerRef.current);
    // Empty FLOOR SIBLING mounts independently of ScreenStack. Do not nest
    // Stack inside the view that gates floorPainted.
    lockTimerRef.current = setTimeout(() => {
      logGateFlags("floorMount");
      setFloorMounted(true);
    }, splash.glassLockDelayMs);
  }, [beat, fillClock, glassFill, logGateFlags, onAppCovered]);

  const startGlassCover = useCallback(() => {
    beat("glassCover", splash.glassCoverMs, "after fill", "leakSheetWithFill", true);
    if (coverTimerRef.current) clearTimeout(coverTimerRef.current);
    coverTimerRef.current = setTimeout(() => {
      glassFill.value = 1;
      markGlassCovered();
    }, splash.glassCoverMs);
  }, [beat, glassFill, markGlassCovered]);

  const finishFillRamp = useCallback(
    (source: string, finished?: boolean) => {
      if (fillRampDoneRef.current) return;
      fillRampDoneRef.current = true;
      const actual = Date.now() - fillStartedAtRef.current;
      fillClock.value = 1;
      beat(
        "fillDurationMs",
        "expected",
        splash.facetFillMs,
        "actual",
        actual,
        "source",
        source,
        "finished",
        finished ?? true,
        "fillClock",
        1,
        "leakSheetWithFill",
        true,
        "colorRadialPunch",
        COLOR_RADIAL_PUNCH,
      );
      beat("fillClock ramp end", 1, "jsPropsFillOpacity", false);
      startGlassCover();
    },
    [beat, fillClock, startGlassCover],
  );

  const startFillFromGrow = useCallback(
    (source: string, finished?: boolean) => {
      if (fillStartedAtRef.current > 0) {
        beat("facetsFill skip already started", "source", source, "finished", finished ?? true);
        return;
      }
      fillStartedAtRef.current = Date.now();
      cinematicPhaseRef.current = "fill";
      growFrameArmed.value = 2;
      cancelAnimation(growClock);
      growClock.value = 1;
      const growPaintMs =
        growStartedAtRef.current > 0 ? Date.now() - growStartedAtRef.current : -1;
      growPaintDoneRef.current = true;
      beat(
        "growPaintMs",
        "actual",
        growPaintMs,
        "expected",
        splash.crackGrowMs,
        "source",
        source,
        "finished",
        finished ?? true,
        "jsPropsWipe",
        false,
        "veinStaggerMs",
        splash.veinStaggerMs,
        "growJsProps",
        GROW_JS_PROPS_MAX,
        ...Object.entries({ ...splashPhoneGlassFlags(), ...splashBrandFlags() }).flat(),
      );
      beat("facetsFill");
      beat(
        "fillClock ramp start",
        0,
        "hostOpacity",
        true,
        "jsPropsFillOpacity",
        false,
        "facetFillMs",
        splash.facetFillMs,
        "FILL_SPAN",
        1,
        "fillDelay",
        0,
        "leakSheetWithFill",
        true,
        "colorRadialPunch",
        COLOR_RADIAL_PUNCH,
        "FACE_FILLS unused",
        FACE_FILLS_UNUSED,
        "FACE_FILLS count",
        FACE_FILLS.length,
        "iceFillUsed",
        true,
        "pngOnGlass",
        "logoOnly",
        true,
        "slogan",
        false,
        "punchMountsShards",
        false,
        "pauseAtPunch",
        false,
        "growPaintMs",
        growPaintMs,
        "jsPropsWipe",
        false,
        ...Object.entries({ ...splashPhoneGlassFlags(), ...splashBrandFlags() }).flat(),
        "crackGrowMs",
        splash.crackGrowMs,
      );
      beat("glassFillRamp", "with fill", "leakSheetWithFill", true, "sheet", splash.glassFillColor);
      beat(
        "sheet color hex",
        splash.glassFillColor,
        "iceFillUsed",
        true,
        "pngOnGlass",
        "logoOnly",
        true,
        "slogan",
        false,
        "FACE_FILLS count",
        FACE_FILLS.length,
        "is090A0C",
        splash.glassFillColor === "#090A0C",
        "notBlack",
        splash.glassFillColor.toLowerCase() !== "#090a0c" && splash.glassFillColor.toLowerCase() !== "#000000",
        "splash.glassFillColor",
        splash.glassFillColor,
        "leakSheetWithFill",
        true,
      );
      glassFill.value = withTiming(1, {
        duration: splash.facetFillMs,
        easing: Easing.out(Easing.quad),
      });
      fillClock.value = withTiming(
        1,
        {
          duration: splash.facetFillMs,
          easing: Easing.out(Easing.quad),
        },
        (fillFinished) => {
          runOnJS(finishFillRamp)("withTiming", fillFinished);
        },
      );
      if (fillLockTimerRef.current) clearTimeout(fillLockTimerRef.current);
      fillLockTimerRef.current = setTimeout(() => {
        finishFillRamp("jsTimeout");
      }, splash.facetFillMs);
    },
    [beat, fillClock, finishFillRamp, glassFill, growClock, growFrameArmed],
  );

  const hideIntroShutter = useCallback(() => {
    if (shutterDoneRef.current) {
      console.log("[splash] shutterDone already", true, "punchDone", punchDoneRef.current);
      setShutterMounted(false);
      return;
    }
    shutterDoneRef.current = true;
    const wall = Date.now() - splashClockRef.current;
    console.log(
      "[splash] shutterDone",
      wall,
      "holdMs",
      splash.introHoldMs,
      "wipeMs",
      splash.introWipeMs,
      "punchDone",
      punchDoneRef.current,
      "shutterBeforePunch",
      !punchDoneRef.current,
      "exists",
      true,
    );
    setShutterDone(true);
    setShutterMounted(false);
  }, []);

  const beginIntroWipe = useCallback(
    (why: string, timeMs: number) => {
      if (wipeStartedRef.current || shutterDoneRef.current) return;
      wipeStartedRef.current = true;
      console.log(
        "[splash] shutterWipe",
        Date.now() - splashClockRef.current,
        "why",
        why,
        "timeMs",
        timeMs,
        "holdMs",
        splash.introHoldMs,
        "wipeMs",
        splash.introWipeMs,
        "afterVisibleFrame",
        true,
      );
      const startWipe = () => {
        wipeProgress.value = withTiming(
          1,
          { duration: splash.introWipeMs, easing: Easing.inOut(Easing.cubic) },
          (finished) => {
            console.log("[splash] shutterWipe finished", finished === true, "exists", true);
            if (finished) runOnJS(hideIntroShutter)();
          },
        );
      };
      if (splash.introHoldMs <= 0) {
        startWipe();
      } else {
        shutterHoldTimerRef.current = setTimeout(startWipe, splash.introHoldMs);
      }
    },
    [hideIntroShutter, wipeProgress],
  );

  const onFirstFrame = useCallback((meta: { timeMs: number }) => {
    console.log(
      "[splash] firstFrame splash",
      "timeMs",
      meta.timeMs,
      "wipeArmMs",
      splash.introWipeArmMediaMs,
      "rnShutterOnVideo",
      false,
      "splashUntilPlaying",
      true,
      "seekAfterVisible",
      false,
      "videoViewOpacity",
      1,
    );
  }, []);

  const onWalkVisible = useCallback((timeMs: number) => {
    console.log(
      "[splash] walkVisible splash",
      "timeMs",
      timeMs,
      "rnShutterOnVideo",
      false,
      "splashUntilPlaying",
      true,
    );
  }, []);

  const topBarStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -wipeProgress.value * panelH.value }],
  }));

  const bottomBarStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: wipeProgress.value * panelH.value }],
  }));

  const glassFillStyle = useAnimatedStyle(() => ({
    opacity: glassFill.value,
  }));

  const failVideo = useCallback(() => {
    onLayoutReady();
    if (transitionedRef.current || punchDoneRef.current) return;
    logGateFlags("videoFailed");
    setVideoFailed(true);
  }, [logGateFlags, onLayoutReady]);

  const onRootLayout = useCallback(
    (event: LayoutChangeEvent) => {
      onLayoutReady();
      const { width, height } = event.nativeEvent.layout;
      beat("rootLayout", width, height);
      rootSizeRef.current = { width, height };
      if (width <= 0 || height <= 0) {
        beat("rootLayout collapsed", width, height);
        return;
      }
      const origin = punchScreenOrigin(width, height);
      const video = splashVideoLayout(width, height);
      videoSizeRef.current = { width: video.width, height: video.height };
      panelH.value = Math.max(height * 0.52, 1);
      setShatterBox({ width, height, ox: origin.x, oy: origin.y, video });
      setFloorCover((prev) =>
        prev.source === "root" && prev.width === width && prev.height === height
          ? prev
          : { width, height, source: "root" },
      );
    },
    [beat, onLayoutReady, panelH],
  );

  const onIceHostsReady = useCallback(() => {
    if (iceHostsReadyRef.current) return;
    iceHostsReadyRef.current = true;
    logGateFlags("iceHostsReady");
    setIceHostsReady(true);
  }, [logGateFlags]);

  /**
   * Empty floor sibling — NOT ScreenStack. Always log, even 0×0.
   * width>0 height===0 is collapsed (absoluteFill top+bottom stretch to a
   * 0-tall parent). Apply explicit height, then floorPainted after extra frames.
   */
  const onFloorLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const { width, height } = event.nativeEvent.layout;
      beat("floorLayout", width, height);
      if (width > 0 && height === 0) {
        beat("floorLayout", width, 0, "— treat as collapsed");
        applyFloorHeightFallback("collapsed-onLayout");
        markFloorPaintedFromFallback();
        return;
      }
      if (!(width > 0 && height > 0)) return;
      if (floorLaidOutRef.current) {
        if (!floorPaintedRef.current && !fadingRef.current) {
          cancelFloorFramesRef.current?.();
          cancelFloorFramesRef.current = runFrameChain(splash.paintExtraFrames, () => {
            if (fadingRef.current) return;
            floorPaintedRef.current = true;
            logGateFlags("floorPainted", { via: "onLayout", w: width, h: height });
            setFloorPainted(true);
          });
        }
        return;
      }
      floorLaidOutRef.current = true;
      cancelFloorFramesRef.current = runFrameChain(splash.paintExtraFrames, () => {
        if (fadingRef.current) return;
        floorPaintedRef.current = true;
        logGateFlags("floorPainted", { via: "onLayout", w: width, h: height });
        setFloorPainted(true);
      });
    },
    [applyFloorHeightFallback, beat, logGateFlags, markFloorPaintedFromFallback],
  );

  const onHomeMiddleLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const { width, height } = event.nativeEvent.layout;
      beat("homeMiddle layout", width, height);
      if (width > 0 && height === 0) {
        beat("homeMiddle layout", width, 0, "— treat as collapsed");
      }
    },
    [beat],
  );

  /**
   * Home children wrapper (absolute-fill). Always log, including 0×0.
   * paintExtraFrames then counts as painted MMA Vision, not just a floor.
   */
  const onHomeContentLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const { width, height } = event.nativeEvent.layout;
      beat("homeSlot layout", width, height);
      if (width > 0 && height === 0) {
        beat("homeSlot layout", width, 0, "— treat as collapsed");
      }
      if (!(width > 0 && height > 0)) return;
      if (homeSlotLaidOutRef.current) return;
      homeSlotLaidOutRef.current = true;
      cancelHomeFramesRef.current = runFrameChain(splash.paintExtraFrames, () => {
        if (fadingRef.current) return;
        homeContentPaintedRef.current = true;
        homePaintedAtRef.current = Date.now();
        beat(
          "homePaint settle",
          width,
          height,
          "holdDone",
          glassHoldDoneRef.current,
          "holdEnd",
          holdEndAtRef.current > 0,
          "sheetRelease",
          sheetReleasedRef.current,
        );
        logGateFlags("home children painted");
        setHomeContentPainted(true);
        onHomeContentPainted?.(width, height);
      });
    },
    [beat, logGateFlags, onHomeContentPainted],
  );

  const armGrowClock = useCallback(
    (meta?: { path: string; timeMs: number; punchLanded: boolean }) => {
      if (growStartedAtRef.current > 0 || growPaintDoneRef.current) {
        beat("growArm skip already", "path", meta?.path ?? "unknown", "timeMs", meta?.timeMs ?? -1);
        return;
      }
      const timeMs = meta?.timeMs ?? punchPtsRef.current;
      const punchLanded = meta?.punchLanded ?? timeMs >= splash.growArmPts;
      cinematicPhaseRef.current = "grow";
      growStartedAtRef.current = Date.now();
      cancelAnimation(growClock);
      growClock.value = 0;
      growFrameT0.value = 0;
      growFrameArmed.value = 1;
      growClock.value = withTiming(
        1,
        {
          duration: splash.crackGrowMs,
          easing: Easing.linear,
        },
        (finished) => {
          runOnJS(startFillFromGrow)("growClock withTiming", finished);
        },
      );
      if (growArmTimerRef.current) {
        clearTimeout(growArmTimerRef.current);
        growArmTimerRef.current = null;
      }
      setGrowClockArmed(true);
      console.log(
        "[splash] crackGrow armed",
        true,
        "growArmPts",
        splash.growArmPts,
        "punchLanded",
        punchLanded,
        "hapticAtMs",
        splash.hapticAtMs,
        "hapticAtMs vs growArm",
        splash.growArmPts - splash.hapticAtMs,
        "timeMs",
        timeMs,
        "path",
        meta?.path ?? "unknown",
        "at punch +",
        punchAtRef.current > 0 ? Date.now() - punchAtRef.current : -1,
        "growArmed",
        true,
        "crackGrowMs",
        splash.crackGrowMs,
        "veinStaggerMs",
        splash.veinStaggerMs,
        "growDurationExpected",
        splash.crackGrowMs,
        "growJsProps",
        GROW_JS_PROPS_MAX,
        "veinCount extra must not delay fillClock",
        true,
        "jsProps fill",
        false,
        "Circle r",
        false,
        "leakSheetWithFill",
        true,
        "colorRadialPunch",
        COLOR_RADIAL_PUNCH,
        "jsPropsWipe",
        false,
        "pauseAtPunch",
        false,
        ...Object.entries({ ...splashPhoneGlassFlags(), ...splashBrandFlags() }).flat(),
        "crackGrowMs",
        splash.crackGrowMs,
      );
      if (growTimerRef.current) clearTimeout(growTimerRef.current);
      growTimerRef.current = setTimeout(() => {
        startFillFromGrow("jsTimeout", false);
      }, splash.crackGrowMs);
    },
    [beat, growClock, growFrameArmed, growFrameT0, startFillFromGrow],
  );

  const onImpact = useCallback(
    (meta?: { path: string; timeMs: number; shutterBeforePunch: boolean }) => {
    if (punchDoneRef.current) return;
    punchDoneRef.current = true;
    punchAtRef.current = Date.now();
    punchPtsRef.current = meta?.timeMs ?? -1;
    fillRampDoneRef.current = false;
    fillStartedAtRef.current = 0;
    growPaintDoneRef.current = false;
    const shutterBeforePunch = meta?.shutterBeforePunch ?? shutterDoneRef.current;
    console.log("[splash] crackGrowMs", splash.crackGrowMs);
    console.log("[splash] veinStaggerMs", splash.veinStaggerMs);
    console.log("[splash] growDurationExpected", splash.crackGrowMs);
    console.log(
      "[splash] punch decision",
      "path",
      meta?.path ?? "unknown",
      "timeMs",
      meta?.timeMs ?? -1,
      "shutterBeforePunch",
      shutterBeforePunch,
      "shutterDone",
      shutterDoneRef.current,
      "premountHosts",
      true,
      "punchMountsShards",
      false,
      "pauseAtPunch",
      false,
      "pngOnGlass",
      "logoOnly",
      true,
      "brand-mark path exists",
      BRAND_MARK_EXISTS,
      "brand-mark",
      BRAND_MARK_ASSET,
      "iceFillUsed",
      true,
      "slogan",
      false,
      "navHidden",
      true,
      "WHEN punch",
      "jsProps fill",
      false,
      "Circle r",
      false,
      "VideoView in Animated",
      false,
      "holdMs",
      splash.glassHoldMs,
      "crackGrowMs",
      splash.crackGrowMs,
      "veinStaggerMs",
      splash.veinStaggerMs,
      "growDurationExpected",
      splash.crackGrowMs,
      "leakSheetWithFill",
      true,
      "colorRadialPunch",
      COLOR_RADIAL_PUNCH,
      "videoPlaybackRate",
      splash.videoPlaybackRate,
      "growArmPts",
      splash.growArmPts,
      "growArmed",
      false,
      "hapticAtMs vs growArm",
      splash.growArmPts - splash.hapticAtMs,
      "rnShutterOnVideo",
      false,
      ...Object.entries({ ...splashPhoneGlassFlags(), ...splashBrandFlags() }).flat(),
      "growJsProps",
      GROW_JS_PROPS_MAX,
    );
    beat("punchAnchor", "path", meta?.path ?? "unknown", "shutterBeforePunch", shutterBeforePunch, "growArmed", false, ...Object.entries({ ...splashPhoneGlassFlags(), ...splashBrandFlags() }).flat());
    if (Platform.OS === "android") {
      beat("SystemChrome punch", "navHidden", true, "hidden true", "translucent unchanged", "WHEN punch");
      RNStatusBar.setHidden(true);
      NavigationBar.setHidden(true);
      void setNavVisibilityAsync("hidden");
    }
    glassFill.value = 0;
    fillClock.value = 0;
    setHasPunchFinished(true);
    if (growArmTimerRef.current) clearTimeout(growArmTimerRef.current);
    growArmTimerRef.current = setTimeout(() => {
      const elapsed = Date.now() - punchAtRef.current;
      console.log(
        "[splash] growArm wall fallback",
        true,
        "growArmAfterPunchMs",
        splash.growArmAfterPunchMs,
        "elapsed",
        elapsed,
        "growArmPts",
        splash.growArmPts,
        "punchLanded",
        true,
        "hapticAtMs",
        splash.hapticAtMs,
        "hapticAtMs vs growArm",
        splash.growArmPts - splash.hapticAtMs,
      );
      armGrowClock({
        path: "wallAfterPunch",
        timeMs: punchPtsRef.current + splash.growArmAfterPunchMs,
        punchLanded: true,
      });
    }, splash.growArmAfterPunchMs);
  },
    [armGrowClock, beat, fillClock, glassFill],
  );

  useEffect(() => {
    console.log(
      "[splash] mmaSplash mount",
      "firstLaunchSkip used",
      false,
      "landingKind",
      "poster",
      "premountHosts",
      true,
      "punchMountsShards",
      false,
      "pauseAtPunch",
      false,
      "pngOnGlass",
      "logoOnly",
      true,
      "brand-mark path exists",
      BRAND_MARK_EXISTS,
      "iceFillUsed",
      true,
      "slogan",
      false,
      "holdMs",
      splash.glassHoldMs,
      "crackGrowMs",
      splash.crackGrowMs,
      "veinStaggerMs",
      splash.veinStaggerMs,
      "growDurationExpected",
      splash.crackGrowMs,
      "videoPlaybackRate",
      splash.videoPlaybackRate,
      "introHoldMs",
      splash.introHoldMs,
      "introWipeMs",
      splash.introWipeMs,
      "growArmPts",
      splash.growArmPts,
      "growArmAfterPunchMs",
      splash.growArmAfterPunchMs,
      "splashUntilPlaying",
      true,
      "seekAfterVisible",
      false,
      "videoViewOpacity",
      1,
      "rnShutterOnVideo",
      false,
      ...Object.entries({ ...splashPhoneGlassFlags(), ...splashBrandFlags() }).flat(),
      "growJsProps",
      GROW_JS_PROPS_MAX,
    );
    onLayoutReady();
  }, [onLayoutReady]);

  useEffect(() => {
    beat("homeSlot", homeSlot == null ? "null" : "mounted");
  }, [beat, homeSlot]);

  useEffect(() => {
    splashClockRef.current = Date.now();
    shutterDoneRef.current = true;
    setShutterDone(true);
    setShutterMounted(false);
    console.log(
      "[splash] shutterHold native splash only",
      "rnShutterOnVideo",
      false,
      "splashUntilPlaying",
      true,
      "holdMs",
      splash.introHoldMs,
      "wipeMs",
      splash.introWipeMs,
      "fromOverlayMount",
      false,
      "shutterDone",
      true,
    );
  }, []);

  useEffect(() => {
    return () => {
      if (growTimerRef.current) clearTimeout(growTimerRef.current);
      if (growArmTimerRef.current) clearTimeout(growArmTimerRef.current);
      if (facetTimerRef.current) clearTimeout(facetTimerRef.current);
      if (fillLockTimerRef.current) clearTimeout(fillLockTimerRef.current);
      if (coverTimerRef.current) clearTimeout(coverTimerRef.current);
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
      if (lockTimerRef.current) clearTimeout(lockTimerRef.current);
      if (paintTimerRef.current) clearTimeout(paintTimerRef.current);
      if (probeTimerRef.current) clearTimeout(probeTimerRef.current);
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
      cancelFloorFramesRef.current?.();
      cancelHomeFramesRef.current?.();
      cancelFinishFramesRef.current?.();
      cancelShardFramesRef.current?.();
      if (shutterHoldTimerRef.current) clearTimeout(shutterHoldTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!glassLocked || !iceHostsReady || !homeContentPainted) return;
    if (!floorPainted && !(floorCover.height > 0 || shatterBox.video.height > 0)) return;
    if (sheetReleased || fadingRef.current) return;
    if (transitionedRef.current && !overlayAliveRef.current) return;
    startShardFly();
  }, [
    floorCover.height,
    floorPainted,
    glassHoldDone,
    glassLocked,
    homeContentPainted,
    iceHostsReady,
    loadProgress,
    shatterBox.video.height,
    sheetReleased,
    startShardFly,
    hudBarFilled,
    hudExitDone,
  ]);

  /**
   * The exit wave plays only once the entrance has finished AND the bar has
   * displayed 100, whichever comes last.
   */
  const onHudEntered = useCallback(() => {
    if (hudPhaseRef.current !== "enter") return;
    const next: SplashHudPhase = hudBarFilledRef.current ? "exit" : "run";
    hudPhaseRef.current = next;
    setHudPhase(next);
  }, []);

  const onHudFilled = useCallback(() => {
    if (hudBarFilledRef.current) return;
    hudBarFilledRef.current = true;
    setHudBarFilled(true);
    if (hudPhaseRef.current === "run") {
      hudPhaseRef.current = "exit";
      setHudPhase("exit");
    }
  }, []);

  const onHudExited = useCallback(() => {
    if (hudExitDoneRef.current) return;
    hudExitDoneRef.current = true;
    setHudExitDone(true);
  }, []);

  /**
   * Children watchdog. Must run even if floorPainted is false (0-height floor
   * used to starve this timer). After giveUp, fly over floor / #090A0C holes.
   */
  useEffect(() => {
    if (!glassLocked || homeContentPainted) return;
    const delay = floorPainted
      ? Math.min(splash.homeContentGiveUpMs, splash.homeContentGiveUpAfterFloorMs)
      : splash.homeContentGiveUpMs;
    const giveUp = setTimeout(() => {
      if (fadingRef.current || sheetReleasedRef.current) return;
      if (homeContentPaintedRef.current) return;
      homeContentGaveUpRef.current = true;
      homeContentPaintedRef.current = true;
      homePaintedAtRef.current = Date.now();
      logGateFlags("homeContentGiveUp — fly over floor", {
        floorPainted: floorPaintedRef.current,
        coverH: coverSizeRef.current.height,
        videoH: videoSizeRef.current.height,
      });
      setHomeContentPainted(true);
    }, delay);
    return () => clearTimeout(giveUp);
  }, [floorPainted, glassLocked, homeContentPainted, logGateFlags]);

  /**
   * Floor watchdog. Ice lock: apply height fallback and mark floorPainted —
   * never overlay-off, never wait forever for Yoga height>0.
   */
  useEffect(() => {
    if (!glassLocked || floorPainted) return;
    const giveUp = setTimeout(() => {
      if (fadingRef.current || sheetReleasedRef.current) return;
      if (floorPaintedRef.current) return;
      if (iceLockIsOnlyCover()) {
        logGateFlags("floorWaitGiveUp — hold ice lock");
        applyFloorHeightFallback("floorWaitGiveUp");
        markFloorPaintedFromFallback();
        return;
      }
      logGateFlags("floorWaitGiveUp — crude leave (no ice lock)");
      finishToApp("noFloor");
    }, splash.floorWaitGiveUpMs);
    return () => clearTimeout(giveUp);
  }, [
    applyFloorHeightFallback,
    finishToApp,
    floorPainted,
    glassLocked,
    iceLockIsOnlyCover,
    logGateFlags,
    markFloorPaintedFromFallback,
  ]);

  // Hang: never during grow/fill/hold. Arm 12s AFTER glassLocked, or after fly.
  // Do not log every tick.
  useEffect(() => {
    let waitingSince = 0;
    const watch = setInterval(() => {
      const phase = cinematicPhaseRef.current;
      if (phase === "grow" || phase === "fill" || phase === "hold") {
        if (phase === "hold" && glassLockedAtRef.current > 0) {
          if (Date.now() - glassLockedAtRef.current < splash.splashHangMs) return;
        } else {
          return;
        }
      }
      if (phase === "fly" || fadingRef.current) return;
      if (phase === "done" || transitionedRef.current) return;
      if (phase === "pre") {
        if (Date.now() - splashClockRef.current < splash.splashHangMs) return;
        goHomeNow();
        return;
      }
      if (glassLockedAtRef.current > 0 && Date.now() - glassLockedAtRef.current < splash.splashHangMs) {
        return;
      }
      if (
        iceHostsReadyRef.current &&
        floorOrVideoSized() &&
        (homeContentPaintedRef.current || homeContentGaveUpRef.current)
      ) {
        const loadGateOpen =
          loadProgressRef.current >= 100 && hudBarFilledRef.current && hudExitDoneRef.current;
        skipFinishLog(
          loadGateOpen
            ? "hang after ice lock — force shard fly"
            : "hang after ice lock — force shard fly past load gate",
          { loadProgress: loadProgressRef.current, barFilled: hudBarFilledRef.current },
        );
        startShardFly(!loadGateOpen);
        return;
      }
      if (iceLockIsOnlyCover()) {
        applyFloorHeightFallback("hang-watchdog");
        markFloorPaintedFromFallback();
        if (waitingSince === 0) {
          waitingSince = Date.now();
          skipFinishLog("hang after ice lock — wait floor/hosts/home");
        }
        return;
      }
      if (waitingSince === 0) {
        waitingSince = Date.now();
        skipFinishLog("hang after ice lock — wait floor/hosts/home");
        return;
      }
      if (Date.now() - waitingSince >= splash.hostWaitGiveUpMs) {
        if (iceLockIsOnlyCover()) {
          skipFinishLog("hang after ice lock — hold ice lock");
          applyFloorHeightFallback("hang-hold");
          markFloorPaintedFromFallback();
          return;
        }
        logGateFlags("hang after ice lock — crude leave");
        finishToApp("hangNoFloor");
      }
    }, 500);
    return () => clearInterval(watch);
  }, [
    applyFloorHeightFallback,
    finishToApp,
    floorOrVideoSized,
    goHomeNow,
    iceLockIsOnlyCover,
    logGateFlags,
    markFloorPaintedFromFallback,
    skipFinishLog,
    startShardFly,
  ]);

  useEffect(() => {
    if (!videoFailed || punchDoneRef.current) return;
    onLayoutReady();
    const hold = setTimeout(() => {
      logGateFlags("videoFailed timeout");
      finishToApp("videoFailed");
    }, splash.hapticAtMs);
    return () => clearTimeout(hold);
  }, [finishToApp, logGateFlags, onLayoutReady, videoFailed]);

  /**
   * LaunchGate hang / lockLeaveTimeout sets splashActive false. Tear down the
   * same way as finishToApp (home in tree → keepVideo false → frames → overlay
   * off). Do not skip this: that was the black screen (overlay gone, no children).
   * finishToApp itself refuses overlay-off mid-fly and while ice lock covers.
   */
  useEffect(() => {
    if (splashActive !== false) return;
    const phase = cinematicPhaseRef.current;
    if (phase === "grow" || phase === "fill" || phase === "hold") {
      skipFinishLog("splashActive false skipped — cinematic", { phase });
      return;
    }
    logGateFlags("splashActive false — enterLive path");
    finishToApp("enterLive");
  }, [finishToApp, logGateFlags, skipFinishLog, splashActive]);

  const showVideo = Boolean(keepVideo && !videoFailed && splashVideoSource != null);
  /**
   * Empty `#090A0C` plate is anti-fighter backup UNDER home while ice/video
   * still exist. After overlay-off it must unmount — elevation 8 + opaque fill
   * otherwise stays a card over native Stack (wrapper onLayout ≠ Dashboard pixels).
   */
  const showFloor = Boolean(floorMounted && overlayAlive);
  const showHomeSlotHost = Boolean(homeSlot != null || splashActive === false);
  const liveHome = !overlayAlive;
  const showOverlay = Boolean(overlayAlive);
  const showSheet = Boolean(
    overlayAlive && hasPunchFinished && shouldShowBackupIceSheet(sheetReleased),
  );
  /**
   * Hold HUD only, mounted at glass lock (crack pipeline done). Keep a stable 0
   * while the crack grows so load setState does not re-render mid-vein.
   * Unmount as soon as the exit wave finishes (`hudExitDone`) so the pale
   * air disc cannot linger through fly — do not wait for sheetReleased alone.
   */
  const showHoldProgress = Boolean(glassLocked && !sheetReleased && !hudExitDone);
  const holdBarProgress = showHoldProgress ? loadProgress : 0;
  /**
   * Do not use `bottom`/`right` from absoluteFill: those stretch to a 0-tall
   * parent. left+top + explicit w/h is the fill that actually paints.
   */
  const coverBoxStyle = {
    width: floorCover.width,
    height: floorCover.height,
    minWidth: floorCover.width,
    minHeight: floorCover.height,
  };

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={vi.a11y.splash}
      style={styles.root}
      collapsable={false}
      needsOffscreenAlphaCompositing={false}
      renderToHardwareTextureAndroid={false}
      onLayout={onRootLayout}
    >
      {keepVideo ? (
        <View pointerEvents="none" collapsable={false} style={styles.blackBehind} />
      ) : null}
      {keepVideo ? (
        <View
          collapsable={false}
          needsOffscreenAlphaCompositing={false}
          renderToHardwareTextureAndroid={false}
          style={styles.videoLayer}
    >
      {showVideo && splashVideoSource != null ? (
        <SplashErrorBoundary fallback={null} onError={failVideo}>
          <SplashVideoPlayer
            source={splashVideoSource}
                layoutWidth={shatterBox.video.width}
                layoutHeight={shatterBox.video.height}
                layoutLeft={shatterBox.video.left}
                layoutTop={shatterBox.video.top}
            onFail={failVideo}
                onImpact={onImpact}
                onGrowArm={armGrowClock}
                onFirstFrame={onFirstFrame}
                onWalkVisible={onWalkVisible}
                shutterDone={shutterDone}
          />
        </SplashErrorBoundary>
      ) : (
        <SplashFallback />
      )}
        </View>
      ) : null}
      {showFloor ? (
        <View
          pointerEvents="none"
          collapsable={false}
          style={[styles.floorSibling, coverBoxStyle]}
          onLayout={onFloorLayout}
        />
      ) : null}
      {showHomeSlotHost ? (
        <View
          pointerEvents="auto"
          collapsable={false}
          style={
            liveHome
              ? styles.homeSlotHostLive
              : [styles.homeSlotHost, coverBoxStyle]
          }
          onLayout={onHomeMiddleLayout}
        >
          {homeSlot != null ? (
            <View
              pointerEvents="auto"
              collapsable={false}
              style={
                liveHome
                  ? styles.homeContentLive
                  : [styles.homeContent, coverBoxStyle]
              }
              onLayout={onHomeContentLayout}
            >
              {homeSlot}
            </View>
          ) : null}
        </View>
      ) : null}
      {overlayAlive && shutterMounted ? (
        <View pointerEvents="none" collapsable={false} style={styles.introShutter}>
          <Animated.View pointerEvents="none" collapsable={false} style={[styles.shutterBar, styles.shutterTop, topBarStyle]} />
          <Animated.View pointerEvents="none" collapsable={false} style={[styles.shutterBar, styles.shutterBottom, bottomBarStyle]} />
        </View>
      ) : null}
      {showOverlay ? (
        <View
          pointerEvents={hasPunchFinished ? (sheetReleased ? "none" : "auto") : "none"}
          collapsable={false}
          style={hasPunchFinished ? styles.overlayStack : styles.overlayPremount}
        >
          {showSheet ? (
            <Animated.View pointerEvents="none" collapsable={false} style={[styles.glassFill, glassFillStyle]} />
          ) : null}
          <View pointerEvents="none" collapsable={false} style={styles.crackLayer}>
            <SplashGlassShatter
              width={shatterBox.width}
              height={shatterBox.height}
              originX={shatterBox.ox}
              originY={shatterBox.oy}
              fillClock={fillClock}
              flyMs={flyMs}
              strokeFade={strokeFade}
              onIceHostsReady={onIceHostsReady}
              growArmed={growClockArmed}
              growClock={growClock}
            />
          </View>
          {showHoldProgress ? (
            <View pointerEvents="none" collapsable={false} style={styles.hudLayer}>
              <SplashHudOverlay
                progress={holdBarProgress}
                width={shatterBox.width}
                height={shatterBox.height}
                originX={shatterBox.ox}
                originY={shatterBox.oy}
                phase={hudPhase}
                onEntered={onHudEntered}
                onExited={onHudExited}
                onFilled={onHudFilled}
              />
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "transparent",
    overflow: "visible",
  },
  blackBehind: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: splash.canvas,
    zIndex: 0,
    elevation: 0,
  },
  videoLayer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "transparent",
    overflow: "visible",
    zIndex: 1,
    elevation: 0,
  },
  // Empty floor SIBLING — own onLayout, never nests ScreenStack.
  // Opaque #090A0C above TextureView, BELOW overlayStack and homeSlotHost.
  // absoluteFill's bottom:0 collapsed this to parent height 0; fill = left/top
  // + explicit width/height from videoLayout / root / window (see coverBoxStyle).
  floorSibling: {
    position: "absolute",
    left: 0,
    top: 0,
    backgroundColor: palettes.dark.bg,
    zIndex: 2,
    elevation: 8,
  },
  // LockedStack / home children — DIFFERENT sibling from the floor gate.
  homeSlotHost: {
    position: "absolute",
    left: 0,
    top: 0,
    backgroundColor: palettes.dark.bg,
    zIndex: 3,
    elevation: 9,
  },
  // After overlay-off: no elevated opaque plate. Native ScreenContainer needs
  // a flex ancestor, not an Android card (elevation) wrapping the Stack.
  homeSlotHostLive: {
    flex: 1,
    backgroundColor: palettes.dark.bg,
    zIndex: 1,
    elevation: 0,
  },
  homeContent: {
    position: "absolute",
    left: 0,
    top: 0,
  },
  homeContentLive: {
    flex: 1,
  },
  introShutter: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "transparent",
    overflow: "hidden",
    zIndex: 4,
    elevation: 6,
  },
  shutterBar: {
    position: "absolute",
    left: 0,
    right: 0,
    height: "52%",
    backgroundColor: splash.canvas,
  },
  shutterTop: {
    top: 0,
  },
  shutterBottom: {
    bottom: 0,
  },
  // Transparent host, but its Z must stay above homeMiddle for the whole
  // cinematic — dropping it to 0 on sheetRelease let the home layer draw over
  // the flying pieces (Android sorts siblings by elevation, and a child's own
  // elevation cannot lift it above an uncle view).
  overlayPremount: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "transparent",
    overflow: "visible",
    zIndex: 3,
    elevation: 4,
  },
  overlayStack: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "transparent",
    overflow: "visible",
    zIndex: 8,
    elevation: 22,
  },
  glassFill: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: splash.glassFillColor,
    zIndex: 1,
    // Backup behind FacetShard FACE_FILLS (gaps only). Frosted milky pane, not #000.
    elevation: 0,
  },
  crackLayer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "transparent",
    overflow: "visible",
    zIndex: 10,
    elevation: 24,
  },
  /** Single hold HUD above crack mesh; unmounted when exit finishes. */
  hudLayer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "transparent",
    overflow: "visible",
    zIndex: 12,
    elevation: 26,
  },
  fallback: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: splash.canvas,
  },
});
