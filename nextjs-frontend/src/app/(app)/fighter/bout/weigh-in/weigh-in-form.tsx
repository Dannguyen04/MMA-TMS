"use client";

import { Field, FormMessage, Input } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { useActionForm } from "@/components/ui/use-action-form";
import { recordSelfWeightAction } from "@/lib/actions/weigh-in";
import { FIX_FIELDS } from "@/lib/actions/state";
import { parseWeightKg, WEIGHT_MAX_KG, WEIGHT_MIN_KG } from "@/lib/domain/weigh-in";

/** One number and Save: today's weight, checked here first so a typo never reaches the server. */
export function WeighInForm() {
    const form = useActionForm(recordSelfWeightAction, {
        id: "weigh-in",
        prepare(fd) {
            const parsed = parseWeightKg(String(fd.get("weightKg") ?? ""));
            if (!parsed.ok) return { status: "error", message: FIX_FIELDS, fieldErrors: { weightKg: parsed.message } };
        },
    });
    const weight = form.control("weightKg", { required: true, hint: true });

    return (
        <form {...form.formProps} className="flex flex-col gap-5">
            <FormMessage {...form.message} />
            <Field
                label="Weight (kg)"
                htmlFor={weight.id}
                hint={`Morning weight, before eating. Between ${WEIGHT_MIN_KG} and ${WEIGHT_MAX_KG} kg; 66,5 and 66.5 both work.`}
                error={form.error("weightKg")}
                required
            >
                <Input
                    {...weight}
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    autoFocus
                    placeholder="66.5"
                    suffix="kg"
                    className="h-12 text-lg tabular-nums"
                />
            </Field>
            <SubmitButton size="lg" className="w-full" pending={form.pending} pendingLabel="Saving…">
                Save
            </SubmitButton>
        </form>
    );
}
