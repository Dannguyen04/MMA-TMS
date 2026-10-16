"use client";

import { useActionState } from "react";

import { saveNutritionPlanAction } from "@/lib/actions/bouts";
import { IDLE } from "@/lib/actions/state";
import type { NutritionPhaseKey, NutritionPlan } from "@/lib/domain/bout";
import { NUTRITION_PHASE_LABEL } from "@/lib/domain/nutrition";
import { formatDateTime } from "@/lib/format";
import { Field, Input, Textarea } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";

const PHASES: NutritionPhaseKey[] = ["camp", "fightWeek", "postWeighIn"];

export function NutritionPlanForm({ boutId, plan, authorName }: { boutId: string; plan: NutritionPlan; authorName: string }) {
    const [state, action] = useActionState(saveNutritionPlanAction, IDLE);
    const fieldErrors = state.status === "error" ? state.fieldErrors : undefined;

    return (
        <form action={action} className="flex flex-col gap-5">
            <input type="hidden" name="boutId" value={boutId} />
            <p className="text-sm text-fg-muted">Write what this fighter should eat in each phase. The app stores the words you type.</p>
            {PHASES.map((phase) => {
                const note = plan[phase];
                return (
                    <Field key={phase} label={NUTRITION_PHASE_LABEL[phase]} htmlFor={`nutrition-${phase}`} error={fieldErrors?.[phase]}>
                        <Textarea id={`nutrition-${phase}`} name={phase} rows={4} maxLength={2000} defaultValue={note?.text ?? ""} />
                        {note && (
                            <p className="text-xs text-fg-muted">
                                Last edited by {note.authorName}, {formatDateTime(note.updatedAt)}
                            </p>
                        )}
                    </Field>
                );
            })}
            <Field label="Written by" htmlFor="authorName" required error={fieldErrors?.authorName} hint="Your name, or the specialist you are copying from.">
                <Input id="authorName" name="authorName" required maxLength={80} defaultValue={authorName} />
            </Field>
            {state.status === "error" && state.message && (
                <p role="alert" className="text-sm text-danger-fg">
                    {state.message}
                </p>
            )}
            <SubmitButton size="lg" pendingLabel="Saving" className="min-h-11 w-full sm:w-auto">
                Save plan
            </SubmitButton>
        </form>
    );
}
