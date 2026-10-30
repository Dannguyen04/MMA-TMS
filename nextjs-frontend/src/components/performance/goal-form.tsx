"use client";

import { Info } from "lucide-react";

import { InlineNote } from "@/components/dashboard/inline-note";
import { formatMeasure } from "@/components/domain/domain-format";
import { useT } from "@/components/i18n/locale-provider";
import { Checkbox, Field, Input, Select } from "@/components/ui/form";
import type { ActionForm } from "@/components/ui/use-action-form";
import { techniqueLabel, TECHNIQUES } from "@/lib/domain/labels";
import type { Goal } from "@/lib/domain/types";
import { dayKey } from "@/lib/format";

/** Default length of a new goal: an eight-week block. */
const DEFAULT_GOAL_DAYS = 56;
const DAY_MS = 86_400_000;
const UNIT_SUGGESTIONS = ["%", "m/s", "ms", "kg", "/min", "min", "W", "rounds", "reps"];

export interface FighterOption {
    id: string;
    name: string;
}

export interface GoalFormProps {
    form: ActionForm<undefined>;
    mode: "create" | "edit";
    /** The goal being edited (edit mode). */
    goal?: Goal;
    /** Fixed fighter for a new goal; when omitted the coach picks from `fighters`. */
    fighterId?: string;
    fighters?: FighterOption[];
    /** Server time (ISO) for date defaults. */
    now: string;
}

/**
 * Fields for creating or editing a goal, rendered inside an ActionDialog. Inputs are uncontrolled and the
 * form is never reset by React, so typed values survive a validation error.
 */
export function GoalForm({ form, mode, goal, fighterId, fighters = [], now }: GoalFormProps) {
    const t = useT();
    const showFighterPicker = mode === "create" && !fighterId;
    const { control, error } = form;
    const field = (name: string) => ({ htmlFor: control(name).id, error: error(name) });
    const hints = {
        title: t("screens.performance.goalForm.hintTitle"),
        metricLabel: t("screens.performance.goalForm.hintMetric"),
        current: t("screens.performance.goalForm.hintCurrent"),
        lowerIsBetter: t("screens.performance.goalForm.hintLowerIsBetter"),
    };

    return (
        <>
            {mode === "edit" && goal && <input type="hidden" name="goalId" value={goal.id} />}
            {!showFighterPicker && <input type="hidden" name="fighterId" value={goal?.fighterId ?? fighterId ?? ""} />}

            {showFighterPicker && (
                <Field label={t("screens.performance.fighter")} {...field("fighterId")} required>
                    <Select {...control("fighterId", { required: true })} defaultValue="">
                        <option value="" disabled>
                            {t("screens.performance.goalForm.chooseFighter")}
                        </option>
                        {fighters.map((fighter) => (
                            <option key={fighter.id} value={fighter.id}>
                                {fighter.name}
                            </option>
                        ))}
                    </Select>
                </Field>
            )}

            <Field label={t("screens.performance.goalForm.title")} {...field("title")} hint={hints.title} required>
                <Input
                    {...control("title", { hint: hints.title, required: true })}
                    defaultValue={goal?.title}
                    placeholder={t("screens.performance.goalForm.titlePlaceholder")}
                    maxLength={120}
                />
            </Field>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
                <Field label={t("screens.performance.goalForm.metric")} {...field("metricLabel")} hint={hints.metricLabel} required className="sm:col-span-2">
                    <Input
                        {...control("metricLabel", { hint: hints.metricLabel, required: true })}
                        defaultValue={goal?.metricLabel}
                        placeholder={t("screens.performance.goalForm.metricPlaceholder")}
                        maxLength={80}
                    />
                </Field>
                <Field label={t("screens.performance.goalForm.unit")} {...field("unit")} required>
                    <Input {...control("unit", { required: true })} defaultValue={goal?.unit} list={`${form.formProps.id}-units`} placeholder="%, m/s, kg" maxLength={16} />
                    <datalist id={`${form.formProps.id}-units`}>
                        {UNIT_SUGGESTIONS.map((unit) => (
                            <option key={unit} value={unit} />
                        ))}
                    </datalist>
                </Field>
            </div>

            <div className="grid grid-cols-1 items-start gap-5 sm:grid-cols-2">
                <Field label={t("screens.performance.technique")} {...field("technique")} optional>
                    <Select {...control("technique")} defaultValue={goal?.technique ?? ""}>
                        <option value="">{t("screens.performance.goalForm.noTechnique")}</option>
                        {TECHNIQUES.map((technique) => (
                            <option key={technique} value={technique}>
                                {techniqueLabel(t, technique)}
                            </option>
                        ))}
                    </Select>
                </Field>
                <div className="sm:pt-7">
                    <Checkbox
                        id={control("lowerIsBetter").id}
                        name="lowerIsBetter"
                        defaultChecked={goal?.lowerIsBetter}
                        label={t("screens.performance.goalForm.lowerIsBetter")}
                        description={hints.lowerIsBetter}
                    />
                </div>
            </div>

            <div className={mode === "create" ? "grid grid-cols-1 gap-5 sm:grid-cols-3" : "grid grid-cols-1 gap-5 sm:grid-cols-2"}>
                <Field label={t("screens.performance.goalActions.baseline")} {...field("baseline")} required>
                    <Input {...control("baseline", { required: true })} type="number" step="any" inputMode="decimal" defaultValue={goal?.baseline} />
                </Field>
                <Field label={t("screens.performance.goalActions.target")} {...field("target")} required>
                    <Input {...control("target", { required: true })} type="number" step="any" inputMode="decimal" defaultValue={goal?.target} />
                </Field>
                {mode === "create" && (
                    <Field label={t("screens.performance.goalActions.current")} {...field("current")} hint={hints.current} optional>
                        <Input {...control("current", { hint: hints.current })} type="number" step="any" inputMode="decimal" />
                    </Field>
                )}
            </div>

            {mode === "edit" && goal && (
                <InlineNote icon={Info}>
                    {t("screens.performance.goalForm.currentNoteBefore")}
                    <span className="font-semibold text-fg">{formatMeasure(goal.current, goal.unit)}</span>
                    {t("screens.performance.goalForm.currentNoteAfter")}
                </InlineNote>
            )}

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <Field label={t("screens.performance.goalForm.startDate")} {...field("startDate")} required>
                    <Input {...control("startDate", { required: true })} type="date" defaultValue={dayKey(goal?.startDate ?? now)} />
                </Field>
                <Field label={t("screens.performance.goalForm.dueDate")} {...field("dueDate")} required>
                    <Input
                        {...control("dueDate", { required: true })}
                        type="date"
                        defaultValue={dayKey(goal?.dueDate ?? new Date(Date.parse(now) + DEFAULT_GOAL_DAYS * DAY_MS))}
                        min={mode === "create" ? dayKey(now) : undefined}
                    />
                </Field>
            </div>
        </>
    );
}
