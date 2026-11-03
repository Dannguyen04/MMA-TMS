"use client";

import { useLocale, useT } from "@/components/i18n/locale-provider";
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
import { techniqueLabel, trainingPhaseLabel } from "@/lib/domain/labels";
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

const PHASES: TrainingPhase[] = ["base", "build", "fight_camp", "taper", "rehab", "maintenance"];
const HINTED_FIELDS = new Set<keyof PlanFormValues>(["objective", "weeklySessionTarget"]);

/**
 * Edit a training plan, with the fighter's Medical Clearance alongside. New plans use `PlanCreateForm`, which adds
 * templates, copying and exercises.
 */
export function PlanForm({ action, fighters, clearances, defaults, now, cancelHref, serviceForm }: PlanFormProps) {
    const t = useT();
    const locale = useLocale();
    const PHASE_OPTIONS = PHASES.map((value) => ({ value, label: trainingPhaseLabel(t, value) }));
    const form = useActionForm(action, { id: "plan" });
    const [values, setValues] = useState(defaults);
    const error = (name: string) => form.error(name) || undefined;
    const set = <K extends keyof PlanFormValues>(key: K, value: PlanFormValues[K]) => setValues((current) => ({ ...current, [key]: value }));
    const fighter = fighters.find((f) => f.id === values.fighterId);
    const clearance = values.fighterId ? clearances[values.fighterId] : undefined;
    const restrictedTechniques =
        clearance?.state === "restricted" && clearance.clearance ? clearance.clearance.restrictions.flatMap((r) => r.blockedTechniques) : [];
    const restrictedFocus = values.focusAreas.filter((item) => restrictedTechniques.includes(item));

    const input = (name: keyof PlanFormValues) => form.control(name, { hint: HINTED_FIELDS.has(name) || undefined, required: name !== "notes" && name !== "objective" });

    return (
        <form {...form.formProps} className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
            <Card className="min-w-0 lg:col-span-2">
                <CardContent className="pt-6">
                    <FormSection title={t("training.planForm.sectionObjective")} description={t("training.planForm.sectionObjectiveDesc")}>
                        {fighter && (
                            <div className="flex flex-col gap-1.5">
                                <p className="text-sm font-medium text-fg">{t("training.planForm.fighter")}</p>
                                <FighterIdentity fighter={fighter} showHealth locale={locale} />
                            </div>
                        )}
                        <Field label={t("training.planForm.title")} htmlFor="plan-title" required error={error("title")}>
                            <Input
                                {...input("title")}
                                value={values.title}
                                onChange={(event) => set("title", event.target.value)}
                                placeholder={t("training.planForm.titlePlaceholder")}
                                maxLength={120}
                            />
                        </Field>
                        <Field label={t("training.planForm.objective")} htmlFor="plan-objective" optional info={<TermHint term="planObjective" locale={locale} />} error={error("objective")} hint={t("training.planForm.hintObjective")}>
                            <Textarea {...input("objective")} value={values.objective} onChange={(event) => set("objective", event.target.value)} rows={3} maxLength={600} />
                        </Field>
                    </FormSection>

                    <FormSection
                        title={t("training.planForm.sectionFocus")}
                        description={serviceForm ? t("training.planForm.sectionFocusDescService") : t("training.planForm.sectionFocusDescDemo")}
                    >
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
                                    legend={t("training.planCard.focusAreas")}
                                    required
                                    value={values.focusAreas}
                                    onChange={(next) => set("focusAreas", next)}
                                    restricted={restrictedTechniques}
                                    error={error("focusAreas")}
                                    hint={restrictedTechniques.length > 0 ? t("training.planForm.hintFocusRestricted") : t("training.planForm.hintFocusNormal")}
                                />
                                {restrictedFocus.length > 0 && (
                                    <Callout tone="warning" icon={ShieldAlert} title={t("training.planForm.restrictedFocusTitle")}>
                                        {t("training.planForm.restrictedFocusDesc", { techniques: restrictedFocus.map((tech) => techniqueLabel(t, tech)).join(", ") })}
                                    </Callout>
                                )}
                            </div>
                        )}
                    </FormSection>

                    <FormSection title={t("training.planForm.sectionSchedule")} description={serviceForm ? t("training.planForm.sectionScheduleDescService") : t("training.planForm.sectionScheduleDescDemo")}>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <Field label={t("training.planForm.startDate")} htmlFor="plan-startDate" required error={error("startDate")}>
                                <Input {...input("startDate")} type="date" value={values.startDate} onChange={(event) => set("startDate", event.target.value)} />
                            </Field>
                            <Field label={t("training.planForm.endDate")} htmlFor="plan-endDate" required error={error("endDate")}>
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
                                label={t("training.planForm.weeklySessionTarget")}
                                htmlFor="plan-weeklySessionTarget"
                                required
                                error={error("weeklySessionTarget")}
                                hint={t("training.planForm.hintWeekly")}
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


                    <FormSection title={t("training.planForm.sectionNotes")} description={t("training.planForm.sectionNotesDesc")}>
                        <Field label={t("training.planForm.notes")} htmlFor="plan-notes" optional error={error("notes")}>
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
                            {t("common.cancel")}
                        </ButtonLink>
                        <SubmitButton pending={form.pending} pendingLabel={t("training.planForm.submittingEdit")}>
                            {t("training.planForm.submitEdit")}
                        </SubmitButton>
                    </div>
                </CardFooter>
            </Card>

            <aside aria-label={t("training.planForm.asideAria")} className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-20">
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
                                title={t("training.planForm.emptyClearanceTitle")}
                                description={t("training.planForm.emptyClearanceDesc")}
                            />
                        </CardContent>
                    </Card>
                )}
                <p className="px-1 text-[13px] text-pretty text-fg-muted">
                    {t("training.planForm.asideDesc")}
                </p>
            </aside>
        </form>
    );
}
