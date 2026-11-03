import { useCallback, useEffect, useState } from "react";
import { Pressable, Text } from "react-native";
import { useRouter, type Href } from "expo-router";

import { isApiError } from "@/api";
import { getJobHealthAlerts, listImpairmentJobs, type AnalysisJob, type JobHealthAlerts } from "@/api/media";
import { formatMedicalWhen, jointLabel, severityLabel } from "@/components/medical/medical-format";
import { doctor } from "@/i18n/doctor";
import { media } from "@/i18n/media";
import { ev } from "@/i18n/video-evidence";
import { radius, type, useThemePreference } from "@/theme";
import { AI_JOB_STATUSES, type BadgeId } from "@/screens/doctor/badge-colors";
import { DoctorChrome, DoctorScroll, doctorStyles } from "@/screens/doctor/doctor-chrome";
import { ClampText, DoctorRetry, SummaryCard, useDoctorText } from "@/screens/doctor/doctor-ui";
import { StatusBadge } from "@/screens/doctor/status-badge";
import { SkeletonList } from "@/components/motion";
import { StateView } from "@/components/state-view";

function jobBadge(status: string): BadgeId | null {
  return (AI_JOB_STATUSES as readonly string[]).includes(status) ? (`aiJob.${status}` as BadgeId) : null;
}

function severityBadge(severity: string): BadgeId | null {
  if (severity === "MINOR" || severity === "MODERATE" || severity === "SEVERE" || severity === "CRITICAL") {
    return `aiSeverity.${severity}`;
  }
  return null;
}

function jobStatusLabel(status: string): string {
  if (status === "DONE") return doctor.ai.done;
  const known = media.job[status as keyof typeof media.job];
  return known ?? "—";
}

function messageFor(error: unknown): string {
  if (!isApiError(error)) return media.generic;
  if (error.status === 0 || error.code === "NETWORK_ERROR") return media.network;
  if (error.status === 403) return media.forbidden;
  if (error.status === 404) return media.notFound;
  return media.generic;
}

export function ImpairmentAlertList() {
  const t = useDoctorText();
  const router = useRouter();
  const [jobs, setJobs] = useState<AnalysisJob[] | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    void listImpairmentJobs()
      .then((rows) => {
        if (!cancelled) setJobs(rows);
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setJobs(null);
          setError(messageFor(cause));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const stop = load();
    return () => {
      stop?.();
    };
  }, [load]);

  const refresh = useCallback(async () => {
    const rows = await listImpairmentJobs();
    setJobs(rows);
    setError("");
  }, []);

  return (
    <DoctorChrome title={media.alertsTitle} back>
      <DoctorScroll contentContainerStyle={doctorStyles.list} onRefresh={refresh}>
        {loading && !jobs ? <SkeletonList rows={3} height={84} /> : null}
        <DoctorRetry error={error} onRetry={load} />
        {jobs && jobs.length === 0 ? <StateView kind="empty" compact title={media.emptyAlerts} actionLabel={media.retry} onAction={load} /> : null}
        {jobs?.map((job) => (
          <SummaryCard
            key={job.id}
            title={`${media.alerts} ${job.alertCount == null ? "" : job.alertCount}`.trim()}
            badges={
              jobBadge(job.status) ? (
                <StatusBadge id={jobBadge(job.status)!} label={jobStatusLabel(job.status)} />
              ) : jobStatusLabel(job.status) !== "—" ? (
                <Text style={t.meta}>{jobStatusLabel(job.status)}</Text>
              ) : null
            }
            meta={[formatMedicalWhen(job.createdAt), job.score != null ? `${media.score} ${job.score}` : null].filter(Boolean).join(" · ")}
            onPress={() => router.push(`/(doctor)/ai-alerts/${job.id}` as Href)}
          />
        ))}
        <Text style={t.meta}>{doctor.ai.notDiagnosis}</Text>
      </DoctorScroll>
    </DoctorChrome>
  );
}

export function ImpairmentAlertDetail({ jobId }: { jobId: string }) {
  const t = useDoctorText();
  const router = useRouter();
  const { colors } = useThemePreference();
  const [data, setData] = useState<JobHealthAlerts | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    void getJobHealthAlerts(jobId)
      .then((row) => {
        if (!cancelled) setData(row);
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setData(null);
          setError(messageFor(cause));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [jobId]);

  useEffect(() => {
    const stop = load();
    return () => {
      stop?.();
    };
  }, [load]);

  const refresh = useCallback(async () => {
    const row = await getJobHealthAlerts(jobId);
    setData(row);
    setError("");
  }, [jobId]);

  return (
    <DoctorChrome title={media.alertDetailTitle} back>
      <DoctorScroll contentContainerStyle={doctorStyles.list} onRefresh={refresh}>
        {loading && !data ? <SkeletonList rows={2} height={96} /> : null}
        <DoctorRetry error={error} onRetry={load} />
        {jobId ? (
          <Pressable
            testID="doctor-open-video"
            accessibilityRole="button"
            onPress={() => router.push(`/(doctor)/ai-alerts/xem?jobId=${encodeURIComponent(jobId)}` as Href)}
            style={({ pressed }) => ({
              minHeight: 46,
              borderRadius: radius.field,
              borderWidth: 1,
              borderColor: colors.controlBorder,
              alignItems: "center",
              justifyContent: "center",
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Text style={[type.cta, { color: colors.ink }]}>{ev.openVideo}</Text>
          </Pressable>
        ) : null}
        {data && data.healthAlerts.length === 0 ? <StateView kind="empty" compact title={media.emptyAlerts} /> : null}
        {data?.healthAlerts.map((alert, index) => (
          <SummaryCard
            key={`${alert.joint}-${alert.triggerTimeMs}-${index}`}
            title={jointLabel(alert.joint)}
            badges={
              severityBadge(alert.severity) ? (
                <StatusBadge id={severityBadge(alert.severity)!} label={severityLabel(alert.severity)} />
              ) : (
                <Text style={t.meta}>{severityLabel(alert.severity)}</Text>
              )
            }
          >
            {alert.recommendation ? <ClampText label={media.recommendation} text={alert.recommendation} /> : null}
          </SummaryCard>
        ))}
      </DoctorScroll>
    </DoctorChrome>
  );
}
