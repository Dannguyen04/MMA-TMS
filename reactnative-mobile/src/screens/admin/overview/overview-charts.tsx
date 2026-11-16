import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";

import { Icon } from "@/components/icon";
import { useThemePreference } from "@/theme";
import { fonts, readableTextStyle, fz, lh } from "@/theme/typography";

import { num, pct } from "./overview-data";

/** Gap between touching segments (page colour). */
const GAP = 2;

export type Segment = { key: string; label: string; count: number; color: string };

/** 100% stacked bar, square, 14 high (redesign step 22). Zero segments are not drawn; the legend lists them all. */
export function StackedBar({ segments }: { segments: readonly Segment[] }) {
  const shown = segments.filter((s) => s.count > 0);
  return <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden style={{ flexDirection: "row", height: 14, gap: GAP }}>
    {shown.map((s) => <View key={s.key} style={{ flex: s.count, backgroundColor: s.color }}/>)}
  </View>;
}

/** One ruled legend row: square swatch · label · number (and % small) · chevron when it opens a list. */
export function LegendRow({ color, label, value, total, onPress, hint, last }: {
  color: string; label: string; value: number; total?: number; onPress?: () => void; hint?: string; last?: boolean;
}) {
  const { colors: c } = useThemePreference();
  const a11y = total !== undefined ? `${label}: ${num(value)}, ${pct(value, total)} phần trăm` : `${label}: ${num(value)}`;
  const style = { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 48, borderTopWidth: 1, borderTopColor: c.line, ...(last ? { borderBottomWidth: 1, borderBottomColor: c.line } : null) } as const;
  const body = <>
    <View style={{ width: 14, height: 14, backgroundColor: color }}/>
    <Text numberOfLines={1} style={{ ...readableTextStyle(15), flex: 1, minWidth: 0, color: c.ink }}>{label}</Text>
    <Text style={{ fontFamily: fonts.displayExtraBold, fontSize: fz(18), lineHeight: lh(22), color: c.ink }}>
      {num(value)}{total !== undefined ? <Text style={{ ...readableTextStyle(13, true), color: c.ink }}>{`  ${pct(value, total)}%`}</Text> : null}
    </Text>
    {onPress ? <Icon name="chevron" size={20} color={c.ink}/> : null}
  </>;
  if (!onPress) return <View accessible accessibilityLabel={a11y} style={style}>{body}</View>;
  return <Pressable accessibilityRole="button" accessibilityLabel={a11y} accessibilityHint={hint} onPress={onPress}
    style={({ pressed }) => [style, { backgroundColor: pressed ? c.surfaceMuted : "transparent" }]}>{body}</Pressable>;
}

export type Column = { key: string; label: string; today: boolean; total: number; parts: readonly Segment[] };

/** Stacked column per day, square; today's day label in red. Not tappable. */
export function ColumnChart({ columns, height = 140 }: { columns: readonly Column[]; height?: number }) {
  const { colors: c } = useThemePreference();
  const max = Math.max(1, ...columns.map((x) => x.total));
  return <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden style={{ gap: 6 }}>
    <View style={{ flexDirection: "row", gap: 8, height, alignItems: "flex-end" }}>
      {columns.map((col) => {
        const h = col.total > 0 ? Math.max(6, Math.round((col.total / max) * height)) : 0;
        const shown = col.parts.filter((s) => s.count > 0);
        return <View key={col.key} style={{ flex: 1, height: h, gap: shown.length > 1 ? GAP : 0, flexDirection: "column-reverse" }}>
          {shown.map((s) => <View key={s.key} style={{ flex: s.count, backgroundColor: s.color }}/>)}
        </View>;
      })}
    </View>
    <View style={{ flexDirection: "row", gap: 8 }}>
      {columns.map((col) => <Text key={col.key} style={{ ...readableTextStyle(12.5, true), flex: 1, textAlign: "center", color: col.today ? c.lotus : c.ink }}>{col.label}</Text>)}
    </View>
  </View>;
}

/** Ruled bar row: label · square track · number · chevron. */
export function HBarRow({ label, value, max, color, onPress, hint, last }: { label: string; value: number; max: number; color: string; onPress?: () => void; hint?: string; last?: boolean }) {
  const { colors: c } = useThemePreference();
  return <Pressable accessibilityRole={onPress ? "button" : undefined} accessibilityLabel={`${label}: ${num(value)}`} accessibilityHint={hint} disabled={!onPress} onPress={onPress}
    style={({ pressed }) => [styles.hrow, { borderTopColor: c.line, backgroundColor: pressed ? c.surfaceMuted : "transparent" }, last ? { borderBottomWidth: 1, borderBottomColor: c.line } : null]}>
    <Text numberOfLines={1} style={{ ...readableTextStyle(14.5), width: 118, color: c.ink }}>{label}</Text>
    <View style={{ flex: 1, height: 10, backgroundColor: c.surfaceMuted }}>
      <View style={{ width: `${Math.max(4, (value / Math.max(1, max)) * 100)}%`, height: 10, backgroundColor: color }}/>
    </View>
    <Text style={{ fontFamily: fonts.displayExtraBold, fontSize: fz(17), lineHeight: lh(20), minWidth: 28, textAlign: "right", color: c.ink }}>{num(value)}</Text>
    {onPress ? <Icon name="chevron" size={20} color={c.ink}/> : null}
  </Pressable>;
}

/** Ring (112 wide, 12 thick), total in the middle. */
export function Donut({ segments, size = 112, stroke = 12 }: { segments: readonly Segment[]; size?: number; stroke?: number; centerLabel?: string }) {
  const { colors: c } = useThemePreference();
  const total = segments.reduce((s, x) => s + x.count, 0);
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const shown = segments.filter((s) => s.count > 0);
  const gap = shown.length > 1 ? GAP : 0;
  let acc = 0;
  return <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden style={{ width: size, height: size }}>
    <Svg width={size} height={size}>
      {total === 0 ? <Circle cx={size / 2} cy={size / 2} r={r} stroke={c.surfaceMuted} strokeWidth={stroke} fill="none"/> : null}
      {shown.map((s) => {
        const len = (s.count / total) * circ;
        const dash = Math.max(0.5, len - gap);
        const el = <Circle key={s.key} cx={size / 2} cy={size / 2} r={r} stroke={s.color} strokeWidth={stroke} fill="none"
          strokeDasharray={`${dash} ${circ - dash}`} strokeDashoffset={-acc} transform={`rotate(-90 ${size / 2} ${size / 2})`}/>;
        acc += len;
        return el;
      })}
    </Svg>
    <View style={[StyleSheet.absoluteFill, { alignItems: "center", justifyContent: "center" }]}>
      <Text style={{ fontFamily: fonts.displayExtraBold, fontSize: fz(26), lineHeight: lh(30), color: c.ink }}>{num(total)}</Text>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  hrow: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 44, borderTopWidth: 1 },
});
