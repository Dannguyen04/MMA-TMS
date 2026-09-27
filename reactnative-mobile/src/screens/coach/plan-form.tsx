import { useCallback, useMemo, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";

import { createTrainingPlan, listFighters, type PublicFighter } from "@/api";
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
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (isDemo) {
        setFighters([]);
        return;
      }
      void listFighters({ limit: 50 })
        .then((page) => setFighters(page.data))
        .catch((cause: unknown) => setError(coachErrorMessage(cause)));
    }, [isDemo]),
  );

  const fighterOptions = useMemo(
    () => fighters.map((row) => ({ value: row.id, label: fighterDisplayName(row) })),
    [fighters],
  );
  const selectedFighter = fighters.find((row) => row.id === fighterId);

  const onCreate = () => {
    if (isDemo) return;
    if (!myCoachId) {
      setError(coach.assignNeedProfile);
      return;
    }
    if (!fighterId || !title.trim()) {
      setError(coach.required);
      return;
    }
    if (!isValidDateOnly(startDate)) {
      setError(coach.dateInvalid);
      return;
    }
    if (endDate.trim() && !isValidDateOnly(endDate.trim())) {
      setError(coach.dateInvalid);
      return;
    }
    setSaving(true);
    setError("");
    void createTrainingPlan({
      fighterId,
      coachId: myCoachId,
      title: title.trim(),
      startDate,
      ...(endDate.trim() ? { endDate: endDate.trim() } : {}),
      ...(description.trim() ? { description: description.trim() } : {}),
      ...(goals.trim() ? { goals: goals.trim() } : {}),
    })
      .then((plan) => router.replace(coachHref(`/(coach)/plans/${plan.id}`)))
      .catch((cause: unknown) => setError(coachErrorMessage(cause)))
      .finally(() => setSaving(false));
  };

  return (
    <CoachScaffold title={coach.newPlan} keyboard inStack>
      {error ? <CoachBanner message={error} tone="danger" /> : null}
      {!myCoachId ? <CoachBanner message={coach.assignNeedProfile} /> : null}
      <CoachPicker
        label={coach.fighter}
        placeholder={coach.pickFighter}
        valueLabel={selectedFighter ? fighterDisplayName(selectedFighter) : ""}
        options={fighterOptions}
        onSelect={setFighterId}
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
      <CoachPrimaryButton title={coach.create} onPress={onCreate} loading={saving} disabled={!myCoachId} />
    </CoachScaffold>
  );
}
