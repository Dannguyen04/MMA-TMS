"use client";

import { Info } from "lucide-react";

import { InlineNote } from "@/components/dashboard/inline-note";
import { formatMeasure } from "@/components/domain/domain-format";
import { Checkbox, Field, Input, Select } from "@/components/ui/form";
import type { ActionForm } from "@/components/ui/use-action-form";
import { TECHNIQUE_LABELS, TECHNIQUES } from "@/lib/domain/labels";
import type { Goal } from "@/lib/domain/types";
import { dayKey } from "@/lib/format";

/** Default length of a new goal: an eight-week block. */
const DEFAULT_GOAL_DAYS = 56;
const DAY_MS = 86_400_000;
const UNIT_SUGGESTIONS = ["%", "m/s", "ms", "kg", "/min", "min", "W", "rounds", "reps"];

const HINTS = {
    title: "What the fighter is working towards, in their language.",
    metricLabel: "The single measurement that shows progress.",
    current: "Leave empty to start from the baseline.",
    lowerIsBetter: "Tick for times, weights or error rates.",
};

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
    const showFighterPicker = mode === "create" && !fighterId;
    const { control, error } = form;
    const field = (name: string) => ({ htmlFor: control(name).id, error: error(name) });

    return (
        <>
            {mode === "edit" && goal && <input type="hidden" name="goalId" value={goal.id} />}
            {!showFighterPicker && <input type="hidden" name="fighterId" value={goal?.fighterId ?? fighterId ?? ""} />}

            {showFighterPicker && (
                <Field label="Fighter" {...field("fighterId")} required>
                    <Select {...control("fighterId", { required: true })} defaultValue="">
                        <option value="" disabled>
                            Choose a fighter
                        </option>
                        {fighters.map((fighter) => (
                            <option key={fighter.id} value={fighter.id}>
                                {fighter.name}
                            </option>
                        ))}
                    </Select>
                </Field>
            )}

            <Field label="Title" {...field("title")} hint={HINTS.title} required>
                <Input
                    {...control("title", { hint: HINTS.title, required: true })}
                    defaultValue={goal?.title}
                    placeholder="e.g. Keep the right hand home after the lead hook"
                    maxLength={120}
                />
            </Field>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
                <Field label="Metric" {...field("metricLabel")} hint={HINTS.metricLabel} required className="sm:col-span-2">
                    <Input
                        {...control("metricLabel", { hint: HINTS.metricLabel, required: true })}
                        defaultValue={goal?.metricLabel}
                        placeholder="e.g. Guard uptime after hooks"
                        maxLength={80}
                    />
                </Field>
                <Field label="Unit" {...field("unit")} required>
                    <Input {...control("unit", { required: true })} defaultValue={goal?.unit} list={`${form.formProps.id}-units`} placeholder="%, m/s, kg" maxLength={16} />
                    <datalist id={`${form.formProps.id}-units`}>
                        {UNIT_SUGGESTIONS.map((unit) => (
                            <option key={unit} value={unit} />
                        ))}
                    </datalist>
                </Field>
            </div>

            <div className="grid grid-cols-1 items-start gap-5 sm:grid-cols-2">
                <Field label="Technique" {...field("technique")} optional>
                    <Select {...control("technique")} defaultValue={goal?.technique ?? ""}>
                        <option value="">No specific technique</option>
                        {TECHNIQUES.map((technique) => (
                            <option key={technique} value={technique}>
                                {TECHNIQUE_LABELS[technique]}
                            </option>
                        ))}
                    </Select>
                </Field>
                <div className="sm:pt-7">
                    <Checkbox
                        id={control("lowerIsBetter").id}
                        name="lowerIsBetter"
                        defaultChecked={goal?.lowerIsBetter}
                        label="Lower is better"
                        description={HINTS.lowerIsBetter}
                    />
                </div>
            </div>

            <div className={mode === "create" ? "grid grid-cols-1 gap-5 sm:grid-cols-3" : "grid grid-cols-1 gap-5 sm:grid-cols-2"}>
                <Field label="Baseline" {...field("baseline")} required>
                    <Input {...control("baseline", { required: true })} type="number" step="any" inputMode="decimal" defaultValue={goal?.baseline} />
                </Field>
                <Field label="Target" {...field("target")} required>
                    <Input {...control("target", { required: true })} type="number" step="any" inputMode="decimal" defaultValue={goal?.target} />
                </Field>
                {mode === "create" && (
                    <Field label="Current" {...field("current")} hint={HINTS.current} optional>
                        <Input {...control("current", { hint: HINTS.current })} type="number" step="any" inputMode="decimal" />
                    </Field>
                )}
            </div>

            {mode === "edit" && goal && (
                <InlineNote icon={Info}>
                    Current value is <span className="font-semibold text-fg">{formatMeasure(goal.current, goal.unit)}</span>. Record new measurements with Log
                    progress so the history stays accurate.
                </InlineNote>
            )}

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <Field label="Start date" {...field("startDate")} required>
                    <Input {...control("startDate", { required: true })} type="date" defaultValue={dayKey(goal?.startDate ?? now)} />
                </Field>
                <Field label="Due date" {...field("dueDate")} required>
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
