"use client";

import { useState } from "react";

import { useT } from "@/components/i18n/locale-provider";
import { ChoiceGroup } from "@/components/ui/choice-group";
import { Field, FormMessage, Input, Textarea } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { useActionForm } from "@/components/ui/use-action-form";
import { recordWeightAction } from "@/lib/actions/bouts";
import { ADHERENCE_VALUES } from "@/lib/domain/nutrition";
import type { PlanAdherence } from "@/lib/domain/weight-chart";

/** Today's kilograms first, then the optional plan question. Built to finish in under 30 seconds on a phone. */
export function WeighInForm() {
    const t = useT();
    const form = useActionForm(recordWeightAction);
    const [adherence, setAdherence] = useState<PlanAdherence | "">("");
    const weight = form.control("weightKg", { required: true, hint: true });
    const note = form.control("note", { hint: true });
    const adherenceOptions = ADHERENCE_VALUES.map((value) => ({ value, label: t(`boutLabel.adherence.${value}`) }));
    // The page has one job, typing the number, so the weight field takes focus and the keypad opens at once.

    return (
        <form {...form.formProps} className="flex max-w-lg flex-col gap-6">
            <FormMessage {...form.message} />
            <Field label={t("boutFighter.form.weight")} htmlFor={weight.id} required error={form.error("weightKg")} hint={t("boutFighter.form.weightHint")}>
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
                        {t("boutFighter.form.adherenceQuestion")} <span className="ml-1.5 text-xs font-normal text-fg-subtle">{t("boutFighter.form.optional")}</span>
                    </>
                }
                hint={t("boutFighter.form.adherenceHint")}
                options={adherenceOptions}
                value={adherence}
                onChange={setAdherence}
                error={form.error("adherence")}
                variant="compact"
                columns={3}
                className="[&_label]:min-h-11 [&_label]:items-center"
            />

            <Field label={t("boutFighter.form.note")} htmlFor={note.id} optional error={form.error("note")} hint={t("boutFighter.form.noteHint")}>
                <Textarea {...note} rows={3} maxLength={200} />
            </Field>

            <SubmitButton pending={form.pending} size="lg" pendingLabel={t("boutFighter.form.saving")} className="min-h-11 w-full sm:w-auto">
                {t("boutFighter.form.save")}
            </SubmitButton>
        </form>
    );
}
