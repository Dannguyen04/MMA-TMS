import type { WeightClass } from "@/lib/domain/types";
import { WEIGHT_CLASS_LIMIT_KG, WEIGHT_CLASS_ORDER, weightClassLabel } from "@/lib/domain/labels";
import { formatDate, isDateKey } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";
import { createTranslator } from "@/lib/i18n/translate";

/*
 * Pure pieces of the application form: the weight-class choices and the summary on its review step.
 */

export type ApplicationStepId = "about" | "experience" | "review";

/** "Up to 70.3 kg", the class's upper limit at the weigh-in, in the viewer's language (English when omitted). */
export function weightClassLimit(weightClass: WeightClass, locale: Locale = "en"): string {
    return createTranslator(locale)("screens.misc.apply.upToKg", { kg: WEIGHT_CLASS_LIMIT_KG[weightClass] });
}

const isWeightClass = (value: string): value is WeightClass => (WEIGHT_CLASS_ORDER as string[]).includes(value);

export interface SummaryItem {
    label: string;
    /** null when the applicant left it empty. */
    value: string | null;
    /** Long answers keep their line breaks. */
    long?: boolean;
}

export interface SummarySection {
    step: Exclude<ApplicationStepId, "review">;
    title: string;
    items: SummaryItem[];
}

/** Reads one answer from the form; anything missing or blank counts as not given. */
type Answers = (name: string) => string | null | undefined;

const given = (value: string | null | undefined) => {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
};

/** What the review step shows: each step's answers, in the words of the form and the viewer's language. */
export function applicationSummary(answer: Answers, email: string, locale: Locale = "en"): SummarySection[] {
    const t = createTranslator(locale);
    const name = [given(answer("firstName")), given(answer("lastName"))].filter(Boolean).join(" ");
    const dateOfBirth = given(answer("dateOfBirth"));
    const weightClass = given(answer("weightClass"));
    return [
        {
            step: "about",
            title: t("screens.misc.apply.step.about"),
            items: [
                { label: t("screens.misc.apply.name"), value: name || null },
                { label: t("applicant.form.dateOfBirth"), value: dateOfBirth && isDateKey(dateOfBirth) ? formatDate(dateOfBirth, locale) : null },
                {
                    label: t("applicant.form.weightClass"),
                    value:
                        weightClass && isWeightClass(weightClass) ? `${weightClassLabel(weightClass, locale)} · ${weightClassLimit(weightClass, locale).toLowerCase()}` : null,
                },
                { label: t("auth.email"), value: email },
            ],
        },
        {
            step: "experience",
            title: t("screens.misc.apply.step.experience"),
            items: [
                { label: t("applicant.form.nationality"), value: given(answer("nationality")) },
                { label: t("applicant.form.phone"), value: given(answer("contactPhone")) },
                { label: t("applicant.form.trainingBackground"), value: given(answer("trainingBackground")), long: true },
                { label: t("applicant.form.competitionBackground"), value: given(answer("competitionBackground")), long: true },
                { label: t("screens.misc.apply.whyJoin"), value: given(answer("motivation")), long: true },
            ],
        },
    ];
}
