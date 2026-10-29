import "server-only";

import { ApiError } from "@/lib/api/client";
import { eligibilityReasonsFrom, type EligibilityReason } from "@/lib/domain/medical-contract";
import { formatShortDate } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";
import { createTranslator, type MessageKey, type Translator } from "@/lib/i18n/translate";
import { apiWriteFailure, type ServiceErrorMessages, type WriteErrorOptions, type WriteFailure } from "./api-write-errors";

export interface GradedReturnInfo {
    ceiling: 3 | 4;
    fullReturnOn: string;
}

export interface TrainingBlockingSuspension {
    suspensionId?: string;
    reason: string;
    endsOn: string;
    requiresClearance: boolean;
    gradedReturn?: GradedReturnInfo | null;
}

export type SuspensionReason = "KO" | "TKO" | "DQ" | "MANDATORY_REST" | "MEDICAL" | "OTHER";

const SUSPENSION_REASON_MESSAGE_KEYS: Record<SuspensionReason, MessageKey> = {
    KO: "suspension.reason.KO",
    TKO: "suspension.reason.TKO",
    DQ: "suspension.reason.DQ",
    MANDATORY_REST: "suspension.reason.MANDATORY_REST",
    MEDICAL: "suspension.reason.MEDICAL",
    OTHER: "suspension.reason.OTHER",
};

function isSuspensionReason(value: string): value is SuspensionReason {
    return Object.prototype.hasOwnProperty.call(SUSPENSION_REASON_MESSAGE_KEYS, value);
}

export function suspensionReasonLabel(rawReason: string, t?: Translator): string {
    const key = isSuspensionReason(rawReason)
        ? SUSPENSION_REASON_MESSAGE_KEYS[rawReason]
        : SUSPENSION_REASON_MESSAGE_KEYS.OTHER;
    const translator = t ?? createTranslator("en");
    return translator(key);
}

/**
 * When a fighter has multiple blocking suspensions, chooses which one to feature:
 * suspensions without graded return (active/blocking) take precedence over graded returns;
 * within the same group, the one with the latest endsOn is chosen.
 */
export function pickPrimarySuspension(suspensions: readonly TrainingBlockingSuspension[]): TrainingBlockingSuspension | null {
    if (suspensions.length === 0) return null;
    if (suspensions.length === 1) return suspensions[0];

    const sorted = [...suspensions].sort((a, b) => {
        const aHasGraded = Boolean(a.gradedReturn);
        const bHasGraded = Boolean(b.gradedReturn);
        if (aHasGraded !== bHasGraded) {
            return aHasGraded ? 1 : -1;
        }
        return b.endsOn.localeCompare(a.endsOn);
    });
    return sorted[0];
}

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
        TRAINING_SUSPENSION_ACTIVE: "The fighter has an active suspension that blocks this training session type.",
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
            TRAINING_SUSPENSION_ACTIVE: t("training.error.suspensionActiveGeneral"),
            TRAINING_CONFLICT: t("training.error.trainingConflict"),
            TRAINING_CHECK_VIOLATION: t("training.error.checkViolation"),
            TRAINING_INVARIANT_CONFLICT: t("training.error.invariantConflict"),
        },
    };
}

function formatSuspensionMessage(suspension: TrainingBlockingSuspension, t?: Translator): string {
    const translator = t ?? createTranslator("en");
    const locale: Locale = translator.locale ?? "en";
    const reason = suspensionReasonLabel(suspension.reason, translator);

    if (suspension.gradedReturn) {
        const fullReturnOn = formatShortDate(suspension.gradedReturn.fullReturnOn, locale);
        return translator("training.error.suspensionGradedReturn", {
            reason,
            ceiling: suspension.gradedReturn.ceiling,
            fullReturnOn,
        });
    }

    const endsOn = formatShortDate(suspension.endsOn, locale);
    if (suspension.requiresClearance) {
        return translator("training.error.suspensionActiveRequiresClearance", { reason, endsOn });
    }
    return translator("training.error.suspensionActiveWithReason", { reason, endsOn });
}

/** What to show for a failed training write. Anything that isn't an API error is a bug and is rethrown. */
export function trainingWriteFailure(error: unknown, options: WriteErrorOptions = {}, t?: Translator): WriteFailure {
    if (error instanceof ApiError && error.status === 409) {
        if (error.code === "TRAINING_SUSPENSION_ACTIVE") {
            const suspensions = trainingSuspensions(error);
            const primary = suspensions ? pickPrimarySuspension(suspensions) : null;
            if (primary) {
                const message = formatSuspensionMessage(primary, t);
                const field = options.conflictFields?.["TRAINING_SUSPENSION_ACTIVE"];
                return field ? { message, fieldErrors: { [field]: message } } : { message };
            }
        } else if (error.code === "TRAINING_MEDICAL_ELIGIBILITY_REQUIRED") {
            const base = apiWriteFailure(error, getTrainingErrors(t), options);
            const suspensions = trainingSuspensions(error);
            const primary = suspensions ? pickPrimarySuspension(suspensions) : null;
            if (primary) {
                const suspensionMsg = formatSuspensionMessage(primary, t);
                const combined = `${base.message} ${suspensionMsg}`;
                return { ...base, message: combined };
            }
            return base;
        }
    }
    return apiWriteFailure(error, getTrainingErrors(t), options);
}

/**
 * Suspensions that block a training session or transition (409 TRAINING_SUSPENSION_ACTIVE or
 * combined 409 TRAINING_MEDICAL_ELIGIBILITY_REQUIRED with details.suspensions).
 * Malformed entries are discarded safely.
 */
export function trainingSuspensions(error: unknown): TrainingBlockingSuspension[] | null {
    if (!(error instanceof ApiError) || error.status !== 409) return null;
    if (error.code !== "TRAINING_SUSPENSION_ACTIVE" && error.code !== "TRAINING_MEDICAL_ELIGIBILITY_REQUIRED") return null;

    const rawSuspensions = (error.details as { suspensions?: unknown } | undefined)?.suspensions;
    if (!Array.isArray(rawSuspensions)) return [];

    const valid: TrainingBlockingSuspension[] = [];
    for (const item of rawSuspensions) {
        if (!item || typeof item !== "object") continue;
        const candidate = item as Record<string, unknown>;
        if (typeof candidate.endsOn !== "string" || !candidate.endsOn.trim()) continue;
        const reason = typeof candidate.reason === "string" ? candidate.reason : "OTHER";
        const requiresClearance = candidate.requiresClearance === true;
        const suspensionId = typeof candidate.suspensionId === "string" ? candidate.suspensionId : undefined;

        let gradedReturn: GradedReturnInfo | null = null;
        if (candidate.gradedReturn && typeof candidate.gradedReturn === "object") {
            const gr = candidate.gradedReturn as Record<string, unknown>;
            if ((gr.ceiling === 3 || gr.ceiling === 4) && typeof gr.fullReturnOn === "string" && gr.fullReturnOn.trim()) {
                gradedReturn = { ceiling: gr.ceiling as 3 | 4, fullReturnOn: gr.fullReturnOn };
            }
        }

        valid.push({
            ...(suspensionId ? { suspensionId } : {}),
            reason,
            endsOn: candidate.endsOn,
            requiresClearance,
            ...(gradedReturn ? { gradedReturn } : {}),
        });
    }

    return valid;
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
