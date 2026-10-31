import { useState, type ReactNode } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextInputProps } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Defs, LinearGradient, Line, Path, Pattern, Rect, Stop, Text as SvgText } from "react-native-svg";
import { useRouter } from "expo-router";
import { fonts, useThemePreference } from "@/theme";

export function Copy({ children, muted, strong, color, large, strike }: { children: ReactNode; muted?: boolean; strong?: boolean; color?: string; large?: boolean; strike?: boolean }) {
  const { colors: c } = useThemePreference();
  return <Text selectable style={{ color: color ?? (muted ? c.inkMuted : c.ink), fontFamily: strong ? fonts.uiSemi : fonts.ui, fontSize: large ? 18 : 14, lineHeight: large ? 27 : 22, flexShrink: 1, textDecorationLine: strike ? "line-through" : "none" }}>{children}</Text>;
}
export function SvgTitle({ children, small = false }: { children: string; small?: boolean }) {
  const { colors: c } = useThemePreference();
  const words = children.toUpperCase().split(" ");
  const lines = [""];
  for (const w of words) {
    if ((lines[lines.length - 1] + w).length > (small ? 29 : 23)) lines.push(w);
    else lines[lines.length - 1] += `${lines[lines.length - 1] ? " " : ""}${w}`;
  }
  const step = small ? 29 : 43;
  const h = lines.length * step + 16;
  return <View accessible accessibilityRole="header" accessibilityLabel={children} style={{ alignSelf: "stretch" }}>
    <Svg width="100%" height={h} viewBox={`0 0 350 ${h}`} preserveAspectRatio="xMinYMid meet" accessible={false}>
      <Path d={`M0 ${h - 8}L8 9H12L4 ${h - 8}Z`} fill={c.lotus} />
      {lines.map((line, i) => <SvgText key={i} x={22} y={step * (i + 1)} fill={c.ink} fontFamily={fonts.display} fontSize={small ? 26 : 39}>{line}</SvgText>)}
    </Svg>
  </View>;
}
export function Frame({ children, tone, pad = 20, slip = false }: { children: ReactNode; tone?: "danger" | "success" | "accent"; pad?: number; slip?: boolean }) {
  const { colors: c } = useThemePreference();
  const [box, setBox] = useState({ w: 350, h: 180 });
  const a = tone === "danger" ? c.danger : tone === "success" ? c.success : c.lotus;
  const d = `M1 1H${box.w - 20}L${box.w - 1} 20V${box.h - 1}H20L1 ${box.h - 20}Z`;
  return <View onLayout={e => { const { width: w, height: h } = e.nativeEvent.layout; setBox(b => b.w === w && b.h === h ? b : { w, h }); }} style={{ padding: pad, gap: 14, position: "relative" }}>
    <Svg width="100%" height="100%" style={StyleSheet.absoluteFill} viewBox={`0 0 ${box.w} ${box.h}`} accessible={false}>
      <Defs><LinearGradient id="edge" x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor={a} stopOpacity="0.6"/><Stop offset="0.5" stopColor={a} stopOpacity="0"/><Stop offset="1" stopColor={a} stopOpacity="0.4"/></LinearGradient></Defs>
      {tone ? <Path d={d} stroke="url(#edge)" strokeWidth={5} fill="none" opacity={0.3} /> : null}
      <Path d={d} fill={c.surface} stroke={tone ? a : c.controlBorder} strokeWidth={1} />
      <Path d={`M1 35V1H35M${box.w - 35} ${box.h - 1}H${box.w - 1}V${box.h - 35}`} stroke={a} strokeWidth={2.5} fill="none" />
      {slip ? <><Line x1={20} y1={52} x2={box.w - 20} y2={52} stroke={c.line} strokeDasharray="3 5"/><Path d={`M20 ${box.h - 18}H${box.w - 20}`} stroke={c.line}/></> : null}
    </Svg>
    {children}
  </View>;
}
export function Notice({ title, children, danger = false, success = false }: { title: string; children?: ReactNode; danger?: boolean; success?: boolean }) {
  const { colors: c } = useThemePreference();
  return <View accessibilityRole={danger ? "alert" : undefined}>
    <Frame tone={danger ? "danger" : success ? "success" : "accent"} pad={16}>
      <Copy strong color={danger ? c.danger : success ? c.success : c.ink}>{danger ? "!  " : success ? "✓  " : "↗  "}{title}</Copy>
      {children ? <Copy>{children}</Copy> : null}
    </Frame>
  </View>;
}
export function Action({ label, onPress, secondary, danger, disabled, pending, icon }: { label: string; onPress: () => void; secondary?: boolean; danger?: boolean; disabled?: boolean; pending?: boolean; icon?: "minus" | "plus" }) {
  const { colors: c } = useThemePreference();
  const fill = disabled || pending ? c.disabledFill : secondary ? c.surface : danger ? c.danger : c.cta;
  const ink = disabled || pending ? c.disabledInk : secondary ? c.ink : c.onCta;
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: !!disabled || !!pending, busy: !!pending }} disabled={disabled || pending} onPress={onPress} style={({ pressed }) => ({ minHeight: 54, justifyContent: "center", alignItems: "center", opacity: pressed ? 0.7 : 1 })}>
    <Svg width="100%" height="100%" viewBox="0 0 350 54" preserveAspectRatio="none" style={StyleSheet.absoluteFill} accessible={false}><Path d="M1 1H336L349 14V53H14L1 40Z" fill={fill} stroke={secondary ? c.controlBorder : fill}/></Svg>
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingVertical: 12 }}>{pending ? <ActivityIndicator size="small" color={ink}/> : null}{icon ? <Svg width={24} height={24} viewBox="0 0 24 24" accessible={false}><Line x1={5} y1={12} x2={19} y2={12} stroke={ink} strokeWidth={2.5} strokeLinecap="round"/>{icon === "plus" ? <Line x1={12} y1={5} x2={12} y2={19} stroke={ink} strokeWidth={2.5} strokeLinecap="round"/> : null}</Svg> : <Text style={{ fontFamily: fonts.uiSemi, fontSize: 15, lineHeight: 22, color: ink, textAlign: "center", flexShrink: 1 }}>{label}</Text>}</View>
  </Pressable>;
}
export function Choices<T extends string | number | null | undefined>({ label, options, value, onChange, disabled }: { label?: string; options: readonly { value: T; label: string }[]; value: T; onChange: (v: T) => void; disabled?: boolean }) {
  const { colors: c } = useThemePreference();
  return <View style={{ gap: 6 }}>
    {label ? <Copy strong>{label}</Copy> : null}
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      {options.map((o, i) => <Pressable key={i} disabled={disabled} accessibilityRole="radio" accessibilityState={{ selected: value === o.value, disabled }} onPress={() => onChange(o.value)} style={{ flexGrow: 1, flexBasis: 85, minHeight: 50, justifyContent: "center", padding: 10 }}>
        <Svg width="100%" height="100%" style={StyleSheet.absoluteFill} accessible={false}><Line x1="2%" y1="97%" x2="98%" y2="97%" stroke={value === o.value ? c.lotus : c.line} strokeWidth={value === o.value ? 3 : 1}/></Svg>
        <Text style={{ fontFamily: value === o.value ? fonts.uiSemi : fonts.ui, color: value === o.value ? c.lotus : c.inkMuted, textAlign: "center", fontSize: 14, lineHeight: 21 }}>{o.label}</Text>
      </Pressable>)}
    </View>
  </View>;
}
export function Field({ label, large, helper, error, ...props }: TextInputProps & { label: string; large?: boolean; helper?: string; error?: string }) {
  const { colors: c } = useThemePreference();
  const [focused, setFocused] = useState(false);
  return <View style={{ gap: 7 }}>
    <Copy strong>{label}</Copy>
    <Frame pad={large ? 18 : 13} tone={error ? "danger" : focused ? "accent" : undefined}>
      <TextInput {...props} accessibilityLabel={label} placeholderTextColor={c.inkSubtle} selectionColor={c.ring} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} style={{ color: c.ink, fontFamily: large ? fonts.display : fonts.ui, fontSize: large ? 64 : 16, lineHeight: large ? 85 : 24, minHeight: props.multiline ? 75 : large ? 85 : 28, padding: 0, textAlignVertical: "top", ...(Platform.OS === "web" ? { outlineStyle: "none" } as object : {}) }} />
    </Frame>
    {error ? <Copy color={c.danger}>{error}</Copy> : helper ? <Copy muted>{helper}</Copy> : null}
  </View>;
}
export function WeightSlip({ value, onChange, limit, label = "Cân nặng chính thức", disabled }: { value: string; onChange: (v: string) => void; limit: string; label?: string; disabled?: boolean }) {
  const { colors: c } = useThemePreference();
  return <Frame slip pad={20}>
    <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 14 }}><Copy muted>{label}</Copy><Copy strong>{limit} kg</Copy></View>
    <View style={{ flexDirection: "row", alignItems: "baseline", gap: 10, paddingVertical: 12 }}>
      <TextInput accessibilityLabel={label} editable={!disabled} value={value} onChangeText={onChange} inputMode="decimal" keyboardType="decimal-pad" maxLength={5} placeholder="00,0" placeholderTextColor={c.inkSubtle} selectionColor={c.ring} style={{ flex: 1, minWidth: 0, color: c.ink, fontFamily: fonts.display, fontSize: 78, lineHeight: 98, textAlign: "center", padding: 0, ...(Platform.OS === "web" ? { outlineStyle: "none" } as object : {}) }}/>
      <Copy muted>kg</Copy>
    </View>
    <Copy muted>Giới hạn cân ở góc phải · 30–200 kg · 1 số thập phân</Copy>
  </Frame>;
}
export function Fact({ label, value }: { label: string; value: string }) {
  const { colors: c } = useThemePreference();
  return <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 18, paddingVertical: 10, borderBottomColor: c.line, borderBottomWidth: StyleSheet.hairlineWidth }}><Copy muted>{label}</Copy><View style={{ maxWidth: "62%" }}><Copy strong>{value}</Copy></View></View>;
}
export function Busy() { const { colors } = useThemePreference(); return <View style={{ paddingVertical: 48, gap: 16 }}><ActivityIndicator color={colors.lotus}/><Copy muted>Đang tải dữ liệu…</Copy></View>; }
export function CampShell({ title, subtitle, children, onBack, preview }: { title: string; subtitle?: string; children: ReactNode; onBack?: () => void; preview?: boolean }) {
  const { colors: c } = useThemePreference(); const insets = useSafeAreaInsets(); const router = useRouter();
  return <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
    <View style={{ flex: 1, width: "100%", maxWidth: 480, alignSelf: "center" }}>
      <View style={{ paddingHorizontal: 18, minHeight: 54, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomColor: c.line, borderBottomWidth: 1 }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Quay lại" onPress={onBack ?? (() => router.back())} style={{ minWidth: 48, minHeight: 48, justifyContent: "center" }}><Text style={{ color: c.ink, fontSize: 27 }}>‹</Text></Pressable>
        <Copy strong>Fight Camp</Copy><Copy muted>{preview ? "Dữ liệu mẫu" : ""}</Copy>
      </View>
      <ScrollView keyboardShouldPersistTaps="handled" contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ paddingHorizontal: 22, paddingTop: 20, paddingBottom: Math.max(insets.bottom, 24) + 24, gap: 22 }}>
        <View style={{ gap: 6 }}><SvgTitle>{title}</SvgTitle>{subtitle ? <Copy muted>{subtitle}</Copy> : null}</View>
        {children}
      </ScrollView>
    </View>
  </KeyboardAvoidingView>;
}
export function WeightPlot({ points, reference, limit }: { points: { date: string; kg: number }[]; reference: { date: string; kg: number }[]; limit: number | null }) {
  const { colors: c } = useThemePreference();
  const dates = [...new Set([...points, ...reference].map(p => p.date))].sort();
  const values = [...points, ...reference].map(p => p.kg); if (limit != null) values.push(limit);
  if (!points.length) return <Copy muted>Chưa có số cân. Ghi cân hôm nay để bắt đầu theo dõi.</Copy>;
  const lo = Math.min(...values) - 0.5, hi = Math.max(...values) + 0.5;
  const x = (d: string) => 35 + (dates.length < 2 ? 0.5 : dates.indexOf(d) / (dates.length - 1)) * 270;
  const y = (n: number) => 140 - (n - lo) / (hi - lo) * 110;
  const line = (ps: typeof points) => ps.map((p, i) => `${i ? "L" : "M"}${x(p.date)} ${y(p.kg)}`).join(" ");
  return <View accessible accessibilityLabel={`Biểu đồ cân: ${points.length} lần ghi. Mới nhất ${points.at(-1)?.kg} kg. Giới hạn ${limit ?? "chưa đặt"} kg.`}>
    <Svg width="100%" height={180} viewBox="0 0 340 180" accessible={false}>
      {[lo, (lo + hi) / 2, hi].map(n => <SvgText key={n} x={0} y={y(n) + 4} fill={c.inkMuted} fontSize={10}>{n.toFixed(1)}</SvgText>)}
      {limit != null ? <Line x1={35} x2={310} y1={y(limit)} y2={y(limit)} stroke={c.danger} strokeDasharray="4 5"/> : null}
      <Path d={line(reference)} stroke={c.controlBorder} strokeDasharray="3 5" fill="none"/>
      {points.map((p, i) => <Circle key={`${p.date}-${i}`} cx={x(p.date)} cy={y(p.kg)} r={4} fill={c.lotus}/>)}
      <SvgText x={35} y={170} fill={c.inkMuted} fontSize={10}>{dates[0]?.slice(5).split("-").reverse().join("/")}</SvgText>
      <SvgText x={275} y={170} fill={c.inkMuted} fontSize={10}>{dates.at(-1)?.slice(5).split("-").reverse().join("/")}</SvgText>
    </Svg>
    <Copy muted>Chấm: số cân đã ghi · Nét đứt: lộ trình / giới hạn</Copy>
  </View>;
}
