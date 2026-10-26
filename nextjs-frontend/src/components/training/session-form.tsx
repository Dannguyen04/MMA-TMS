"use client";

import { useT } from "@/components/i18n/locale-provider";
import { Ban, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";

import { InlineNote } from "@/components/dashboard/inline-note";
import { ClearanceCard } from "@/components/domain/clearance-card";
import { FighterIdentity } from "@/components/domain/fighter-identity";
import { TRAINING_TYPE_ICONS } from "@/components/domain/training-type-icon";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ChoiceGroup, type ChoiceOption } from "@/components/ui/choice-group";
import { Field, FormMessage, FormSection, Input, Select, Textarea } from "@/components/ui/form";
import { EmptyState } from "@/components/ui/states";
import { SubmitButton } from "@/components/ui/submit-button";
import { useActionForm } from "@/components/ui/use-action-form";
import type { ActionState } from "@/lib/actions/state";
import { previewSessionConflicts, type SessionFormResult } from "@/lib/actions/training";
import { planStatusLabel, trainingTypeLabel, TRAINING_TYPE_LABELS } from "@/lib/domain/labels";
import { SERVICE_TRAINING_TYPES } from "@/lib/domain/training-contract";
import type { ClearanceConflict } from "@/lib/domain/rules";
import type { Exercise, PlanStatus, TrainingType } from "@/lib/domain/types";
import { ClearanceCheckPanel, type ClearanceCheckStatus } from "./clearance-check-panel";
import { ExerciseBuilder } from "./exercise-builder";
import { serializeExerciseRows, type ExerciseRow } from "./exercise-rows";
import type { PlanFormFighter } from "./plan-form";
import { RpeSlider } from "./rpe-slider";
import { clearanceMaxRpe, type ClearanceSummary } from "./training-utils";

export interface SessionFormValues {
    fighterId: string;
    planId: string;
    title: string;
    type: TrainingType;
    date: string;
    time: string;
    durationMin: string;
    location: string;
    targetRpe: number;
    exercises: ExerciseRow[];
    notes: string;
}

export interface SessionFormPlan {
    id: string;
    title: string;
    fighterId: string;
    status: PlanStatus;
}

export interface SessionFormProps {
    mode: "create" | "edit";
    action: (state: ActionState<SessionFormResult>, formData: FormData) => Promise<ActionState<SessionFormResult>>;
    /** Roster fighters (create) or the session's fighter (edit). */
    fighters: PlanFormFighter[];
    plans: SessionFormPlan[];
    library: Exercise[];
    clearances: Record<string, ClearanceSummary>;
    /** Known training locations for suggestions. */
    locations: string[];
    defaults: SessionFormValues;
    /** Server time (ISO). */
    now: string;
    /** Earliest selectable date (YYYY-MM-DD). */
    minDate?: string;
    cancelHref: string;
    /**
     * Only what the training service stores (`usesTrainingServiceForms`): no target RPE or exercises, its own training
     * types, and no live clearance check, because the service checks Medical Clearance when the session starts.
     */
    serviceForm: boolean;
}

/** Where each training type usually happens at the academy; used to prefill the location. */
const DEFAULT_LOCATION: Record<TrainingType, string> = {
    shadow_boxing: "Striking room",
    pad_work: "Striking room",
    heavy_bag: "Striking room",
    sparring: "Cage",
    technical_drilling: "Striking room",
    grappling: "Main mat",
    strength_conditioning: "S&C floor",
    recovery_mobility: "Recovery room",
};

interface CheckResult {
    key: string;
    status: Exclude<ClearanceCheckStatus, "idle">;
    conflicts: ClearanceConflict[];
}

/** Schedule or edit a session with a live Medical Clearance check. */
export function SessionForm({ mode, action, fighters, plans, library, clearances, locations, defaults, now, minDate, cancelHref, serviceForm }: SessionFormProps) {
    const t = useT();
    const form = useActionForm(action, { id: "session" });
    const [values, setValues] = useState(() => ({ ...defaults, location: defaults.location || DEFAULT_LOCATION[defaults.type] }));
    const [check, setCheck] = useState<CheckResult | null>(null);
    const [acknowledgedFor, setAcknowledgedFor] = useState<string | null>(null);
    const { error } = form;
    const set = <K extends keyof SessionFormValues>(key: K, value: SessionFormValues[K]) => setValues((current) => ({ ...current, [key]: value }));
    const libraryById = Object.fromEntries(library.map((exercise) => [exercise.id, exercise]));

    const fighter = fighters.find((f) => f.id === values.fighterId);
    const clearance = values.fighterId ? clearances[values.fighterId] : undefined;
    const restrictions = clearance?.state === "restricted" && clearance.clearance ? clearance.clearance.restrictions : [];
    const restrictedTypes = restrictions.flatMap((r) => r.blockedTrainingTypes);
    const fighterPlans = plans.filter((plan) => plan.fighterId === values.fighterId && (plan.status === "active" || plan.status === "draft" || plan.id === defaults.planId));

    /* Live clearance check: debounced server check whenever an input that affects it changes. */
    const { fighterId, type, targetRpe, date, time } = values;
    const exerciseKey = values.exercises.map((row) => row.exerciseId).join(",");
    const checkKey = [fighterId, type, targetRpe, date, time, exerciseKey].join("|");

    useEffect(() => {
        if (!fighterId || serviceForm) return;
        let cancelled = false;
        const timer = window.setTimeout(() => {
            previewSessionConflicts({ fighterId, type, targetRpe, date, time, exerciseIds: exerciseKey ? exerciseKey.split(",") : [] }).then(
                (result) => {
                    if (cancelled) return;
                    setCheck({ key: checkKey, status: result.status === "success" ? "ready" : "error", conflicts: result.data?.conflicts ?? [] });
                },
                () => {
                    if (!cancelled) setCheck({ key: checkKey, status: "error", conflicts: [] });
                },
            );
        }, 350);
        return () => {
            cancelled = true;
            window.clearTimeout(timer);
        };
    }, [fighterId, type, targetRpe, date, time, exerciseKey, checkKey, serviceForm]);

    const hasResult = Boolean(fighterId) && !serviceForm && check !== null;
    const checkStatus: ClearanceCheckStatus = hasResult && check ? check.status : "idle";
    const pending = Boolean(fighterId) && !serviceForm && check?.key !== checkKey;
    const conflicts = hasResult && check ? check.conflicts : [];
    const blocks = conflicts.filter((c) => c.severity === "block");
    const warnings = conflicts.filter((c) => c.severity === "warn");
    const warningsKey = warnings.map((c) => c.message).join("|");
    const acknowledged = warnings.length > 0 && acknowledgedFor === warningsKey;

    const blockedReason =
        checkStatus === "ready" && blocks.length > 0
            ? t("training.sessionForm.blockedResolve")
            : checkStatus === "ready" && warnings.length > 0 && !acknowledged
              ? t("training.sessionForm.blockedConfirm")
              : null;

    const changeType = (next: TrainingType) =>
        setValues((current) => ({
            ...current,
            type: next,
            location: !current.location.trim() || current.location === DEFAULT_LOCATION[current.type] ? DEFAULT_LOCATION[next] : current.location,
        }));

    const changeFighter = (next: string) =>
        setValues((current) => {
            const planStillValid = plans.some((plan) => plan.id === current.planId && plan.fighterId === next);
            return { ...current, fighterId: next, planId: planStillValid ? current.planId : "" };
        });

    const types = serviceForm ? SERVICE_TRAINING_TYPES : (Object.keys(TRAINING_TYPE_LABELS) as TrainingType[]);
    const typeOptions: ChoiceOption<TrainingType>[] = types.map((value) => ({
        value,
        label: trainingTypeLabel(t, value),
        icon: TRAINING_TYPE_ICONS[value],
        extra: restrictedTypes.includes(value) ? (
            <Badge tone="danger" size="sm" icon={Ban} className="mt-1.5">
                {t("training.sessionForm.restrictedBadge")}
            </Badge>
        ) : undefined,
    }));

    const input = (name: keyof SessionFormValues, options?: { hint?: boolean; required?: boolean }) => form.control(name, options);

    const submitLabel = mode === "create" ? t("training.sessionForm.submitCreate") : t("training.sessionForm.submitEdit");
    const planLocked = serviceForm && mode === "edit";

    return (
        <form {...form.formProps} className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
            <input type="hidden" name="exercises" value={serializeExerciseRows(values.exercises, libraryById)} />

            <Card className="min-w-0 lg:col-span-2">
                <CardContent className="pt-6">
                    <FormSection title={t("training.sessionForm.sectionFighterPlan")} description={t("training.sessionForm.sectionFighterPlanDesc")}>
                        {mode === "create" ? (
                            <Field label={t("training.sessionForm.fighter")} htmlFor="session-fighterId" required error={error("fighterId")}>
                                <Select {...input("fighterId", { required: true })} value={values.fighterId} onChange={(event) => changeFighter(event.target.value)}>
                                    <option value="">{t("training.sessionForm.chooseFighter")}</option>
                                    {fighters.map((option) => (
                                        <option key={option.id} value={option.id}>
                                            {option.name}
                                        </option>
                                    ))}
                                </Select>
                            </Field>
                        ) : (
                            fighter && (
                                <div className="flex flex-col gap-1.5">
                                    <p className="text-sm font-medium text-fg">{t("training.sessionForm.fighter")}</p>
                                    <FighterIdentity fighter={fighter} showHealth />
                                </div>
                            )
                        )}
                        <Field
                            label={t("training.sessionForm.plan")}
                            htmlFor="session-planId"
                            optional
                            error={error("planId")}
                            hint={
                                planLocked
                                    ? t("training.sessionForm.planLocked")
                                    : values.fighterId
                                      ? t("training.sessionForm.planHint")
                                      : t("training.sessionForm.planChooseFirst")
                            }
                        >
                            <Select
                                {...input("planId", { hint: true })}
                                value={values.planId}
                                onChange={(event) => set("planId", event.target.value)}
                                disabled={!values.fighterId || planLocked}
                            >
                                <option value="">{t("training.sessionForm.noPlan")}</option>
                                {fighterPlans.map((plan) => (
                                    <option key={plan.id} value={plan.id}>
                                        {plan.title}
                                        {plan.status !== "active" ? ` (${planStatusLabel(t, plan.status)})` : ""}
                                    </option>
                                ))}
                            </Select>
                        </Field>
                        <Field label={t("training.sessionForm.title")} htmlFor="session-title" required error={error("title")}>
                            <Input
                                {...input("title", { required: true })}
                                value={values.title}
                                onChange={(event) => set("title", event.target.value)}
                                placeholder={t("training.sessionForm.titlePlaceholder", { type: trainingTypeLabel(t, values.type) })}
                                maxLength={120}
                            />
                        </Field>
                    </FormSection>

                    <FormSection title={t("training.sessionForm.sectionType")} description={t("training.sessionForm.sectionTypeDesc")}>
                        <ChoiceGroup
                            id="session-type"
                            name="type"
                            legend={t("training.sessionForm.sectionType")}
                            required
                            columns={2}
                            value={values.type}
                            onChange={changeType}
                            options={typeOptions}
                            error={error("type")}
                        />
                    </FormSection>

                    <FormSection title={t("training.sessionForm.sectionWhenWhere")} description={t("training.sessionForm.sectionWhenWhereDesc")}>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                            <Field label={t("training.sessionForm.date")} htmlFor="session-date" required error={error("date")}>
                                <Input {...input("date", { required: true })} type="date" min={minDate} value={values.date} onChange={(event) => set("date", event.target.value)} />
                            </Field>
                            <Field label={t("training.sessionForm.time")} htmlFor="session-time" required error={error("time")}>
                                <Input {...input("time", { required: true })} type="time" step={300} value={values.time} onChange={(event) => set("time", event.target.value)} />
                            </Field>
                            <Field label={t("training.sessionForm.durationMin")} htmlFor="session-durationMin" required error={error("durationMin")}>
                                <Input
                                    {...input("durationMin", { required: true })}
                                    type="number"
                                    inputMode="numeric"
                                    min={10}
                                    max={300}
                                    step={5}
                                    value={values.durationMin}
                                    onChange={(event) => set("durationMin", event.target.value)}
                                />
                            </Field>
                        </div>
                        <Field label={t("training.sessionForm.location")} htmlFor="session-location" required error={error("location")}>
                            <Input
                                {...input("location", { required: true })}
                                list="session-location-options"
                                value={values.location}
                                onChange={(event) => set("location", event.target.value)}
                                maxLength={120}
                            />
                            <datalist id="session-location-options">
                                {locations.map((location) => (
                                    <option key={location} value={location} />
                                ))}
                            </datalist>
                        </Field>
                    </FormSection>

                    {!serviceForm && (
                        <>
                            <FormSection title={t("training.sessionForm.sectionIntensity")} description={t("training.sessionForm.sectionIntensityDesc")}>
                                <RpeSlider
                                    id="session-targetRpe"
                                    name="targetRpe"
                                    label={t("training.sessionForm.targetRpe")}
                                    value={values.targetRpe}
                                    onChange={(next) => set("targetRpe", next)}
                                    hint={t("training.sessionForm.targetRpeHint")}
                                    required
                                    maxAllowed={clearanceMaxRpe(clearance)}
                                    error={error("targetRpe")}
                                />
                            </FormSection>

                            <FormSection title={t("training.sessionForm.sectionExercises")} description={t("training.sessionForm.sectionExercisesDesc")}>
                                <ExerciseBuilder
                                    library={library}
                                    rows={values.exercises}
                                    onChange={(rows) => set("exercises", rows)}
                                    error={error}
                                    markEdited={form.markEdited}
                                    restrictedTechniques={restrictions.flatMap((r) => r.blockedTechniques)}
                                    restrictedRegions={restrictions.flatMap((r) => r.blockedRegions)}
                                />
                            </FormSection>
                        </>
                    )}

                    <FormSection title={t("training.sessionForm.sectionNotes")} description={t("training.sessionForm.sectionNotesDesc")}>
                        <Field label={t("training.sessionForm.sessionNotes")} htmlFor="session-notes" optional error={error("notes")}>
                            <Textarea {...input("notes")} value={values.notes} onChange={(event) => set("notes", event.target.value)} rows={3} maxLength={1000} />
                        </Field>
                    </FormSection>
                </CardContent>
            </Card>

            <div className="flex min-w-0 flex-col gap-4 self-stretch">
                {clearance ? (
                    <ClearanceCard clearance={clearance.clearance} state={clearance.state} doctorName={clearance.doctorName} now={now} variant="summary" />
                ) : (
                    <Card>
                        <CardContent className="pt-5">
                            <EmptyState
                                compact
                                icon={<ShieldCheck />}
                                title={t("training.sessionForm.emptyClearanceTitle")}
                                description={t("training.sessionForm.emptyClearanceDesc")}
                            />
                        </CardContent>
                    </Card>
                )}

                <div className="flex flex-col gap-4 lg:sticky lg:top-20">
                    {serviceForm ? (
                        <InlineNote icon={ShieldCheck}>{t("training.sessionForm.serviceClearanceNotice")}</InlineNote>
                    ) : (
                        <ClearanceCheckPanel
                            status={checkStatus}
                            pending={pending}
                            conflicts={conflicts}
                            fighterName={fighter?.name}
                            acknowledged={acknowledged}
                            onAcknowledgedChange={(value) => setAcknowledgedFor(value ? warningsKey : null)}
                        />
                    )}
                    <Card className="flex flex-col gap-3 p-4">
                        <FormMessage {...form.message} />
                        <SubmitButton size="lg" className="w-full" disabled={blockedReason !== null} pending={form.pending} pendingLabel={mode === "create" ? t("training.sessionForm.submittingCreate") : t("training.sessionForm.submittingEdit")}>
                            {submitLabel}
                        </SubmitButton>
                        <p className={blockedReason ? "text-center text-[13px] text-fg-muted" : "sr-only"} aria-live="polite">
                            {blockedReason}
                        </p>
                        <ButtonLink href={cancelHref} variant="ghost" className="w-full">
                            {t("common.cancel")}
                        </ButtonLink>
                    </Card>
                </div>
            </div>
        </form>
    );
}
