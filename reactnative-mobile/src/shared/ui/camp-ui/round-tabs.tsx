import { useRef, useState } from "react";
import { Text, View } from "react-native";
import { useThemePreference, useTypography } from "@/theme/index";
import { readableTextStyle } from "@/theme/typography";
import { ArenaSurface } from "@/components/arena/arena-frame";
import { PressableScale } from "@/components/motion/motion";
import { CampSelection } from "@/shared/ui/camp-motion";
import { FIRE_TOP, RowFire, TabFire, type TabBox } from "@/shared/ui/tab-fire";
import { CampIcon } from "./icon";

const FIRE_EDGE = "#FF7A2F";
const FIRE_TEXT = { textShadowColor: "rgba(255,110,30,0.9)", textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 8 };
/** Round switcher at the top of round entry (Designer mock 20/22): one tab per scheduled round; saved rounds carry a check. */
export function RoundTabs({ label, total, value, saved, onChange, disabled, tabLabel, savedLabel }: { label: string; total: number; value: number; saved: readonly number[]; onChange: (n: number) => void; disabled?: boolean; tabLabel: (n: number) => string; savedLabel: (n: number) => string }) {
  const { colors: c, resolvedScheme } = useThemePreference();
  // The burning label: white with a fire glow on dark; on light the glow would wash out, so it is Ring Red ink.
  const litInk = resolvedScheme === "light" ? c.lotus : "#FFFFFF";
  const litGlow = resolvedScheme === "light" ? null : FIRE_TEXT;
  const live = useTypography();
  const rounds = Array.from({ length: total }, (_, i) => i + 1);
  const rows = Array.from({ length: Math.ceil(total / 5) }, (_, r) => rounds.slice(r * 5, r * 5 + 5));
  // The round just left keeps its fire until it has gone out.
  // Updated during render, so the left round's fire is never unmounted before it can go out.
  const [fading, setFading] = useState<number[]>([]);
  const [shown, setShown] = useState(value);
  if (shown !== value) {
    setShown(value);
    setFading(f => [...f.filter(n => n !== shown && n !== value), shown]);
  }
  // Where each tab sits in the row, for the one fire canvas (rows of five: the row's y plus the tab's own box).
  const boxes = useRef(new Map<number, TabBox>());
  const rowY = useRef(new Map<number, number>());
  const tabBox = useRef(new Map<number, TabBox>());
  const [rev, setRev] = useState(0);
  const place = () => {
    const next = new Map<number, TabBox>();
    tabBox.current.forEach((b, n) => next.set(n, { ...b, y: b.y + (rowY.current.get(Math.floor((n - 1) / 5)) ?? 0) }));
    boxes.current = next;
    setRev(v => v + 1);
  };
  // Room above the row for the open round's flames to climb past its top edge.
  return <View accessibilityRole="radiogroup" accessibilityLabel={label} style={{ gap: 8, paddingTop: FIRE_TOP - 6 }} testID="round-tabs">
    {rows.map((row, r) => <View key={r} style={{ flexDirection: "row", gap: 8 }} onLayout={e => { rowY.current.set(r, e.nativeEvent.layout.y); place(); }}>
      {row.map(n => { const selected = n === value; const done = saved.includes(n);
        return <PressableScale key={n} scaleTo={0.98} accessibilityRole="radio" accessibilityLabel={done ? savedLabel(n) : tabLabel(n)} aria-checked={selected} aria-disabled={!!disabled} accessibilityState={{ checked: selected, disabled: !!disabled }} disabled={disabled} onPress={() => onChange(n)}
          onLayout={e => { const { x, y, width, height } = e.nativeEvent.layout; tabBox.current.set(n, { x, y, w: width, h: height }); place(); }}
          style={{ flex: 1, minHeight: 48, paddingHorizontal: 6, justifyContent: "center", opacity: disabled ? 0.55 : 1, overflow: "visible", zIndex: selected ? 2 : fading.includes(n) ? 1 : 0 }}>
          <ArenaSurface tone="neutral"/>
          {/* The open round burns (owner 2026-11-18): it ignites when chosen and goes out when another is. */}
          {selected || fading.includes(n) ? <TabFire key={`fire-${n}`} lit={selected} onOut={() => setFading(f => f.filter(x => x !== n))}/> : null}
          <CampSelection selected={selected}><ArenaSurface active tone="neutral" fill="transparent" stroke={FIRE_EDGE}/></CampSelection>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4 }}>
            {done ? <CampIcon name="check" color={selected ? litInk : c.success} size={16}/> : null}
            <Text numberOfLines={1} style={{ ...readableTextStyle(14, selected), fontFamily: selected ? live.faces.bold ?? live.faces.medium : live.faces.medium, color: selected ? litInk : c.ink, ...(selected ? litGlow : null) }}>{tabLabel(n)}</Text>
          </View>
        </PressableScale>; })}
    </View>)}
    {/* One fire canvas over the whole row, made once (a GL context per switch stalled it on Android). */}
    <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, zIndex: 3 }}>
      <RowFire lit={value} boxes={boxes} rev={rev}/>
    </View>
  </View>;
}