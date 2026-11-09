import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions, type TextInputProps } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Line, Path, Text as SvgText } from "react-native-svg";
import { useRouter } from "expo-router";
import { fonts, useThemePreference, useTypography } from "@/theme";
import { readableTextStyle } from "@/theme/typography";
import { ArenaFrame, ArenaSurface } from "@/components/arena/arena-frame";
import { CampScrollContext } from "./camp-scroll-context";
import { PressableScale } from "@/components/motion";
import { CampReveal, CampSelection } from "./camp-motion";
import { pendingVi } from "@/i18n/pending-vi";
import { READABLE_MAX_WIDTH } from "@/components/readable-width";
import { navSideWidth, useNavKind } from "@/components/nav-rail";
import { CAMP_TWO_COLUMN_MAX, CampTwoColumnsProvider, campTwoColumns } from "./camp-columns";
import { campText } from "@/i18n/fight-camp";

export function Copy({ children, muted, strong, color, large, small, strike }: { children: ReactNode; muted?: boolean; strong?: boolean; color?: string; large?: boolean; small?: boolean; strike?: boolean }) {
  const { colors: c } = useThemePreference();
  return <Text selectable style={{ ...readableTextStyle(large ? 18 : small ? 13 : 14, strong), color: color ?? (muted ? c.inkMuted : c.ink), flexShrink: 1, textDecorationLine: strike ? "line-through" : "none" }}>{children}</Text>;
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
export function Frame({ children, tone, pad = 20 }: { children: ReactNode; tone?: "danger" | "success" | "accent"; pad?: number; slip?: boolean }) {
  return <ArenaFrame tone={tone} pad={pad}>{children}</ArenaFrame>;
}
export function Notice({ title, children, danger = false, success = false }: { title: string; children?: ReactNode; danger?: boolean; success?: boolean }) {
  const { colors: c } = useThemePreference();
  const content = <View accessibilityRole={danger ? "alert" : undefined} accessibilityLiveRegion={success ? "polite" : undefined}>
    <Frame tone={danger ? "danger" : success ? "success" : "accent"} pad={16}>
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
        <View style={{ paddingTop: 1 }}><CampIcon name={danger ? "alert" : success ? "check" : "arrow"} color={danger ? c.danger : success ? c.success : c.lotus}/></View>
        <Copy strong color={danger ? c.danger : success ? c.success : c.ink}>{title}</Copy>
      </View>
      {children ? <Copy>{children}</Copy> : null}
    </Frame>
  </View>;
  return success && !danger ? <CampReveal>{content}</CampReveal> : content;
}
export function Action({ label, onPress, secondary, danger, disabled, pending, icon }: { label: string; onPress: () => void; secondary?: boolean; danger?: boolean; disabled?: boolean; pending?: boolean; icon?: "minus" | "plus" }) {
  const { colors: c } = useThemePreference();
  const fill = disabled || pending ? c.disabledFill : secondary ? c.surface : danger ? c.danger : c.cta;
  const ink = disabled || pending ? c.disabledInk : secondary ? c.ink : c.onCta;
  return <PressableScale accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: !!disabled || !!pending, busy: !!pending }} disabled={disabled || pending} onPress={onPress} style={{ minHeight: 54, justifyContent: "center", alignItems: "center" }}>
    <Svg width="100%" height="100%" viewBox="0 0 350 54" preserveAspectRatio="none" style={StyleSheet.absoluteFill} aria-hidden={true}><Path d="M1 1H336L349 14V53H14L1 40Z" fill={fill} stroke={secondary ? c.controlBorder : fill}/></Svg>
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingVertical: 12 }}>{pending ? <ActivityIndicator size="small" color={ink}/> : null}{icon ? <CampIcon name={icon} color={ink} size={24}/> : <Text style={{ ...readableTextStyle(15, true), color: ink, textAlign: "center", flexShrink: 1 }}>{label}</Text>}</View>
  </PressableScale>;
}
export function Choices<T extends string | number | null | undefined>({ label, options, value, onChange, disabled }: { label?: string; options: readonly { value: T; label: string }[]; value: T; onChange: (v: T) => void; disabled?: boolean }) {
  const { colors: c } = useThemePreference();
  const live = useTypography();
  const labelStyle = { ...readableTextStyle(14), fontFamily: live.faces.medium };
  return <View style={{ gap: 6 }}>
    {label ? <Copy strong>{label}</Copy> : null}
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      {options.map((o, i) => <Pressable key={i} disabled={disabled} accessibilityRole="radio" aria-checked={value === o.value} aria-disabled={!!disabled} accessibilityState={{ checked: value === o.value, disabled }} onPress={() => onChange(o.value)} style={{ flexGrow: options.length === 3 ? Math.max(6, o.label.length) : 1, flexBasis: options.length === 3 ? 0 : 85, minWidth: 0, minHeight: 50, justifyContent: "center", paddingVertical: 10, paddingHorizontal: 4 }}>
        <Svg pointerEvents="none" width="100%" height="100%" style={StyleSheet.absoluteFill} aria-hidden={true}><Line x1="2%" y1="97%" x2="98%" y2="97%" stroke={c.line} strokeWidth={1}/></Svg>
        <CampSelection selected={value === o.value}><Svg pointerEvents="none" width="100%" height="100%" aria-hidden={true}><Line x1="2%" y1="97%" x2="98%" y2="97%" stroke={c.lotus} strokeWidth={3}/></Svg></CampSelection>
        <Text style={{ ...labelStyle, color: value === o.value ? c.lotus : c.inkMuted, textAlign: "center" }}>{o.label}</Text>
      </Pressable>)}
    </View>
  </View>;
}
/** Round switcher at the top of round entry (Designer mock 20/22): one tab per scheduled round; saved rounds carry a check. */
export function RoundTabs({ label, total, value, saved, onChange, disabled, tabLabel, savedLabel }: { label: string; total: number; value: number; saved: readonly number[]; onChange: (n: number) => void; disabled?: boolean; tabLabel: (n: number) => string; savedLabel: (n: number) => string }) {
  const { colors: c } = useThemePreference();
  const live = useTypography();
  const rounds = Array.from({ length: total }, (_, i) => i + 1);
  const rows = Array.from({ length: Math.ceil(total / 5) }, (_, r) => rounds.slice(r * 5, r * 5 + 5));
  return <View accessibilityRole="radiogroup" accessibilityLabel={label} style={{ gap: 8 }} testID="round-tabs">
    {rows.map((row, r) => <View key={r} style={{ flexDirection: "row", gap: 8 }}>
      {row.map(n => { const selected = n === value; const done = saved.includes(n);
        return <PressableScale key={n} scaleTo={0.98} accessibilityRole="radio" accessibilityLabel={done ? savedLabel(n) : tabLabel(n)} aria-checked={selected} aria-disabled={!!disabled} accessibilityState={{ checked: selected, disabled: !!disabled }} disabled={disabled} onPress={() => onChange(n)}
          style={{ flex: 1, minHeight: 48, paddingHorizontal: 6, justifyContent: "center", opacity: disabled ? 0.55 : 1 }}>
          <ArenaSurface tone="neutral"/>
          <CampSelection selected={selected}><ArenaSurface active tone="neutral"/></CampSelection>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4 }}>
            {done ? <CampIcon name="check" color={selected ? c.lotus : c.success} size={16}/> : null}
            <Text numberOfLines={1} style={{ ...readableTextStyle(14), fontFamily: live.faces.medium, color: selected ? c.lotus : c.ink }}>{tabLabel(n)}</Text>
          </View>
        </PressableScale>; })}
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
  return <View style={{ gap: 7 }}>
    <Copy strong>{label}</Copy>
    <Pressable accessible={false} focusable={false} disabled={props.editable === false} onPress={() => input.current?.focus()}>
      <Frame pad={large ? 18 : 13} tone={error ? "danger" : focused ? "accent" : undefined}>
        <TextInput {...props} ref={input} accessibilityLabel={label} placeholderTextColor={c.inkSubtle} selectionColor={c.ring} onFocus={e => { setFocused(true); props.onFocus?.(e); }} onBlur={e => { setFocused(false); props.onBlur?.(e); }} style={{ ...readableTextStyle(large ? 64 : 16), position: "relative", zIndex: 1, color: c.ink, minHeight: props.multiline ? 75 : large ? 85 : 44, padding: 0, textAlignVertical: "top", ...(Platform.OS === "web" ? { outlineStyle: "none", borderWidth: 0, resize: "none" } as object : {}) }} />
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
      <TextInput ref={input} accessibilityLabel={label} editable={!disabled} value={value} onChangeText={onChange} inputMode="decimal" keyboardType="decimal-pad" maxLength={5} placeholder="00,0" placeholderTextColor={c.inkSubtle} selectionColor={c.ring} style={{ flex: 1, minWidth: 0, position: "relative", zIndex: 1, color: c.ink, fontFamily: fonts.display, fontSize: 78, lineHeight: 98, textAlign: "center", padding: 0, ...(Platform.OS === "web" ? { outlineStyle: "none", borderWidth: 0 } as object : {}) }}/>
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
export function CampFooter({ children }: { children: ReactNode }) {
  const set = useContext(CampFooterSlot);
  useEffect(() => { set?.(children); }, [set, children]);
  useEffect(() => () => set?.(null), [set]);
  return set ? null : <View style={{ gap: 10 }}>{children}</View>;
}
/** Below this window height (phone landscape, split screen) CampShell uses a compact header and footer. */
export const CAMP_SHORT_HEIGHT = 500;
export function CampShell({ title, subtitle, children, onBack, preview, compactTitle = false, footer: ownFooter, columns = false }: { title: string; subtitle?: string; children: ReactNode; onBack?: () => void; preview?: boolean; compactTitle?: boolean; footer?: ReactNode; /** Phase 5 E: allow two columns when the shell gets at least CAMP_TWO_COLUMN_MIN (744) wide. */ columns?: boolean }) {
  const { colors: c } = useThemePreference(); const insets = useSafeAreaInsets(); const router = useRouter();
  const [slot, setSlot] = useState<ReactNode>(null); const footer = ownFooter ?? slot;
  const scroll = useRef<ScrollView>(null);
  // Phase 5 D: tablets may rotate (Android 16 large screens, iPad multitasking); short windows get a compact header and footer.
  const window = useWindowDimensions(); const short = window.height < CAMP_SHORT_HEIGHT;
  // Content width after the side navigation: measured, with the window minus the rail (88) or iPad sidebar (240) until the first layout.
  const nav = useNavKind(); const [measured, setMeasured] = useState(0);
  const wide = campTwoColumns(columns, measured || window.width - navSideWidth(nav));
  const scrollTop = useCallback(() => { scroll.current?.scrollTo({ y: 0, animated: false }); }, []);
  useEffect(scrollTop, [title, scrollTop]);
  return <KeyboardAvoidingView testID="camp-shell" onLayout={e => setMeasured(Math.round(e.nativeEvent.layout.width))} style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
    <View testID="camp-column" style={{ flex: 1, width: "100%", maxWidth: wide ? CAMP_TWO_COLUMN_MAX : READABLE_MAX_WIDTH, alignSelf: "center" }}>
      <View testID="camp-header" style={{ paddingHorizontal: 18, minHeight: short ? 44 : 54, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomColor: c.line, borderBottomWidth: 1 }}>
        <Pressable accessibilityRole="button" accessibilityLabel={campText.campUi.quayLai} onPress={onBack ?? (() => router.back())} style={{ minWidth: 48, minHeight: 48, justifyContent: "center" }}><CampIcon name="back" color={c.ink} size={26}/></Pressable>
        <Copy strong>{pendingVi.fightCamp}</Copy><Copy muted>{preview ? campText.campUi.duLieuMau : ""}</Copy>
      </View>
      <ScrollView ref={scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ paddingHorizontal: 22, paddingTop: short ? 10 : 20, paddingBottom: footer ? (short ? 12 : 24) : Math.max(insets.bottom, 24) + 24, gap: short ? 14 : 22 }}>
        <View style={{ gap: 6 }}>{!compactTitle ? <SvgTitle small={short}>{title}</SvgTitle> : null}{subtitle ? <Copy muted>{subtitle}</Copy> : null}</View>
        <CampScrollContext.Provider value={scrollTop}><CampFooterSlot.Provider value={setSlot}><CampTwoColumnsProvider value={wide}><CampReveal key={title} style={{ gap: 22 }}>{children}</CampReveal></CampTwoColumnsProvider></CampFooterSlot.Provider></CampScrollContext.Provider>
      </ScrollView>
      {footer ? <View testID="camp-footer-bar" style={{ paddingHorizontal: 22, paddingTop: short ? 6 : 12, paddingBottom: Math.max(insets.bottom, short ? 6 : 12) + (short ? 2 : 8), gap: short ? 6 : 10, borderTopColor: c.line, borderTopWidth: 1, backgroundColor: c.bg }}>{footer}</View> : null}
    </View>
  </KeyboardAvoidingView>;
}
export function WeightPlot({ points, reference, limit }: { points: { date: string; kg: number }[]; reference: { date: string; kg: number }[]; limit: number | null }) {
  const { colors: c } = useThemePreference();
  const fs = Math.max(11, Math.round(11 * useSvgTextScale())); const padL = Math.ceil(fs * 2.6) + 6; const h = 150 + fs * 3;
  const dates = [...new Set([...points, ...reference].map(p => p.date))].sort();
  const values = [...points, ...reference].map(p => p.kg); if (limit != null) values.push(limit);
  if (!points.length) return <Copy muted>{campText.campUi.chuaCoSoCanGhi}</Copy>;
  const lo = Math.min(...values) - 0.5, hi = Math.max(...values) + 0.5;
  const x = (d: string) => padL + (dates.length < 2 ? 0.5 : dates.indexOf(d) / (dates.length - 1)) * (330 - padL - fs * 2);
  const y = (n: number) => h - fs * 2.6 - (n - lo) / (hi - lo) * (h - fs * 4.2);
  const line = (ps: typeof points) => ps.map((p, i) => `${i ? "L" : "M"}${x(p.date)} ${y(p.kg)}`).join(" ");
  return <View accessible accessibilityLabel={campText.campUi.bieuDoCanLanGhi(points.length, points.at(-1)?.kg, limit ?? campText.campUi.chuaDat)}>
    <Svg width="100%" height={h} viewBox={`0 0 340 ${h}`} aria-hidden={true}>
      {[lo, (lo + hi) / 2, hi].map(n => <SvgText key={n} x={0} y={y(n) + fs * 0.35} fill={c.inkMuted} fontSize={fs}>{n.toFixed(1)}</SvgText>)}
      {limit != null ? <Line x1={padL} x2={330 - fs} y1={y(limit)} y2={y(limit)} stroke={c.danger} strokeDasharray="4 5"/> : null}
      <Path d={line(reference)} stroke={c.controlBorder} strokeDasharray="3 5" fill="none"/>
      {points.map((p, i) => <Circle key={`${p.date}-${i}`} cx={x(p.date)} cy={y(p.kg)} r={4} fill={c.lotus}/>)}
      <SvgText x={padL} y={h - 6} fill={c.inkMuted} fontSize={fs}>{dates[0]?.slice(5).split("-").reverse().join("/")}</SvgText>
      <SvgText x={336} y={h - 6} textAnchor="end" fill={c.inkMuted} fontSize={fs}>{dates.at(-1)?.slice(5).split("-").reverse().join("/")}</SvgText>
    </Svg>
    <Copy muted>{campText.campUi.chamSoCanDaGhi}</Copy>
  </View>;
}
