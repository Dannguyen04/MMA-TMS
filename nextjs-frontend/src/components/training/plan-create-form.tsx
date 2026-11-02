"use client";

import { Copy, FilePlus2, LayoutTemplate, PenLine, ShieldAlert, ShieldCheck } from "lucide-react";
import { useState, useTransition, type ReactNode } from "react";

import { ClearanceCard } from "@/components/domain/clearance-card";
import { useLocale, useT } from "@/components/i18n/locale-provider";
import { Term, TermHint } from "@/components/domain/term-hint";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ChoiceGroup } from "@/components/ui/choice-group";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Field, FormMessage, Input, Select, Textarea } from "@/components/ui/form";
import { FormStep, FormSteps, useFormSteps } from "@/components/ui/form-steps";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { EmptyState } from "@/components/ui/states";
import { SubmitButton } from "@/components/ui/submit-button";
import { appendSuggestion, SuggestionChips } from "@/components/ui/suggestion-chips";
import { useActionForm } from "@/components/ui/use-action-form";
import type { ActionState } from "@/lib/actions/state";
import { loadPlanCopy } from "@/lib/actions/training";
import { GLOSSARY, type GlossaryTerm } from "@/lib/domain/glossary";
import { planStatusLabel, techniqueLabel, trainingPhaseLabel } from "@/lib/domain/labels";
import {
    PHASE_OBJECTIVE_SUGGESTIONS,
    PLAN_LENGTH_WEEKS,
    PLAN_TEMPLATES,
    planEndKey,
    planSpanDays,
    planWholeWeeks,
    type PlanTemplate,
    type PlanTemplateId,
} from "@/lib/domain/training-templates";
import type { Exercise, PlanStatus, Technique, TrainingPhase } from "@/lib/domain/types";
import { addDaysToKey, formatDate, academyDayStartIso, isDateKey } from "@/lib/format";
import { plural, type MessageKey, type Translator } from "@/lib/i18n/translate";
import { cn } from "@/lib/utils";
import { Callout } from "./callout";
import { draftsFromPlanExercises, draftsFromTemplate, sentDrafts, serializePlanExerciseDrafts, type PlanCopy, type PlanExerciseDraft } from "./plan-drafts";
import { PlanExerciseRows } from "./plan-exercise-rows";
import type { PlanFormFighter } from "./plan-form";
import { TechniqueCheckboxes } from "./technique-checkboxes";
import type { ClearanceSummary } from "./training-utils";

export type PlanSource = { kind: "blank" } | { kind: "template"; id: PlanTemplateId } | { kind: "copy"; planId: string | null };

export interface PlanCreateValues {
    fighterId: string;
    title: string;
    phase: TrainingPhase;
    startDate: string;
    endDate: string;
    objective: string;
    notes: string;
    /** Demo-only details (`serviceForm` off). */
    focusAreas: Technique[];
    weeklySessionTarget: string;
    status: "draft" | "active";
}

export interface CopyablePlan {
    id: string;
    title: string;
    fighterName: string;
    phase: TrainingPhase;
    status: PlanStatus;
    /** Whole weeks the plan spans, or null. */
    weeks: number | null;
}

export interface PlanCreateFormProps {
    action: (state: ActionState, formData: FormData) => Promise<ActionState>;
    fighters: PlanFormFighter[];
    clearances: Record<string, ClearanceSummary>;
    library: Exercise[];
    /** Plans on the coach's roster that can be copied. */
    copyablePlans: CopyablePlan[];
    /** What the form starts from (`?template=`, `?from=`), with the copied plan when there is one. */
    initialSource: PlanSource;
    initialCopy: PlanCopy | null;
    defaults: PlanCreateValues;
    /** Server time (ISO) and today's academy date key. */
    now: string;
    today: string;
    cancelHref: string;
    /** Only what the training service stores: no focus areas or weekly target (`usesTrainingServiceForms`). */
    serviceForm: boolean;
}

function planSteps(t: Translator) {
    return [
        { id: "start", label: t("screens.training.planCreate.step.start"), description: t("screens.training.planCreate.step.startDesc") },
        { id: "basics", label: t("screens.training.planCreate.step.basics"), description: t("screens.training.planCreate.step.basicsDesc") },
        { id: "exercises", label: t("screens.training.planCreate.step.exercises"), description: t("screens.training.planCreate.step.exercisesDesc"), optional: true },
        { id: "review", label: t("screens.training.planCreate.step.review"), description: t("screens.training.planCreate.step.reviewDesc") },
    ];
}

const STEP_NAMES: Record<string, MessageKey> = {
    start: "screens.training.planCreate.stepName.start",
    basics: "screens.training.planCreate.stepName.basics",
    exercises: "screens.training.planCreate.stepName.exercises",
};

const PHASES: TrainingPhase[] = ["base", "build", "fight_camp", "taper", "rehab", "maintenance"];

/** A template's card copy in the viewer's language; the template file keeps the English that fills the form. */
function templateLabel(t: Translator, template: PlanTemplate): string {
    return t(`screens.training.template.${template.id}.label` as MessageKey);
}

function templateSummary(t: Translator, template: PlanTemplate): string {
    return t(`screens.training.template.${template.id}.summary` as MessageKey);
}

/** "Fight camp template", or "Template" when the template is gone. */
function sourceTemplateLabel(t: Translator, template: PlanTemplate | undefined): string {
    return template ? t("screens.training.planCreate.source.template", { template: templateLabel(t, template) }) : t("screens.training.planCreate.source.templateFallback");
}

const PHASE_TERM: Record<TrainingPhase, GlossaryTerm> = {
    base: "phaseBase",
    build: "phaseBuild",
    fight_camp: "phaseFightCamp",
    taper: "phaseTaper",
    rehab: "phaseRehab",
    maintenance: "phaseMaintenance",
};

function statusOptions(t: Translator): { value: PlanCreateValues["status"]; label: string; description: string }[] {
    return [
        { value: "draft", label: t("training.planForm.statusDraft"), description: t("training.planForm.statusDraftDesc") },
        { value: "active", label: t("screens.training.planCreate.createAndActivate"), description: t("screens.training.planCreate.statusActiveDesc") },
    ];
}

/** Fields a starting point fills in; editing any of them makes switching ask first. */
type ContentField = "title" | "phase" | "endDate" | "objective" | "notes";
const CONTENT_FIELDS: ContentField[] = ["title", "phase", "endDate", "objective", "notes"];

/** "4 weeks · Build · 7 exercises" */
function templateMeta(template: PlanTemplate, t: Translator): string {
    return [plural(t, "training.plan.weeksCount", template.weeks), trainingPhaseLabel(t, template.phase), plural(t, "screens.training.exercisesCount", template.exercises.length)].join(" · ");
}

function spanText(startDate: string, endDate: string, t: Translator): string | null {
    const days = planSpanDays(startDate, endDate);
    if (days === null) return null;
    const weeks = planWholeWeeks(startDate, endDate);
    return weeks !== null ? plural(t, "training.plan.weeksCount", weeks) : plural(t, "screens.training.daysCount", days);
}

/**
 * New training plan in four steps inside one form: where to start (a template, a blank plan or a copy of an
 * existing plan), the basics, the exercises and a review. Every step stays mounted, so one submit sends it all and a
 * server error opens the step that holds it.
 */
export function PlanCreateForm({
    action,
    fighters,
    clearances,
    library,
    copyablePlans,
    initialSource,
    initialCopy,
    defaults,
    now,
    today,
    cancelHref,
    serviceForm,
}: PlanCreateFormProps) {
    // List-level errors on the exercises (too many, unreadable) have no control of their own.
    const t = useT();
    const locale = useLocale();
    const form = useActionForm(action, { id: "plan", hiddenFields: ["exercises"] });
    const { error, markEdited } = form;
    const [values, setValues] = useState(defaults);
    const [rows, setRows] = useState<PlanExerciseDraft[]>(() => {
        if (initialSource.kind === "template") {
            const template = PLAN_TEMPLATES.find((candidate) => candidate.id === initialSource.id);
            return template ? draftsFromTemplate(template, library, t) : [];
        }
        return initialCopy ? draftsFromPlanExercises(initialCopy.exercises, library, `copy-${initialCopy.planId}`, t) : [];
    });
    const [source, setSource] = useState<PlanSource>(initialSource);
    const [copyPlanId, setCopyPlanId] = useState(initialCopy?.planId ?? "");
    const [copied, setCopied] = useState<string | null>(initialCopy?.planId ?? null);
    const [copyError, setCopyError] = useState<string | null>(null);
    const [copying, startCopy] = useTransition();
    const [dirty, setDirty] = useState(false);
    const [pending, setPending] = useState<{ label: string; apply(): void } | null>(null);

    const set = <K extends keyof PlanCreateValues>(key: K, value: PlanCreateValues[K]) => {
        setValues((current) => ({ ...current, [key]: value }));
        if ((CONTENT_FIELDS as string[]).includes(key)) setDirty(true);
    };
    const changeRows = (next: PlanExerciseDraft[]) => {
        setRows(next);
        setDirty(true);
    };

    const fighter = fighters.find((option) => option.id === values.fighterId);
    const clearance = values.fighterId ? clearances[values.fighterId] : undefined;
    const restrictedTechniques =
        clearance?.state === "restricted" && clearance.clearance ? clearance.clearance.restrictions.flatMap((r) => r.blockedTechniques) : [];
    const restrictedFocus = values.focusAreas.filter((technique) => restrictedTechniques.includes(technique));

    /* ─── Starting points ─── */

    const applied = (next: PlanSource, content: Pick<PlanCreateValues, ContentField>, nextRows: PlanExerciseDraft[]) => {
        setValues((current) => ({ ...current, ...content }));
        setRows(nextRows);
        setSource(next);
        // The copy picker only names a plan while its content is what's on the form.
        setCopied(next.kind === "copy" ? next.planId : null);
        if (next.kind !== "copy") setCopyPlanId("");
        setDirty(false);
        for (const field of [...CONTENT_FIELDS, "exercises"]) markEdited(field);
    };

    const applyBlank = () =>
        applied({ kind: "blank" }, { title: "", phase: values.phase, endDate: values.endDate, objective: "", notes: "" }, []);

    const applyTemplate = (template: PlanTemplate) =>
        applied(
            { kind: "template", id: template.id },
            {
                title: template.label,
                phase: template.phase,
                endDate: planEndKey(isDateKey(values.startDate) ? values.startDate : today, template.weeks),
                objective: template.objective,
                notes: template.notes,
            },
            draftsFromTemplate(template, library, t),
        );

    const applyCopy = (copy: PlanCopy) => {
        const start = isDateKey(values.startDate) ? values.startDate : today;
        applied(
            { kind: "copy", planId: copy.planId },
            {
                title: copy.title,
                phase: copy.phase,
                endDate: copy.days ? addDaysToKey(start, copy.days - 1) : values.endDate,
                objective: copy.objective,
                notes: copy.notes,
            },
            draftsFromPlanExercises(copy.exercises, library, `copy-${copy.planId}`, t),
        );
    };

    /** Applies a starting point, asking first when the coach has changed what it would replace. */
    const request = (label: string, apply: () => void) => {
        if (dirty) setPending({ label, apply });
        else apply();
    };

    const chooseCopyPlan = (planId: string) => {
        setCopyPlanId(planId);
        setCopyError(null);
        if (!planId) return;
        startCopy(async () => {
            const result = await loadPlanCopy(planId);
            const copy = result.data;
            if (result.status !== "success" || !copy) {
                setCopyError(result.message ?? t("screens.training.planCreate.copyFailed"));
                return;
            }
            const plan = copyablePlans.find((candidate) => candidate.id === planId);
            request(plan ? t("screens.training.planCreate.request.copyOf", { title: plan.title }) : t("screens.training.planCreate.request.copyOfThat"), () => applyCopy(copy));
        });
    };

    /* ─── Dates ─── */

    const changeStart = (next: string) => {
        const weeks = planWholeWeeks(values.startDate, values.endDate);
        setValues((current) => ({ ...current, startDate: next, endDate: weeks !== null && isDateKey(next) ? planEndKey(next, weeks) : current.endDate }));
        markEdited("endDate");
    };
    const currentWeeks = planWholeWeeks(values.startDate, values.endDate);
    const lengthValue = currentWeeks !== null && (PLAN_LENGTH_WEEKS as readonly number[]).includes(currentWeeks) ? String(currentWeeks) : "";

    const validateStep = (stepId: string): string | null => {
        if (stepId === "start" && source.kind === "copy" && !copied) return t("screens.training.planCreate.validate.chooseCopy");
        if (stepId === "basics" && isDateKey(values.startDate) && isDateKey(values.endDate) && values.endDate < values.startDate) {
            return t("screens.training.planCreate.validate.endAfterStart");
        }
        if (stepId === "basics" && !serviceForm && values.focusAreas.length === 0) return t("screens.training.planCreate.validate.focusArea");
        return null;
    };

    const sent = sentDrafts(rows);
    const skipped = rows.filter((row) => row.exerciseId === null).length;
    const sourceLabel =
        source.kind === "blank"
            ? t("screens.training.planCreate.blankPlan")
            : source.kind === "template"
              ? sourceTemplateLabel(t, PLAN_TEMPLATES.find((template) => template.id === source.id))
              : t("screens.training.planCreate.source.copyOf", { title: copyablePlans.find((plan) => plan.id === copied)?.title ?? t("screens.training.planCreate.source.aPlan") });
    const phaseOptions = PHASES.map((value) => ({ value, label: trainingPhaseLabel(t, value) }));
    const span = spanText(values.startDate, values.endDate, t);

    return (
        <form {...form.formProps} className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
            <input type="hidden" name="exercises" value={serializePlanExerciseDrafts(rows)} />

            <Card className="min-w-0 lg:col-span-2">
                <CardContent className="pt-6">
                    <FormSteps
                        steps={planSteps(t)}
                        state={form.state}
                        validateStep={validateStep}
                        message={<FormMessage {...form.message} />}
                        cancel={
                            <ButtonLink href={cancelHref} variant="ghost" size="lg" className="w-full sm:h-9 sm:w-auto sm:px-3.5 sm:text-sm">
                                {t("training.planExercises.cancel")}
                            </ButtonLink>
                        }
                        submit={
                            <SubmitButton pending={form.pending} pendingLabel={t("training.planForm.submittingCreate")} size="lg" className="sm:h-9 sm:px-3.5 sm:text-sm">
                                {values.status === "active" ? t("screens.training.planCreate.createAndActivate") : t("training.planForm.submitCreate")}
                            </SubmitButton>
                        }
                    >
                        <FormStep
                            id="start"
                            title={t("screens.training.planCreate.startTitle")}
                            description={
                                <>
                                    {t("screens.training.planCreate.startIntroBefore")} <Term term="template" locale={locale}>{t("screens.training.planCreate.startIntroTerm")}</Term>{" "}
                                    {t("screens.training.planCreate.startIntroAfter")}
                                </>
                            }
                        >
                            <div role="group" aria-label={t("screens.training.planCreate.startingPoints")} className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                                <SourceCard
                                    icon={FilePlus2}
                                    label={t("screens.training.planCreate.blankPlan")}
                                    summary={t("screens.training.planCreate.blankPlanSummary")}
                                    selected={source.kind === "blank"}
                                    onSelect={() => source.kind !== "blank" && request(t("screens.training.planCreate.request.blank"), applyBlank)}
                                />
                                {PLAN_TEMPLATES.map((template) => (
                                    <SourceCard
                                        key={template.id}
                                        icon={LayoutTemplate}
                                        label={templateLabel(t, template)}
                                        summary={templateSummary(t, template)}
                                        meta={templateMeta(template, t)}
                                        selected={source.kind === "template" && source.id === template.id}
                                        onSelect={() => request(t("screens.training.planCreate.request.template", { template: templateLabel(t, template).toLowerCase() }), () => applyTemplate(template))}
                                    />
                                ))}
                                <SourceCard
                                    icon={Copy}
                                    label={t("screens.training.planCreate.copyPlan")}
                                    summary={copyablePlans.length > 0 ? t("screens.training.planCreate.copyPlanSummary") : t("screens.training.planCreate.copyPlanNone")}
                                    selected={source.kind === "copy"}
                                    disabled={copyablePlans.length === 0}
                                    onSelect={() => setSource({ kind: "copy", planId: copied })}
                                />
                            </div>

                            {source.kind === "copy" && (
                                <div className="mt-5 flex flex-col gap-2">
                                    <Field
                                        label={t("screens.training.planCreate.planToCopy")}
                                        htmlFor="plan-copyFrom"
                                        hint={t("screens.training.planCreate.planToCopyHint")}
                                        error={copyError ?? undefined}
                                    >
                                        <Select id="plan-copyFrom" value={copyPlanId} onChange={(event) => chooseCopyPlan(event.target.value)} disabled={copying} aria-busy={copying || undefined}>
                                            <option value="">{t("screens.training.planCreate.choosePlan")}</option>
                                            {copyablePlans.map((plan) => (
                                                <option key={plan.id} value={plan.id}>
                                                    {plan.title} — {plan.fighterName} · {trainingPhaseLabel(t, plan.phase)}
                                                    {plan.weeks ? ` · ${plural(t, "training.plan.weeksCount", plan.weeks)}` : ""}
                                                    {plan.status !== "active" ? ` (${planStatusLabel(t, plan.status)})` : ""}
                                                </option>
                                            ))}
                                        </Select>
                                    </Field>
                                    <p className="text-[13px] text-fg-muted" aria-live="polite">
                                        {copying ? t("screens.training.planCreate.copying") : copied && copied === copyPlanId ? t("screens.training.planCreate.copied") : null}
                                    </p>
                                </div>
                            )}
                        </FormStep>

                        <FormStep id="basics" title={t("screens.training.planCreate.step.basics")} description={t("screens.training.planCreate.basicsDesc")}>
                            <div className="flex flex-col gap-5">
                                <Field label={t("training.planForm.fighter")} htmlFor="plan-fighterId" required error={error("fighterId")} hint={t("training.planForm.hintFighter")}>
                                    <Select
                                        {...form.control("fighterId", { required: true, hint: true })}
                                        value={values.fighterId}
                                        onChange={(event) => set("fighterId", event.target.value)}
                                    >
                                        <option value="">{t("training.planForm.chooseFighter")}</option>
                                        {fighters.map((option) => (
                                            <option key={option.id} value={option.id}>
                                                {option.name}
                                            </option>
                                        ))}
                                    </Select>
                                </Field>
                                <Field label={t("training.planForm.title")} htmlFor="plan-title" required error={error("title")}>
                                    <Input
                                        {...form.control("title", { required: true })}
                                        value={values.title}
                                        onChange={(event) => set("title", event.target.value)}
                                        placeholder={t("training.planForm.titlePlaceholder")}
                                        maxLength={120}
                                    />
                                </Field>
                                <ChoiceGroup
                                    id="plan-phase"
                                    name="phase"
                                    legend={
                                        <span className="inline-flex items-center gap-1.5">
                                            {t("training.planForm.phase")} <TermHint term="trainingPhase" locale={locale} />
                                        </span>
                                    }
                                    required
                                    variant="compact"
                                    columns={3}
                                    options={phaseOptions}
                                    value={values.phase}
                                    onChange={(next) => set("phase", next)}
                                    hint={GLOSSARY[PHASE_TERM[values.phase]].definition}
                                    error={error("phase")}
                                />

                                <div className="flex flex-col gap-3">
                                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                        <Field label={t("training.planForm.startDate")} htmlFor="plan-startDate" required error={error("startDate")}>
                                            <Input {...form.control("startDate", { required: true })} type="date" value={values.startDate} onChange={(event) => changeStart(event.target.value)} />
                                        </Field>
                                        <Field label={t("training.planForm.endDate")} htmlFor="plan-endDate" required error={error("endDate")} hint={span ?? undefined}>
                                            <Input
                                                {...form.control("endDate", { required: true, hint: span ?? undefined })}
                                                type="date"
                                                value={values.endDate}
                                                min={values.startDate || undefined}
                                                onChange={(event) => set("endDate", event.target.value)}
                                            />
                                        </Field>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="text-[13px] text-fg-muted" aria-hidden>
                                            {t("training.plan.length")}
                                        </span>
                                        <SegmentedControl
                                            label={t("screens.training.planCreate.planLength")}
                                            size="md"
                                            value={lengthValue}
                                            onChange={(weeks) => {
                                                if (!weeks || !isDateKey(values.startDate)) return;
                                                set("endDate", planEndKey(values.startDate, Number(weeks)));
                                                markEdited("endDate");
                                            }}
                                            options={PLAN_LENGTH_WEEKS.map((weeks) => ({ value: String(weeks), label: t("screens.training.planCreate.weeksShort", { n: weeks }), ariaLabel: plural(t, "training.plan.weeksCount", weeks) }))}
                                        />
                                    </div>
                                </div>

                                {!serviceForm && (
                                    <>
                                        <div className="flex flex-col gap-2">
                                            <TechniqueCheckboxes
                                                id="plan-focusAreas"
                                                name="focusAreas"
                                                legend={t("training.plan.focusAreas")}
                                                required
                                                value={values.focusAreas}
                                                onChange={(next) => set("focusAreas", next)}
                                                restricted={restrictedTechniques}
                                                error={error("focusAreas")}
                                                hint={restrictedTechniques.length > 0 ? t("training.planForm.hintFocusRestricted") : t("training.planForm.hintFocusNormal")}
                                            />
                                            {restrictedFocus.length > 0 && (
                                                <Callout tone="warning" icon={ShieldAlert} title={t("training.planForm.restrictedFocusTitle")}>
                                                    {t("training.planForm.restrictedFocusDesc", { techniques: restrictedFocus.map((technique) => techniqueLabel(t, technique)).join(", ") })}
                                                </Callout>
                                            )}
                                        </div>
                                        <Field
                                            label={t("training.planForm.weeklySessionTarget")}
                                            htmlFor="plan-weeklySessionTarget"
                                            required
                                            error={error("weeklySessionTarget")}
                                            hint={t("training.planForm.hintWeekly")}
                                            className="sm:max-w-56"
                                        >
                                            <Input
                                                {...form.control("weeklySessionTarget", { required: true, hint: true })}
                                                type="number"
                                                inputMode="numeric"
                                                min={1}
                                                max={14}
                                                step={1}
                                                value={values.weeklySessionTarget}
                                                onChange={(event) => set("weeklySessionTarget", event.target.value)}
                                            />
                                        </Field>
                                    </>
                                )}

                                <div className="flex flex-col gap-2">
                                    <Field
                                        label={t("training.planForm.objective")}
                                        htmlFor="plan-objective"
                                        optional
                                        info={<TermHint term="planObjective" locale={locale} />}
                                        error={error("objective")}
                                        hint={t("screens.training.planCreate.objectiveHint")}
                                    >
                                        <Textarea
                                            {...form.control("objective", { hint: true })}
                                            value={values.objective}
                                            onChange={(event) => set("objective", event.target.value)}
                                            rows={2}
                                            maxLength={600}
                                        />
                                    </Field>
                                    <SuggestionChips
                                        label={t("screens.training.planCreate.ideas")}
                                        suggestions={PHASE_OBJECTIVE_SUGGESTIONS[values.phase].map((suggestion) => ({ label: suggestion }))}
                                        onPick={(value) => set("objective", appendSuggestion(values.objective, value))}
                                    />
                                </div>
                                <Field label={t("training.plan.coachNotes")} htmlFor="plan-notes" optional error={error("notes")} hint={t("screens.training.planCreate.notesHint")}>
                                    <Textarea {...form.control("notes", { hint: true })} value={values.notes} onChange={(event) => set("notes", event.target.value)} rows={3} maxLength={1000} />
                                </Field>
                            </div>
                        </FormStep>

                        <FormStep id="exercises" title={t("screens.training.planCreate.step.exercises")} description={t("screens.training.planCreate.exercisesDesc")}>
                            <PlanExerciseRows
                                idPrefix="plan-exercises"
                                rows={rows}
                                onChange={changeRows}
                                library={library}
                                error={error}
                                markEdited={markEdited}
                                emptyText={t("screens.training.planCreate.exercisesEmpty")}
                            />
                        </FormStep>

                        <FormStep id="review" title={t("screens.training.planCreate.step.review")} description={t("screens.training.planCreate.reviewDesc")}>
                            <ReviewStep
                                fighterName={fighter?.name}
                                values={values}
                                sourceLabel={sourceLabel}
                                sentCount={sent.length}
                                leftOut={rows.length - sent.length - skipped}
                                skipped={skipped}
                            />
                            <ChoiceGroup
                                id="plan-status"
                                name="status"
                                legend={
                                    <span className="inline-flex items-center gap-1.5">
                                        {t("training.planForm.sectionVisibility")} <TermHint term="planDraft" locale={locale} />
                                    </span>
                                }
                                required
                                columns={2}
                                options={statusOptions(t)}
                                value={values.status}
                                onChange={(next) => set("status", next)}
                                error={error("status")}
                                className="mt-6"
                            />
                        </FormStep>
                    </FormSteps>
                </CardContent>
            </Card>

            <aside aria-label={t("training.planForm.asideAria")} className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-20">
                {clearance ? (
                    <ClearanceCard clearance={clearance.clearance} state={clearance.state} doctorName={clearance.doctorName} now={now} variant="summary" />
                ) : (
                    <Card>
                        <CardContent className="pt-5">
                            <EmptyState compact icon={<ShieldCheck />} title={t("training.planForm.emptyClearanceTitle")} description={t("training.planForm.emptyClearanceDesc")} />
                        </CardContent>
                    </Card>
                )}
                <p className="px-1 text-[13px] text-pretty text-fg-muted">
                    {t("training.planForm.asideDesc")}
                </p>
            </aside>

            <ConfirmDialog
                open={pending !== null}
                onClose={() => setPending(null)}
                onConfirm={() => {
                    pending?.apply();
                    setPending(null);
                }}
                tone="primary"
                title={t("screens.training.planCreate.replaceTitle")}
                description={t("screens.training.planCreate.replaceDesc", { source: pending?.label ?? t("screens.training.planCreate.replaceThis") })}
                confirmLabel={t("screens.training.planCreate.replace")}
            />
        </form>
    );
}

function SourceCard({
    icon: Icon,
    label,
    summary,
    meta,
    selected,
    disabled,
    onSelect,
}: {
    icon: typeof LayoutTemplate;
    label: string;
    summary: string;
    meta?: string;
    selected: boolean;
    disabled?: boolean;
    onSelect(): void;
}) {
    return (
        <button
            type="button"
            onClick={onSelect}
            aria-pressed={selected}
            disabled={disabled}
            className={cn(
                "flex min-w-0 items-start gap-3 rounded-lg border bg-surface p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60",
                selected ? "border-transparent ring-2 ring-primary" : "border-border hover:border-border-strong hover:bg-surface-muted/50",
            )}
        >
            <Icon aria-hidden className={cn("mt-0.5 size-4 shrink-0", selected ? "text-primary-soft-fg" : "text-fg-muted")} />
            <span className="min-w-0">
                <span className="block text-sm font-semibold text-fg">{label}</span>
                <span className="mt-0.5 block text-[13px] text-fg-muted">{summary}</span>
                {meta && <span className="mt-1 block text-xs text-fg-subtle">{meta}</span>}
            </span>
        </button>
    );
}

/** The plan at a glance, with a way back to each step. */
function ReviewStep({
    fighterName,
    values,
    sourceLabel,
    sentCount,
    leftOut,
    skipped,
}: {
    fighterName: string | undefined;
    values: PlanCreateValues;
    sourceLabel: string;
    sentCount: number;
    leftOut: number;
    skipped: number;
}) {
    const { goTo } = useFormSteps();
    const t = useT();
    const locale = useLocale();
    const span = spanText(values.startDate, values.endDate, t);
    const notSet = t("screens.training.planCreate.review.notSet");
    const dates =
        isDateKey(values.startDate) && isDateKey(values.endDate)
            ? `${formatDate(academyDayStartIso(values.startDate), locale)} – ${formatDate(academyDayStartIso(values.endDate), locale)}${span ? ` · ${span}` : ""}`
            : notSet;
    const exerciseText = [
        sentCount > 0 ? plural(t, "screens.training.exercisesCount", sentCount) : t("screens.training.planCreate.review.noExercises"),
        leftOut > 0 ? t("screens.training.planCreate.review.leftOut", { n: leftOut }) : null,
        skipped > 0 ? t("screens.training.planCreate.review.skipped", { n: skipped }) : null,
    ]
        .filter(Boolean)
        .join(" · ");

    const rows: { label: string; value: ReactNode; step: string }[] = [
        { label: t("screens.training.planCreate.review.startingPoint"), value: sourceLabel, step: "start" },
        { label: t("training.planForm.fighter"), value: fighterName ?? t("screens.training.planCreate.review.notChosen"), step: "basics" },
        { label: t("screens.training.planCreate.review.title"), value: values.title.trim() || notSet, step: "basics" },
        { label: t("training.planForm.phase"), value: trainingPhaseLabel(t, values.phase), step: "basics" },
        { label: t("screens.training.planCreate.review.dates"), value: dates, step: "basics" },
        { label: t("training.planForm.objective"), value: values.objective.trim() || t("screens.training.planCreate.review.none"), step: "basics" },
        { label: t("screens.training.planCreate.step.exercises"), value: exerciseText, step: "exercises" },
    ];

    return (
        <dl className="flex flex-col divide-y divide-border rounded-lg border border-border">
            {rows.map((row, index) => (
                <div key={row.label} className="flex min-h-11 items-start gap-3 px-4 py-2.5">
                    <dt className="w-28 shrink-0 text-[13px] text-fg-muted">{row.label}</dt>
                    <dd className="min-w-0 flex-1 text-sm break-words text-fg">{row.value}</dd>
                    {/* One way back per step, on its first row. */}
                    {(index === 0 || rows[index - 1].step !== row.step) && (
                        <Button variant="ghost" size="sm" className="-my-1 shrink-0" onClick={() => goTo(row.step)} aria-label={t("screens.training.planCreate.review.editStep", { step: t(STEP_NAMES[row.step]) })}>
                            <PenLine aria-hidden />
                            <span className="max-sm:sr-only">{t("training.planDetails.edit")}</span>
                        </Button>
                    )}
                </div>
            ))}
        </dl>
    );
}
