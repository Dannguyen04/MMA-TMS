import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Image, StyleSheet, View } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle, Defs, RadialGradient, Stop } from "react-native-svg";

import { splash } from "@/theme/splash";
import { fonts } from "@/theme/typography";

const SPLASH_LOGO = require("../../../assets/remove-bg-icon.png");

/** Brand red, pushed hot so it reads on pale glass. */
const ACCENT = "#e10600";
const CORE = "#fff4f2";
const TITLE_INK = "#07080a";

/** Max slit length as a fraction of screen width. */
export const SLIT_MAX_WIDTH_RATIO = 0.56;
const SLIT_H = 3;
const CORE_H = 1;
/** Idle weld before the bar moves, as a fraction of the full slit. */
const WELD_IDLE = 0.28;
/** Air expands from the crack until it has washed the pane. Linear, so the front does not lurch. */
export const HUD_ENTER_MS = 1800;
/**
 * A second wave leaves the crack and wipes the lockup.
 * It does not pull the words apart.
 */
export const HUD_EXIT_MS = 1400;
/** Per-step ease while the bar follows a load that is still in flight. */
export const HUD_FOLLOW_MS = 180;

/**
 * Fill duration for the whole time the bar is shown. Chosen once, when the
 * bar first becomes visible: load already 100 → short fast-forward from the
 * displayed value; otherwise follow each real step.
 */
export function splashHudFillMs(loadDoneWhenShown: boolean): number {
  return loadDoneWhenShown ? splash.hudFastForwardMs : HUD_FOLLOW_MS;
}

/**
 * Fixed bitmap size for both air discs. Geometry never resizes during the
 * animation — only the parent transform scale changes on the UI thread.
 * Large cover*2 SVGs (1.3–2k px) were the remaining scale jank.
 */
export const WAVE_TEX_SIZE = 512;
const WAVE_HALF = WAVE_TEX_SIZE / 2;

export type SplashHudPhase = "enter" | "run" | "exit";

const LINE_TITLE = "MMA Vision";

/**
 * Pure helper: visual progress (0–100) → slit length ratio (0–1).
 * Multiplied by `width * SLIT_MAX_WIDTH_RATIO` for the on-screen slit.
 */
export function splashSlitWidthRatio(progress: number): number {
  const p = Math.max(0, Math.min(100, progress));
  return p / 100;
}

/** Distance from the crack to the far corner — the air region's full reach. */
export function airCoverRadius(
  width: number,
  height: number,
  originX: number,
  originY: number,
): number {
  const corners = [
    Math.hypot(originX, originY),
    Math.hypot(width - originX, originY),
    Math.hypot(originX, height - originY),
    Math.hypot(width - originX, height - originY),
  ];
  return Math.max(...corners, 1);
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const span = edge1 - edge0;
  if (span <= 0) return x >= edge1 ? 1 : 0;
  const t = Math.max(0, Math.min(1, (x - edge0) / span));
  return t * t * (3 - 2 * t);
}

/**
 * How much of a glyph the air has lit.
 * Stays 0 until the front reaches the glyph, then fades in across `feather`.
 * The feather must not light anything ahead of the front.
 */
export function glyphReveal(radius: number, distance: number, feather: number): number {
  "worklet";
  const band = Math.max(feather, 1);
  const span = band;
  const t = Math.max(0, Math.min(1, (radius - distance) / span));
  return t * t * (3 - 2 * t);
}

/**
 * Exit opacity of the air. Radius does not shrink — only this falls.
 * A short brightening at the start is the pressure leaving the pane.
 */
export function airVentOpacity(vent: number): number {
  "worklet";
  const t = Math.max(0, Math.min(1, vent));
  if (t < 0.18) return 1 + t * 0.35;
  return Math.max(0, 1.06 * (1 - (t - 0.18) / 0.82));
}

/** Signed split along the slit. Title uses the negative, the lower line the positive. */
export function exitSplitY(vent: number, travel: number): number {
  const t = Math.max(0, Math.min(1, vent));
  const open = smoothstep(0, 0.62, t);
  return open * travel;
}

/** Glyph ink fades after the split has started, so the letters don't just rewind. */
export function exitInkOpacity(vent: number): number {
  const t = Math.max(0, Math.min(1, vent));
  if (t <= 0.22) return 1;
  return Math.max(0, 1 - (t - 0.22) / 0.78);
}

/** Soft filled air (center stronger, edge feathers out). Static SVG — never resized. */
const EnterWaveTexture = memo(function EnterWaveTexture() {
  return (
    <Svg width={WAVE_TEX_SIZE} height={WAVE_TEX_SIZE} pointerEvents="none">
      <Defs>
        <RadialGradient id="airOuter" cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor="#fff4ee" stopOpacity="0.42" />
          <Stop offset="72%" stopColor="#ffd0c2" stopOpacity="0.3" />
          <Stop offset="90%" stopColor="#ffd0c2" stopOpacity="0.12" />
          <Stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </RadialGradient>
        <RadialGradient id="airInner" cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor="#fff8f4" stopOpacity="0.85" />
          <Stop offset="40%" stopColor="#ffc9bb" stopOpacity="0.28" />
          <Stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Circle cx={WAVE_HALF} cy={WAVE_HALF} r={WAVE_HALF} fill="url(#airOuter)" />
      <Circle cx={WAVE_HALF} cy={WAVE_HALF} r={WAVE_HALF * 0.48} fill="url(#airInner)" />
    </Svg>
  );
});

/** Soft traveling front (ring), not a hard stroke. Static SVG — never resized. */
const ExitWaveTexture = memo(function ExitWaveTexture() {
  return (
    <Svg width={WAVE_TEX_SIZE} height={WAVE_TEX_SIZE} pointerEvents="none">
      <Defs>
        <RadialGradient id="exitWave" cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor="#fff6f1" stopOpacity="0" />
          <Stop offset="58%" stopColor="#ffe4da" stopOpacity="0" />
          <Stop offset="78%" stopColor="#ffd0c2" stopOpacity="0.55" />
          <Stop offset="90%" stopColor="#fff4ee" stopOpacity="0.22" />
          <Stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Circle cx={WAVE_HALF} cy={WAVE_HALF} r={WAVE_HALF} fill="url(#exitWave)" />
    </Svg>
  );
});

export const SplashHudOverlay = memo(function SplashHudOverlay({
  progress,
  width,
  height,
  originX,
  originY,
  phase,
  onEntered,
  onExited,
  onFilled,
}: {
  /** Real aggregate splash load % (0–100, monotonic). Never paced. */
  progress: number;
  width: number;
  height: number;
  /** Crack epicenter in the same space as width/height. */
  originX: number;
  originY: number;
  /** `enter` before the bar, `run` while it fills, `exit` after 100. */
  phase: SplashHudPhase;
  onEntered?: () => void;
  onExited?: () => void;
  /** Displayed bar reached 100 (follow or fast-forward finished). */
  onFilled?: () => void;
}) {
  const layout = useMemo(() => {
    const sx = Math.max(0.55, Math.min(1.15, width / 390));
    const titleSize = Math.round(40 * sx);
    const logoSize = Math.round(132 * sx);
    const metaSize = Math.max(13, Math.round(18 * sx));
    const stackGap = Math.max(12, Math.round(14 * sx));
    const maxSlitW = width * SLIT_MAX_WIDTH_RATIO;
    const cover = airCoverRadius(width, height, originX, originY);
    const stackTop = height * 0.42 - Math.round(logoSize + titleSize);
    const midX = width * 0.5;
    const logoY = stackTop + logoSize * 0.5;
    const titleY = stackTop + logoSize + stackGap + titleSize * 0.55;
    const slitY = titleY + titleSize * 0.55 + stackGap;
    const metaY = slitY + stackGap + metaSize;
    const at = (y: number) => Math.hypot(midX - originX, y - originY);
    /** Scale that maps the fixed texture to full cover radius. */
    const waveScaleMax = cover / WAVE_HALF;
    return {
      titleSize,
      logoSize,
      metaSize,
      stackGap,
      maxSlitW,
      cover,
      waveScaleMax,
      stackTop,
      logoDist: at(logoY),
      titleDist: at(titleY),
      slitDist: at(slitY),
      metaDist: at(metaY),
    };
  }, [height, originX, originY, width]);

  const pct = Math.max(0, Math.min(100, Math.round(progress)));
  /** The single displayed value: slit width and the % label both read it. */
  const progressSv = useSharedValue(0);
  const [shownPct, setShownPct] = useState(0);
  /** Bar is visible (air front reached the slit, or the entrance ended). */
  const [barArmed, setBarArmed] = useState(false);
  const fillMsRef = useRef<number | null>(null);
  const drivenTargetRef = useRef(0);
  const filledRef = useRef(false);
  /** 0→1 expands the air. Exit never drives this back to 0. */
  const field = useSharedValue(0);
  /** 0→1 is the second wave. It wipes the lockup as the front passes. */
  const vent = useSharedValue(0);
  const onEnteredRef = useRef(onEntered);
  const onExitedRef = useRef(onExited);
  const onFilledRef = useRef(onFilled);
  onEnteredRef.current = onEntered;
  onExitedRef.current = onExited;
  onFilledRef.current = onFilled;
  const notifyEntered = useCallback(() => {
    onEnteredRef.current?.();
  }, []);
  const notifyExited = useCallback(() => {
    onExitedRef.current?.();
  }, []);
  const notifyFilled = useCallback(() => {
    if (filledRef.current) return;
    filledRef.current = true;
    onFilledRef.current?.();
  }, []);
  const armBar = useCallback(() => {
    setBarArmed(true);
  }, []);

  useAnimatedReaction(
    () => field.value * layout.cover >= layout.slitDist,
    (reached, prev) => {
      if (reached && !prev) runOnJS(armBar)();
    },
    [layout.cover, layout.slitDist],
  );

  useEffect(() => {
    if (phase !== "enter") setBarArmed(true);
  }, [phase]);

  useAnimatedReaction(
    () => Math.round(progressSv.value),
    (next, prev) => {
      if (next !== prev) runOnJS(setShownPct)(next);
    },
  );

  /**
   * Follow the real % from the displayed value. Targets only grow, so a new
   * target mid-animation continues forward from wherever the bar is.
   */
  useEffect(() => {
    if (!barArmed) return;
    if (fillMsRef.current == null) {
      fillMsRef.current = splashHudFillMs(pct >= 100);
    }
    const target = Math.max(pct, drivenTargetRef.current);
    if (target === drivenTargetRef.current) return;
    drivenTargetRef.current = target;
    progressSv.value = withTiming(
      target,
      { duration: fillMsRef.current, easing: Easing.out(Easing.quad) },
      (finished) => {
        if (finished && target >= 100) runOnJS(notifyFilled)();
      },
    );
  }, [barArmed, notifyFilled, pct, progressSv]);

  useEffect(() => {
    if (phase === "enter") {
      cancelAnimation(field);
      cancelAnimation(vent);
      field.value = 0;
      vent.value = 0;
      field.value = withTiming(
        1,
        { duration: HUD_ENTER_MS, easing: Easing.linear },
        (finished) => {
          if (finished) runOnJS(notifyEntered)();
        },
      );
      return;
    }
    if (phase === "exit") {
      field.value = 1;
      vent.value = withTiming(
        1,
        { duration: HUD_EXIT_MS, easing: Easing.linear },
        (finished) => {
          if (finished) runOnJS(notifyExited)();
        },
      );
    }
  }, [field, notifyEntered, notifyExited, phase, vent]);

  const discOriginStyle = useMemo(
    () => ({
      left: originX - WAVE_HALF,
      top: originY - WAVE_HALF,
      width: WAVE_TEX_SIZE,
      height: WAVE_TEX_SIZE,
    }),
    [originX, originY],
  );

  const airStyle = useAnimatedStyle(() => ({
    opacity: airVentOpacity(vent.value),
    transform: [{ scale: Math.max(0.001, field.value) * layout.waveScaleMax }],
  }));

  const exitWaveStyle = useAnimatedStyle(() => ({
    opacity: vent.value < 0.88 ? 1 : Math.max(0, 1 - (vent.value - 0.88) / 0.12),
    transform: [{ scale: Math.max(0.001, vent.value) * layout.waveScaleMax }],
  }));

  const slitStyle = useAnimatedStyle(() => {
    const ratio = Math.max(0, Math.min(1, progressSv.value / 100));
    const span = Math.max(ratio, WELD_IDLE);
    const shown = glyphReveal(field.value * layout.cover, layout.slitDist, 56);
    const wiped = glyphReveal(vent.value * layout.cover * 0.84, layout.slitDist, 48);
    return {
      width: span * layout.maxSlitW,
      opacity: shown * (1 - wiped),
    };
  });

  const coreStyle = useAnimatedStyle(() => {
    const ratio = Math.max(0, Math.min(1, progressSv.value / 100));
    const span = Math.max(ratio, WELD_IDLE);
    const shown = glyphReveal(field.value * layout.cover, layout.slitDist, 56);
    const wiped = glyphReveal(vent.value * layout.cover * 0.84, layout.slitDist, 48);
    return {
      width: span * layout.maxSlitW * 0.92,
      opacity: shown * (1 - wiped),
    };
  });

  const logoStyle = useAnimatedStyle(() => {
    const shown = glyphReveal(field.value * layout.cover, layout.logoDist, 56);
    const wiped = glyphReveal(vent.value * layout.cover * 0.84, layout.logoDist, 48);
    return { opacity: shown * (1 - wiped) };
  });

  const titleStyle = useAnimatedStyle(() => {
    const shown = glyphReveal(field.value * layout.cover, layout.titleDist, 56);
    const wiped = glyphReveal(vent.value * layout.cover * 0.84, layout.titleDist, 48);
    return { opacity: shown * (1 - wiped) };
  });

  const metaStyle = useAnimatedStyle(() => {
    const shown = glyphReveal(field.value * layout.cover, layout.metaDist, 56);
    const wiped = glyphReveal(vent.value * layout.cover * 0.84, layout.metaDist, 48);
    return { opacity: shown * (1 - wiped) };
  });

  if (!(width > 0 && height > 0)) return null;

  return (
    <View pointerEvents="none" collapsable={false} style={styles.host}>
      <Animated.View
        pointerEvents="none"
        collapsable={false}
        style={[styles.airDisc, discOriginStyle, airStyle]}
      >
        <EnterWaveTexture />
      </Animated.View>

      <View
        pointerEvents="none"
        style={[styles.stack, { top: layout.stackTop }]}
      >
        <View pointerEvents="none" style={[styles.cue, { gap: layout.stackGap }]}>
          <View pointerEvents="none" style={[styles.brand, { gap: layout.stackGap }]}>
            <Animated.View pointerEvents="none" style={logoStyle}>
              <Image
                source={SPLASH_LOGO}
                accessibilityLabel="MMA Vision"
                resizeMode="contain"
                style={{ width: layout.logoSize, height: layout.logoSize }}
              />
            </Animated.View>
            <Animated.Text
              style={[
                styles.title,
                titleStyle,
                {
                  fontSize: layout.titleSize,
                  letterSpacing: layout.titleSize * 0.06,
                  lineHeight: Math.round(layout.titleSize * 1.05),
                },
              ]}
            >
              {LINE_TITLE}
            </Animated.Text>
          </View>

          <View style={styles.slitSlot} pointerEvents="none">
            <Animated.View
              pointerEvents="none"
              style={[styles.slit, { height: SLIT_H, borderRadius: SLIT_H / 2 }, slitStyle]}
            />
            <Animated.View
              pointerEvents="none"
              style={[styles.core, { height: CORE_H }, coreStyle]}
            />
          </View>

          <Animated.Text
            style={[
              styles.meta,
              metaStyle,
              {
                fontSize: layout.metaSize,
                letterSpacing: layout.metaSize * 0.04,
                lineHeight: Math.round(layout.metaSize * 1.15),
              },
            ]}
          >
            {`${shownPct}%`}
          </Animated.Text>
        </View>
      </View>

      <Animated.View
        pointerEvents="none"
        collapsable={false}
        style={[styles.airDisc, discOriginStyle, exitWaveStyle]}
      >
        <ExitWaveTexture />
      </Animated.View>
    </View>
  );
});

const styles = StyleSheet.create({
  host: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "transparent",
    overflow: "visible",
  },
  airDisc: {
    position: "absolute",
  },
  stack: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
  },
  cue: {
    alignItems: "center",
    width: "100%",
  },
  brand: {
    alignItems: "center",
  },
  title: {
    fontFamily: fonts.displayExtraBold,
    fontWeight: "800",
    color: TITLE_INK,
    textAlign: "center",
  },
  slitSlot: {
    height: 10,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  slit: {
    backgroundColor: ACCENT,
  },
  core: {
    position: "absolute",
    backgroundColor: CORE,
  },
  meta: {
    fontFamily: fonts.uiSemi,
    fontWeight: "600",
    color: ACCENT,
    textAlign: "center",
  },
});
