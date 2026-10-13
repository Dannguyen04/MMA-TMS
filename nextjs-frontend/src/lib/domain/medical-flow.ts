import { CLEARANCE_TYPES_BY_SCOPE, type ClearanceType, type ExaminationDecision, type ExaminationScope } from "./medical-contract";
import type { ExaminationType } from "./types";

/**
 * Rules for the doctor's two-step flow (examination, then Medical Clearance) that the forms and actions share: which
 * clearance type to offer, and how to tell whether a write the service didn't confirm was saved after all. Pure, so
 * each rule is tested on its own. Safe for Server and Client Components.
 */

/* ─── Clearance type ──────────────────────────────────────────────────────── */

export interface ClearanceTypeSuggestion {
    type: ClearanceType;
    /** Whether the form selects it straight away. Otherwise it's only marked as suggested and the doctor picks. */
    preselect: boolean;
    /** Why, in one sentence for the doctor. */
    reason: string;
}

/** Examination types that follow an injury, so the fighter is coming back from one. */
const AFTER_INJURY: readonly ExaminationType[] = ["post_injury", "return_to_play", "concussion_screen"];

/**
 * The clearance type an examination points to. A training baseline with no active injury is a training clearance and
 * is selected for the doctor; an active injury or an injury-related examination suggests a return from injury, which
 * the doctor confirms. A competition examination only backs a competition clearance.
 */
export function suggestClearanceType(input: { scope: ExaminationScope; examinationType: ExaminationType | null; activeInjuries: number }): ClearanceTypeSuggestion {
    if (input.scope === "COMPETITION") return { type: "COMPETITION", preselect: true, reason: "A competition examination backs a competition clearance." };
    if (input.activeInjuries > 0) {
        const injuries = input.activeInjuries === 1 ? "an active injury" : `${input.activeInjuries} active injuries`;
        return { type: "RETURN_FROM_INJURY", preselect: false, reason: `The fighter has ${injuries}, so this looks like a return from injury. Confirm the type.` };
    }
    if (input.examinationType === "baseline") return { type: "TRAINING", preselect: true, reason: "A baseline with no active injury backs a training clearance." };
    if (input.examinationType && AFTER_INJURY.includes(input.examinationType)) {
        return { type: "RETURN_FROM_INJURY", preselect: false, reason: "This examination follows an injury, so this looks like a return from injury. Confirm the type." };
    }
    return { type: "TRAINING", preselect: false, reason: "No active injury is recorded. Confirm the type." };
}

/** The suggestion, but only when the examination's scope can back that type. */
export function clearanceTypeSuggestionFor(scope: ExaminationScope, suggestion: ClearanceTypeSuggestion): ClearanceTypeSuggestion | null {
    return CLEARANCE_TYPES_BY_SCOPE[scope].includes(suggestion.type) ? suggestion : null;
}

/* ─── Writes the service didn't confirm ───────────────────────────────────── */

/** What the examination and clearance actions return besides their message, so the form can react. */
export interface MedicalWriteData {
    /**
     * The service didn't confirm the write and a fresh read of the record didn't find it (or couldn't be made). The form
     * keeps every answer and its next submit checks the record again before sending anything.
     */
    unconfirmed?: true;
    /** A clearance of this type from this examination is already active, so nothing new was issued. */
    existingClearance?: { id: string; clearanceType: ClearanceType; issuedAt: string; validUntil: string | null };
}

/** The form field that asks an action to check the record before sending, after a write it couldn't confirm. */
export const RECONCILE_FIELD = "reconcile";

export interface ExaminationAttempt {
    decision: ExaminationDecision;
    /** ISO timestamp the form sent. */
    examinedAt: string;
    reason: string;
}

/**
 * Whether the scope's current examination is the one the doctor just sent: same decision, same examination time and the
 * same reasoning. Only then is a write that timed out treated as saved.
 */
export function isRecordedAttempt(current: { decision: ExaminationDecision; examinedAt: string; reason: string } | null, attempt: ExaminationAttempt): boolean {
    if (!current) return false;
    const sameTime = Date.parse(current.examinedAt) === Date.parse(attempt.examinedAt);
    return sameTime && current.decision === attempt.decision && current.reason.trim() === attempt.reason.trim();
}

/** The clearance already issued from this examination with this type and not revoked, as the service counts a duplicate. */
export function clearanceFromExamination<T extends { examinationId: string | null; clearanceType?: ClearanceType | null; status: string }>(
    clearances: readonly T[],
    examinationId: string,
    clearanceType: ClearanceType,
): T | null {
    return clearances.find((clearance) => clearance.examinationId === examinationId && clearance.clearanceType === clearanceType && clearance.status !== "revoked") ?? null;
}

/* ─── Validity quick picks ────────────────────────────────────────────────── */

/** The date key `months` calendar months after `key`, on the same day or the month's last day when it is shorter. */
export function addMonthsToKey(key: string, months: number): string {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
    if (!match) return key;
    const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
    const index = year * 12 + (month - 1) + months;
    const targetYear = Math.floor(index / 12);
    const targetMonth = (index % 12) + 1;
    const lastDay = new Date(Date.UTC(targetYear, targetMonth, 0)).getUTCDate();
    const pad = (value: number) => String(value).padStart(2, "0");
    return `${targetYear}-${pad(targetMonth)}-${pad(Math.min(day, lastDay))}`;
}
