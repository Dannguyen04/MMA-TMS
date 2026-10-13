import "server-only";

import { apiWriteFailure, maybeNotSavedMessage, type ServiceErrorMessages, type WriteErrorOptions, type WriteFailure } from "./api-write-errors";

export { isUnconfirmedWrite } from "./api-write-errors";

/** How the medical service's refusals read on the doctor's forms; the status rules are shared (`api-write-errors.ts`). */

export type MedicalWriteFailure = WriteFailure;
export type MedicalWriteErrorOptions = WriteErrorOptions;

export const MAYBE_NOT_SAVED = maybeNotSavedMessage("medical service");

/**
 * After a write the service didn't confirm, the doctor's forms read the record again before saying anything. These
 * are what they say when that read doesn't find the record, or can't be made. Neither asks for a reload: the form
 * keeps every answer, and trying again checks the record first.
 */
export const unconfirmedWriteMessages = (record: string) => ({
    notFound: `The medical service didn't confirm the ${record}, and it isn't on the fighter's record. Your answers are still here: try again.`,
    unchecked: `The medical service didn't answer, so we couldn't check whether the ${record} was saved. Your answers are still here. Try again: the record is checked before anything is sent again.`,
});

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

const MEDICAL_ERRORS: ServiceErrorMessages = {
    service: "medical service",
    forbidden: "The medical service refused this because you're no longer assigned to this fighter. Ask an admin to check your assignment.",
    notFound: "The record this change refers to no longer exists. Reload the page.",
    codes: { ...NOT_FOUND_MESSAGES, ...CONFLICT_MESSAGES },
};

/** What to show for a failed medical write. Anything that isn't an API error is a bug and is rethrown. */
export function medicalWriteFailure(error: unknown, options: MedicalWriteErrorOptions = {}): MedicalWriteFailure {
    return apiWriteFailure(error, MEDICAL_ERRORS, options);
}
