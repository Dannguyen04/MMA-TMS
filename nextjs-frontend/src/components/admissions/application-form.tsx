"use client";

import { Mail, PenLine, Send } from "lucide-react";
import { useMemo, useState } from "react";

import { TermHint } from "@/components/domain/term-hint";
import { useLocale, useT } from "@/components/i18n/locale-provider";
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
import { WEIGHT_CLASS_ORDER, weightClassLabel } from "@/lib/domain/labels";
import type { WeightClass } from "@/lib/domain/types";
import type { Locale } from "@/lib/i18n/config";
import type { MessageKey, Translator } from "@/lib/i18n/translate";
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

const steps = (t: Translator): (FormStepDefinition & { id: ApplicationStepId })[] => [
    { id: "about", label: t("screens.misc.apply.step.about"), description: t("screens.misc.apply.step.aboutDescription") },
    { id: "experience", label: t("screens.misc.apply.step.experience"), description: t("screens.misc.apply.step.experienceDescription"), optional: true },
    { id: "review", label: t("screens.misc.apply.step.review") },
];

const weightClassOptions = (locale: Locale): ChoiceOption<WeightClass>[] =>
    WEIGHT_CLASS_ORDER.map((value) => ({
        value,
        label: weightClassLabel(value, locale),
        description: weightClassLimit(value, locale),
    }));

type BackgroundName = "trainingBackground" | "competitionBackground" | "motivation";

/** A suggestion chip whose label and the text it adds are two messages: `<key>` and `<key>Value`. */
const answer = (t: Translator, key: string): Suggestion => ({ label: t(key as MessageKey), value: t(`${key}Value` as MessageKey) });
const chip = (id: string) => `screens.misc.apply.chips.${id}`;

const backgroundFields = (t: Translator): { name: BackgroundName; label: string; placeholder: string; chips: { label: string; suggestions: Suggestion[] }[] }[] => [
    {
        name: "trainingBackground",
        label: t("applicant.form.trainingBackground"),
        placeholder: t("applicant.form.trainingPlaceholder"),
        chips: [
            {
                label: t("screens.misc.apply.chips.disciplines"),
                suggestions: ["boxing", "muayThai", "kickboxing", "bjj", "wrestling", "judo"].map((id) => ({ label: t(chip(id) as MessageKey) })),
            },
            {
                label: t("screens.misc.apply.chips.howLong"),
                suggestions: ["underOne", "oneToThree", "overThree", "threePerWeek"].map((id) => answer(t, chip(id))),
            },
        ],
    },
    {
        name: "competitionBackground",
        label: t("applicant.form.competitionBackground"),
        placeholder: t("applicant.form.competitionPlaceholder"),
        chips: [
            {
                label: t("screens.misc.apply.chips.commonAnswers"),
                suggestions: ["noBouts", "amateurMma", "boxingBouts", "grappling", "professional"].map((id) => answer(t, chip(id))),
            },
        ],
    },
    {
        name: "motivation",
        label: t("applicant.form.motivation"),
        placeholder: t("applicant.form.motivationPlaceholder"),
        chips: [
            {
                label: t("screens.misc.apply.chips.goals"),
                suggestions: ["turnPro", "firstAmateur", "sharpen", "structured", "fightFit"].map((id) => answer(t, chip(id))),
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
    const t = useT();
    const locale = useLocale();
    const toast = useToast();
    const form = useActionForm(submitApplicationAction, {
        id: "application",
        onSuccess: (state) => toast({ tone: "success", title: t("applicant.form.toastTitle"), description: state.message }),
    });
    const { control, error } = form;
    const [weightClass, setWeightClass] = useState<WeightClass | "">(previous?.weightClass ?? "");
    const [background, setBackground] = useState<Record<BackgroundName, string>>({
        trainingBackground: previous?.trainingBackground ?? "",
        competitionBackground: previous?.competitionBackground ?? "",
        motivation: previous?.motivation ?? "",
    });
    const [summary, setSummary] = useState<SummarySection[]>([]);
    const { stepList, weightClasses, fields } = useMemo(() => ({ stepList: steps(t), weightClasses: weightClassOptions(locale), fields: backgroundFields(t) }), [t, locale]);

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
            applicationSummary(
                (name) => {
                    const value = values.get(name);
                    return typeof value === "string" ? value : null;
                },
                email,
                locale,
            ),
        );
    };

    return (
        <form {...form.formProps}>
            <FormSteps
                steps={stepList}
                state={form.state}
                onStepChange={onStepChange}
                message={<FormMessage {...form.message} />}
                submit={
                    <SubmitButton size="lg" className="sm:h-9 sm:px-3.5 sm:text-sm" pending={form.pending} pendingLabel={t("applicant.form.sending")}>
                        <Send aria-hidden />
                        {t("applicant.form.submit")}
                    </SubmitButton>
                }
            >
                <FormStep id="about" className="flex flex-col gap-5">
                    <p className="flex min-w-0 items-center gap-2 text-sm text-fg-muted">
                        <Mail aria-hidden className="size-4 shrink-0" />
                        <span className="min-w-0 truncate">
                            {t("screens.misc.apply.applyingAs")} <span className="font-medium text-fg">{email}</span>
                        </span>
                    </p>
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
                    </div>
                    <ChoiceGroup
                        id={control("weightClass").id}
                        name="weightClass"
                        legend={t("applicant.form.weightClass")}
                        required
                        variant="compact"
                        columns={3}
                        options={weightClasses}
                        value={weightClass}
                        onChange={setWeightClass}
                        hint={
                            <span className="inline-flex flex-wrap items-center gap-1">
                                {t("screens.misc.apply.weightClassHint")}
                                <TermHint term="weightClass" />
                            </span>
                        }
                        error={error("weightClass")}
                    />
                </FormStep>

                <FormStep id="experience" description={t("screens.misc.apply.experienceDescription")} className="flex flex-col gap-5">
                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                        <Field {...field("nationality", t("applicant.form.nationality"))}>
                            <Input {...control("nationality")} defaultValue={previous?.nationality ?? ""} autoComplete="country-name" maxLength={ADMISSION_LIMITS.nationality} />
                        </Field>
                        <Field {...field("contactPhone", t("applicant.form.phone"))}>
                            <Input {...control("contactPhone")} type="tel" defaultValue={previous?.contactPhone ?? ""} autoComplete="tel" maxLength={ADMISSION_LIMITS.contactPhone} />
                        </Field>
                    </div>
                    {fields.map(({ name, label, placeholder, chips }) => (
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

                <FormStep id="review" description={t("screens.misc.apply.reviewDescription")}>
                    <ApplicationReview sections={summary} t={t} />
                </FormStep>
            </FormSteps>
        </form>
    );
}

/** The answers on the review step, each step with a way back to change it. */
function ApplicationReview({ sections, t }: { sections: SummarySection[]; t: Translator }) {
    const { goTo } = useFormSteps();
    return (
        <div className="flex flex-col gap-4">
            {sections.map((section) => (
                <section key={section.step} aria-labelledby={`review-${section.step}`} className="rounded-lg border border-border">
                    <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5">
                        <h3 id={`review-${section.step}`} className="text-sm font-semibold text-fg">
                            {section.title}
                        </h3>
                        <Button variant="ghost" size="sm" onClick={() => goTo(section.step)} aria-label={t("screens.misc.apply.editSection", { section: section.title.toLowerCase() })}>
                            <PenLine aria-hidden />
                            {t("screens.misc.apply.edit")}
                        </Button>
                    </div>
                    <dl className="flex flex-col gap-3 px-4 py-3">
                        {section.items.map((item) => (
                            <div key={item.label} className="grid grid-cols-1 gap-x-6 gap-y-0.5 sm:grid-cols-[minmax(0,11rem)_minmax(0,1fr)]">
                                <dt className="text-[13px] text-fg-muted">{item.label}</dt>
                                <dd className={cn("min-w-0 text-sm break-words text-fg", item.long && "whitespace-pre-line")}>
                                    {item.value ?? <span className="text-fg-subtle">{t("screens.misc.admissions.notGiven")}</span>}
                                </dd>
                            </div>
                        ))}
                    </dl>
                </section>
            ))}
        </div>
    );
}
