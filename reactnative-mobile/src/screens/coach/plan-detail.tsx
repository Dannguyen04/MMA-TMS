import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";

import {
  FORBIDDEN_PLAN_TRANSITIONS,
  TRAINING_PLAN_STATUSES,
  addTrainingPlanExercise,
  getExercise,
  getTrainingPlan,
  listExercises,
  listTrainingPlanExercises,
  removeTrainingPlanExercise,
  updateTrainingPlan,
  updateTrainingPlanExercise,
  updateTrainingPlanStatus,
  type Exercise,
  type PlanMilestone,
  type TrainingPlan,
  type TrainingPlanExercise,
  type TrainingPlanPhase,
  type TrainingPlanStatus,
} from "@/api";
import { useToastMessage } from "@/components/toast/app-toast";
import { coach } from "@/i18n/coach";
import { coachErrorMessage, coachHref, formatWhen } from "@/screens/coach/coach-error";
import {
  CoachBanner,
  CoachCard,
  CoachChip,
  CoachField,
  CoachPicker,
  CoachPrimaryButton,
  CoachScaffold,
} from "@/screens/coach/coach-ui";
import { isTrainingPlanPhase, planPhaseLabel, planPhaseOptions } from "@/training/plan-phase";
import { isValidDateOnly } from "@/utils/is-valid-date-only";
import { spacing, type, useThemePreference } from "@/theme";

const MILESTONE_TITLE_MAX = 255;
const NOTES_MAX = 500;

type MilestoneDraft = {
  key: string;
  id?: string;
  title: string;
  isCompleted: boolean;
  completedAt?: string;
  notes: string;
};

let draftCounter = 0;

function toDrafts(milestones: PlanMilestone[]): MilestoneDraft[] {
  return milestones.map((item) => ({
    key: item.id ?? `draft-${++draftCounter}`,
    id: item.id,
    title: item.title,
    isCompleted: !!item.isCompleted,
    completedAt: item.isCompleted ? item.completedAt : undefined,
    notes: item.notes ?? "",
  }));
}

/** `null` = empty, `undefined` = invalid. No rounding: the API rejects non-integers. */
function parseIntField(raw: string, min: number): number | null | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (!/^\d+$/.test(trimmed)) return undefined;
  const value = Number(trimmed);
  return Number.isSafeInteger(value) && value >= min ? value : undefined;
}

export function CoachPlanDetailScreen() {
  const { colors } = useThemePreference();
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const planId = typeof params.id === "string" ? params.id : "";
  const [plan, setPlan] = useState<TrainingPlan | null>(null);
  const [items, setItems] = useState<TrainingPlanExercise[]>([]);
  const [catalog, setCatalog] = useState<Exercise[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [title, setTitle] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [description, setDescription] = useState("");
  const [goals, setGoals] = useState("");
  const [phase, setPhase] = useState<TrainingPlanPhase | "">("");
  const [milestones, setMilestones] = useState<MilestoneDraft[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  useToastMessage(error, "error");
  useToastMessage(notice, "success");
  const [saving, setSaving] = useState(false);
  const [savingMilestones, setSavingMilestones] = useState(false);
  const seqRef = useRef(0);

  const applyPlan = useCallback((next: TrainingPlan) => {
    setPlan(next);
    setTitle(next.title);
    setStartDate(next.startDate);
    setEndDate(next.endDate ?? "");
    setDescription(next.description ?? "");
    setGoals(next.goals ?? "");
    setPhase(isTrainingPlanPhase(next.phase) ? next.phase : "");
    setMilestones(toDrafts(next.milestones ?? []));
  }, []);

  const load = useCallback(() => {
    if (!planId) return;
    const seq = ++seqRef.current;
    setError("");
    void Promise.all([
      getTrainingPlan(planId),
      listTrainingPlanExercises(planId),
      listExercises({ limit: 50 }),
    ])
      .then(([next, planItems, exercisePage]) => {
        if (seq !== seqRef.current) return;
        applyPlan(next);
        setItems(planItems);
        setCatalog(exercisePage.data);
      })
      .catch((cause: unknown) => {
        if (seq === seqRef.current) setError(coachErrorMessage(cause));
      });
  }, [planId, applyPlan]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  useEffect(() => {
    const known = new Set(catalog.map((row) => row.id));
    const missing = [...new Set(items.map((row) => row.exerciseId))].filter(
      (id) => !known.has(id) && !names[id],
    );
    if (!missing.length) return;
    let cancelled = false;
    void Promise.all(
      missing.map(async (id) => {
        try {
          return [id, (await getExercise(id)).name] as const;
        } catch {
          return [id, null] as const;
        }
      }),
    ).then((pairs) => {
      if (cancelled) return;
      setNames((current) => {
        const next = { ...current };
        for (const [id, name] of pairs) if (name) next[id] = name;
        return next;
      });
    });
    return () => {
      cancelled = true;
    };
  }, [catalog, items, names]);

  const onSave = () => {
    if (saving) return;
    if (!planId || !title.trim()) {
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
    if (!isTrainingPlanPhase(phase)) {
      setError(coach.phaseRequired);
      return;
    }
    setSaving(true);
    setError("");
    setNotice("");
    void updateTrainingPlan(planId, {
      title: title.trim(),
      startDate,
      endDate: endDate.trim() ? endDate.trim() : null,
      description: description.trim() ? description.trim() : null,
      goals: goals.trim() ? goals.trim() : null,
      phase,
    })
      .then((next) => {
        applyPlan(next);
        setNotice(coach.saved);
      })
      .catch((cause: unknown) => setError(coachErrorMessage(cause)))
      .finally(() => setSaving(false));
  };

  const onSaveMilestones = () => {
    if (!planId) return;
    if (milestones.some((item) => !item.title.trim())) {
      setError(coach.milestoneTitleRequired);
      return;
    }
    const body: PlanMilestone[] = milestones.map((item) => ({
      ...(item.id ? { id: item.id } : {}),
      title: item.title.trim(),
      isCompleted: item.isCompleted,
      ...(item.isCompleted ? { completedAt: item.completedAt ?? new Date().toISOString() } : {}),
      notes: item.notes.trim() ? item.notes.trim() : null,
    }));
    setSavingMilestones(true);
    setError("");
    setNotice("");
    void updateTrainingPlan(planId, { milestones: body })
      .then((next) => {
        applyPlan(next);
        setNotice(coach.saved);
      })
      .catch((cause: unknown) => setError(coachErrorMessage(cause)))
      .finally(() => setSavingMilestones(false));
  };

  const patchMilestone = (key: string, patch: Partial<MilestoneDraft>) => {
    setMilestones((current) => current.map((item) => (item.key === key ? { ...item, ...patch } : item)));
  };

  const toggleMilestone = (item: MilestoneDraft) => {
    patchMilestone(
      item.key,
      item.isCompleted
        ? { isCompleted: false, completedAt: undefined }
        : { isCompleted: true, completedAt: new Date().toISOString() },
    );
  };

  const onStatus = (status: TrainingPlanStatus) => {
    if (!planId || !plan || status === plan.status) return;
    setError("");
    setNotice("");
    void updateTrainingPlanStatus(planId, { status })
      .then(() => {
        setNotice(coach.saved);
        load();
      })
      .catch((cause: unknown) => {
        setError(coachErrorMessage(cause));
        load();
      });
  };

  const onAdd = (exerciseId: string) => {
    if (!planId) return;
    setError("");
    setNotice("");
    const nextOrder = items.reduce((max, row) => Math.max(max, row.orderIndex + 1), 0);
    void addTrainingPlanExercise(planId, { exerciseId, orderIndex: nextOrder })
      .then(() => {
        setNotice(coach.created);
        load();
      })
      .catch((cause: unknown) => setError(coachErrorMessage(cause)));
  };

  const onRemove = (exerciseRowId: string) => {
    if (!planId) return;
    setError("");
    setNotice("");
    void removeTrainingPlanExercise(planId, exerciseRowId)
      .then(() => {
        setNotice(coach.removed);
        load();
      })
      .catch((cause: unknown) => setError(coachErrorMessage(cause)));
  };

  const exerciseName = (exerciseId: string) =>
    catalog.find((row) => row.id === exerciseId)?.name ?? names[exerciseId] ?? coach.loading;

  const forbidden = plan ? (FORBIDDEN_PLAN_TRANSITIONS[plan.status] ?? []) : [];
  const statusOptions = TRAINING_PLAN_STATUSES.filter((status) => !forbidden.includes(status));

  return (
    <CoachScaffold title={plan?.title ?? coach.planDetail} keyboard inStack>
      {!plan && !error ? <CoachBanner message={coach.loading} /> : null}
      {plan?.progress ? (
        <CoachCard>
          <Text style={[type.label, { color: colors.inkMuted, lineHeight: 18 }]}>{coach.progress}</Text>
          <Text style={[type.body, { color: colors.ink }]}>
            {plan.progress.completedSessions}/{plan.progress.totalSessions} {coach.progressLine} (
            {plan.progress.completionPercentage}%)
          </Text>
        </CoachCard>
      ) : null}
      {plan ? (
        <CoachCard
          onPress={() =>
            router.push(coachHref(`/(coach)/schedule/new?fighterId=${plan.fighterId}&planId=${plan.id}`))
          }
        >
          <Text style={[type.link, { color: colors.lotus }]}>{coach.createSessionForPlan}</Text>
        </CoachCard>
      ) : null}
      {plan ? (
        <Text style={[type.caption, { color: colors.inkMuted }]}>{planPhaseLabel(plan.phase)}</Text>
      ) : null}
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
      <CoachPrimaryButton title={coach.save} onPress={onSave} loading={saving} />

      <Text style={[type.label, { color: colors.inkMuted, lineHeight: 18 }]}>{coach.status}</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
        {statusOptions.map((status) => (
          <CoachChip
            key={status}
            value={status}
            selected={plan?.status === status}
            label={coach.planStatus[status]}
            onPress={onStatus}
          />
        ))}
      </View>
      {forbidden.length ? <CoachBanner message={coach.terminalPlanHint} /> : null}

      <Text style={[type.title, { color: colors.ink }]}>{coach.milestones}</Text>
      {milestones.length === 0 ? <CoachBanner message={coach.emptyMilestones} /> : null}
      <View style={{ gap: spacing.sm }}>
        {milestones.map((item) => (
          <CoachCard key={item.key}>
            <CoachField
              label={coach.milestoneTitle}
              value={item.title}
              onChangeText={(value) => patchMilestone(item.key, { title: value })}
              maxLength={MILESTONE_TITLE_MAX}
            />
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              <CoachChip
                value="open"
                selected={!item.isCompleted}
                label={coach.milestoneOpen}
                onPress={() => item.isCompleted && toggleMilestone(item)}
              />
              <CoachChip
                value="done"
                selected={item.isCompleted}
                label={coach.milestoneDone}
                onPress={() => !item.isCompleted && toggleMilestone(item)}
              />
            </View>
            {item.isCompleted && item.completedAt ? (
              <Text style={[type.caption, { color: colors.inkMuted, lineHeight: 16 }]}>
                {coach.milestoneDoneAt}: {formatWhen(item.completedAt)}
              </Text>
            ) : null}
            <CoachField
              label={coach.milestoneNotes}
              helper={coach.optional}
              value={item.notes}
              onChangeText={(value) => patchMilestone(item.key, { notes: value })}
              maxLength={NOTES_MAX}
              multiline
            />
            <Pressable
              accessibilityRole="button"
              onPress={() => setMilestones((current) => current.filter((row) => row.key !== item.key))}
            >
              <Text style={[type.link, { color: colors.danger }]}>{coach.remove}</Text>
            </Pressable>
          </CoachCard>
        ))}
      </View>
      {plan ? (
        <Pressable
          accessibilityRole="button"
          onPress={() =>
            setMilestones((current) => [
              ...current,
              { key: `draft-${++draftCounter}`, title: "", isCompleted: false, notes: "" },
            ])
          }
        >
          <Text style={[type.link, { color: colors.lotus }]}>{coach.addMilestone}</Text>
        </Pressable>
      ) : null}
      {plan ? (
        <CoachPrimaryButton
          title={coach.saveMilestones}
          onPress={onSaveMilestones}
          loading={savingMilestones}
        />
      ) : null}

      <Text style={[type.title, { color: colors.ink }]}>{coach.planExercises}</Text>
      {items.length === 0 ? <CoachBanner message={coach.emptyExercises} /> : null}
      <View style={{ gap: spacing.sm }}>
        {items.map((row) => (
          <PlanExerciseEditor
            key={[row.id, row.orderIndex, row.sets, row.reps, row.durationSeconds, row.targetRpe, row.coachNotes].join("|")}
            row={row}
            name={exerciseName(row.exerciseId)}
            onRemove={() => onRemove(row.id)}
            onSaved={() => {
              setNotice(coach.saved);
              load();
            }}
            onError={(message) => setError(message)}
          />
        ))}
      </View>

      <Text style={[type.title, { color: colors.ink }]}>{coach.catalog}</Text>
      <View style={{ gap: spacing.sm }}>
        {catalog.map((row) => (
          <CoachCard key={row.id}>
            <Text style={[type.body, { color: colors.ink }]}>{row.name}</Text>
            <Text style={[type.caption, { color: colors.inkMuted, lineHeight: 16 }]}>
              {coach.exerciseCategory[row.category]}
            </Text>
            <Pressable accessibilityRole="button" onPress={() => onAdd(row.id)}>
              <Text style={[type.link, { color: colors.lotus }]}>{coach.addToPlan}</Text>
            </Pressable>
          </CoachCard>
        ))}
      </View>
    </CoachScaffold>
  );
}

function PlanExerciseEditor({
  row,
  name,
  onRemove,
  onSaved,
  onError,
}: {
  row: TrainingPlanExercise;
  name: string;
  onRemove: () => void;
  onSaved: () => void;
  onError: (message: string) => void;
}) {
  const { colors } = useThemePreference();
  const [order, setOrder] = useState(String(row.orderIndex));
  const [sets, setSets] = useState(row.sets != null ? String(row.sets) : "");
  const [reps, setReps] = useState(row.reps != null ? String(row.reps) : "");
  const [duration, setDuration] = useState(
    row.durationSeconds != null ? String(row.durationSeconds) : "",
  );
  const [rpe, setRpe] = useState(row.targetRpe != null ? String(row.targetRpe) : "");
  const [notes, setNotes] = useState(row.coachNotes ?? "");
  const [saving, setSaving] = useState(false);

  const onSave = () => {
    const nextOrder = parseIntField(order, 0);
    if (nextOrder === undefined || nextOrder === null) {
      onError(coach.orderInvalid);
      return;
    }
    const nextSets = parseIntField(sets, 1);
    const nextReps = parseIntField(reps, 1);
    const nextDuration = parseIntField(duration, 1);
    if (nextSets === undefined || nextReps === undefined || nextDuration === undefined) {
      onError(coach.intInvalid);
      return;
    }
    const nextRpe = parseIntField(rpe, 1);
    if (nextRpe === undefined || (nextRpe !== null && nextRpe > 10)) {
      onError(coach.rpeInvalid);
      return;
    }
    setSaving(true);
    void updateTrainingPlanExercise(row.planId, row.id, {
      orderIndex: nextOrder,
      sets: nextSets,
      reps: nextReps,
      durationSeconds: nextDuration,
      targetRpe: nextRpe,
      coachNotes: notes.trim() ? notes.trim() : null,
    })
      .then(onSaved)
      .catch((cause: unknown) => onError(coachErrorMessage(cause)))
      .finally(() => setSaving(false));
  };

  return (
    <CoachCard>
      <Text style={[type.body, { color: colors.ink }]}>{name}</Text>
      <CoachField label={coach.orderIndex} value={order} onChangeText={setOrder} keyboardType="number-pad" />
      <CoachField label={coach.sets} value={sets} onChangeText={setSets} keyboardType="number-pad" />
      <CoachField label={coach.reps} value={reps} onChangeText={setReps} keyboardType="number-pad" />
      <CoachField
        label={coach.durationSec}
        value={duration}
        onChangeText={setDuration}
        keyboardType="number-pad"
      />
      <CoachField label={coach.rpe} value={rpe} onChangeText={setRpe} keyboardType="number-pad" maxLength={2} />
      <CoachField
        label={coach.exerciseNotes}
        helper={coach.optional}
        value={notes}
        onChangeText={setNotes}
        maxLength={NOTES_MAX}
        multiline
      />
      <CoachPrimaryButton title={coach.saveExercise} onPress={onSave} loading={saving} />
      <Pressable accessibilityRole="button" onPress={onRemove}>
        <Text style={[type.link, { color: colors.danger }]}>{coach.remove}</Text>
      </Pressable>
    </CoachCard>
  );
}
