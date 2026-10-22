"use client";

import { Send } from "lucide-react";

import { useT } from "@/components/i18n/locale-provider";
import { Field, FormMessage, Input, Select, Textarea } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { useToast } from "@/components/ui/toast";
import { useActionForm } from "@/components/ui/use-action-form";
import { submitApplicationAction } from "@/lib/actions/admissions";
import { ADMISSION_LIMITS, type ApplicationInput } from "@/lib/domain/admissions";
import { WEIGHT_CLASS_LABELS, WEIGHT_CLASS_ORDER } from "@/lib/domain/labels";
import type { Locale } from "@/lib/i18n/config";

export interface ApplicationFormProps {
    /** Today's academy date (YYYY-MM-DD), the latest date of birth the picker offers. */
    today: string;
    /** An earlier application's answers to start from, when applying again. */
    previous: ApplicationInput | null;
    locale?: Locale;
}

/** The application an applicant sends to the academy. A coach then assesses them in person. */
export function ApplicationForm({ today, previous }: ApplicationFormProps) {
    const t = useT();
    const toast = useToast();
    const form = useActionForm(submitApplicationAction, {
        id: "application",
        onSuccess: (state) => toast({ tone: "success", title: t("applicant.form.toastTitle"), description: state.message }),
    });
    const { control, error } = form;
    const field = (name: keyof ApplicationInput, label: string, required = false) => ({ label, htmlFor: control(name).id, required, optional: !required, error: error(name) });

    const backgroundFields = [
        { name: "trainingBackground" as const, label: t("applicant.form.trainingBackground"), placeholder: t("applicant.form.trainingPlaceholder") },
        { name: "competitionBackground" as const, label: t("applicant.form.competitionBackground"), placeholder: t("applicant.form.competitionPlaceholder") },
        { name: "motivation" as const, label: t("applicant.form.motivation"), placeholder: t("applicant.form.motivationPlaceholder") },
    ];

    return (
        <form {...form.formProps} className="flex flex-col gap-5">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <Field {...field("firstName", t("applicant.form.firstName"), true)}>
                    <Input {...control("firstName", { required: true })} defaultValue={previous?.firstName} autoComplete="given-name" maxLength={ADMISSION_LIMITS.name} />
                </Field>
                <Field {...field("lastName", t("applicant.form.lastName"), true)}>
                    <Input {...control("lastName", { required: true })} defaultValue={previous?.lastName} autoComplete="family-name" maxLength={ADMISSION_LIMITS.name} />
                </Field>
                <Field {...field("dateOfBirth", t("applicant.form.dateOfBirth"), true)}>
                    <Input {...control("dateOfBirth", { required: true })} type="date" max={today} defaultValue={previous?.dateOfBirth} autoComplete="bday" />
                </Field>
                <Field {...field("weightClass", t("applicant.form.weightClass"), true)}>
                    <Select {...control("weightClass", { required: true })} defaultValue={previous?.weightClass ?? ""}>
                        <option value="" disabled>
                            {t("applicant.form.chooseWeightClass")}
                        </option>
                        {WEIGHT_CLASS_ORDER.map((value) => (
                            <option key={value} value={value}>
                                {WEIGHT_CLASS_LABELS[value]}
                            </option>
                        ))}
                    </Select>
                </Field>
                <Field {...field("nationality", t("applicant.form.nationality"))}>
                    <Input {...control("nationality")} defaultValue={previous?.nationality ?? ""} maxLength={ADMISSION_LIMITS.nationality} />
                </Field>
                <Field {...field("contactPhone", t("applicant.form.phone"))}>
                    <Input {...control("contactPhone")} type="tel" defaultValue={previous?.contactPhone ?? ""} autoComplete="tel" maxLength={ADMISSION_LIMITS.contactPhone} />
                </Field>
            </div>
            {backgroundFields.map(({ name, label, placeholder }) => (
                <Field key={name} {...field(name, label)}>
                    <Textarea {...control(name)} rows={3} defaultValue={previous?.[name] ?? ""} placeholder={placeholder} maxLength={ADMISSION_LIMITS.background} />
                </Field>
            ))}
            <FormMessage {...form.message} />
            <div className="flex justify-end">
                <SubmitButton pending={form.pending} pendingLabel={t("applicant.form.sending")}>
                    <Send aria-hidden />
                    {t("applicant.form.submit")}
                </SubmitButton>
            </div>
        </form>
    );
}
