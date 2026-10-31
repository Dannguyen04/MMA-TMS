"use client";

import { Ban, Repeat, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";

import { InlineNote } from "@/components/dashboard/inline-note";
import { ClearanceCard } from "@/components/domain/clearance-card";
import { FighterIdentity } from "@/components/domain/fighter-identity";
import { TRAINING_TYPE_ICONS } from "@/components/domain/training-type-icon";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ChoiceGroup, type ChoiceOption } from "@/components/ui/choice-group";
import { Checkbox, Field, FormMessage, FormSection, Input, Select, Textarea } from "@/components/ui/form";
import { EmptyState } from "@/components/ui/states";
import { SubmitButton } from "@/components/ui/submit-button";
import { appendSuggestion, SuggestionChips } from "@/components/ui/suggestion-chips";
import { useActionForm } from "@/components/ui/use-action-form";
import type { ActionState } from "@/lib/actions/state";
import { previewSessionConflicts, type SessionFormResult } from "@/lib/actions/training";
import { PLAN_STATUS_LABELS, TRAINING_TYPE_LABELS } from "@/lib/domain/labels";
import { SERVICE_TRAINING_TYPES } from "@/lib/domain/training-contract";
import type { ClearanceConflict } from "@/lib/domain/rules";
import { MAX_WEEKLY_REPEATS, presetDuration, SESSION_PRESETS, suggestedSessionTitle, weeklyDates } from "@/lib/domain/training-templates";
import type { Exercise, PlanStatus, TrainingType } from "@/lib/domain/types";
import { academyDayStartIso, formatShortDate, isDateKey, pluralize } from "@/lib/format";
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
    /** The plan's last academy day (YYYY-MM-DD), or null for an open-ended plan. Weekly repeats stop there. */
    endDate: string | null;
}

/** The fighter's plan to preselect: their only active plan, when they have exactly one. */
function onlyActivePlan(plans: SessionFormPlan[], fighterId: string): string {
    const active = plans.filter((plan) => plan.fighterId === fighterId && plan.status === "active");
    return active.length === 1 ? active[0].id : "";
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
    const form = useActionForm(action, { id: "session" });
    const planTitleFor = (planId: string) => plans.find((plan) => plan.id === planId)?.title ?? null;
    const [values, setValues] = useState(() => ({
        ...defaults,
        location: defaults.location || DEFAULT_LOCATION[defaults.type],
        // A new session's title follows its type and plan until the coach types one.
        title: defaults.title || (mode === "create" ? suggestedSessionTitle(defaults.type, planTitleFor(defaults.planId)) : ""),
    }));
    const [titleTouched, setTitleTouched] = useState(defaults.title !== "");
    const [repeat, setRepeat] = useState(false);
    const [repeatCount, setRepeatCount] = useState("4");
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
            ? "Resolve the blocking clearance conflicts to schedule this session."
            : checkStatus === "ready" && warnings.length > 0 && !acknowledged
              ? "Confirm you've reviewed the clearance warnings to continue."
              : null;

    /** Title, location and duration follow the type and plan while they still hold the defaults. */
    const withDefaults = (current: SessionFormValues, type: TrainingType, planId: string): SessionFormValues => ({
        ...current,
        type,
        planId,
        title: titleTouched ? current.title : suggestedSessionTitle(type, planTitleFor(planId)),
        location: !current.location.trim() || current.location === DEFAULT_LOCATION[current.type] ? DEFAULT_LOCATION[type] : current.location,
        durationMin: !current.durationMin.trim() || current.durationMin === String(presetDuration(current.type)) ? String(presetDuration(type)) : current.durationMin,
    });

    const changeType = (next: TrainingType) => setValues((current) => withDefaults(current, next, current.planId));

    const changePlan = (next: string) => setValues((current) => withDefaults(current, current.type, next));

    // A plan that belongs to someone else gives way to the new fighter's only active plan, if they have exactly one.
    const changeFighter = (next: string) =>
        setValues((current) => {
            const planStillValid = plans.some((plan) => plan.id === current.planId && plan.fighterId === next);
            return withDefaults({ ...current, fighterId: next }, current.type, planStillValid ? current.planId : onlyActivePlan(plans, next));
        });

    const suggestedTitle = suggestedSessionTitle(values.type, planTitleFor(values.planId));
    const preset = SESSION_PRESETS[values.type];
    const selectedPlan = plans.find((plan) => plan.id === values.planId);
    const repeats = Number(repeatCount);
    const repeatValid = Number.isInteger(repeats) && repeats >= 2 && repeats <= MAX_WEEKLY_REPEATS;
    const repeatPlan = repeat && repeatValid && isDateKey(values.date) ? weeklyDates(values.date, repeats, selectedPlan?.endDate ?? null) : null;

    const types = serviceForm ? SERVICE_TRAINING_TYPES : (Object.keys(TRAINING_TYPE_LABELS) as TrainingType[]);
    const typeOptions: ChoiceOption<TrainingType>[] = types.map((value) => ({
        value,
        label: TRAINING_TYPE_LABELS[value],
        icon: TRAINING_TYPE_ICONS[value],
        extra: restrictedTypes.includes(value) ? (
            <Badge tone="danger" size="sm" icon={Ban} className="mt-1.5">
                Restricted
            </Badge>
        ) : undefined,
    }));

    const input = (name: keyof SessionFormValues, options?: { hint?: boolean; required?: boolean }) => form.control(name, options);

    const submitLabel = mode === "edit" ? "Save changes" : repeatPlan && repeatPlan.dates.length > 1 ? `Schedule ${repeatPlan.dates.length} sessions` : "Schedule session";
    // The training service doesn't move a session to another plan.
    const planLocked = serviceForm && mode === "edit";

    return (
        <form {...form.formProps} className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
            <input type="hidden" name="exercises" value={serializeExerciseRows(values.exercises, libraryById)} />

            <Card className="min-w-0 lg:col-span-2">
                <CardContent className="pt-6">
                    <FormSection title="Fighter & plan" description="Who trains, and which plan the session counts towards.">
                        {mode === "create" ? (
                            <Field label="Fighter" htmlFor="session-fighterId" required error={error("fighterId")}>
                                <Select {...input("fighterId", { required: true })} value={values.fighterId} onChange={(event) => changeFighter(event.target.value)}>
                                    <option value="">Choose a fighter…</option>
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
                                    <p className="text-sm font-medium text-fg">Fighter</p>
                                    <FighterIdentity fighter={fighter} showHealth />
                                </div>
                            )
                        )}
                        <Field
                            label="Training plan"
                            htmlFor="session-planId"
                            optional
                            error={error("planId")}
                            hint={
                                planLocked
                                    ? "A session stays in the plan it was scheduled under."
                                    : values.fighterId
                                      ? "Active and draft plans for this fighter."
                                      : "Choose a fighter first."
                            }
                        >
                            <Select
                                {...input("planId", { hint: true })}
                                value={values.planId}
                                onChange={(event) => changePlan(event.target.value)}
                                disabled={!values.fighterId || planLocked}
                            >
                                <option value="">Not part of a plan</option>
                                {fighterPlans.map((plan) => (
                                    <option key={plan.id} value={plan.id}>
                                        {plan.title}
                                        {plan.status !== "active" ? ` (${PLAN_STATUS_LABELS[plan.status]})` : ""}
                                    </option>
                                ))}
                            </Select>
                        </Field>
                        <div className="flex flex-col gap-2">
                            <Field label="Session title" htmlFor="session-title" required error={error("title")}>
                                <Input
                                    {...input("title", { required: true })}
                                    value={values.title}
                                    onChange={(event) => {
                                        setTitleTouched(true);
                                        set("title", event.target.value);
                                    }}
                                    placeholder={`e.g. ${TRAINING_TYPE_LABELS[values.type]} — lead hook counters`}
                                    maxLength={120}
                                />
                            </Field>
                            {mode === "create" && values.title.trim() !== suggestedTitle && (
                                <SuggestionChips
                                    label="Suggested"
                                    suggestions={[{ label: suggestedTitle }]}
                                    onPick={(value) => {
                                        setTitleTouched(false);
                                        set("title", value);
                                        form.markEdited("title");
                                    }}
                                />
                            )}
                        </div>
                    </FormSection>

                    <FormSection title="Training type" description="Some types may be restricted by the fighter's Medical Clearance.">
                        <ChoiceGroup
                            id="session-type"
                            name="type"
                            legend="Type"
                            required
                            columns={2}
                            value={values.type}
                            onChange={changeType}
                            options={typeOptions}
                            error={error("type")}
                        />
                    </FormSection>

                    <FormSection title="When & where" description="Academy time (Ho Chi Minh City).">
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                            <Field label="Date" htmlFor="session-date" required error={error("date")}>
                                <Input {...input("date", { required: true })} type="date" min={minDate} value={values.date} onChange={(event) => set("date", event.target.value)} />
                            </Field>
                            <Field label="Start time" htmlFor="session-time" required error={error("time")}>
                                <Input {...input("time", { required: true })} type="time" step={300} value={values.time} onChange={(event) => set("time", event.target.value)} />
                            </Field>
                            <Field label="Duration (min)" htmlFor="session-durationMin" required error={error("durationMin")}>
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
                        <Field label="Location" htmlFor="session-location" required error={error("location")}>
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
                        {mode === "create" && (
                            <div className="flex flex-col gap-3 rounded-lg bg-surface-muted p-3">
                                <Checkbox
                                    id="session-repeat"
                                    name="repeat"
                                    checked={repeat}
                                    onChange={(event) => setRepeat(event.target.checked)}
                                    label="Repeat weekly"
                                    description={`Same day and time each week, up to ${MAX_WEEKLY_REPEATS} sessions.${selectedPlan?.endDate ? " Stops when the plan ends." : ""}`}
                                />
                                {repeat && (
                                    <div className="flex flex-col gap-2 pl-7">
                                        <Field label="Number of sessions" htmlFor="session-repeatCount" required error={error("repeatCount")} hint="Includes this one." className="max-w-40">
                                            <Input
                                                {...form.control("repeatCount", { required: true, hint: true })}
                                                type="number"
                                                inputMode="numeric"
                                                min={2}
                                                max={MAX_WEEKLY_REPEATS}
                                                step={1}
                                                value={repeatCount}
                                                onChange={(event) => setRepeatCount(event.target.value)}
                                            />
                                        </Field>
                                        {repeatPlan && (
                                            <p className="flex items-start gap-2 text-[13px] text-fg-muted" aria-live="polite">
                                                <Repeat aria-hidden className="mt-0.5 size-3.5 shrink-0" />
                                                <span>
                                                    {pluralize(repeatPlan.dates.length, "session")}: {repeatPlan.dates.map((date) => formatShortDate(academyDayStartIso(date))).join(", ")}.
                                                    {repeatPlan.skipped > 0 &&
                                                        ` ${pluralize(repeatPlan.skipped, "week")} after the plan ends ${repeatPlan.skipped === 1 ? "is" : "are"} left out.`}
                                                </span>
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </FormSection>

                    {!serviceForm && (
                        <>
                            <FormSection title="Intensity" description="Target session RPE — how hard it should feel overall.">
                                <RpeSlider
                                    id="session-targetRpe"
                                    name="targetRpe"
                                    label="Target RPE"
                                    value={values.targetRpe}
                                    onChange={(next) => set("targetRpe", next)}
                                    hint="How hard the session should feel, from 1 to 10."
                                    required
                                    maxAllowed={clearanceMaxRpe(clearance)}
                                    error={error("targetRpe")}
                                />
                            </FormSection>

                            <FormSection title="Exercises" description="Drills in running order with rounds or sets.">
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

                    <FormSection title="Notes" description="Anything the fighter should know or bring.">
                        <div className="flex flex-col gap-2">
                            <Field label="Session notes" htmlFor="session-notes" optional error={error("notes")}>
                                <Textarea {...input("notes")} value={values.notes} onChange={(event) => set("notes", event.target.value)} rows={3} maxLength={1000} />
                            </Field>
                            {preset && (
                                <SuggestionChips
                                    label="Add"
                                    suggestions={[{ label: preset.notes }]}
                                    onPick={(value) => {
                                        set("notes", appendSuggestion(values.notes, value));
                                        form.markEdited("notes");
                                    }}
                                />
                            )}
                        </div>
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
                                title="Medical Clearance"
                                description="Choose a fighter to see their clearance and restrictions."
                            />
                        </CardContent>
                    </Card>
                )}

                <div className="flex flex-col gap-4 lg:sticky lg:top-20">
                    {serviceForm ? (
                        <InlineNote icon={ShieldCheck}>The training service checks the fighter&apos;s Medical Clearance when you start the session.</InlineNote>
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
                        <SubmitButton size="lg" className="w-full" disabled={blockedReason !== null} pending={form.pending} pendingLabel={mode === "create" ? "Scheduling…" : "Saving…"}>
                            {submitLabel}
                        </SubmitButton>
                        <p className={blockedReason ? "text-center text-[13px] text-fg-muted" : "sr-only"} aria-live="polite">
                            {blockedReason}
                        </p>
                        <ButtonLink href={cancelHref} variant="ghost" className="w-full">
                            Cancel
                        </ButtonLink>
                    </Card>
                </div>
            </div>
        </form>
    );
}
