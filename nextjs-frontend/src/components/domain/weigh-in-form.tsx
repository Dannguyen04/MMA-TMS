"use client";

import { useActionState } from "react";

import { recordWeightAction } from "@/lib/actions/bouts";
import { IDLE } from "@/lib/actions/state";
import { ADHERENCE_LABEL, ADHERENCE_VALUES } from "@/lib/domain/nutrition";
import { Field, Input, Textarea } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";

export function WeighInForm() {
    const [state, action] = useActionState(recordWeightAction, IDLE);
    const fieldErrors = state.status === "error" ? state.fieldErrors : undefined;

    return (
        <form action={action} className="flex max-w-lg flex-col gap-6" noValidate>
            <Field label="Weight" htmlFor="weightKg" required error={fieldErrors?.weightKg} hint="Kilograms, such as 66.5. Today's entry replaces an earlier one.">
                <Input
                    id="weightKg"
                    name="weightKg"
                    inputMode="decimal"
                    autoComplete="off"
                    enterKeyHint="done"
                    required
                    placeholder="66.5"
                    className="text-lg tabular-nums"
                />
            </Field>

            <fieldset className="flex flex-col gap-2">
                <legend className="text-sm font-medium text-fg">
                    Did yesterday follow the plan? <span className="font-normal text-fg-muted">Optional</span>
                </legend>
                <p className="text-sm text-fg-muted">Skip this and today&apos;s weight still saves.</p>
                <div className="mt-1 flex flex-col gap-1">
                    {ADHERENCE_VALUES.map((value) => (
                        <label key={value} className="flex min-h-11 items-center gap-3 rounded-lg px-1 text-sm">
                            <input type="radio" name="adherence" value={value} className="size-4 accent-primary" />
                            {ADHERENCE_LABEL[value]}
                        </label>
                    ))}
                </div>
                {fieldErrors?.adherence && (
                    <p id="adherence-error" role="alert" className="text-sm text-danger-fg">
                        {fieldErrors.adherence}
                    </p>
                )}
            </fieldset>

            <Field label="Note" htmlFor="note" optional error={fieldErrors?.note} hint="200 characters at most.">
                <Textarea id="note" name="note" rows={3} maxLength={200} />
            </Field>

            {state.status === "error" && state.message && (
                <p role="alert" className="text-sm text-danger-fg">
                    {state.message}
                </p>
            )}

            <SubmitButton size="lg" pendingLabel="Saving" className="min-h-11 w-full sm:w-auto">
                Save
            </SubmitButton>
        </form>
    );
}
