import { useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { ANALYSIS_JOB_STATUSES, listAnalysisJobs, type AnalysisJob } from "@/api/media";
import { Icon } from "@/components/icon";
import { FadeInView, SkeletonList } from "@/components/motion";
import { StateView } from "@/components/state-view";
import { useToastMessage } from "@/components/toast/app-toast";
import { manager } from "@/i18n/manager";
import { states } from "@/i18n/unavailable";
import { useAdminType } from "@/screens/admin/admin-page";
import { AdminScreen, AdminTag } from "@/screens/admin/admin-ui";
import { mapApiMessage } from "@/session/map-api-message";
import { radius, spacing, useThemePreference } from "@/theme";
import { FilterSelect } from "@/components/filter-sheet";

const t = manager.jobs;
type Filter = "ALL" | (typeof ANALYSIS_JOB_STATUSES)[number];
const FILTERS: readonly { value: Filter; label: string }[] = [
  { value: "ALL", label: t.statusAll },
  ...ANALYSIS_JOB_STATUSES.map((value) => ({ value: value as Filter, label: t.status[value] ?? value })),
];

function statusTone(status: string): "muted" | "accent" | "danger" | "success" {
  if (status === "DONE") return "success";
  if (status === "FAILED") return "danger";
  if (status === "PROCESSING") return "accent";
  return "muted";
}

function formatTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" });
}

/** Tác vụ AI — GET /jobs (chỉ đọc; backend trả tối đa 100 tác vụ trong phạm vi tài khoản). */
export function AdminJobsScreen() {
  const { colors } = useThemePreference();
  const at = useAdminType();
  const [filter, setFilter] = useState<Filter>("ALL");
  const [jobs, setJobs] = useState<AnalysisJob[] | null>(null);
  const [error, setError] = useState("");
  useToastMessage(error, "error");

  const load = useCallback((mode: "initial" | "refresh" = "initial") => {
    if (mode === "initial") setError("");
    return listAnalysisJobs()
      .then(setJobs)
      .catch((cause: unknown) => {
        if (mode === "refresh") throw cause;
        setJobs((current) => current ?? []);
        setError(mapApiMessage(cause));
      });
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(() => (jobs ?? []).filter((job) => filter === "ALL" || job.status === filter), [jobs, filter]);

  return (
    <AdminScreen title={t.title} onRefresh={load}>
      <View style={styles.lead}>
        <Text style={[at.section, { color: colors.ink }]}>{jobs && !error ? t.count(visible.length) : t.title}</Text>
        <Text style={[at.meta, { color: colors.inkMuted }]}>{t.hint}</Text>
      </View>
      <FilterSelect label="Trạng thái" options={FILTERS} value={filter} allValue="ALL" onChange={setFilter} />
      {jobs == null ? <SkeletonList rows={4} height={88} /> : null}
      {jobs && jobs.length === 0 && error ? (
        <StateView kind="error" title={states.loadFailed} description={error} actionLabel={states.retry} onAction={load} compact />
      ) : null}
      {jobs && !error && visible.length === 0 ? <StateView kind="empty" title={t.empty} compact /> : null}
      {visible.length > 0 ? (
        <View style={styles.list}>
          {visible.map((job, index) => (
            <FadeInView key={job.id} index={index}>
              <View
                accessible
                accessibilityLabel={`${t.status[job.status] ?? job.status}, ${formatTime(job.createdAt)}`}
                style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.line }]}
              >
                <View style={styles.top}>
                  <Icon name="aiJobs" size={20} tone="accent" />
                  <Text style={[at.metaStrong, styles.flex, { color: colors.ink }]} numberOfLines={1}>
                    #{job.id.slice(0, 8)}
                  </Text>
                  <AdminTag label={t.status[job.status] ?? job.status} tone={statusTone(job.status)} />
                </View>
                <Text style={[at.meta, { color: colors.inkMuted }]}>
                  {t.created}: {formatTime(job.createdAt)}
                  {job.videoId ? ` · ${t.video} #${job.videoId.slice(0, 8)}` : ""}
                </Text>
                <View style={styles.tags}>
                  {job.score != null ? <AdminTag label={`${t.score}: ${Math.round(job.score * 10) / 10}`} /> : null}
                  {job.alertCount != null ? <AdminTag label={t.alerts(job.alertCount)} tone={job.alertCount > 0 ? "accent" : "muted"} /> : null}
                  {job.hasImpairment ? <AdminTag label={t.impairment} tone="danger" /> : null}
                </View>
              </View>
            </FadeInView>
          ))}
        </View>
      ) : null}
    </AdminScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  lead: { gap: spacing.xs },
  list: { gap: spacing.md },
  card: { borderRadius: radius.field, borderWidth: StyleSheet.hairlineWidth, padding: spacing.lg, gap: spacing.sm },
  top: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
});
