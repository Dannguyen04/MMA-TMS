import { useCallback } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import type { SessionStatus, TrainingSession } from "@/api/types";
import { EmptyLine, RolePage } from "@/components/role-page";
import { fighter } from "@/i18n/fighter";
import { whenLine } from "@/screens/coach/fighters/fighter-model";
import { useSource } from "@/screens/coach/today/coach-today-screen";
import { sentences } from "@/screens/fight-camp/camp-ui";
import { getTrainingSession } from "@/screens/fighter/api";
import { RetryRow } from "@/screens/fighter/redesign/tab-page";
import { useFighterId } from "@/screens/fighter/use-fighter-id";
import { useThemePreference } from "@/theme";
import { fonts, readableTextStyle, fz, lh } from "@/theme/typography";

const t = fighter.tap;

/** Only the status word is coloured: Đã xong green; Bỏ buổi, Đã hủy and Dừng giữa chừng red; the rest ink. */
export function fighterSessionWord(s: SessionStatus): { word: string; tone?: "ok" | "warn" } {
  const tone = s === "COMPLETED" ? "ok" : s === "SKIPPED" || s === "CANCELLED" || s === "ABANDONED" ? "warn" : undefined;
  return { word: fighter.sessionStatus[s] ?? s, tone };
}

/**
 * Buổi tập for the fighter (redesign step 25, the short version the owner chose): read only. Title, "type · status
 * word", Thời gian, Địa điểm (and Lý do hủy), then the coach's notes one sentence per line. A session waiting to be
 * rescheduled says "HLV sẽ xếp lại buổi này."
 */
export function FighterSessionPage() {
  const router = useRouter();
  const { colors: c } = useThemePreference();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const sessionId = typeof id === "string" ? id : "";
  const { canFetch } = useFighterId();
  const on = canFetch && !!sessionId;
  const load = useCallback(() => (on ? getTrainingSession(sessionId) : Promise.resolve(null)), [on, sessionId]);
  const [src, reload, refresh] = useSource<TrainingSession | null>(load, `${on}|${sessionId}`);
  const back = () => (router.canGoBack() ? router.back() : router.replace("/(fighter)/tap" as never));
  const s = src.state === "ok" ? src.data : null;

  return <RolePage testID="fighter-session-page" title={t.detailTitle} onBack={back} onRefresh={on ? refresh : undefined}>
    {on && src.state === "loading" ? <ActivityIndicator color={c.lotus} style={{ paddingVertical: 40 }}/> : null}
    {src.state === "error" ? <RetryRow message={t.loadFailed} retry={fighter.common.retry} onRetry={reload}/> : null}
    {!on ? <EmptyLine testID="session-none" title={t.notFound} line={canFetch ? undefined : fighter.common.demoHint}/> : null}
    {on && src.state === "ok" && !s ? <EmptyLine testID="session-none" title={t.notFound}/> : null}
    {s ? <SessionBody s={s}/> : null}
  </RolePage>;
}

function SessionBody({ s }: { s: TrainingSession }) {
  const { colors: c } = useThemePreference();
  const w = fighterSessionWord(s.status);
  const kind = fighter.sessionType[s.sessionType] ?? s.sessionType;
  const facts: [string, string][] = [[t.when, whenLine(s.scheduledAt)]];
  if (s.location) facts.push([t.where, s.location]);
  if (s.cancellationReason) facts.push([t.cancelReason, s.cancellationReason]);
  const notes = s.coachNotes?.trim() ? sentences(s.coachNotes) : [];
  return <>
    <View style={{ gap: 3 }}>
      <Text accessibilityRole="header" numberOfLines={2} style={{ fontFamily: fonts.displayExtraBold, fontSize: fz(26), lineHeight: lh(36), textTransform: "uppercase", color: c.ink }}>{s.title}</Text>
      <Text testID="session-line" numberOfLines={1} accessibilityLabel={`${kind}. ${t.statusA11y(w.word)}`} style={{ ...readableTextStyle(14.5), color: c.ink }}>
        {kind} · <Text style={{ ...readableTextStyle(14.5, true), color: w.tone === "ok" ? c.success : w.tone === "warn" ? c.danger : c.ink }}>{w.word}</Text>
      </Text>
    </View>
    {s.status === "PENDING" ? <Text testID="session-pending" style={{ ...readableTextStyle(15), lineHeight: lh(23), color: c.ink }}>{fighter.pendingLine}.</Text> : null}
    <View testID="session-facts">
      {facts.map(([label, value], k) => <View key={label} style={{ flexDirection: "row", justifyContent: "space-between", gap: 16, paddingVertical: 11, borderTopColor: c.line, borderTopWidth: 1, ...(k === facts.length - 1 ? { borderBottomColor: c.line, borderBottomWidth: 1 } : null) }}>
        <Text numberOfLines={1} style={{ ...readableTextStyle(14.5), color: c.ink }}>{label}</Text>
        <Text numberOfLines={1} style={{ ...readableTextStyle(14.5, true), color: c.ink, flexShrink: 1, textAlign: "right" }}>{value}</Text>
      </View>)}
    </View>
    <View testID="session-notes" style={{ gap: 8 }}>
      <Text accessibilityRole="header" style={{ fontFamily: fonts.display, fontSize: fz(18), lineHeight: lh(25), letterSpacing: 0.7, textTransform: "uppercase", color: c.ink }}>{t.coachNotes}</Text>
      {notes.length
        ? <View style={{ gap: 6 }}>{notes.map((line, i) => <Text key={i} style={{ ...readableTextStyle(15), lineHeight: lh(23), color: c.ink }}>{line}</Text>)}</View>
        : <Text style={{ ...readableTextStyle(15), color: c.ink }}>{t.noNotes}</Text>}
    </View>
  </>;
}
