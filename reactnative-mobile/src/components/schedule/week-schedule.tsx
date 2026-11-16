import { useEffect, useRef, useState, type ReactNode } from "react";
import { LiveRefreshControl, useLiveRefresh } from "@/components/live-refresh";
import Animated, { Easing, FadeInLeft, FadeInRight, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";
import { selectionHaptic, Swap } from "@/components/motion-kit";
import { motion } from "@/theme/motion";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import Svg, { Path } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/components/icon";
import { PressableScale } from "@/components/motion";
import { navSideWidth, useNavKind } from "@/components/nav-rail";
import { SlideSheet } from "@/components/ui/slide-sheet";
import { scheduleText as t } from "@/i18n/schedule";
import { useThemePreference } from "@/theme";
import { fonts, readableTextStyle, fz, lh } from "@/theme/typography";
import { dayDots, shortDay, sortDay, weekDays, type ScheduleItem, type ScheduleKind } from "./week-model";

/** iPad portrait and up: full-width strip with big day cells, the day's items in two columns. */
export const WEEK_WIDE_MIN = 744;

export type WeekScheduleProps = {
  title: string;
  headerRight?: ReactNode;
  /** One-line content above the week (coach "Video cần duyệt", fighter not-cleared row). */
  above?: ReactNode;
  monday: string;
  today: string;
  selected: string;
  onSelect: (date: string) => void;
  onWeek: (delta: -1 | 1) => void;
  onToday: () => void;
  items: readonly ScheduleItem[];
  loading: boolean;
  /** Every source failed: nothing to show. */
  error: string | null;
  /** Some sources failed: show what loaded and say so. */
  partial: boolean;
  onRetry: () => void;
  onOpen: (item: ScheduleItem) => void;
  /** Quiet refetch on return to the screen and on pull-to-refresh; keeps the week on screen and never rejects. */
  onRefresh?: () => Promise<unknown>;
};

const noRefresh = () => Promise.resolve();

/** Shared week strip + day agenda for coach Lịch, fighter Tập and doctor Lịch. One screen. */
export function WeekSchedule(p: WeekScheduleProps) {
  const { colors: c } = useThemePreference();
  const insets = useSafeAreaInsets();
  const window = useWindowDimensions();
  const nav = useNavKind();
  const [measured, setMeasured] = useState(0);
  const wide = (measured || window.width - navSideWidth(nav)) >= WEEK_WIDE_MIN;
  const [sheet, setSheet] = useState(false);
  const live$ = useLiveRefresh(p.onRefresh ?? noRefresh);
  const days = weekDays(p.monday);
  const byDay = (d: string) => sortDay(p.items.filter(x => x.date === d));
  const list = byDay(p.selected);
  const max = wide ? 12 : 5;
  const dow = (d: string) => days.indexOf(d);
  const atToday = p.selected === p.today && days.includes(p.today);

  const row = (x: ScheduleItem) => <ItemRow key={x.key} item={x} onPress={() => { setSheet(false); p.onOpen(x); }}/>;
  return <View testID="week-schedule" onLayout={e => setMeasured(Math.round(e.nativeEvent.layout.width))} style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top }}>
    <View style={{ minHeight: 54, flexDirection: "row", alignItems: "center", paddingHorizontal: 10, borderBottomColor: c.line, borderBottomWidth: 1 }}>
      <View style={{ width: 56 }}/>
      <Text accessibilityRole="header" numberOfLines={1} style={{ flex: 1, textAlign: "center", fontFamily: fonts.display, fontSize: fz(20), lineHeight: lh(27), letterSpacing: 0.4, textTransform: "uppercase", color: c.ink }}>{p.title}</Text>
      <View style={{ width: 56, alignItems: "flex-end" }}>{p.headerRight}</View>
    </View>
    {/* Sized for one phone screen; the scroll view only catches tiny windows or very large text. */}
    <ScrollView showsVerticalScrollIndicator={false} refreshControl={p.onRefresh ? <LiveRefreshControl refreshing={live$.refreshing} onRefresh={live$.onRefresh}/> : undefined} contentContainerStyle={{ paddingHorizontal: wide ? 28 : 22, paddingTop: wide ? 16 : 12, paddingBottom: 16, gap: wide ? 16 : 12 }}>
      {p.above}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
        <Arrow dir="left" label={t.prevWeek} onPress={() => p.onWeek(-1)}/>
        <Text testID="week-range" style={{ flex: 1, fontFamily: fonts.display, fontSize: wide ? 22 : 18, letterSpacing: 0.5, color: c.ink, paddingLeft: 6 }}>{t.weekRange(shortDay(days[0]).slice(0, 2), shortDay(days[6]))}</Text>
        {!atToday ? <Pressable accessibilityRole="button" onPress={p.onToday} style={{ minHeight: 44, paddingHorizontal: 10, justifyContent: "center" }}><Text style={{ ...readableTextStyle(14, true), color: c.lotus }}>{t.today}</Text></Pressable> : null}
        <Arrow dir="right" label={t.nextWeek} onPress={() => p.onWeek(1)}/>
      </View>
      <WeekStrip days={days} wide={wide} today={p.today} selected={p.selected} byDay={byDay} onSelect={d => { if (d !== p.selected) selectionHaptic(); p.onSelect(d); }}/>
      {p.partial && !p.error ? <RetryRow text={t.partFailed} onRetry={p.onRetry}/> : null}
      <View testID="day-agenda">
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", paddingTop: 6, paddingBottom: 4 }}>
          <Text accessibilityRole="header" style={{ fontFamily: fonts.display, fontSize: wide ? 22 : 18, letterSpacing: 0.5, textTransform: "uppercase", color: c.ink }}>{`${t.dowFull[dow(p.selected)] ?? ""}, ${shortDay(p.selected)}`}</Text>
          {list.length ? <Text style={{ ...readableTextStyle(13, true), color: c.inkMuted }}>{t.count(list.length)}</Text> : null}
        </View>
        {/* The selected day's list fades in when the day changes (peers: no slide). */}
        <Swap swapKey={p.selected}>
        {p.loading && !p.items.length ? <View style={{ paddingVertical: 28 }}><ActivityIndicator color={c.lotus}/></View>
          : p.error ? <RetryRow text={t.loadFailed} onRetry={p.onRetry}/>
          : list.length ? <>
            <View style={wide ? { flexDirection: "row", flexWrap: "wrap", columnGap: 28 } : undefined}>
              {list.slice(0, max).map(x => <View key={x.key} style={wide ? { width: "48%", flexGrow: 1 } : undefined}>{row(x)}</View>)}
            </View>
            {list.length > max ? <Pressable accessibilityRole="button" onPress={() => setSheet(true)} style={{ minHeight: 44, justifyContent: "center", alignSelf: "flex-start" }}><Text style={{ fontFamily: fonts.display, fontSize: fz(16), color: c.lotus }}>{t.more(list.length - max)}</Text></Pressable> : null}
          </>
          : <Text style={{ ...readableTextStyle(14, true), color: c.ink, paddingVertical: 14 }}>{t.emptyDay}</Text>}
        </Swap>
      </View>
    </ScrollView>
    <SlideSheet visible={sheet} onClose={() => setSheet(false)} title={`${t.dowFull[dow(p.selected)] ?? ""}, ${shortDay(p.selected)}`}>
      <View style={{ paddingHorizontal: 20, paddingBottom: 8 }}>{list.map(row)}</View>
    </SlideSheet>
  </View>;
}

const GAP = 4;
const dayEase = Easing.bezier(...motion.easeOut);
/**
 * Seven day cells over one dark tile that slides to the selected day (transform only). Changing week slides the
 * cells in from the side the week came from. Reduced motion: the tile jumps and the cells just appear.
 */
function WeekStrip({ days, wide, today, selected, byDay, onSelect }: { days: string[]; wide: boolean; today: string; selected: string; byDay: (d: string) => ScheduleItem[]; onSelect: (d: string) => void }) {
  const { colors: c } = useThemePreference();
  const reduced = useReducedMotion();
  const [w, setW] = useState(0);
  const cell = w ? (w - GAP * 6) / 7 : 0;
  const h = wide ? 92 : 70;
  const index = Math.max(0, days.indexOf(selected));
  const inWeek = days.includes(selected);
  const x = useSharedValue(0);
  const prevWeek = useRef(days[0]);
  const dir = days[0] === prevWeek.current ? 0 : days[0] > prevWeek.current ? 1 : -1;
  useEffect(() => { prevWeek.current = days[0]; }, [days]);
  useEffect(() => { x.value = reduced || !cell ? index * (cell + GAP) : withTiming(index * (cell + GAP), { duration: motion.base, easing: dayEase }); }, [index, cell, reduced, x]);
  const tile = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  const k = 9;
  const entering = reduced || dir === 0 ? undefined : (dir > 0 ? FadeInRight : FadeInLeft)?.duration?.(motion.base);
  return <View accessibilityRole="tablist" onLayout={e => setW(e.nativeEvent.layout.width)} style={{ minHeight: h }}>
    {cell && inWeek ? <Animated.View pointerEvents="none" style={[{ position: "absolute", left: 0, top: 0, width: cell, height: h }, tile]}>
      <Svg width={cell} height={h}><Path d={`M0 0H${cell - k}L${cell} ${k}V${h}H${k}L0 ${h - k}Z`} fill={c.ink}/></Svg>
    </Animated.View> : null}
    <Animated.View key={days[0]} entering={entering} style={{ flexDirection: "row", gap: GAP }}>
      {days.map((d, i) => <DayCell key={d} date={d} dow={i} wide={wide} today={d === today} selected={d === selected} items={byDay(d)} onPress={() => onSelect(d)}/>)}
    </Animated.View>
  </View>;
}

function DayCell({ date, dow, wide, today, selected, items, onPress }: { date: string; dow: number; wide: boolean; today: boolean; selected: boolean; items: ScheduleItem[]; onPress: () => void }) {
  const { colors: c } = useThemePreference();
  const ink = selected ? c.bg : c.ink;
  return <PressableScale scaleTo={0.96} testID={`day-${date}`} accessibilityRole="tab" accessibilityLabel={t.dayA11y(`${t.dowFull[dow]} ${shortDay(date)}`, items.length)} accessibilityState={{ selected }} onPress={onPress}
    style={{ flex: 1, minHeight: wide ? 92 : 70, alignItems: "center", justifyContent: "center", gap: wide ? 4 : 2 }}>
    <Text style={{ ...readableTextStyle(wide ? 13.5 : 12, true), color: selected ? c.bg : c.inkMuted }}>{t.dow[dow]}</Text>
    <Text style={{ fontFamily: fonts.displayExtraBold, fontSize: wide ? 34 : 24, lineHeight: wide ? 36 : 26, color: ink }}>{Number(date.slice(8, 10))}</Text>
    <View style={{ flexDirection: "row", gap: 3, height: 7, alignItems: "center" }}>
      {dayDots(items).map((d, i) => <View key={i} style={{ width: wide ? 7 : 6, height: wide ? 7 : 6, borderRadius: 4, backgroundColor: d === "hot" ? (selected ? "#D9381E" : c.lotus) : selected ? c.bg : c.inkSubtle }}/>)}
    </View>
    {today ? <View aria-hidden={true} style={{ position: "absolute", left: "25%", right: "25%", bottom: 3, height: 2, backgroundColor: c.lotus }}/> : null}
  </PressableScale>;
}

const KIND_TONE: Record<ScheduleKind, "danger" | "success" | "warning" | "ink"> = { session: "ink", weigh: "danger", fight: "danger", free: "success", expire: "warning", follow: "ink" };
function ItemRow({ item, onPress }: { item: ScheduleItem; onPress: () => void }) {
  const { colors: c } = useThemePreference();
  const tone = KIND_TONE[item.kind];
  const kindColor = tone === "danger" ? c.danger : tone === "success" ? c.success : tone === "warning" ? c.warning : c.ink;
  return <Pressable testID={`item-${item.key}`} accessibilityRole="button" accessibilityLabel={`${item.time ?? t.allDayA11y}, ${t.kind[item.kind]}, ${item.title}, ${item.who}`} onPress={onPress}
    style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 60, paddingVertical: 8, borderBottomColor: c.line, borderBottomWidth: 1, opacity: pressed ? 0.7 : 1 })}>
    <Text style={item.time ? { width: 52, fontFamily: fonts.display, fontSize: fz(18), color: c.ink } : { width: 52, ...readableTextStyle(12, true), lineHeight: lh(15), textTransform: "uppercase", color: c.inkMuted }}>{item.time ?? t.allDay}</Text>
    {/* Redesign step 18 (owner 2026-11-12): uppercase title, then one ink line "kind · who"; only the kind word of a
        weigh-in, fight or suspension end carries colour. Shared by coach Lịch, fighter Tập and doctor Lịch. */}
    <View style={{ flex: 1, minWidth: 0 }}>
      <Text numberOfLines={1} style={{ fontFamily: fonts.display, fontSize: fz(17), lineHeight: lh(20), letterSpacing: 0.5, textTransform: "uppercase", color: c.ink }}>{item.title}</Text>
      <Text testID={`item-line-${item.key}`} numberOfLines={1} style={{ ...readableTextStyle(13.5), color: c.ink }}>
        <Text style={{ ...readableTextStyle(13.5, true), color: kindColor }}>{t.kind[item.kind]}</Text>{item.who ? ` · ${item.who}` : ""}
      </Text>
    </View>
    <Icon name="chevron" size={18} color={c.inkSubtle}/>
  </Pressable>;
}

function Arrow({ dir, label, onPress }: { dir: "left" | "right"; label: string; onPress: () => void }) {
  const { colors: c } = useThemePreference();
  return <PressableScale accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: c.controlBorder }}>
    <View style={dir === "left" ? { transform: [{ scaleX: -1 }] } : undefined}><Icon name="chevron" size={18} color={c.ink}/></View>
  </PressableScale>;
}

function RetryRow({ text, onRetry }: { text: string; onRetry: () => void }) {
  const { colors: c } = useThemePreference();
  return <View accessibilityRole="alert" style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 6 }}>
    <Text style={{ ...readableTextStyle(13.5, true), color: c.danger, flex: 1 }}>{text}</Text>
    <Pressable accessibilityRole="button" onPress={onRetry} style={{ minHeight: 44, justifyContent: "center" }}><Text style={{ ...readableTextStyle(14, true), color: c.lotus }}>{t.retry}</Text></Pressable>
  </View>;
}
