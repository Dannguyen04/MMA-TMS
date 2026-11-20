import { useCallback, useRef, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";

import { coachApi } from "@/api/coach/coach";
import type { SessionStatusValue } from "@/api/medical/one-tap.types";
import type { TrainingSession } from "@/api/types";
import { StaggerList } from "@/components/motion";
import { EmptyLine, RolePage } from "@/components/role-page";
import { coachSchedule as t } from "@/i18n/coach-schedule";
import { coachFighterHref, fighterLine, statusMark, whenLine } from "@/screens/coach/fighters/fighter-model";
import { coachPlanHref } from "@/screens/coach/plans/plan-model";
import { fighterName, planPct } from "@/screens/coach/readonly/ro-format";
import { useSource } from "@/screens/coach/today/coach-today-screen";
import { Action, sentences } from "@/shared/ui/camp-ui";
import { RetryRow, SlipRow } from "@/screens/fighter/redesign/tab-page";
import { useSessionActions } from "@/screens/one-tap/status-actions";
import { MoreMenu } from "@/screens/one-tap/video-actions";
import { useThemePreference } from "@/theme";
import { fonts, readableTextStyle, fz, lh } from "@/theme/typography";
import { coachSessionEditHref, minutes, sessionStatusWord } from "./session-model";
import { ot } from "@/i18n/one-tap";

async function loadSession(id: string) {
  const session = await coachApi.getSession(id);
  const [fighter, plan] = await Promise.all([
    coachApi.getFighter(session.fighterId).catch(() => null),
    session.planId ? coachApi.getPlan(session.planId).catch(() => null) : Promise.resolve(null),
  ]);
  return { session, fighter, plan };
}

/**
 * Buổi tập (redesign step 18): the one session page for the coach. It replaced the read-only `schedule/chi-tiet` and
 * the form page `schedule/[id]`. Top: title, fighter · type · status word, three numbers (planned or actual minutes,
 * rounds, RPE). Then time, place, notes and rows to the fighter, the plan and "Sửa buổi tập". The next move (Bắt đầu
 * buổi → Hoàn thành buổi) is the pinned lit button; "⋯" holds Bỏ buổi, Kết thúc dở and Hủy buổi (one-tap sheets).
 */
export function CoachSessionPage() {
  const router = useRouter();
  const { colors: c } = useThemePreference();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const sessionId = typeof id === "string" ? id : "";
  const [src, reload, refresh] = useSource(() => sessionId ? loadSession(sessionId) : Promise.resolve(null), `session|${sessionId}`);
  const [override, setOverride] = useState<SessionStatusValue | null>(null);
  const back = () => (router.canGoBack() ? router.back() : router.replace("/(coach)/schedule" as never));

  // Coming back from "Sửa buổi tập" shows what was saved there.
  const seen = useRef(false);
  useFocusEffect(useCallback(() => {
    if (!seen.current) { seen.current = true; return; }
    void refresh();
  }, [refresh]));

  const loaded = src.state === "ok" ? src.data : null;
  const s = loaded ? { ...loaded.session, ...(override ? { status: override } : null) } as TrainingSession : null;
  const actions = useSessionActions({
    sessionId,
    status: (s?.status ?? "COMPLETED") as SessionStatusValue,
    onChanged: next => setOverride(next),
    onReload: () => { setOverride(null); reload(); },
    onOpenMedical: () => { if (s) router.push(coachFighterHref(s.fighterId, "medical")); },
  });
  const pull = () => refresh().then(() => setOverride(null));
  const notFound = !sessionId || (src.state === "ok" && !loaded);
  const footer = s && actions.primaryTo
    ? <View style={{ gap: 6 }}>
      <Action label={actions.primaryTo === "IN_PROGRESS" ? ot.sessionStart : ot.sessionComplete} pending={actions.primaryPending} disabled={actions.sending && !actions.primaryPending} onPress={actions.runPrimary}/>
      {actions.forbidden ? <Text testID="session-forbidden" style={{ ...readableTextStyle(14, true), color: c.danger }}>{actions.forbidden}</Text> : null}
    </View>
    : undefined;

  return <RolePage testID="coach-session-page" title={t.page} onBack={back} onRefresh={sessionId ? pull : undefined} footer={footer}
    right={s && actions.more.length ? <MoreMenu items={actions.more}/> : undefined}>
    {src.state === "loading" && sessionId ? <ActivityIndicator color={c.lotus} style={{ paddingVertical: 40 }}/> : null}
    {src.state === "error" ? <RetryRow message={t.loadFailed} retry={t.retry} onRetry={reload}/> : null}
    {notFound ? <EmptyLine title={t.notFound} line={t.notFoundLine}/> : null}
    {s && loaded ? <>
      <Top s={s} fighter={loaded.fighter ? fighterName(loaded.fighter) : ""}/>
      <View testID="session-facts">
        <Fact label={t.when} value={whenLine(s.scheduledAt)} last={!s.location && !s.cancellationReason}/>
        {s.location ? <Fact label={t.where} value={s.location} last={!s.cancellationReason}/> : null}
        {s.cancellationReason ? <Fact label={t.cancelReason} value={s.cancellationReason} last/> : null}
      </View>
      <View style={{ gap: 8 }}>
        <Text accessibilityRole="header" style={{ fontFamily: fonts.display, fontSize: fz(18), lineHeight: lh(25), letterSpacing: 0.7, textTransform: "uppercase", color: c.ink }}>{t.notes}</Text>
        {s.coachNotes
          ? <View style={{ gap: 6 }}>{sentences(s.coachNotes).map((line, i) => <Text key={i} style={{ ...readableTextStyle(15), lineHeight: lh(23), color: c.ink }}>{line}</Text>)}</View>
          : <Text style={{ ...readableTextStyle(15), color: c.ink }}>{t.noNotes}</Text>}
      </View>
      <StaggerList>
        {loaded.fighter ? (() => {
          const f = loaded.fighter;
          const m = statusMark(f.currentMedicalStatus);
          const name = fighterName(f);
          return <SlipRow testID="session-fighter" lead={m.lead} icon={m.icon} leadTone={m.tone} title={name} word={m.word} wordTone={m.wordTone} line={fighterLine(f)}
            a11y={`${name}, ${m.word}`} onPress={() => router.push(coachFighterHref(f.id))}/>;
        })() : null}
        {loaded.plan ? <SlipRow testID="session-plan" lead={loaded.plan.progress?.totalSessions ? String(planPct(loaded.plan)) : "–"} leadSub={loaded.plan.progress?.totalSessions ? "%" : undefined}
          leadTone={loaded.plan.progress?.totalSessions ? undefined : "dim"} title={loaded.plan.title}
          line={t.planLine(loaded.plan.progress?.completedSessions, loaded.plan.progress?.totalSessions)} a11y={`${t.plan}: ${loaded.plan.title}`}
          onPress={() => router.push(coachPlanHref(loaded.plan!.id))}/> : null}
        <SlipRow testID="session-edit" icon="edit" title={t.edit} line={t.editLine} a11y={t.edit} last onPress={() => router.push(coachSessionEditHref(s.id))}/>
      </StaggerList>
    </> : null}
    {actions.sheets}
  </RolePage>;
}

function Top({ s, fighter }: { s: TrainingSession; fighter: string }) {
  const { colors: c } = useThemePreference();
  const w = sessionStatusWord(s.status);
  const done = s.actualDurationSec != null;
  const mins = minutes(done ? s.actualDurationSec : s.plannedDurationSec);
  const rest = [fighter, t.types[s.sessionType]].filter(Boolean).join(" · ");
  const stats: [string, string, string][] = [
    [mins != null ? String(mins) : "–", mins != null ? t.min : "", done ? t.actual : t.planned],
    [String(s.roundCount), "", t.rounds],
    [s.reportedRpe != null ? String(s.reportedRpe) : "–", s.reportedRpe != null ? "/10" : "", t.rpe],
  ];
  return <View style={{ gap: 12 }}>
    <View style={{ gap: 3 }}>
      <Text accessibilityRole="header" numberOfLines={1} style={{ fontFamily: fonts.displayExtraBold, fontSize: fz(26), lineHeight: lh(36), textTransform: "uppercase", color: c.ink }}>{s.title}</Text>
      <Text testID="session-line" numberOfLines={1} accessibilityLabel={`${rest}. ${t.statusA11y(w.word)}`} style={{ ...readableTextStyle(14.5), color: c.ink }}>
        {rest ? `${rest} · ` : ""}<Text style={{ ...readableTextStyle(14.5, true), color: w.tone === "ok" ? c.success : w.tone === "warn" ? c.danger : c.ink }}>{w.word}</Text>
      </Text>
    </View>
    <View testID="session-stats" style={{ flexDirection: "row", borderTopColor: c.line, borderTopWidth: 1, borderBottomColor: c.line, borderBottomWidth: 1 }}>
      {stats.map(([v, u, l], k) => <View key={l} accessible accessibilityLabel={`${l}: ${v} ${u}`.trim()} style={{ flex: 1, minWidth: 0, alignItems: "center", paddingVertical: 12, paddingHorizontal: 4, ...(k ? { borderLeftColor: c.line, borderLeftWidth: 1 } : null) }}>
        <Text numberOfLines={1} style={{ fontFamily: fonts.displayExtraBold, fontSize: fz(26), lineHeight: lh(30), color: c.ink }}>{v}{u ? <Text style={{ fontSize: fz(13) }}>{u === t.min ? ` ${u}` : u}</Text> : null}</Text>
        <Text numberOfLines={1} style={{ ...readableTextStyle(12.5), color: c.ink, marginTop: 2 }}>{l}</Text>
      </View>)}
    </View>
  </View>;
}

function Fact({ label, value, last }: { label: string; value: string; last?: boolean }) {
  const { colors: c } = useThemePreference();
  return <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 16, paddingVertical: 11, borderTopColor: c.line, borderTopWidth: 1, ...(last ? { borderBottomColor: c.line, borderBottomWidth: 1 } : null) }}>
    <Text numberOfLines={1} style={{ ...readableTextStyle(14.5), color: c.ink }}>{label}</Text>
    <Text numberOfLines={1} style={{ ...readableTextStyle(14.5, true), color: c.ink, flexShrink: 1, textAlign: "right" }}>{value}</Text>
  </View>;
}
