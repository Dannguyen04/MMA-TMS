import { Text, View } from "react-native";
import Svg, { Circle, Line, Path, Text as SvgText } from "react-native-svg";

import { fighterTran as t } from "@/i18n/fighter-tran";
import { dayMonth, kg } from "@/screens/fight-camp/camp-rules";
import { useThemePreference } from "@/theme";
import { readableTextStyle } from "@/theme/typography";

type Pt = { date: string; kg: number };
const W = 360, H = 150, L = 36, R = 8, T = 8, B = 22;

/** Fighter's weights (solid, last point lit), the coach's path (dashed), the limit (red). The legend names all three. */
export function WeightChart({ points, path, limit, over }: { points: Pt[]; path: Pt[]; limit: number | null; over: boolean }) {
  const { colors: c } = useThemePreference();
  if (!points.length) return null;
  const dates = [...new Set([...points, ...path].map(p => p.date))].sort();
  const values = [...points, ...path].map(p => p.kg).concat(limit != null ? [limit] : []);
  const lo = Math.min(...values) - 0.4, hi = Math.max(...values) + 0.4;
  const x = (d: string) => L + (dates.length < 2 ? 0.5 : dates.indexOf(d) / (dates.length - 1)) * (W - L - R);
  const y = (v: number) => T + (hi - v) / (hi - lo) * (H - T - B);
  const line = (ps: Pt[]) => ps.map((p, i) => `${i ? "L" : "M"}${x(p.date).toFixed(1)} ${y(p.kg).toFixed(1)}`).join("");
  const grid = [hi - 0.4, (lo + hi) / 2, lo + 0.4];
  const last = points[points.length - 1];
  const ticks = dates.length > 2 ? [dates[0], dates[Math.floor((dates.length - 1) / 2)], dates[dates.length - 1]] : dates;
  const key = (color: string, label: string, dashed?: boolean) => <View key={label} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
    <View style={{ width: 16, borderTopWidth: 2.5, borderColor: color, borderStyle: dashed ? "dashed" : "solid" }}/>
    <Text style={{ ...readableTextStyle(12.5), color: c.ink }}>{label}</Text>
  </View>;
  return <View testID="weight-chart" accessible accessibilityRole="image" accessibilityLabel={t.chart.a11y(points.length, kg(last.kg), limit != null ? kg(limit) : null)} style={{ gap: 4 }}>
    <Svg width="100%" height={undefined} viewBox={`0 0 ${W} ${H}`} style={{ aspectRatio: W / H }} aria-hidden={true}>
      {grid.map(v => <Line key={`g${v}`} x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke={c.line}/>)}
      {grid.map(v => <SvgText key={`t${v}`} x={0} y={y(v) + 4} fontSize={11} fill={c.inkMuted}>{kg(v)}</SvgText>)}
      {limit != null ? <Line x1={L} x2={W - R} y1={y(limit)} y2={y(limit)} stroke={c.danger} strokeWidth={1.5}/> : null}
      {path.length > 1 ? <Path d={line(path)} fill="none" stroke={c.inkMuted} strokeWidth={2} strokeDasharray="5 5"/> : null}
      {points.length > 1 ? <Path d={line(points)} fill="none" stroke={c.ink} strokeWidth={2.5} strokeLinejoin="round"/> : null}
      {points.map((p, i) => <Circle key={`${p.date}-${i}`} cx={x(p.date)} cy={y(p.kg)} r={p === last ? 5 : 3} fill={p === last ? over ? c.danger : c.lotus : c.ink}/>)}
      {ticks.map((d, i) => <SvgText key={`d${d}`} x={i === ticks.length - 1 ? W - R : x(d)} y={H - 4} fontSize={11} fill={c.inkMuted}
        textAnchor={i === ticks.length - 1 ? "end" : i === 0 ? "start" : "middle"}>{dayMonth(d)}</SvgText>)}
    </Svg>
    <View aria-hidden={true} importantForAccessibility="no-hide-descendants" style={{ flexDirection: "row", gap: 16, flexWrap: "wrap" }}>
      {key(c.ink, t.chart.points)}
      {path.length > 1 ? key(c.inkMuted, t.chart.path, true) : null}
      {limit != null ? key(c.danger, t.chart.limit) : null}
    </View>
  </View>;
}
