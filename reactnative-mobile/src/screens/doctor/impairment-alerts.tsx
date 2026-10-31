import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useRouter, type Href } from "expo-router";

import { isApiError } from "@/api";
import { getJobHealthAlerts, listImpairmentJobs, type AnalysisJob, type JobHealthAlerts } from "@/api/media";
import { useToastMessage } from "@/components/toast/app-toast";
import { media } from "@/i18n/media";
import { DoctorCard, DoctorChrome, doctorStyles } from "@/screens/doctor/doctor-chrome";
import { type, useThemePreference } from "@/theme";

function messageFor(error: unknown): string {
  if (!isApiError(error)) return media.generic;
  if (error.status === 0 || error.code === "NETWORK_ERROR") return media.network;
  if (error.status === 403) return media.forbidden;
  if (error.status === 404) return media.notFound;
  return media.generic;
}

export function ImpairmentAlertList() {
  const { colors } = useThemePreference();
  const router = useRouter();
  const [jobs, setJobs] = useState<AnalysisJob[] | null>(null);
  const [error, setError] = useState("");
  useToastMessage(error, "error");
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

  return (
    <DoctorChrome title={media.alertsTitle}>
      <ScrollView contentContainerStyle={doctorStyles.list}>
        {loading && !jobs ? <Text style={[type.body, { color: colors.inkMuted }]}>{media.loading}</Text> : null}
        {error ? (
          <Pressable accessibilityRole="button" onPress={load}>
            <Text style={[type.link, { color: colors.lotus }]}>{media.retry}</Text>
          </Pressable>
        ) : null}
        {jobs && jobs.length === 0 ? (
          <Text style={[type.body, { color: colors.inkMuted }]}>{media.emptyAlerts}</Text>
        ) : null}
        {jobs?.map((job) => (
          <Pressable
            key={job.id}
            accessibilityRole="button"
            onPress={() => router.push(`/ai-alerts/${job.id}` as Href)}
          >
            <DoctorCard>
              <Text style={[type.body, { color: colors.ink }]}>
                {media.alerts} {job.alertCount == null ? "—" : job.alertCount} · {media.job[job.status as keyof typeof media.job] ?? job.status}
              </Text>
              {job.score != null ? (
                <Text style={[type.caption, { color: colors.inkMuted }]}>{media.score} {job.score}</Text>
              ) : null}
            </DoctorCard>
          </Pressable>
        ))}
      </ScrollView>
    </DoctorChrome>
  );
}

export function ImpairmentAlertDetail({ jobId }: { jobId: string }) {
  const { colors } = useThemePreference();
  const [data, setData] = useState<JobHealthAlerts | null>(null);
  const [error, setError] = useState("");
  useToastMessage(error, "error");
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

  return (
    <DoctorChrome title={media.alertDetailTitle}>
      <ScrollView contentContainerStyle={doctorStyles.list}>
        {loading && !data ? <Text style={[type.body, { color: colors.inkMuted }]}>{media.loading}</Text> : null}
        {error ? (
          <Pressable accessibilityRole="button" onPress={load}>
            <Text style={[type.link, { color: colors.lotus }]}>{media.retry}</Text>
          </Pressable>
        ) : null}
        {data && data.healthAlerts.length === 0 ? (
          <Text style={[type.body, { color: colors.inkMuted }]}>{media.emptyAlerts}</Text>
        ) : null}
        {data?.healthAlerts.map((alert, index) => (
          <DoctorCard key={`${alert.joint}-${alert.triggerTimeMs}-${index}`}>
            <Text style={[type.body, { color: colors.ink }]}>
              {alert.joint} · {alert.severity}
            </Text>
            <Text style={[type.caption, { color: colors.inkMuted }]}>
              {media.recommendation}: {alert.recommendation}
            </Text>
          </DoctorCard>
        ))}
      </ScrollView>
    </DoctorChrome>
  );
}
