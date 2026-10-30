"use client";

import { useLocale, useT } from "@/components/i18n/locale-provider";
import { Field, FormMessage, Input, Textarea } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { useActionForm } from "@/components/ui/use-action-form";
import { saveNutritionPlanAction } from "@/lib/actions/bouts";
import type { NutritionPhaseKey, NutritionPlan } from "@/lib/domain/bout";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

const PHASES: NutritionPhaseKey[] = ["camp", "fightWeek", "postWeighIn"];

/**
 * Three phase notes the coach types or pastes from a specialist. The app stores the words and nothing else. The box
 * the fighter sees now (`currentPhase`) stands out.
 */
export function NutritionPlanForm({
    boutId,
    plan,
    authorName,
    currentPhase,
}: {
    boutId: string;
    plan: NutritionPlan;
    authorName: string;
    currentPhase: NutritionPhaseKey | null;
}) {
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
                const current = phase === currentPhase;
                return (
                    <Field
                        key={phase}
                        className={cn(current && "-mx-3 rounded-lg bg-primary-soft/60 px-3 py-3 ring-1 ring-primary/40")}
                        label={
                            <>
                                {t(`boutLabel.nutritionPhase.${phase}`)}
                                {current && (
                                    <span className="ml-2 inline-flex h-5 items-center rounded-md bg-primary px-1.5 align-middle text-[11px] font-semibold text-primary-fg">
                                        {t("boutFighter.plan.currentPhase")}
                                    </span>
                                )}
                            </>
                        }
                        htmlFor={control.id}
                        error={form.error(phase)}
                        hint={note ? t("boutFighter.plan.lastEdited", { name: note.authorName, date: formatDateTime(note.updatedAt, locale) }) : undefined}
                    >
                        <Textarea {...control} rows={4} maxLength={2000} defaultValue={note?.text ?? ""} />
                    </Field>
                );
            })}
            <Field label={t("boutFighter.plan.writtenBy")} htmlFor={author.id} required error={form.error("authorName")} hint={t("boutFighter.plan.writtenByHint")}>
                <Input {...author} maxLength={100} defaultValue={authorName} />
            </Field>
            <SubmitButton pending={form.pending} size="lg" pendingLabel={t("boutFighter.plan.saving")} className="min-h-11 w-full sm:w-auto">
                {t("boutFighter.plan.save")}
            </SubmitButton>
        </form>
    );
}
