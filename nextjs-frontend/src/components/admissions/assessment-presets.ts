import type { Suggestion } from "@/components/ui/suggestion-chips";
import { ADMISSION_LIMITS, type AssessmentConclusion } from "@/lib/domain/admissions";
import type { Locale } from "@/lib/i18n/config";
import { createTranslator, type MessageKey } from "@/lib/i18n/translate";

/*
 * Starting points for the coach's entrance assessment. They only fill in what the coach would type anyway; the
 * observation and the conclusion are always the coach's own.
 */

export interface CriterionPreset {
    /** The chip: the criterion and how it is usually tested. */
    label: string;
    criterionName: string;
    method: string;
}

const PRESET_IDS = ["conditioning", "striking", "defence", "footwork", "grappling", "attitude"] as const;

/** The common criteria in the viewer's language (English when omitted). */
export function criterionPresets(locale: Locale = "en"): CriterionPreset[] {
    const t = createTranslator(locale);
    return PRESET_IDS.map((id) => ({
        label: t(`screens.misc.assessment.preset.${id}.label`),
        criterionName: t(`screens.misc.assessment.preset.${id}.name`),
        method: t(`screens.misc.assessment.preset.${id}.method`),
    }));
}

export const CRITERION_PRESETS: CriterionPreset[] = criterionPresets();

/** Presets the coach hasn't added yet (by criterion name, ignoring case and spacing). */
export function unusedPresets(criteria: { criterionName: string }[], locale: Locale = "en"): CriterionPreset[] {
    const used = new Set(criteria.map((criterion) => normalise(criterion.criterionName)));
    return criterionPresets(locale).filter((preset) => !used.has(normalise(preset.criterionName)));
}

const CLOSING_IDS: Record<AssessmentConclusion, readonly string[]> = {
    pass: ["ready", "goodBase", "coachable"],
    fail: ["notReady", "conditioning", "reapply"],
};

/** Closing lines the coach can add to the summary, matching the result they chose, in the viewer's language. */
export function closingLines(locale: Locale = "en"): Record<AssessmentConclusion, Suggestion[]> {
    const t = createTranslator(locale);
    const lines = (conclusion: AssessmentConclusion) =>
        CLOSING_IDS[conclusion].map((id) => {
            const key = `screens.misc.assessment.closing.${conclusion}.${id}`;
            return { label: t(key as MessageKey), value: t(`${key}Value` as MessageKey) };
        });
    return { pass: lines("pass"), fail: lines("fail") };
}

export const CLOSING_LINES: Record<AssessmentConclusion, Suggestion[]> = closingLines();

/** A criterion as the form holds it: every field is the text typed so far. */
export interface CriterionDraft {
    criterionName: string;
    observation: string;
    value: string;
    unit: string;
}

const normalise = (text: string) => text.trim().replace(/\s+/g, " ").toLowerCase();
const oneLine = (text: string) => text.trim().replace(/\s+/g, " ");
const sentence = (text: string) => (/[.!?]$/.test(text) ? text : `${text}.`);

/** Adds a closing line to the summary on a line of its own, without adding it twice. */
export function appendLine(current: string, line: string): string {
    const text = current.trimEnd();
    if (!text) return line;
    if (text.toLowerCase().includes(line.toLowerCase())) return current;
    return `${text}\n${line}`;
}

/**
 * A first draft of the summary, one line per criterion the coach has written an observation for, e.g.
 * "Conditioning (3 rounds): Kept the pace, faded late." It never invents a judgement and stops before the
 * summary's length limit; an empty result means there is nothing to draft from yet.
 */
export function draftAssessmentSummary(criteria: CriterionDraft[], max: number = ADMISSION_LIMITS.summary): string {
    let draft = "";
    for (const criterion of criteria) {
        const name = oneLine(criterion.criterionName);
        const observation = oneLine(criterion.observation);
        if (!name || !observation) continue;
        const value = criterion.value.trim();
        const unit = oneLine(criterion.unit);
        const measured = value ? ` (${unit ? `${value} ${unit}` : value})` : "";
        const line = `${name}${measured}: ${sentence(observation)}`;
        const next = draft ? `${draft}\n${line}` : line;
        if (next.length > max) break;
        draft = next;
    }
    return draft;
}
