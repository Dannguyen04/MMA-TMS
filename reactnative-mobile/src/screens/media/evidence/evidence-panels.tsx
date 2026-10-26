import { useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { strikeAt, type EvidenceWindow, type ResultFinding, type ResultStrike, type WorkerResult } from "@/components/video/pose-model";
import { strikeName } from "@/components/video/pose-overlay";
import { ev } from "@/i18n/video-evidence";
import { useFighterPalette, type FighterPalette } from "@/screens/fighter/redesign/palette";
import { filterFindings, formatPrecise, metricsOf, type FindingFilter } from "@/screens/media/evidence/evidence-model";
import { useTypography } from "@/theme";

type Seek = (ms: number) => void;

function Section({ title, aside, children }: { title: string; aside?: string; children: ReactNode }) {
  const c = useFighterPalette();
  const live = useTypography();
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Text style={{ color: c.ink, fontFamily: live.faces.semibold, fontSize: 16 }}>{title}</Text>
        {aside ? <Text style={{ color: c.muted, fontSize: 12 }}>{aside}</Text> : null}
      </View>
      {children}
    </View>
  );
}

function strikeFacts(s: ResultStrike): string {
  const parts: string[] = [];
  if (s.score != null) parts.push(`${ev.score} ${Math.round(s.score)}`);
  if (s.angle != null) parts.push(`${Math.round(s.angle)}°`);
  if (s.peakSpeed != null) parts.push(`${s.peakSpeed.toFixed(2)} ${ev.speedUnit}`);
  if (s.guardKept != null) parts.push(s.guardKept ? ev.guardKept : ev.guardDropped);
  return parts.join(" · ");
}

function Row({ time, title, detail, active, onPress, testID, tone }: { time: number; title: string; detail?: string; active?: boolean; onPress: () => void; testID?: string; tone?: string }) {
  const c = useFighterPalette();
  const live = useTypography();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${ev.at(formatPrecise(time))}`}
      onPress={onPress}
      testID={testID}
      style={[styles.row, { borderBottomColor: c.line, backgroundColor: active ? c.surface2 : "transparent" }]}
    >
      <Text style={[styles.time, { color: c.muted, fontFamily: live.faces.medium }]}>{formatPrecise(time)}</Text>
      <View style={styles.rowBody}>
        <Text style={{ color: tone ?? c.ink, fontFamily: live.faces.semibold, fontSize: 14 }}>{title}</Text>
        {detail ? <Text style={{ color: c.muted, fontSize: 13 }}>{detail}</Text> : null}
      </View>
    </Pressable>
  );
}

export function TimelinePanel({
  result,
  timeMs,
  onSeek,
  top,
  renderWindowExtra,
}: {
  result: WorkerResult;
  timeMs: number;
  onSeek: Seek;
  /** Role-specific block above the strike list (doctor health alerts). */
  top?: ReactNode;
  renderWindowExtra?: (w: EvidenceWindow) => ReactNode;
}) {
  const c = useFighterPalette();
  const live = useTypography();
  const now = strikeAt(result.strikes, timeMs);
  const me = result.movementEvidence;
  return (
    <View style={styles.panel} testID="panel-timeline">
      <View style={[styles.nowCard, { backgroundColor: c.surface, borderColor: c.line }]}>
        <Text style={{ color: c.muted, fontSize: 12 }}>{ev.now} · {formatPrecise(timeMs)}</Text>
        {now ? (
          <>
            <Text style={{ color: c.ink, fontFamily: live.faces.semibold, fontSize: 16 }}>{strikeName(now)}</Text>
            <Text style={{ color: c.muted, fontSize: 13 }}>{strikeFacts(now)}</Text>
          </>
        ) : (
          <Text style={{ color: c.muted, fontSize: 14 }}>{ev.nothingNow}</Text>
        )}
      </View>
      {top}
      <Section title={ev.strikes} aside={result.strikes.length ? String(result.strikes.length) : undefined}>
        {result.strikes.length === 0 ? <Text style={{ color: c.muted }}>{ev.noStrikes}</Text> : null}
        {result.strikes.map((s, i) => (
          <Row
            key={`${s.actionId ?? i}`}
            time={s.impactMs ?? s.startMs}
            title={strikeName(s)}
            detail={strikeFacts(s)}
            active={now === s}
            onPress={() => onSeek(s.impactMs ?? s.startMs)}
            testID={`strike-${i}`}
          />
        ))}
      </Section>
      <Section title={ev.windows} aside={me ? ev.usable(me.usableFrames, me.totalFrames) : undefined}>
        {me ? (
          <Text style={{ color: me.status === "review_ready" ? c.success : c.warning, fontSize: 13 }}>
            {ev.evidenceStatus[me.status] ?? me.status}
          </Text>
        ) : null}
        {me?.guidance.map((g) => (
          <Text key={g.code} style={{ color: c.muted, fontSize: 13 }}>{g.message}</Text>
        ))}
        {!me || me.windows.length === 0 ? <Text style={{ color: c.muted }}>{ev.noWindows}</Text> : null}
        {me?.windows.map((w, i) => (
          <View key={w.id}>
          <Row
            time={w.startMs}
            title={ev.windowN(i + 1)}
            detail={`${formatPrecise(w.startMs)} – ${formatPrecise(w.endMs)} · ${ev.frames(w.sampleCount)}`}
            active={timeMs >= w.startMs && timeMs <= w.endMs}
            onPress={() => onSeek(w.startMs)}
            testID={`window-${w.id}`}
          />
          {renderWindowExtra?.(w)}
          </View>
        ))}
      </Section>
    </View>
  );
}

export function severityTone(c: FighterPalette, f: ResultFinding): string {
  if (f.severity === "positive") return c.success;
  if (f.severity === "warning" || f.severity === "critical") return c.warning;
  return c.ink;
}

/** Read-only AI findings with a filter; `renderExtra` lets the coach screen attach review controls. */
export function FindingsPanel({
  result,
  onSeek,
  renderExtra,
  header,
}: {
  result: WorkerResult;
  onSeek: Seek;
  renderExtra?: (f: ResultFinding) => ReactNode;
  header?: ReactNode;
}) {
  const c = useFighterPalette();
  const [filter, setFilter] = useState<FindingFilter>("all");
  const rows = filterFindings(result.findings, filter);
  const opts: [FindingFilter, string][] = [["all", ev.filterAll], ["fix", ev.filterFix], ["good", ev.filterGood]];
  return (
    <View style={styles.panel} testID="panel-review">
      {header}
      <View style={styles.chips}>
        {opts.map(([k, label]) => {
          const on = k === filter;
          return (
            <Pressable
              key={k}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              onPress={() => setFilter(k)}
              testID={`finding-filter-${k}`}
              style={[styles.chip, { borderColor: on ? c.ink : c.line, backgroundColor: on ? c.ink : "transparent" }]}
            >
              <Text style={{ color: on ? c.bg : c.ink, fontSize: 13, fontWeight: "600" }}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
      {rows.length === 0 ? <Text style={{ color: c.muted }}>{ev.noFindings}</Text> : null}
      {rows.map((f) => (
        <View key={f.id} style={[styles.finding, { borderBottomColor: c.line }]}>
          <Row
            time={f.timeMs}
            title={f.title}
            detail={[ev.severity[f.severity], f.description, f.recommendation].filter(Boolean).join(" · ")}
            tone={severityTone(c, f)}
            onPress={() => onSeek(f.timeMs)}
            testID={`finding-${f.id}`}
          />
          {renderExtra?.(f)}
        </View>
      ))}
    </View>
  );
}

export function MetricsPanel({ result, children }: { result: WorkerResult; children?: ReactNode }) {
  const c = useFighterPalette();
  const live = useTypography();
  const m = metricsOf(result);
  const cells: [string, string][] = [
    [ev.metricStrikes, String(m.strikes)],
    [ev.metricAvg, m.avgScore == null ? "—" : String(Math.round(m.avgScore))],
    [ev.metricSpeed, m.peakSpeed == null ? "—" : m.peakSpeed.toFixed(2)],
    [ev.metricUsable, m.usablePct == null ? "—" : `${m.usablePct}%`],
  ];
  return (
    <View style={styles.panel} testID="panel-metrics">
      <View style={styles.grid}>
        {cells.map(([label, value]) => (
          <View key={label} style={[styles.cell, { backgroundColor: c.surface, borderColor: c.line }]}>
            <Text style={{ color: c.muted, fontSize: 12 }}>{label}</Text>
            <Text style={{ color: c.ink, fontFamily: live.faces.bold, fontSize: 22 }}>{value}</Text>
          </View>
        ))}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { gap: 18 },
  section: { gap: 6 },
  sectionHead: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" },
  nowCard: { borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, padding: 14, gap: 4 },
  row: { flexDirection: "row", gap: 12, minHeight: 48, paddingVertical: 10, paddingHorizontal: 4, borderBottomWidth: StyleSheet.hairlineWidth, borderRadius: 6 },
  time: { width: 52, fontSize: 13, paddingTop: 1 },
  rowBody: { flex: 1, gap: 2 },
  chips: { flexDirection: "row", gap: 8 },
  chip: { minHeight: 34, paddingHorizontal: 14, borderRadius: 17, borderWidth: 1, justifyContent: "center" },
  finding: { gap: 6 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  cell: { flexGrow: 1, flexBasis: "45%", borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, padding: 14, gap: 4 },
});
