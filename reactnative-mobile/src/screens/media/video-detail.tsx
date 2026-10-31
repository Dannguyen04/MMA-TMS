import { Ionicons } from "@expo/vector-icons";
import { useVideoPlayer, VideoView } from "expo-video";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { API_BASE_URL, isApiError, loadStoredSession } from "@/api";
import { useToastMessage } from "@/components/toast/app-toast";
import { getMemorySession } from "@/api/tokens";
import {
  createAnalysisJob,
  getAnalysisJob,
  getVideo,
  listAnalysisJobs,
  type AnalysisJob,
  type VideoRecord,
} from "@/api/media";
import { media } from "@/i18n/media";
import { useFighterPalette } from "@/screens/fighter/redesign/palette";
import { VideoScreenHeader } from "@/screens/media/video-chrome";
import {
  analysisPanel,
  angleLabel,
  formatClock,
  formatVideoDate,
  jobForVideo,
  trainingLabel,
  warningText,
  type MediaPhase,
} from "@/screens/media/video-model";
import { useTypography } from "@/theme";

function messageFor(error: unknown): string {
  if (!isApiError(error)) return media.generic;
  if (error.status === 0 || error.code === "NETWORK_ERROR") return media.network;
  if (error.status === 403) return media.forbidden;
  if (error.status === 404) return media.notFound;
  if (error.code === "VIDEO_JOB_EXISTS") return error.message;
  return media.generic;
}

function AuthedPlayer({ uri, token }: { uri: string; token: string }) {
  const colors = useFighterPalette();
  const well = colors.scheme === "light" ? colors.ink : colors.bg;
  const onWell = colors.scheme === "light" ? colors.bg : colors.ink;
  const [phase, setPhase] = useState<MediaPhase>("loading");
  const [clock, setClock] = useState("0:00");
  const player = useVideoPlayer({ uri, headers: { Authorization: `Bearer ${token}` } }, (instance) => {
    instance.pause();
    instance.timeUpdateEventInterval = 0.25;
  });

  useEffect(() => {
    const statusSub = player.addListener("statusChange", (event) => {
      if (event.status === "readyToPlay") setPhase("ready");
      else if (event.status === "error") setPhase("error");
      else setPhase("loading");
    });
    const timeSub = player.addListener("timeUpdate", (event) => {
      setClock(formatClock(event.currentTime));
    });
    return () => {
      statusSub.remove();
      timeSub.remove();
      player.pause();
    };
  }, [player]);

  return (
    <View style={[styles.player, { backgroundColor: well }]}>
      <VideoView player={player} style={styles.video} nativeControls contentFit="contain" />
      {phase === "loading" ? (
        <View style={styles.mediaOverlay} pointerEvents="none">
          <ActivityIndicator color={onWell} />
          <Text style={{ color: onWell, fontSize: 13 }}>{media.mediaLoading}</Text>
        </View>
      ) : null}
      {phase === "error" ? (
        <View style={styles.mediaOverlay} pointerEvents="none">
          <Text style={{ color: onWell, fontSize: 13 }}>{media.mediaError}</Text>
        </View>
      ) : null}
      {phase !== "ready" ? (
        <View style={styles.controls} pointerEvents="none">
          <View style={styles.controlRow}>
            <Ionicons name="play" size={18} color={onWell} accessibilityLabel={media.play} />
            <Text style={[styles.clock, { color: onWell }]}>{clock}</Text>
            <Ionicons name="volume-high" size={18} color={onWell} accessibilityLabel={media.volume} />
            <Ionicons name="scan-outline" size={18} color={onWell} accessibilityLabel={media.fullscreen} />
          </View>
          <View
            accessibilityLabel={media.seek}
            style={[styles.track, { backgroundColor: onWell, opacity: 0.35 }]}
          />
        </View>
      ) : null}
    </View>
  );
}

export function VideoDetailContent({
  videoId,
  canRequestAnalysis,
  onBack,
}: {
  videoId: string;
  canRequestAnalysis: boolean;
  onBack: () => void;
}) {
  const colors = useFighterPalette();
  const live = useTypography();
  const insets = useSafeAreaInsets();
  const [video, setVideo] = useState<VideoRecord | null>(null);
  const [job, setJob] = useState<AnalysisJob | null>(null);
  const [recordError, setRecordError] = useState("");
  const [analysisError, setAnalysisError] = useState("");
  const [recordLoading, setRecordLoading] = useState(true);
  const [analysisLoading, setAnalysisLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  useToastMessage(recordError, "error");
  useToastMessage(analysisError, "error");
  useToastMessage(actionError, "error");
  const [token, setToken] = useState<string | null>(null);
  const [tokenReady, setTokenReady] = useState(false);

  const loadRecord = useCallback(() => {
    let cancelled = false;
    setRecordLoading(true);
    setRecordError("");
    void getVideo(videoId)
      .then((row) => {
        if (!cancelled) setVideo(row);
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setVideo(null);
        setRecordError(messageFor(cause));
      })
      .finally(() => {
        if (!cancelled) setRecordLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [videoId]);

  const loadAnalysis = useCallback(() => {
    let cancelled = false;
    setAnalysisLoading(true);
    setAnalysisError("");
    void listAnalysisJobs()
      .then(async (jobs) => {
        if (cancelled) return;
        const match = jobForVideo(jobs, videoId);
        if (!match) {
          setJob(null);
          return;
        }
        const fresh = await getAnalysisJob(match.id);
        if (!cancelled) setJob(fresh);
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setJob(null);
        setAnalysisError(messageFor(cause));
      })
      .finally(() => {
        if (!cancelled) setAnalysisLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [videoId]);

  useFocusEffect(
    useCallback(() => {
      const stopRecord = loadRecord();
      const stopAnalysis = loadAnalysis();
      return () => {
        stopRecord?.();
        stopAnalysis?.();
      };
    }, [loadAnalysis, loadRecord]),
  );

  useEffect(() => {
    let cancelled = false;
    void (getMemorySession()?.accessToken
      ? Promise.resolve(getMemorySession()?.accessToken ?? null)
      : loadStoredSession().then((session) => session?.accessToken ?? null)
    ).then((value) => {
      if (cancelled) return;
      setToken(value);
      setTokenReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [videoId]);

  const onAnalyze = () => {
    if (!canRequestAnalysis || busy) return;
    setBusy(true);
    setActionError("");
    void createAnalysisJob(videoId)
      .then(() => loadAnalysis())
      .catch((cause: unknown) => setActionError(messageFor(cause)))
      .finally(() => setBusy(false));
  };

  const panel = analysisPanel(analysisError ? null : job);
  const when = video ? formatVideoDate(video.createdAt) : "";

  return (
    <View style={styles.flex}>
      <VideoScreenHeader title={media.detailTitle} onBack={onBack} />
      <ScrollView contentContainerStyle={[styles.pad, { paddingBottom: insets.bottom + 24 }]}>
        {recordLoading && !video ? <Text style={{ color: colors.muted }}>{media.loading}</Text> : null}
        {recordError ? (
          <Pressable accessibilityRole="button" accessibilityLabel={media.retry} onPress={loadRecord}>
            <Text style={{ color: colors.accent, fontWeight: "700" }}>{media.retry}</Text>
          </Pressable>
        ) : null}
        {video ? (
          <>
            <View style={styles.identity}>
              <Text style={[styles.title, { color: colors.ink, fontFamily: live.faces.bold }]}>{video.title}</Text>
              {when ? <Text style={{ color: colors.muted, fontSize: 13 }}>{when}</Text> : null}
            </View>
            {token ? (
              <AuthedPlayer uri={`${API_BASE_URL}${video.sourceUrl}`} token={token} />
            ) : (
              <View style={[styles.player, styles.mediaFallback, { backgroundColor: colors.scheme === "light" ? colors.ink : colors.bg }]}>
                <Text style={{ color: colors.scheme === "light" ? colors.bg : colors.ink }}>
                  {tokenReady ? media.mediaAuth : media.mediaLoading}
                </Text>
              </View>
            )}
            <View style={[styles.meta, { borderBottomColor: colors.line }]}>
              <View style={styles.metaCol}>
                <Text style={{ color: colors.muted, fontSize: 12 }}>{media.trainingType}</Text>
                <Text style={{ color: colors.ink, fontFamily: live.faces.semibold, fontSize: 14 }}>
                  {trainingLabel(video.trainingType)}
                </Text>
              </View>
              <View style={styles.metaCol}>
                <Text style={{ color: colors.muted, fontSize: 12 }}>{media.cameraAngle}</Text>
                <Text style={{ color: colors.ink, fontFamily: live.faces.semibold, fontSize: 14 }}>
                  {angleLabel(video.cameraAngle)}
                </Text>
              </View>
            </View>
            {video.description ? <Text style={{ color: colors.ink }}>{video.description}</Text> : null}
            <View style={styles.analysis}>
              <Text style={[styles.section, { color: colors.ink, fontFamily: live.faces.semibold }]}>{media.analysis}</Text>
              {analysisLoading && !job && !analysisError ? (
                <Text style={{ color: colors.muted }}>{media.loading}</Text>
              ) : null}
              {analysisError ? (
                <Pressable accessibilityRole="button" onPress={loadAnalysis}>
                  <Text style={{ color: colors.accent, fontWeight: "700" }}>{media.retry}</Text>
                </Pressable>
              ) : null}
              {!analysisLoading && !analysisError && panel.missing ? (
                <Text style={{ color: colors.muted }}>{media.noJob}</Text>
              ) : null}
              {!analysisError && !panel.missing && panel.status ? (
                <View style={[styles.summary, { backgroundColor: colors.bg }]}>
                  <View style={[styles.summaryRow, { borderBottomColor: colors.line }]}>
                    <Text style={{ color: colors.muted, fontSize: 14 }}>{media.status}</Text>
                    <View
                      style={[
                        styles.badge,
                        {
                          backgroundColor:
                            panel.status.tone === "success"
                              ? colors.successSoft
                              : panel.status.tone === "danger"
                                ? colors.warningSoft
                                : colors.surface2,
                        },
                      ]}
                    >
                      <Ionicons
                        name={
                          panel.status.tone === "success"
                            ? "checkmark-circle"
                            : panel.status.tone === "danger"
                              ? "close-circle"
                              : "ellipse-outline"
                        }
                        size={13}
                        color={
                          panel.status.tone === "success"
                            ? colors.success
                            : panel.status.tone === "danger"
                              ? colors.warning
                              : colors.muted
                        }
                      />
                      <Text
                        style={{
                          color:
                            panel.status.tone === "success"
                              ? colors.success
                              : panel.status.tone === "danger"
                                ? colors.warning
                                : colors.muted,
                          fontSize: 12,
                          fontWeight: "600",
                        }}
                      >
                        {panel.status.label}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={{ color: colors.muted, fontSize: 14 }}>{media.alerts}</Text>
                    <Text style={{ color: colors.ink, fontSize: 18, fontFamily: live.faces.semibold }}>
                      {warningText(panel.alertCount)}
                    </Text>
                  </View>
                  {panel.score != null ? (
                    <View style={[styles.summaryRow, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line }]}>
                      <Text style={{ color: colors.muted, fontSize: 14 }}>{media.score}</Text>
                      <Text style={{ color: colors.accent, fontSize: 18, fontFamily: live.faces.semibold }}>
                        {panel.score}
                      </Text>
                    </View>
                  ) : null}
                </View>
              ) : null}
              {!analysisLoading && !analysisError && panel.missing && canRequestAnalysis ? (
                <Pressable accessibilityRole="button" onPress={onAnalyze} disabled={busy}>
                  <Text style={{ color: colors.accent, fontWeight: "700" }}>
                    {busy ? media.requesting : media.requestAnalysis}
                  </Text>
                </Pressable>
              ) : null}
              {!analysisLoading && !analysisError && panel.missing && !canRequestAnalysis ? (
                <Text style={{ color: colors.muted }}>{media.analysisRoles}</Text>
              ) : null}
            </View>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pad: { gap: 24, paddingHorizontal: 20, paddingTop: 12 },
  identity: { gap: 8 },
  title: { fontSize: 22, lineHeight: 29 },
  player: { height: 250, borderRadius: 14, overflow: "hidden" },
  video: { flex: 1 },
  mediaOverlay: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center", gap: 12, paddingBottom: 48 },
  mediaFallback: { alignItems: "center", justifyContent: "center", padding: 16 },
  controls: { position: "absolute", left: 16, right: 16, bottom: 14, gap: 14 },
  controlRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  clock: { flex: 1, fontSize: 12, fontWeight: "500" },
  track: { height: 3, borderRadius: 99 },
  meta: { flexDirection: "row", gap: 20, borderBottomWidth: 1, paddingVertical: 16 },
  metaCol: { flex: 1, gap: 5 },
  analysis: { gap: 12 },
  section: { fontSize: 18 },
  summary: { borderRadius: 14, paddingHorizontal: 16 },
  summaryRow: { minHeight: 60, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: StyleSheet.hairlineWidth },
  badge: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
});
