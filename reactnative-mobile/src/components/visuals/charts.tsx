import Ionicons from "@expo/vector-icons/Ionicons";
import { useState } from "react";
import { StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";
import Svg, { Circle, Line, Polyline, Rect, Text as SvgText } from "react-native-svg";

import type { TrainingPlanStatus } from "@/api";
import { fonts, radius, spacing, type, useTypography, viLineHeight, type ColorTokens } from "@/theme";

import { vnShortDate } from "@/utils/vn-date";

import { StatusChip } from "./primitives";
import {
  JOINT_STATE_RANK,
  JOINT_STATE_TONE,
  PLAN_STATUS_ICON,
  PLAN_STATUS_TONE,
  SEVERITY_TONE,
  toneColors,
} from "./tone";

export type WeightPoint = { id: string; weightKg: number; measuredAt: string; caption?: string };

/** Mốc của đường giảm cân dự kiến (đường tham chiếu). */
export type WeightReferencePoint = { measuredAt: string; weightKg: number };

const CHART_H = 176;
const PAD = { left: 34, right: 18, top: 22, bottom: 38 };

function shortDate(iso: string): string {
  return vnShortDate(iso);
}

function pickLabelIndexes(count: number): Set<number> {
  if (count <= 6) return new Set(Array.from({ length: count }, (_, index) => index));
  return new Set([0, Math.round((count - 1) / 3), Math.round(((count - 1) * 2) / 3), count - 1]);
}

export function WeightChart({
  colors,
  points,
  unit,
  latestNote,
  limitKg,
  limitLabel,
  reference,
  hideLatest = false,
  decimalComma = false,
}: {
  colors: ColorTokens;
  points: WeightPoint[];
  unit: string;
  /** Chip text next to the latest value, built from fields already on that row. */
  latestNote?: (latest: WeightPoint) => string;
  /** Giới hạn cân: vẽ đường ngang nét đứt và mở rộng trục dọc để luôn thấy. */
  limitKg?: number;
  /** Nhãn cạnh đường giới hạn (đã dịch sẵn), ví dụ "Giới hạn 65,8". */
  limitLabel?: string;
  /** Đường giảm cân dự kiến. Khi có, trục ngang chia theo thời gian thay vì theo thứ tự. */
  reference?: WeightReferencePoint[];
  /** Ẩn dòng số lớn "cân gần nhất" phía trên biểu đồ. */
  hideLatest?: boolean;
  /** Số theo kiểu Việt Nam (66,5). */
  decimalComma?: boolean;
}) {
  const [width, setWidth] = useState(0);
  const onLayout = (event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width);
  const sorted = [...points].sort((a, b) => Date.parse(a.measuredAt) - Date.parse(b.measuredAt));
  const latest = sorted.length > 0 ? sorted[sorted.length - 1] : null;

  const refSorted = reference
    ? [...reference].sort((a, b) => Date.parse(a.measuredAt) - Date.parse(b.measuredAt))
    : [];
  const timeAxis = refSorted.length > 1;
  const times = [...sorted, ...refSorted].map((row) => Date.parse(row.measuredAt));
  const tMin = times.length > 0 ? Math.min(...times) : 0;
  const tMax = times.length > 0 ? Math.max(...times) : 1;
  const num = (value: number, digits = 1) => (decimalComma ? value.toFixed(digits).replace(".", ",") : value.toFixed(digits));

  const weights = [
    ...sorted.map((row) => row.weightKg),
    ...refSorted.map((row) => row.weightKg),
    ...(limitKg != null ? [limitKg] : []),
  ];
  // Có đường giới hạn: chừa ~1 kg dưới đường để đặt nhãn mà không đè lên dữ liệu.
  let lo = weights.length > 0 ? Math.floor((Math.min(...weights) - (limitLabel ? 1 : 0)) * 2) / 2 : 0;
  let hi = weights.length > 0 ? Math.ceil(Math.max(...weights) * 2) / 2 : 1;
  if (hi - lo < 0.5) {
    lo -= 0.5;
    hi += 0.5;
  }
  const plotW = Math.max(0, width - PAD.left - PAD.right);
  const plotH = CHART_H - PAD.top - PAD.bottom;
  const xAtTime = (ms: number) => PAD.left + (tMax === tMin ? plotW / 2 : ((ms - tMin) / (tMax - tMin)) * plotW);
  const xAt = (index: number) =>
    timeAxis
      ? xAtTime(Date.parse(sorted[index]?.measuredAt ?? ""))
      : PAD.left + (sorted.length <= 1 ? plotW / 2 : (index / (sorted.length - 1)) * plotW);
  const yAt = (kg: number) => PAD.top + (1 - (kg - lo) / (hi - lo)) * plotH;
  const ticks = [0, 1, 2, 3].map((step) => lo + ((hi - lo) * step) / 3);
  const labelled = pickLabelIndexes(sorted.length);
  const pointLabelled = sorted.length <= 6 ? labelled : new Set([0, sorted.length - 1]);

  return (
    <View style={styles.chartStack}>
      {latest && !hideLatest ? (
        <View style={styles.latestRow}>
          <Text style={[styles.latestValue, { color: colors.ink }]}>
            {latest.weightKg}
            <Text style={[type.body, { color: colors.inkMuted }]}>{` ${unit}`}</Text>
          </Text>
          {latestNote ? <StatusChip colors={colors} label={latestNote(latest)} /> : null}
        </View>
      ) : null}
      <View
        onLayout={onLayout}
        accessible
        accessibilityLabel={sorted.map((row) => `${shortDate(row.measuredAt)}: ${row.weightKg} ${unit}`).join(", ")}
        style={{ width: "100%", height: CHART_H }}
      >
        {width > 0 ? (
          <Svg width={width} height={CHART_H}>
            {sorted.length > 0 ? (
              ticks.map((tick) => (
                <Line
                  key={`grid-${tick}`}
                  x1={PAD.left}
                  x2={width - PAD.right}
                  y1={yAt(tick)}
                  y2={yAt(tick)}
                  stroke={colors.line}
                  strokeWidth={1}
                />
              ))
            ) : (
              <Line
                x1={PAD.left}
                x2={width - PAD.right}
                y1={PAD.top + plotH}
                y2={PAD.top + plotH}
                stroke={colors.line}
                strokeWidth={1}
              />
            )}
            {sorted.length > 0 || refSorted.length > 0
              ? ticks.map((tick) => (
                  <SvgText key={`tick-${tick}`} x={0} y={yAt(tick) + 3} fill={colors.inkMuted} fontSize={10}>
                    {num(tick)}
                  </SvgText>
                ))
              : null}
            {refSorted.length > 1 ? (
              <Polyline
                points={refSorted.map((row) => `${xAtTime(Date.parse(row.measuredAt))},${yAt(row.weightKg)}`).join(" ")}
                fill="none"
                stroke={colors.inkMuted}
                strokeWidth={2}
                strokeDasharray="2 5"
                strokeLinecap="round"
              />
            ) : null}
            {limitKg != null ? (
              <>
                <Line
                  x1={PAD.left}
                  x2={width - PAD.right}
                  y1={yAt(limitKg)}
                  y2={yAt(limitKg)}
                  stroke={colors.danger}
                  strokeWidth={1.5}
                  strokeDasharray="6 4"
                />
                {limitLabel ? (
                  <SvgText
                    x={PAD.left + 4}
                    y={yAt(limitKg) + 14}
                    fill={colors.danger}
                    fontSize={11}
                    fontWeight="600"
                    textAnchor="start"
                  >
                    {limitLabel}
                  </SvgText>
                ) : null}
              </>
            ) : null}
            {sorted.length > 1 ? (
              <Polyline
                points={sorted.map((row, index) => `${xAt(index)},${yAt(row.weightKg)}`).join(" ")}
                fill="none"
                stroke={colors.ink}
                strokeWidth={2}
              />
            ) : null}
            {sorted.map((row, index) => (
              <Circle
                key={row.id}
                cx={xAt(index)}
                cy={yAt(row.weightKg)}
                r={index === sorted.length - 1 ? 5 : 3.5}
                fill={colors.ink}
                stroke={colors.surface}
                strokeWidth={1.5}
              />
            ))}
            {sorted.map((row, index) =>
              pointLabelled.has(index) ? (
                <SvgText
                  key={`value-${row.id}`}
                  x={xAt(index)}
                  y={yAt(row.weightKg) - 9}
                  fill={colors.ink}
                  fontSize={11}
                  fontWeight="600"
                  textAnchor="middle"
                >
                  {num(row.weightKg)}
                </SvgText>
              ) : null,
            )}
            {sorted.map((row, index) =>
              labelled.has(index) ? (
                <SvgText
                  key={`date-${row.id}`}
                  x={xAt(index)}
                  y={CHART_H - PAD.bottom + 16}
                  fill={colors.inkMuted}
                  fontSize={10}
                  textAnchor="middle"
                >
                  {shortDate(row.measuredAt)}
                </SvgText>
              ) : null,
            )}
            {sorted.map((row, index) =>
              labelled.has(index) && row.caption ? (
                <SvgText
                  key={`caption-${row.id}`}
                  x={xAt(index)}
                  y={CHART_H - PAD.bottom + 28}
                  fill={colors.inkMuted}
                  fontSize={8}
                  textAnchor="middle"
                >
                  {row.caption}
                </SvgText>
              ) : null,
            )}
          </Svg>
        ) : null}
      </View>
    </View>
  );
}

const BODY_W = 318;
const BODY_H = 280;

/** Front view: the fighter's right side is on the viewer's left. */
const JOINT_POS: Record<string, [number, number]> = {
  RIGHT_SHOULDER: [122, 72],
  LEFT_SHOULDER: [196, 72],
  RIGHT_ELBOW: [104, 124],
  LEFT_ELBOW: [214, 124],
  RIGHT_WRIST: [92, 170],
  LEFT_WRIST: [226, 170],
  SPINE_CORE: [159, 116],
  RIGHT_HIP: [140, 160],
  LEFT_HIP: [178, 160],
  RIGHT_KNEE: [134, 212],
  LEFT_KNEE: [184, 212],
  RIGHT_ANKLE: [130, 256],
  LEFT_ANKLE: [188, 256],
};

/** One number per distinct joint, in the order the joint records arrive. */
export function jointNumbers(jointStates: { joint: string }[]): Map<string, number> {
  const numbers = new Map<string, number>();
  for (const row of jointStates) {
    if (!numbers.has(row.joint)) numbers.set(row.joint, numbers.size + 1);
  }
  return numbers;
}

export function JointMarker({ colors, number, state }: { colors: ColorTokens; number: number; state: string }) {
  const { faces } = useTypography();
  const t = toneColors(colors, JOINT_STATE_TONE[state] ?? "neutral");
  const outline = state === "SUSPECTED_AVOIDANCE";
  return (
    <View
      style={[
        styles.marker,
        outline
          ? { borderWidth: 2, borderColor: t.fg, backgroundColor: colors.surface }
          : { backgroundColor: t.fg },
      ]}
    >
      <Text
        style={[type.caption, styles.markerText, { fontFamily: faces.bold, color: outline ? t.fg : colors.surface }]}
      >
        {number}
      </Text>
    </View>
  );
}

export function InjuryRing({ colors, severity }: { colors: ColorTokens; severity: string }) {
  const t = toneColors(colors, SEVERITY_TONE[severity] ?? "neutral");
  return <View style={[styles.marker, styles.injuryRing, { borderColor: t.fg }]} />;
}

export function BodyMap({
  colors,
  jointStates,
  injuries,
}: {
  colors: ColorTokens;
  jointStates: { joint: string; currentState: string }[];
  injuries: { id: string; affectedJoint: string; severity: string }[];
}) {
  const numbers = jointNumbers(jointStates);
  const worst = new Map<string, string>();
  for (const row of jointStates) {
    const current = worst.get(row.joint);
    if (current == null || (JOINT_STATE_RANK[row.currentState] ?? 0) > (JOINT_STATE_RANK[current] ?? 0)) {
      worst.set(row.joint, row.currentState);
    }
  }
  const limb = { fill: "none", stroke: colors.line, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

  return (
    <View style={{ width: "100%", aspectRatio: BODY_W / BODY_H }}>
      <Svg width="100%" height="100%" viewBox={`0 0 ${BODY_W} ${BODY_H}`}>
        <Circle cx={159} cy={30} r={18} fill={colors.line} />
        <Rect x={120} y={56} width={78} height={112} rx={24} fill={colors.line} />
        <Polyline points="122,72 104,124 92,170" strokeWidth={16} {...limb} />
        <Polyline points="196,72 214,124 226,170" strokeWidth={16} {...limb} />
        <Polyline points="140,160 134,212 130,262" strokeWidth={20} {...limb} />
        <Polyline points="178,160 184,212 188,262" strokeWidth={20} {...limb} />

        {injuries.map((injury) => {
          const pos = JOINT_POS[injury.affectedJoint];
          if (!pos) return null;
          return (
            <Circle
              key={injury.id}
              cx={pos[0]}
              cy={pos[1]}
              r={18}
              fill="none"
              stroke={toneColors(colors, SEVERITY_TONE[injury.severity] ?? "neutral").fg}
              strokeWidth={2}
              strokeDasharray="4 3"
            />
          );
        })}

        {[...worst.entries()].map(([joint, state]) => {
          const pos = JOINT_POS[joint];
          if (!pos) return null;
          const fg = toneColors(colors, JOINT_STATE_TONE[state] ?? "neutral").fg;
          const outline = state === "SUSPECTED_AVOIDANCE";
          return (
            <Circle
              key={`joint-${joint}`}
              cx={pos[0]}
              cy={pos[1]}
              r={11}
              fill={outline ? colors.surface : fg}
              stroke={fg}
              strokeWidth={2}
            />
          );
        })}
        {[...worst.entries()].map(([joint, state]) => {
          const pos = JOINT_POS[joint];
          if (!pos) return null;
          const outline = state === "SUSPECTED_AVOIDANCE";
          return (
            <SvgText
              key={`joint-n-${joint}`}
              x={pos[0]}
              y={pos[1] + 4}
              fill={outline ? toneColors(colors, JOINT_STATE_TONE[state] ?? "neutral").fg : colors.surface}
              fontSize={11}
              fontWeight="700"
              textAnchor="middle"
            >
              {numbers.get(joint)}
            </SvgText>
          );
        })}
      </Svg>
    </View>
  );
}

/** Only rendered when the plan row actually carries `progress`. */
export function ProgressRing({ colors, percent, size = 64 }: { colors: ColorTokens; percent: number; size?: number }) {
  const stroke = 6;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, percent));
  const c = size / 2;
  return (
    <View accessible accessibilityLabel={`${clamped}%`} style={[styles.center, { width: size, height: size }]}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={c} cy={c} r={r} fill="none" stroke={colors.surfaceMuted} strokeWidth={stroke} />
        <Circle
          cx={c}
          cy={c}
          r={r}
          fill="none"
          stroke={colors.success}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${(clamped / 100) * circumference} ${circumference}`}
          transform={`rotate(-90 ${c} ${c})`}
        />
      </Svg>
      <Text style={[type.label, { color: colors.ink }]}>{`${clamped}%`}</Text>
    </View>
  );
}

export function PlanStatusMark({
  colors,
  status,
  size = 64,
}: {
  colors: ColorTokens;
  status: TrainingPlanStatus;
  size?: number;
}) {
  const t = toneColors(colors, PLAN_STATUS_TONE[status]);
  return (
    <View style={[styles.center, { width: size, height: size, borderRadius: radius.pill, backgroundColor: t.soft }]}>
      <Ionicons name={PLAN_STATUS_ICON[status]} size={size * 0.42} color={t.fg} />
    </View>
  );
}

const styles = StyleSheet.create({
  chartStack: { gap: spacing.md },
  latestRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  latestValue: { fontFamily: fonts.display, fontSize: 34, lineHeight: viLineHeight(34) },
  center: { alignItems: "center", justifyContent: "center" },
  marker: {
    width: 22,
    height: 22,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  markerText: { fontSize: 11 },
  injuryRing: { borderWidth: 2, borderStyle: "dashed" },
});
