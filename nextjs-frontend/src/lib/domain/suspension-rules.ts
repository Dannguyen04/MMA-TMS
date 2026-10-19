import { addDaysToKey, daysBetweenKeys, isDateKey } from "@/lib/format";

import type { BoutOutcome, LossOfConsciousness, Suspension, SuspensionReason, SuspensionRule } from "./bout";
import type { TrainingType } from "./types";

/**
 * Suspensions and Gate 2 (Business flows F7, Tech spec §2.5 and §6). Pure functions shared by the demo service,
 * the actions and the pages.
 */

type FieldErrors = Record<string, string>;

export const SUSPENSION_DAYS_MAX = 730;
export const SUSPENSION_TEXT_MAX = 300;

export const SUSPENSION_REASONS = ["KO", "TKO", "DQ", "MANDATORY_REST", "MEDICAL", "OTHER"] as const satisfies readonly SuspensionReason[];

/** Reasons a coach picks for a suspension entered by hand (a knockout in sparring, an organiser's medical ban). */
export const MANUAL_SUSPENSION_REASONS = ["KO", "TKO", "MEDICAL", "OTHER"] as const satisfies readonly SuspensionReason[];

/** The reason a result calls for, or null when the ruleset's rules don't apply (F7, H3, H6). */
export function suspensionReasonFor(outcome: Pick<BoutOutcome, "result" | "method" | "stoppedByHeadStrikes">): SuspensionReason | null {
    if (outcome.result !== "LOSS") return null;
    if (outcome.method === "KO") return "KO";
    if (outcome.method === "TKO") return outcome.stoppedByHeadStrikes ? "TKO" : null;
    if (outcome.method === "DQ") return "DQ";
    return null;
}

export interface SuggestionInput {
    reason: SuspensionReason;
    lossOfConsciousness: LossOfConsciousness | null;
    /** Start days of the fighter's earlier KO/TKO suspensions, hand-entered ones included. */
    priorKnockoutStarts: string[];
    /** Academy day the new suspension starts. */
    on: string;
}

export interface Suggestion {
    days: number;
    rule: SuspensionRule;
}

function ruleMatches(rule: SuspensionRule, input: SuggestionInput): boolean {
    if (rule.reason && !rule.reason.includes(input.reason)) return false;
    if (rule.loc && rule.loc !== input.lossOfConsciousness) return false;
    if (rule.priorCount !== undefined) {
        const within = rule.withinDays ?? Number.POSITIVE_INFINITY;
        const prior = input.priorKnockoutStarts.filter((day) => {
            const age = daysBetweenKeys(day, input.on);
            return age > 0 && age <= within;
        }).length;
        if (prior < rule.priorCount) return false;
    }
    // A consciousness rule speaks about a knockout; it never applies to a disqualification.
    if (!rule.reason && rule.loc && input.reason !== "KO" && input.reason !== "TKO") return false;
    return true;
}

/** The longest matching rule (Tech spec §2.2). Null when the ruleset has no rule for this case. */
export function suggestSuspension(rules: SuspensionRule[], input: SuggestionInput): Suggestion | null {
    let best: Suggestion | null = null;
    for (const rule of rules) {
        if (!ruleMatches(rule, input)) continue;
        if (!best || rule.minDays > best.days) best = { days: rule.minDays, rule };
    }
    return best;
}

/** "KO or TKO", "2 earlier within 90 days", "lost consciousness over 1 minute": a rule in words. */
export function describeRule(rule: SuspensionRule): string {
    const parts: string[] = [];
    if (rule.reason) parts.push(rule.reason.join(" or "));
    if (rule.priorCount !== undefined) parts.push(`${rule.priorCount} earlier ${rule.priorCount === 1 ? "knockout" : "knockouts"}${rule.withinDays ? ` within ${rule.withinDays} days` : ""}`);
    if (rule.loc === "UNDER_1_MIN") parts.push("lost consciousness under 1 minute");
    if (rule.loc === "OVER_1_MIN") parts.push("lost consciousness over 1 minute");
    return `${parts.join(", ") || "Any bout"}: ${rule.minDays} days`;
}

/** A suspension of `days` days that starts on `startsOn` ends `days` days later ("KO on 15 Dec, suspended to 13 Feb" is 60). */
export function suspensionEndsOn(startsOn: string, days: number): string {
    return addDaysToKey(startsOn, days);
}

export function suspensionDays(suspension: Pick<Suspension, "startsOn" | "endsOn">): number {
    return daysBetweenKeys(suspension.startsOn, suspension.endsOn);
}

export type SuspensionState = "UPCOMING" | "ACTIVE" | "AWAITING_CLEARANCE" | "ENDED" | "CLEARED";

/** Tech spec §2.5: active from the start day through the end day, and after it until cleared when clearance is required. */
export function suspensionState(suspension: Pick<Suspension, "startsOn" | "endsOn" | "requiresClearance" | "clearedAt">, day: string): SuspensionState {
    if (daysBetweenKeys(suspension.startsOn, day) < 0) return "UPCOMING";
    if (daysBetweenKeys(day, suspension.endsOn) >= 0) return "ACTIVE";
    if (suspension.requiresClearance) return suspension.clearedAt ? "CLEARED" : "AWAITING_CLEARANCE";
    return "ENDED";
}

export function isSuspensionActive(suspension: Pick<Suspension, "startsOn" | "endsOn" | "requiresClearance" | "clearedAt">, day: string): boolean {
    const state = suspensionState(suspension, day);
    return state === "ACTIVE" || state === "AWAITING_CLEARANCE";
}

/** Gate 2: the fighter's suspensions active on `day` that block this kind of session. */
export function blockingSuspensions<T extends Pick<Suspension, "fighterId" | "startsOn" | "endsOn" | "requiresClearance" | "clearedAt" | "blockedSessionTypes">>(
    suspensions: T[],
    fighterId: string,
    type: TrainingType,
    day: string,
): T[] {
    return suspensions.filter((item) => item.fighterId === fighterId && item.blockedSessionTypes.includes(type) && isSuspensionActive(item, day));
}

/** F7: a coach confirms the fighter may train again only after the last suspended day. */
export function canClearSuspension(suspension: Pick<Suspension, "endsOn" | "requiresClearance" | "clearedAt">, todayOn: string): boolean {
    return suspension.requiresClearance && !suspension.clearedAt && daysBetweenKeys(suspension.endsOn, todayOn) > 0;
}

export interface SuspensionInput {
    reason: string;
    startsOn: string;
    days: string;
    /** What the ruleset suggested, or null. */
    suggestedDays: number | null;
    overrideReason: string;
    blockedSessionTypes: string[];
    requiresClearance: boolean;
    note: string;
}

export interface SuspensionDraft {
    reason: SuspensionReason;
    startsOn: string;
    endsOn: string;
    suggestedDays: number | null;
    overrideReason: string | null;
    blockedSessionTypes: TrainingType[];
    requiresClearance: boolean;
    note: string | null;
}

/**
 * The days must be a whole number; changing a suggestion needs a reason (F7, `SUSPENSION_OVERRIDE_REASON_REQUIRED`);
 * at least one kind of session has to be blocked.
 */
export function validateSuspension(
    input: SuspensionInput,
    allowedReasons: readonly SuspensionReason[],
    trainingTypes: readonly TrainingType[],
): { ok: true; value: SuspensionDraft } | { ok: false; fieldErrors: FieldErrors } {
    const fieldErrors: FieldErrors = {};
    const reason = (allowedReasons as readonly string[]).includes(input.reason) ? (input.reason as SuspensionReason) : null;
    if (!reason) fieldErrors.reason = "Choose a reason.";
    if (!isDateKey(input.startsOn)) fieldErrors.startsOn = "Enter the first day of the suspension.";

    const daysRaw = input.days.trim();
    const days = /^\d{1,3}$/.test(daysRaw) ? Number(daysRaw) : NaN;
    if (!Number.isInteger(days) || days < 1 || days > SUSPENSION_DAYS_MAX) fieldErrors.days = `Enter a whole number of days from 1 to ${SUSPENSION_DAYS_MAX}.`;

    const overrideReason = input.overrideReason.trim();
    if (input.suggestedDays !== null && Number.isInteger(days) && days !== input.suggestedDays && !overrideReason) {
        fieldErrors.overrideReason = `Say why this differs from the ${input.suggestedDays} days the ruleset suggests.`;
    }
    if (overrideReason.length > SUSPENSION_TEXT_MAX) fieldErrors.overrideReason = `Keep the reason under ${SUSPENSION_TEXT_MAX} characters.`;

    const blocked = input.blockedSessionTypes.filter((type): type is TrainingType => (trainingTypes as readonly string[]).includes(type));
    if (blocked.length === 0) fieldErrors.blockedSessionTypes = "Block at least one kind of session.";

    const note = input.note.trim();
    if (note.length > SUSPENSION_TEXT_MAX) fieldErrors.note = `Keep the note under ${SUSPENSION_TEXT_MAX} characters.`;

    if (Object.keys(fieldErrors).length > 0 || !reason) return { ok: false, fieldErrors };
    return {
        ok: true,
        value: {
            reason,
            startsOn: input.startsOn,
            endsOn: suspensionEndsOn(input.startsOn, days),
            suggestedDays: input.suggestedDays,
            overrideReason: input.suggestedDays !== null && days !== input.suggestedDays ? overrideReason : null,
            blockedSessionTypes: [...new Set(blocked)],
            requiresClearance: input.requiresClearance,
            note: note || null,
        },
    };
}

/** Clearing needs a basis in words, such as "Neurologist cleared, CT normal" or "Coach confirmed, no medical clearance". */
export function readClearanceNote(raw: string): { ok: true; value: string } | { ok: false; message: string } {
    const value = raw.trim();
    if (!value) return { ok: false, message: "Write what the decision is based on." };
    if (value.length > SUSPENSION_TEXT_MAX) return { ok: false, message: `Keep this under ${SUSPENSION_TEXT_MAX} characters.` };
    return { ok: true, value };
}
