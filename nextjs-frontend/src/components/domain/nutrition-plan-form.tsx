"use client";

import { useLocale, useT } from "@/components/i18n/locale-provider";
import { Field, FormMessage, Input, Textarea } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { useActionForm } from "@/components/ui/use-action-form";
import { saveNutritionPlanAction } from "@/lib/actions/bouts";
import type { NutritionPhaseKey, NutritionPlan } from "@/lib/domain/bout";
import { formatDateTime } from "@/lib/format";

const PHASES: NutritionPhaseKey[] = ["camp", "fightWeek", "postWeighIn"];

/** Three phase notes the coach types or pastes from a specialist. The app stores the words and nothing else. */
export function NutritionPlanForm({ boutId, plan, authorName }: { boutId: string; plan: NutritionPlan; authorName: string }) {
    const t = useT();
    const locale = useLocale();
    const form = useActionForm(saveNutritionPlanAction);
    const author = form.control("authorName", { required: true, hint: true });

    return (
        <form {...form.formProps} className="flex flex-col gap-5">
            <input type="hidden" name="boutId" value={boutId} />
            <p className="text-sm text-fg-muted">{t("boutFighter.plan.intro")}</p>
            <FormMessage {...form.message} />
            {PHASES.map((phase) => {
                const note = plan[phase];
                const control = form.control(phase, { hint: Boolean(note) });
                return (
                    <Field
                        key={phase}
                        label={t(`boutLabel.nutritionPhase.${phase}`)}
                        htmlFor={control.id}
                        error={form.error(phase)}
                        hint={note ? t("boutFighter.plan.lastEdited", { name: note.authorName, date: formatDateTime(note.updatedAt, locale) }) : undefined}
                    >
                        <Textarea {...control} rows={4} maxLength={2000} defaultValue={note?.text ?? ""} />
                    </Field>
                );
            })}
            <Field label={t("boutFighter.plan.writtenBy")} htmlFor={author.id} required error={form.error("authorName")} hint={t("boutFighter.plan.writtenByHint")}>
                <Input {...author} maxLength={80} defaultValue={authorName} />
            </Field>
            <SubmitButton pending={form.pending} size="lg" pendingLabel={t("boutFighter.plan.saving")} className="min-h-11 w-full sm:w-auto">
                {t("boutFighter.plan.save")}
            </SubmitButton>
        </form>
    );
}
