import type { WeightClass } from "@/lib/domain/types";
import { WEIGHT_CLASS_LABELS, WEIGHT_CLASS_LIMIT_KG, WEIGHT_CLASS_ORDER } from "@/lib/domain/labels";
import { formatDate, isDateKey } from "@/lib/format";

/*
 * Pure pieces of the application form: the weight-class choices and the summary on its review step.
 */

export type ApplicationStepId = "about" | "experience" | "review";

/** "Up to 70.3 kg", the class's upper limit at the weigh-in. */
export function weightClassLimit(weightClass: WeightClass): string {
    return `Up to ${WEIGHT_CLASS_LIMIT_KG[weightClass]} kg`;
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

/** What the review step shows: each step's answers, in the words of the form. */
export function applicationSummary(answer: Answers, email: string): SummarySection[] {
    const name = [given(answer("firstName")), given(answer("lastName"))].filter(Boolean).join(" ");
    const dateOfBirth = given(answer("dateOfBirth"));
    const weightClass = given(answer("weightClass"));
    return [
        {
            step: "about",
            title: "About you",
            items: [
                { label: "Name", value: name || null },
                { label: "Date of birth", value: dateOfBirth && isDateKey(dateOfBirth) ? formatDate(dateOfBirth) : null },
                {
                    label: "Weight class",
                    value: weightClass && isWeightClass(weightClass) ? `${WEIGHT_CLASS_LABELS[weightClass]} · ${weightClassLimit(weightClass).toLowerCase()}` : null,
                },
                { label: "Email", value: email },
            ],
        },
        {
            step: "experience",
            title: "Your experience",
            items: [
                { label: "Nationality", value: given(answer("nationality")) },
                { label: "Phone", value: given(answer("contactPhone")) },
                { label: "Training background", value: given(answer("trainingBackground")), long: true },
                { label: "Competition background", value: given(answer("competitionBackground")), long: true },
                { label: "Why you want to join", value: given(answer("motivation")), long: true },
            ],
        },
    ];
}
