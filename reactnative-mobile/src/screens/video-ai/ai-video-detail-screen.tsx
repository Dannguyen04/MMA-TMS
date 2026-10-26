import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { isApiError, loadStoredSession } from "@/api";
import type { VideoStream } from "@/api/media";
import { getMemorySession } from "@/api/tokens";
import { videoAiApi } from "@/api/video-ai";
import { isJobNotComplete, type AiCoachingState, type AiHealthAlert, type AiHealthAlerts, type AiJob, type AiMovementReviews, type AiVideo } from "@/api/video-ai.types";
import { Icon } from "@/components/icon";
import { ThemedRefreshControl, usePullRefresh } from "@/components/loading";
import { useReadableWidth } from "@/components/readable-width";
import { vai } from "@/i18n/video-ai";
import { InfoLine, RoCard, RowSkeletons, StatusChip } from "@/screens/coach/readonly/ro-ui";
import { vnDate } from "@/screens/coach/readonly/ro-format";
import { ActionButton, CardSkeleton, MessageCard, TEXT } from "@/screens/fighter/bout-states";
import { useFighterPalette } from "@/screens/fighter/redesign/palette";
import { EvidencePlayer, type EvidencePlayerHandle, type PoseState } from "@/screens/media/evidence/evidence-player";
import { useJobResult } from "@/screens/media/evidence/use-job-result";
import type { WorkerResult } from "@/components/video/pose-model";
import { palettes } from "@/theme/colors";

import { ot } from "@/i18n/one-tap";
import { FindingsCard, MoreMenu, MovementCard, ReanalyzeButton, ReferenceChip, useReanalyze, useRevokeReference, useVideoReference, type MoreItem } from "@/screens/one-tap/video-actions";

import { DETAIL_PATH, useAiNames, useAiRole, useMeId, type DetailFocus } from "./ai-data";
import {
  angleText,
  decisionChip,
  durationShort,
  groupByJoint,
  jobChip,
  jointStateText,
  jointText,
  latestJobFor,
  mmss,
  POLL_MS,
  reviewItems,
  severityChip,
  severityTone,
  trainingText,
  type AlertGroup,
  type ReviewItem,
} from "./ai-model";
import { StepProgress } from "./ai-ui";

type Phase<T> = { data: T | null; error: unknown; loading: boolean };
const idle = <T,>(): Phase<T> => ({ data: null, error: null, loading: true });

function errorText(e: unknown): string {
  if (isApiError(e) && (e.status === 403 || e.code === "FORBIDDEN")) return vai.forbidden;
  if (isApiError(e) && e.status === 404) return vai.notFound;
  if (isApiError(e) && (e.status === 0 || e.code === "NETWORK_ERROR")) return "Không có kết nối mạng. Kiểm tra mạng rồi thử lại.";
  return "Chưa tải được dữ liệu. Thử lại sau.";
}

/** Route wrapper: đọc id / job / focus từ query (không dùng route động [id]). */
export function AiVideoDetailRoute() {
  const q = useLocalSearchParams<{ id?: string; job?: string; focus?: string }>();
  const id = typeof q.id === "string" ? q.id : "";
  const job = typeof q.job === "string" && q.job ? q.job : null;
  const focus = q.focus === "result" || q.focus === "alerts" ? q.focus : null;
  return <AiVideoDetail videoId={id} jobId={job} focus={focus} />;
}

/**
 * Chi tiết video chỉ đọc (HLV / Admin / Bác sĩ): trình phát + đánh dấu cảnh báo, thông tin, Kết quả phân tích,
 * Cảnh báo sức khỏe, Đánh giá của HLV (ẩn với Bác sĩ). Không có thao tác ghi.
 */
export function AiVideoDetail({ videoId, jobId, focus }: { videoId: string; jobId: string | null; focus: DetailFocus | null }) {
  const router = useRouter();
  const p = useFighterPalette();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const readable = useReadableWidth();
  const role = useAiRole();
  const meId = useMeId();
  const names = useAiNames(true);
  const showCoaching = role !== "doctor";
  const playerRef = useRef<EvidencePlayerHandle>(null);
  const scrollRef = useRef<ScrollView>(null);
  const anchors = useRef<{ result?: number; alerts?: number }>({});
  const scrolled = useRef(false);

  const [video, setVideo] = useState<Phase<AiVideo>>(idle);
  const [job, setJob] = useState<Phase<AiJob | null>>(idle);
  const [alerts, setAlerts] = useState<Phase<AiHealthAlerts>>({ data: null, error: null, loading: false });
  const [review, setReview] = useState<Phase<{ state: AiCoachingState | null; moves: AiMovementReviews | null }>>({ data: null, error: null, loading: false });
  const [stream, setStream] = useState<Phase<VideoStream>>(idle);
  const [cursorMs, setCursorMs] = useState<number | null>(null);
  const [tab, setTab] = useState<DetailTab>("analysis");
  const [mini, setMini] = useState(false);

  const loadVideo = useCallback(async () => {
    setVideo((s) => ({ ...s, loading: true, error: null }));
    try {
      const v = await videoAiApi.getVideo(videoId);
      setVideo({ data: v, error: null, loading: false });
    } catch (e) {
      setVideo({ data: null, error: e, loading: false });
    }
  }, [videoId]);

  const loadStream = useCallback(async () => {
    setStream((s) => ({ ...s, loading: true, error: null }));
    try {
      const token = getMemorySession()?.accessToken ?? (await loadStoredSession())?.accessToken ?? "";
      setStream({ data: await videoAiApi.getVideoStream(videoId, token), error: null, loading: false });
    } catch (e) {
      setStream({ data: null, error: e, loading: false });
    }
  }, [videoId]);

  const loadJob = useCallback(async () => {
    setJob((s) => ({ ...s, loading: true, error: null }));
    try {
      const j = jobId ? await videoAiApi.getJob(jobId) : latestJobFor(await videoAiApi.listJobs(), videoId);
      setJob({ data: j, error: null, loading: false });
      return j;
    } catch (e) {
      setJob((s) => ({ data: s.data, error: e, loading: false }));
      return null;
    }
  }, [jobId, videoId]);

  const loadExtras = useCallback(
    async (j: AiJob | null) => {
      if (!j || j.status !== "DONE") {
        setAlerts({ data: null, error: null, loading: false });
        setReview({ data: null, error: null, loading: false });
        return;
      }
      setAlerts((s) => ({ ...s, loading: true, error: null }));
      const tasks: Promise<unknown>[] = [
        videoAiApi
          .getHealthAlerts(j.id)
          .then((a) => setAlerts({ data: a, error: null, loading: false }))
          .catch((e: unknown) => setAlerts({ data: null, error: isJobNotComplete(e) ? null : e, loading: false })),
      ];
      if (showCoaching) {
        setReview((s) => ({ ...s, loading: true, error: null }));
        tasks.push(
          Promise.allSettled([videoAiApi.getCoachingState(j.id), videoAiApi.getMovementReviews(j.id)]).then(([s, m]) => {
            if (s.status === "rejected" && m.status === "rejected") setReview({ data: null, error: s.reason, loading: false });
            else setReview({ data: { state: s.status === "fulfilled" ? s.value : null, moves: m.status === "fulfilled" ? m.value : null }, error: null, loading: false });
          }),
        );
      }
      await Promise.all(tasks);
    },
    [showCoaching],
  );

  const loadAll = useCallback(async () => {
    const [, j] = await Promise.all([loadVideo(), loadJob(), loadStream()]);
    await loadExtras(j);
  }, [loadVideo, loadJob, loadStream, loadExtras]);

  useEffect(() => {
    if (videoId) void loadAll();
  }, [videoId, loadAll]);

  // Đang phân tích: tự làm mới mỗi 15 giây khi màn đang mở, dừng khi rời màn.
  const running = job.data != null && (job.data.status === "PENDING" || job.data.status === "PROCESSING");
  useFocusEffect(
    useCallback(() => {
      if (!running) return undefined;
      const t = setInterval(() => {
        void loadJob().then((j) => (j && j.status === "DONE" ? loadExtras(j) : undefined));
      }, POLL_MS);
      return () => clearInterval(t);
    }, [running, loadJob, loadExtras]),
  );

  const pull = usePullRefresh(loadAll);
  const groups = useMemo(() => groupByJoint(alerts.data?.alerts ?? []), [alerts.data]);
  const items = useMemo(() => reviewItems(review.data?.state ?? null, review.data?.moves ?? null, meId), [review.data, meId]);

  const tryScroll = () => {
    if (scrolled.current || !focus) return;
    const y = anchors.current[focus];
    if (y == null) return;
    scrolled.current = true;
    requestAnimationFrame(() => scrollRef.current?.scrollTo({ y: Math.max(0, y - 8), animated: false }));
  };
  const anchor = (key: "result" | "alerts") => (e: { nativeEvent: { layout: { y: number } } }) => {
    anchors.current[key] = e.nativeEvent.layout.y;
    tryScroll();
  };

  const seek = (ms: number) => {
    setCursorMs(ms);
    playerRef.current?.seek(ms);
  };
  const back = () => (router.canGoBack() ? router.back() : undefined);
  const v = video.data;
  const fighter = v ? names[v.fighterId] ?? "" : "";
  // Khung 16:9 cao = min(30% chiều cao màn, 280dp); video contain trên nền đen.
  const playerH = Math.min(Math.round(height * 0.3), 280);
  const durationMs = v?.durationMs ?? 0;
  const markers = alerts.data?.alerts ?? [];
  const fatal = !v && !video.loading && video.error;

  // Thao tác 1 chạm: phân tích lại (HLV, quản trị; bác sĩ không thấy), gỡ chuẩn (HLV).
  const canReanalyze = role === "coach" || role === "admin";
  const reanalyze = useReanalyze(videoId, v?.fighterId ?? null, (r) =>
    router.replace({ pathname: DETAIL_PATH[role], params: { id: r.newVideoId, job: r.jobId, focus: "result" } } as never),
  );
  const refs = useVideoReference(v?.fighterId ?? null, videoId, role === "coach");
  const revoke = useRevokeReference(refs.ref, refs.clear);
  const done = job.data?.status === "DONE";
  // Khung xương (Lớp): tải GET /jobs/:id/result khi job DONE và đã có luồng phát.
  const pose = useJobResult(job.data?.id ?? null, done, Boolean(stream.data?.uri), videoAiApi.getJobResult);
  const tabs: { key: DetailTab; label: string }[] = [
    { key: "analysis", label: vai.tabAnalysis },
    ...((role === "coach" || role === "doctor") && done && job.data ? [{ key: "movement" as const, label: vai.tabMovement }] : []),
    ...(showCoaching && done ? [{ key: "review" as const, label: vai.tabReview }] : []),
  ];
  const current: DetailTab = tabs.some((t) => t.key === tab) ? tab : "analysis";
  const more: MoreItem[] = [
    ...(canReanalyze && v && done ? [{ key: "re", label: ot.reanalyze, icon: "retry" as const, onPress: reanalyze.open }] : []),
    ...(refs.ref ? [{ key: "revoke", label: ot.revoke, icon: "ban" as const, danger: true, onPress: revoke.open }] : []),
  ];

  return (
    <View style={{ flex: 1, backgroundColor: p.bg, paddingTop: insets.top }}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Quay lại" onPress={back} style={[styles.back, { backgroundColor: p.surface2 }]}>
          <Icon name="back" size={24} color={p.ink} />
        </Pressable>
        <Text accessibilityRole="header" style={[TEXT.screenTitle, { color: p.ink, flex: 1 }]} numberOfLines={1} ellipsizeMode="tail">
          {v?.title || vai.detailTitle}
        </Text>
        <MoreMenu items={more} />
      </View>

      {fatal ? (
        <View style={styles.pad}>
          <MessageCard icon={isApiError(video.error) && video.error.status === 403 ? "lock" : "offline"} title={errorText(video.error)}>
            <ActionButton label={vai.retry} variant="secondary" icon="retry" onPress={() => void loadAll()} />
          </MessageCard>
        </View>
      ) : (
        <>
          <View testID="ai-player">
            <Player
              playerRef={playerRef}
              stream={stream}
              height={mini ? 64 : playerH}
              mini={mini}
              miniTitle={fighter || v?.title || ""}
              pose={pose}
              durationMs={durationMs}
              markers={markers}
              cursorMs={cursorMs}
              onSeek={seek}
              onRetry={() => void loadStream()}
            />
          </View>
          <ScrollView
            ref={scrollRef}
            testID="ai-scroll"
            scrollEventThrottle={16}
            onScroll={(e) => {
              // Cuộn xuống: video thu thành thanh mini 64dp (vẫn phát); về đầu trang thì mở lại.
              const y = e.nativeEvent.contentOffset.y;
              if (y > MINI_AT && !mini) setMini(true);
              else if (y <= 2 && mini) setMini(false);
            }}
            contentContainerStyle={[styles.pad, { paddingTop: 12, paddingBottom: insets.bottom + 32 }, readable]}
            refreshControl={<ThemedRefreshControl refreshing={pull.refreshing} onRefresh={pull.onRefresh} />}
          >
            {!v && video.loading ? <CardSkeleton height={48} /> : null}
            {v ? (
              <Text
                testID="ai-info-line"
                accessibilityLabel={[fighter, trainingText(v.trainingType), angleText(v.cameraAngle), durationShort(v.durationMs), vnDate(v.createdAt)].filter(Boolean).join(", ")}
                style={[TEXT.detail, { color: p.ink }]}
              >
                {fighter ? <Text style={{ fontWeight: "700" }}>{fighter}</Text> : null}
                {(fighter ? " · " : "") +
                  [trainingText(v.trainingType), angleText(v.cameraAngle), durationShort(v.durationMs), vnDate(v.createdAt)].filter(Boolean).join(" · ")}
              </Text>
            ) : null}

            {tabs.length > 1 ? <Segmented value={tabs.some((t) => t.key === tab) ? tab : "analysis"} onChange={setTab} tabs={tabs} /> : null}

            {current === "analysis" ? (
              <>
                <View onLayout={anchor("result")}>
                  <ResultCard job={job} onRetry={() => void loadJob().then(loadExtras)} onReanalyze={canReanalyze && v ? reanalyze.open : undefined} reference={refs.ref ? refs.ref.technique : undefined} />
                </View>
                {job.data?.status === "DONE" ? (
                  <View onLayout={anchor("alerts")}>
                    <AlertsCard phase={alerts} groups={groups} onSeek={seek} onRetry={() => void loadExtras(job.data)} />
                  </View>
                ) : null}
                {role === "coach" && done && job.data && review.data?.state ? <FindingsCard jobId={job.data.id} state={review.data.state} /> : null}
              </>
            ) : null}
            {current === "movement" && job.data ? <MovementCard jobId={job.data.id} meId={meId} onSeek={seek} /> : null}
            {current === "review" ? <ReviewCard phase={review} items={items} onRetry={() => void loadExtras(job.data)} /> : null}
          </ScrollView>
        </>
      )}
      {reanalyze.sheet}
      {revoke.sheet}
    </View>
  );
}

function Player({
  playerRef,
  stream,
  height,
  mini,
  miniTitle,
  pose,
  durationMs,
  markers,
  cursorMs,
  onSeek,
  onRetry,
}: {
  playerRef: React.RefObject<EvidencePlayerHandle | null>;
  stream: Phase<VideoStream>;
  height: number;
  mini: boolean;
  miniTitle: string;
  pose: { result: WorkerResult | null; state: PoseState; reload: () => void };
  durationMs: number;
  markers: readonly AiHealthAlert[];
  cursorMs: number | null;
  onSeek: (ms: number) => void;
  onRetry: () => void;
}) {
  const p = useFighterPalette();
  const well = p.scheme === "light" ? p.ink : palettes.dark.bg;
  const onWell = p.scheme === "light" ? p.bg : p.ink;
  const track = (w: number, total: number) => <MarkerDots width={w} durationMs={total || durationMs} markers={markers} onSeek={onSeek} />;
  if (stream.data?.uri) {
    return (
      <EvidencePlayer
        ref={playerRef}
        source={stream.data}
        mimeType="video/mp4"
        height={height}
        fit={{ height, mini, miniTitle }}
        result={pose.result}
        poseState={pose.state}
        fallbackDurationMs={pose.result?.durationMs ?? durationMs}
        onRetry={() => {
          onRetry();
          if (pose.state === "error") pose.reload();
        }}
        renderTrack={track}
      />
    );
  }
  // Chưa có luồng phát (đang tải / lỗi / bản mock): khung 16:9 + thanh thời gian với chấm cảnh báo.
  return (
    <View style={[styles.well, { backgroundColor: well, height }]}>
      <View style={styles.wellCenter}>
        {stream.loading ? (
          <Text style={[TEXT.body, { color: onWell }]}>Đang tải video…</Text>
        ) : stream.error ? (
          <>
            <Text style={[TEXT.bodyBold, { color: onWell }]}>{vai.streamError}</Text>
            <Pressable accessibilityRole="button" onPress={onRetry} style={[styles.wellBtn, { borderColor: onWell }]}>
              <Icon name="retry" size={20} color={onWell} />
              <Text style={[TEXT.bodyBold, { color: onWell }]}>{vai.retry}</Text>
            </Pressable>
          </>
        ) : (
          <View accessible accessibilityLabel={vai.preview} style={[styles.playBtn, { borderColor: onWell }]}>
            <Icon name="video" size={24} color={onWell} />
          </View>
        )}
      </View>
      <View style={styles.wellTrack}>
        <Text style={[TEXT.captionBold, { color: onWell }]}>{mmss(cursorMs ?? 0)}</Text>
        <TrackBar durationMs={durationMs} markers={markers} cursorMs={cursorMs} onSeek={onSeek} color={onWell} />
        <Text style={[TEXT.captionBold, { color: onWell }]}>{mmss(durationMs)}</Text>
      </View>
    </View>
  );
}

function TrackBar({ durationMs, markers, cursorMs, onSeek, color }: { durationMs: number; markers: readonly AiHealthAlert[]; cursorMs: number | null; onSeek: (ms: number) => void; color: string }) {
  const [w, setW] = useState(0);
  const pct = durationMs > 0 && cursorMs != null ? Math.min(1, cursorMs / durationMs) : 0;
  return (
    <View testID="ai-track" style={styles.trackWrap} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      <View style={[styles.trackLine, { backgroundColor: color, opacity: 0.5 }]} />
      <View style={[styles.trackLine, { backgroundColor: color, right: undefined, width: `${pct * 100}%` }]} />
      {w > 0 ? <MarkerDots width={w} durationMs={durationMs} markers={markers} onSeek={onSeek} /> : null}
    </View>
  );
}

/** Chấm cảnh báo trên thanh thời gian (màu theo mức), vùng chạm 48dp, bấm → tua. */
function MarkerDots({ width, durationMs, markers, onSeek }: { width: number; durationMs: number; markers: readonly AiHealthAlert[]; onSeek: (ms: number) => void }) {
  const p = useFighterPalette();
  if (!durationMs || width <= 0) return null;
  return (
    <>
      {markers.map((m, i) => {
        const x = Math.min(width, Math.max(0, (m.triggerTimeMs / durationMs) * width));
        const color = severityTone(m.severity) === "danger" ? p.danger : p.attention;
        return (
          <Pressable
            key={`${m.joint}-${m.triggerTimeMs}-${i}`}
            testID="alert-marker"
            accessibilityRole="button"
            accessibilityLabel={vai.marker(m.joint ? jointText(m.joint) : vai.jointUnknown, severityChip(m.severity).label, mmss(m.triggerTimeMs))}
            onPress={() => onSeek(m.triggerTimeMs)}
            style={[styles.marker, { left: x - 24 }]}
          >
            <View style={[styles.markerDot, { backgroundColor: color, borderColor: p.surface }]} />
          </Pressable>
        );
      })}
    </>
  );
}

function ResultCard({ job, onRetry, onReanalyze, reference }: { job: Phase<AiJob | null>; onRetry: () => void; onReanalyze?: () => void; reference?: string | null }) {
  const p = useFighterPalette();
  const j = job.data;
  if (!j && job.loading) return <CardSkeleton height={160} />;
  if (!j && job.error && !isJobNotComplete(job.error)) {
    return (
      <RoCard title={vai.result}>
        <Text style={[TEXT.body, { color: p.ink }]}>{errorText(job.error)}</Text>
        <ActionButton label={vai.retry} variant="secondary" icon="retry" onPress={onRetry} />
      </RoCard>
    );
  }
  if (!j) {
    return (
      <RoCard title={vai.result}>
        <StatusChip spec={jobChip(null)} />
        <Text style={[TEXT.body, { color: p.ink }]}>{vai.noJob}</Text>
      </RoCard>
    );
  }
  if (j.status === "FAILED") {
    return (
      <RoCard title={vai.result} tone="error">
        <StatusChip spec={jobChip(j.status)} />
        <View style={styles.row}>
          <Icon name="xCircle" size={24} color={p.danger} />
          <Text style={[TEXT.bodyBold, { color: p.ink, flex: 1 }]}>{vai.failed}</Text>
        </View>
        {onReanalyze ? <ReanalyzeButton onPress={onReanalyze} /> : null}
      </RoCard>
    );
  }
  if (j.status !== "DONE") {
    return (
      <RoCard title={vai.result}>
        <StatusChip spec={jobChip(j.status)} />
        <StepProgress status={j.status} />
        <Text style={[TEXT.body, { color: p.ink }]}>{vai.running}</Text>
      </RoCard>
    );
  }
  return (
    <RoCard title={vai.result}>
      <View style={styles.chips}>
        <StatusChip spec={jobChip(j.status)} />
        {reference !== undefined ? <ReferenceChip technique={reference} /> : null}
      </View>
      {j.score != null ? (
        <View accessible accessibilityLabel={`${vai.scoreLabel} ${j.score}`} style={{ gap: 2 }}>
          <Text style={[TEXT.caption, { color: p.ink }]}>{vai.scoreLabel}</Text>
          <Text testID="ai-score" style={[styles.score, { color: p.ink }]}>
            {String(j.score)}
          </Text>
        </View>
      ) : null}
      {j.exerciseName ? <InfoLine label="Bài tập" value={j.exerciseName} /> : null}
    </RoCard>
  );
}

function AlertsCard({ phase, groups, onSeek, onRetry }: { phase: Phase<AiHealthAlerts>; groups: AlertGroup[]; onSeek: (ms: number) => void; onRetry: () => void }) {
  const p = useFighterPalette();
  return (
    <RoCard title={vai.health}>
      {phase.loading && !phase.data ? <RowSkeletons count={2} height={56} /> : null}
      {phase.error && !phase.data ? (
        <>
          <Text style={[TEXT.body, { color: p.ink }]}>{errorText(phase.error)}</Text>
          <ActionButton label={vai.retry} variant="secondary" icon="retry" onPress={onRetry} />
        </>
      ) : null}
      {phase.data?.hasImpairment ? <StatusChip spec={{ label: vai.impairment, tone: "danger", icon: "warning" }} /> : null}
      {phase.data && groups.length === 0 ? (
        <View style={styles.row} testID="ai-no-alerts">
          <Icon name="success" size={24} color={p.success} />
          <Text style={[TEXT.bodyBold, { color: p.ink, flex: 1 }]}>{vai.noAlerts}</Text>
        </View>
      ) : null}
      {groups.map((g) => (
        <JointGroup key={g.joint} group={g} onSeek={onSeek} />
      ))}
    </RoCard>
  );
}

function JointGroup({ group, onSeek }: { group: AlertGroup; onSeek: (ms: number) => void }) {
  const p = useFighterPalette();
  const [open, setOpen] = useState(false);
  const sev = severityChip(group.worst);
  return (
    <View style={[styles.group, { borderColor: p.line }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${group.label}, ${sev.label}, ${vai.times(group.items.length)}`}
        accessibilityHint={open ? vai.collapse : vai.expand}
        onPress={() => setOpen((o) => !o)}
        style={styles.groupHead}
      >
        <View style={{ flex: 1, gap: 6 }}>
          <Text style={[TEXT.bodyBold, { color: p.ink }]}>{group.label}</Text>
          <View style={styles.chips}>
            <StatusChip spec={sev} />
            <Text style={[TEXT.detail, { color: p.ink }]}>{vai.times(group.items.length)}</Text>
          </View>
        </View>
        <Icon name="chevronDown" size={24} color={p.ink} />
      </Pressable>
      {open
        ? group.items.map((a, i) => (
            <View key={`${a.triggerTimeMs}-${i}`} style={[styles.alertItem, { borderColor: p.line }]}>
              <View style={styles.chips}>
                <Pressable accessibilityRole="button" accessibilityLabel={vai.seekA11y(mmss(a.triggerTimeMs))} onPress={() => onSeek(a.triggerTimeMs)} style={[styles.seek, { borderColor: p.link }]}>
                  <Icon name="history" size={16} color={p.link} />
                  <Text style={[TEXT.bodyBold, { color: p.link }]}>{vai.at(mmss(a.triggerTimeMs))}</Text>
                </Pressable>
                <StatusChip spec={severityChip(a.severity)} />
                <Text style={[TEXT.detail, { color: p.ink }]}>{jointStateText(a.state)}</Text>
              </View>
              {a.recommendation ? (
                <Text style={[TEXT.body, { color: p.ink }]} numberOfLines={2}>
                  {a.recommendation}
                </Text>
              ) : null}
            </View>
          ))
        : null}
    </View>
  );
}

function ReviewCard({ phase, items, onRetry }: { phase: Phase<{ state: AiCoachingState | null; moves: AiMovementReviews | null }>; items: ReviewItem[]; onRetry: () => void }) {
  const p = useFighterPalette();
  return (
    <RoCard title={vai.coachReview}>
      {phase.loading && !phase.data ? <RowSkeletons count={2} height={64} /> : null}
      {phase.error && !phase.data ? (
        <>
          <Text style={[TEXT.body, { color: p.ink }]}>{errorText(phase.error)}</Text>
          <ActionButton label={vai.retry} variant="secondary" icon="retry" onPress={onRetry} />
        </>
      ) : null}
      {phase.data && items.length === 0 ? <Text style={[TEXT.body, { color: p.ink }]}>{vai.noReview}</Text> : null}
      {items.map((r, i) => (
        <View key={r.id} style={[styles.reviewItem, i > 0 && { borderTopWidth: 1, borderColor: p.line, paddingTop: 12 }]}>
          <View style={styles.chips}>
            <StatusChip spec={decisionChip(r.decision)} />
            {r.segment ? <Text style={[TEXT.detail, { color: p.ink }]}>{r.segment}</Text> : null}
          </View>
          {r.correctedLabel ? <Text style={[TEXT.bodyBold, { color: p.ink }]}>{vai.corrected(r.correctedLabel)}</Text> : null}
          {r.rating != null ? <Text style={[TEXT.body, { color: p.ink }]}>{vai.rating(r.rating)}</Text> : null}
          {r.notes ? <Text style={[TEXT.body, { color: p.ink }]}>{r.notes}</Text> : null}
          <Text style={[TEXT.detail, { color: p.ink }]}>{r.by}</Text>
        </View>
      ))}
    </RoCard>
  );
}

type DetailTab = "analysis" | "movement" | "review";
const MINI_AT = 24;

/** Bộ chọn 3 tab dạng segmented: tab đang chọn = nền nhấn nhạt + chữ màu nhấn. */
function Segmented({ value, onChange, tabs }: { value: DetailTab; onChange: (t: DetailTab) => void; tabs: readonly { key: DetailTab; label: string }[] }) {
  const p = useFighterPalette();
  return (
    <View accessibilityRole="tablist" testID="ai-tabs" style={[styles.seg, { borderColor: p.line, backgroundColor: p.surface }]}>
      {tabs.map((t) => {
        const on = t.key === value;
        return (
          <Pressable
            key={t.key}
            testID={`ai-tab-${t.key}`}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(t.key)}
            style={({ pressed }) => [styles.segItem, { backgroundColor: on ? p.accentSoft : pressed ? p.surface2 : "transparent" }]}
          >
            <Text style={[TEXT.bodyBold, { color: on ? p.activeInk : p.ink }]} numberOfLines={1}>
              {t.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  seg: { flexDirection: "row", borderRadius: 12, borderWidth: 1, padding: 4, gap: 4 },
  segItem: { flex: 1, minHeight: 48, borderRadius: 9, alignItems: "center", justifyContent: "center", paddingHorizontal: 6 },
  header: { minHeight: 64, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16 },
  back: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  pad: { padding: 16, gap: 16 },
  info: { gap: 4 },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  chips: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  score: { fontSize: 36, lineHeight: 44, fontWeight: "700" },
  group: { borderTopWidth: 1, paddingTop: 8 },
  groupHead: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 56 },
  alertItem: { gap: 6, paddingVertical: 8, paddingLeft: 12, borderLeftWidth: 2, marginBottom: 8 },
  seek: { flexDirection: "row", alignItems: "center", gap: 4, minHeight: 48, paddingHorizontal: 12, borderRadius: 24, borderWidth: 1 },
  reviewItem: { gap: 6 },
  well: { justifyContent: "space-between" },
  wellCenter: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  wellBtn: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 48, paddingHorizontal: 16, borderRadius: 24, borderWidth: 1 },
  playBtn: { width: 56, height: 56, borderRadius: 28, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  wellTrack: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, height: 48 },
  trackWrap: { flex: 1, height: 48, justifyContent: "center" },
  trackLine: { position: "absolute", left: 0, right: 0, height: 4, borderRadius: 2 },
  marker: { position: "absolute", top: 0, width: 48, height: 48, alignItems: "center", justifyContent: "center" },
  markerDot: { width: 14, height: 14, borderRadius: 7, borderWidth: 2 },
});
