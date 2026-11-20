import { useEffect, useMemo, useState } from "react";
import { useRouter, type Href } from "expo-router";

import { campApi } from "@/features/fight-camp/api";
import { getFighterMedical } from "@/api/medical";
import { useWeekItems, useWeekNav } from "@/components/schedule/use-week";
import { WeekSchedule } from "@/components/schedule/week-schedule";
import { boutItems, endOfDay, sessionItems, startOfDay, suspensionItems, type ScheduleItem } from "@/components/schedule/week-model";
import { scheduleText as t } from "@/i18n/schedule";
import { fighterHref } from "@/navigation/role-href";
import { listSessionsForFighter } from "@/screens/fighter/api";
import { sessionTypeLabel } from "@/screens/fighter/format";
import { useFighterId } from "@/screens/fighter/use-fighter-id";
import { SlipRow } from "@/screens/fighter/redesign/tab-page";
import { FighterTabFrame } from "@/screens/fighter/tab-bar";

/**
 * Fighter Tập (redesign 2026-11-11): own training sessions, own weigh-in and fight day, own suspension end, in the
 * shared week schedule. A not-cleared medical status shows as one red row above the week (safety, kept from before).
 */
export function FighterWeekScreen() {
  const router = useRouter();
  const { fighterId, canFetch } = useFighterId();
  const week = useWeekNav();
  const loaders = useMemo(() => [
    (days: string[]) => listSessionsForFighter({ page: 1, limit: 100, fromDate: startOfDay(days[0]), toDate: endOfDay(days[6]) })
      .then(p => sessionItems(p.data, s => sessionTypeLabel(s.sessionType))),
    (days: string[]) => campApi.list({ limit: 20, order: "desc" }).then(p => boutItems(p.data, days,
      b => t.limit(String(b.catchweightKg ?? b.weightLimitKg).replace(".", ",")), b => b.venue ?? "")),
    (days: string[]) => campApi.suspensions(fighterId ? { fighterId } : undefined).then(p => suspensionItems(p.data, days, () => "")),
  ], [fighterId]);
  const data = useWeekItems(canFetch && !!fighterId, week.days, loaders, `fighter|${fighterId ?? ""}`);
  const cleared = useTrainingCleared(canFetch ? fighterId : null);
  const open = (x: ScheduleItem) => {
    if (x.target.kind === "session") router.push(`/tap/${x.target.id}` as Href);
    else if (x.target.kind === "bout") router.push(fighterHref.bouts);
    else router.push("/(fighter)/co-the" as Href);
  };
  return <FighterTabFrame><WeekSchedule title={t.titleFighter} above={cleared === false ? <NotClearedRow onPress={() => router.push("/(fighter)/co-the" as Href)}/> : null}
    monday={week.monday} today={week.today} selected={week.selected} onSelect={week.onSelect} onWeek={week.onWeek} onToday={week.onToday}
    items={data.items} loading={data.loading} error={data.error} partial={data.partial} onRetry={data.reload} onRefresh={data.refresh} onOpen={open}/></FighterTabFrame>;
}

/** true / false from the doctor's training eligibility; null while unknown or on error (then nothing is shown). */
function useTrainingCleared(fighterId: string | null): boolean | null {
  const [cleared, setCleared] = useState<boolean | null>(null);
  useEffect(() => {
    if (!fighterId) return;
    let alive = true;
    getFighterMedical(fighterId).then(m => { if (alive) setCleared(m.eligibility.training ? !!m.eligibility.training.eligible : null); }, () => undefined);
    return () => { alive = false; };
  }, [fighterId]);
  return cleared;
}

/** Not cleared to train (step 25 sweep): a plain row like the rest, not a framed notice; it opens Cơ thể. */
function NotClearedRow({ onPress }: { onPress: () => void }) {
  return <SlipRow testID="not-cleared-row" lead="!" leadTone="warn" title={t.notCleared} line={t.notClearedHint}
    a11y={`${t.notCleared}. ${t.notClearedHint}`} onPress={onPress} last/>;
}
