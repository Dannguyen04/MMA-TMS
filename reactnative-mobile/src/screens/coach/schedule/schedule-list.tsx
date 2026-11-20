import { useMemo } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";

import { coachApi } from "@/api/coach/coach";
import { campApi } from "@/features/fight-camp/api";
import { useWeekItems, useWeekNav } from "@/components/schedule/use-week";
import { WeekSchedule } from "@/components/schedule/week-schedule";
import { boutItems, endOfDay, sessionItems, startOfDay, suspensionItems, type ScheduleItem } from "@/components/schedule/week-model";
import { coachSchedule as t } from "@/i18n/coach-schedule";
import { scheduleText } from "@/i18n/schedule";
import { vai } from "@/i18n/video-ai";
import { coachFighterHref } from "@/screens/coach/fighters/fighter-model";
import { CoachBell } from "@/screens/coach/nav/coach-unread";
import { useCoachEnabled, useFighterNames } from "@/screens/coach/readonly/use-coach";
import { Action } from "@/shared/ui/camp-ui";
import { SlipRow } from "@/screens/fighter/redesign/tab-page";
import { useAiEnabled, useJobs } from "@/screens/video-ai/ai-data";
import { useSession } from "@/session/session-context";
import { coachNewSessionHref, coachSessionHref } from "./session-model";

/**
 * Coach Lịch (redesign 2026-11-11, finished in step 18): the lit "Tạo buổi tập" button, the "Cần duyệt" row, then
 * the week strip and the day agenda. Assigned fighters' sessions, weigh-ins, fight days and suspension ends.
 */
export function CoachScheduleScreen() {
  const enabled = useCoachEnabled();
  const router = useRouter();
  const { isDemo } = useSession();
  const names = useFighterNames(enabled);
  const nameOf = (id: string | undefined) => (id && names[id]) || "";
  const week = useWeekNav();
  const loaders = useMemo(() => [
    (days: string[]) => coachApi.listSessions({ page: 1, limit: 100, fromDate: startOfDay(days[0]), toDate: endOfDay(days[6]) })
      .then(p => sessionItems(p.data, s => nameOf(s.fighterId))),
    (days: string[]) => campApi.list({ limit: 50, order: "desc" }).then(p => boutItems(p.data, days, b => nameOf(b.fighterId))),
    (days: string[]) => campApi.suspensions().then(p => suspensionItems(p.data, days, s => nameOf(s.fighterId))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [names]);
  const data = useWeekItems(enabled && !isDemo, week.days, loaders, `coach|${Object.keys(names).length}`);
  const open = (x: ScheduleItem) => {
    if (x.target.kind === "session") router.push(coachSessionHref(x.target.id));
    else if (x.target.kind === "bout") router.push({ pathname: "/(coach)/fight-camp/bout", params: { id: x.target.id, preview: "0" } } as never);
    else if (x.target.id) router.push(coachFighterHref(x.target.id));
  };
  const above = <View style={{ gap: 12 }}>
    <Action label={t.create} onPress={() => router.push(coachNewSessionHref())}/>
    <PendingReviewRow/>
  </View>;
  return <WeekSchedule title={scheduleText.titleCoach} headerRight={<CoachBell/>} above={above}
    monday={week.monday} today={week.today} selected={week.selected} onSelect={week.onSelect} onWeek={week.onWeek} onToday={week.onToday}
    items={data.items} loading={data.loading} error={data.error} partial={data.partial} onRetry={data.reload} onRefresh={data.refresh} onOpen={open}/>;
}

/** "Cần duyệt" (step 18: a row, no card): analyses waiting for the coach's review; opens that list. */
export function PendingReviewRow() {
  const enabled = useAiEnabled();
  const jobs = useJobs(enabled, true);
  const router = useRouter();
  // Until the count arrives the row shows "–" and no line, never a false "0 · Không có…" (step 25 sweep).
  const known = !!jobs.data;
  const n = jobs.data?.pending.size ?? 0;
  return <SlipRow testID="pending-review-card" lead={known ? String(n) : "–"} leadTone={known && n > 0 ? undefined : "dim"} title={t.review} line={known ? t.reviewLine(n) : undefined} a11y={known ? vai.segReviewA11y(n) : t.review} last
    onPress={() => router.navigate({ pathname: "/(coach)/video-analysis", params: { seg: "review", t: String(Date.now()) } } as never)}/>;
}
