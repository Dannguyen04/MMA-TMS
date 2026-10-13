"use client";

import { Mail, PenLine, Send } from "lucide-react";
import { useState } from "react";

import { TermHint } from "@/components/domain/term-hint";
import { Button } from "@/components/ui/button";
import { ChoiceGroup, type ChoiceOption } from "@/components/ui/choice-group";
import { Field, FormMessage, Input, Textarea } from "@/components/ui/form";
import { FormStep, FormSteps, useFormSteps, type FormStepDefinition } from "@/components/ui/form-steps";
import { SubmitButton } from "@/components/ui/submit-button";
import { SuggestionChips, appendSuggestion, type Suggestion } from "@/components/ui/suggestion-chips";
import { useToast } from "@/components/ui/toast";
import { useActionForm } from "@/components/ui/use-action-form";
import { submitApplicationAction } from "@/lib/actions/admissions";
import { ADMISSION_LIMITS, type ApplicationInput } from "@/lib/domain/admissions";
import { WEIGHT_CLASS_LABELS, WEIGHT_CLASS_ORDER } from "@/lib/domain/labels";
import type { WeightClass } from "@/lib/domain/types";
import { cn } from "@/lib/utils";
import { applicationSummary, weightClassLimit, type ApplicationStepId, type SummarySection } from "./application-summary";

export interface ApplicationFormProps {
    /** Today's academy date (YYYY-MM-DD), the latest date of birth the picker offers. */
    today: string;
    /** An earlier application's answers to start from, when applying again. */
    previous: ApplicationInput | null;
    /** The signed-in account's email; the application is sent with it, never with a typed one. */
    email: string;
}

const STEPS: (FormStepDefinition & { id: ApplicationStepId })[] = [
    { id: "about", label: "About you", description: "Name, birth date, weight class" },
    { id: "experience", label: "Your experience", description: "Background and goals", optional: true },
    { id: "review", label: "Review & send" },
];

const WEIGHT_CLASS_OPTIONS: ChoiceOption<WeightClass>[] = WEIGHT_CLASS_ORDER.map((value) => ({
    value,
    label: WEIGHT_CLASS_LABELS[value],
    description: weightClassLimit(value),
}));

type BackgroundName = "trainingBackground" | "competitionBackground" | "motivation";

const BACKGROUND_FIELDS: { name: BackgroundName; label: string; placeholder: string; chips: { label: string; suggestions: Suggestion[] }[] }[] = [
    {
        name: "trainingBackground",
        label: "Training background",
        placeholder: "Gyms, disciplines, how long and how often you train.",
        chips: [
            { label: "Disciplines", suggestions: ["Boxing", "Muay Thai", "Kickboxing", "Brazilian jiu-jitsu", "Wrestling", "Judo"].map((label) => ({ label })) },
            {
                label: "How long",
                suggestions: [
                    { label: "Under 1 year", value: "Training for under a year." },
                    { label: "1–3 years", value: "Training for 1–3 years." },
                    { label: "Over 3 years", value: "Training for over 3 years." },
                    { label: "3+ sessions a week", value: "3 or more sessions a week." },
                ],
            },
        ],
    },
    {
        name: "competitionBackground",
        label: "Competition background",
        placeholder: "Bouts, tournaments and results, if any.",
        chips: [
            {
                label: "Common answers",
                suggestions: [
                    { label: "No bouts yet", value: "No bouts yet." },
                    { label: "Amateur MMA bouts", value: "Amateur MMA bouts." },
                    { label: "Boxing or kickboxing bouts", value: "Boxing or kickboxing bouts." },
                    { label: "Grappling tournaments", value: "Grappling tournaments." },
                    { label: "Professional bouts", value: "Professional bouts." },
                ],
            },
        ],
    },
    {
        name: "motivation",
        label: "Why do you want to join?",
        placeholder: "What you want to achieve at the academy.",
        chips: [
            {
                label: "Goals",
                suggestions: [
                    { label: "Turn professional", value: "I want to fight professionally." },
                    { label: "First amateur bout", value: "I want to get ready for my first amateur bout." },
                    { label: "Sharpen my technique", value: "I want to sharpen my technique." },
                    { label: "Structured training", value: "I want a structured training plan with coaches." },
                    { label: "Get fight fit", value: "I want to get fight fit." },
                ],
            },
        ],
    },
];

/**
 * The application an applicant sends to the academy, in three steps: the four answers the academy needs, an optional
 * step about their experience (common answers are one tap away), then a review. Every step stays in one form, so a
 * single submit sends it all. A coach then assesses the applicant in person.
 */
export function ApplicationForm({ today, previous, email }: ApplicationFormProps) {
    const toast = useToast();
    const form = useActionForm(submitApplicationAction, {
        id: "application",
        onSuccess: (state) => toast({ tone: "success", title: "Application sent", description: state.message }),
    });
    const { control, error } = form;
    const [weightClass, setWeightClass] = useState<WeightClass | "">(previous?.weightClass ?? "");
    const [background, setBackground] = useState<Record<BackgroundName, string>>({
        trainingBackground: previous?.trainingBackground ?? "",
        competitionBackground: previous?.competitionBackground ?? "",
        motivation: previous?.motivation ?? "",
    });
    const [summary, setSummary] = useState<SummarySection[]>([]);

    // The experience step is optional as a whole, so its fields don't each say "(optional)".
    const field = (name: keyof ApplicationInput, label: string, required = false) => ({ label, htmlFor: control(name).id, required, error: error(name) });

    const writeBackground = (name: BackgroundName, value: string) => {
        setBackground((current) => ({ ...current, [name]: value }));
        form.markEdited(name);
    };
    const pick = (name: BackgroundName, value: string) => {
        const next = appendSuggestion(background[name], value);
        if (next.length <= ADMISSION_LIMITS.background) writeBackground(name, next);
    };

    // The review step reads what is in the form right now, so it always matches what will be sent.
    const onStepChange = (stepId: string) => {
        const element = form.formProps.ref.current;
        if (stepId !== "review" || !element) return;
        const values = new FormData(element);
        setSummary(
            applicationSummary((name) => {
                const value = values.get(name);
                return typeof value === "string" ? value : null;
            }, email),
        );
    };

    return (
        <form {...form.formProps}>
            <FormSteps
                steps={STEPS}
                state={form.state}
                onStepChange={onStepChange}
                message={<FormMessage {...form.message} />}
                submit={
                    <SubmitButton size="lg" className="sm:h-9 sm:px-3.5 sm:text-sm" pending={form.pending} pendingLabel="Sending…">
                        <Send aria-hidden />
                        Send application
                    </SubmitButton>
                }
            >
                <FormStep id="about" className="flex flex-col gap-5">
                    <p className="flex min-w-0 items-center gap-2 text-sm text-fg-muted">
                        <Mail aria-hidden className="size-4 shrink-0" />
                        <span className="min-w-0 truncate">
                            Applying as <span className="font-medium text-fg">{email}</span>
                        </span>
                    </p>
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
                    </div>
                    <ChoiceGroup
                        id={control("weightClass").id}
                        name="weightClass"
                        legend="Weight class"
                        required
                        variant="compact"
                        columns={3}
                        options={WEIGHT_CLASS_OPTIONS}
                        value={weightClass}
                        onChange={setWeightClass}
                        hint={
                            <span className="inline-flex flex-wrap items-center gap-1">
                                The class you train or compete at.
                                <TermHint term="weightClass" />
                            </span>
                        }
                        error={error("weightClass")}
                    />
                </FormStep>

                <FormStep id="experience" description="Optional, but it helps your coach plan the assessment." className="flex flex-col gap-5">
                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                        <Field {...field("nationality", "Nationality")}>
                            <Input {...control("nationality")} defaultValue={previous?.nationality ?? ""} autoComplete="country-name" maxLength={ADMISSION_LIMITS.nationality} />
                        </Field>
                        <Field {...field("contactPhone", "Phone")}>
                            <Input {...control("contactPhone")} type="tel" defaultValue={previous?.contactPhone ?? ""} autoComplete="tel" maxLength={ADMISSION_LIMITS.contactPhone} />
                        </Field>
                    </div>
                    {BACKGROUND_FIELDS.map(({ name, label, placeholder, chips }) => (
                        <div key={name} className="flex flex-col gap-2">
                            <Field {...field(name, label)}>
                                <Textarea
                                    {...control(name)}
                                    rows={3}
                                    value={background[name]}
                                    onChange={(event) => writeBackground(name, event.target.value)}
                                    placeholder={placeholder}
                                    maxLength={ADMISSION_LIMITS.background}
                                />
                            </Field>
                            {chips.map((group) => (
                                <SuggestionChips key={group.label} label={group.label} suggestions={group.suggestions} onPick={(value) => pick(name, value)} />
                            ))}
                        </div>
                    ))}
                </FormStep>

                <FormStep id="review" description="Check your answers. The academy and your assessing coach will read them.">
                    <ApplicationReview sections={summary} />
                </FormStep>
            </FormSteps>
        </form>
    );
}

/** The answers on the review step, each step with a way back to change it. */
function ApplicationReview({ sections }: { sections: SummarySection[] }) {
    const { goTo } = useFormSteps();
    return (
        <div className="flex flex-col gap-4">
            {sections.map((section) => (
                <section key={section.step} aria-labelledby={`review-${section.step}`} className="rounded-lg border border-border">
                    <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5">
                        <h3 id={`review-${section.step}`} className="text-sm font-semibold text-fg">
                            {section.title}
                        </h3>
                        <Button variant="ghost" size="sm" onClick={() => goTo(section.step)} aria-label={`Edit ${section.title.toLowerCase()}`}>
                            <PenLine aria-hidden />
                            Edit
                        </Button>
                    </div>
                    <dl className="flex flex-col gap-3 px-4 py-3">
                        {section.items.map((item) => (
                            <div key={item.label} className="grid grid-cols-1 gap-x-6 gap-y-0.5 sm:grid-cols-[minmax(0,11rem)_minmax(0,1fr)]">
                                <dt className="text-[13px] text-fg-muted">{item.label}</dt>
                                <dd className={cn("min-w-0 text-sm break-words text-fg", item.long && "whitespace-pre-line")}>
                                    {item.value ?? <span className="text-fg-subtle">Not given</span>}
                                </dd>
                            </div>
                        ))}
                    </dl>
                </section>
            ))}
        </div>
    );
}
