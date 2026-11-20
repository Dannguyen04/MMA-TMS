import { useEffect, useRef, useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from "react-native-svg";
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";
import { useThemePreference } from "@/theme/index";
import { motion } from "@/theme/motion";
import { fonts, readableTextStyle, fz, lh } from "@/theme/typography";

/**
 * Lit surfaces and motion for Fight Camp (REDESIGN-BRIEF-2026-11.md "Buttons"): buttons are top-lit, not flat; the main
 * red button sends one light sheen across on appear and on press; in-screen tabs slide a red underline.
 */

export type LitKind = "primary" | "danger" | "secondary" | "good" | "bad" | "neutral" | "disabled";

/** Ramp per kind, top → bottom, plus the lip (top highlight) and base (bottom shade). */
function ramp(kind: LitKind, dark: boolean, c: { surface: string; controlBorder: string; disabledFill: string; ink: string }) {
  switch (kind) {
    case "primary": return { stops: ["#E4573D", "#CC3F26", "#B13219", "#8E2512"], lip: "rgba(255,214,200,0.55)", base: "rgba(40,4,0,0.35)", edge: "#6E1608" };
    case "danger": case "bad": return { stops: ["#C8204A", "#B4123F", "#A30F39", "#940C32"], lip: "rgba(255,200,215,0.4)", base: "rgba(40,0,10,0.3)", edge: "#7E0A2A" };
    case "good": return { stops: ["#2C7A5B", "#21664B", "#1D5B43", "#18523C"], lip: "rgba(200,255,225,0.3)", base: "rgba(0,30,15,0.3)", edge: "#134432" };
    case "neutral": return { stops: [c.ink, c.ink, c.ink, c.ink], lip: "rgba(255,255,255,0.12)", base: "rgba(0,0,0,0.2)", edge: c.ink };
    case "disabled": return { stops: [c.disabledFill, c.disabledFill, c.disabledFill, c.disabledFill], lip: "transparent", base: "transparent", edge: c.disabledFill };
    default: return dark
      ? { stops: ["#24242B", "#1B1B21", c.surface, "#121216"], lip: "rgba(255,255,255,0.08)", base: "rgba(0,0,0,0.45)", edge: c.controlBorder }
      : { stops: ["#FFFFFF", "#FAFAFB", c.surface, "#ECECEF"], lip: "rgba(255,255,255,0.9)", base: "rgba(0,0,0,0.08)", edge: c.controlBorder };
  }
}

let gid = 0;
/** The cut-corner fill: a vertical light ramp, a bright top lip and a darker base. Decorative. */
export function LitFill({ kind, cut = true }: { kind: LitKind; cut?: boolean }) {
  const { colors: c, resolvedScheme } = useThemePreference() as ReturnType<typeof useThemePreference> & { resolvedScheme?: string };
  const dark = (resolvedScheme ?? (isDarkHex(c.bg) ? "dark" : "light")) === "dark";
  const id = useRef(`lit${++gid}`).current;
  const r = ramp(kind, dark, c);
  // Drawn at the measured size (owner 2026-11-11: corners must not be squashed on narrow buttons). The cut is 13px,
  // smaller on short controls; the edge is a stroke of the same shape, so it follows the diagonals.
  const [size, setSize] = useState({ w: 0, h: 0 });
  const w = Math.floor(size.w), h = Math.floor(size.h);
  const k = cut ? Math.min(13, Math.round(h * 0.26)) : 0;
  // A point inside the canvas: Android clipped a stroke drawn on the last point (lost right and bottom edges).
  const o = 1;
  const d = `M${o} ${o}H${w - k - o * 0.4}L${w - o} ${k + o * 0.4}V${h - o}H${k + o * 0.4}L${o} ${h - k - o * 0.4}Z`;
  return <View pointerEvents="none" aria-hidden={true} importantForAccessibility="no-hide-descendants" style={StyleSheet.absoluteFill}
    onLayout={(e: LayoutChangeEvent) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
    {w ? <Svg width={w} height={h}>
      <Defs><LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0" stopColor={r.stops[0]}/><Stop offset="0.38" stopColor={r.stops[1]}/><Stop offset="0.72" stopColor={r.stops[2]}/><Stop offset="1" stopColor={r.stops[3]}/>
      </LinearGradient></Defs>
      <Path d={d} fill={`url(#${id})`} stroke={r.edge} strokeWidth={1}/>
      <Path d={`M2 2.2H${w - k - 1.5}`} stroke={r.lip} strokeWidth={1.4}/>
      <Path d={`M${k + 1.5} ${h - 2.5}H${w - 2}`} stroke={r.base} strokeWidth={3}/>
    </Svg> : null}
  </View>;
}
function isDarkHex(hex: string) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex); if (!m) return false;
  const n = parseInt(m[1], 16); return ((n >> 16) * 299 + ((n >> 8) & 255) * 587 + (n & 255) * 114) / 1000 < 128;
}

const SHEEN_MS = 600;
const sheenEase = Easing.bezier(0.3, 0.6, 0.2, 1);
/**
 * One diagonal light band crossing the main button: once when it first appears, then once per `trigger` change (press).
 * Transform + opacity only; off with reduced motion.
 */
export function Sheen({ trigger }: { trigger: number }) {
  const reduced = useReducedMotion();
  const [w, setW] = useState(0);
  const x = useSharedValue(0); const o = useSharedValue(0);
  useEffect(() => {
    if (reduced || !w) return;
    x.value = -0.6 * w; o.value = 1;
    x.value = withTiming(1.25 * w, { duration: SHEEN_MS, easing: sheenEase });
    o.value = withTiming(0, { duration: SHEEN_MS, easing: Easing.in(Easing.quad) });
  }, [trigger, w, reduced, x, o]);
  const band = useAnimatedStyle(() => ({ opacity: o.value, transform: [{ translateX: x.value }, { skewX: "-18deg" }] }));
  if (reduced) return null;
  return <View pointerEvents="none" aria-hidden={true} importantForAccessibility="no-hide-descendants" style={[StyleSheet.absoluteFill, { overflow: "hidden" }]} onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)}>
    <Animated.View style={[{ position: "absolute", top: -12, bottom: -12, left: 0, width: Math.max(60, w * 0.38) }, band]}>
      <Svg width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 10 10">
        <Defs><LinearGradient id="sheen" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor="#FFF0E6" stopOpacity={0}/><Stop offset="0.5" stopColor="#FFF0E6" stopOpacity={0.55}/><Stop offset="1" stopColor="#FFF0E6" stopOpacity={0}/>
        </LinearGradient></Defs>
        <Rect x={0} y={0} width={10} height={10} fill="url(#sheen)"/>
      </Svg>
    </Animated.View>
  </View>;
}

export type CampTab<K extends string> = { key: K; label: string; /** Something here needs attention (red dot, also read out). */ alert?: boolean;
  /** A waiting count shown as a small red box after the label (hidden at 0); `a11y` reads it out. */ count?: number; a11y?: string;
  /** Shown dimmed and not pressable (e.g. "Hiệp sau" on the last round). */ disabled?: boolean };
const tabEase = Easing.bezier(...motion.easeOut);
/**
 * In-screen tabs: condensed uppercase labels and one red underline that slides to the selected tab (transform only).
 * Peers, so content swaps without a slide.
 */
export function CampTabs<K extends string>({ tabs, value, onChange, alertLabel }: { tabs: readonly CampTab<K>[]; value: K; onChange: (k: K) => void; alertLabel: string }) {
  const { colors: c } = useThemePreference();
  const reduced = useReducedMotion();
  const [w, setW] = useState(0);
  const index = Math.max(0, tabs.findIndex(t => t.key === value));
  const x = useSharedValue(0);
  const each = tabs.length ? w / tabs.length : 0;
  useEffect(() => { x.value = reduced || !w ? index * each : withTiming(index * each, { duration: motion.base, easing: tabEase }); }, [index, each, reduced, w, x]);
  const line = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  return <View accessibilityRole="tablist" testID="camp-tabs" onLayout={e => setW(e.nativeEvent.layout.width)} style={{ flexDirection: "row", borderBottomColor: c.line, borderBottomWidth: 1 }}>
    {tabs.map(t => {
      const selected = t.key === value;
      return <Pressable key={t.key} testID={`camp-tab-${t.key}`} accessibilityRole="tab" accessibilityLabel={t.a11y ?? (t.alert ? `${t.label}, ${alertLabel}` : t.label)} aria-selected={selected} aria-disabled={!!t.disabled} accessibilityState={{ selected, disabled: !!t.disabled }} disabled={t.disabled} onPress={() => onChange(t.key)}
        style={({ pressed }) => ({ flex: 1, minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingHorizontal: 4, opacity: t.disabled ? 0.38 : pressed ? 0.7 : 1 })}>
        <Text numberOfLines={1} style={{ fontFamily: fonts.display, fontSize: fz(15.5), letterSpacing: 0.6, textTransform: "uppercase", color: selected ? c.ink : c.inkMuted }}>{t.label}</Text>
        {t.count ? <View aria-hidden={true} style={{ minWidth: 22, height: 20, paddingHorizontal: 5, alignItems: "center", justifyContent: "center", backgroundColor: c.lotus }}>
          <Text style={{ ...readableTextStyle(12, true), lineHeight: lh(16), color: "#FFFFFF" }} maxFontSizeMultiplier={1.2}>{t.count > 99 ? "99+" : t.count}</Text>
        </View> : null}
        {t.alert ? <View aria-hidden={true} style={{ position: "absolute", top: 10, right: "10%", width: 7, height: 7, borderRadius: 4, backgroundColor: c.danger }}/> : null}
      </Pressable>;
    })}
    {w ? <Animated.View pointerEvents="none" style={[{ position: "absolute", bottom: -1, left: each * 0.1, width: each * 0.8, height: 3, backgroundColor: c.lotus }, line]}/> : null}
  </View>;
}

/** The first `max` items, then a "Xem thêm N mục" link; the caller opens the full list in a sheet. */
export function FitList<T>({ items, max, render, moreLabel, onMore }: { items: readonly T[]; max: number; render: (item: T, i: number) => ReactNode; moreLabel: (n: number) => string; onMore: () => void }) {
  const { colors: c } = useThemePreference();
  const rest = items.length - max;
  return <>
    {items.slice(0, max).map(render)}
    {rest > 0 ? <Pressable accessibilityRole="button" onPress={onMore} style={({ pressed }) => ({ minHeight: 44, justifyContent: "center", alignSelf: "flex-start", opacity: pressed ? 0.7 : 1 })}>
      <Text style={{ fontFamily: fonts.display, fontSize: fz(16), letterSpacing: 0.3, color: c.lotus }}>{moreLabel(rest)}</Text>
    </Pressable> : null}
  </>;
}
