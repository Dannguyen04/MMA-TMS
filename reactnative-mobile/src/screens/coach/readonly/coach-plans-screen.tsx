import { Text } from "react-native";

import { coachApi } from "@/api/coach";
import { coachRo } from "@/i18n/coach-ro";
import { ConnectionBanner, MessageCard, TEXT, useDelayedFlag } from "@/screens/fighter/bout-states";
import { useFighterPalette } from "@/screens/fighter/redesign/palette";
import { planPct, PLAN_CHIP } from "./ro-format";
import { LoadMore, ProgressBar, RoRow, RoScreen, RowSkeletons, Stack, useGo } from "./ro-ui";
import { useCoachEnabled, useFighterNames } from "./use-coach";
import { usePagedList } from "./use-paged-list";

/** C-7 (danh sách): giáo án của võ sĩ phụ trách (chỉ đọc). */
export function CoachPlansScreen() {
  const enabled = useCoachEnabled();
  const go = useGo();
  const p = useFighterPalette();
  const names = useFighterNames(enabled);
  const list = usePagedList(enabled, "cp", (page) => coachApi.listPlans({ page, limit: 20 }));
  const firstLoad = !list.loaded || (list.loading && list.items.length === 0 && !list.error);
  const skeleton = useDelayedFlag(firstLoad);
  const empty = list.loaded && !list.loading && !list.error && list.items.length === 0;

  return (
    <RoScreen title={coachRo.plans.title} onRefresh={list.refresh} refreshing={list.loading && list.items.length === 0}>
      <Stack>
        {list.error ? <ConnectionBanner error={list.error} onRetry={() => void list.reload()} retrying={list.loading} hasData={list.items.length > 0} /> : null}
        {firstLoad && !list.error && skeleton ? <RowSkeletons count={4} height={120} /> : null}
        {empty ? <MessageCard icon="plans" title={coachRo.plans.emptyTitle} description={coachRo.plans.emptyDesc} /> : null}
        {list.items.map((plan) => {
          const pct = planPct(plan);
          return (
            <RoRow
              key={plan.id}
              title={plan.title}
              lines={[[names[plan.fighterId], coachRo.phase[plan.phase]].filter(Boolean).join(" · ")]}
              chip={PLAN_CHIP[plan.status]}
              onPress={() => go("/(coach)/plans/chi-tiet", plan.id)}
              label={`${plan.title}, ${PLAN_CHIP[plan.status].label}, ${coachRo.plans.progress} ${pct}%`}
            >
              <ProgressBar pct={pct} />
              <Text style={[TEXT.detail, { color: p.ink }]}>
                {plan.progress ? `${coachRo.plans.progressLine(plan.progress.completedSessions, plan.progress.totalSessions)} · ${pct}%` : `${pct}%`}
              </Text>
            </RoRow>
          );
        })}
        {list.hasNext ? <LoadMore onPress={list.loadMore} loading={list.loadingMore} /> : null}
      </Stack>
    </RoScreen>
  );
}
