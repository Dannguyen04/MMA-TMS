import { useCallback, useEffect } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";

import { doctorRoApi } from "@/api/doctor/doctor-ro";
import type { AnalysisJob, JobHealthAlerts } from "@/api/video/media";
import { StaggerList } from "@/components/motion";
import { doctorRest as r } from "@/i18n/doctor-rest";
import { vnDate } from "@/screens/coach/readonly/ro-format";
import { DoctorAiDisclaimer } from "@/screens/doctor/redesign/ai-disclaimer";
import { doctorVideoHref } from "@/screens/doctor/redesign/doctor-paths";
import { RetryRow, SlipRow } from "@/screens/fighter/redesign/tab-page";
import { useLoad } from "@/screens/fighter/use-load";
import { EvHead } from "@/screens/media/evidence/evidence-panels";
import { useThemePreference } from "@/theme";
import { readableTextStyle } from "@/theme/typography";

import { aiText, clock, fighterJobs, groupAlerts, jobPhase, severityText, type AlertItem } from "./ai-format";
import type { Bind } from "./doctor-detail-tabs";

type Row = { job: AnalysisJob; res: JobHealthAlerts | null };

/** One alert as a row: the moment (m:ss) as the lead, the motion, then severity · range · video date; opens the video page. */
export function AlertRow({ it, last }: { it: AlertItem; last?: boolean }) {
  const router = useRouter();
  const [min, sec] = clock(it.alert.triggerTimeMs).split(":");
  const sev = severityText(it.alert.severity);
  const motion = aiText.motion[it.alert.motionClass] ?? aiText.motion.UNKNOWN!;
  const rest = `biên độ ${Math.round(it.alert.avgRomRatio * 100)}% · video ${vnDate(it.jobAt).slice(0, 5)}`;
  return <SlipRow testID={`ai-alert-${it.jobId}-${it.alert.triggerTimeMs}`} lead={min} leadSub={`:${sec}`} title={motion}
    word={sev} wordTone={it.alert.severity === "medium" ? undefined : "warn"} line={rest}
    a11y={`${motion}, ${sev}, ${rest}`} last={last} onPress={() => router.push(doctorVideoHref(it.jobId) as never)}/>;
}

/** Load the fighter's last analyses and their alerts (GET /jobs/impairments, then /jobs/:id/health-alerts per job). */
export function useFighterAi(fighterId: string, enabled: boolean) {
  const load = useCallback(async (): Promise<Row[]> => {
    const jobs = fighterJobs(await doctorRoApi.listImpairments(), fighterId);
    const res = await Promise.allSettled(jobs.map((j) => doctorRoApi.getHealthAlerts(j.id)));
    return jobs.map((job, i) => ({ job, res: res[i]!.status === "fulfilled" ? (res[i] as PromiseFulfilledResult<JobHealthAlerts>).value : null }));
  }, [fighterId]);
  const data = useLoad(enabled && !!fighterId, `ai:${fighterId}`, load, { keepOnError: true });
  const rows = data.data ?? [];
  const done = rows.filter((x) => x.res && jobPhase(x.res.status) === "done") as { job: AnalysisJob; res: JobHealthAlerts }[];
  return {
    data, rows,
    groups: groupAlerts(done),
    running: rows.filter((x) => jobPhase(x.res?.status ?? x.job.status) === "running"),
    failed: rows.filter((x) => jobPhase(x.res?.status ?? x.job.status) === "failed"),
    missing: rows.some((x) => !x.res),
  };
}

export type FighterAi = ReturnType<typeof useFighterAi>;

/** Tab AI (redesign step 21, read only): a running row, failed rows, then one section per joint with one row per alert. */
export function AiTab({ fighterId, enabled, bind, ai: given }: { fighterId: string; enabled: boolean; bind: Bind; ai?: FighterAi }) {
  const { colors: c } = useThemePreference();
  const own = useFighterAi(fighterId, enabled && !given);
  const ai = given ?? own;
  const { data, rows, groups, running, failed, missing } = ai;
  bind("ai", data.refresh);

  // Đang phân tích: refresh every 15 s while the tab is open.
  const isRunning = running.length > 0;
  useEffect(() => {
    if (!isRunning) return;
    const id = setInterval(() => void data.refresh().catch(() => undefined), 15_000);
    return () => clearInterval(id);
  }, [isRunning, data]);

  if (data.loading && !data.data) return <ActivityIndicator color={c.lotus} style={{ paddingVertical: 32 }}/>;
  if (!data.data) return <RetryRow message={r.aiFailed} retry={r.retry} onRetry={() => void data.reload()}/>;

  const quiet = groups.length === 0 && failed.length === 0 && !isRunning && !missing;
  const top = [
    ...(isRunning ? [{ key: "run", el: (last: boolean) => <SlipRow testID="ai-running" icon="history" leadTone="dim" title={r.running} line={r.runningLine(running.length)} a11y={`${r.running}, ${r.runningLine(running.length)}`} last={last}/> }] : []),
    ...failed.map((x) => ({ key: x.job.id, el: (last: boolean) => <SlipRow testID={`ai-failed-${x.job.id}`} lead="!" leadTone="warn" title={r.failedJob} line={`video ${vnDate(x.job.createdAt).slice(0, 5)}`} a11y={`${r.failedJob}, video ${vnDate(x.job.createdAt)}`} last={last}/> })),
    ...(missing ? [{ key: "partial", el: (last: boolean) => <SlipRow testID="ai-partial" lead="!" leadTone="warn" title={r.partial} a11y={r.partial} last={last}/> }] : []),
    ...(quiet ? [{ key: "none", el: (last: boolean) => <SlipRow testID="ai-none" lead="✓" leadTone="ok" title={r.noAlerts} line={rows.length ? r.noAlertsLine(rows.length) : undefined} a11y={r.noAlerts} last={last}/> }] : []),
  ];

  return <View style={{ gap: 16 }}>
    {top.length ? <View>{top.map((x, k) => <View key={x.key}>{x.el(k === top.length - 1)}</View>)}</View> : null}
    {groups.map((g) => <View key={g.joint} style={{ gap: 4 }}>
      <EvHead title={g.label} aside={String(g.items.length)}/>
      <StaggerList testID={`ai-joint-${g.joint}`}>
        {g.items.map((it, k) => <AlertRow key={`${it.jobId}-${k}`} it={it} last={k === g.items.length - 1}/>)}
      </StaggerList>
    </View>)}
    <DoctorAiDisclaimer/>
  </View>;
}

/** Tổng quan block "Cảnh báo AI": up to 3 newest alerts as rows, then "Xem tất cả" to the AI tab. */
export function AiOverviewBlock({ fighterId, enabled, onSeeAll, ai }: { fighterId: string; enabled: boolean; onSeeAll: () => void; ai?: FighterAi }) {
  const { colors: c } = useThemePreference();
  const own = useFighterAi(fighterId, enabled && !ai);
  const { data, groups } = ai ?? own;
  const items = groups.flatMap((g) => g.items).sort((a, b) => Date.parse(b.jobAt) - Date.parse(a.jobAt) || a.alert.triggerTimeMs - b.alert.triggerTimeMs);
  const top = items.slice(0, 3);
  return <View testID="ai-overview" style={{ gap: 8 }}>
    <EvHead title={r.aiSection} aside={items.length ? String(items.length) : undefined}/>
    {data.loading && !data.data ? <ActivityIndicator color={c.lotus} style={{ paddingVertical: 16 }}/> : null}
    {data.error && !data.data ? <RetryRow message={r.aiFailed} retry={r.retry} onRetry={() => void data.reload()}/> : null}
    {data.data && !top.length ? <SlipRow testID="ai-overview-none" lead="✓" leadTone="ok" title={r.noAlerts} a11y={r.noAlerts} last/> : null}
    {top.length ? <View>{top.map((it, k) => <AlertRow key={`${it.jobId}-${k}`} it={it} last={k === top.length - 1}/>)}</View> : null}
    {data.data ? <Pressable testID="ai-see-all" accessibilityRole="button" onPress={onSeeAll} style={{ minHeight: 44, justifyContent: "center", alignSelf: "flex-start" }}>
      <Text style={{ ...readableTextStyle(14.5, true), color: c.lotus }}>{r.seeAll}</Text>
    </Pressable> : null}
  </View>;
}
