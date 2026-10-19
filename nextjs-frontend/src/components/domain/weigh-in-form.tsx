"use client";

import { useState } from "react";

import { ChoiceGroup } from "@/components/ui/choice-group";
import { Field, FormMessage, Input, Textarea } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { useActionForm } from "@/components/ui/use-action-form";
import { recordWeightAction } from "@/lib/actions/bouts";
import { PLAN_ADHERENCE_LABELS } from "@/lib/domain/labels";
import { ADHERENCE_VALUES } from "@/lib/domain/nutrition";
import type { PlanAdherence } from "@/lib/domain/weight-chart";

const ADHERENCE_OPTIONS = ADHERENCE_VALUES.map((value) => ({ value, label: PLAN_ADHERENCE_LABELS[value] }));

/** Today's kilograms first, then the optional plan question. Built to finish in under 30 seconds on a phone. */
export function WeighInForm() {
    const form = useActionForm(recordWeightAction);
    const [adherence, setAdherence] = useState<PlanAdherence | "">("");
    const weight = form.control("weightKg", { required: true, hint: true });
    const note = form.control("note", { hint: true });
    // The page has one job, typing the number, so the weight field takes focus and the keypad opens at once.

    return (
        <form {...form.formProps} className="flex max-w-lg flex-col gap-6">
            <FormMessage {...form.message} />
            <Field label="Weight" htmlFor={weight.id} required error={form.error("weightKg")} hint="Kilograms, such as 66.5. Today's entry replaces an earlier one.">
                <Input
                    {...weight}
                    autoFocus
                    inputMode="decimal"
                    autoComplete="off"
                    enterKeyHint="done"
                    placeholder="66.5"
                    suffix="kg"
                    className="h-11 text-lg tabular-nums"
                />
            </Field>

            <ChoiceGroup
                id={`${form.formProps.id}-adherence`}
                name="adherence"
                legend={
                    <>
                        Did yesterday follow the plan? <span className="ml-1.5 text-xs font-normal text-fg-subtle">(optional)</span>
                    </>
                }
                hint="Skip this and today's weight still saves."
                options={ADHERENCE_OPTIONS}
                value={adherence}
                onChange={setAdherence}
                error={form.error("adherence")}
                variant="compact"
                columns={3}
                className="[&_label]:min-h-11 [&_label]:items-center"
            />

            <Field label="Note" htmlFor={note.id} optional error={form.error("note")} hint="200 characters at most.">
                <Textarea {...note} rows={3} maxLength={200} />
            </Field>

            <SubmitButton pending={form.pending} size="lg" pendingLabel="Saving" className="min-h-11 w-full sm:w-auto">
                Save
            </SubmitButton>
        </form>
    );
}
