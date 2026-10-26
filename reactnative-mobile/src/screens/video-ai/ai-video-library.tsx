import { useCallback, useMemo, useRef, useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { ScrollView, StyleSheet } from "react-native";

import { videoAiApi } from "@/api/video-ai";
import type { AiJob, AiVideo } from "@/api/video-ai.types";
import { FilterSelect, type FilterOption } from "@/components/filter-sheet";
import { media } from "@/i18n/media";
import { vai } from "@/i18n/video-ai";
import { LoadMore, RoRow, RoScreen, RowSkeletons, Stack } from "@/screens/coach/readonly/ro-ui";
import { vnDate } from "@/screens/coach/readonly/ro-format";
import { ActionButton, ConnectionBanner, MessageCard, useDelayedFlag } from "@/screens/fighter/bout-states";
import { useFighterPalette } from "@/screens/fighter/redesign/palette";
import { useLoad } from "@/screens/fighter/use-load";

import { useAiEnabled, useAiNames, useJobs, useOpenVideo } from "./ai-data";
import { durationShort, jobChip, latestJobFor, trainingText } from "./ai-model";
import { VideoThumb } from "./ai-ui";

const PAGE = 30;

export function libraryLines(v: Pick<AiVideo, "fighterId" | "trainingType" | "durationMs" | "createdAt">, names: Record<string, string>): string[] {
  return [names[v.fighterId] ?? "", [trainingText(v.trainingType), durationShort(v.durationMs), vnDate(v.createdAt)].filter(Boolean).join(" · ")].filter(Boolean);
}

/** Thư viện video (GET /videos, phân trang con trỏ): lọc võ sĩ + loại tập; chip trạng thái phân tích từ /jobs. */
export function AiVideoLibrary({
  enabled,
  names,
  jobs,
  fighterId,
  onFighter,
  bindRefresh,
}: {
  enabled: boolean;
  names: Record<string, string>;
  jobs: readonly AiJob[];
  fighterId: string;
  onFighter: (id: string) => void;
  bindRefresh?: (fn: () => Promise<unknown>) => void;
}) {
  const p = useFighterPalette();
  const open = useOpenVideo();
  const [training, setTraining] = useState("");
  const [more, setMore] = useState<{ items: AiVideo[]; cursor: string | null; loading: boolean }>({ items: [], cursor: null, loading: false });

  const run = useCallback(async () => {
    const page = await videoAiApi.listVideos({ fighterId: fighterId || undefined, trainingType: training || undefined, limit: PAGE });
    setMore({ items: [], cursor: page.hasNextPage ? page.endCursor : null, loading: false });
    return page;
  }, [fighterId, training]);
  const list = useLoad(enabled, `vai-lib|${fighterId}|${training}`, run, { keepOnError: true });
  bindRefresh?.(list.refresh);
  const items = useMemo(() => [...(list.data?.items ?? []), ...more.items], [list.data, more.items]);
  const firstLoad = list.loading && !list.data;
  const skeleton = useDelayedFlag(firstLoad);
  const filtered = Boolean(fighterId || training);
  const empty = Boolean(list.data) && items.length === 0;

  const fighterOptions = useMemo<FilterOption<string>[]>(
    () => [{ value: "", label: vai.allFighters }, ...Object.entries(names).map(([id, name]) => ({ value: id, label: name }))],
    [names],
  );
  const trainingOptions = useMemo<FilterOption<string>[]>(
    () => [{ value: "", label: vai.allTraining }, ...Object.entries(media.training).map(([value, label]) => ({ value, label }))],
    [],
  );

  const loadMore = () => {
    if (!more.cursor || more.loading) return;
    const cursor = more.cursor;
    setMore((m) => ({ ...m, loading: true }));
    void videoAiApi
      .listVideos({ fighterId: fighterId || undefined, trainingType: training || undefined, limit: PAGE, cursor })
      .then((page) => setMore((m) => ({ items: [...m.items, ...page.items], cursor: page.hasNextPage ? page.endCursor : null, loading: false })))
      .catch(() => setMore((m) => ({ ...m, loading: false })));
  };

  return (
    <Stack>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.filters} style={styles.filterRow}>
        <FilterSelect mutedColor={p.filterMuted} label={vai.filterFighter} value={fighterId} onChange={onFighter} options={fighterOptions} allValue="" style={styles.filter} />
        <FilterSelect mutedColor={p.filterMuted} label={vai.filterTraining} value={training} onChange={setTraining} options={trainingOptions} allValue="" style={styles.filter} />
      </ScrollView>
      {list.error ? <ConnectionBanner error={list.error} onRetry={list.reload} retrying={list.loading} hasData={Boolean(list.data)} /> : null}
      {firstLoad && !list.error && skeleton ? <RowSkeletons count={4} height={96} /> : null}
      {empty ? (
        <MessageCard icon="video" title={filtered ? vai.libEmptyFiltered : vai.libEmptyTitle} description={filtered ? vai.libEmptyFilteredDesc : vai.libEmptyDesc}>
          {filtered ? (
            <ActionButton
              label={vai.clear}
              variant="secondary"
              icon="close"
              onPress={() => {
                onFighter("");
                setTraining("");
              }}
            />
          ) : null}
        </MessageCard>
      ) : null}
      {items.map((v) => {
        const job = latestJobFor(jobs, v.id);
        return (
          <RoRow
            key={v.id}
            leading={<VideoThumb />}
            title={v.title || vai.untitled}
            lines={libraryLines(v, names)}
            chip={jobChip(job?.status)}
            onPress={() => open(v.id, job?.id)}
          />
        );
      })}
      {more.cursor ? <LoadMore onPress={loadMore} loading={more.loading} /> : null}
    </Stack>
  );
}

const styles = StyleSheet.create({
  filterRow: { flexGrow: 0 },
  filters: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 2, paddingRight: 16 },
  filter: { minHeight: 48, height: 48, maxWidth: 360 },
});

/** Thư viện mở riêng (Admin, từ "Xem tất cả" ở chi tiết võ sĩ), có nút quay lại. */
export function AiLibraryScreen() {
  const params = useLocalSearchParams<{ fighterId?: string }>();
  const enabled = useAiEnabled();
  const names = useAiNames(enabled);
  const jobs = useJobs(enabled, false);
  const [fighterId, setFighterId] = useState(typeof params.fighterId === "string" ? params.fighterId : "");
  const refreshRef = useRef<(() => Promise<unknown>) | null>(null);
  return (
    <RoScreen title={vai.segLibrary} back onRefresh={() => Promise.all([jobs.refresh(), refreshRef.current?.()])} refreshing={false}>
      <AiVideoLibrary
        enabled={enabled}
        names={names}
        jobs={jobs.data?.jobs ?? []}
        fighterId={fighterId}
        onFighter={setFighterId}
        bindRefresh={(fn) => {
          refreshRef.current = fn;
        }}
      />
    </RoScreen>
  );
}
