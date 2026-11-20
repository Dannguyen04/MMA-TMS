import { Fragment, useState } from "react";
import { View } from "react-native";
import Svg, { Circle, Line, Path, Text as SvgText } from "react-native-svg";
import { useThemePreference } from "@/theme/index";
import { campText } from "@/features/fight-camp/i18n/fight-camp";
import { Copy, useSvgTextScale } from "./text";

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