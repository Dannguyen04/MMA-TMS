import type { Suggestion } from "@/components/ui/suggestion-chips";
import { ADMISSION_LIMITS, type AssessmentConclusion } from "@/lib/domain/admissions";

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

export const CRITERION_PRESETS: CriterionPreset[] = [
    { label: "Conditioning — 3×3-min pads", criterionName: "Conditioning", method: "Three 3-minute pad rounds" },
    { label: "Striking technique — shadow + pads", criterionName: "Striking technique", method: "Shadow boxing, then pads" },
    { label: "Defence — partner drill", criterionName: "Defence", method: "Partner drill" },
    { label: "Footwork — ring movement", criterionName: "Footwork", method: "Ring movement drill" },
    { label: "Grappling basics — positional drill", criterionName: "Grappling basics", method: "Positional drill" },
    { label: "Attitude & coachability — observation", criterionName: "Attitude and coachability", method: "Observed through the session" },
];

/** Presets the coach hasn't added yet (by criterion name, ignoring case and spacing). */
export function unusedPresets(criteria: { criterionName: string }[]): CriterionPreset[] {
    const used = new Set(criteria.map((criterion) => normalise(criterion.criterionName)));
    return CRITERION_PRESETS.filter((preset) => !used.has(normalise(preset.criterionName)));
}

/** Closing lines the coach can add to the summary, matching the result they chose. */
export const CLOSING_LINES: Record<AssessmentConclusion, Suggestion[]> = {
    pass: [
        { label: "Ready for the programme", value: "Ready to start the fighter programme." },
        { label: "Good base, needs conditioning", value: "Good technical base; conditioning needs work." },
        { label: "Coachable", value: "Listens well and applies feedback quickly." },
    ],
    fail: [
        { label: "Not ready yet", value: "Not ready for the fighter programme yet." },
        { label: "Conditioning too low", value: "Conditioning is below the level the programme needs." },
        { label: "Reapply later", value: "Welcome to reapply after more training." },
    ],
};

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
