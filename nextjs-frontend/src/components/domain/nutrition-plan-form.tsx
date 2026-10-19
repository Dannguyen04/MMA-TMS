"use client";

import { Field, FormMessage, Input, Textarea } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { useActionForm } from "@/components/ui/use-action-form";
import { saveNutritionPlanAction } from "@/lib/actions/bouts";
import type { NutritionPhaseKey, NutritionPlan } from "@/lib/domain/bout";
import { NUTRITION_PHASE_LABELS } from "@/lib/domain/labels";
import { formatDateTime } from "@/lib/format";

const PHASES: NutritionPhaseKey[] = ["camp", "fightWeek", "postWeighIn"];

/** Three phase notes the coach types or pastes from a specialist. The app stores the words and nothing else. */
export function NutritionPlanForm({ boutId, plan, authorName }: { boutId: string; plan: NutritionPlan; authorName: string }) {
    const form = useActionForm(saveNutritionPlanAction);
    const author = form.control("authorName", { required: true, hint: true });

    return (
        <form {...form.formProps} className="flex flex-col gap-5">
            <input type="hidden" name="boutId" value={boutId} />
            <p className="text-sm text-fg-muted">Write what this fighter should eat in each phase. The app stores the words you type.</p>
            <FormMessage {...form.message} />
            {PHASES.map((phase) => {
                const note = plan[phase];
                const control = form.control(phase, { hint: Boolean(note) });
                return (
                    <Field
                        key={phase}
                        label={NUTRITION_PHASE_LABELS[phase]}
                        htmlFor={control.id}
                        error={form.error(phase)}
                        hint={note ? `Last edited by ${note.authorName}, ${formatDateTime(note.updatedAt)}` : undefined}
                    >
                        <Textarea {...control} rows={4} maxLength={2000} defaultValue={note?.text ?? ""} />
                    </Field>
                );
            })}
            <Field label="Written by" htmlFor={author.id} required error={form.error("authorName")} hint="Your name, or the specialist you are copying from.">
                <Input {...author} maxLength={80} defaultValue={authorName} />
            </Field>
            <SubmitButton pending={form.pending} size="lg" pendingLabel="Saving" className="min-h-11 w-full sm:w-auto">
                Save plan
            </SubmitButton>
        </form>
    );
}
