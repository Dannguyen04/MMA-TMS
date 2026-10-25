"use client";

import { useT } from "@/components/i18n/locale-provider";
import { ShieldAlert, ShieldCheck } from "lucide-react";
import { useState } from "react";

import { ClearanceCard } from "@/components/domain/clearance-card";
import { FighterIdentity, type FighterIdentityData } from "@/components/domain/fighter-identity";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { ChoiceGroup } from "@/components/ui/choice-group";
import { Field, FormMessage, FormSection, Input, Select, Textarea } from "@/components/ui/form";
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
    status: "draft" | "active";
    notes: string;
}

export interface PlanFormFighter extends FighterIdentityData {
    id: string;
}

export interface PlanFormProps {
    mode: "create" | "edit";
    action: (state: ActionState, formData: FormData) => Promise<ActionState>;
    /** Roster fighters (create) or the plan's fighter (edit). */
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

/** Create or edit a training plan, with the fighter's Medical Clearance alongside. */
export function PlanForm({ mode, action, fighters, clearances, defaults, now, cancelHref, serviceForm }: PlanFormProps) {
    const t = useT();

    const PHASE_OPTIONS = PHASES.map((value) => ({
        value,
        label: trainingPhaseLabel(t, value),
    }));

    const STATUS_OPTIONS: { value: PlanFormValues["status"]; label: string; description: string }[] = [
        { value: "draft", label: t("training.planForm.statusDraft"), description: t("training.planForm.statusDraftDesc") },
        { value: "active", label: t("training.planForm.statusActive"), description: t("training.planForm.statusActiveDesc") },
    ];

    const HINTS = {
        fighterId: t("training.planForm.hintFighter"),
        objective: t("training.planForm.hintObjective"),
        weeklySessionTarget: t("training.planForm.hintWeekly"),
    };

    const form = useActionForm(action, { id: "plan" });
    const [values, setValues] = useState(defaults);
    const error = (name: string) => {
        const value = form.error(name);
        return value ? value : undefined;
    };
    const set = <K extends keyof PlanFormValues>(key: K, value: PlanFormValues[K]) => setValues((current) => ({ ...current, [key]: value }));
    const fighter = fighters.find((f) => f.id === values.fighterId);
    const clearance = values.fighterId ? clearances[values.fighterId] : undefined;
    const restrictedTechniques =
        clearance?.state === "restricted" && clearance.clearance ? clearance.clearance.restrictions.flatMap((r) => r.blockedTechniques) : [];
    const restrictedFocus = values.focusAreas.filter((item) => restrictedTechniques.includes(item));
    const input = (name: keyof PlanFormValues) => form.control(name, { hint: name in HINTS || undefined, required: name !== "notes" });

    return (
        <form {...form.formProps} className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
            <Card className="min-w-0 lg:col-span-2">
                <CardContent className="pt-6">
                    <FormSection title={t("training.planForm.sectionObjective")} description={t("training.planForm.sectionObjectiveDesc")}>
                        {mode === "create" ? (
                            <Field label={t("training.planForm.fighter")} htmlFor="plan-fighterId" required error={error("fighterId")} hint={HINTS.fighterId}>
                                <Select {...input("fighterId")} value={values.fighterId} onChange={(event) => set("fighterId", event.target.value)}>
                                    <option value="">{t("training.planForm.chooseFighter")}</option>
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
                                    <p className="text-sm font-medium text-fg">{t("training.planForm.fighter")}</p>
                                    <FighterIdentity fighter={fighter} showHealth />
                                </div>
                            )
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
                        <Field label={t("training.planForm.objective")} htmlFor="plan-objective" required error={error("objective")} hint={HINTS.objective}>
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
                            legend={t("training.planForm.phase")}
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

                    {mode === "create" && (
                        <FormSection title={t("training.planForm.sectionVisibility")} description={t("training.planForm.sectionVisibilityDesc")}>
                            <ChoiceGroup
                                id="plan-status"
                                name="status"
                                legend={t("training.planForm.planStatus")}
                                required
                                columns={2}
                                options={STATUS_OPTIONS}
                                value={values.status}
                                onChange={(next) => set("status", next)}
                                error={error("status")}
                            />
                        </FormSection>
                    )}

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
                        <FormMessage {...form.message} message={form.message.message} />
                    </div>
                    <div className="flex flex-col-reverse gap-2 sm:flex-row">
                        <ButtonLink href={cancelHref} variant="secondary">
                            {t("common.cancel")}
                        </ButtonLink>
                        <SubmitButton pending={form.pending} pendingLabel={mode === "create" ? t("training.planForm.submittingCreate") : t("training.planForm.submittingEdit")}>
                            {mode === "create" ? t("training.planForm.submitCreate") : t("training.planForm.submitEdit")}
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
