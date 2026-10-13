"use client";

import { ShieldAlert, ShieldCheck } from "lucide-react";
import { useState } from "react";

import { ClearanceCard } from "@/components/domain/clearance-card";
import { TermHint } from "@/components/domain/term-hint";
import { FighterIdentity, type FighterIdentityData } from "@/components/domain/fighter-identity";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { ChoiceGroup } from "@/components/ui/choice-group";
import { Field, FormMessage, FormSection, Input, Textarea } from "@/components/ui/form";
import { EmptyState } from "@/components/ui/states";
import { SubmitButton } from "@/components/ui/submit-button";
import { useActionForm } from "@/components/ui/use-action-form";
import type { ActionState } from "@/lib/actions/state";
import { TECHNIQUE_LABELS, TRAINING_PHASE_LABELS } from "@/lib/domain/labels";
import type { Technique, TrainingPhase } from "@/lib/domain/types";
import { Callout } from "./callout";
import { TechniqueCheckboxes } from "./technique-checkboxes";
import type { ClearanceSummary } from "./training-utils";

export interface PlanFormValues {
    fighterId: string;
    title: string;
    objective: string;
    phase: TrainingPhase;
    focusAreas: Technique[];
    startDate: string;
    endDate: string;
    weeklySessionTarget: string;
    notes: string;
}

export interface PlanFormFighter extends FighterIdentityData {
    id: string;
}

export interface PlanFormProps {
    action: (state: ActionState, formData: FormData) => Promise<ActionState>;
    /** The plan's fighter. */
    fighters: PlanFormFighter[];
    clearances: Record<string, ClearanceSummary>;
    defaults: PlanFormValues;
    /** Server time (ISO). */
    now: string;
    cancelHref: string;
    /** Only what the training service stores: no focus areas or weekly target (`usesTrainingServiceForms`). */
    serviceForm: boolean;
}

const PHASE_OPTIONS = (Object.entries(TRAINING_PHASE_LABELS) as [TrainingPhase, string][]).map(([value, label]) => ({ value, label }));

const HINTS = {
    objective: "One or two sentences the fighter will see at the top of the plan.",
    weeklySessionTarget: "Between 1 and 14 sessions a week.",
};

/**
 * Edit a training plan, with the fighter's Medical Clearance alongside. New plans use `PlanCreateForm`, which adds
 * templates, copying and exercises.
 */
export function PlanForm({ action, fighters, clearances, defaults, now, cancelHref, serviceForm }: PlanFormProps) {
    const form = useActionForm(action, { id: "plan" });
    const [values, setValues] = useState(defaults);
    const { error } = form;
    const set = <K extends keyof PlanFormValues>(key: K, value: PlanFormValues[K]) => setValues((current) => ({ ...current, [key]: value }));
    const fighter = fighters.find((f) => f.id === values.fighterId);
    const clearance = values.fighterId ? clearances[values.fighterId] : undefined;
    const restrictedTechniques =
        clearance?.state === "restricted" && clearance.clearance ? clearance.clearance.restrictions.flatMap((r) => r.blockedTechniques) : [];
    const restrictedFocus = values.focusAreas.filter((t) => restrictedTechniques.includes(t));

    const input = (name: keyof PlanFormValues) => form.control(name, { hint: name in HINTS || undefined, required: name !== "notes" && name !== "objective" });

    return (
        <form {...form.formProps} className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
            <Card className="min-w-0 lg:col-span-2">
                <CardContent className="pt-6">
                    <FormSection title="Fighter & objective" description="Who the plan is for and what it should achieve.">
                        {fighter && (
                            <div className="flex flex-col gap-1.5">
                                <p className="text-sm font-medium text-fg">Fighter</p>
                                <FighterIdentity fighter={fighter} showHealth />
                            </div>
                        )}
                        <Field label="Plan title" htmlFor="plan-title" required error={error("title")}>
                            <Input
                                {...input("title")}
                                value={values.title}
                                onChange={(event) => set("title", event.target.value)}
                                placeholder="e.g. Fight camp — Lotus Fight Night 18"
                                maxLength={120}
                            />
                        </Field>
                        <Field label="Objective" htmlFor="plan-objective" optional info={<TermHint term="planObjective" />} error={error("objective")} hint={HINTS.objective}>
                            <Textarea {...input("objective")} value={values.objective} onChange={(event) => set("objective", event.target.value)} rows={3} maxLength={600} />
                        </Field>
                    </FormSection>

                    <FormSection
                        title="Focus"
                        description={serviceForm ? "The training phase this block belongs to." : "The training phase and the techniques this block develops."}
                    >
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
                            error={error("phase")}
                        />
                        {!serviceForm && (
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
                                        {restrictedFocus.map((t) => TECHNIQUE_LABELS[t]).join(", ")} can&apos;t be trained under the current clearance. Sessions that
                                        include them will show a warning when you schedule them.
                                    </Callout>
                                )}
                            </div>
                        )}
                    </FormSection>

                    <FormSection title="Schedule" description={serviceForm ? "When the plan starts and ends." : "Plan window and how often the fighter should train."}>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <Field label="Start date" htmlFor="plan-startDate" required error={error("startDate")}>
                                <Input {...input("startDate")} type="date" value={values.startDate} onChange={(event) => set("startDate", event.target.value)} />
                            </Field>
                            <Field label="End date" htmlFor="plan-endDate" required error={error("endDate")}>
                                <Input
                                    {...input("endDate")}
                                    type="date"
                                    value={values.endDate}
                                    min={values.startDate || undefined}
                                    onChange={(event) => set("endDate", event.target.value)}
                                />
                            </Field>
                        </div>
                        {!serviceForm && (
                            <Field
                                label="Weekly session target"
                                htmlFor="plan-weeklySessionTarget"
                                required
                                error={error("weeklySessionTarget")}
                                hint={HINTS.weeklySessionTarget}
                                className="sm:max-w-56"
                            >
                                <Input
                                    {...input("weeklySessionTarget")}
                                    type="number"
                                    inputMode="numeric"
                                    min={1}
                                    max={14}
                                    step={1}
                                    value={values.weeklySessionTarget}
                                    onChange={(event) => set("weeklySessionTarget", event.target.value)}
                                />
                            </Field>
                        )}
                    </FormSection>


                    <FormSection title="Coach notes" description="Context for the fighter and other coaches, e.g. sparring caps or nutrition.">
                        <Field label="Notes" htmlFor="plan-notes" optional error={error("notes")}>
                            <Textarea
                                {...input("notes")}
                                value={values.notes}
                                onChange={(event) => set("notes", event.target.value)}
                                rows={4}
                                maxLength={1000}
                            />
                        </Field>
                    </FormSection>
                </CardContent>
                <CardFooter className="flex-col-reverse items-stretch sm:flex-row sm:items-center">
                    <div className="min-w-0 flex-1">
                        <FormMessage {...form.message} />
                    </div>
                    <div className="flex flex-col-reverse gap-2 sm:flex-row">
                        <ButtonLink href={cancelHref} variant="secondary">
                            Cancel
                        </ButtonLink>
                        <SubmitButton pending={form.pending} pendingLabel="Saving…">
                            Save changes
                        </SubmitButton>
                    </div>
                </CardFooter>
            </Card>

            <aside aria-label="Medical Clearance for this fighter" className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-20">
                {clearance ? (
                    <ClearanceCard
                        clearance={clearance.clearance}
                        state={clearance.state}
                        doctorName={clearance.doctorName}
                        now={now}
                        variant="summary"
                    />
                ) : (
                    <Card>
                        <CardContent className="pt-5">
                            <EmptyState
                                compact
                                icon={<ShieldCheck />}
                                title="Medical Clearance"
                                description="Choose a fighter to see their clearance and restrictions before you plan."
                            />
                        </CardContent>
                    </Card>
                )}
                <p className="px-1 text-[13px] text-pretty text-fg-muted">
                    Plans don&apos;t change a clearance. Every session you schedule is checked against the fighter&apos;s Medical Clearance, and only
                    the sports doctor can update it.
                </p>
            </aside>
        </form>
    );
}
