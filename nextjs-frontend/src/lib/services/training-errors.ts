import "server-only";

import { ApiError } from "@/lib/api/client";
import { eligibilityReasonsFrom, type EligibilityReason } from "@/lib/domain/medical-contract";
import type { Translator } from "@/lib/i18n/translate";
import { apiWriteFailure, type ServiceErrorMessages, type WriteErrorOptions, type WriteFailure } from "./api-write-errors";

/** How the training service's refusals read on the coach's forms; the status rules are shared (`api-write-errors.ts`). */

const TRAINING_ERRORS: ServiceErrorMessages = {
    service: "training service",
    forbidden: "The training service refused this because the fighter is no longer on your roster. Ask an admin to check your assignment.",
    notFound: "The training record this change refers to no longer exists. Reload the page.",
    codes: {
        TRAINING_PLAN_NOT_FOUND: "This training plan no longer exists.",
        TRAINING_SESSION_NOT_FOUND: "This session no longer exists.",
        EXERCISE_NOT_FOUND: "That exercise is no longer in the library. Reload the page and choose another.",
        PLAN_EXERCISE_NOT_FOUND: "That exercise is no longer on the plan. Reload the page.",
        REFERENCED_ENTITY_NOT_FOUND: "Something this change refers to no longer exists. Reload the page and try again.",
        INVALID_SESSION_STATUS_TRANSITION: "The session has already moved on, so that change isn't possible any more. Reload the page.",
        INVALID_PLAN_STATUS_TRANSITION: "The plan can't move to that status from where it is now.",
        INVALID_SESSION_PLAN: "Sessions can only join a draft or active plan.",
        FIGHTER_PLAN_MISMATCH: "That plan belongs to another fighter.",
        INVALID_SESSION_PLAN_REFERENCE: "That plan no longer exists. Choose another plan or none.",
        INVALID_PLAN_DATE_RANGE: "The end date must be on or after the start date.",
        PLAN_STATE_CONFLICT: "Someone changed this plan at the same time. Reload the page and try again.",
        SESSION_STATE_CONFLICT: "Someone changed this session at the same time. Reload the page and try again.",
        TRAINING_MEDICAL_ELIGIBILITY_REQUIRED: "The fighter isn't medically cleared for this training right now. Every fighter needs a baseline examination and a valid clearance first.",
        TRAINING_SUSPENSION_ACTIVE: "The fighter is suspended and this kind of session is blocked. Change the session type or the date.",
        TRAINING_CONFLICT: "This conflicts with the fighter's existing training. Reload the page and check it.",
        TRAINING_CHECK_VIOLATION: "The training service rejected some of the values. Check the form and try again.",
        TRAINING_INVARIANT_CONFLICT: "The training service rejected this change because the record changed. Reload the page and try again.",
    },
};

function getTrainingErrors(t?: Translator): ServiceErrorMessages {
    if (!t) return TRAINING_ERRORS;
    return {
        service: t("training.error.service"),
        forbidden: t("training.error.forbidden"),
        notFound: t("training.error.notFound"),
        codes: {
            TRAINING_PLAN_NOT_FOUND: t("training.error.planNotFound"),
            TRAINING_SESSION_NOT_FOUND: t("training.error.sessionNotFound"),
            EXERCISE_NOT_FOUND: t("training.error.exerciseNotFound"),
            PLAN_EXERCISE_NOT_FOUND: t("training.error.planExerciseNotFound"),
            REFERENCED_ENTITY_NOT_FOUND: t("training.error.referencedNotFound"),
            INVALID_SESSION_STATUS_TRANSITION: t("training.error.invalidSessionStatus"),
            INVALID_PLAN_STATUS_TRANSITION: t("training.error.invalidPlanStatus"),
            INVALID_SESSION_PLAN: t("training.error.invalidSessionPlan"),
            FIGHTER_PLAN_MISMATCH: t("training.error.fighterPlanMismatch"),
            INVALID_SESSION_PLAN_REFERENCE: t("training.error.invalidSessionPlanRef"),
            INVALID_PLAN_DATE_RANGE: t("training.error.invalidPlanDateRange"),
            PLAN_STATE_CONFLICT: t("training.error.planStateConflict"),
            SESSION_STATE_CONFLICT: t("training.error.sessionStateConflict"),
            TRAINING_MEDICAL_ELIGIBILITY_REQUIRED: t("training.error.medicalEligibilityRequired"),
            TRAINING_SUSPENSION_ACTIVE: t("training.error.suspensionActive"),
            TRAINING_CONFLICT: t("training.error.trainingConflict"),
            TRAINING_CHECK_VIOLATION: t("training.error.checkViolation"),
            TRAINING_INVARIANT_CONFLICT: t("training.error.invariantConflict"),
        },
    };
}

/** What to show for a failed training write. Anything that isn't an API error is a bug and is rethrown. */
export function trainingWriteFailure(error: unknown, options: WriteErrorOptions = {}, t?: Translator): WriteFailure {
    return apiWriteFailure(error, getTrainingErrors(t), options);
}

/**
 * Why the service refused to start a training session (409 TRAINING_MEDICAL_ELIGIBILITY_REQUIRED), or null for any
 * other error. A reason the interface doesn't know yet reads as "Other medical reason" rather than disappearing.
 */
export function trainingEligibilityReasons(error: unknown): EligibilityReason[] | null {
    if (!(error instanceof ApiError) || error.status !== 409 || error.code !== "TRAINING_MEDICAL_ELIGIBILITY_REQUIRED") return null;
    const reasons = (error.details as { reasons?: unknown } | undefined)?.reasons;
    if (!Array.isArray(reasons)) return [];
    return eligibilityReasonsFrom(reasons.filter((reason): reason is string => typeof reason === "string"));
}
