import { useCallback, useEffect } from "react";
import { Text, View } from "react-native";

import { doctorRoApi } from "@/api/doctor-ro";
import type { AnalysisJob, JobHealthAlerts } from "@/api/media";
import { Icon } from "@/components/icon";
import { RowSkeletons, StatusChip, Stack } from "@/screens/coach/readonly/ro-ui";
import { vnDate } from "@/screens/coach/readonly/ro-format";
import { TEXT } from "@/screens/fighter/bout-states";
import { useFighterPalette } from "@/screens/fighter/redesign/palette";
import { useLoad } from "@/screens/fighter/use-load";

import { aiText, clock, fighterJobs, groupAlerts, jobPhase, severityText } from "./ai-format";
import { detailError } from "./detail-format";
import { Line, SectionCard } from "./detail-ui";
import type { Bind } from "./doctor-detail-tabs";

const SEV_TONE: Record<string, "attention" | "danger"> = { medium: "attention", high: "danger", critical: "danger" };
type Row = { job: AnalysisJob; res: JobHealthAlerts | null };

/** Tab Video AI (chỉ đọc): GET /jobs/impairments lọc theo võ sĩ → GET /jobs/:id/health-alerts từng job. Không có nút Phân tích lại. */
export function AiTab({ fighterId, enabled, bind }: { fighterId: string; enabled: boolean; bind: Bind }) {
  const p = useFighterPalette();
  const on = enabled && !!fighterId;
  const load = useCallback(async (): Promise<Row[]> => {
    const jobs = fighterJobs(await doctorRoApi.listImpairments(), fighterId);
    const res = await Promise.allSettled(jobs.map((j) => doctorRoApi.getHealthAlerts(j.id)));
    return jobs.map((job, i) => ({ job, res: res[i]!.status === "fulfilled" ? (res[i] as PromiseFulfilledResult<JobHealthAlerts>).value : null }));
  }, [fighterId]);
  const data = useLoad(on, `ai:${fighterId}`, load, { keepOnError: true });
  bind("ai", data.refresh);

  const rows = data.data ?? [];
  const running = rows.some((r) => jobPhase(r.res?.status ?? r.job.status) === "running");
  // Đang phân tích: tự làm mới mỗi 15 giây khi tab đang mở.
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => void data.refresh().catch(() => undefined), 15_000);
    return () => clearInterval(t);
  }, [running, data]);

  if (data.loading && !data.data) return <RowSkeletons count={2} height={96} />;
  if (!data.data) return <SectionCard title={aiText.tab} loading={false} error={detailError(data.error)} onRetry={() => void data.reload()} empty={false} emptyText="" />;

  const done = rows.filter((r) => r.res && jobPhase(r.res.status) === "done") as { job: AnalysisJob; res: JobHealthAlerts }[];
  const groups = groupAlerts(done);
  const failed = rows.filter((r) => jobPhase(r.res?.status ?? r.job.status) === "failed");
  const missing = rows.some((r) => !r.res);

  return (
    <Stack>
      <Text style={[TEXT.detail, { color: p.ink }]}>{aiText.disclaimer}</Text>
      {rows.length === 0 ? <Text style={[TEXT.body, { color: p.ink }]}>{aiText.none}</Text> : null}
      {running ? (
        <View style={{ borderWidth: 1, borderColor: p.line, borderRadius: 12, padding: 16, flexDirection: "row", gap: 8, alignItems: "center", backgroundColor: p.surface }}>
          <Icon name="schedule" size={20} />
          <Text style={[TEXT.body, { color: p.ink, flex: 1 }]}>{aiText.running}</Text>
        </View>
      ) : null}
      {failed.map((r) => (
        <View key={r.job.id} style={{ borderWidth: 1.5, borderColor: p.danger, borderRadius: 12, padding: 16, gap: 4, backgroundColor: p.surface }}>
          <Text style={[TEXT.bodyBold, { color: p.danger }]}>{aiText.failed}</Text>
          <Line>{aiText.video(vnDate(r.job.createdAt))}</Line>
        </View>
      ))}
      {rows.length > 0 && groups.length === 0 && failed.length === 0 && !running && !missing ? (
        <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
          <Icon name="success" size={20} tone="success" />
          <Text style={[TEXT.body, { color: p.ink }]}>{aiText.noAlerts}</Text>
        </View>
      ) : null}
      {missing ? <Text style={[TEXT.body, { color: p.danger }]}>{aiText.partial}</Text> : null}
      {groups.map((g) => (
        <View key={g.joint} style={{ borderWidth: 1, borderColor: p.line, borderRadius: 12, padding: 16, gap: 8, backgroundColor: p.surface }}>
          <View style={{ flexDirection: "row", gap: 8, alignItems: "center", flexWrap: "wrap", justifyContent: "space-between" }}>
            <Text style={[TEXT.bodyBold, { color: p.ink, flexShrink: 1 }]}>{`${g.label} · ${aiText.alerts(g.items.length)}`}</Text>
            <StatusChip spec={{ label: severityText(g.worst), tone: SEV_TONE[g.worst] ?? "neutral", icon: "warning" }} />
          </View>
          {g.items.map((it, i) => (
            <View key={`${it.jobId}-${i}`} style={{ gap: 2, borderTopWidth: i ? 1 : 0, borderTopColor: p.line, paddingTop: i ? 8 : 0 }}>
              <Line>{[aiText.video(vnDate(it.jobAt)), aiText.at(clock(it.alert.triggerTimeMs))].join(" · ")}</Line>
              <Line>{[severityText(it.alert.severity), aiText.motion[it.alert.motionClass] ?? aiText.motion.UNKNOWN, aiText.rom(Math.round(it.alert.avgRomRatio * 100))].join(" · ")}</Line>
              {it.alert.recommendation ? <Line>{it.alert.recommendation}</Line> : null}
            </View>
          ))}
        </View>
      ))}
    </Stack>
  );
}
