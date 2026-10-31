import { useCallback, useState } from "react";
import { Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import { coachApi } from "@/api/coach";
import { Icon } from "@/components/icon";
import { coachRo } from "@/i18n/coach-ro";
import { ActionButton, ConnectionBanner, MessageCard, TEXT, useDelayedFlag } from "@/screens/fighter/bout-states";
import { useFighterPalette } from "@/screens/fighter/redesign/palette";
import { useLoad } from "@/screens/fighter/use-load";
import { planPct, PLAN_CHIP, vnDate } from "./ro-format";
import { InfoLine, ProgressBar, RoCard, RoScreen, RowSkeletons, StatusChip, Stack } from "./ro-ui";
import { useCoachEnabled } from "./use-coach";
import type { PlanStatusValue } from "@/api/one-tap.types";
import { usePlanActions } from "@/screens/one-tap/status-actions";
import { MoreMenu } from "@/screens/one-tap/video-actions";

/** C-7 (chi tiết): giáo án — tiến độ, mục tiêu, mốc, bài tập (chỉ đọc). Mở bằng /plans/chi-tiet?id=... */
export function CoachPlanDetailScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const pid = typeof id === "string" ? id : "";
  const enabled = useCoachEnabled() && Boolean(pid);
  const router = useRouter();
  const p = useFighterPalette();

  const run = useCallback(async () => {
    const plan = await coachApi.getPlan(pid);
    const [rows, exercises, fighter] = await Promise.all([
      coachApi.listPlanExercises(pid).catch(() => []),
      coachApi.listExercises({ limit: 100 }).then((r) => r.data).catch(() => []),
      coachApi.getFighter(plan.fighterId).catch(() => null),
    ]);
    const names = Object.fromEntries(exercises.map((e) => [e.id, e.name]));
    return { plan, rows: [...rows].sort((a, b) => a.orderIndex - b.orderIndex), names, fighter };
  }, [pid]);
  const { data, error, loading, reload, refresh } = useLoad(enabled, `pd|${pid}`, run, { keepOnError: true });
  const skeleton = useDelayedFlag(loading && !data);
  const [override, setOverride] = useState<{ pid: string; status: PlanStatusValue } | null>(null);
  const loaded = data?.plan;
  const plan = loaded && override?.pid === loaded.id ? { ...loaded, status: override.status } : loaded;
  const actions = usePlanActions({
    planId: pid,
    status: (plan?.status ?? "DRAFT") as PlanStatusValue,
    onChanged: (status) => setOverride({ pid, status }),
    onReload: () => {
      setOverride(null);
      reload();
    },
  });

  return (
    <RoScreen title={coachRo.plans.title} back onRefresh={refresh} refreshing={loading && !data} trailing={plan ? <MoreMenu items={actions.more} /> : undefined}>
      <Stack>
        {error ? <ConnectionBanner error={error} onRetry={reload} retrying={loading} hasData={Boolean(data)} /> : null}
        {!pid ? (
          <MessageCard icon="plans" title={coachRo.plans.notFoundTitle} description={coachRo.plans.notFoundDesc}>
            <ActionButton label={coachRo.plans.back} variant="secondary" icon="back" onPress={() => router.back()} />
          </MessageCard>
        ) : null}
        {!data && !error && loading && skeleton ? <RowSkeletons count={3} height={120} /> : null}
        {plan && data ? (
          <>
            <RoCard>
              <Text style={[TEXT.cardTitle, { color: p.ink }]}>{plan.title}</Text>
              <StatusChip spec={PLAN_CHIP[plan.status]} />
              {data.fighter ? <InfoLine label={coachRo.session.fighter} value={`${data.fighter.firstName} ${data.fighter.lastName}`.trim()} /> : null}
              <InfoLine label={coachRo.phase[plan.phase]} value={coachRo.plans.period(vnDate(plan.startDate), plan.endDate ? vnDate(plan.endDate) : null)} />
              {plan.description ? <Text style={[TEXT.body, { color: p.ink }]}>{plan.description}</Text> : null}
            </RoCard>
            <RoCard title={coachRo.plans.progress}>
              <Text style={[TEXT.bigNumber, { color: p.ink }]}>{planPct(plan)}%</Text>
              <ProgressBar pct={planPct(plan)} />
              {plan.progress ? (
                <Text style={[TEXT.body, { color: p.ink }]}>
                  {coachRo.plans.progressLine(plan.progress.completedSessions, plan.progress.totalSessions)}
                </Text>
              ) : null}
            </RoCard>
            <RoCard title={coachRo.plans.goalsMilestones}>
              <Text style={[TEXT.captionBold, { color: p.ink }]}>{coachRo.plans.goals}</Text>
              <Text style={[TEXT.body, { color: p.ink }]}>{plan.goals ?? coachRo.plans.noGoals}</Text>
              <Text style={[TEXT.captionBold, { color: p.ink }]}>{coachRo.plans.milestones}</Text>
              {plan.milestones.length === 0 ? (
                <Text style={[TEXT.body, { color: p.ink }]}>{coachRo.plans.noMilestones}</Text>
              ) : (
                plan.milestones.map((m, i) => (
                  <View key={m.id ?? i} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Icon name={m.isCompleted ? "success" : "circle"} size={24} color={m.isCompleted ? p.success : p.ink} />
                    <Text style={[TEXT.body, { color: p.ink, flex: 1 }]}>
                      {m.title} · {m.isCompleted ? coachRo.plans.done : coachRo.plans.open}
                    </Text>
                  </View>
                ))
              )}
            </RoCard>
            <RoCard title={coachRo.plans.exercises}>
              {data.rows.length === 0 ? (
                <Text style={[TEXT.body, { color: p.ink }]}>{coachRo.plans.noExercises}</Text>
              ) : (
                data.rows.map((r) => {
                  const parts = [
                    r.sets != null ? coachRo.plans.sets(r.sets) : "",
                    r.reps != null ? coachRo.plans.reps(r.reps) : "",
                    r.durationSeconds ? coachRo.plans.duration(Math.round(r.durationSeconds / 60)) : "",
                    r.targetRpe != null ? coachRo.plans.rpe(r.targetRpe) : "",
                  ].filter(Boolean);
                  return (
                    <View key={r.id} style={{ gap: 4 }}>
                      <Text style={[TEXT.bodyBold, { color: p.ink }]}>
                        {r.orderIndex}. {data.names[r.exerciseId] ?? coachRo.plans.exercises}
                      </Text>
                      {parts.length ? <Text style={[TEXT.detail, { color: p.ink }]}>{parts.join(" · ")}</Text> : null}
                      {r.coachNotes ? <Text style={[TEXT.detail, { color: p.ink }]}>{r.coachNotes}</Text> : null}
                    </View>
                  );
                })
              )}
            </RoCard>
          </>
        ) : null}
      </Stack>
      {actions.sheets}
    </RoScreen>
  );
}
