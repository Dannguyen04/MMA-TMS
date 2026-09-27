import "server-only";

import { ApiError } from "@/lib/api/client";
import { ELIGIBILITY_REASONS, type EligibilityReason } from "@/lib/domain/medical-contract";

/**
 * Turns a failed medical write into what the form shows. Writes are never retried automatically: a create that timed
 * out may already be saved, and sending it again would add a second, append-only record.
 */

export interface MedicalWriteFailure {
    message: string;
    fieldErrors?: Record<string, string>;
}

export interface MedicalWriteErrorOptions {
    /** Service field paths (dot-joined, e.g. "restrictions.excludedJoints") → form field names. Longest prefix wins. */
    fields?: Record<string, string>;
    /** Conflict codes that belong to one form field, e.g. RECOVERY_PLAN_DATE_CONFLICT → "estimatedEndDate". */
    conflictFields?: Record<string, string>;
}

export const MAYBE_NOT_SAVED = "The medical service didn't confirm the change, so it may not have been saved. Reload the page to check before trying again.";
const PROBABLY_SAVED = "The change was probably saved, but the medical service's reply couldn't be read. Reload the page to check before trying again.";
const NOT_ASSIGNED = "The medical service refused this because you're no longer assigned to this fighter. Ask an admin to check your assignment.";
const VALIDATION = "The medical service didn't accept some of the details. Check the highlighted fields.";

const NOT_FOUND_MESSAGES: Record<string, string> = {
    FIGHTER_NOT_FOUND: "This fighter's profile no longer exists.",
    INJURY_NOT_FOUND: "This injury record no longer exists, or belongs to another fighter.",
    RECOVERY_PLAN_NOT_FOUND: "This recovery plan no longer exists.",
    MEDICAL_EXAMINATION_NOT_FOUND: "That examination no longer exists. Reload the page and choose it again.",
    MEDICAL_CLEARANCE_NOT_FOUND: "This clearance no longer exists.",
    MEDICAL_REVIEW_REQUEST_NOT_FOUND: "One of the review requests no longer exists. Reload the page and choose again.",
    MEDICAL_REFERENCE_NOT_FOUND: "Something this change refers to no longer exists. Reload the page and try again.",
};

const CONFLICT_MESSAGES: Record<string, string> = {
    INVALID_INJURY_STATUS_TRANSITION: "That status change isn't allowed. A resolved injury stays resolved; record a recurrence as a new injury.",
    INVALID_RECOVERY_PLAN_STATUS_TRANSITION: "This recovery plan is already closed, so its status can't change.",
    RECOVERY_PLAN_DATE_CONFLICT: "The end date can't be before the plan's start date.",
    EXAMINATION_NOT_ELIGIBLE_FOR_CLEARANCE:
        "A clearance must come from the fighter's current positive examination of the same scope, start no earlier than it and stay within its limits.",
    EXAMINATION_CORRECTION_CONFLICT: "Only the current examination of the same scope can be corrected. Someone may have recorded a newer one; reload the page.",
    REVIEW_REQUEST_NOT_RESOLVABLE: "One of the review requests is already closed, or was made after this examination. Reload the page and choose again.",
    MEDICAL_CLEARANCE_NOT_ACTIVE: "This clearance is no longer active, so there is nothing to revoke.",
    MEDICAL_RECORD_CONFLICT: "A matching record already exists — for example an active clearance of this type from the same examination.",
    MEDICAL_DATA_CONSTRAINT_CONFLICT: "The medical service rejected this change because it conflicts with the fighter's existing records. Reload the page and check them.",
};

interface ValidationIssue {
    path: (string | number)[];
    message: string;
}

function validationIssues(details: unknown): ValidationIssue[] {
    if (!Array.isArray(details)) return [];
    return details.flatMap((issue: unknown) => {
        if (typeof issue !== "object" || issue === null) return [];
        const { path, message } = issue as { path?: unknown; message?: unknown };
        if (typeof message !== "string") return [];
        return [{ path: Array.isArray(path) ? path.filter((part): part is string | number => typeof part === "string" || typeof part === "number") : [], message }];
    });
}

function sentence(text: string): string {
    const trimmed = text.trim();
    const capitalised = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
    return /[.!?]$/.test(capitalised) ? capitalised : `${capitalised}.`;
}

/** The form field for a service path: the longest mapped prefix, with any array indexes after it kept. */
function fieldFor(path: (string | number)[], fields: Record<string, string>): string | null {
    for (let length = path.length; length > 0; length -= 1) {
        const mapped = fields[path.slice(0, length).join(".")];
        if (mapped) return [mapped, ...path.slice(length)].join(".");
    }
    return null;
}

function fromValidation(error: ApiError, fields: Record<string, string>): MedicalWriteFailure {
    const fieldErrors: Record<string, string> = {};
    const unplaced: string[] = [];
    for (const issue of validationIssues(error.details)) {
        const field = fieldFor(issue.path, fields);
        if (field) fieldErrors[field] ??= sentence(issue.message);
        else unplaced.push(sentence(issue.message));
    }
    const message = [VALIDATION, ...new Set(unplaced)].join(" ");
    return Object.keys(fieldErrors).length > 0 ? { message, fieldErrors } : { message };
}

/** What to show for a failed medical write. Anything that isn't an API error is a bug and is rethrown. */
export function medicalWriteFailure(error: unknown, options: MedicalWriteErrorOptions = {}): MedicalWriteFailure {
    if (!(error instanceof ApiError)) throw error;
    switch (error.kind) {
        case "unauthorized":
            return { message: "Your session has expired. Sign in again, then check whether the change was saved." };
        case "network":
        case "timeout":
            return { message: MAYBE_NOT_SAVED };
        case "invalid_response":
            return { message: PROBABLY_SAVED };
        case "http":
            break;
    }

    const status = error.status ?? 0;
    if (status === 422 || status === 400) return fromValidation(error, options.fields ?? {});
    if (status === 403) return { message: NOT_ASSIGNED };
    if (status === 404) return { message: NOT_FOUND_MESSAGES[error.code] ?? "The record this change refers to no longer exists. Reload the page." };
    if (status === 409) {
        const message = CONFLICT_MESSAGES[error.code] ?? sentence(error.message);
        const field = options.conflictFields?.[error.code];
        return field ? { message, fieldErrors: { [field]: message } } : { message };
    }
    if (status === 429) return { message: "Too many changes in a short time. Wait a moment, then reload the page and try again." };
    if (status >= 500) return { message: MAYBE_NOT_SAVED };
    return { message: sentence(error.message) };
}

/* ─── Training starts ─────────────────────────────────────────────────────── */

const knownReasons = new Set<string>(ELIGIBILITY_REASONS);

/**
 * Why the service refused to start a training session (409 TRAINING_MEDICAL_ELIGIBILITY_REQUIRED), or null for any
 * other error. Reasons the interface doesn't know yet are left out.
 */
export function trainingEligibilityReasons(error: unknown): EligibilityReason[] | null {
    if (!(error instanceof ApiError) || error.status !== 409 || error.code !== "TRAINING_MEDICAL_ELIGIBILITY_REQUIRED") return null;
    const reasons = (error.details as { reasons?: unknown } | undefined)?.reasons;
    if (!Array.isArray(reasons)) return [];
    return reasons.filter((reason): reason is EligibilityReason => typeof reason === "string" && knownReasons.has(reason));
}
