import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";

import { Icon } from "@/components/icon";
import { TEXT } from "@/screens/fighter/bout-states";
import { useFighterPalette } from "@/screens/fighter/redesign/palette";

import { num, pct } from "./overview-data";

/** Khe giữa các đoạn liền kề (màu nền thẻ). */
const GAP = 2;

export type Segment = { key: string; label: string; count: number; color: string };

/** Thanh ngang xếp chồng 100% (cao 16, bo 8). Đoạn 0 không vẽ; chú thích vẫn đủ. */
export function StackedBar({ segments }: { segments: readonly Segment[] }) {
  const p = useFighterPalette();
  const shown = segments.filter((s) => s.count > 0);
  return (
    <View
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      style={[styles.stack, { backgroundColor: p.surface, gap: GAP }]}
    >
      {shown.map((s) => (
        <View key={s.key} style={{ flex: s.count, backgroundColor: s.color }} />
      ))}
    </View>
  );
}

/** Một dòng chú thích: chấm màu · tên · số · %. Bấm được (≥ 48dp) khi có `onPress`. */
export function LegendRow({
  color,
  label,
  value,
  total,
  onPress,
  hint,
}: {
  color: string;
  label: string;
  value: number;
  total?: number;
  onPress?: () => void;
  hint?: string;
}) {
  const p = useFighterPalette();
  const text = total !== undefined ? `${num(value)} · ${pct(value, total)}%` : num(value);
  const body = (
    <>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[TEXT.body, styles.flex, { color: p.ink }]} numberOfLines={1}>
        {label}
      </Text>
      <Text style={[TEXT.bodyBold, styles.tabular, { color: p.ink }]}>{text}</Text>
      {onPress ? <Icon name="chevron" size={20} color={p.ink} /> : null}
    </>
  );
  const a11y = total !== undefined ? `${label}: ${num(value)}, ${pct(value, total)} phần trăm` : `${label}: ${num(value)}`;
  if (!onPress) {
    return (
      <View accessible accessibilityLabel={a11y} style={styles.legend}>
        {body}
      </View>
    );
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y}
      accessibilityHint={hint}
      onPress={onPress}
      style={({ pressed }) => [styles.legend, styles.legendTap, { backgroundColor: pressed ? p.surface2 : "transparent" }]}
    >
      {body}
    </Pressable>
  );
}

export type Column = { key: string; label: string; today: boolean; total: number; parts: readonly Segment[] };

/** Cột xếp chồng theo ngày (vùng vẽ cao 160). Hôm nay có nền cột nhạt. Không bấm được. */
export function ColumnChart({ columns, height = 160 }: { columns: readonly Column[]; height?: number }) {
  const p = useFighterPalette();
  const max = Math.max(1, ...columns.map((c) => c.total));
  return (
    <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden style={styles.columns}>
      {columns.map((c) => {
        const h = c.total > 0 ? Math.max(8, Math.round((c.total / max) * (height - 24))) : 0;
        const shown = c.parts.filter((s) => s.count > 0);
        return (
          <View key={c.key} style={styles.colWrap}>
            <View style={[styles.colArea, { height, backgroundColor: c.today ? p.surface2 : "transparent" }]}>
              <Text style={[TEXT.captionBold, styles.tabular, { color: p.ink }]}>{c.total > 0 ? num(c.total) : ""}</Text>
              <View style={[styles.col, { height: h, gap: shown.length > 1 ? GAP : 0 }]}>
                {[...shown].reverse().map((s) => (
                  <View key={s.key} style={{ flex: s.count, backgroundColor: s.color, borderRadius: 2 }} />
                ))}
              </View>
            </View>
            <Text style={[TEXT.caption, { color: p.ink, fontWeight: c.today ? "700" : "400" }]}>{c.label}</Text>
          </View>
        );
      })}
    </View>
  );
}

/** Thanh ngang đơn sắc, mỗi dòng: nhãn · thanh · số (≥ 48dp, bấm được). */
export function HBarRow({ label, value, max, color, onPress, hint }: { label: string; value: number; max: number; color: string; onPress?: () => void; hint?: string }) {
  const p = useFighterPalette();
  return (
    <Pressable
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={`${label}: ${num(value)}`}
      accessibilityHint={hint}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [styles.hrow, { backgroundColor: pressed ? p.surface2 : "transparent" }]}
    >
      <Text style={[TEXT.detail, styles.hlabel, { color: p.ink }]} numberOfLines={1}>
        {label}
      </Text>
      <View style={styles.htrack}>
        <View style={{ width: `${Math.max(4, (value / Math.max(1, max)) * 100)}%`, height: 16, borderRadius: 8, backgroundColor: color }} />
      </View>
      <Text style={[TEXT.bodyBold, styles.hvalue, { color: p.ink }]}>{num(value)}</Text>
      {onPress ? <Icon name="chevron" size={20} color={p.ink} /> : null}
    </Pressable>
  );
}

/** Vòng donut (đường kính 120, dày 20), giữa là tổng. Khe 2dp giữa các đoạn. */
export function Donut({ segments, size = 120, stroke = 20, centerLabel }: { segments: readonly Segment[]; size?: number; stroke?: number; centerLabel: string }) {
  const p = useFighterPalette();
  const total = segments.reduce((s, x) => s + x.count, 0);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const shown = segments.filter((s) => s.count > 0);
  const gap = shown.length > 1 ? GAP : 0;
  let acc = 0;
  return (
    <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        {total === 0 ? <Circle cx={size / 2} cy={size / 2} r={r} stroke={p.surface2} strokeWidth={stroke} fill="none" /> : null}
        {shown.map((s) => {
          const len = (s.count / total) * c;
          const dash = Math.max(0.5, len - gap);
          const el = (
            <Circle
              key={s.key}
              cx={size / 2}
              cy={size / 2}
              r={r}
              stroke={s.color}
              strokeWidth={stroke}
              fill="none"
              strokeDasharray={`${dash} ${c - dash}`}
              strokeDashoffset={-acc}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            />
          );
          acc += len;
          return el;
        })}
      </Svg>
      <View style={[StyleSheet.absoluteFill, styles.center]}>
        <Text style={[styles.donutNum, { color: p.ink }]}>{num(total)}</Text>
        <Text style={[TEXT.caption, { color: p.ink }]}>{centerLabel}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  tabular: { fontVariant: ["tabular-nums"] },
  stack: { flexDirection: "row", height: 16, borderRadius: 8, overflow: "hidden" },
  dot: { width: 12, height: 12, borderRadius: 6 },
  legend: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 32 },
  legendTap: { minHeight: 48, marginHorizontal: -8, paddingHorizontal: 8, borderRadius: 8 },
  columns: { flexDirection: "row", gap: 4 },
  colWrap: { flex: 1, minWidth: 24, alignItems: "center", gap: 4 },
  colArea: { alignSelf: "stretch", borderRadius: 8, alignItems: "center", justifyContent: "flex-end", paddingBottom: 0, gap: 4 },
  col: { width: 24, borderTopLeftRadius: 4, borderTopRightRadius: 4, overflow: "hidden" },
  hrow: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 48, marginHorizontal: -8, paddingHorizontal: 8, borderRadius: 8 },
  hlabel: { width: 120 },
  htrack: { flex: 1 },
  hvalue: { minWidth: 28, textAlign: "right", fontVariant: ["tabular-nums"] },
  center: { alignItems: "center", justifyContent: "center" },
  donutNum: { fontSize: 24, lineHeight: 30, fontWeight: "700", fontVariant: ["tabular-nums"] },
});
