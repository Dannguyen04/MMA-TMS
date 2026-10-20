import type { TrainingType } from "./types";

/** The training service's template groups (`session_template_category`). */
export const SESSION_TEMPLATE_CATEGORIES = ["TECHNIQUE", "SPARRING", "CONDITIONING", "TACTICS"] as const;
export type SessionTemplateCategory = (typeof SESSION_TEMPLATE_CATEGORIES)[number];

export interface SessionTemplateStep {
    name: string;
    detail: string;
}

/** A lesson-plan template a coach can start a session from, with its text already in the viewer's language. */
export interface SessionTemplate {
    id: string;
    code: string;
    category: SessionTemplateCategory;
    type: TrainingType;
    durationMin: number;
    /** Planned intensity, RPE 1–10. Only the demo session form has a field for it. */
    targetRpe: number;
    name: string;
    purpose: string;
    rationale: string;
    steps: SessionTemplateStep[];
}

/** The session form fields a template fills in. */
export interface TemplateFormFields {
    title: string;
    type: TrainingType;
    durationMin: string;
    targetRpe: number;
    notes: string;
    location: string;
}

/** Longest session note the training service accepts. */
export const SESSION_NOTES_MAX_LENGTH = 1000;

/** The template's steps as numbered lines, cut to what the notes field accepts. */
export function sessionTemplateNotes(steps: readonly SessionTemplateStep[]): string {
    return steps
        .map((step, index) => `${index + 1}. ${step.name}: ${step.detail}`)
        .join("\n")
        .slice(0, SESSION_NOTES_MAX_LENGTH);
}

/**
 * The form values after choosing a template: title, type, duration, target RPE and notes come from the template.
 * The location follows the type unless the coach typed another one. Everything else (fighter, plan, date, time,
 * exercises) is left as it is.
 */
export function applySessionTemplate<T extends TemplateFormFields>(
    values: T,
    template: SessionTemplate,
    defaultLocationFor: (type: TrainingType) => string,
): T {
    const locationIsDefault = !values.location.trim() || values.location === defaultLocationFor(values.type);
    return {
        ...values,
        title: template.name,
        type: template.type,
        durationMin: String(template.durationMin),
        targetRpe: template.targetRpe,
        notes: sessionTemplateNotes(template.steps),
        location: locationIsDefault ? defaultLocationFor(template.type) : values.location,
    };
}
