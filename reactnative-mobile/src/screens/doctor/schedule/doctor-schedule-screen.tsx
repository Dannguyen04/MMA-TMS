import { useMemo } from "react";
import { useRouter } from "expo-router";

import { scheduleApi } from "@/api/doctor/schedule";
import { useWeekItems, useWeekNav } from "@/components/schedule/use-week";
import { WeekSchedule } from "@/components/schedule/week-schedule";
import { doctorItems, type ScheduleItem } from "@/components/schedule/week-model";
import { scheduleText as t } from "@/i18n/schedule";
import { useSession } from "@/session/session-context";

/**
 * Doctor Lịch (redesign 2026-11-11): follow-up exams, clearance expiries, assigned fighters' weigh-ins and fights,
 * suspension ends, from one read (GET /doctor/schedule). Every item opens the fighter.
 */
export function DoctorScheduleScreen() {
  const router = useRouter();
  const { isDemo } = useSession();
  const week = useWeekNav();
  const loaders = useMemo(() => [
    (days: string[]) => scheduleApi.doctor(days[0], days[6]).then(r => doctorItems(r.items)),
  ], []);
  const data = useWeekItems(!isDemo, week.days, loaders, "doctor");
  const open = (x: ScheduleItem) => {
    if (x.target.id) router.push({ pathname: "/(doctor)/vo-si/chi-tiet", params: { id: x.target.id } } as never);
  };
  return <WeekSchedule title={t.titleDoctor}
    monday={week.monday} today={week.today} selected={week.selected} onSelect={week.onSelect} onWeek={week.onWeek} onToday={week.onToday}
    items={data.items} loading={data.loading} error={data.error} partial={data.partial} onRetry={data.reload} onRefresh={data.refresh} onOpen={open}/>;
}
