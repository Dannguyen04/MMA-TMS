import { createContext, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type { LayoutChangeEvent } from "react-native";
import Animated, { cubicBezier, useReducedMotion } from "react-native-reanimated";

import { motion } from "@/theme/motion";

/** Brighter Ring Red for the active tab; a white icon on it is 4.4:1 (non-text needs 3:1). */
export const SOLID_TAB_RED = "#D9381E";

/** True inside a tab bar that draws one sliding marker; `TabIcon` then draws no pill of its own. */
export const TabMarkerContext = createContext(false);

const W = 56;
const H = 28;
const EASE = cubicBezier(...motion.easeOut);

type Box = { x: number; y: number; w: number; h: number };
type Spot = { x: number; y: number };
const box = (e: LayoutChangeEvent): Box => {
  const { x, y, width, height } = e.nativeEvent.layout;
  return { x, y, w: width, h: height };
};
const same = (a: Spot | null, b: Spot | null) => a === b || (!!a && !!b && a.x === b.x && a.y === b.y);

/**
 * Redesign step 15: one red marker behind the active tab icon that slides to the next tab in 220 ms,
 * eased out, transform only. A CSS transition (Reanimated 4) retargets from where it is, so rapid taps
 * turn it around mid-way; it also starts reliably on a bar that has just mounted (web and native).
 * The active tab comes from navigation state; positions come from measured layout (bar, rail or sidebar).
 * `fromKey`: where to start when the bar mounts fresh on each screen (fighter tabs), so it still slides.
 * The tab item needs `onItemLayout(key)`, the icon wrapper (a direct child of the item) `onIconLayout(key)`.
 * `centered`: the icon sits centred across its tab (bottom bar, rail), so the marker centres on the tab itself.
 * On web an icon that only moves (the bar widens, its size stays) reports no new layout, so its own offset goes stale.
 * Reduced motion: the marker jumps.
 */
export function useSlidingMarker(activeKey: string | null, fromKey?: string | null, centered = true) {
  const reduced = useReducedMotion();
  const items = useRef<Record<string, Box>>({});
  const icons = useRef<Record<string, Box>>({});
  const [measured, setMeasured] = useState(0);
  const [spot, setSpot] = useState<Spot | null>(null);
  const [slide, setSlide] = useState(false);
  const [shown, setShown] = useState(true);
  const started = useRef(false);

  const target = useCallback((key: string | null | undefined): Spot | null => {
    const it = key ? items.current[key] : undefined;
    const ic = key ? icons.current[key] : undefined;
    if (!it || !ic) return null;
    const cx = centered ? it.x + it.w / 2 : it.x + ic.x + ic.w / 2;
    return { x: cx - W / 2, y: it.y + ic.y + ic.h / 2 - H / 2 };
  }, [centered]);

  useEffect(() => {
    const to = target(activeKey);
    // Not measured yet, or a hidden route (Thông báo, a detail) is focused: no tab is selected.
    // It fades out where it is, and comes back from there.
    if (!to) { setShown(false); return; }
    setShown(true);
    if (started.current) { setSpot(s => (same(s, to) ? s : to)); return; }
    const wantFrom = !reduced && !!fromKey && fromKey !== activeKey;
    const from = wantFrom ? target(fromKey) : null;
    if (wantFrom && !from) return; // wait until the start tab is measured
    started.current = true;
    if (!from) { setSpot(to); requestAnimationFrame(() => setSlide(true)); return; }
    // A freshly mounted bar: paint the start, then turn the transition on and move.
    setSpot(from);
    requestAnimationFrame(() => requestAnimationFrame(() => { setSlide(true); setSpot(to); }));
  }, [activeKey, fromKey, measured, reduced, target]);

  const onItemLayout = useCallback((key: string) => (e: LayoutChangeEvent) => { items.current[key] = box(e); setMeasured(n => n + 1); }, []);
  const onIconLayout = useCallback((key: string) => (e: LayoutChangeEvent) => { icons.current[key] = box(e); setMeasured(n => n + 1); }, []);

  const animate = slide && !reduced;
  const marker = <Animated.View testID="tab-marker" pointerEvents="none" aria-hidden={true} style={{
    position: "absolute", left: 0, top: 0, width: W, height: H, borderRadius: H / 2, backgroundColor: SOLID_TAB_RED,
    opacity: spot && shown ? 1 : 0,
    transform: [{ translateX: spot?.x ?? 0 }, { translateY: spot?.y ?? 0 }],
    transitionProperty: animate ? ["transform", "opacity"] : "none",
    transitionDuration: animate ? motion.base : 0,
    transitionTimingFunction: EASE,
  }}/>;
  return { marker, onItemLayout, onIconLayout };
}

/** Wraps a tab bar's items so their icons skip their own pill and turn white when active. */
export function TabMarkerScope({ children }: { children: ReactNode }) {
  return <TabMarkerContext.Provider value={true}>{children}</TabMarkerContext.Provider>;
}
