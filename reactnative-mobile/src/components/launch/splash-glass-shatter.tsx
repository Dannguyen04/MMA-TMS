import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, View, type LayoutChangeEvent } from "react-native";
import Animated, {
  type SharedValue,
  runOnJS,
  useAnimatedProps,
  useAnimatedReaction,
  useAnimatedStyle,
} from "react-native-reanimated";
import Svg, {
  ClipPath,
  Defs,
  G,
  LinearGradient,
  Path,
  Polygon,
  Stop,
} from "react-native-svg";

import {
  buildGlassMesh,
  COLOR_RADIAL_PUNCH,
  CONCENTRIC_RINGS,
  CRACK_STROKE_BRANCH,
  CRACK_STROKE_MAIN,
  CRUSH_WHITE,
  DENT_EPICENTER,
  FACE_FILLS,
  FACE_FILLS_UNUSED,
  GROW_JS_PROPS_MAX,
  splashPhoneGlassFlags,
  type CrushTri,
  type MeshEdge,
  type MeshFace,
} from "./splash-glass-mesh";
import {
  brandLayout,
  BRAND_MARK_ASSET,
  BRAND_MARK_EXISTS,
  POSTER_SHEET_BG,
  splashBrandFlags,
} from "./splash-landing-marks";
import { splash } from "@/theme/splash";

/**
 * `jsProps` is used for the crack **stroke** only. It must NEVER drive an SVG
 * fill: on Fabric `jsProps` lands through `setNativeProps`, which is an
 * imperative shadow-tree override that the next React commit of that node
 * throws away — and Reanimated's `PropsFilter` re-applies
 * `animatedProps.initial.value` (captured when the clock was 0) on *every*
 * render. The ice cells went back to `fillOpacity: 0` in the same frame as
 * `sheetRelease` and the whole fly ran fully transparent. Cell opacity is a
 * `useAnimatedStyle` on the wrapping `Animated.View` (native props registry,
 * immune to re-render); the polygon fill is a **static** prop.
 */
const AnimatedPath = Animated.createAnimatedComponent(Path, {
  jsProps: ["strokeDashoffset"],
});

/** Near-white ice glare along cracks — soft flash, not neon cyan. */
const CRACK_HI = "#ffffff";
const SHARD_EDGE_WIDTH = 0.95;
const SHARD_INNER_WIDTH = 0.55;
/** Host inflation so the cell rim is not clipped in half by its own viewBox. */
const SHARD_PAD = 3;

const GRAD_DIRS = [
  { x1: "0", y1: "0", x2: "1", y2: "1" },
  { x1: "0.12", y1: "0", x2: "1", y2: "0.88" },
  { x1: "0", y1: "0.18", x2: "0.92", y2: "1" },
  { x1: "0.08", y1: "0", x2: "1", y2: "1" },
] as const;

function parseHex(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function toHex(r: number, g: number, b: number): string {
  const c = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

function mixHex(a: string, b: string, t: number): string {
  const [ar, ag, ab] = parseHex(a);
  const [br, bg, bb] = parseHex(b);
  return toHex(ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t);
}

/** Bright lit corner — milky glare, not a dark glass highlight. */
function iceHighlight(fill: string): string {
  return mixHex(fill, "#ffffff", 0.55);
}

function iceRim(fill: string): string {
  return mixHex(fill, "#f6faf8", 0.5);
}

/** Soft cool shade toward the fracture edge — still pale, never green-black. */
function iceShade(fill: string): string {
  return mixHex(fill, "#c5d0cb", 0.28);
}

function iceDarkRim(fill: string): string {
  return mixHex(fill, "#aeb9b4", 0.32);
}

/** Flat glass edge: bright on the lit side, slightly darker opposite. Not a bowl. */
function faceEdgeRims(points: string): { bright: string; dark: string } {
  const nums = points.split(/[\s,]+/).map(Number).filter((n) => Number.isFinite(n));
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i + 1 < nums.length; i += 2) {
    pts.push({ x: nums[i], y: nums[i + 1] });
  }
  if (pts.length < 3) return { bright: "", dark: "" };
  let cx = 0;
  let cy = 0;
  for (const p of pts) {
    cx += p.x;
    cy += p.y;
  }
  cx /= pts.length;
  cy /= pts.length;
  const lightX = -0.62;
  const lightY = -0.78;
  let bright = "";
  let dark = "";
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    let nx = -(b.y - a.y);
    let ny = b.x - a.x;
    const nlen = Math.hypot(nx, ny) || 1;
    nx /= nlen;
    ny /= nlen;
    if (nx * (mx - cx) + ny * (my - cy) < 0) {
      nx = -nx;
      ny = -ny;
    }
    const seg = `M${a.x.toFixed(2)} ${a.y.toFixed(2)}L${b.x.toFixed(2)} ${b.y.toFixed(2)}`;
    if (nx * lightX + ny * lightY >= 0) bright += seg;
    else dark += seg;
  }
  return { bright, dark };
}

function highlightPolygon(points: string): string {
  const nums = points.split(/[\s,]+/).map(Number).filter((n) => Number.isFinite(n));
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i + 1 < nums.length; i += 2) {
    pts.push({ x: nums[i], y: nums[i + 1] });
  }
  if (pts.length < 3) return points;
  let cx = 0;
  let cy = 0;
  for (const p of pts) {
    cx += p.x;
    cy += p.y;
  }
  cx /= pts.length;
  cy /= pts.length;
  const scored = pts
    .map((p) => ({ p, s: p.x * 0.72 + p.y }))
    .sort((a, b) => a.s - b.s);
  const a = scored[0].p;
  const b = scored[Math.min(1, scored.length - 1)].p;
  const d = scored[Math.min(2, scored.length - 1)].p;
  const lerp = (p: { x: number; y: number }, q: { x: number; y: number }, t: number) => ({
    x: p.x + (q.x - p.x) * t,
    y: p.y + (q.y - p.y) * t,
  });
  const c = { x: cx, y: cy };
  return [a, lerp(a, b, 0.9), lerp(d, c, 0.32), lerp(a, c, 0.4)]
    .map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`)
    .join(" ");
}

function iceGradDir(id: string) {
  let n = 0;
  for (let i = 0; i < id.length; i++) n = (n + id.charCodeAt(i) * (i + 1)) % GRAD_DIRS.length;
  return GRAD_DIRS[n];
}

// fillClock 0→1 IS the opacity ramp (facetFillMs). Do not stretch with FILL_SPAN
// < 1 or per-host fillDelay — that left cells transparent after the ramp started.
const FILL_SPAN = 1;
const FLY_DUR = splash.shardBreakMs;
const FLY_EASE = splash.shardEasePower;
const FLY_FADE_AT = splash.shardBreakMs * splash.shardFadeStartRatio;
const FLY_FADE_DUR = splash.shardFadeMs;
const FLY_DIP = splash.shardSeparateDip;

function phoneGlassLogPairs(extra?: Record<string, unknown>): unknown[] {
  return Object.entries({
    ...splashPhoneGlassFlags(),
    ...splashBrandFlags(),
    crackGrowMs: splash.crackGrowMs,
    veinStaggerMs: splash.veinStaggerMs,
    jsPropsFill: false,
    circleR: false,
    pngIce: false,
    translateZ: false,
    skia: false,
    ...(extra ?? {}),
  }).flat();
}

type SplashGlassShatterProps = {
  width: number;
  height: number;
  originX: number;
  originY: number;
  /** 0→1 cell ice-in ramp. Owned by MmaSplash. Drives host opacity, not fill. */
  fillClock: SharedValue<number>;
  /**
   * Elapsed **milliseconds** of the fly, 0 until `shardBreak`. A shared value on
   * purpose: a `breaking` React prop re-rendered all 24 hosts at the exact frame
   * the fly started.
   */
  flyMs: SharedValue<number>;
  /** 1→0 at `sheetRelease`. The stroke layer FADES; it is never unmounted. */
  strokeFade: SharedValue<number>;
  /** Every FacetShard host onLayout w/h > 0. Parent must not drop the sheet if this never fires. */
  onIceHostsReady?: () => void;
  /**
   * Hosts premount with splash root (`fillClock` 0). Stroke SVG also premounts
   * (hidden dashes). Parent arms `growClock` at punch — not after this tree mounts.
   */
  growArmed?: boolean;
  growClock: SharedValue<number>;
};

/**
 * Effective opacity of one ice cell. Exported so the splash probe logs the same
 * number the UI thread is actually painting.
 */
export function shardCellOpacity(
  fillClockValue: number,
  flyMsValue: number,
  fillDelay = 0,
  delayMs = 0,
): number {
  const fillIn =
    fillClockValue >= 0.999
      ? 1
      : Math.min(1, Math.max(0, (fillClockValue - fillDelay) / FILL_SPAN));
  const out = Math.min(
    1,
    Math.max(0, (flyMsValue - delayMs - FLY_FADE_AT) / FLY_FADE_DUR),
  );
  return fillIn * (1 - out);
}

function strokePathProps(edge: MeshEdge, locked: boolean) {
  return {
    d: edge.d,
    stroke: edge.stroke,
    strokeWidth: edge.width,
    strokeOpacity: edge.strokeOpacity,
    fill: "none" as const,
    strokeLinecap: "butt" as const,
    strokeLinejoin: "miter" as const,
    strokeMiterlimit: 2,
    strokeDasharray: locked ? undefined : `${edge.length}`,
    strokeDashoffset: locked ? 0 : edge.length,
  };
}

/** Static stroke — no jsProps. Hidden until snap, then fully drawn. */
function CrackStrokeStatic({ edge, locked }: { edge: MeshEdge; locked: boolean }) {
  const p = strokePathProps(edge, locked);
  return <Path {...p} />;
}

/**
 * Grow-time animated dash (shared growClock). Mount only GROW_JS_PROPS_MAX of
 * these — 100+ jsProps dashoffset Fabric commits/frame stalled 360ms → ~18s.
 */
function CrackStrokeLive({
  edge,
  clock,
  locked,
}: {
  edge: MeshEdge;
  clock: SharedValue<number>;
  locked: boolean;
}) {
  const animatedProps = useAnimatedProps(() => {
    const t = clock.value;
    if (t >= 1) {
      return { strokeDashoffset: 0 };
    }
    return {
      strokeDashoffset: edge.length * (1 - Math.min(1, Math.max(0, t))),
    };
  });
  const p = strokePathProps(edge, locked);
  if (locked) {
    return <Path {...p} />;
  }
  return <AnimatedPath {...p} animatedProps={animatedProps} />;
}

/**
 * Sibling of the shard layer, not a child of it. Fades via `useAnimatedStyle`
 * instead of unmounting, so dropping the sheet cannot re-render a single shard
 * node. Owns its own grow clock + lock state.
 */
const CrackStrokeLayer = memo(function CrackStrokeLayer({
  width,
  height,
  rays,
  fade,
  armed,
  growClock,
}: {
  width: number;
  height: number;
  rays: MeshEdge[];
  fade: SharedValue<number>;
  armed: boolean;
  growClock: SharedValue<number>;
}) {
  const [grown, setGrown] = useState(false);
  const snappedRef = useRef(false);

  const snapGrown = useCallback(() => {
    if (snappedRef.current) return;
    snappedRef.current = true;
    console.log(
      "[splash] crackGrow snap",
      true,
      "jsPropsWipe",
      false,
      "lockedDash",
      0,
      ...phoneGlassLogPairs({ growJsProps: GROW_JS_PROPS_MAX }),
    );
    setGrown(true);
  }, []);

  useEffect(() => {
    if (!armed) {
      snappedRef.current = false;
      setGrown(false);
      return;
    }
  }, [armed]);

  useAnimatedReaction(
    () => growClock.value,
    (t, prev) => {
      if (t >= 1 && (prev === null || prev < 1)) {
        runOnJS(snapGrown)();
      }
    },
  );

  const fadeStyle = useAnimatedStyle(() => ({ opacity: fade.value }));

  return (
    <Animated.View pointerEvents="none" collapsable={false} style={[styles.strokeLayer, fadeStyle]}>
      <Svg width={width} height={height} overflow="visible" pointerEvents="none">
        {rays.map((edge) =>
          !grown && edge.growLive ? (
            <CrackStrokeLive key={edge.id} edge={edge} clock={growClock} locked={false} />
          ) : (
            <CrackStrokeStatic key={edge.id} edge={edge} locked={grown} />
          ),
        )}
        {/* Highlights only after snap — no extra jsProps during the 360ms grow. */}
        {grown
          ? rays
              .filter(
                (edge) =>
                  edge.id.startsWith("ray-in-") ||
                  edge.id.startsWith("ray-out-") ||
                  edge.id.startsWith("crush-ray-") ||
                  edge.id.startsWith("vein-a-"),
              )
              .map((edge) => (
                <Path
                  key={`${edge.id}-hi`}
                  d={edge.d}
                  stroke={CRACK_HI}
                  strokeWidth={Math.max(0.55, edge.width * 1.15)}
                  strokeOpacity={0.52 + Math.min(0.28, edge.width * 0.12)}
                  fill="none"
                  strokeLinecap="butt"
                  strokeLinejoin="miter"
                  strokeMiterlimit={2}
                />
              ))
          : null}
      </Svg>
    </Animated.View>
  );
});

function polygonPointCount(points: string): number {
  const nums = points.split(/[\s,]+/).map(Number).filter((n) => Number.isFinite(n));
  return Math.floor(nums.length / 2);
}

function faceBounds(points: string): { minX: number; minY: number; width: number; height: number } {
  const nums = points.split(/[\s,]+/).map(Number).filter((n) => Number.isFinite(n));
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (let i = 0; i + 1 < nums.length; i += 2) {
    minX = Math.min(minX, nums[i]);
    minY = Math.min(minY, nums[i + 1]);
    maxX = Math.max(maxX, nums[i]);
    maxY = Math.max(maxY, nums[i + 1]);
  }
  if (!Number.isFinite(minX) || !Number.isFinite(minY)) {
    return { minX: 0, minY: 0, width: 1, height: 1 };
  }
  return {
    minX,
    minY,
    width: Math.max(maxX - minX, 1),
    height: Math.max(maxY - minY, 1),
  };
}

/**
 * Everything one cell needs, resolved once per mesh so `FacetShard` props are
 * referentially stable and `memo` can hold. No React prop changes during the
 * cinematic → no commit → nothing can wipe the cell.
 */
type ShardPlan = {
  id: string;
  points: string;
  highlightPoints: string;
  fill: string;
  left: number;
  top: number;
  width: number;
  height: number;
  viewBox: string;
  fillDelay: number;
  specBoost: number;
  fillOpacity: number;
  /** Radius stagger: inner cells break first, rim cells last. */
  delayMs: number;
  dx: number;
  dy: number;
  pitch: number;
  yaw: number;
  spin: number;
  scaleTo: number;
  overlayW: number;
  overlayH: number;
  originX: number;
  originY: number;
  crushTris: CrushTri[];
  rimBright: string;
  rimDark: string;
};

function buildShardPlans(
  faces: MeshFace[],
  originX: number,
  originY: number,
  overlayW: number,
  overlayH: number,
  crushTris: CrushTri[],
): ShardPlan[] {
  let maxR = 1;
  for (const face of faces) {
    maxR = Math.max(maxR, Math.hypot(face.cx - originX, face.cy - originY));
  }
  return faces.map((face) => {
    const bounds = faceBounds(face.points);
    const vx = face.cx - originX;
    const vy = face.cy - originY;
    const len = Math.hypot(vx, vy) || 1;
    const ux = vx / len;
    const uy = vy / len;
    const left = bounds.minX - SHARD_PAD;
    const top = bounds.minY - SHARD_PAD;
    const width = bounds.width + SHARD_PAD * 2;
    const height = bounds.height + SHARD_PAD * 2;
    const dist = splash.shardDistBase + len * splash.shardDistPerLen;
    const rims = faceEdgeRims(face.points);
    return {
      id: face.id,
      points: face.points,
      highlightPoints: highlightPolygon(face.points),
      fill: face.fill,
      left,
      top,
      width,
      height,
      viewBox: `${left} ${top} ${width} ${height}`,
      fillDelay: 0,
      specBoost: face.specBoost,
      fillOpacity: 1,
      delayMs: Math.round(Math.min(1, len / maxR) * splash.shardStaggerMs),
      dx: ux * dist,
      dy: uy * dist,
      pitch: uy * 54,
      yaw: ux * 64,
      spin: (ux - uy) * 26,
      scaleTo: 1.26,
      overlayW,
      overlayH,
      originX,
      originY,
      crushTris,
      rimBright: rims.bright,
      rimDark: rims.dark,
    };
  });
}

const FacetShard = memo(function FacetShard({
  plan,
  fillClock,
  flyMs,
  onHostLaidOut,
}: {
  plan: ShardPlan;
  fillClock: SharedValue<number>;
  flyMs: SharedValue<number>;
  onHostLaidOut?: (id: string, width: number, height: number) => void;
}) {
  const { id, fillDelay, delayMs, dx, dy, pitch, yaw, spin, scaleTo, specBoost } = plan;
  const clipId = `iceFaceClip_${id.replace(/-/g, "_")}`;
  const gradId = `iceFillGrad_${id.replace(/-/g, "_")}`;
  const specClipId = `iceSpecClip_${id.replace(/-/g, "_")}`;
  const loggedLayoutRef = useRef(false);
  const highlight = iceHighlight(plan.fill);
  const shade = iceShade(plan.fill);
  const rim = iceRim(plan.fill);
  const darkRim = iceDarkRim(plan.fill);
  const dir = iceGradDir(plan.id);

  const style = useAnimatedStyle(() => {
    const fillIn =
      fillClock.value >= 0.999
        ? 1
        : Math.min(1, Math.max(0, (fillClock.value - fillDelay) / FILL_SPAN));

    const elapsed = flyMs.value - delayMs;
    const t = Math.min(1, Math.max(0, elapsed / FLY_DUR));
    // Early push: ease-OUT, so the piece is visibly displaced on the first
    // frames. Easing.in(cubic) spent half the beat at 12% of the travel.
    const e = 1 - Math.pow(1 - t, FLY_EASE);
    const out = Math.min(1, Math.max(0, (elapsed - FLY_FADE_AT) / FLY_FADE_DUR));
    // Seam: every cell shrinks a few percent immediately, so the home UI is
    // visible between the pieces long before any of them has travelled far.
    const dip = t > 0 ? FLY_DIP * Math.sin(Math.PI * Math.min(1, t / 0.3)) : 0;

    return {
      opacity: fillIn * (1 - out),
      transform: [
        { perspective: 900 },
        { translateX: dx * e },
        { translateY: dy * e },
        { rotateX: `${pitch * e}deg` },
        { rotateY: `${yaw * e}deg` },
        { rotate: `${spin * e}deg` },
        { scale: 1 + (scaleTo - 1) * e - dip },
      ],
    };
  });

  const hostStyle = useMemo(
    () => ({
      position: "absolute" as const,
      left: plan.left,
      top: plan.top,
      width: plan.width,
      height: plan.height,
      overflow: "visible" as const,
      backgroundColor: "transparent",
      zIndex: 2,
      // No per-shard elevation: Android Z only sorts siblings, so it cannot
      // lift a piece above the home layer (that is the overlay host's job),
      // and an elevated transparent box draws a rectangular shadow.
      elevation: 0,
    }),
    [plan.height, plan.left, plan.top, plan.width],
  );

  const onLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const { width: laidW, height: laidH } = event.nativeEvent.layout;
      if (!loggedLayoutRef.current) {
        loggedLayoutRef.current = true;
        const n = polygonPointCount(plan.points);
        const clipExists = n >= 3;
        console.log(
          "[splash] shard",
          id,
          "clipPath exists",
          clipExists,
          "clipId",
          clipId,
          "clipPath polygon not circle",
          true,
          "polygonPoints",
          n,
          "iceFillUsed",
          true,
          "pngOnGlass",
          "logoOnly",
          true,
          "slogan",
          false,
          "premountHosts",
          true,
          "landingClipped",
          clipExists,
          "landingKind",
          "poster",
          "not dashboardSilhouette",
          true,
          "FACE_FILLS unused",
          FACE_FILLS_UNUSED,
          "FACE_FILLS count",
          FACE_FILLS.length,
          "jsPropsFillOpacity",
          false,
          "dentEpicenter",
          DENT_EPICENTER,
          "crushWhite",
          CRUSH_WHITE,
          "fillOpaque",
          true,
          "seeThrough",
          false,
          "glassGradient",
          true,
          "specular",
          true,
          "colorRadialPunch",
          COLOR_RADIAL_PUNCH,
          "pngIce",
          false,
          "brandInClip",
          true,
          "brandAboveCracks",
          false,
          "cracksOverGlyphs",
          true,
          "layout",
          laidW,
          laidH,
          ...phoneGlassLogPairs(),
        );
      }
      onHostLaidOut?.(id, laidW, laidH);
    },
    [clipId, id, onHostLaidOut, plan.points],
  );

  return (
    <Animated.View
      pointerEvents="none"
      collapsable={false}
      onLayout={onLayout}
      style={[hostStyle, style]}
    >
      <Svg
        width={plan.width}
        height={plan.height}
        viewBox={plan.viewBox}
        overflow="visible"
        pointerEvents="none"
      >
        <Defs>
          <LinearGradient id={gradId} x1={dir.x1} y1={dir.y1} x2={dir.x2} y2={dir.y2}>
            <Stop offset="0" stopColor={mixHex(highlight, "#ffffff", 0.35 + 0.2 * specBoost)} stopOpacity="0.92" />
            <Stop offset="0.42" stopColor={plan.fill} stopOpacity="0.88" />
            <Stop offset="1" stopColor={shade} stopOpacity="0.9" />
          </LinearGradient>
          <ClipPath id={clipId}>
            <Polygon points={plan.points} />
          </ClipPath>
          <ClipPath id={specClipId}>
            <Polygon points={plan.points} />
          </ClipPath>
        </Defs>
        <Polygon points={plan.points} fill={plan.fill} fillOpacity={0.94} />
        <Polygon points={plan.points} fill={`url(#${gradId})`} fillOpacity={1} />
        <Polygon
          points={plan.highlightPoints}
          fill={mixHex("#ffffff", plan.fill, 0.22)}
          fillOpacity={0.42 + 0.22 * specBoost}
          clipPath={`url(#${specClipId})`}
        />
        {CRUSH_WHITE ? (
          <G clipPath={`url(#${clipId})`}>
            {plan.crushTris.map((tri) => (
              <Polygon key={tri.id} points={tri.points} fill={tri.fill} fillOpacity={0.9} />
            ))}
          </G>
        ) : null}
        {plan.rimBright ? (
          <Path
            d={plan.rimBright}
            fill="none"
            stroke={rim}
            strokeWidth={SHARD_EDGE_WIDTH}
            strokeOpacity={0.78}
            strokeLinecap="butt"
            strokeLinejoin="miter"
            strokeMiterlimit={2.4}
          />
        ) : null}
        {plan.rimDark ? (
          <Path
            d={plan.rimDark}
            fill="none"
            stroke={darkRim}
            strokeWidth={SHARD_INNER_WIDTH + 0.2}
            strokeOpacity={0.42}
            strokeLinecap="butt"
            strokeLinejoin="miter"
            strokeMiterlimit={2.4}
          />
        ) : null}
      </Svg>
    </Animated.View>
  );
});

/**
 * Crack grow uses `growClock` / `crackGrowMs` only. Hold HUD progress lives
 * outside this tree (SplashHudOverlay) — must not reset grow clocks.
 */
export const SplashGlassShatter = memo(function SplashGlassShatter({
  width,
  height,
  originX,
  originY,
  fillClock,
  flyMs,
  strokeFade,
  onIceHostsReady,
  growArmed = false,
  growClock,
}: SplashGlassShatterProps) {
  const laidHostsRef = useRef(new Set<string>());
  const coveredRef = useRef(false);
  const growArmedRef = useRef(growArmed);
  growArmedRef.current = growArmed;

  const mesh = useMemo(() => {
    if (width <= 0 || height <= 0) {
      return {
        edges: [] as MeshEdge[],
        faces: [] as MeshFace[],
        veinCount: 0,
        concentricRings: 0,
        crushTriangles: [] as CrushTri[],
      };
    }
    const built = buildGlassMesh(width, height, originX, originY);
    const first = built.faces[0] as (MeshFace & { frost?: unknown }) | undefined;
    console.log(
      "[splash] mesh field check",
      "spokes leftover undefined",
      true,
      "plan.frost",
      first?.frost === undefined,
      "specBoost defined",
      first?.specBoost != null,
      "fillOpacity defined",
      first?.fillOpacity != null,
      "concentricRings",
      built.concentricRings ?? null,
      "origin finite",
      Number.isFinite(originX) && Number.isFinite(originY),
      "faces",
      built.faces.length,
      "dentEpicenter",
      DENT_EPICENTER,
      "crushWhite",
      CRUSH_WHITE,
      "fillOpaque",
      built.faces.length === 24 && built.faces.every((f) => f.fillOpacity === 1),
      "seeThrough",
      false,
      "straightRadials",
      true,
    );
    return built;
  }, [height, originX, originY, width]);

  const plans = useMemo(
    () => buildShardPlans(mesh.faces, originX, originY, width, height, mesh.crushTriangles),
    [height, mesh.crushTriangles, mesh.faces, originX, originY, width],
  );

  const rays = useMemo(() => mesh.edges.filter((edge) => !edge.onPerimeter), [mesh.edges]);

  const hasBox = width > 0 && height > 0;
  const faceCount = plans.length;

  useEffect(() => {
    const brand = brandLayout(width, height, originX);
    const veinCount = mesh.veinCount ?? rays.length;
    console.log(
      "[splash] landing palette",
      POSTER_SHEET_BG,
      "source splash.glassFillColor",
      "splash.glassFillColor exists",
      Boolean(splash.glassFillColor),
      "hex",
      splash.glassFillColor,
      "sheet",
      POSTER_SHEET_BG,
      "iceFillUsed",
      true,
      "pngOnGlass",
      "logoOnly",
      true,
      "brand-mark path exists",
      BRAND_MARK_EXISTS,
      "brand-mark",
      BRAND_MARK_ASSET,
      "slogan",
      false,
      "premountHosts",
      true,
      "punchMountsShards",
      false,
      "pauseAtPunch",
      false,
      "overlayW",
      brand.overlayW,
      "brandCx",
      brand.brandCx,
      "wordmark x",
      brand.wordmarkX,
      "punchX",
      originX,
      "offsetApplied",
      brand.offsetApplied,
      "strokeMain",
      CRACK_STROKE_MAIN,
      "strokeBranch",
      CRACK_STROKE_BRANCH,
      "veinCount",
      veinCount,
      "growJsProps",
      GROW_JS_PROPS_MAX,
      "faceCount",
      faceCount,
      "glassGradient",
      true,
      "colorRadialPunch",
      COLOR_RADIAL_PUNCH,
      "pngIce",
      false,
      "FACE_FILLS count",
      FACE_FILLS.length,
      "floorHex",
      "#090A0C",
      "ThemeProvider not required for poster",
      true,
      "FACE_FILLS unused",
      FACE_FILLS_UNUSED,
      "jsProps fill",
      false,
      "fillOpaque",
      true,
      "seeThrough",
      false,
      "dentEpicenter",
      DENT_EPICENTER,
      "crushWhite",
      CRUSH_WHITE,
      "Circle r",
      false,
      "concentricRings",
      mesh.concentricRings ?? CONCENTRIC_RINGS,
      "growLiveCount",
      mesh.edges.filter((e) => e.growLive).length,
      ...phoneGlassLogPairs({ ...splashBrandFlags(brand) }),
    );
  }, [faceCount, height, mesh.concentricRings, mesh.edges, mesh.veinCount, originX, rays.length, width]);

  useEffect(() => {
    console.log(
      "[splash] premountHosts",
      true,
      "punchMountsShards",
      false,
      "growArmed",
      growArmed,
      "faceCount",
      faceCount,
      "fillClock",
      0,
      "pauseAtPunch",
      false,
      ...phoneGlassLogPairs(),
    );
  }, [faceCount, growArmed]);

  useEffect(() => {
    if (hasBox) return;
    console.log(
      "[splash] landing skip",
      "reason W/H 0",
      "W",
      width,
      "H",
      height,
      "mounted",
      false,
    );
  }, [hasBox, height, width]);

  const markHostsReady = useCallback(
    (reason: string) => {
      if (coveredRef.current) return;
      coveredRef.current = true;
      const beforePunch = !growArmedRef.current;
      console.log(
        "[splash] iceHostsLaidOut",
        reason,
        laidHostsRef.current.size,
        "/",
        faceCount,
        "premountHosts",
        true,
        "beforePunch",
        beforePunch,
        "growArmed",
        growArmedRef.current,
        ...phoneGlassLogPairs(),
      );
      const brand = brandLayout(width, height, originX);
      console.log(
        "[splash] landingClipped",
        laidHostsRef.current.size,
        "/",
        faceCount,
        "clipPath polygon not circle",
        true,
        "landingKind",
        "poster",
        "not dashboardSilhouette",
        true,
        "FACE_FILLS unused",
        FACE_FILLS_UNUSED,
        "FACE_FILLS count",
        FACE_FILLS.length,
        "iceFillUsed",
        true,
        "pngOnGlass",
        "logoOnly",
        true,
        "brand-mark path exists",
        BRAND_MARK_EXISTS,
        "slogan",
        false,
        "overlayW",
        brand.overlayW,
        "brandCx",
        brand.brandCx,
        "wordmark x",
        brand.wordmarkX,
        "punchX",
        originX,
        "offsetApplied",
        brand.offsetApplied,
        "strokeMain",
        CRACK_STROKE_MAIN,
        "strokeBranch",
        CRACK_STROKE_BRANCH,
        "veinCount",
        mesh.veinCount ?? rays.length,
        "glassGradient",
        true,
        "colorRadialPunch",
        COLOR_RADIAL_PUNCH,
        "pngIce",
        false,
        "sheet",
        POSTER_SHEET_BG,
        "is090A0C",
        POSTER_SHEET_BG === "#090A0C",
        "notBlack",
        POSTER_SHEET_BG.toLowerCase() !== "#090a0c" && POSTER_SHEET_BG.toLowerCase() !== "#000000",
        ...phoneGlassLogPairs({
          concentricRings: mesh.concentricRings ?? CONCENTRIC_RINGS,
          ...splashBrandFlags(brand),
        }),
      );
      if (reason === "partial") {
        console.log("[splash] cloneFallback", laidHostsRef.current.size, "/", faceCount);
      }
      onIceHostsReady?.();
    },
    [faceCount, height, mesh.concentricRings, mesh.veinCount, onIceHostsReady, originX, rays.length, width],
  );

  // Only a new mesh (new host ids) invalidates the laid-out set. Never clear it
  // because fills turned on — that is what made iceHostsReady never fire.
  useEffect(() => {
    if (coveredRef.current) return;
    laidHostsRef.current = new Set();
  }, [plans]);

  /**
   * Hosts premount with splash root (opacity 0). onLayout should fire before
   * hapticAtMs. Poll is a safety net only.
   */
  useEffect(() => {
    if (!hasBox || coveredRef.current) return;
    if (faceCount === 0) {
      markHostsReady("noFaces");
      return;
    }
    const startedAt = Date.now();
    const poll = setInterval(() => {
      if (coveredRef.current) {
        clearInterval(poll);
        return;
      }
      const laid = laidHostsRef.current.size;
      if (laid >= faceCount) {
        clearInterval(poll);
        markHostsReady("all");
        return;
      }
      if (laid > 0 && Date.now() - startedAt >= splash.cloneFallbackMs) {
        clearInterval(poll);
        markHostsReady("partial");
      }
    }, 60);
    return () => clearInterval(poll);
  }, [faceCount, hasBox, markHostsReady]);

  const onHostLaidOut = useCallback(
    (id: string, laidW: number, laidH: number) => {
      if (!(laidW > 0 && laidH > 0)) {
        console.log("[splash] iceHost layout", id, laidW, laidH);
        return;
      }
      if (coveredRef.current) return;
      laidHostsRef.current.add(id);
      if (faceCount > 0 && laidHostsRef.current.size >= faceCount) {
        markHostsReady("all");
      }
    },
    [faceCount, markHostsReady],
  );

  if (width <= 0 || height <= 0) {
    return null;
  }

  return (
    <View pointerEvents="none" collapsable={false} style={styles.host}>
      {/*
        24 FacetShard hosts + CrackStroke SVG premount with splash root
        (fillClock 0 / growClock 0). Punch must NOT insert this tree.
      */}
      <View pointerEvents="none" collapsable={false} style={styles.shardLayer}>
        {plans.map((plan) => (
          <FacetShard
            key={plan.id}
            plan={plan}
            fillClock={fillClock}
            flyMs={flyMs}
            onHostLaidOut={onHostLaidOut}
          />
        ))}
      </View>
      <CrackStrokeLayer
        width={width}
        height={height}
        rays={rays}
        fade={strokeFade}
        armed={growArmed}
        growClock={growClock}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  host: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "transparent",
    overflow: "visible",
  },
  // Origin-ray strokes stay ON TOP of the ice faces and FADE at sheetRelease
  // (never unmounted). zIndex and elevation must agree or Android Z-sorting
  // flips them.
  strokeLayer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "transparent",
    overflow: "visible",
    zIndex: 5,
    elevation: 8,
  },
  shardLayer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "transparent",
    overflow: "visible",
    zIndex: 4,
    elevation: 2,
  },
});
