"use client";

import { Copy, FilePlus2, LayoutTemplate, PenLine, ShieldAlert, ShieldCheck } from "lucide-react";
import { useState, useTransition, type ReactNode } from "react";

import { ClearanceCard } from "@/components/domain/clearance-card";
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
import { PLAN_STATUS_LABELS, TECHNIQUE_LABELS, TRAINING_PHASE_LABELS } from "@/lib/domain/labels";
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
import { addDaysToKey, formatDate, academyDayStartIso, isDateKey, pluralize } from "@/lib/format";
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

const STEPS = [
    { id: "start", label: "Start from", description: "Template, blank or a copy" },
    { id: "basics", label: "Basics", description: "Fighter, phase and dates" },
    { id: "exercises", label: "Exercises", description: "Drills and their doses", optional: true },
    { id: "review", label: "Review & create", description: "Check, then save" },
];

const STEP_NAMES: Record<string, string> = { start: "starting point", basics: "basics", exercises: "exercises" };

const PHASE_OPTIONS = (Object.entries(TRAINING_PHASE_LABELS) as [TrainingPhase, string][]).map(([value, label]) => ({ value, label }));

const PHASE_TERM: Record<TrainingPhase, GlossaryTerm> = {
    base: "phaseBase",
    build: "phaseBuild",
    fight_camp: "phaseFightCamp",
    taper: "phaseTaper",
    rehab: "phaseRehab",
    maintenance: "phaseMaintenance",
};

const STATUS_OPTIONS: { value: PlanCreateValues["status"]; label: string; description: string }[] = [
    { value: "draft", label: "Save as draft", description: "Keep refining. The fighter doesn't see it yet." },
    { value: "active", label: "Create and activate", description: "The fighter sees the plan and is notified once its exercises are in." },
];

/** Fields a starting point fills in; editing any of them makes switching ask first. */
type ContentField = "title" | "phase" | "endDate" | "objective" | "notes";
const CONTENT_FIELDS: ContentField[] = ["title", "phase", "endDate", "objective", "notes"];

/** "4 weeks · Build · 7 exercises" */
function templateMeta(template: PlanTemplate): string {
    return [pluralize(template.weeks, "week"), TRAINING_PHASE_LABELS[template.phase], pluralize(template.exercises.length, "exercise")].join(" · ");
}

function spanText(startDate: string, endDate: string): string | null {
    const days = planSpanDays(startDate, endDate);
    if (days === null) return null;
    const weeks = planWholeWeeks(startDate, endDate);
    return weeks !== null ? pluralize(weeks, "week") : pluralize(days, "day");
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
    const form = useActionForm(action, { id: "plan", hiddenFields: ["exercises"] });
    const { error, markEdited } = form;
    const [values, setValues] = useState(defaults);
    const [rows, setRows] = useState<PlanExerciseDraft[]>(() => {
        if (initialSource.kind === "template") {
            const template = PLAN_TEMPLATES.find((candidate) => candidate.id === initialSource.id);
            return template ? draftsFromTemplate(template, library) : [];
        }
        return initialCopy ? draftsFromPlanExercises(initialCopy.exercises, library, `copy-${initialCopy.planId}`) : [];
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
            draftsFromTemplate(template, library),
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
            draftsFromPlanExercises(copy.exercises, library, `copy-${copy.planId}`),
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
                setCopyError(result.message ?? "That plan couldn't be copied. Try again.");
                return;
            }
            const plan = copyablePlans.find((candidate) => candidate.id === planId);
            request(plan ? `a copy of ${plan.title}` : "a copy of that plan", () => applyCopy(copy));
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
        if (stepId === "start" && source.kind === "copy" && !copied) return "Choose the plan to copy, or pick another starting point.";
        if (stepId === "basics" && isDateKey(values.startDate) && isDateKey(values.endDate) && values.endDate < values.startDate) {
            return "The end date must be on or after the start date.";
        }
        if (stepId === "basics" && !serviceForm && values.focusAreas.length === 0) return "Choose at least one focus area to continue.";
        return null;
    };

    const sent = sentDrafts(rows);
    const skipped = rows.filter((row) => row.exerciseId === null).length;
    const sourceLabel =
        source.kind === "blank"
            ? "Blank plan"
            : source.kind === "template"
              ? `${PLAN_TEMPLATES.find((template) => template.id === source.id)?.label ?? "Template"} template`
              : `Copy of ${copyablePlans.find((plan) => plan.id === copied)?.title ?? "a plan"}`;

    return (
        <form {...form.formProps} className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
            <input type="hidden" name="exercises" value={serializePlanExerciseDrafts(rows)} />

            <Card className="min-w-0 lg:col-span-2">
                <CardContent className="pt-6">
                    <FormSteps
                        steps={STEPS}
                        state={form.state}
                        validateStep={validateStep}
                        message={<FormMessage {...form.message} />}
                        cancel={
                            <ButtonLink href={cancelHref} variant="ghost" size="lg" className="w-full sm:h-9 sm:w-auto sm:px-3.5 sm:text-sm">
                                Cancel
                            </ButtonLink>
                        }
                        submit={
                            <SubmitButton pending={form.pending} pendingLabel="Creating plan…" size="lg" className="sm:h-9 sm:px-3.5 sm:text-sm">
                                {values.status === "active" ? "Create and activate" : "Create plan"}
                            </SubmitButton>
                        }
                    >
                        <FormStep
                            id="start"
                            title="Where do you want to start?"
                            description={
                                <>
                                    A <Term term="template">template</Term> fills in the phase, dates, objective and exercises. You can change everything before you save.
                                </>
                            }
                        >
                            <div role="group" aria-label="Starting points" className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                                <SourceCard
                                    icon={FilePlus2}
                                    label="Blank plan"
                                    summary="Start from nothing"
                                    selected={source.kind === "blank"}
                                    onSelect={() => source.kind !== "blank" && request("a blank plan", applyBlank)}
                                />
                                {PLAN_TEMPLATES.map((template) => (
                                    <SourceCard
                                        key={template.id}
                                        icon={LayoutTemplate}
                                        label={template.label}
                                        summary={template.summary}
                                        meta={templateMeta(template)}
                                        selected={source.kind === "template" && source.id === template.id}
                                        onSelect={() => request(`the ${template.label.toLowerCase()} template`, () => applyTemplate(template))}
                                    />
                                ))}
                                <SourceCard
                                    icon={Copy}
                                    label="Copy an existing plan"
                                    summary={copyablePlans.length > 0 ? "Reuse a plan you've run before" : "No plans on your roster yet"}
                                    selected={source.kind === "copy"}
                                    disabled={copyablePlans.length === 0}
                                    onSelect={() => setSource({ kind: "copy", planId: copied })}
                                />
                            </div>

                            {source.kind === "copy" && (
                                <div className="mt-5 flex flex-col gap-2">
                                    <Field
                                        label="Plan to copy"
                                        htmlFor="plan-copyFrom"
                                        hint="Its title, phase, length, objective, notes and exercises are copied. It starts on the start date you choose."
                                        error={copyError ?? undefined}
                                    >
                                        <Select id="plan-copyFrom" value={copyPlanId} onChange={(event) => chooseCopyPlan(event.target.value)} disabled={copying} aria-busy={copying || undefined}>
                                            <option value="">Choose a plan…</option>
                                            {copyablePlans.map((plan) => (
                                                <option key={plan.id} value={plan.id}>
                                                    {plan.title} — {plan.fighterName} · {TRAINING_PHASE_LABELS[plan.phase]}
                                                    {plan.weeks ? ` · ${pluralize(plan.weeks, "week")}` : ""}
                                                    {plan.status !== "active" ? ` (${PLAN_STATUS_LABELS[plan.status]})` : ""}
                                                </option>
                                            ))}
                                        </Select>
                                    </Field>
                                    <p className="text-[13px] text-fg-muted" aria-live="polite">
                                        {copying ? "Copying the plan…" : copied && copied === copyPlanId ? "Copied. Check the basics and exercises in the next steps." : null}
                                    </p>
                                </div>
                            )}
                        </FormStep>

                        <FormStep id="basics" title="Basics" description="Who the plan is for, its phase and how long it runs.">
                            <div className="flex flex-col gap-5">
                                <Field label="Fighter" htmlFor="plan-fighterId" required error={error("fighterId")} hint="Only fighters on your roster are listed.">
                                    <Select
                                        {...form.control("fighterId", { required: true, hint: true })}
                                        value={values.fighterId}
                                        onChange={(event) => set("fighterId", event.target.value)}
                                    >
                                        <option value="">Choose a fighter…</option>
                                        {fighters.map((option) => (
                                            <option key={option.id} value={option.id}>
                                                {option.name}
                                            </option>
                                        ))}
                                    </Select>
                                </Field>
                                <Field label="Plan title" htmlFor="plan-title" required error={error("title")}>
                                    <Input
                                        {...form.control("title", { required: true })}
                                        value={values.title}
                                        onChange={(event) => set("title", event.target.value)}
                                        placeholder="e.g. Fight camp — Lotus Fight Night 18"
                                        maxLength={120}
                                    />
                                </Field>
                                <ChoiceGroup
                                    id="plan-phase"
                                    name="phase"
                                    legend={
                                        <span className="inline-flex items-center gap-1.5">
                                            Phase <TermHint term="trainingPhase" />
                                        </span>
                                    }
                                    required
                                    variant="compact"
                                    columns={3}
                                    options={PHASE_OPTIONS}
                                    value={values.phase}
                                    onChange={(next) => set("phase", next)}
                                    hint={GLOSSARY[PHASE_TERM[values.phase]].definition}
                                    error={error("phase")}
                                />

                                <div className="flex flex-col gap-3">
                                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                        <Field label="Start date" htmlFor="plan-startDate" required error={error("startDate")}>
                                            <Input {...form.control("startDate", { required: true })} type="date" value={values.startDate} onChange={(event) => changeStart(event.target.value)} />
                                        </Field>
                                        <Field label="End date" htmlFor="plan-endDate" required error={error("endDate")} hint={spanText(values.startDate, values.endDate) ?? undefined}>
                                            <Input
                                                {...form.control("endDate", { required: true, hint: spanText(values.startDate, values.endDate) ?? undefined })}
                                                type="date"
                                                value={values.endDate}
                                                min={values.startDate || undefined}
                                                onChange={(event) => set("endDate", event.target.value)}
                                            />
                                        </Field>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="text-[13px] text-fg-muted" aria-hidden>
                                            Length
                                        </span>
                                        <SegmentedControl
                                            label="Plan length"
                                            size="md"
                                            value={lengthValue}
                                            onChange={(weeks) => {
                                                if (!weeks || !isDateKey(values.startDate)) return;
                                                set("endDate", planEndKey(values.startDate, Number(weeks)));
                                                markEdited("endDate");
                                            }}
                                            options={PLAN_LENGTH_WEEKS.map((weeks) => ({ value: String(weeks), label: `${weeks} wk`, ariaLabel: `${weeks} weeks` }))}
                                        />
                                    </div>
                                </div>

                                {!serviceForm && (
                                    <>
                                        <div className="flex flex-col gap-2">
                                            <TechniqueCheckboxes
                                                id="plan-focusAreas"
                                                name="focusAreas"
                                                legend="Focus areas"
                                                required
                                                value={values.focusAreas}
                                                onChange={(next) => set("focusAreas", next)}
                                                restricted={restrictedTechniques}
                                                error={error("focusAreas")}
                                                hint={restrictedTechniques.length > 0 ? "Marked techniques are restricted by the current Medical Clearance." : "Choose one or more."}
                                            />
                                            {restrictedFocus.length > 0 && (
                                                <Callout tone="warning" icon={ShieldAlert} title="Some focus areas are restricted right now">
                                                    {restrictedFocus.map((technique) => TECHNIQUE_LABELS[technique]).join(", ")} can&apos;t be trained under the current
                                                    clearance. Sessions that include them will show a warning when you schedule them.
                                                </Callout>
                                            )}
                                        </div>
                                        <Field
                                            label="Weekly session target"
                                            htmlFor="plan-weeklySessionTarget"
                                            required
                                            error={error("weeklySessionTarget")}
                                            hint="Between 1 and 14 sessions a week."
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
                                        label="Objective"
                                        htmlFor="plan-objective"
                                        optional
                                        info={<TermHint term="planObjective" />}
                                        error={error("objective")}
                                        hint="One sentence the fighter sees at the top of the plan."
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
                                        label="Ideas"
                                        suggestions={PHASE_OBJECTIVE_SUGGESTIONS[values.phase].map((suggestion) => ({ label: suggestion }))}
                                        onPick={(value) => set("objective", appendSuggestion(values.objective, value))}
                                    />
                                </div>
                                <Field label="Coach notes" htmlFor="plan-notes" optional error={error("notes")} hint="Context for the fighter and other coaches, e.g. sparring caps or weight.">
                                    <Textarea {...form.control("notes", { hint: true })} value={values.notes} onChange={(event) => set("notes", event.target.value)} rows={3} maxLength={1000} />
                                </Field>
                            </div>
                        </FormStep>

                        <FormStep id="exercises" title="Exercises" description="Drills prescribed across the plan, in this order. Untick any you don't want.">
                            <PlanExerciseRows
                                idPrefix="plan-exercises"
                                rows={rows}
                                onChange={changeRows}
                                library={library}
                                error={error}
                                markEdited={markEdited}
                                emptyText="No exercises yet. Add some from the library below, or skip this step and add them later."
                            />
                        </FormStep>

                        <FormStep id="review" title="Review & create" description="Check the plan, then choose whether the fighter sees it now.">
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
                                        Visibility <TermHint term="planDraft" />
                                    </span>
                                }
                                required
                                columns={2}
                                options={STATUS_OPTIONS}
                                value={values.status}
                                onChange={(next) => set("status", next)}
                                error={error("status")}
                                className="mt-6"
                            />
                        </FormStep>
                    </FormSteps>
                </CardContent>
            </Card>

            <aside aria-label="Medical Clearance for this fighter" className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-20">
                {clearance ? (
                    <ClearanceCard clearance={clearance.clearance} state={clearance.state} doctorName={clearance.doctorName} now={now} variant="summary" />
                ) : (
                    <Card>
                        <CardContent className="pt-5">
                            <EmptyState compact icon={<ShieldCheck />} title="Medical Clearance" description="Choose a fighter to see their clearance and restrictions before you plan." />
                        </CardContent>
                    </Card>
                )}
                <p className="px-1 text-[13px] text-pretty text-fg-muted">
                    Plans don&apos;t change a clearance. Every session you schedule is checked against the fighter&apos;s Medical Clearance, and only the
                    sports doctor can update it.
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
                title="Replace what you've entered?"
                description={`Starting from ${pending?.label ?? "this"} replaces the title, phase, end date, objective, notes and exercises you've changed. The fighter and start date stay.`}
                confirmLabel="Replace"
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
    const span = spanText(values.startDate, values.endDate);
    const dates =
        isDateKey(values.startDate) && isDateKey(values.endDate)
            ? `${formatDate(academyDayStartIso(values.startDate))} – ${formatDate(academyDayStartIso(values.endDate))}${span ? ` · ${span}` : ""}`
            : "Not set";
    const exerciseText = [
        sentCount > 0 ? pluralize(sentCount, "exercise") : "No exercises",
        leftOut > 0 ? `${leftOut} left out` : null,
        skipped > 0 ? `${skipped} not in the library, skipped` : null,
    ]
        .filter(Boolean)
        .join(" · ");

    const rows: { label: string; value: ReactNode; step: string }[] = [
        { label: "Starting point", value: sourceLabel, step: "start" },
        { label: "Fighter", value: fighterName ?? "Not chosen", step: "basics" },
        { label: "Title", value: values.title.trim() || "Not set", step: "basics" },
        { label: "Phase", value: TRAINING_PHASE_LABELS[values.phase], step: "basics" },
        { label: "Dates", value: dates, step: "basics" },
        { label: "Objective", value: values.objective.trim() || "None", step: "basics" },
        { label: "Exercises", value: exerciseText, step: "exercises" },
    ];

    return (
        <dl className="flex flex-col divide-y divide-border rounded-lg border border-border">
            {rows.map((row, index) => (
                <div key={row.label} className="flex min-h-11 items-start gap-3 px-4 py-2.5">
                    <dt className="w-28 shrink-0 text-[13px] text-fg-muted">{row.label}</dt>
                    <dd className="min-w-0 flex-1 text-sm break-words text-fg">{row.value}</dd>
                    {/* One way back per step, on its first row. */}
                    {(index === 0 || rows[index - 1].step !== row.step) && (
                        <Button variant="ghost" size="sm" className="-my-1 shrink-0" onClick={() => goTo(row.step)} aria-label={`Edit ${STEP_NAMES[row.step]}`}>
                            <PenLine aria-hidden />
                            <span className="max-sm:sr-only">Edit</span>
                        </Button>
                    )}
                </div>
            ))}
        </dl>
    );
}
