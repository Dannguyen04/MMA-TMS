import { useCallback, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";

import { listExercises, listTrainingPlans, type Exercise, type TrainingPlan } from "@/api";
import { coach } from "@/i18n/coach";
import { coachErrorMessage, coachHref } from "@/screens/coach/coach-error";
import { CoachBanner, CoachCard, CoachPrimaryButton, CoachScaffold } from "@/screens/coach/coach-ui";
import { useSession } from "@/session/session-context";
import { spacing, type, useThemePreference } from "@/theme";

export function CoachPlansScreen() {
  const { colors } = useThemePreference();
  const router = useRouter();
  const { isDemo } = useSession();
  const [plans, setPlans] = useState<TrainingPlan[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    if (isDemo) {
      setPlans([]);
      setExercises([]);
      setError("");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    void Promise.allSettled([
      listTrainingPlans({ limit: 50 }),
      listExercises({ limit: 50 }),
    ]).then(([plansResult, exercisesResult]) => {
      if (plansResult.status === "fulfilled") {
        setPlans(plansResult.value.data);
      } else {
        setPlans([]);
        setError(coachErrorMessage(plansResult.reason));
      }
      if (exercisesResult.status === "fulfilled") {
        setExercises(exercisesResult.value.data);
      } else if (plansResult.status === "fulfilled") {
        setError(coachErrorMessage(exercisesResult.reason));
      }
    }).finally(() => setLoading(false));
  }, [isDemo]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  return (
    <CoachScaffold
      title={coach.tabs.plans}
      keyboard
      action={<CoachPrimaryButton title={coach.newPlan} onPress={() => router.push(coachHref("/(coach)/plans/new"))} />}
    >
      {error ? <CoachBanner message={error} tone="danger" /> : null}
      {loading && plans.length === 0 ? <CoachBanner message={coach.loading} /> : null}
      {plans.length === 0 && !loading ? <CoachBanner message={coach.emptyPlans} /> : null}
      <View style={{ gap: spacing.md }}>
        {plans.map((row) => (
          <CoachCard key={row.id} onPress={() => router.push(coachHref(`/(coach)/plans/${row.id}`))}>
            <Text style={[type.body, { color: colors.ink }]}>{row.title}</Text>
            <Text style={[type.caption, { color: colors.inkMuted, lineHeight: 16 }]}>
              {coach.planStatus[row.status]} · {row.startDate}
              {row.endDate ? ` → ${row.endDate}` : ""}
            </Text>
          </CoachCard>
        ))}
      </View>

      <Text style={[type.title, { color: colors.ink }]}>{coach.catalog}</Text>
      {exercises.length === 0 ? <CoachBanner message={coach.emptyExercises} /> : null}
      <View style={{ gap: spacing.sm }}>
        {exercises.map((row) => (
          <CoachCard key={row.id}>
            <Text style={[type.body, { color: colors.ink }]}>{row.name}</Text>
            <Text style={[type.caption, { color: colors.inkMuted, lineHeight: 16 }]}>
              {coach.exerciseCategory[row.category]}
            </Text>
          </CoachCard>
        ))}
      </View>

      <Pressable accessibilityRole="button" onPress={load}>
        <Text style={[type.link, { color: colors.lotus }]}>{coach.retry}</Text>
      </Pressable>
    </CoachScaffold>
  );
}
