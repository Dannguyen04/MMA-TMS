import { useRef, useState, type ReactNode } from "react";
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from "react-native";
import Svg, { Path } from "react-native-svg";
import { fonts, useThemePreference, useTypography } from "@/theme/index";
import { readableTextStyle, fz, lh } from "@/theme/typography";
import { ArenaSurface } from "@/components/arena/arena-frame";
import { PressableScale } from "@/components/motion/motion";
import { FocusEditor } from "@/components/forms/focus-editor";
import { CampSelection } from "@/shared/ui/camp-motion";
import { campText } from "@/features/fight-camp/i18n/fight-camp";
import * as Haptics from "expo-haptics";
import { LitFill, Sheen, type LitKind } from "@/shared/ui/camp-lit";
import { Copy, SectionTitle } from "./text";
import { CampIcon } from "./icon";
import { Frame } from "./cards";

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