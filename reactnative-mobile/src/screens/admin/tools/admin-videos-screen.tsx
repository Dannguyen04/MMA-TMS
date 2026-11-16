import { useEffect, useMemo, useRef, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";

import { coachApi } from "@/api/coach";
import { RolePage } from "@/components/role-page";
import { adminTools as t } from "@/i18n/admin-tools";
import { FighterPick } from "@/screens/coach/fighter-pick";
import { fighterName } from "@/screens/coach/readonly/ro-format";
import { useSource } from "@/screens/coach/today/coach-today-screen";
import { VideoJobsList, VideoLibraryList } from "@/screens/coach/video/video-list";
import { CampTabs } from "@/screens/fight-camp/camp-lit";
import { useAiEnabled, useJobs, useVideoTitles } from "@/screens/video-ai/ai-data";
import { STATUS_FILTERS, type StatusFilter } from "@/screens/video-ai/ai-model";

import { adminVideoHref } from "./admin-paths";

type Seg = "library" | "ai";

/**
 * Admin Video (redesign step 23), `quan-tri/video`: underline tabs Thư viện · Phân tích AI (the failed count in a small
 * red box), one fighter field for both, then rows. Replaces the old video list, video library and both AI job lists.
 * `?seg=ai&status=FAILED` (Tổng quan "Phân tích lỗi") and `?fighterId=` (the fighter page) preset it.
 */
export function AdminVideosScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ seg?: string; status?: string; fighterId?: string; t?: string }>();
  const enabled = useAiEnabled();
  const jobs = useJobs(enabled, false);
  const titles = useVideoTitles(enabled);
  const [fighters, reloadFighters] = useSource(() => coachApi.listFighters({ limit: 100 }).then((p) => p.data), "av|fighters");
  const list = fighters.state === "ok" ? fighters.data : [];
  const names = useMemo(() => Object.fromEntries(list.map((f) => [f.id, fighterName(f)])), [list]);
  const [seg, setSeg] = useState<Seg>("library");
  const [fighterId, setFighterId] = useState("");
  const [status, setStatus] = useState<StatusFilter>("ALL");
  const libRefresh = useRef<() => Promise<unknown>>(() => Promise.resolve());

  useEffect(() => {
    if (params.seg === "ai" || params.seg === "library") setSeg(params.seg);
    if (typeof params.fighterId === "string") setFighterId(params.fighterId);
    setStatus((STATUS_FILTERS as readonly string[]).includes(params.status ?? "") ? (params.status as StatusFilter) : "ALL");
  }, [params.seg, params.fighterId, params.status, params.t]);

  const failed = (jobs.data?.jobs ?? []).filter((j) => j.status === "FAILED").length;
  const back = () => (router.canGoBack() ? router.back() : router.replace("/(admin)" as never));
  const open = (id: string, jobId?: string) => router.push(adminVideoHref(id, jobId) as never);
  const refresh = () => Promise.all([jobs.refresh(), titles.refresh(), seg === "library" ? libRefresh.current() : null]);

  return <RolePage testID="admin-videos" title={t.videos} onBack={back} onRefresh={refresh}>
    <CampTabs alertLabel="" value={seg} onChange={setSeg} tabs={[
      { key: "library", label: t.library },
      { key: "ai", label: t.ai, count: failed, a11y: t.aiA11y(failed) },
    ]}/>
    <FighterPick testID="admin-video-fighter" placeholder={t.pickFighter} allLabel={t.allFighters} empty={t.noFighters} failed={t.fightersFailed} retry={t.retry}
      state={fighters.state} fighters={list} value={fighterId} onChange={setFighterId} onRetry={reloadFighters}/>
    {seg === "library"
      ? <VideoLibraryList enabled={enabled} fighterId={fighterId} names={names} jobs={jobs.data?.jobs ?? []} bindRefresh={(fn) => { libRefresh.current = fn; }} onOpen={open}/>
      : <VideoJobsList load={jobs} names={names} titles={titles.data ?? {}} fighterId={fighterId} onOpen={open} initialStatus={status} failedFirst/>}
  </RolePage>;
}
