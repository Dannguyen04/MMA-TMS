import { useCallback, useEffect, useRef } from "react";
import { Platform, StyleSheet, type LayoutChangeEvent } from "react-native";
import * as Haptics from "expo-haptics";
import * as SplashScreen from "expo-splash-screen";
import { useVideoPlayer, VideoView, type VideoContentFit } from "expo-video";

import { splash } from "@/theme/splash";
import { ANDROID_ASSET_URI, ANDROID_RAW_NAME, ANDROID_RESOURCE_URI } from "./splash-video-source";
import { splashPhoneGlassFlags } from "./splash-glass-mesh";
import { splashBrandFlags } from "./splash-landing-marks";
import type { SplashVideoPlayerProps } from "./splash-video-types";

export type { SplashVideoPlayerProps };

const RETRY_URIS = [ANDROID_RAW_NAME, ANDROID_RESOURCE_URI, ANDROID_ASSET_URI] as const;

/** Must match ContentFit.FILL("fill") → AspectRatioFrameLayout.RESIZE_MODE_FILL. Not "COVER"/contain. */
const ANDROID_CONTENT_FIT: VideoContentFit = "fill";
/** Current tree combo: FILL + textureView. Do not flip to cover. Keep Exo shutter as-is (true). */
const USE_EXO_SHUTTER = true;

export function SplashVideoPlayer({
  source,
  onFail,
  onImpact,
  onGrowArm,
  onFirstFrame,
  onWalkVisible,
  shutterDone,
  layoutWidth,
  layoutHeight,
  layoutLeft,
  layoutTop,
}: SplashVideoPlayerProps) {
  const hapticFired = useRef(false);
  const failed = useRef(false);
  const retryIndex = useRef(0);
  const paintedFrame = useRef(false);
  const lastTimeMs = useRef(0);
  const startedPlay = useRef(false);
  const hasNonZeroLayout = useRef(false);
  const tailLoopAllowed = useRef(true);
  const tailLoopArmed = useRef(false);
  const lastTailSeekAt = useRef(0);
  const shutterDoneRef = useRef(shutterDone);
  shutterDoneRef.current = shutterDone;
  const queuedPathRef = useRef<string | null>(null);
  const seekedZeroOnce = useRef(false);
  const walkVisibleFired = useRef(false);
  const growArmedRef = useRef(false);
  const nativeHiddenRef = useRef(false);
  const hideAttemptLoggedRef = useRef(0);
  const startPlayLogRef = useRef(0);

  useEffect(() => {
    console.log(
      "[splash] mount",
      "videoPlaybackRate",
      splash.videoPlaybackRate,
      "hapticAtMs",
      splash.hapticAtMs,
      "punchMinMediaMs",
      splash.punchMinMediaMs,
      "growArmPts",
      splash.growArmPts,
      "growArmAfterPunchMs",
      splash.growArmAfterPunchMs,
      "nativeSplashHideMaxPts",
      splash.nativeSplashHideMaxPts,
      "splashUntilPlaying",
      true,
      "seekAfterVisible",
      false,
      "videoViewOpacity",
      1,
      "useExoShutter",
      USE_EXO_SHUTTER,
      "contentFit",
      ANDROID_CONTENT_FIT,
      "surfaceType",
      Platform.OS === "android" ? "textureView" : "n/a",
      "VideoView in Animated",
      false,
      "expo-av",
      false,
    );
  }, []);

  const fail = useCallback(() => {
    if (failed.current) return;
    failed.current = true;
    hapticFired.current = true;
    console.log("[splash] videoFailed fireImpact allowed early", true, "timeMs", lastTimeMs.current);
    if (!nativeHiddenRef.current) {
      nativeHiddenRef.current = true;
      console.log(
        "[splash] hideAsync",
        "when",
        "videoFailed",
        "splashUntilPlaying",
        true,
        "playing",
        false,
      );
      void SplashScreen.hideAsync();
    }
    onFail();
  }, [onFail]);

  const player = useVideoPlayer(
    source.assetId != null ? source.assetId : (source.uri ?? null),
    (instance) => {
      try {
        instance.loop = false;
        // Web autoplay policy requires muted (+ playsInline on VideoView).
        instance.muted = true;
        instance.timeUpdateEventInterval = 0.04;
        instance.playbackRate = splash.videoPlaybackRate;
        try {
          instance.currentTime = 0;
        } catch {
          // Seek 0 is best-effort before first buffer. Do not play until duration > 0.
        }
        const dur = instance.duration;
        console.log(
          "[splash] playbackRate",
          splash.videoPlaybackRate,
          "seekStart",
          0,
          "exists",
          true,
          "play",
          false,
          "duration",
          dur,
          "durationGt0",
          Number.isFinite(dur) && dur > 0,
          "splashUntilPlaying",
          true,
          "seekAfterVisible",
          false,
        );
      } catch {
        fail();
      }
    },
  );

  const logMedia = useCallback(
    (label: string, extra?: Record<string, unknown>) => {
      let currentTime = Number.NaN;
      let duration = Number.NaN;
      let playbackRate = Number.NaN;
      try {
        currentTime = player.currentTime;
        duration = player.duration;
        playbackRate = player.playbackRate;
      } catch {
        // Player may not be ready.
      }
      const timeMs = Number.isFinite(currentTime) ? currentTime * 1000 : lastTimeMs.current;
      console.log(
        "[splash]",
        label,
        "currentTime",
        currentTime,
        "duration",
        duration,
        "playbackRate",
        playbackRate,
        "timeMs",
        timeMs,
        "lastTimeMs",
        lastTimeMs.current,
        "hapticAtMs",
        splash.hapticAtMs,
        "punchMinMediaMs",
        splash.punchMinMediaMs,
        "growArmPts",
        splash.growArmPts,
        "growArmed",
        growArmedRef.current,
        "hapticAtMs vs growArm",
        splash.growArmPts - splash.hapticAtMs,
        "shutterDone",
        shutterDoneRef.current,
        "hapticFired",
        hapticFired.current,
        "failed",
        failed.current,
        "nativeHidden",
        nativeHiddenRef.current,
        "splashUntilPlaying",
        true,
        "seekAfterVisible",
        false,
        "videoViewOpacity",
        1,
        "useExoShutter",
        USE_EXO_SHUTTER,
        ...(extra ? Object.entries(extra).flat() : []),
      );
    },
    [player],
  );

  const noteWalkVisible = useCallback(
    (timeMs: number) => {
      if (walkVisibleFired.current) return;
      if (!paintedFrame.current) return;
      if (!(timeMs >= 0) || timeMs >= splash.introWipeArmMediaMs) return;
      walkVisibleFired.current = true;
      console.log("[splash] walkVisible", "timeMs", timeMs, "wipeArmMs", splash.introWipeArmMediaMs);
      onWalkVisible?.(timeMs);
    },
    [onWalkVisible],
  );

  const tryHideNativeSplash = useCallback(
    (why: string) => {
      let currentTime = Number.NaN;
      let duration = Number.NaN;
      let playing = false;
      try {
        currentTime = player.currentTime;
        duration = player.duration;
        playing = player.playing === true;
      } catch {
        // Player may not be ready.
      }
      const timeMs = Number.isFinite(currentTime) ? currentTime * 1000 : lastTimeMs.current;
      const durationGt0 = Number.isFinite(duration) && duration > 0;
      const nearZero =
        Number.isFinite(timeMs) && timeMs >= 0 && timeMs <= splash.nativeSplashHideMaxPts;
      const stillWalk =
        Number.isFinite(timeMs) && timeMs >= 0 && timeMs < splash.punchMinMediaMs;
      const ready =
        playing &&
        durationGt0 &&
        (nearZero || (paintedFrame.current && seekedZeroOnce.current && stillWalk));
      if (nativeHiddenRef.current) {
        return;
      }
      hideAttemptLoggedRef.current += 1;
      if (hideAttemptLoggedRef.current <= 8 || ready) {
        console.log(
          "[splash] hideAsync decision",
          "why",
          why,
          "ready",
          ready,
          "playing",
          playing,
          "duration",
          duration,
          "durationGt0",
          durationGt0,
          "currentTime",
          currentTime,
          "timeMs",
          timeMs,
          "nearZero",
          nearZero,
          "stillWalk",
          stillWalk,
          "nativeSplashHideMaxPts",
          splash.nativeSplashHideMaxPts,
          "splashUntilPlaying",
          true,
          "seekAfterVisible",
          false,
          "videoViewOpacity",
          1,
          "nativeHidden",
          false,
        );
      }
      if (!ready) return;
      nativeHiddenRef.current = true;
      console.log(
        "[splash] hideAsync",
        "when",
        why,
        "playing",
        true,
        "currentTime≈0",
        nearZero,
        "timeMs",
        timeMs,
        "duration",
        duration,
        "splashUntilPlaying",
        true,
        "seekAfterVisible",
        false,
        "videoViewOpacity",
        1,
        "exists",
        true,
      );
      void SplashScreen.hideAsync();
    },
    [player],
  );

  const maybeGrowArm = useCallback(
    (path: string) => {
      if (growArmedRef.current || failed.current) return;
      if (!hapticFired.current) {
        return;
      }
      let currentTime = lastTimeMs.current / 1000;
      try {
        currentTime = player.currentTime;
      } catch {
        // lastTimeMs
      }
      const timeMs = Number.isFinite(currentTime) ? currentTime * 1000 : lastTimeMs.current;
      lastTimeMs.current = timeMs;
      const punchLanded = timeMs >= splash.growArmPts;
      if (!punchLanded) {
        return;
      }
      growArmedRef.current = true;
      console.log(
        "[splash] growArm",
        "path",
        path,
        "growArmPts",
        splash.growArmPts,
        "punchLanded",
        true,
        "hapticAtMs",
        splash.hapticAtMs,
        "hapticAtMs vs growArm",
        splash.growArmPts - splash.hapticAtMs,
        "timeMs",
        timeMs,
        "exists",
        true,
        ...Object.entries({ ...splashPhoneGlassFlags(), ...splashBrandFlags() }).flat(),
      );
      onGrowArm({ path, timeMs, punchLanded: true });
    },
    [onGrowArm, player],
  );

  const onPaintedFirstFrame = useCallback(() => {
    if (paintedFrame.current) return;
    paintedFrame.current = true;
    let timeMs = lastTimeMs.current;
    try {
      const t = player.currentTime;
      if (Number.isFinite(t)) timeMs = t * 1000;
    } catch {
      // lastTimeMs
    }
    lastTimeMs.current = timeMs;
    let playing = false;
    let duration = Number.NaN;
    try {
      playing = player.playing === true;
      duration = player.duration;
    } catch {
      // best-effort
    }
    logMedia("firstFrame", {
      seekAfterVisible: false,
      videoViewOpacity: 1,
      splashUntilPlaying: true,
      playing,
      durationGt0: Number.isFinite(duration) && duration > 0,
    });
    console.log(
      "[splash] firstFrame seek0",
      false,
      "seekAfterVisible",
      false,
      "wasTimeMs",
      timeMs,
      "videoViewOpacity",
      1,
    );
    onFirstFrame({ timeMs });
    noteWalkVisible(timeMs);
    tryHideNativeSplash("firstFrame");
  }, [logMedia, noteWalkVisible, onFirstFrame, player, tryHideNativeSplash]);

  const startPlay = useCallback(() => {
    if (failed.current || startedPlay.current) return;
    let duration = Number.NaN;
    let currentTime = Number.NaN;
    try {
      duration = player.duration;
      currentTime = player.currentTime;
    } catch {
      // Player may not be ready.
    }
    const durationGt0 = Number.isFinite(duration) && duration > 0;
    const shouldLogStart = !startedPlay.current && (durationGt0 || startPlayLogRef.current < 8);
    if (shouldLogStart) {
      startPlayLogRef.current += 1;
      console.log(
        "[splash] startPlay",
        "duration",
        duration,
        "durationGt0",
        durationGt0,
        "currentTime",
        currentTime,
        "playbackRate",
        splash.videoPlaybackRate,
        "seekStart",
        0,
        "seekAfterVisible",
        false,
        "splashUntilPlaying",
        true,
        "videoViewOpacity",
        1,
        "play",
        durationGt0,
      );
    }
    if (!durationGt0) {
      return;
    }
    startedPlay.current = true;
    try {
      player.playbackRate = splash.videoPlaybackRate;
      if (!seekedZeroOnce.current) {
        seekedZeroOnce.current = true;
        try {
          player.currentTime = 0;
        } catch {
          // Seek 0 only before first visible reveal.
        }
      }
      console.log(
        "[splash] startPlay play",
        true,
        "duration",
        player.duration,
        "seekAfterVisible",
        false,
        "videoViewOpacity",
        1,
      );
      player.play();
      if (Platform.OS === "web") {
        console.log("[splash] web video play started", "duration", player.duration);
      }
      tryHideNativeSplash("startPlay");
    } catch {
      fail();
    }
  }, [fail, player, tryHideNativeSplash]);

  const fireImpact = useCallback(
    (path: string) => {
      if (hapticFired.current || failed.current) {
        return;
      }
      let currentTime = lastTimeMs.current / 1000;
      let duration = Number.NaN;
      let playbackRate = splash.videoPlaybackRate;
      try {
        currentTime = player.currentTime;
        duration = player.duration;
        playbackRate = player.playbackRate;
      } catch {
        // Use lastTimeMs.
      }
      const timeMs = Number.isFinite(currentTime) ? currentTime * 1000 : lastTimeMs.current;
      lastTimeMs.current = timeMs;
      const shutterBeforePunch = shutterDoneRef.current === true;
      console.log(
        "[splash] punch candidate",
        "path",
        path,
        "currentTime",
        currentTime,
        "duration",
        duration,
        "playbackRate",
        playbackRate,
        "timeMs",
        timeMs,
        "hapticAtMs",
        splash.hapticAtMs,
        "punchMinMediaMs",
        splash.punchMinMediaMs,
        "shutterDone",
        shutterBeforePunch,
        "hapticFired",
        hapticFired.current,
        "failed",
        failed.current,
      );

      if (hapticFired.current || failed.current) {
        return;
      }

      if (timeMs < splash.punchMinMediaMs) {
        console.log(
          "[splash] punch refuse",
          "path",
          path,
          "timeMs",
          timeMs,
          "< punchMinMediaMs",
          splash.punchMinMediaMs,
          "true",
          "unlessFailed",
          failed.current,
        );
        return;
      }

      if (timeMs < splash.hapticAtMs) {
        console.log(
          "[splash] punch refuse",
          "path",
          path,
          "timeMs",
          timeMs,
          "< hapticAtMs",
          splash.hapticAtMs,
          "true",
        );
        return;
      }

      if (!shutterBeforePunch) {
        queuedPathRef.current = path;
        console.log(
          "[splash] punch deferred",
          "path",
          path,
          "shutterDone",
          false,
          "shutterBeforePunch",
          false,
          "timeMs",
          timeMs,
        );
        return;
      }

      hapticFired.current = true;
      queuedPathRef.current = null;
      console.log(
        "[splash] punch",
        "path",
        path,
        "currentTime",
        currentTime,
        "duration",
        duration,
        "playbackRate",
        playbackRate,
        "timeMs",
        timeMs,
        "shutterBeforePunch",
        true,
        "pauseAtPunch",
        false,
        "premountHosts",
        true,
        "punchMountsShards",
        false,
        "growArmPts",
        splash.growArmPts,
        "growArmed",
        false,
        "hapticAtMs vs growArm",
        splash.growArmPts - splash.hapticAtMs,
        ...Object.entries({ ...splashPhoneGlassFlags(), ...splashBrandFlags() }).flat(),
      );
      onImpact({ path, timeMs, shutterBeforePunch: true });
      maybeGrowArm(path);
      try {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
      } catch {
        // Haptics are optional.
      }
    },
    [maybeGrowArm, onImpact, player],
  );

  useEffect(() => {
    if (!shutterDone || hapticFired.current || failed.current) return;
    if (queuedPathRef.current) {
      fireImpact(queuedPathRef.current);
      return;
    }
    if (lastTimeMs.current >= splash.hapticAtMs) {
      fireImpact("shutterDone");
    }
  }, [fireImpact, shutterDone]);

  /** Seek start = max(0, duration − videoTailLoopMs/1000). 0 only if duration < tail. */
  const tailSeekStartSec = useCallback((duration: number) => {
    return Math.max(0, duration - splash.videoTailLoopMs / 1000);
  }, []);

  const armTailLoop = useCallback(() => {
    if (tailLoopArmed.current || !tailLoopAllowed.current || failed.current) return;
    tailLoopArmed.current = true;
    try {
      player.loop = false;
      player.playbackRate =
        splash.videoTailLoopRate !== 1
          ? splash.videoTailLoopRate
          : splash.videoPlaybackRate;
    } catch {
      // rate is best-effort
    }
  }, [player]);

  const loopVideoTail = useCallback(() => {
    if (!tailLoopAllowed.current || failed.current) {
      return;
    }
    try {
      const duration = player.duration;
      if (!(duration > 0)) return;
      const start = tailSeekStartSec(duration);
      const now = player.currentTime;
      const remaining = duration - now;
      if (now >= start + 0.04 && remaining > splash.videoTailSeekLeadSec) {
        if (!player.playing) {
          player.play();
        }
        return;
      }
      if (remaining > splash.videoTailSeekLeadSec && now < duration - 0.02) {
        return;
      }
      if (Math.abs(now - start) < 0.05) {
        if (!player.playing) {
          player.play();
        }
        return;
      }
      const t = Date.now();
      if (t - lastTailSeekAt.current < splash.videoTailSeekCooldownMs) {
        return;
      }
      lastTailSeekAt.current = t;
      player.currentTime = start;
      if (!player.playing) {
        player.play();
      }
    } catch {
      // Seek is best-effort; unmount pause still stops playback.
    }
  }, [player, tailSeekStartSec]);

  const retryNextSource = useCallback(() => {
    if (Platform.OS !== "android") return false;
    while (retryIndex.current < RETRY_URIS.length) {
      const next = RETRY_URIS[retryIndex.current];
      retryIndex.current += 1;
      if (next === source.uri) continue;
      try {
        void player
          .replaceAsync({ uri: next })
          .then(() => {
            startedPlay.current = false;
            player.playbackRate = splash.videoPlaybackRate;
            try {
              player.currentTime = 0;
            } catch {
              // Seek 0 after replace, before play.
            }
            startPlay();
          })
          .catch(() => {
            if (!retryNextSource()) fail();
          });
        return true;
      } catch {
        continue;
      }
    }
    return false;
  }, [fail, player, source.uri, startPlay]);

  const onTimeUpdate = useCallback(
    (currentTimeSeconds: number) => {
      try {
        const timeMs = currentTimeSeconds * 1000;
        lastTimeMs.current = timeMs;
        noteWalkVisible(timeMs);
        tryHideNativeSplash("timeUpdate");
        startPlay();
        if (!failed.current && timeMs >= splash.punchMinMediaMs) {
          fireImpact("timeUpdate");
        }
        maybeGrowArm("timeUpdate");
        const duration = player.duration;
        if (!(duration > 0)) return;
        const remainingSec = duration - currentTimeSeconds;
        if (hapticFired.current) {
          armTailLoop();
        }
        if (remainingSec <= splash.videoTailSeekLeadSec) {
          loopVideoTail();
        }
      } catch {
        fail();
      }
    },
    [armTailLoop, fail, fireImpact, loopVideoTail, maybeGrowArm, noteWalkVisible, player, startPlay, tryHideNativeSplash],
  );

  const onVideoLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const { width, height } = event.nativeEvent.layout;
      console.log("[splash] videoLayout", width, height, "exists", width > 0 && height > 0);
      if (width <= 0 || height <= 0) return;
      if (!hasNonZeroLayout.current) {
        hasNonZeroLayout.current = true;
      }
      startPlay();
    },
    [startPlay],
  );

  useEffect(() => {
    const timeSub = player.addListener("timeUpdate", (event) => {
      onTimeUpdate(event.currentTime);
    });
    const endSub = player.addListener("playToEnd", () => {
      let timeMs = lastTimeMs.current;
      try {
        timeMs = player.currentTime * 1000;
        lastTimeMs.current = timeMs;
      } catch {
        // lastTimeMs
      }
      console.log(
        "[splash] playToEnd",
        "currentTime",
        timeMs / 1000,
        "duration",
        player.duration,
        "playbackRate",
        player.playbackRate,
        "timeMs",
        timeMs,
        "hapticAtMs",
        splash.hapticAtMs,
        "growArmPts",
        splash.growArmPts,
        "playToEnd punch",
        false,
      );
      if (failed.current) return;
      if (lastTimeMs.current < 200 && retryNextSource()) {
        console.log("[splash] playToEnd retry source", true, "timeMs", lastTimeMs.current, "punch", false);
        return;
      }
      if (timeMs < splash.hapticAtMs) {
        console.log(
          "[splash] playToEnd refuse punch",
          true,
          "timeMs",
          timeMs,
          "< hapticAtMs",
          splash.hapticAtMs,
          "true",
        );
        armTailLoop();
        loopVideoTail();
        return;
      }
      console.log("[splash] playToEnd punch", false, "wrap tail", true, "timeMs", timeMs);
      armTailLoop();
      loopVideoTail();
    });
    const statusSub = player.addListener("statusChange", (event) => {
      console.log(
        "[splash] statusChange",
        "status",
        event.status,
        "duration",
        player.duration,
        "playing",
        player.playing,
        "startedPlay",
        startedPlay.current,
      );
      if (event.status === "error") {
        if (!retryNextSource()) fail();
        return;
      }
      startPlay();
      tryHideNativeSplash("statusChange");
    });
    const playingSub = player.addListener("playingChange", (event) => {
      console.log(
        "[splash] playingChange",
        "isPlaying",
        event.isPlaying,
        "timeMs",
        lastTimeMs.current,
        "hapticFired",
        hapticFired.current,
        "duration",
        player.duration,
        "videoViewOpacity",
        1,
      );
      if (event.isPlaying) {
        tryHideNativeSplash("playingChange");
        maybeGrowArm("playingChange");
        return;
      }
      if (!tailLoopAllowed.current || failed.current) return;
      if (!startedPlay.current && !paintedFrame.current) return;
      try {
        const duration = player.duration;
        const now = player.currentTime;
        if (duration > 0 && now >= duration - splash.videoTailSeekLeadSec) {
          loopVideoTail();
          return;
        }
        player.play();
        console.log("[splash] playingChange re-play", true, "timeMs", lastTimeMs.current);
      } catch {
        // Keep-alive is best-effort; unmount still wins via tailLoopAllowed.
      }
    });
    return () => {
      timeSub.remove();
      endSub.remove();
      statusSub.remove();
      playingSub.remove();
    };
  }, [armTailLoop, fail, fireImpact, loopVideoTail, maybeGrowArm, onTimeUpdate, player, retryNextSource, startPlay, tryHideNativeSplash]);

  useEffect(() => {
    const waitDuration = setInterval(() => {
      if (failed.current || startedPlay.current) return;
      startPlay();
    }, 50);
    return () => clearInterval(waitDuration);
  }, [startPlay]);

  useEffect(() => {
    const punchHold = setInterval(() => {
      if (failed.current) return;
      if (!hapticFired.current && lastTimeMs.current >= splash.punchMinMediaMs) {
        fireImpact("poll");
      }
      maybeGrowArm("poll");
    }, 40);
    return () => clearInterval(punchHold);
  }, [fireImpact, maybeGrowArm]);

  useEffect(() => {
    return () => {
      tailLoopAllowed.current = false;
      try {
        player.pause();
      } catch {
        // Unmount must stay silent.
      }
    };
  }, [player]);

  const videoW = layoutWidth > 1 ? layoutWidth : "100%";
  const videoH = layoutHeight > 1 ? layoutHeight : "100%";

  return (
    <VideoView
      player={player}
      style={[
        styles.video,
        {
          position: "absolute",
          width: videoW,
          height: videoH,
          left: layoutLeft,
          top: layoutTop,
          opacity: 1,
          pointerEvents: "none",
        },
      ]}
      contentFit={ANDROID_CONTENT_FIT}
      nativeControls={false}
      // Web: muted player + playsInline so browsers allow autoplay.
      playsInline={Platform.OS === "web" ? true : undefined}
      // FILL + useExoShutter true (current tree). cover+true still BANNED.
      // Do not flip to false here — FILL+false is changelog-later; fighter
      // would risk a black Exo shutter if we change blindly.
      useExoShutter={USE_EXO_SHUTTER}
      surfaceType={Platform.OS === "android" ? "textureView" : undefined}
      collapsable={false}
      needsOffscreenAlphaCompositing={false}
      renderToHardwareTextureAndroid={false}
      onLayout={onVideoLayout}
      onFirstFrameRender={onPaintedFirstFrame}
    />
  );
}

const styles = StyleSheet.create({
  video: {
    backgroundColor: "transparent",
    opacity: 1,
  },
});
