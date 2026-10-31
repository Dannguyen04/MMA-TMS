import { useCallback, useMemo, useRef, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";

import { createTrainingPlan, listFighters, type PublicFighter, type TrainingPlanPhase } from "@/api";
import { useToastMessage } from "@/components/toast/app-toast";
import { coach } from "@/i18n/coach";
import {
  coachErrorMessage,
  coachHref,
  coachProfileId,
  fighterDisplayName,
  todayDateOnly,
} from "@/screens/coach/coach-error";
import {
  CoachBanner,
  CoachField,
  CoachPicker,
  CoachPrimaryButton,
  CoachScaffold,
} from "@/screens/coach/coach-ui";
import { useSession } from "@/session/session-context";
import { buildCreateTrainingPlanBody, planPhaseLabel, planPhaseOptions } from "@/training/plan-phase";
import { isValidDateOnly } from "@/utils/is-valid-date-only";

export function CoachPlanFormScreen() {
  const router = useRouter();
  const { user, isDemo } = useSession();
  const myCoachId = coachProfileId(user);
  const [fighters, setFighters] = useState<PublicFighter[]>([]);
  const [fighterId, setFighterId] = useState("");
  const [title, setTitle] = useState("");
  const [startDate, setStartDate] = useState(todayDateOnly());
  const [endDate, setEndDate] = useState("");
  const [description, setDescription] = useState("");
  const [goals, setGoals] = useState("");
  const [phase, setPhase] = useState<TrainingPlanPhase | "">("");
  const [error, setError] = useState("");
  useToastMessage(error, "error");
  const [saving, setSaving] = useState(false);
  const [loadingFighters, setLoadingFighters] = useState(true);
  const lock = useRef(false);

  useFocusEffect(
    useCallback(() => {
      if (isDemo) {
        setFighters([]);
        setLoadingFighters(false);
        return;
      }
      setLoadingFighters(true);
      void listFighters({ limit: 50 })
        .then((page) => {
          setFighters(page.data);
          setError("");
        })
        .catch((cause: unknown) => setError(coachErrorMessage(cause)))
        .finally(() => setLoadingFighters(false));
    }, [isDemo]),
  );

  const fighterOptions = useMemo(
    () => fighters.map((row) => ({ value: row.id, label: fighterDisplayName(row) })),
    [fighters],
  );
  const selectedFighter = fighters.find((row) => row.id === fighterId);

  const onCreate = () => {
    if (lock.current || saving || isDemo) return;
    if (!myCoachId) {
      setError(coach.assignNeedProfile);
      return;
    }
    if (!isValidDateOnly(startDate) || (endDate.trim() && !isValidDateOnly(endDate.trim()))) {
      setError(coach.dateInvalid);
      return;
    }
    const built = buildCreateTrainingPlanBody({
      fighterId,
      coachId: myCoachId,
      title,
      startDate,
      phase,
      endDate,
      description,
      goals,
    });
    if (!built.ok) {
      setError(built.reason === "phase" ? coach.phaseRequired : coach.required);
      return;
    }
    lock.current = true;
    setSaving(true);
    setError("");
    void createTrainingPlan(built.body)
      .then((plan) => router.replace(coachHref(`/(coach)/plans/${plan.id}`)))
      .catch((cause: unknown) => setError(coachErrorMessage(cause)))
      .finally(() => {
        lock.current = false;
        setSaving(false);
      });
  };

  return (
    <CoachScaffold title={coach.newPlan} keyboard inStack>
      {!myCoachId ? <CoachBanner message={coach.assignNeedProfile} /> : null}
      {loadingFighters ? <CoachBanner message={coach.loading} /> : null}
      {!loadingFighters && fighters.length === 0 ? <CoachBanner message={coach.emptyFighters} /> : null}
      <CoachPicker
        label={coach.fighter}
        placeholder={coach.pickFighter}
        valueLabel={selectedFighter ? fighterDisplayName(selectedFighter) : ""}
        options={fighterOptions}
        onSelect={setFighterId}
      />
      <CoachPicker
        label={coach.phase}
        placeholder={coach.pickPhase}
        valueLabel={phase ? planPhaseLabel(phase) : ""}
        options={planPhaseOptions()}
        onSelect={setPhase}
      />
      <CoachField label={coach.title} value={title} onChangeText={setTitle} />
      <CoachField
        label={coach.startDate}
        helper={coach.dateHint}
        value={startDate}
        onChangeText={setStartDate}
        autoCapitalize="none"
      />
      <CoachField
        label={coach.endDate}
        helper={coach.optional}
        value={endDate}
        onChangeText={setEndDate}
        autoCapitalize="none"
      />
      <CoachField
        label={coach.description}
        helper={coach.optional}
        value={description}
        onChangeText={setDescription}
        multiline
      />
      <CoachField label={coach.goals} helper={coach.optional} value={goals} onChangeText={setGoals} multiline />
      <CoachPrimaryButton
        title={coach.create}
        onPress={onCreate}
        loading={saving}
        disabled={!myCoachId || saving || loadingFighters}
      />
    </CoachScaffold>
  );
}
