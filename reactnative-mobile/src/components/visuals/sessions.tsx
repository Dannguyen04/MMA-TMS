import Ionicons from "@expo/vector-icons/Ionicons";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { SessionStatus, SessionType, TrainingSession } from "@/api";
import { radius, spacing, type, useTypography, type ColorTokens } from "@/theme";

import { StatusChip } from "./primitives";
import { SESSION_STATUS_TONE, SESSION_TYPE_ICON, toneColors } from "./tone";

export type TimelineSession = Pick<TrainingSession, "id" | "title" | "scheduledAt" | "sessionType" | "status">;

export type SessionTimelineProps = {
  colors: ColorTokens;
  rows: TimelineSession[];
  whenLabel: (iso: string) => string;
  typeLabel: (type: SessionType) => string;
  statusLabel: (status: SessionStatus) => string;
  onPressRow?: (row: TimelineSession) => void;
};

export function SessionTimeline({ colors, rows, whenLabel, typeLabel, statusLabel, onPressRow }: SessionTimelineProps) {
  return (
    <View>
      {rows.map((row, index) => {
        const last = index === rows.length - 1;
        const tone = SESSION_STATUS_TONE[row.status];
        const body = (
          <View style={styles.timelineRow}>
            <View style={styles.rail}>
              <View
                style={[
                  styles.typeRing,
                  { borderColor: toneColors(colors, tone).border, backgroundColor: colors.surfaceMuted },
                ]}
              >
                <Ionicons name={SESSION_TYPE_ICON[row.sessionType]} size={18} color={colors.ink} />
              </View>
              {!last ? <View style={[styles.railLine, { backgroundColor: colors.line }]} /> : null}
            </View>
            <View style={[styles.timelineBody, !last && styles.timelineGap]}>
              <Text style={[type.body, { color: colors.ink }]} numberOfLines={2}>
                {row.title}
              </Text>
              <Text style={[type.caption, { color: colors.inkMuted }]}>
                {whenLabel(row.scheduledAt)} · {typeLabel(row.sessionType)}
              </Text>
              <StatusChip colors={colors} label={statusLabel(row.status)} tone={tone} />
            </View>
          </View>
        );
        if (!onPressRow) return <View key={row.id}>{body}</View>;
        return (
          <Pressable
            key={row.id}
            accessibilityRole="button"
            accessibilityLabel={`${row.title}, ${typeLabel(row.sessionType)}, ${statusLabel(row.status)}`}
            onPress={() => onPressRow(row)}
            style={styles.touch}
          >
            {body}
          </Pressable>
        );
      })}
    </View>
  );
}

/** Bars counted from the sessions the screen already loaded. */
export function SessionTypeMix({
  colors,
  sessions,
  typeLabel,
  title,
}: {
  colors: ColorTokens;
  sessions: { sessionType: SessionType }[];
  typeLabel: (type: SessionType) => string;
  title?: string;
}) {
  const counts = new Map<SessionType, number>();
  for (const row of sessions) counts.set(row.sessionType, (counts.get(row.sessionType) ?? 0) + 1);
  const entries = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const max = entries.length > 0 ? entries[0][1] : 0;

  return (
    <View style={styles.mix}>
      {title ? <Text style={[type.label, { color: colors.inkMuted }]}>{title}</Text> : null}
      {entries.map(([sessionType, count]) => (
        <View key={sessionType} style={styles.mixRow}>
          <Ionicons name={SESSION_TYPE_ICON[sessionType]} size={16} color={colors.inkMuted} />
          <View style={styles.flex}>
            <Text style={[type.caption, { color: colors.ink }]} numberOfLines={1}>
              {typeLabel(sessionType)}
            </Text>
          </View>
          <View style={[styles.mixTrack, { backgroundColor: colors.surfaceMuted }]}>
            <View style={[styles.mixFill, { backgroundColor: colors.ink, width: `${(count / max) * 100}%` }]} />
          </View>
          <Text style={[type.caption, styles.mixCount, { color: colors.ink }]}>{count}</Text>
        </View>
      ))}
    </View>
  );
}

const BAR_MAX = 104;
const DAY_MS = 24 * 60 * 60 * 1000;

function dayMonth(date: Date): string {
  return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function weekdayLabel(date: Date): string {
  return date.toLocaleDateString("vi-VN", { weekday: "short" });
}

export function WeeklyLoad({
  colors,
  weekSessions,
  weekStart,
  today,
  title,
}: {
  colors: ColorTokens;
  /** Already filtered to [weekStart, weekStart + 7d) by the screen. */
  weekSessions: TimelineSession[];
  weekStart: Date;
  today: Date;
  title: string;
}) {
  const { faces } = useTypography();
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  const todayIndex = Math.floor((today.getTime() - weekStart.getTime()) / DAY_MS);
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(weekStart);
    date.setDate(date.getDate() + index);
    const rows = weekSessions.filter(
      (row) => Math.floor((new Date(row.scheduledAt).getTime() - weekStart.getTime()) / DAY_MS) === index,
    );
    const types = [...new Set(rows.map((row) => row.sessionType))].slice(0, 2);
    return { key: index, label: weekdayLabel(date), count: rows.length, types };
  });
  const max = Math.max(0, ...days.map((day) => day.count));

  return (
    <View style={styles.week}>
      <View style={styles.weekHeader}>
        <Text style={[type.title, { color: colors.ink }]}>{title}</Text>
        <Text style={[type.caption, { color: colors.inkMuted }]}>
          {dayMonth(weekStart)} – {dayMonth(weekEnd)}
        </Text>
      </View>
      <View
        accessible
        accessibilityLabel={days.map((day) => `${day.label}: ${day.count}`).join(", ")}
        style={styles.weekBars}
      >
        {days.map((day) => {
          const isToday = day.key === todayIndex;
          return (
            <View key={day.key} style={styles.dayCol}>
              {day.types.map((sessionType) => (
                <Ionicons key={sessionType} name={SESSION_TYPE_ICON[sessionType]} size={14} color={colors.inkMuted} />
              ))}
              <View
                style={[
                  styles.dayBar,
                  {
                    backgroundColor: day.count > 0 ? colors.ink : colors.line,
                    height: day.count > 0 ? Math.max(12, (day.count / max) * BAR_MAX) : 4,
                  },
                ]}
              />
              <Text
                style={[
                  type.caption,
                  styles.dayLabel,
                  { color: isToday ? colors.ink : colors.inkMuted },
                  isToday && { fontFamily: faces.bold },
                ]}
              >
                {day.label}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  touch: { minHeight: 44 },
  timelineRow: { flexDirection: "row", gap: spacing.md },
  rail: { alignItems: "center" },
  typeRing: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  railLine: { width: 2, flex: 1 },
  timelineBody: { flex: 1, gap: spacing.xs },
  timelineGap: { paddingBottom: spacing.lg },
  mix: { gap: spacing.sm },
  mixRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  mixTrack: { height: 10, width: 120, overflow: "hidden", borderRadius: radius.pill },
  mixFill: { height: "100%", borderRadius: radius.pill },
  mixCount: { width: 20, textAlign: "right" },
  week: { gap: spacing.md },
  weekHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  weekBars: { height: 150, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" },
  dayCol: { width: 36, alignItems: "center", gap: spacing.xs },
  dayBar: { width: 20, borderRadius: radius.field },
  dayLabel: { fontSize: 11 },
});
