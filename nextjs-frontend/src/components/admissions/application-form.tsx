"use client";

import { Send } from "lucide-react";

import { Field, FormMessage, Input, Select, Textarea } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { useToast } from "@/components/ui/toast";
import { useActionForm } from "@/components/ui/use-action-form";
import { submitApplicationAction } from "@/lib/actions/admissions";
import { ADMISSION_LIMITS, type ApplicationInput } from "@/lib/domain/admissions";
import { WEIGHT_CLASS_LABELS, WEIGHT_CLASS_ORDER } from "@/lib/domain/labels";

export interface ApplicationFormProps {
    /** Today's academy date (YYYY-MM-DD), the latest date of birth the picker offers. */
    today: string;
    /** An earlier application's answers to start from, when applying again. */
    previous: ApplicationInput | null;
}

const BACKGROUND_FIELDS = [
    { name: "trainingBackground", label: "Training background", placeholder: "Gyms, disciplines, how long and how often you train." },
    { name: "competitionBackground", label: "Competition background", placeholder: "Bouts, tournaments and results, if any." },
    { name: "motivation", label: "Why do you want to join?", placeholder: "What you want to achieve at the academy." },
] as const satisfies readonly { name: keyof ApplicationInput; label: string; placeholder: string }[];

/** The application an applicant sends to the academy. A coach then assesses them in person. */
export function ApplicationForm({ today, previous }: ApplicationFormProps) {
    const toast = useToast();
    const form = useActionForm(submitApplicationAction, {
        id: "application",
        onSuccess: (state) => toast({ tone: "success", title: "Application sent", description: state.message }),
    });
    const { control, error } = form;
    const field = (name: keyof ApplicationInput, label: string, required = false) => ({ label, htmlFor: control(name).id, required, optional: !required, error: error(name) });

    return (
        <form {...form.formProps} className="flex flex-col gap-5">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <Field {...field("firstName", "First name", true)}>
                    <Input {...control("firstName", { required: true })} defaultValue={previous?.firstName} autoComplete="given-name" maxLength={ADMISSION_LIMITS.name} />
                </Field>
                <Field {...field("lastName", "Last name", true)}>
                    <Input {...control("lastName", { required: true })} defaultValue={previous?.lastName} autoComplete="family-name" maxLength={ADMISSION_LIMITS.name} />
                </Field>
                <Field {...field("dateOfBirth", "Date of birth", true)}>
                    <Input {...control("dateOfBirth", { required: true })} type="date" max={today} defaultValue={previous?.dateOfBirth} autoComplete="bday" />
                </Field>
                <Field {...field("weightClass", "Weight class", true)}>
                    <Select {...control("weightClass", { required: true })} defaultValue={previous?.weightClass ?? ""}>
                        <option value="" disabled>
                            Choose a weight class
                        </option>
                        {WEIGHT_CLASS_ORDER.map((value) => (
                            <option key={value} value={value}>
                                {WEIGHT_CLASS_LABELS[value]}
                            </option>
                        ))}
                    </Select>
                </Field>
                <Field {...field("nationality", "Nationality")}>
                    <Input {...control("nationality")} defaultValue={previous?.nationality ?? ""} maxLength={ADMISSION_LIMITS.nationality} />
                </Field>
                <Field {...field("contactPhone", "Phone")}>
                    <Input {...control("contactPhone")} type="tel" defaultValue={previous?.contactPhone ?? ""} autoComplete="tel" maxLength={ADMISSION_LIMITS.contactPhone} />
                </Field>
            </div>
            {BACKGROUND_FIELDS.map(({ name, label, placeholder }) => (
                <Field key={name} {...field(name, label)}>
                    <Textarea {...control(name)} rows={3} defaultValue={previous?.[name] ?? ""} placeholder={placeholder} maxLength={ADMISSION_LIMITS.background} />
                </Field>
            ))}
            <FormMessage {...form.message} />
            <div className="flex justify-end">
                <SubmitButton pending={form.pending} pendingLabel="Sending…">
                    <Send aria-hidden />
                    Send application
                </SubmitButton>
            </div>
        </form>
    );
}
