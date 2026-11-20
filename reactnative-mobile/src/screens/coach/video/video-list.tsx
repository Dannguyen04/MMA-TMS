import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, Text } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";

import { coachApi } from "@/api/coach/coach";
import { videoAiApi } from "@/api/video/video-ai";
import type { AiJob, AiVideo } from "@/api/video/video-ai.types";
import { StaggerList } from "@/components/motion/motion";
import { EmptyLine, RolePage } from "@/components/navigation/role-page";
import { coachVideo as t } from "@/i18n/coach/coach-video";
import { media } from "@/i18n/video/media";
import { videoTitle } from "@/i18n/common/server-text";
import { FighterPick } from "@/screens/coach/fighter-pick";
import { CoachBell } from "@/screens/coach/nav/coach-unread";
import { fighterName } from "@/screens/coach/readonly/ro-format";
import { useSource } from "@/screens/coach/today/coach-today-screen";
import { CampTabs } from "@/shared/ui/camp-lit";
import { Action, Choices } from "@/shared/ui/camp-ui";
import { RetryRow, SlipRow } from "@/screens/fighter/redesign/tab-page";
import { dmLocal } from "@/screens/fighter/health/health-model";
import { rowView, statusWord } from "@/screens/fighter/video/video-v2-model";
import { trainingLabel } from "@/screens/media/video-model";
import { useAiEnabled, useJobs, useVideoTitles, type JobsData } from "@/screens/video-ai/ai-data";
import { arrangeJobs, isCapped, latestJobFor, relTime, STATUS_FILTERS, type StatusFilter } from "@/screens/video-ai/ai-model";
import { useThemePreference } from "@/theme";
import { readableTextStyle } from "@/theme/typography";
import { coachUploadHref, coachVideoHref } from "./video-model";

type Seg = "library" | "review";
const PAGE = 30;
const TYPES = ["", ...Object.keys(media.training)] as const;

/**
 * Coach Video (redesign step 19): underline tabs Thư viện · Cần duyệt (the waiting count in a small red box), one
 * fighter field that filters both, then rows. Thư viện leads with the lit "Tải video lên" and training-type chips;
 * Cần duyệt keeps the job status chips and puts analyses waiting for the coach first. Only the status word is coloured.
 */
export function CoachVideosScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ fighterId?: string; seg?: string; t?: string }>();
  const enabled = useAiEnabled();
  const jobs = useJobs(enabled, true);
  const titles = useVideoTitles(enabled);
  const [fighters, reloadFighters] = useSource(() => coachApi.listFighters({ limit: 100 }).then(p => p.data), "cv|fighters");
  const list = fighters.state === "ok" ? fighters.data : [];
  const names = useMemo(() => Object.fromEntries(list.map(f => [f.id, fighterName(f)])), [list]);
  const [seg, setSeg] = useState<Seg>("library");
  const [fighterId, setFighterId] = useState("");
  const libRefresh = useRef<() => Promise<unknown>>(() => Promise.resolve());

  // The fighter page and Lịch open this page on a fighter and/or on Cần duyệt.
  useEffect(() => {
    if (typeof params.fighterId === "string") setFighterId(params.fighterId);
    if (params.seg === "review" || params.seg === "library") setSeg(params.seg);
  }, [params.fighterId, params.seg, params.t]);

  // Coming back from a video shows its new state (a review just saved, a new upload).
  const seen = useRef(false);
  useFocusEffect(useCallback(() => {
    if (!seen.current) { seen.current = true; return; }
    void jobs.refresh(); void libRefresh.current();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []));

  const pending = jobs.data?.pending.size ?? 0;
  const back = () => (router.canGoBack() ? router.back() : router.replace("/(coach)/hom-nay" as never));
  const refresh = () => Promise.all([jobs.refresh(), titles.refresh(), seg === "library" ? libRefresh.current() : null]);

  return <RolePage testID="coach-videos" title={t.title} onBack={back} right={<CoachBell/>} onRefresh={refresh}>
    <CampTabs alertLabel="" value={seg} onChange={setSeg} tabs={[
      { key: "library", label: t.library },
      { key: "review", label: t.review, count: pending, a11y: t.reviewA11y(pending) },
    ]}/>
    {seg === "library" ? <Action label={t.upload} onPress={() => router.push(coachUploadHref(fighterId || undefined))}/> : null}
    <FighterPick testID="video-filter-fighter" placeholder={t.pickFighter} allLabel={t.allFighters} empty={t.noFighters} failed={t.fightersFailed} retry={t.retry}
      state={fighters.state} fighters={list} value={fighterId} onChange={setFighterId} onRetry={reloadFighters}/>
    {seg === "library"
      ? <VideoLibraryList enabled={enabled} fighterId={fighterId} names={names} jobs={jobs.data?.jobs ?? []} bindRefresh={fn => { libRefresh.current = fn; }}
        onOpen={(id, jobId) => router.push(coachVideoHref(id, jobId))}/>
      : <VideoJobsList load={jobs} names={names} titles={titles.data ?? {}} fighterId={fighterId} onOpen={(id, jobId) => router.push(coachVideoHref(id, jobId))}/>}
  </RolePage>;
}

/** Thư viện rows (shared with admin Video, step 23). */
export function VideoLibraryList({ enabled, fighterId, names, jobs, bindRefresh, onOpen }: {
  enabled: boolean; fighterId: string; names: Record<string, string>; jobs: readonly AiJob[];
  bindRefresh: (fn: () => Promise<unknown>) => void; onOpen: (videoId: string, jobId?: string) => void;
}) {
  const { colors: c } = useThemePreference();
  const [type, setType] = useState<string>("");
  const [extra, setExtra] = useState<{ items: AiVideo[]; cursor: string | null; busy: boolean }>({ items: [], cursor: null, busy: false });
  const query = { fighterId: fighterId || undefined, trainingType: type || undefined, limit: PAGE };
  const [src, reload, refresh] = useSource(async () => {
    if (!enabled) return { items: [] as AiVideo[], cursor: null as string | null };
    const page = await videoAiApi.listVideos(query);
    setExtra({ items: [], cursor: null, busy: false });
    return { items: page.items, cursor: page.hasNextPage ? page.endCursor : null };
  }, `cv|lib|${enabled}|${fighterId}|${type}`);
  bindRefresh(refresh);
  const loaded = src.state === "ok" ? src.data : null;
  const items = loaded ? [...loaded.items, ...extra.items] : [];
  const cursor = extra.items.length ? extra.cursor : loaded?.cursor ?? null;
  const more = () => {
    if (!cursor || extra.busy) return;
    setExtra(x => ({ ...x, busy: true }));
    videoAiApi.listVideos({ ...query, cursor })
      .then(p => setExtra(x => ({ items: [...x.items, ...p.items], cursor: p.hasNextPage ? p.endCursor : null, busy: false })))
      .catch(() => setExtra(x => ({ ...x, busy: false })));
  };
  const filtered = Boolean(fighterId || type);
  return <>
    <Choices chips wrap value={type} onChange={setType} options={TYPES.map(k => ({ value: k, label: k ? media.training[k as keyof typeof media.training] : t.allTypes }))}/>
    {src.state === "loading" ? <ActivityIndicator color={c.lotus} style={{ paddingVertical: 32 }}/> : null}
    {src.state === "error" ? <RetryRow message={t.libFailed} retry={t.retry} onRetry={reload}/> : null}
    {loaded && !items.length ? <EmptyLine testID="video-lib-empty" title={filtered ? t.libEmptyFiltered : t.libEmpty}/> : null}
    {items.length ? <StaggerList testID="video-lib">
      {items.map((v, k) => {
        const job = latestJobFor(jobs, v.id);
        const r = rowView(v, job);
        const title = videoTitle(v.title) || t.untitled;
        const word = statusWord(job);
        const line = [names[v.fighterId], trainingLabel(v.trainingType), dmLocal(v.createdAt)].filter(Boolean).join(" · ");
        return <SlipRow key={v.id} testID={`video-row-${v.id}`} lead={r.lead} leadTone={r.leadTone} icon={r.kind === "wait" ? "history" : undefined}
          title={title} word={word} wordTone={r.lineTone} line={line} a11y={t.rowA11y(title, word, line)} last={k === items.length - 1}
          onPress={() => onOpen(v.id, job?.id)}/>;
      })}
    </StaggerList> : null}
    {cursor ? <MoreLink onPress={more} busy={extra.busy}/> : null}
  </>;
}

/** Job rows with status chips (coach Cần duyệt; admin Phân tích AI with failed first, step 23). */
export function VideoJobsList({ load, names, titles, fighterId, onOpen, initialStatus = "ALL", failedFirst = false }: {
  load: { data: JobsData | null; error: unknown; loading: boolean; reload: () => void };
  names: Record<string, string>; titles: Record<string, string>; fighterId: string; onOpen: (videoId: string, jobId: string) => void;
  initialStatus?: StatusFilter; failedFirst?: boolean;
}) {
  const { colors: c } = useThemePreference();
  const [status, setStatus] = useState<StatusFilter>(initialStatus);
  useEffect(() => setStatus(initialStatus), [initialStatus]);
  const rows = useMemo(() => {
    if (!load.data) return [];
    const r = arrangeJobs(load.data.jobs, { status, fighterId: fighterId || undefined }, load.data.pending);
    return failedFirst ? [...r.filter(j => j.status === "FAILED"), ...r.filter(j => j.status !== "FAILED")] : r;
  }, [load.data, status, fighterId, failedFirst]);
  const filtered = status !== "ALL" || Boolean(fighterId);
  return <>
    <Choices chips wrap value={status} onChange={setStatus} options={STATUS_FILTERS.map(k => ({ value: k, label: t.statusFilter[k]! }))}/>
    {!load.data && load.loading ? <ActivityIndicator color={c.lotus} style={{ paddingVertical: 32 }}/> : null}
    {!load.data && load.error ? <RetryRow message={t.jobsFailed} retry={t.retry} onRetry={load.reload}/> : null}
    {load.data && !rows.length ? <EmptyLine testID="video-jobs-empty" title={filtered ? t.jobsEmptyFiltered : t.jobsEmpty}/> : null}
    {rows.length ? <StaggerList testID="video-jobs">
      {rows.map((j, k) => {
        const waiting = load.data!.pending.has(j.id);
        const r = rowView({ trainingType: "", createdAt: j.createdAt }, j);
        const title = (j.videoId && titles[j.videoId]) || t.untitled;
        const word = waiting ? t.waiting : statusWord(j);
        const detail = r.kind === "done" ? t.alerts(j.alertCount ?? 0) : r.kind === "wait" ? t.sentAt(relTime(j.createdAt)) : "";
        const line = [(j.fighterId && names[j.fighterId]) || "", detail].filter(Boolean).join(" · ");
        return <SlipRow key={j.id} testID={`job-row-${j.id}`} lead={r.lead} leadTone={waiting ? undefined : r.leadTone} icon={r.kind === "wait" ? "history" : undefined}
          title={title} word={word} wordTone={waiting ? "warn" : r.lineTone} line={line} a11y={t.rowA11y(title, word, line)} last={k === rows.length - 1}
          onPress={j.videoId ? () => onOpen(j.videoId!, j.id) : undefined}/>;
      })}
    </StaggerList> : null}
    {load.data && isCapped(load.data.total) && rows.length ? <Text testID="jobs-capped" style={{ ...readableTextStyle(14), color: c.ink }}>{t.capped}</Text> : null}
  </>;
}

function MoreLink({ onPress, busy }: { onPress: () => void; busy: boolean }) {
  const { colors: c } = useThemePreference();
  return <Pressable accessibilityRole="button" onPress={onPress} disabled={busy} style={{ minHeight: 48, alignItems: "center", justifyContent: "center" }}>
    {busy ? <ActivityIndicator color={c.lotus}/> : <Text style={{ ...readableTextStyle(14.5, true), color: c.lotus }}>{t.showMore}</Text>}
  </Pressable>;
}
