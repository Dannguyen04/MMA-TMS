import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { isApiError, loadStoredSession } from "@/api";
import { useToastMessage } from "@/components/toast/app-toast";
import { ReanalyzeButton, useReanalyze } from "@/screens/one-tap/video-actions";
import { getMemorySession } from "@/api/tokens";
import {
  createAnalysisJob,
  getAnalysisJob,
  getVideo,
  listAnalysisJobs,
  resolveVideoStream,
  type AnalysisJob,
  type VideoStream,
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
import { StateView } from "@/components/state-view";
import { states } from "@/i18n/unavailable";
import { useReadableWidth } from "@/components/readable-width";
import { SkeletonCards, SkeletonRows, ThemedRefreshControl, usePullRefresh } from "@/components/loading";
import { EvidenceTabs, tabsFor, type EvidenceTab } from "@/screens/media/evidence/evidence-tabs";
import { FindingsPanel, MetricsPanel, TimelinePanel } from "@/screens/media/evidence/evidence-panels";
import { MarkerStrip } from "@/screens/media/evidence/marker-strip";
import { useReviewState } from "@/screens/media/evidence/use-review-state";
import { latestCorrection, latestFindingReview, windowReviewInfo } from "@/screens/media/evidence/review-model";
import { FindingReviewSheet, SummarySheet, WindowReviewSheet } from "@/screens/media/evidence/review-sheets";
import { findingStatusText, HealthAlertsSection, StatusLine, SummaryCard, windowStatusText } from "@/screens/media/evidence/review-bits";
import { ev } from "@/i18n/video-evidence";
import type { EvidenceWindow, ResultFinding } from "@/components/video/pose-model";
import { EvidencePlayer, type EvidencePlayerHandle } from "@/screens/media/evidence/evidence-player";
import { useJobResult } from "@/screens/media/evidence/use-job-result";
import { useSessionRole } from "@/session/session-context";

export type EvidenceRole = "fighter" | "coach" | "doctor";

function roleFrom(value: string | null): EvidenceRole {
  if (value === "COACH" || value === "ADMIN") return "coach";
  if (value === "DOCTOR") return "doctor";
  return "fighter";
}

/** Sticky player: never taller than 40% of the window. */
const PLAYER_MAX_RATIO = 0.4;

function messageFor(error: unknown): string {
  if (!isApiError(error)) return media.generic;
  if (error.status === 0 || error.code === "NETWORK_ERROR") return media.network;
  if (error.status === 403) return media.forbidden;
  if (error.status === 404) return media.notFound;
  if (error.code === "VIDEO_JOB_EXISTS") return error.message;
  return media.generic;
}

function streamErrorMessage(error: unknown): string {
  if (isApiError(error) && (error.status === 401 || error.status === 403 || error.status === 404)) return media.mediaDenied;
  if (isApiError(error) && error.status === 503) return media.mediaStorage;
  if (isApiError(error) && error.status === 0) return media.network;
  return media.mediaError;
}

export function VideoDetailContent({
  videoId,
  canRequestAnalysis,
  onBack,
  role: roleProp,
}: {
  videoId: string;
  canRequestAnalysis: boolean;
  onBack: () => void;
  /** Defaults to the signed-in role (ADMIN reads as coach). */
  role?: EvidenceRole;
}) {
  const sessionRole = useSessionRole();
  const role = roleProp ?? roleFrom(sessionRole);
  const window = useWindowDimensions();
  const playerRef = useRef<EvidencePlayerHandle>(null);
  const [playhead, setPlayhead] = useState(0);
  const [tab, setTab] = useState<EvidenceTab>("timeline");
  const readable = useReadableWidth();
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
  const [stream, setStream] = useState<VideoStream | null>(null);
  const [streamError, setStreamError] = useState("");
  const [streamAttempt, setStreamAttempt] = useState(0);

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

  const sourcePath = video?.sourceUrl ?? null;
  useEffect(() => {
    if (!sourcePath || !token) {
      setStream(null);
      return;
    }
    let cancelled = false;
    setStream(null);
    setStreamError("");
    void resolveVideoStream(sourcePath, token)
      .then((next) => {
        if (!cancelled) setStream(next);
      })
      .catch((cause: unknown) => {
        if (!cancelled) setStreamError(streamErrorMessage(cause));
      });
    return () => {
      cancelled = true;
    };
  }, [sourcePath, token, streamAttempt]);

  const retryStream = () => setStreamAttempt((n) => n + 1);

  const onAnalyze = () => {
    if (!canRequestAnalysis || busy) return;
    setBusy(true);
    setActionError("");
    void createAnalysisJob(videoId)
      .then(() => loadAnalysis())
      .catch((cause: unknown) => setActionError(messageFor(cause)))
      .finally(() => setBusy(false));
  };

  const done = job?.status === "DONE";
  const pose = useJobResult(job?.id ?? null, done, Boolean(stream));
  const tabs = tabsFor(role);
  const review = useReviewState(job?.id ?? null, done, role);
  const [reviewing, setReviewing] = useState<ResultFinding | null>(null);
  const [windowOpen, setWindowOpen] = useState<EvidenceWindow | null>(null);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const analysisId = review.coaching?.analysisId ?? null;
  const coachCan = role === "coach" && Boolean(analysisId);
  const windowCan = role !== "fighter" && Boolean(review.movement?.canReview);
  const correction = latestCorrection(review.coaching);
  const seekTo = useCallback((ms: number) => playerRef.current?.seek(ms), []);
  const refresh = usePullRefresh(() => {
    loadRecord();
    loadAnalysis();
    if (done) {
      pose.reload();
      review.reload();
    }
  });

  const contentWidth = Math.min(window.width, readable ? 640 : window.width) - 40;
  const srcW = pose.result?.width ?? 16;
  const srcH = pose.result?.height ?? 9;
  const playerHeight = Math.round(Math.min(contentWidth * (srcH / srcW), window.height * PLAYER_MAX_RATIO));


  const when = video ? formatVideoDate(video.createdAt) : "";

  const panel = analysisPanel(analysisError ? null : job);
  // Võ sĩ phân tích lại video của chính mình (máy chủ trả 403 nếu không phải của mình).
  const router = useRouter();
  const ownReanalyze = useReanalyze(videoId, video?.fighterId ?? null, (r) =>
    router.replace({ pathname: "/(fighter)/video/xem", params: { id: r.newVideoId, jobId: r.jobId } } as never),
  );
  const canReanalyze = role === "fighter" && Boolean(video) && (job?.status === "FAILED" || job?.status === "DONE");
  const analysisBlock = (
    <View style={styles.analysis}>
      <Text style={[styles.section, { color: colors.ink, fontFamily: live.faces.semibold }]}>{media.analysis}</Text>
      {analysisLoading && !job && !analysisError ? <SkeletonRows rows={2} avatar={false} /> : null}
      {analysisError ? (
        <Pressable accessibilityRole="button" onPress={loadAnalysis}>
          <Text style={{ color: colors.accent, fontWeight: "700" }}>{media.retry}</Text>
        </Pressable>
      ) : null}
      {!analysisLoading && !analysisError && panel.missing ? (
        <Text style={{ color: colors.muted }}>{media.noJob}</Text>
      ) : null}
      {!analysisError && job && (job.status === "PENDING" || job.status === "PROCESSING") ? (
        <StateView kind="analyzing" compact title={states.analyzingTitle} description={states.analyzingBody} />
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
      {canReanalyze && !analysisError ? <ReanalyzeButton onPress={ownReanalyze.open} /> : null}
      {ownReanalyze.sheet}
    </View>
  );

  return (
    <View style={styles.flex}>
      <VideoScreenHeader title={media.detailTitle} onBack={onBack} />
      {video ? (
        <View style={[styles.sticky, readable]}>
          {token && stream ? (
            <EvidencePlayer
              ref={playerRef}
              key={`${stream.uri}#${streamAttempt}`}
              source={stream}
              mimeType={video.mimeType}
              height={playerHeight}
              result={pose.result}
              poseState={pose.state}
              fallbackDurationMs={pose.result?.durationMs ?? video.durationMs}
              onRetry={retryStream}
              onTime={setPlayhead}
              renderTrack={pose.result ? (w, d) => <MarkerStrip result={pose.result!} width={w} durationMs={d} /> : undefined}
            />
          ) : (
            <View style={[styles.mediaFallback, { height: playerHeight, backgroundColor: colors.scheme === "light" ? colors.ink : colors.bg }]}>
              <Text style={{ color: colors.scheme === "light" ? colors.bg : colors.ink, textAlign: "center" }}>
                {!tokenReady ? media.mediaLoading : !token ? media.mediaAuth : streamError || media.mediaLoading}
              </Text>
              {token && streamError ? (
                <Pressable accessibilityRole="button" accessibilityLabel={media.retry} onPress={retryStream} hitSlop={8}>
                  <Text style={{ color: colors.scheme === "light" ? colors.bg : colors.ink, fontWeight: "700", textDecorationLine: "underline" }}>
                    {media.retry}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          )}
          {pose.state === "error" ? (
            <Pressable accessibilityRole="button" onPress={pose.reload} style={styles.poseError}>
              <Text style={{ color: colors.muted, fontSize: 13, flex: 1 }}>{pose.error}</Text>
              <Text style={{ color: colors.accent, fontWeight: "700" }}>{media.retry}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
      <ScrollView
        contentContainerStyle={[styles.pad, { paddingBottom: insets.bottom + 24 }, readable]}
        refreshControl={<ThemedRefreshControl refreshing={refresh.refreshing} onRefresh={refresh.onRefresh} />}
      >
        {recordLoading && !video ? <SkeletonCards count={2} lines={3} /> : null}
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
            {done && pose.result ? (
              <View style={styles.tabs}>
                <EvidenceTabs tabs={tabs} value={tabs.includes(tab) ? tab : "timeline"} onChange={setTab} />
                {tab === "review" && tabs.includes("review") ? (
                  <FindingsPanel
                    result={pose.result}
                    onSeek={seekTo}
                    header={
                      <>
                        <SummaryCard
                          rating={correction?.techniqueRating ?? null}
                          text={correction?.reviewText ?? null}
                          canEdit={coachCan}
                          onEdit={() => setSummaryOpen(true)}
                        />
                        {role === "coach" && review.coaching && !analysisId ? (
                          <Text style={{ color: colors.muted, fontSize: 13 }}>{ev.noAnalysisId}</Text>
                        ) : null}
                      </>
                    }
                    renderExtra={(f) => {
                      const st = findingStatusText(latestFindingReview(review.coaching, f.actionId, f.id));
                      return (
                        <StatusLine
                          text={st.text}
                          tone={st.tone}
                          action={coachCan ? ev.review : undefined}
                          onAction={() => setReviewing(f)}
                          testID={`finding-review-${f.id}`}
                        />
                      );
                    }}
                  />
                ) : tab === "metrics" ? (
                  <MetricsPanel result={pose.result}>{analysisBlock}</MetricsPanel>
                ) : (
                  <TimelinePanel
                    result={pose.result}
                    timeMs={playhead}
                    onSeek={seekTo}
                    top={role === "doctor" && review.alerts ? <HealthAlertsSection alerts={review.alerts} onSeek={seekTo} /> : null}
                    renderWindowExtra={(w) => {
                      const st = windowStatusText(windowReviewInfo(review.movement, w.id).latest);
                      return (
                        <StatusLine
                          text={st.text}
                          tone={st.tone}
                          action={windowCan ? ev.reviewWindow : undefined}
                          onAction={() => {
                            seekTo(w.startMs);
                            setWindowOpen(w);
                          }}
                          testID={`window-review-${w.id}`}
                        />
                      );
                    }}
                  />
                )}
              </View>
            ) : done && (pose.state === "loading" || pose.state === "idle") ? (
              <View testID="evidence-skeleton" style={styles.tabs}>
                <SkeletonCards count={1} lines={2} />
                <SkeletonRows rows={3} avatar={false} />
              </View>
            ) : (
              analysisBlock
            )}
          </>
        ) : null}
      </ScrollView>
      {coachCan && analysisId ? (
        <>
          <FindingReviewSheet finding={reviewing} analysisId={analysisId} onClose={() => setReviewing(null)} onSaved={review.reload} />
          <SummarySheet
            visible={summaryOpen}
            analysisId={analysisId}
            initial={correction ? { rating: correction.techniqueRating, text: correction.reviewText } : null}
            onClose={() => setSummaryOpen(false)}
            onSaved={review.reload}
          />
        </>
      ) : null}
      {windowCan && job ? (
        <WindowReviewSheet
          jobId={job.id}
          window={windowOpen}
          expectedRevision={windowOpen ? windowReviewInfo(review.movement, windowOpen.id).myRevision : 0}
          playheadMs={playhead}
          onClose={() => setWindowOpen(null)}
          onSaved={review.reload}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pad: { gap: 24, paddingHorizontal: 20, paddingTop: 12 },
  identity: { gap: 8 },
  title: { fontSize: 22, lineHeight: 29 },
  sticky: { paddingHorizontal: 20, paddingBottom: 8, gap: 6 },
  mediaFallback: { borderRadius: 14, alignItems: "center", justifyContent: "center", padding: 16, gap: 12 },
  poseError: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 36 },
  meta: { flexDirection: "row", gap: 20, borderBottomWidth: 1, paddingVertical: 16 },
  metaCol: { flex: 1, gap: 5 },
  analysis: { gap: 12 },
  tabs: { gap: 16 },
  section: { fontSize: 18 },
  summary: { borderRadius: 14, paddingHorizontal: 16 },
  summaryRow: { minHeight: 60, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: StyleSheet.hairlineWidth },
  badge: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
});
