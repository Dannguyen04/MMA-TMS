import { Fragment, createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { ActivityIndicator, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions, type TextInputProps } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Line, Path, Text as SvgText } from "react-native-svg";
import { useRouter } from "expo-router";
import { KeyboardFrame, KeyboardScroll, type KeyboardScrollRef, useTypingRoom } from "@/components/keyboard-aware";
import { fonts, useThemePreference, useTypography } from "@/theme/index";
import { readableTextStyle, fz, lh } from "@/theme/typography";
import { ArenaFrame, ArenaSurface } from "@/components/arena/arena-frame";
import { CampScrollContext } from "./camp-scroll-context";
import { PressableScale } from "@/components/motion";
import { FocusEditor } from "@/components/focus-editor";
import { CampReveal, CampSelection } from "./camp-motion";
import { FIRE_TOP, RowFire, TabFire, type TabBox } from "./tab-fire";
import { READABLE_MAX_WIDTH } from "@/components/readable-width";
import { navSideWidth, useNavKind } from "@/components/nav-rail";
import { useBottomTabBarVisible } from "@/components/tab-bar-visibility";
import { CAMP_TWO_COLUMN_MAX, CampTwoColumnsProvider, campTwoColumns } from "./camp-columns";
import { campText } from "@/features/fight-camp/i18n/fight-camp";
import * as Haptics from "expo-haptics";
import { LitFill, Sheen, type LitKind } from "./camp-lit";

export function Copy({ children, muted, strong, color, large, small, strike }: { children: ReactNode; muted?: boolean; strong?: boolean; color?: string; large?: boolean; small?: boolean; strike?: boolean }) {
  const { colors: c } = useThemePreference();
  return <Text style={{ ...readableTextStyle(large ? 18 : small ? 13 : 14, strong), color: color ?? (muted ? c.inkMuted : c.ink), flexShrink: 1, textDecorationLine: strike ? "line-through" : "none" }}>{children}</Text>;
}
export type CampIconName = "alert" | "check" | "arrow" | "plus" | "minus" | "back";
/** Authored stroke icons (react-native-svg), one 2px stroke family. Always decorative: the adjacent text carries the meaning. */
export function CampIcon({ name, color, size = 20 }: { name: CampIconName; color: string; size?: number }) {
  const p = { stroke: color, strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, fill: "none" };
  return <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width: size, height: size }}>
    <Svg width={size} height={size} viewBox="0 0 24 24" aria-hidden={true}>
      {name === "alert" ? <><Path d="M12 3L22 20H2Z" {...p}/><Line x1={12} y1={10} x2={12} y2={14} {...p}/><Line x1={12} y1={17} x2={12} y2={17.01} {...p}/></> : null}
      {name === "check" ? <Path d="M4 12.5L9.5 18L20 6" {...p}/> : null}
      {name === "arrow" ? <><Line x1={6} y1={18} x2={18} y2={6} {...p}/><Path d="M9 6H18V15" {...p}/></> : null}
      {name === "plus" ? <><Line x1={5} y1={12} x2={19} y2={12} {...p}/><Line x1={12} y1={5} x2={12} y2={19} {...p}/></> : null}
      {name === "minus" ? <Line x1={5} y1={12} x2={19} y2={12} {...p}/> : null}
      {name === "back" ? <Path d="M15 5L8 12L15 19" {...p} strokeWidth={2.5}/> : null}
    </Svg>
  </View>;
}
/** In-app reading size times the OS text size, so SVG text follows Dynamic Type / font scale like native Text does. */
export function useSvgTextScale() {
  const live = useTypography(); const { fontScale } = useWindowDimensions();
  return Math.min(2.4, live.sizeFactor * (fontScale || 1));
}
export function SvgTitle({ children, small = false }: { children: string; small?: boolean }) {
  const { colors: c } = useThemePreference();
  const live = useTypography(); const scale = useSvgTextScale();
  const words = children.toUpperCase().split(" ");
  const lines = [""];
  for (const w of words) {
    if ((lines[lines.length - 1] + w).length > Math.max(8, Math.floor((small ? 29 : 23) / scale))) lines.push(w);
    else lines[lines.length - 1] += `${lines[lines.length - 1] ? " " : ""}${w}`;
  }
  const size = (small ? 26 : 39) * scale;
  const step = Math.ceil(size * Math.max(1.2, live.lineHeight));
  const h = lines.length * step + 16;
  return <View accessible accessibilityRole="header" accessibilityLabel={children} style={{ alignSelf: "stretch" }}>
    <Svg width="100%" height={h} viewBox={`0 0 350 ${h}`} preserveAspectRatio="xMinYMid meet" aria-hidden={true}>
      <Path d={`M0 ${h - 8}L8 9H12L4 ${h - 8}Z`} fill={c.lotus} />
      {lines.map((line, i) => <SvgText key={i} x={22} y={step * (i + 1)} fill={c.ink} fontFamily={fonts.display} fontSize={size} letterSpacing={size * live.letterSpacingEm}>{line}</SvgText>)}
    </Svg>
  </View>;
}
/**
 * A section heading inside a screen. DESIGN.md: the screen names itself once, in the CampShell header bar; sections
 * below it use this plain condensed heading (no red slash).
 */
export function SectionTitle({ children }: { children: string }) {
  const { colors: c } = useThemePreference();
  return <Text accessibilityRole="header" style={{ fontFamily: fonts.display, fontSize: fz(22), lineHeight: lh(30), letterSpacing: 0.4, textTransform: "uppercase", color: c.ink }}>{children}</Text>;
}
export function Frame({ children, tone, pad = 16 }: { children: ReactNode; tone?: "danger" | "success" | "accent"; pad?: number; slip?: boolean }) {
  return <ArenaFrame tone={tone} pad={pad}>{children}</ArenaFrame>;
}
/** Owner 2026-11-11: inside a notice, every sentence sits on its own line. */
export function sentences(text: string): string[] {
  return text.split(/(?<=[.!?])\s+(?=\S)/).map(x => x.trim()).filter(Boolean);
}
export function Notice({ title, children, danger = false, success = false }: { title: string; children?: ReactNode; danger?: boolean; success?: boolean }) {
  const { colors: c } = useThemePreference();
  const content = <View accessibilityRole={danger ? "alert" : undefined} accessibilityLiveRegion={success ? "polite" : undefined}>
    <Frame tone={danger ? "danger" : success ? "success" : "accent"} pad={16}>
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
        <View style={{ paddingTop: 1 }}><CampIcon name={danger ? "alert" : success ? "check" : "arrow"} color={danger ? c.danger : success ? c.success : c.lotus}/></View>
        <Copy strong color={danger ? c.danger : success ? c.success : c.ink}>{title}</Copy>
      </View>
      {typeof children === "string" ? sentences(children).map((line, i) => <Copy key={i}>{line}</Copy>) : children ? <Copy>{children}</Copy> : null}
    </Frame>
  </View>;
  return success && !danger ? <CampReveal>{content}</CampReveal> : content;
}
export function Action({ label, onPress, secondary, danger, disabled, pending, icon }: { label: string; onPress: () => void; secondary?: boolean; danger?: boolean; disabled?: boolean; pending?: boolean; icon?: "minus" | "plus" }) {
  const { colors: c } = useThemePreference();
  const off = !!disabled || !!pending;
  const kind: LitKind = off ? "disabled" : secondary ? "secondary" : danger ? "danger" : "primary";
  const ink = off ? c.disabledInk : secondary ? c.ink : "#FFFFFF";
  // The one main (red, non-danger) button per screen gets the light sheen: on appear and once per press.
  const main = kind === "primary";
  const [sheen, setSheen] = useState(0);
  return <PressableScale scaleTo={0.985} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: off, busy: !!pending }} disabled={off}
    onPressIn={() => { if (main) { setSheen(n => n + 1); if (Platform.OS !== "web") void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } }}
    onPress={onPress} style={{ minHeight: 54, justifyContent: "center", alignItems: "center" }}>
    <LitFill kind={kind}/>
    {main ? <Sheen trigger={sheen}/> : null}
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingVertical: 12 }}>{pending ? <ActivityIndicator size="small" color={ink}/> : null}{icon ? <CampIcon name={icon} color={ink} size={24}/> : <Text style={{ ...readableTextStyle(15, true), color: ink, textAlign: "center", flexShrink: 1, ...(main || kind === "danger" ? { textShadowColor: "rgba(60,8,0,0.45)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 0 } : {}) }}>{label}</Text>}</View>
  </PressableScale>;
}
export type ChoiceTone = "good" | "bad";
/**
 * Pick one. Default: text options with a red underline. `chips`: bordered chips whose selected state is a lit fill
 * (neutral ink, good = green, bad = deep red) with white text (owner 2026-11-11: never pink with dark text).
 */
export function Choices<T extends string | number | null | undefined>({ label, options, value, onChange, disabled, chips, wrap: wrapAlways }: { label?: string; options: readonly { value: T; label: string; tone?: ChoiceTone }[]; value: T; onChange: (v: T) => void; disabled?: boolean; chips?: boolean;
  /** Rows of three even with five or fewer options (long labels such as "Đấm bóng ma"). */ wrap?: boolean }) {
  const { colors: c } = useThemePreference();
  const live = useTypography();
  const labelStyle = { ...readableTextStyle(14), fontFamily: live.faces.medium };
  // Six or more chips wrap into rows of three so a long label (Chuẩn bị thi đấu) stays on one line.
  const wrap = wrapAlways || options.length > 5;
  const oneRow = options.length <= 4 && options.every(o => o.label.length <= 10);
  if (chips) return <View style={{ gap: 8 }}>
    {label ? <Copy strong>{label}</Copy> : null}
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={{ flexDirection: "row", flexWrap: wrap ? "wrap" : "nowrap", gap: 6 }}>
      {options.map((o, i) => { const on = value === o.value;
        return <PressableScale key={i} scaleTo={0.97} disabled={disabled} accessibilityRole="radio" aria-checked={on} aria-disabled={!!disabled} accessibilityState={{ checked: on, disabled }} onPress={() => onChange(o.value)}
          style={{ ...(wrap ? { flexGrow: 1, flexBasis: "30%" } : { flex: 1 }), minWidth: 0, minHeight: 46, justifyContent: "center", paddingHorizontal: 4, opacity: disabled ? 0.55 : 1 }}>
          {on ? <LitFill kind={o.tone ?? "neutral"} cut={false}/> : <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderWidth: 1, borderColor: c.controlBorder }]}/>}
          <Text numberOfLines={wrap ? 1 : 2} style={{ ...readableTextStyle(13.5, true), color: on ? (o.tone ? "#FFFFFF" : c.bg) : c.ink, textAlign: "center" }}>{o.label}</Text>
        </PressableScale>; })}
    </View>
  </View>;
  return <View style={{ gap: 6 }}>
    {label ? <Copy strong>{label}</Copy> : null}
    {/* Up to four short options share one row (Tất cả, Hiệp 1-3); longer sets wrap. The underline is a plain View on the
        bottom edge: percentage SVG lines drew through the label on Android (owner 2026-11-16). */}
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={{ flexDirection: "row", flexWrap: oneRow ? "nowrap" : "wrap", gap: 8 }}>
      {options.map((o, i) => <Pressable key={i} disabled={disabled} accessibilityRole="radio" aria-checked={value === o.value} aria-disabled={!!disabled} accessibilityState={{ checked: value === o.value, disabled }} onPress={() => onChange(o.value)} style={{ flexGrow: options.length === 3 ? Math.max(6, o.label.length) : 1, flexBasis: options.length === 3 || oneRow ? 0 : 85, minWidth: 0, minHeight: 48, justifyContent: "center", paddingVertical: 10, paddingHorizontal: 4 }}>
        <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 1, backgroundColor: c.line }}/>
        <CampSelection selected={value === o.value}><View style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 3, backgroundColor: c.lotus }}/></CampSelection>
        <Text numberOfLines={1} style={{ ...labelStyle, color: value === o.value ? c.lotus : c.inkMuted, textAlign: "center" }}>{o.label}</Text>
      </Pressable>)}
    </View>
  </View>;
}
/** A glyph for a compact mark button: yes (check), no (cross), skip (dash). */
export type MarkGlyph = "yes" | "no" | "skip";
function Glyph({ kind, color, size = 20 }: { kind: MarkGlyph; color: string; size?: number }) {
  const d = kind === "yes" ? "M5 12.5l4.5 4.5L19 7.5" : kind === "no" ? "M6.5 6.5l11 11M17.5 6.5l-11 11" : "M6 12h12";
  return <Svg width={size} height={size} viewBox="0 0 24 24"><Path d={d} stroke={color} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" fill="none"/></Svg>;
}
type MarkOption<T> = { value: T; label: string; glyph: MarkGlyph; tone?: ChoiceTone };
/**
 * One mark on one row (owner 2026-11-18, less scrolling): the item on the left, compact glyph buttons on the right.
 * Each button reads its full label to assistive tech; the group heading carries the visible legend.
 */
export function MarkRow<T extends string>({ label, options, value, onChange, disabled }: { label: string; options: readonly MarkOption<T>[]; value: T | null; onChange: (v: T) => void; disabled?: boolean }) {
  const { colors: c } = useThemePreference();
  const live = useTypography();
  const toneColor = (tone?: ChoiceTone) => tone === "good" ? c.success : tone === "bad" ? c.danger : c.inkMuted;
  return <View style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 48 }}>
    <Text style={{ flex: 1, minWidth: 0, ...readableTextStyle(15), fontFamily: live.faces.medium, color: c.ink }}>{label}</Text>
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={{ flexDirection: "row", gap: 4 }}>
      {options.map(o => { const on = value === o.value;
        return <PressableScale key={o.value} scaleTo={0.94} disabled={disabled} accessibilityRole="radio" accessibilityLabel={o.label} aria-checked={on} aria-disabled={!!disabled} accessibilityState={{ checked: on, disabled }} onPress={() => onChange(o.value)}
          style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center", opacity: disabled ? 0.55 : 1 }}>
          {on ? <LitFill kind={o.tone ?? "neutral"} cut={false}/> : <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderWidth: 1, borderColor: c.controlBorder }]}/>}
          <View pointerEvents="none" style={{ zIndex: 1 }}><Glyph kind={o.glyph} color={on ? (o.tone ? "#FFFFFF" : c.bg) : toneColor(o.tone)}/></View>
        </PressableScale>; })}
    </View>
  </View>;
}
/**
 * A group of marks that folds away once the coach is done with it (owner 2026-11-18): the heading is the toggle and
 * keeps the count in view while folded. The screen owns `open`, so a fold survives switching rounds and tabs.
 */
export function MarkGroup({ title, count, done, legend, open, onToggle, children }: { title: string; count?: string; done?: boolean; legend?: ReactNode; open: boolean; onToggle: () => void; children: ReactNode }) {
  const { colors: c } = useThemePreference();
  return <View style={{ gap: 10 }}>
    <Pressable accessibilityRole="button" aria-expanded={open} accessibilityState={{ expanded: open }} accessibilityLabel={count ? `${title}, ${count}` : title} onPress={onToggle}
      style={({ pressed }) => ({ minHeight: 44, flexDirection: "row", alignItems: "center", gap: 10, opacity: pressed ? 0.7 : 1 })}>
      <View style={{ flex: 1, minWidth: 0 }}><SectionTitle>{title}</SectionTitle></View>
      {count ? <Text style={{ ...readableTextStyle(13), color: done ? c.success : c.inkMuted }}>{count}</Text> : null}
      <Svg width={18} height={18} viewBox="0 0 24 24" style={{ transform: [{ rotate: open ? "180deg" : "0deg" }] }}>
        <Path d="M6 9l6 6 6-6" stroke={c.inkMuted} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" fill="none"/>
      </Svg>
    </Pressable>
    {open ? <>{legend}{children}</> : null}
  </View>;
}
/** The legend for a group of MarkRows: each glyph with its word, on one line. */
export function MarkLegend({ options }: { options: readonly Omit<MarkOption<string>, "value">[] }) {
  const { colors: c } = useThemePreference();
  return <View style={{ flexDirection: "row", flexWrap: "wrap", columnGap: 12, rowGap: 2 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
    {options.map(o => <View key={o.label} style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
      <Glyph kind={o.glyph} size={15} color={o.tone === "good" ? c.success : o.tone === "bad" ? c.danger : c.inkMuted}/>
      <Text style={{ ...readableTextStyle(12.5), color: c.inkMuted }}>{o.label}</Text>
    </View>)}
  </View>;
}
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
/** Full-row target and SVG surface; selected state is also announced and written. */
/** `tag` is a short source label drawn before the text (e.g. "AI"); it is also read first by screen readers. */
export function PlanToggle({ label, selected, onPress, disabled, danger, tag, testID }: { label: string; selected: boolean; onPress: () => void; disabled?: boolean; danger?: boolean; tag?: string; testID?: string }) {
  const { colors: c } = useThemePreference();
  const live = useTypography();
  return <PressableScale scaleTo={0.99} testID={testID} accessibilityRole="checkbox" accessibilityLabel={tag ? `${tag}: ${label}` : label} aria-checked={selected} aria-disabled={!!disabled} accessibilityState={{ checked: selected, disabled: !!disabled }} disabled={disabled} onPress={onPress}
    style={{ minHeight: 48, padding: 12, justifyContent: "center", opacity: disabled ? 0.55 : 1 }}>
    <ArenaSurface tone={danger ? "danger" : "neutral"} fill={danger ? c.dangerSoft : undefined}/>
    <CampSelection selected={selected}><ArenaSurface active tone={danger ? "danger" : "neutral"} fill={danger ? c.dangerSoft : undefined}/></CampSelection>
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <CampIcon name={selected ? "check" : "plus"} color={danger ? c.danger : selected ? c.lotus : c.inkMuted} size={18}/>
      {tag ? <View aria-hidden={true} importantForAccessibility="no-hide-descendants" style={{ borderWidth: 1, borderColor: c.lotus, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 1 }}><Text style={{ ...readableTextStyle(12, true), color: c.lotus }}>{tag}</Text></View> : null}
      <Text style={{ ...readableTextStyle(14), fontFamily: live.faces.medium, color: danger ? c.danger : c.ink, flex: 1 }}>{label}</Text>
    </View>
  </PressableScale>;
}
export function Field({ label, large, helper, error, ...props }: TextInputProps & { label: string; large?: boolean; helper?: string; error?: string }) {
  const { colors: c } = useThemePreference();
  const [focused, setFocused] = useState(false);
  const input = useRef<TextInput>(null);
  // Notes open on their own (FocusEditor): the page's pinned tabs and buttons no longer squeeze the lines being written.
  const focusWriting = !!props.multiline && props.editable !== false && Platform.OS !== "web";
  const [writing, setWriting] = useState(false);
  return <View style={{ gap: 7 }}>
    {focusWriting ? <FocusEditor visible={writing} label={label} value={props.value} onChangeText={props.onChangeText} placeholder={props.placeholder} maxLength={props.maxLength} autoCapitalize={props.autoCapitalize} helper={helper} error={error} onClose={() => setWriting(false)}/> : null}
    <Copy strong>{label}</Copy>
    <Pressable accessible={false} focusable={false} disabled={props.editable === false} onPress={() => input.current?.focus()}>
      <Frame pad={large ? 18 : 13} tone={error ? "danger" : focused ? "accent" : undefined}>
        <TextInput {...props} ref={input} accessibilityLabel={label} placeholderTextColor={c.inkSubtle} selectionColor={c.ring} showSoftInputOnFocus={focusWriting ? false : props.showSoftInputOnFocus} onFocus={e => { if (focusWriting) { input.current?.blur(); setWriting(true); return; } setFocused(true); props.onFocus?.(e); }} onBlur={e => { setFocused(false); props.onBlur?.(e); }} style={{ ...readableTextStyle(large ? 64 : 16), position: "relative", zIndex: 1, color: c.ink, minHeight: props.multiline ? 75 : large ? 85 : 44, padding: 0, textAlignVertical: "top", ...(Platform.OS === "web" ? { outlineStyle: "none", borderWidth: 0, resize: "none" } as object : {}) }} />
      </Frame>
    </Pressable>
    {error ? <Copy color={c.danger}>{error}</Copy> : helper ? <Copy muted>{helper}</Copy> : null}
  </View>;
}
export function WeightSlip({ value, onChange, limit, label = campText.campUi.canNangChinhThuc, disabled }: { value: string; onChange: (v: string) => void; limit: string | null; label?: string; disabled?: boolean }) {
  const { colors: c } = useThemePreference();
  const input = useRef<TextInput>(null);
  return <Pressable accessible={false} focusable={false} disabled={disabled} onPress={() => input.current?.focus()}><Frame slip pad={20}>
    <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 14 }}><Copy muted>{label}</Copy><Copy strong>{limit == null ? campText.campUi.chuaCoGioiHan : `${limit} kg`}</Copy></View>
    <View style={{ flexDirection: "row", alignItems: "baseline", gap: 10, paddingVertical: 12 }}>
      <TextInput ref={input} accessibilityLabel={label} editable={!disabled} value={value} onChangeText={onChange} inputMode="decimal" keyboardType="decimal-pad" maxLength={5} placeholder="00,0" placeholderTextColor={c.inkSubtle} selectionColor={c.ring} style={{ flex: 1, minWidth: 0, position: "relative", zIndex: 1, color: c.ink, fontFamily: fonts.display, fontSize: fz(78), lineHeight: lh(98), textAlign: "center", padding: 0, ...(Platform.OS === "web" ? { outlineStyle: "none", borderWidth: 0 } as object : {}) }}/>
      <Copy muted>{campText.campUi.kg}</Copy>
    </View>
    <Copy muted>{campText.campUi.gioiHanCanOGoc}</Copy>
  </Frame></Pressable>;
}
export function Fact({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  const { colors: c } = useThemePreference();
  return <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 18, paddingVertical: 10, borderBottomColor: c.line, borderBottomWidth: StyleSheet.hairlineWidth }}><Copy muted>{label}</Copy><View style={{ maxWidth: "62%" }}><Copy strong color={danger ? c.danger : undefined}>{value}</Copy></View></View>;
}
export function Busy() { const { colors } = useThemePreference(); return <View style={{ paddingVertical: 48, gap: 16 }}><ActivityIndicator color={colors.lotus}/><Copy muted>{campText.campUi.dangTaiDuLieu}</Copy></View>; }
/** `footer` docks the screen's save action above the keyboard and home indicator. */
/** Lets a nested screen dock its primary action in the shell footer (stays above the keyboard). */
const CampFooterSlot = createContext<((node: ReactNode) => void) | null>(null);
/** Lets a nested screen pin content (round picker, tabs) above the shell's body, below the header and `top`. */
const CampTopSlot = createContext<((node: ReactNode) => void) | null>(null);
export function CampTop({ children }: { children: ReactNode }) {
  const set = useContext(CampTopSlot);
  useEffect(() => { set?.(children); }, [set, children]);
  useEffect(() => () => set?.(null), [set]);
  return set ? null : <View style={{ gap: 10 }}>{children}</View>;
}
export function CampFooter({ children }: { children: ReactNode }) {
  const set = useContext(CampFooterSlot);
  useEffect(() => { set?.(children); }, [set, children]);
  useEffect(() => () => set?.(null), [set]);
  return set ? null : <View style={{ gap: 10 }}>{children}</View>;
}
/** Below this window height (phone landscape, split screen) CampShell uses a compact header and footer. */
export const CAMP_SHORT_HEIGHT = 500;
export function CampShell({ title, subtitle, children, onBack, preview, footer: ownFooter, columns = false, top, onRefresh }: { title: string; subtitle?: string; children: ReactNode; onBack?: () => void; preview?: boolean; footer?: ReactNode; /** Pull-to-refresh (fighter step 14): a quiet refetch that keeps what is on screen. */ onRefresh?: () => Promise<unknown>; /** Pinned under the header on every view (fighter vs opponent + status); never scrolls. */ top?: ReactNode; /** Phase 5 E: allow two columns when the shell gets at least CAMP_TWO_COLUMN_MIN (744) wide. */ columns?: boolean }) {
  const { colors: c } = useThemePreference(); const insets = useSafeAreaInsets(); const router = useRouter();
  const [slot, setSlot] = useState<ReactNode>(null); const footer = ownFooter ?? slot; const [topSlot, setTopSlot] = useState<ReactNode>(null);
  const scroll = useRef<KeyboardScrollRef>(null);
  // Typing: the pinned top folds away, and on a short screen the footer too, so the field keeps the room.
  const room = useTypingRoom();
  // Inside Coach/Admin tabs the bar below already pads for the gesture area; adding the inset again left a gap.
  const tabBelow = useBottomTabBarVisible();
  const [pulling, setPulling] = useState(false);
  const pull = useCallback(() => { if (!onRefresh) return; setPulling(true); void onRefresh().catch(() => undefined).finally(() => setPulling(false)); }, [onRefresh]);
  // Phase 5 D: tablets may rotate (Android 16 large screens, iPad multitasking); short windows get a compact header and footer.
  const window = useWindowDimensions(); const short = window.height < CAMP_SHORT_HEIGHT;
  // Content width after the side navigation: measured, with the window minus the rail (88) or iPad sidebar (240) until the first layout.
  const nav = useNavKind(); const [measured, setMeasured] = useState(0);
  const wide = campTwoColumns(columns, measured || window.width - navSideWidth(nav));
  const scrollTop = useCallback(() => { scroll.current?.scrollTo({ y: 0, animated: false }); }, []);
  useEffect(scrollTop, [title, scrollTop]);
  return <KeyboardFrame testID="camp-shell" onLayout={e => setMeasured(Math.round(e.nativeEvent.layout.width))} style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top }}>
    <View testID="camp-column" style={{ flex: 1, width: "100%", maxWidth: wide ? CAMP_TWO_COLUMN_MAX : READABLE_MAX_WIDTH, alignSelf: "center" }}>
      <View testID="camp-header" style={{ paddingHorizontal: 18, minHeight: short ? 44 : 54, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomColor: c.line, borderBottomWidth: 1 }}>
        {/* Equal side slots keep the title optically centred whether or not the "Dữ liệu mẫu" marker shows. */}
        <View style={{ width: 88, alignItems: "flex-start" }}><Pressable accessibilityRole="button" accessibilityLabel={campText.campUi.quayLai} onPress={onBack ?? (() => router.back())} style={{ minWidth: 48, minHeight: 48, justifyContent: "center" }}><CampIcon name="back" color={c.ink} size={26}/></Pressable></View>
        {/* The screen's one title lives in the header bar (it replaced the fixed "Fight Camp" label). */}
        <Text accessibilityRole="header" numberOfLines={1} style={{ flex: 1, textAlign: "center", fontFamily: fonts.display, fontSize: short ? 18 : 20, lineHeight: short ? 24 : 27, letterSpacing: 0.4, textTransform: "uppercase", color: c.ink }}>{title}</Text>
        <View style={{ width: 88, alignItems: "flex-end" }}><Copy muted small>{preview ? campText.campUi.duLieuMau : ""}</Copy></View>
      </View>
      {(top || topSlot) && !room.typing ? <View testID="camp-top" style={{ paddingHorizontal: 22, paddingTop: short ? 8 : 12, gap: 10 }}>{top}{topSlot}</View> : null}
      <KeyboardScroll ref={scroll} showsVerticalScrollIndicator={false} refreshControl={onRefresh ? <RefreshControl refreshing={pulling} onRefresh={pull} tintColor={c.lotus} colors={[c.lotus]} progressBackgroundColor={c.surface}/> : undefined} contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ paddingHorizontal: 22, paddingTop: short ? 10 : 16, paddingBottom: footer ? (short ? 12 : 20) : Math.max(tabBelow ? 0 : insets.bottom, 16) + 16, gap: short ? 12 : 16 }}>
        {subtitle ? <Copy muted>{subtitle}</Copy> : null}
        <CampScrollContext.Provider value={scrollTop}><CampTopSlot.Provider value={setTopSlot}><CampFooterSlot.Provider value={setSlot}><CampTwoColumnsProvider value={wide}><CampReveal key={title} style={{ gap: 16 }}>{children}</CampReveal></CampTwoColumnsProvider></CampFooterSlot.Provider></CampTopSlot.Provider></CampScrollContext.Provider>
      </KeyboardScroll>
      {footer && !room.tight ? <View testID="camp-footer-bar" style={{ paddingHorizontal: 22, paddingTop: short ? 6 : 12, paddingBottom: Math.max(tabBelow ? 0 : insets.bottom, short ? 6 : 12) + (short ? 2 : 8), gap: short ? 6 : 10, borderTopColor: c.line, borderTopWidth: 1, backgroundColor: c.bg }}>{footer}</View> : null}
    </View>
  </KeyboardFrame>;
}
/**
 * Weight track (owner 2026-11-19: a dot per day smeared into dots; then a filled zig-zag looked heavy).
 * The red line is the smoothed trend (a smooth line through the weigh-ins themselves when there are fewer
 * than five), ending on a dot tagged with the latest weigh-in and its distance from the limit. The plan is a light dotted line, the limit a labelled red rule.
 * Three rules, round kg, no fill. X is by day.
 */
export function WeightPlot({ points, reference, limit }: { points: { date: string; kg: number }[]; reference: { date: string; kg: number }[]; limit: number | null }) {
  const { colors: c } = useThemePreference();
  const fs = Math.max(13, Math.round(13 * useSvgTextScale()));
  // Drawn at the measured width (not a scaled viewBox), so text and line weights stay true size on any phone.
  const [W, setW] = useState(340);
  if (!points.length) return <Copy muted>{campText.campUi.chuaCoSoCanGhi}</Copy>;
  const padL = Math.ceil(fs * 1.6) + 10, padR = Math.ceil(fs * 2.9) + 6, top = fs * 2 + 14, plotH = 200, h = top + plotH + fs + 16;
  const day = (d: string) => Date.parse(`${d.slice(0, 10)}T00:00:00Z`) / 86_400_000;
  const all = [...points, ...reference];
  const d0 = Math.min(...all.map(p => day(p.date))), d1 = Math.max(...all.map(p => day(p.date)));
  const values = all.map(p => p.kg); if (limit != null) values.push(limit);
  // Round kg rules: even step so lo, mid and hi are whole numbers.
  const min = Math.min(...values), max = Math.max(...values);
  const step = Math.max(1, Math.ceil((max - min + 0.6) / 2));
  const lo = Math.floor(min - 0.3), hi = lo + step * 2;
  const ticks = [hi, lo + step, lo];
  const x = (d: string) => padL + (d1 === d0 ? 0.5 : (day(d) - d0) / (d1 - d0)) * (W - padL - padR);
  const y = (n: number) => top + (hi - n) / (hi - lo) * plotH;
  const straight = (ps: typeof points) => ps.map((p, i) => `${i ? "L" : "M"}${x(p.date).toFixed(1)} ${y(p.kg).toFixed(1)}`).join(" ");
  // Daily weigh-ins jitter by a few hundred grams; the line is a centred 9-weigh-in mean so it reads the trend,
  // while each real weigh-in stays as a small grey dot under it.
  const smooth = points.map((p, i) => { const w = points.slice(Math.max(0, i - 4), i + 5); return [x(p.date), y(w.reduce((s, q) => s + q.kg, 0) / w.length)] as const; });
  const trace = points.length >= 5 ? smooth : points.map(p => [x(p.date), y(p.kg)] as const);
  const line = monotonePath(trace);
  const [ex, ey] = trace.at(-1)!;
  const gap = limit != null ? Math.round((points.at(-1)!.kg - limit) * 10) / 10 : null;
  // The tag sits centred over the end dot, or right-aligned to it near the right edge.
  const tagAnchor = ex > W - padR - fs * 1.6 ? "end" : "middle"; const tagX = tagAnchor === "end" ? ex + 6 : ex;
  const last = points.at(-1)!;
  const kg = (n: number) => n.toFixed(1).replace(".", ",");
  const fmt = (d?: string) => d?.slice(5, 10).split("-").reverse().join("/");
  const first = all.reduce((m, p) => (day(p.date) < day(m.date) ? p : m), all[0]!).date;
  const end = all.reduce((m, p) => (day(p.date) > day(m.date) ? p : m), all[0]!).date;
  return <View accessible accessibilityLabel={campText.campUi.bieuDoCanLanGhi(points.length, last.kg, limit ?? campText.campUi.chuaDat)} style={{ gap: 12 }} onLayout={e => { const w = Math.round(e.nativeEvent.layout.width); if (w > 0 && w !== W) setW(w); }}>
    <Svg width={W} height={h} viewBox={`0 0 ${W} ${h}`} aria-hidden={true}>
      {ticks.map(n => <Line key={`g${n}`} x1={padL} x2={W - padR} y1={y(n)} y2={y(n)} stroke={c.line} strokeWidth={1}/>)}
      {ticks.map(n => <SvgText key={`t${n}`} x={padL - 10} y={y(n) + fs * 0.35} textAnchor="end" fill={c.inkMuted} fontSize={fs}>{String(n)}</SvgText>)}
      {limit != null ? <>
        <Line x1={padL} x2={W - padR} y1={y(limit)} y2={y(limit)} stroke={c.danger} strokeWidth={1.5} strokeDasharray="5 4"/>
        <SvgText x={W - padR + 6} y={y(limit) + fs * 0.35} fill={c.danger} fontSize={fs} fontWeight="700">{kg(limit)}</SvgText>
      </> : null}
      {reference.length > 1 ? <Path d={straight(reference)} stroke={c.inkMuted} strokeOpacity={0.7} strokeWidth={1.5} strokeDasharray="0.1 5" strokeLinecap="round" fill="none"/> : null}
      {line ? <Path d={line} stroke={c.lotus} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" fill="none"/> : null}
      <Circle cx={ex} cy={ey} r={5.5} fill={c.lotus} stroke={c.bg} strokeWidth={2.5}/>
      {/* Latest weigh-in and how far it is from the limit, above the end of the line. */}
      {/* Each tag line is drawn twice: a page-colour outline first, so it stays readable where it crosses the plan line. */}
      {[true, false].map(halo => <Fragment key={halo ? "h" : "t"}>
        <SvgText x={tagX} y={ey - fs - 12} textAnchor={tagAnchor} fill={halo ? c.bg : c.ink} stroke={halo ? c.bg : undefined} strokeWidth={halo ? 5 : 0} strokeLinejoin="round" fontSize={fs + 3} fontWeight="700">{kg(last.kg)}</SvgText>
        {gap != null ? <SvgText x={tagX} y={ey - 12} textAnchor={tagAnchor} fill={halo ? c.bg : gap > 0 ? c.danger : c.success} stroke={halo ? c.bg : undefined} strokeWidth={halo ? 5 : 0} strokeLinejoin="round" fontSize={fs} fontWeight="700">{gap > 0 ? `+${kg(gap)}` : gap < 0 ? `−${kg(-gap)}` : "0,0"}</SvgText> : null}
      </Fragment>)}
      <SvgText x={padL} y={h - 2} fill={c.inkMuted} fontSize={fs}>{fmt(first)}</SvgText>
      <SvgText x={W - padR} y={h - 2} textAnchor="end" fill={c.inkMuted} fontSize={fs}>{fmt(end)}</SvgText>
    </Svg>
    <View style={{ flexDirection: "row", flexWrap: "wrap", columnGap: 16, rowGap: 6 }}>
      <LegendKey color={c.lotus} label={campText.campUi.chamSoCanDaGhi}/>
      {reference.length > 1 ? <LegendKey color={c.inkMuted} dotted label={campText.campUi.loTrinhCan}/> : null}
      {limit != null ? <LegendKey color={c.danger} dashed label={campText.campUi.gioiHanCan}/> : null}
    </View>
  </View>;
}
/** Fritsch-Carlson monotone cubic through the points: smooth, and never above or below a real value between two. */
function monotonePath(p: (readonly [number, number])[]): string {
  if (p.length < 2) return "";
  const n = p.length, dx: number[] = [], m: number[] = [], t: number[] = [];
  for (let i = 0; i < n - 1; i++) { dx[i] = p[i + 1]![0] - p[i]![0]; m[i] = dx[i]! ? (p[i + 1]![1] - p[i]![1]) / dx[i]! : 0; }
  t[0] = m[0]!; t[n - 1] = m[n - 2]!;
  for (let i = 1; i < n - 1; i++) t[i] = m[i - 1]! * m[i]! <= 0 ? 0 : (3 * (dx[i - 1]! + dx[i]!)) / ((2 * dx[i]! + dx[i - 1]!) / m[i - 1]! + (dx[i]! + 2 * dx[i - 1]!) / m[i]!);
  let d = `M${p[0]![0].toFixed(1)} ${p[0]![1].toFixed(1)}`;
  for (let i = 0; i < n - 1; i++) {
    const h3 = dx[i]! / 3, [x0, y0] = p[i]!, [x1, y1] = p[i + 1]!;
    d += ` C${(x0 + h3).toFixed(1)} ${(y0 + t[i]! * h3).toFixed(1)} ${(x1 - h3).toFixed(1)} ${(y1 - t[i + 1]! * h3).toFixed(1)} ${x1.toFixed(1)} ${y1.toFixed(1)}`;
  }
  return d;
}
function LegendKey({ color, label, dashed, dotted, dot }: { color: string; label: string; dashed?: boolean; dotted?: boolean; dot?: boolean }) {
  return <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
    <Svg width={18} height={8} aria-hidden={true}>{dot
      ? <><Circle cx={4} cy={4} r={2.25} fill={color} fillOpacity={0.55}/><Circle cx={13} cy={4} r={2.25} fill={color} fillOpacity={0.55}/></>
      : <Line x1={1} x2={17} y1={4} y2={4} stroke={color} strokeWidth={dashed || dotted ? 2 : 3} strokeDasharray={dotted ? "1 4" : dashed ? "4 3" : undefined} strokeLinecap="round"/>}</Svg>
    <Copy small muted>{label}</Copy>
  </View>;
}
