import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";

import {
  SESSION_TYPES,
  createTrainingSession,
  listFighters,
  listTrainingPlans,
  type PublicFighter,
  type SessionType,
  type TrainingPlan,
} from "@/api";
import { coach } from "@/i18n/coach";
import {
  coachErrorMessage,
  coachProfileId,
  fighterDisplayName,
  localIsoFromDateTime,
  nowTimeHm,
  parsePositiveNumber,
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

export function CoachSessionFormScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ fighterId?: string; planId?: string }>();
  const { user, isDemo } = useSession();
  const myCoachId = coachProfileId(user);
  const [fighters, setFighters] = useState<PublicFighter[]>([]);
  const [fighterId, setFighterId] = useState(
    typeof params.fighterId === "string" ? params.fighterId : "",
  );
  const [plans, setPlans] = useState<TrainingPlan[]>([]);
  const [planId, setPlanId] = useState(typeof params.planId === "string" ? params.planId : "");
  const plansSeq = useRef(0);
  const [title, setTitle] = useState("");
  const [dateOnly, setDateOnly] = useState(todayDateOnly());
  const [timeHm, setTimeHm] = useState(nowTimeHm());
  const [sessionType, setSessionType] = useState<SessionType>("PAD_WORK");
  const [location, setLocation] = useState("");
  const [durationMin, setDurationMin] = useState("60");
  const [rounds, setRounds] = useState("0");
  const [notes, setNotes] = useState("");
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

  useEffect(() => {
    const seq = ++plansSeq.current;
    setPlans([]);
    if (!fighterId || isDemo) return;
    void listTrainingPlans({ fighterId, isActive: true, limit: 50 })
      .then((page) => {
        if (seq !== plansSeq.current) return;
        setPlans(page.data);
        setPlanId((current) => (page.data.some((plan) => plan.id === current) ? current : ""));
      })
      .catch((cause: unknown) => {
        if (seq === plansSeq.current) setError(coachErrorMessage(cause));
      });
  }, [fighterId, isDemo]);

  const fighterOptions = useMemo(
    () => fighters.map((row) => ({ value: row.id, label: fighterDisplayName(row) })),
    [fighters],
  );
  const planOptions = useMemo(
    () => [
      { value: "", label: coach.noPlan },
      ...plans.map((plan) => ({
        value: plan.id,
        label: `${plan.title} · ${coach.planStatus[plan.status]}`,
      })),
    ],
    [plans],
  );
  const selectedFighter = fighters.find((row) => row.id === fighterId);
  const selectedPlan = plans.find((plan) => plan.id === planId);

  const onPickFighter = (next: string) => {
    if (next !== fighterId) setPlanId("");
    setFighterId(next);
  };

  const onCreate = () => {
    if (isDemo) return;
    if (!fighterId || !title.trim()) {
      setError(coach.required);
      return;
    }
    if (!isValidDateOnly(dateOnly)) {
      setError(coach.dateInvalid);
      return;
    }
    const scheduledAt = localIsoFromDateTime(dateOnly, timeHm);
    if (!scheduledAt) {
      setError(coach.timeInvalid);
      return;
    }
    const minutes = durationMin.trim() ? parsePositiveNumber(durationMin) : null;
    if (durationMin.trim() && minutes == null) {
      setError(coach.numberInvalid);
      return;
    }
    const roundCount = rounds.trim() ? Number(rounds) : 0;
    if (!Number.isInteger(roundCount) || roundCount < 0) {
      setError(coach.numberInvalid);
      return;
    }
    setSaving(true);
    setError("");
    void createTrainingSession({
      fighterId,
      title: title.trim(),
      scheduledAt,
      sessionType,
      ...(myCoachId ? { coachId: myCoachId } : {}),
      ...(selectedPlan ? { planId: selectedPlan.id } : {}),
      ...(minutes != null ? { plannedDurationSec: Math.round(minutes * 60) } : {}),
      roundCount,
      ...(location.trim() ? { location: location.trim() } : {}),
      ...(notes.trim() ? { coachNotes: notes.trim() } : {}),
    })
      .then(() => router.back())
      .catch((cause: unknown) => setError(coachErrorMessage(cause)))
      .finally(() => setSaving(false));
  };

  return (
    <CoachScaffold title={coach.newSession} keyboard inStack>
      {error ? <CoachBanner message={error} tone="danger" /> : null}
      <CoachPicker
        label={coach.fighter}
        placeholder={coach.pickFighter}
        valueLabel={selectedFighter ? fighterDisplayName(selectedFighter) : ""}
        options={fighterOptions}
        onSelect={onPickFighter}
      />
      {fighterId ? (
        <CoachPicker
          label={coach.linkedPlan}
          placeholder={coach.pickPlan}
          valueLabel={selectedPlan ? selectedPlan.title : ""}
          options={planOptions}
          onSelect={setPlanId}
        />
      ) : null}
      {fighterId ? <CoachBanner message={coach.planOnlyActive} /> : null}
      <CoachField label={coach.title} value={title} onChangeText={setTitle} />
      <CoachField
        label={coach.date}
        helper={coach.dateHint}
        value={dateOnly}
        onChangeText={setDateOnly}
        autoCapitalize="none"
      />
      <CoachField
        label={coach.time}
        helper={coach.timeHint}
        value={timeHm}
        onChangeText={setTimeHm}
        autoCapitalize="none"
      />
      <CoachPicker
        label={coach.sessionType}
        placeholder={coach.sessionType}
        valueLabel={coach.sessionTypeLabel[sessionType]}
        options={SESSION_TYPES.map((value) => ({
          value,
          label: coach.sessionTypeLabel[value],
        }))}
        onSelect={setSessionType}
      />
      <CoachField label={coach.location} helper={coach.optional} value={location} onChangeText={setLocation} />
      <CoachField
        label={coach.durationMin}
        helper={coach.optional}
        value={durationMin}
        onChangeText={setDurationMin}
        keyboardType="number-pad"
      />
      <CoachField label={coach.rounds} value={rounds} onChangeText={setRounds} keyboardType="number-pad" />
      <CoachField
        label={coach.coachNotes}
        helper={coach.optional}
        value={notes}
        onChangeText={setNotes}
        multiline
      />
      <CoachPrimaryButton title={coach.create} onPress={onCreate} loading={saving} />
    </CoachScaffold>
  );
}
