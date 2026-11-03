import { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter, type Href } from "expo-router";

import {
  getExercise,
  getTrainingPlan,
  listTrainingPlanExercises,
  type TrainingPlanExercise,
} from "@/screens/fighter/api";
import { fighter } from "@/i18n/fighter";
import { formatDay, formatMinutes, planStatusLabel } from "@/screens/fighter/format";
import { planPhaseLabel } from "@/training/plan-phase";
import { EmptyCopy, FighterScreen, GlassCard, SectionLabel, StatusLine } from "@/screens/fighter/screen";
import { useFighterId } from "@/screens/fighter/use-fighter-id";
import { useLoad } from "@/screens/fighter/use-load";
import { type, useThemePreference } from "@/theme";

export function FighterPlanDetailScreen() {
  const { colors } = useThemePreference();
  const { id } = useLocalSearchParams<{ id: string }>();
  const planId = typeof id === "string" ? id : "";
  const { canFetch, isDemo } = useFighterId();
  const [names, setNames] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const [plan, exercises] = await Promise.all([
      getTrainingPlan(planId),
      listTrainingPlanExercises(planId),
    ]);
    return { plan, exercises };
  }, [planId]);

  const { data, error, loading, reload, refresh } = useLoad(canFetch && !!planId, planId, load);

  useEffect(() => {
    const rows = data?.exercises ?? [];
    if (!rows.length) return;
    let cancelled = false;
    void Promise.all(
      rows.map(async (row) => {
        try {
          const exercise = await getExercise(row.exerciseId);
          return [row.exerciseId, exercise.name] as const;
        } catch {
          return [row.exerciseId, null] as const;
        }
      }),
    ).then((pairs) => {
      if (cancelled) return;
      const next: Record<string, string> = {};
      for (const [exerciseId, name] of pairs) {
        if (name) next[exerciseId] = name;
      }
      setNames(next);
    });
    return () => {
      cancelled = true;
    };
  }, [data?.exercises]);

  const plan = data?.plan;
  const exercises = data?.exercises ?? [];

  return (
    <FighterScreen title={fighter.plans.detailTitle} onBack refreshing={loading} onRefresh={refresh}>
      <StatusLine message={error} onRetry={reload} />
      {plan ? (
        <GlassCard>
          <Text style={[type.title, { color: colors.ink }]}>{plan.title}</Text>
          <Text style={[type.body, { color: colors.inkMuted }]}>{planStatusLabel(plan.status)}</Text>
          {plan.phase ? (
            <Text style={[type.body, { color: colors.ink }]}>
              {fighter.plans.phase}: {planPhaseLabel(plan.phase)}
            </Text>
          ) : null}
          <Text style={[type.caption, styles.meta, { color: colors.inkMuted }]}>
            {fighter.plans.dates}: {formatDay(plan.startDate)}
            {plan.endDate ? ` – ${formatDay(plan.endDate)}` : ""}
          </Text>
          {plan.progress ? (
            <Text style={[type.body, { color: colors.ink }]}>
              {fighter.plans.progress}: {plan.progress.completedSessions}/{plan.progress.totalSessions}{" "}
              {fighter.plans.ofSessions} ({plan.progress.completionPercentage}%)
            </Text>
          ) : null}
          {plan.goals ? (
            <View>
              <Text style={[type.caption, styles.meta, { color: colors.inkMuted }]}>
                {fighter.plans.goals}
              </Text>
              <Text style={[type.body, { color: colors.ink }]}>{plan.goals}</Text>
            </View>
          ) : null}
          {plan.description ? (
            <View>
              <Text style={[type.caption, styles.meta, { color: colors.inkMuted }]}>
                {fighter.plans.description}
              </Text>
              <Text style={[type.body, { color: colors.ink }]}>{plan.description}</Text>
            </View>
          ) : null}
        </GlassCard>
      ) : (
        <GlassCard>
          <EmptyCopy text={isDemo || !canFetch ? fighter.common.demoHint : fighter.plans.empty} />
        </GlassCard>
      )}

      <SectionLabel text={fighter.plans.exercises} />
      <GlassCard>
        {exercises.length > 0 ? (
          exercises.map((row) => <ExerciseRow key={row.id} row={row} name={names[row.exerciseId]} />)
        ) : (
          <EmptyCopy text={fighter.plans.emptyExercises} />
        )}
      </GlassCard>
    </FighterScreen>
  );
}

function ExerciseRow({ row, name }: { row: TrainingPlanExercise; name?: string }) {
  const { colors } = useThemePreference();
  const bits = [
    row.sets != null ? `${fighter.plans.sets} ${row.sets}` : null,
    row.reps != null ? `${fighter.plans.reps} ${row.reps}` : null,
    row.durationSeconds != null ? formatMinutes(row.durationSeconds) : null,
    row.targetRpe != null ? `${fighter.plans.rpe} ${row.targetRpe}` : null,
  ].filter(Boolean);

  const router = useRouter();

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push(`/giao-an/bai-tap/${row.exerciseId}` as Href)}
      style={styles.row}
    >
      <Text style={[type.body, { color: colors.ink }]}>
        {row.orderIndex + 1}. {name ?? fighter.exercises.detailTitle}
      </Text>
      {bits.length ? (
        <Text style={[type.caption, styles.meta, { color: colors.inkMuted }]}>{bits.join(" · ")}</Text>
      ) : null}
      {row.coachNotes ? (
        <Text style={[type.caption, styles.meta, { color: colors.inkMuted }]}>{row.coachNotes}</Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: 44, justifyContent: "center", gap: 2 },
  meta: { lineHeight: 16 },
});
