import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { isApiError, loadStoredSession } from "@/api";
import { useToastMessage } from "@/components/toast/app-toast";
import { MoreMenu, ReanalyzeButton, useDeleteVideo, useReanalyze, useRevokeReference, useVideoReference, type MoreItem } from "@/screens/one-tap/video-actions";
import { ot } from "@/i18n/common/one-tap";
import { useFighterNames } from "@/screens/coach/readonly/use-coach";
import { coachVideoHref } from "@/screens/coach/video/video-model";
import { ADMIN_VIDEOS, adminVideoHref } from "@/screens/admin/tools/admin-paths";
import { getMemorySession } from "@/api/core/tokens";
import {
  createAnalysisJob,
  getAnalysisJob,
  getVideo,
  listAnalysisJobs,
  resolveVideoStream,
  type AnalysisJob,
  type VideoStream,
  type VideoRecord,
} from "@/api/video/media";
import { media } from "@/i18n/video/media";
import { analysisPanel, jobForVideo } from "@/screens/media/video-model";
import { useReadableWidth } from "@/components/layout/readable-width";
import { ThemedRefreshControl, usePullRefresh } from "@/components/feedback/loading";
import { tabsFor, type EvidenceTab } from "@/screens/media/evidence/evidence-tabs";
import { EvHead, FindingsPanel, MetricsPanel, TimelinePanel } from "@/screens/media/evidence/evidence-panels";
import { MarkerStrip } from "@/screens/media/evidence/marker-strip";
import { useReviewState } from "@/screens/media/evidence/use-review-state";
import { latestCorrection, latestFindingReview, windowReviewInfo } from "@/screens/media/evidence/review-model";
import { FindingReviewSheet, SummarySheet, WindowReviewSheet } from "@/screens/media/evidence/review-sheets";
import { findingStatusText, HealthAlertsSection, SummaryCard, windowStatusText } from "@/screens/media/evidence/review-bits";
import { ev } from "@/i18n/video/video-evidence";
import type { EvidenceWindow, ResultFinding } from "@/components/video/pose-model";
import { EvidencePlayer, type EvidencePlayerHandle } from "@/screens/media/evidence/evidence-player";
import { useJobResult } from "@/screens/media/evidence/use-job-result";
import { useSessionRole } from "@/session/session-context";
import { errorCodeText } from "@/i18n/common/backend-codes";
import { videoTitle } from "@/i18n/common/server-text";
import { ActivityIndicator } from "react-native";
import { Icon } from "@/components/icon";
import { fighterVideo as fv } from "@/i18n/fighter/fighter-video";
import { CampTabs } from "@/shared/ui/camp-lit";
import { Action, sentences } from "@/shared/ui/camp-ui";
import { RetryRow } from "@/screens/fighter/redesign/tab-page";
import { detailLine, jobKind, statusWord, videoHref } from "@/screens/fighter/video/video-v2-model";
import { hmLocal } from "@/screens/fighter/health/health-model";
import { useThemePreference } from "@/theme";
import { fonts, readableTextStyle, fz, lh } from "@/theme/typography";

export type EvidenceRole = "fighter" | "coach" | "doctor" | "admin";

function roleFrom(value: string | null): EvidenceRole {
  if (value === "COACH") return "coach";
  if (value === "ADMIN") return "admin";
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
  if (errorCodeText[error.code]) return errorCodeText[error.code];
  return media.generic;
}

function streamErrorMessage(error: unknown): string {
  if (isApiError(error) && (error.status === 401 || error.status === 403 || error.status === 404)) return media.mediaDenied;
  if (isApiError(error) && error.status === 503) return media.mediaStorage;
  if (isApiError(error) && error.status === 0) return media.network;
  return media.mediaError;
}

function useVideoDetailData(videoId: string, canRequestAnalysis: boolean) {
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

  return { video, job, recordError, analysisError, recordLoading, analysisLoading, busy, token, tokenReady, stream, streamError, streamAttempt, loadRecord, loadAnalysis, retryStream, onAnalyze };
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
  /** Defaults to the signed-in role. */
  role?: EvidenceRole;
}) {
  const sessionRole = useSessionRole();
  const role = roleProp ?? roleFrom(sessionRole);
  const window = useWindowDimensions();
  const playerRef = useRef<EvidencePlayerHandle>(null);
  const [playhead, setPlayhead] = useState(0);
  const [tab, setTab] = useState<EvidenceTab>("timeline");
  const readable = useReadableWidth();
  const { colors: c } = useThemePreference();
  const insets = useSafeAreaInsets();
  const { video, job, recordError, analysisError, recordLoading, analysisLoading, busy, token, tokenReady, stream, streamError, streamAttempt, loadRecord, loadAnalysis, retryStream, onAnalyze } = useVideoDetailData(videoId, canRequestAnalysis);

  const done = job?.status === "DONE";
  const pose = useJobResult(job?.id ?? null, done, Boolean(stream));
  const review = useReviewState(job?.id ?? null, done, role);
  const [reviewing, setReviewing] = useState<ResultFinding | null>(null);
  const [windowOpen, setWindowOpen] = useState<EvidenceWindow | null>(null);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const analysisId = review.coaching?.analysisId ?? null;
  const coachCan = role === "coach" && Boolean(analysisId);
  const windowCan = (role === "coach" || role === "doctor") && Boolean(review.movement?.canReview);
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


  // Phân tích lại: the fighter on their own video (server 403 otherwise) and the coach (step 19, from "⋯" or after a failure).
  const router = useRouter();
  const fighter = role === "fighter";
  const coach = role === "coach";
  const admin = role === "admin";
  const reanalyze = useReanalyze(videoId, video?.fighterId ?? null, (r) =>
    // Step 14: land on the new video page ("Đang chờ"), not the old evidence page.
    router.replace((fighter ? videoHref(r.newVideoId) : admin ? adminVideoHref(r.newVideoId) : coachVideoHref(r.newVideoId)) as never),
  );
  // Admin (step 23): "⋯" also deletes the video (asks first), then goes back to the list.
  const remove = useDeleteVideo(videoId, () => router.replace(ADMIN_VIDEOS as never));
  const canReanalyze = (fighter || coach || admin) && Boolean(video) && (job?.status === "FAILED" || job?.status === "DONE");
  const refs = useVideoReference(video?.fighterId ?? null, videoId, coach);
  const revoke = useRevokeReference(refs.ref, refs.clear);
  const names = useFighterNames(coach || admin);
  const more: MoreItem[] = [
    ...((coach || admin) && canReanalyze && job?.status === "DONE" ? [{ key: "re", label: ot.reanalyze, icon: "retry" as const, onPress: reanalyze.open }] : []),
    ...(refs.ref ? [{ key: "revoke", label: ot.revoke, icon: "ban" as const, danger: true, onPress: revoke.open }] : []),
    ...(admin && video ? [{ key: "delete", label: ot.deleteVideo, icon: "trash" as const, danger: true, onPress: remove.open }] : []),
  ];
  const reviewed = coach && pose.result
    ? { done: pose.result.findings.filter((f) => latestFindingReview(review.coaching, f.actionId, f.id)).length, total: pose.result.findings.length }
    : undefined;
  const status = (
    <FighterStatus
      job={analysisError ? null : job}
      loading={analysisLoading && !job && !analysisError}
      failed={!!analysisError}
      onRetry={loadAnalysis}
      canAsk={canRequestAnalysis}
      asking={busy}
      onAsk={onAnalyze}
      onAgain={canReanalyze ? reanalyze.open : undefined}
      reviewed={reviewed}
    />
  );
  const titleLine = video
    ? [coach || admin ? names[video.fighterId] : null, detailLine(video), refs.ref ? ot.reference : null].filter(Boolean).join(" · ")
    : "";

  return (
    <View style={styles.flex}>
      <FighterHeader onBack={onBack} right={more.length ? <MoreMenu items={more} /> : null} />
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
            <View style={[styles.mediaFallback, { height: playerHeight, backgroundColor: "#000000" }]}>
              <Text style={{ ...readableTextStyle(14.5), color: "#FFFFFF", textAlign: "center" }}>
                {!tokenReady ? media.mediaLoading : !token ? media.mediaAuth : streamError || media.mediaLoading}
              </Text>
              {token && streamError ? (
                <Pressable accessibilityRole="button" accessibilityLabel={media.retry} onPress={retryStream} hitSlop={8} style={{ minHeight: 44, justifyContent: "center" }}>
                  <Text style={{ ...readableTextStyle(14.5, true), color: "#FFFFFF", textDecorationLine: "underline" }}>{media.retry}</Text>
                </Pressable>
              ) : null}
            </View>
          )}
          {pose.state === "error" ? <RetryRow message={pose.error || media.mediaError} retry={media.retry} onRetry={pose.reload} /> : null}
        </View>
      ) : null}
      <ScrollView
        contentContainerStyle={[styles.pad, { paddingBottom: insets.bottom + 24 }, readable]}
        refreshControl={<ThemedRefreshControl refreshing={refresh.refreshing} onRefresh={refresh.onRefresh} />}
      >
        {recordLoading && !video ? <ActivityIndicator color={c.lotus} style={{ paddingVertical: 32 }} /> : null}
        {recordError ? <RetryRow message={recordError} retry={media.retry} onRetry={loadRecord} /> : null}
        {video ? (
          <>
            <FighterTitle title={videoTitle(video.title)} line={titleLine} />
            {video.description ? <View style={{ gap: 4 }}>{sentences(video.description).map((line, i) => <Text key={i} style={{ ...readableTextStyle(15), lineHeight: lh(22), color: c.ink }}>{line}</Text>)}</View> : null}
            {status}
            {done && pose.result ? (
              <VideoEvidenceTabs role={role} result={pose.result} tab={tab} setTab={setTab} review={review} correction={correction}
                coachCan={coachCan} windowCan={windowCan} analysisId={analysisId} playhead={playhead} seekTo={seekTo}
                canReanalyze={canReanalyze} onReanalyze={reanalyze.open} setSummaryOpen={setSummaryOpen} setReviewing={setReviewing} setWindowOpen={setWindowOpen}/>
            ) : done && (pose.state === "loading" || pose.state === "idle") ? (
              <ActivityIndicator testID="evidence-skeleton" color={c.lotus} style={{ paddingVertical: 24 }} />
            ) : null}
          </>
        ) : null}
      </ScrollView>
      {reanalyze.sheet}
      {revoke.sheet}
      {remove.sheet}
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

function VideoEvidenceTabs({ role, result, tab, setTab, review, correction, coachCan, windowCan, analysisId, playhead, seekTo, canReanalyze, onReanalyze, setSummaryOpen, setReviewing, setWindowOpen }: {
  role: EvidenceRole;
  result: NonNullable<ReturnType<typeof useJobResult>["result"]>;
  tab: EvidenceTab;
  setTab: (tab: EvidenceTab) => void;
  review: ReturnType<typeof useReviewState>;
  correction: ReturnType<typeof latestCorrection>;
  coachCan: boolean;
  windowCan: boolean;
  analysisId: string | null;
  playhead: number;
  seekTo: (ms: number) => void;
  canReanalyze: boolean;
  onReanalyze: () => void;
  setSummaryOpen: (open: boolean) => void;
  setReviewing: (finding: ResultFinding) => void;
  setWindowOpen: (window: EvidenceWindow) => void;
}) {
  const { colors: c } = useThemePreference();
  const tabs = tabsFor(role);
  const coach = role === "coach";
  const fighter = role === "fighter";
  return <View style={styles.tabs}>
    <CampTabs
      tabs={tabs.map((key) => ({ key, label: fv.tabs[key] }))}
      value={tabs.includes(tab) ? tab : "timeline"}
      onChange={setTab}
      alertLabel={fv.alertDot}
    />
    {tab === "review" && tabs.includes("review") ? (
      <FindingsPanel
        result={result}
        onSeek={seekTo}
        header={
          <>
            <SummaryCard
              rating={correction?.techniqueRating ?? null}
              text={correction?.reviewText ?? null}
              canEdit={coachCan}
              onEdit={() => setSummaryOpen(true)}
            />
            {coach && review.coaching && !analysisId ? (
              <Text style={{ ...readableTextStyle(14.5), color: c.ink }}>{ev.noAnalysisId}</Text>
            ) : null}
            <EvHead title={ot.findings} />
          </>
        }
        status={coach ? (f) => findingStatusText(latestFindingReview(review.coaching, f.actionId, f.id)) : undefined}
        onOpen={coachCan ? (f) => setReviewing(f) : undefined}
      />
    ) : tab === "metrics" ? (
      <MetricsPanel result={result}>
        {fighter && canReanalyze ? <ReanalyzeButton onPress={onReanalyze} /> : null}
      </MetricsPanel>
    ) : (
      <TimelinePanel
        result={result}
        timeMs={playhead}
        onSeek={seekTo}
        top={role === "doctor" && review.alerts ? <HealthAlertsSection alerts={review.alerts} onSeek={seekTo} /> : null}
        windowStatus={fighter ? undefined : (w) => windowStatusText(windowReviewInfo(review.movement, w.id).latest)}
        onWindow={windowCan ? (w) => setWindowOpen(w) : undefined}
      />
    )}
  </View>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pad: { gap: 18, paddingHorizontal: 22, paddingTop: 14 },
  sticky: { paddingHorizontal: 22, paddingBottom: 8, gap: 6 },
  mediaFallback: { alignItems: "center", justifyContent: "center", padding: 16, gap: 12 },
  tabs: { gap: 16 },
});

/** Header (redesign step 13, every role from step 19): back, "VIDEO" centred in the display face, the coach's "⋯" on the right. */
function FighterHeader({ onBack, right }: { onBack: () => void; right?: ReactNode }) {
  const { colors: c } = useThemePreference();
  return (
    <View style={{ minHeight: 54, flexDirection: "row", alignItems: "center", paddingHorizontal: 18, borderBottomColor: c.line, borderBottomWidth: 1 }}>
      <View style={{ width: 56 }}>
        <Pressable accessibilityRole="button" accessibilityLabel={media.back} onPress={onBack} style={{ minWidth: 48, minHeight: 48, justifyContent: "center" }}>
          <Icon name="back" size={26} color={c.ink} />
        </Pressable>
      </View>
      <Text accessibilityRole="header" numberOfLines={1} style={{ flex: 1, textAlign: "center", fontFamily: fonts.display, fontSize: fz(20), lineHeight: lh(27), letterSpacing: 0.4, textTransform: "uppercase", color: c.ink }}>
        {fv.title}
      </Text>
      <View style={{ width: 56, alignItems: "flex-end" }}>{right}</View>
    </View>
  );
}

/** The video's title on one line, then "Bao cát · Góc trước · 10/11 18:30". */
function FighterTitle({ title, line }: { title: string; line: string }) {
  const { colors: c } = useThemePreference();
  return (
    <View testID="video-title-v2" style={{ gap: 2 }}>
      <Text numberOfLines={1} style={{ fontFamily: fonts.displayExtraBold, fontSize: fz(26), lineHeight: lh(36), textTransform: "uppercase", color: c.ink }}>{title}</Text>
      <Text numberOfLines={1} style={{ ...readableTextStyle(14), color: c.ink }}>{line}</Text>
    </View>
  );
}

/**
 * Fighter analysis status: done is a 3-part strip (Xong / Điểm / Cảnh báo); otherwise one row (mark + word), then
 * "Yêu cầu phân tích" without a job, or "Phân tích lại" after a failure.
 */
function FighterStatus({ job, loading, failed, onRetry, canAsk, asking, onAsk, onAgain, reviewed }: {
  job: AnalysisJob | null; loading: boolean; failed: boolean; onRetry: () => void;
  canAsk: boolean; asking: boolean; onAsk: () => void; onAgain?: () => void;
  /** Coach (step 19): AI findings reviewed so far; the strip then reads Điểm · Cảnh báo · Đã duyệt. */
  reviewed?: { done: number; total: number };
}) {
  const { colors: c } = useThemePreference();
  if (loading) return <ActivityIndicator color={c.lotus} style={{ paddingVertical: 16 }} />;
  if (failed) return <RetryRow message={fv.statusFailed} retry={fv.retry} onRetry={onRetry} />;
  const kind = jobKind(job);
  const rule = { borderTopWidth: 1, borderBottomWidth: 1, borderColor: c.line };
  if (kind === "done" && job) {
    const panel = analysisPanel(job);
    const score = { value: panel.score == null ? "–" : String(panel.score), label: fv.strip.score, color: panel.score == null ? c.inkSubtle : c.ink };
    const alerts = { value: panel.alertCount == null ? "–" : String(panel.alertCount), label: fv.strip.alerts, color: panel.alertCount ? c.danger : panel.alertCount === 0 ? c.ink : c.inkSubtle };
    const cells: { value: string; label: string; color: string }[] = reviewed && reviewed.total
      ? [score, alerts, { value: `${reviewed.done}/${reviewed.total}`, label: fv.strip.reviewed, color: reviewed.done < reviewed.total ? c.ink : c.success }]
      : [{ value: fv.strip.done, label: fv.strip.analysis, color: c.success }, score, alerts];
    return (
      <View testID="video-strip" style={[{ flexDirection: "row" }, rule]}>
        {cells.map((cell, k) => (
          <View key={cell.label} accessible accessibilityLabel={`${cell.label}: ${cell.value}`} style={{ flex: 1, minWidth: 0, alignItems: "center", paddingVertical: 12, paddingHorizontal: 6, borderLeftWidth: k ? 1 : 0, borderLeftColor: c.line }}>
            <Text numberOfLines={1} adjustsFontSizeToFit style={{ fontFamily: fonts.displayExtraBold, fontSize: fz(24), lineHeight: lh(33), textTransform: "uppercase", color: cell.color }}>{cell.value}</Text>
            <Text numberOfLines={1} style={{ ...readableTextStyle(12.5), color: c.ink, marginTop: 2 }}>{cell.label}</Text>
          </View>
        ))}
      </View>
    );
  }
  const word = statusWord(job);
  const tone = kind === "fail" ? c.danger : kind === "none" ? c.inkSubtle : c.lotus;
  return (
    <View style={{ gap: 14 }}>
      <View testID="video-state" accessible accessibilityLabel={word} style={[{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 }, rule]}>
        <View style={{ width: 40, alignItems: "center" }}>
          {kind === "wait" ? <Icon name="history" size={28} color={tone} /> : (
            <Text style={{ fontFamily: fonts.displayExtraBold, fontSize: fz(30), lineHeight: lh(34), color: tone }}>{kind === "fail" ? "!" : "–"}</Text>
          )}
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={{ fontFamily: fonts.display, fontSize: fz(18), lineHeight: lh(25), letterSpacing: 0.5, textTransform: "uppercase", color: kind === "fail" ? c.danger : c.ink }}>{word}</Text>
          {kind === "wait" && job ? <Text numberOfLines={1} style={{ ...readableTextStyle(14), color: c.ink }}>{fv.sentAt(hmLocal(job.createdAt))}</Text> : null}
        </View>
      </View>
      {kind === "none" && canAsk ? <Action label={asking ? fv.asking : fv.ask} pending={asking} onPress={onAsk} /> : null}
      {kind === "fail" && onAgain ? <Action label={fv.again} onPress={onAgain} /> : null}
    </View>
  );
}
