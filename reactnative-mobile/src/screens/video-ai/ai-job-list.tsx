import { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";

import type { AiJob } from "@/api/video-ai.types";
import { Icon } from "@/components/icon";
import { vai } from "@/i18n/video-ai";
import { FilterChips } from "@/screens/doctor/detail/detail-ui";
import { RoRow, RoScreen, RowSkeletons, StatusChip, Stack } from "@/screens/coach/readonly/ro-ui";
import { ActionButton, ConnectionBanner, MessageCard, TEXT, useDelayedFlag } from "@/screens/fighter/bout-states";
import { useFighterPalette } from "@/screens/fighter/redesign/palette";

import { useAiEnabled, useAiNames, useJobs, useOpenVideo, useVideoTitles, type JobsData } from "./ai-data";
import { arrangeJobs, isCapped, jobChip, relTime, REVIEW_CHIP, scoreText, STATUS_FILTERS, type StatusFilter } from "./ai-model";

type Loader = { data: JobsData | null; error: string; loading: boolean; reload: () => void };

/** Danh sách job AI (GET /jobs, lọc trạng thái trên máy, mặc định "Xong", mới nhất trước). */
export function AiJobList({
  load,
  names,
  titles,
  fighterId,
  onClearFighter,
  initialStatus = "DONE",
}: {
  load: Loader;
  names: Record<string, string>;
  titles: Record<string, string>;
  fighterId?: string;
  onClearFighter?: () => void;
  initialStatus?: StatusFilter;
}) {
  const open = useOpenVideo();
  const [status, setStatus] = useState<StatusFilter>(initialStatus);
  const rows = useMemo(() => (load.data ? arrangeJobs(load.data.jobs, { status, fighterId }, load.data.pending) : []), [load.data, status, fighterId]);
  const firstLoad = load.loading && !load.data;
  const skeleton = useDelayedFlag(firstLoad);
  const filtered = status !== "ALL" || Boolean(fighterId);
  const empty = Boolean(load.data) && rows.length === 0;
  const chips = useMemo(() => STATUS_FILTERS.map((k) => ({ key: k, label: vai.statusFilter[k]! })), []);

  return (
    <Stack>
      <FilterChips items={chips} value={status} onChange={setStatus} label={vai.filterStatus} />
      {fighterId && onClearFighter ? (
        <View style={styles.fighterFilter}>
          <StatusChip spec={{ label: names[fighterId] ?? vai.fighter, tone: "info", icon: "info" }} />
          <ActionButton label={vai.clear} variant="secondary" icon="close" onPress={onClearFighter} />
        </View>
      ) : null}
      {load.error ? <ConnectionBanner error={load.error} onRetry={load.reload} retrying={load.loading} hasData={Boolean(load.data)} /> : null}
      {firstLoad && !load.error && skeleton ? <RowSkeletons count={4} height={120} /> : null}
      {empty ? (
        <MessageCard
          icon="aiAlert"
          title={filtered && load.data!.jobs.length > 0 ? vai.jobsEmptyFiltered : vai.jobsEmptyTitle}
          description={filtered && load.data!.jobs.length > 0 ? vai.jobsEmptyFilteredDesc : vai.jobsEmptyDesc}
        >
          {status !== "ALL" && load.data!.jobs.length > 0 ? <ActionButton label={vai.statusFilter.ALL!} variant="secondary" icon="filter" onPress={() => setStatus("ALL")} /> : null}
        </MessageCard>
      ) : null}
      {rows.map((j) => (
        <JobRow key={j.id} job={j} name={(j.fighterId && names[j.fighterId]) || vai.fighter} title={(j.videoId && titles[j.videoId]) || vai.untitled} review={load.data!.pending.has(j.id)} onPress={j.videoId ? () => open(j.videoId!, j.id, "result") : undefined} />
      ))}
      {load.data && isCapped(load.data.total) && rows.length > 0 ? <CappedLine /> : null}
    </Stack>
  );
}

export function CappedLine() {
  const p = useFighterPalette();
  return (
    <Text testID="jobs-capped" style={[TEXT.detail, { color: p.ink, textAlign: "center", paddingVertical: 8 }]}>
      {vai.capped}
    </Text>
  );
}

function JobRow({ job, name, title, review, onPress }: { job: AiJob; name: string; title: string; review: boolean; onPress?: () => void }) {
  const p = useFighterPalette();
  const n = job.alertCount ?? 0;
  const chip = jobChip(job.status);
  const score = scoreText(job);
  const when = relTime(job.createdAt);
  const scoreLabel = score === "–" ? vai.noScore : vai.score(score);
  return (
    <RoRow
      title={name}
      lines={[title]}
      onPress={onPress}
      label={[name, title, chip.label, review ? REVIEW_CHIP.label : "", scoreLabel, vai.alerts(n), when].filter(Boolean).join(", ")}
    >
      <View style={styles.chips}>
        <StatusChip spec={chip} />
        {review ? <StatusChip spec={REVIEW_CHIP} /> : null}
      </View>
      <View style={styles.meta}>
        <Text style={[TEXT.bodyBold, { color: p.ink }]}>{scoreLabel}</Text>
        <View style={styles.alert}>
          {n > 0 ? <Icon name="warning" size={16} color={p.danger} /> : null}
          <Text style={[TEXT.detail, { color: n > 0 ? p.danger : p.ink, fontWeight: n > 0 ? "700" : "400" }]}>{vai.alerts(n)}</Text>
        </View>
        <Text style={[TEXT.detail, { color: p.ink }]}>{when}</Text>
      </View>
    </RoRow>
  );
}

/** Màn "Phân tích video AI" (Admin, mở từ Tổng quan): toàn bộ job, lọc trạng thái. */
export function AiJobsScreen() {
  const params = useLocalSearchParams<{ status?: string; fighterId?: string }>();
  const [fighterId, setFighterId] = useState(typeof params.fighterId === "string" ? params.fighterId : "");
  const enabled = useAiEnabled();
  const load = useJobs(enabled, false);
  const names = useAiNames(enabled);
  const titles = useVideoTitles(enabled);
  const initial = (STATUS_FILTERS as readonly string[]).includes(params.status ?? "") ? (params.status as StatusFilter) : "ALL";
  return (
    <RoScreen title={vai.jobsTitle} back onRefresh={() => Promise.all([load.refresh(), titles.refresh()])} refreshing={load.loading && !load.data}>
      <AiJobList load={load} names={names} titles={titles.data ?? {}} initialStatus={initial} fighterId={fighterId || undefined} onClearFighter={() => setFighterId("")} />
    </RoScreen>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
  meta: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: 12, rowGap: 4, marginTop: 4 },
  alert: { flexDirection: "row", alignItems: "center", gap: 4 },
  fighterFilter: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
});
