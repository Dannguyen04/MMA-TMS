import { ActivityIndicator, Text, View } from "react-native";
import { useRouter, type Href } from "expo-router";

import { campApi } from "@/api/fight-camp";
import type { TrainingPlan, TrainingSession } from "@/api/types";
import { FadeInView } from "@/components/motion";
import { dateKey, endOfDay, startOfDay, addDays } from "@/components/schedule/week-model";
import { fighterPlans as t } from "@/i18n/fighter-plans";
import { useSource, type Source } from "@/screens/coach/today/coach-today-screen";
import { Action } from "@/screens/fight-camp/camp-ui";
import { listPlansForFighter, listSessionsForFighter } from "@/screens/fighter/api";
import { planStatusLabel, sessionTypeLabel } from "@/screens/fighter/format";
import { nearestBout } from "@/screens/fighter/home/fighter-home-model";
import { FighterTabPage, RetryRow, SlipRow } from "@/screens/fighter/redesign/tab-page";
import { useFighterId } from "@/screens/fighter/use-fighter-id";
import { planPhaseWord } from "@/training/plan-phase";
import { useThemePreference } from "@/theme";
import { fonts, readableTextStyle, fz, lh } from "@/theme/typography";
import { currentPlan, dm, dmy, nextPlanSession, planWeek, rowLead, shortRange } from "./plans-model";

const LIBRARY = "/giao-an/bai-tap" as Href;
const planHref = (id: string) => `/giao-an/${id}` as Href;
const WEEK_TICKS_MAX = 16;

/**
 * Fighter Giáo án (redesign step 9): the current plan as the one spotlight (bout-linked first), the other plans as
 * one-line rows, then the exercise library row.
 */
export function FighterPlansTab() {
  const router = useRouter();
  const { fighterId, canFetch } = useFighterId();
  const key = `${canFetch}-${fighterId}`;
  const today = dateKey(new Date());
  const [plans, reloadPlans, refreshPlans] = useSource<TrainingPlan[]>(
    () => canFetch && fighterId ? listPlansForFighter(fighterId, { page: 1, limit: 50 }).then(p => p.data) : Promise.resolve([]), key);
  const [bouts, reloadBouts, refreshBouts] = useSource(() => canFetch ? campApi.list({ limit: 20, order: "desc" }).then(p => p.data) : Promise.resolve([]), key);
  const [sessions, reloadSessions, refreshSessions] = useSource<TrainingSession[]>(() => canFetch
    ? listSessionsForFighter({ page: 1, limit: 100, fromDate: startOfDay(today), toDate: endOfDay(addDays(today, 60)) }).then(p => p.data)
    : Promise.resolve([]), key);

  const bout = bouts.state === "ok" ? nearestBout(bouts.data) : null;
  const list = plans.state === "ok" ? plans.data : [];
  const current = plans.state === "ok" && bouts.state !== "loading" ? currentPlan(list, !!bout) : null;
  const others = list.filter(p => p.id !== current?.id && p.status !== "DRAFT")
    .sort((a, b) => Number(b.status === "ACTIVE") - Number(a.status === "ACTIVE") || b.startDate.localeCompare(a.startDate));

  return <FighterTabPage testID="fighter-plans" title={t.title} onRefresh={() => Promise.all([refreshPlans(), refreshBouts(), refreshSessions()])}>
    <FadeInView index={0}>
      <Spotlight plans={plans} bouts={bouts.state} current={current} boutAt={current && bout && isBoutPhase(current.phase) ? bout.boutAt : null}
        sessions={sessions.state === "ok" ? sessions.data : null} today={today} onRetry={() => { reloadPlans(); reloadBouts(); reloadSessions(); }} onOpen={id => router.push(planHref(id))}/>
    </FadeInView>
    <FadeInView index={1}><View>
      {others.map(p => {
        const lead = rowLead(p, today);
        const line = [planStatusLabel(p.status), planPhaseWord(p.phase), shortRange(p)].filter(Boolean).join(" · ");
        return <SlipRow key={p.id} testID={`plan-${p.id}`} lead={lead.text} leadSub={lead.sub} leadTone={lead.done ? "ok" : undefined}
          title={p.title} line={line} a11y={t.rowA11y(p.title, line)} onPress={() => router.push(planHref(p.id))}/>;
      })}
      <SlipRow testID="plans-library" icon="exercise" title={t.library} line={t.libraryLine} a11y={t.library} onPress={() => router.push(LIBRARY)} last/>
    </View></FadeInView>
  </FighterTabPage>;
}

const isBoutPhase = (phase: string) => phase === "fight_camp" || phase === "taper" || phase === "rehab";

function Spotlight({ plans, bouts, current, boutAt, sessions, today, onRetry, onOpen }: {
  plans: Source<TrainingPlan[]>; bouts: Source<unknown>["state"]; current: TrainingPlan | null; boutAt: string | null;
  sessions: TrainingSession[] | null; today: string; onRetry: () => void; onOpen: (id: string) => void;
}) {
  const { colors: c } = useThemePreference();
  if (plans.state === "loading" || (plans.state === "ok" && bouts === "loading")) return <ActivityIndicator color={c.lotus} style={{ paddingVertical: 40 }}/>;
  if (plans.state === "error") return <View testID="plans-failed"><RetryRow message={t.failed} retry={t.retry} onRetry={onRetry}/></View>;
  if (!current) return <Text testID="plans-none" style={{ fontFamily: fonts.display, fontSize: fz(24), lineHeight: lh(33), letterSpacing: 0.4, textTransform: "uppercase", color: c.ink }}>{t.none}</Text>;

  const week = planWeek(current, today);
  const next = sessions ? nextPlanSession(sessions, current.id, new Date()) : null;
  const progress = current.progress;
  // Step 14: on the page, no frame (the framed spotlight belongs to Trang chủ only).
  return <View testID="plans-current">
    <Text numberOfLines={2} style={{ fontFamily: fonts.display, fontSize: fz(30), lineHeight: lh(41), letterSpacing: 0.4, textTransform: "uppercase", color: c.ink }}>{current.title}</Text>
    <Text numberOfLines={1} style={{ ...readableTextStyle(14), color: c.inkMuted }}>
      <Text style={{ ...readableTextStyle(14, true), color: c.ink }}>{planPhaseWord(current.phase)}</Text>{boutAt ? ` · ${t.forBout(dm(boutAt))}` : ""}
    </Text>
    {week ? <>
      <View accessible accessibilityLabel={t.weekA11y(week.now, week.total)} style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 14, marginBottom: 6 }}>
        <Text style={{ fontFamily: fonts.displayExtraBold, fontSize: fz(68), lineHeight: lh(68), color: c.ink }}>{week.now}</Text>
        <Text style={{ fontFamily: fonts.displaySemi, fontSize: fz(22), lineHeight: lh(30), textTransform: "uppercase", color: c.ink }}>{t.weekOf(week.total)}</Text>
      </View>
      {week.total <= WEEK_TICKS_MAX ? <View testID="plan-weeks" aria-hidden={true} importantForAccessibility="no-hide-descendants" style={{ flexDirection: "row", gap: 4, marginTop: 2, marginBottom: 10 }}>
        {Array.from({ length: week.total }, (_, k) => <View key={k} style={{ flex: 1, height: 6, backgroundColor: k + 1 === week.now ? c.lotus : k + 1 < week.now ? c.inkMuted : c.surfaceMuted }}/>)}
      </View> : null}
    </> : <View style={{ height: 12 }}/>}
    {progress?.totalSessions ? <Fact label={t.sessionsDone} value={`${progress.completedSessions} / ${progress.totalSessions}`}/> : null}
    <Fact label={t.nextSession} value={next ? `${dowShort(next.scheduledAt)} ${hhmm(next.scheduledAt)} · ${sessionTypeLabel(next.sessionType)}` : t.noNextSession}/>
    <Fact label={t.ends} value={current.endDate ? dmy(current.endDate) : t.noEnd}/>
    <View style={{ marginTop: 12 }}><Action label={t.open} onPress={() => onOpen(current.id)}/></View>
  </View>;
}

function Fact({ label, value }: { label: string; value: string }) {
  const { colors: c } = useThemePreference();
  return <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 16, paddingVertical: 9, borderTopColor: c.line, borderTopWidth: 1 }}>
    <Text numberOfLines={1} style={{ ...readableTextStyle(14), color: c.inkMuted }}>{label}</Text>
    <Text numberOfLines={1} style={{ ...readableTextStyle(14, true), color: c.ink, flexShrink: 1 }}>{value}</Text>
  </View>;
}

/** Academy time (UTC+7), as on the other fighter screens. */
const local = (iso: string) => new Date(Date.parse(iso) + 7 * 3_600_000);
const DOW = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
const dowShort = (iso: string) => DOW[local(iso).getUTCDay()];
const hhmm = (iso: string) => local(iso).toISOString().slice(11, 16);

