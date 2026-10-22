"use client";

import { useT } from "@/components/i18n/locale-provider";
import { Field, FormMessage, Input } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { useActionForm } from "@/components/ui/use-action-form";
import { recordSelfWeightAction } from "@/lib/actions/weigh-in";
import { parseWeightKg, weightInputMessage } from "@/lib/domain/weigh-in";

/** One number and Save: today's weight, checked here first so a typo never reaches the server. */
export function WeighInForm() {
    const t = useT();
    const form = useActionForm(recordSelfWeightAction, {
        id: "weigh-in",
        prepare(fd) {
            const parsed = parseWeightKg(String(fd.get("weightKg") ?? ""));
            if (!parsed.ok) return { status: "error", message: t("form.fixFields"), fieldErrors: { weightKg: weightInputMessage(t, parsed.error) } };
        },
    });
    const weight = form.control("weightKg", { required: true, hint: true });

    return (
        <form {...form.formProps} className="flex flex-col gap-5">
            <FormMessage {...form.message} />
            <Field label={t("weighIn.label")} htmlFor={weight.id} hint={t("weighIn.hint")} error={form.error("weightKg")} required>
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
            <SubmitButton size="lg" className="w-full" pending={form.pending} pendingLabel={t("weighIn.saving")}>
                {t("weighIn.save")}
            </SubmitButton>
        </form>
    );
}
