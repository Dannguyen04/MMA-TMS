import { useState, type ReactNode } from "react";
import { Text, View } from "react-native";

import { Icon } from "@/components/icon";
import { PressableScale, StaggerList } from "@/components/motion";
import { strikeAt, type EvidenceWindow, type ResultFinding, type ResultStrike, type WorkerResult } from "@/components/video/pose-model";
import { strikeName } from "@/components/video/pose-overlay";
import { ev } from "@/i18n/video-evidence";
import { UNKNOWN_VALUE } from "@/i18n/backend-codes";
import { guidanceLine } from "@/i18n/server-text";
import { Choices } from "@/screens/fight-camp/camp-ui";
import { filterFindings, formatPrecise, metricsOf, type FindingFilter } from "@/screens/media/evidence/evidence-model";
import { useThemePreference } from "@/theme";
import { fonts, readableTextStyle, fz, lh } from "@/theme/typography";

type Seek = (ms: number) => void;
export type Word = { word: string; tone?: "ok" | "warn" };

/** Uppercase section head with an optional count after it (redesign step 19). */
export function EvHead({ title, aside }: { title: string; aside?: string }) {
  const { colors: c } = useThemePreference();
  return <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
    <Text accessibilityRole="header" style={{ fontFamily: fonts.display, fontSize: fz(18), lineHeight: lh(25), letterSpacing: 0.7, textTransform: "uppercase", color: c.ink }}>{title}</Text>
    {aside ? <Text numberOfLines={1} style={{ ...readableTextStyle(13.5, true), color: c.ink }}>{aside}</Text> : null}
  </View>;
}

/**
 * One evidence row (redesign step 19): the time (or a mark) as the lead, an uppercase title, then one line where only
 * the status word is coloured. The row playing now has a red lead. Pressing seeks (and, for the coach, opens a review).
 */
export function EvRow({ lead, leadTone, title, word, line, active, onPress, a11y, testID, last }: {
  lead: string; leadTone?: "ok" | "warn" | "dim"; title: string; word?: Word; line?: string; active?: boolean;
  onPress?: () => void; a11y: string; testID?: string; last?: boolean;
}) {
  const { colors: c } = useThemePreference();
  const tone = active ? c.lotus : leadTone === "ok" ? c.success : leadTone === "warn" ? c.danger : leadTone === "dim" ? c.inkSubtle : c.ink;
  const wordColor = word?.tone === "ok" ? c.success : word?.tone === "warn" ? c.danger : c.ink;
  const style = { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 60, paddingVertical: 8, borderTopColor: c.line, borderTopWidth: 1, ...(last ? { borderBottomColor: c.line, borderBottomWidth: 1 } : null) } as const;
  const body = <>
    <Text numberOfLines={1} style={{ width: 60, fontFamily: fonts.displayExtraBold, fontSize: lead.length > 2 ? 20 : 28, lineHeight: lh(30), color: tone }}>{lead}</Text>
    <View style={{ flex: 1, minWidth: 0 }}>
      <Text numberOfLines={1} style={{ fontFamily: fonts.display, fontSize: fz(16.5), lineHeight: lh(23), letterSpacing: 0.5, textTransform: "uppercase", color: c.ink }}>{title}</Text>
      {word || line ? <Text numberOfLines={1} style={{ ...readableTextStyle(13.5), color: c.ink }}>
        {word ? <Text style={{ ...readableTextStyle(13.5, true), color: wordColor }}>{word.word}</Text> : null}
        {word && line ? ` · ${line}` : line}
      </Text> : null}
    </View>
    {onPress ? <Icon name="chevron" size={18} color={c.inkSubtle}/> : null}
  </>;
  if (!onPress) return <View testID={testID} accessible accessibilityLabel={a11y} style={style}>{body}</View>;
  return <PressableScale testID={testID} scaleTo={0.99} accessibilityRole="button" accessibilityLabel={a11y} onPress={onPress} style={style}>{body}</PressableScale>;
}

function Plain({ children, testID }: { children: string; testID?: string }) {
  const { colors: c } = useThemePreference();
  return <Text testID={testID} style={{ ...readableTextStyle(15), color: c.ink }}>{children}</Text>;
}

function strikeFacts(s: ResultStrike): string {
  const parts: string[] = [];
  if (s.score != null) parts.push(`${ev.score} ${Math.round(s.score)}`);
  if (s.angle != null) parts.push(`${Math.round(s.angle)}°`);
  if (s.peakSpeed != null) parts.push(`${s.peakSpeed.toFixed(2)} ${ev.speedUnit}`);
  return parts.join(" · ");
}
const guardWord = (s: ResultStrike): Word | undefined =>
  s.guardKept == null ? undefined : s.guardKept ? { word: ev.guardKept } : { word: ev.guardDropped, tone: "warn" };

export function TimelinePanel({
  result,
  timeMs,
  onSeek,
  top,
  windowStatus,
  onWindow,
}: {
  result: WorkerResult;
  timeMs: number;
  onSeek: Seek;
  /** Role-specific block above the strike list (doctor health alerts). */
  top?: ReactNode;
  /** The review word for a window (coach and doctor). */
  windowStatus?: (w: EvidenceWindow) => Word;
  /** Opens the window review (when the reader may review). */
  onWindow?: (w: EvidenceWindow) => void;
}) {
  const { colors: c } = useThemePreference();
  const now = strikeAt(result.strikes, timeMs);
  const me = result.movementEvidence;
  const nowFacts = now ? strikeFacts(now) : "";
  return (
    <View style={{ gap: 18 }} testID="panel-timeline">
      <View testID="timeline-now" accessible accessibilityLabel={`${ev.now} ${formatPrecise(timeMs)}. ${now ? `${strikeName(now)}. ${nowFacts}` : ev.nothingNow}`}
        style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, borderTopColor: c.line, borderTopWidth: 1, borderBottomColor: c.line, borderBottomWidth: 1 }}>
        <Text style={{ width: 60, fontFamily: fonts.displayExtraBold, fontSize: fz(20), lineHeight: lh(26), color: c.lotus }}>{formatPrecise(timeMs)}</Text>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={{ fontFamily: fonts.display, fontSize: fz(16.5), lineHeight: lh(23), letterSpacing: 0.5, textTransform: "uppercase", color: c.ink }}>{now ? strikeName(now) : ev.now}</Text>
          <Text numberOfLines={1} style={{ ...readableTextStyle(13.5), color: c.ink }}>{now ? nowFacts || " " : ev.nothingNow}</Text>
        </View>
      </View>
      {top}
      <View style={{ gap: 8 }}>
        <EvHead title={ev.strikes} aside={result.strikes.length ? String(result.strikes.length) : undefined}/>
        {result.strikes.length === 0 ? <Plain>{ev.noStrikes}</Plain> : null}
        {result.strikes.length ? <StaggerList>
          {result.strikes.map((s, i) => {
            const at = s.impactMs ?? s.startMs;
            const facts = strikeFacts(s);
            const w = guardWord(s);
            return <EvRow key={`${s.actionId ?? i}`} testID={`strike-${i}`} lead={formatPrecise(at)} title={strikeName(s)} active={now === s}
              line={facts} word={w} a11y={`${strikeName(s)}, ${ev.at(formatPrecise(at))}${facts ? `, ${facts}` : ""}${w ? `, ${w.word}` : ""}`}
              onPress={() => onSeek(at)} last={i === result.strikes.length - 1}/>;
          })}
        </StaggerList> : null}
      </View>
      <View style={{ gap: 8 }}>
        <EvHead title={ev.windows} aside={me ? ev.usable(me.usableFrames, me.totalFrames) : undefined}/>
        {me ? <Text testID="evidence-status" style={{ ...readableTextStyle(14.5, true), color: me.status === "review_ready" ? c.success : c.danger }}>{ev.evidenceStatus[me.status] ?? UNKNOWN_VALUE}</Text> : null}
        {me?.guidance.map((g) => {
          // Phase 5 C: Vietnamese by code; an unknown code is hidden, never the English message.
          const line = guidanceLine(g.code);
          return line ? <Plain key={g.code}>{line}</Plain> : null;
        })}
        {!me || me.windows.length === 0 ? <Plain>{ev.noWindows}</Plain> : null}
        {me?.windows.length ? <StaggerList>
          {me.windows.map((w, i) => {
            const range = `${formatPrecise(w.startMs)} – ${formatPrecise(w.endMs)} · ${ev.frames(w.sampleCount)}`;
            const st = windowStatus?.(w);
            return <EvRow key={w.id} testID={`window-${w.id}`} lead={formatPrecise(w.startMs)} title={ev.windowN(i + 1)} word={st} line={range}
              active={timeMs >= w.startMs && timeMs <= w.endMs} a11y={`${ev.windowN(i + 1)}, ${st ? `${st.word}, ` : ""}${range}`}
              onPress={() => { onSeek(w.startMs); onWindow?.(w); }} last={i === me.windows.length - 1}/>;
          })}
        </StaggerList> : null}
      </View>
    </View>
  );
}

/** The mark before a finding: ✓ good, ! to fix, – a plain note. */
export function findingMark(f: Pick<ResultFinding, "severity">): { lead: string; tone?: "ok" | "warn" | "dim" } {
  if (f.severity === "positive") return { lead: "✓", tone: "ok" };
  if (f.severity === "warning" || f.severity === "critical") return { lead: "!", tone: "warn" };
  return { lead: "–", tone: "dim" };
}

/**
 * AI findings with a filter (Tất cả · Cần sửa · Tốt). Each row: mark, title, then the review word (coach) or the
 * severity word, time and description. `onOpen` lets the coach review a finding; otherwise a tap seeks.
 */
export function FindingsPanel({
  result,
  onSeek,
  status,
  onOpen,
  header,
}: {
  result: WorkerResult;
  onSeek: Seek;
  status?: (f: ResultFinding) => Word;
  onOpen?: (f: ResultFinding) => void;
  header?: ReactNode;
}) {
  const [filter, setFilter] = useState<FindingFilter>("all");
  const rows = filterFindings(result.findings, filter);
  return (
    <View style={{ gap: 14 }} testID="panel-review">
      {header}
      <Choices chips value={filter} onChange={setFilter}
        options={[{ value: "all" as FindingFilter, label: ev.filterAll }, { value: "fix" as FindingFilter, label: ev.filterFix }, { value: "good" as FindingFilter, label: ev.filterGood }]}/>
      {rows.length === 0 ? <Plain>{ev.noFindings}</Plain> : null}
      {rows.length ? <StaggerList>
        {rows.map((f, i) => {
          const m = findingMark(f);
          const w = status?.(f) ?? { word: ev.severity[f.severity] ?? UNKNOWN_VALUE, tone: m.tone === "dim" ? undefined : m.tone };
          const line = [formatPrecise(f.timeMs), f.description, f.recommendation].filter(Boolean).join(" · ");
          return <EvRow key={f.id} testID={`finding-${f.id}`} lead={m.lead} leadTone={m.tone} title={f.title} word={w} line={line}
            a11y={`${f.title}, ${w.word}, ${line}`} onPress={() => { onSeek(f.timeMs); onOpen?.(f); }} last={i === rows.length - 1}/>;
        })}
      </StaggerList> : null}
    </View>
  );
}

/** Four numbers in one ruled strip, like the stat strips on the other pages. */
export function MetricsPanel({ result, children }: { result: WorkerResult; children?: ReactNode }) {
  const { colors: c } = useThemePreference();
  const m = metricsOf(result);
  const cells: [string, string, string][] = [
    [ev.metricStrikes, String(m.strikes), ""],
    [ev.metricAvg, m.avgScore == null ? "–" : String(Math.round(m.avgScore)), ""],
    [ev.metricSpeed, m.peakSpeed == null ? "–" : m.peakSpeed.toFixed(2), ""],
    [ev.metricUsable, m.usablePct == null ? "–" : String(m.usablePct), m.usablePct == null ? "" : "%"],
  ];
  return (
    <View style={{ gap: 18 }} testID="panel-metrics">
      <View style={{ flexDirection: "row", borderTopColor: c.line, borderTopWidth: 1, borderBottomColor: c.line, borderBottomWidth: 1 }}>
        {cells.map(([label, value, unit], k) => (
          <View key={label} accessible accessibilityLabel={`${label}: ${value}${unit}`} style={{ flex: 1, minWidth: 0, alignItems: "center", paddingVertical: 12, paddingHorizontal: 3, ...(k ? { borderLeftColor: c.line, borderLeftWidth: 1 } : null) }}>
            <Text numberOfLines={1} adjustsFontSizeToFit style={{ fontFamily: fonts.displayExtraBold, fontSize: fz(24), lineHeight: lh(28), color: value === "–" ? c.inkSubtle : c.ink }}>{value}{unit ? <Text style={{ fontSize: fz(13) }}>{unit}</Text> : null}</Text>
            <Text numberOfLines={1} adjustsFontSizeToFit style={{ ...readableTextStyle(12), color: c.ink, marginTop: 2 }}>{label}</Text>
          </View>
        ))}
      </View>
      {children}
    </View>
  );
}
