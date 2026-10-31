import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";

import { coachApi } from "@/api/coach";
import { SESSION_STATUSES, type SessionStatus } from "@/api/types";
import { FilterSelect, type FilterOption } from "@/components/filter-sheet";
import { coachRo } from "@/i18n/coach-ro";
import { useFighterPalette } from "@/screens/fighter/redesign/palette";
import { ActionButton, ConnectionBanner, MessageCard, useDelayedFlag } from "@/screens/fighter/bout-states";
import { LoadMore, RoScreen, RowSkeletons, Stack, useGo } from "./ro-ui";
import { SessionGroups } from "./session-groups";
import { useCoachEnabled, useFighterNames } from "./use-coach";
import { usePagedList } from "./use-paged-list";
import { Icon } from "@/components/icon";
import { vai } from "@/i18n/video-ai";
import { TEXT } from "@/screens/fighter/bout-states";
import { useAiEnabled, useJobs } from "@/screens/video-ai/ai-data";

const DAY = 86_400_000;
const OPTIONS: FilterOption<SessionStatus | "">[] = [
  { value: "", label: coachRo.schedule.all },
  ...SESSION_STATUSES.map((s) => ({ value: s, label: coachRo.sessionStatus[s] })),
];

/** C-5: lịch tập của các võ sĩ phụ trách (chỉ đọc), nhóm theo ngày, lọc theo trạng thái. */
export function CoachScheduleScreen() {
  const enabled = useCoachEnabled();
  const go = useGo();
  const p = useFighterPalette();
  const names = useFighterNames(enabled);
  const [status, setStatus] = useState<SessionStatus | "">("");
  const [window] = useState(() => {
    const now = Date.now();
    return { fromDate: new Date(now - 7 * DAY).toISOString(), toDate: new Date(now + 14 * DAY).toISOString() };
  });

  const list = usePagedList(enabled, `cs|${status}`, (page) =>
    coachApi.listSessions({ page, limit: 20, status: status || undefined, ...window }),
  );
  const firstLoad = !list.loaded || (list.loading && list.items.length === 0 && !list.error);
  const skeleton = useDelayedFlag(firstLoad);
  const empty = list.loaded && !list.loading && !list.error && list.items.length === 0;

  return (
    <RoScreen title={coachRo.schedule.title} onRefresh={list.refresh} refreshing={list.loading && list.items.length === 0}>
      <Stack>
        <PendingReviewCard />
        <FilterSelect mutedColor={p.filterMuted} label={coachRo.schedule.statusFilter} value={status} onChange={setStatus} options={OPTIONS} allValue="" />
        {list.error ? <ConnectionBanner error={list.error} onRetry={() => void list.reload()} retrying={list.loading} hasData={list.items.length > 0} /> : null}
        {firstLoad && !list.error && skeleton ? <RowSkeletons count={5} height={104} /> : null}
        {empty ? (
          <MessageCard icon="schedule" title={coachRo.schedule.emptyTitle} description={coachRo.schedule.emptyDesc}>
            {status ? <ActionButton label={coachRo.fighters.clear} variant="secondary" icon="close" onPress={() => setStatus("")} /> : null}
          </MessageCard>
        ) : null}
        {list.items.length > 0 ? <SessionGroups sessions={list.items} names={names} onOpen={(id) => go("/(coach)/schedule/chi-tiet", id)} /> : null}
        {list.hasNext ? <LoadMore onPress={list.loadMore} loading={list.loadingMore} /> : null}
      </Stack>
    </RoScreen>
  );
}

/** Thẻ "Cần duyệt" (thay tab Video cũ): số phân tích chờ HLV duyệt, chạm để mở danh sách. */
export function PendingReviewCard() {
  const enabled = useAiEnabled();
  const jobs = useJobs(enabled, true);
  const router = useRouter();
  const p = useFighterPalette();
  const n = jobs.data?.pending.size ?? 0;
  return (
    <Pressable
      testID="pending-review-card"
      accessibilityRole="button"
      accessibilityLabel={vai.segReviewA11y(n)}
      onPress={() => router.navigate({ pathname: "/(coach)/video-analysis", params: { seg: "review", t: String(Date.now()) } } as never)}
      style={({ pressed }) => ({
        minHeight: 64, flexDirection: "row", alignItems: "center", gap: 12, padding: 16, borderRadius: 16, borderWidth: 1,
        borderColor: n > 0 ? p.accent : p.line, backgroundColor: pressed ? p.surface2 : p.surface,
      })}
    >
      <Icon name="video" size={24} color={p.ink} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[TEXT.bodyBold, { color: p.ink }]}>{vai.pendingCard}</Text>
        <Text style={[TEXT.detail, { color: p.ink }]}>{vai.pendingCardBody(n)}</Text>
      </View>
      {n > 0 ? (
        <View testID="pending-review-count" style={{ minWidth: 32, height: 32, borderRadius: 16, paddingHorizontal: 8, alignItems: "center", justifyContent: "center", backgroundColor: p.accent }}>
          <Text style={{ color: p.onAccent, fontWeight: "700", fontSize: 15 }}>{n}</Text>
        </View>
      ) : null}
      <Icon name="chevron" size={20} color={p.ink} />
    </Pressable>
  );
}
