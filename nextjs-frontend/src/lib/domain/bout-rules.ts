import { academyWallClockToIso, addDaysToKey, dayKey, daysBetweenKeys, isDateKey, isDateTimeInputValue } from "@/lib/format";

import {
    isActivePhase,
    isReadyState,
    type BoutMethod,
    type BoutOutcome,
    type BoutPhase,
    type BoutRequirement,
    type BoutResult,
    type BoutSport,
    type CampBout,
    type CompetitionRuleset,
    type HydrationCheck,
    type LossOfConsciousness,
    type RequirementState,
    type WeightClassOption,
} from "./bout";
import { GATE1_REASON_LABELS } from "./labels";
import { kgLabel, parseKg, parseWeightLimit } from "./weight-input";

/**
 * Bout rules from the business flows (§3, F1, F2, F4, F5, F6, F8) and the computed values of Tech spec §3.
 * Pure functions: the demo service, the server actions and the pages all call these, and the backend
 * (bouts.model.ts, T-003) implements the same rules.
 */

type FieldErrors = Record<string, string>;
export type Checked<T> = { ok: true; value: T } | { ok: false; fieldErrors: FieldErrors };

const HOUR_MS = 3_600_000;

/** A weigh-in this many hours or more before the bout uses the ruleset's long acute-loss limit. */
export const LONG_GAP_HOURS = 12;

/** F4: missing documents show on the coach's Today from this many days before the deadline. */
export const REQUIREMENTS_WARNING_DAYS = 14;

/* ─── Dates ───────────────────────────────────────────────────────────────── */

export function weighInOn(bout: Pick<CampBout, "weighInAt">): string {
    return dayKey(bout.weighInAt);
}

export function boutOn(bout: Pick<CampBout, "boutAt">): string {
    return dayKey(bout.boutAt);
}

export function hoursBetween(fromIso: string, toIso: string): number {
    return (Date.parse(toIso) - Date.parse(fromIso)) / HOUR_MS;
}

/** F1: 8% when the weigh-in is 12 hours or more before the bout, 5% when it is closer (Tech spec §2.2). */
export function acuteLossLimitPct(
    weighInAt: string,
    boutAt: string,
    ruleset: Pick<CompetitionRuleset, "acuteLossLimitPctLong" | "acuteLossLimitPctShort">,
): number {
    return hoursBetween(weighInAt, boutAt) >= LONG_GAP_HOURS ? ruleset.acuteLossLimitPctLong : ruleset.acuteLossLimitPctShort;
}

/** Days to weigh-in, hours between weigh-in and bout, and the acute-loss limit: the preview under the bout form. */
export function scheduleSummary(
    weighInAt: string,
    boutAt: string,
    ruleset: Pick<CompetitionRuleset, "acuteLossLimitPctLong" | "acuteLossLimitPctShort">,
    todayOn: string,
): { daysToWeighIn: number; gapHours: number; acuteLossLimitPct: number } {
    return {
        daysToWeighIn: daysBetweenKeys(todayOn, dayKey(weighInAt)),
        gapHours: Math.round(hoursBetween(weighInAt, boutAt) * 10) / 10,
        acuteLossLimitPct: acuteLossLimitPct(weighInAt, boutAt, ruleset),
    };
}

/** T-003 §3: the linked plan's start date, or the day the bout was created when no plan is linked. */
export function campStartedOn(bout: Pick<CampBout, "createdOn">, plan: { startDate: string } | null): string {
    return plan ? dayKey(plan.startDate) : bout.createdOn;
}

/* ─── Status transitions (Business flows §3) ──────────────────────────────── */

const TRANSITIONS: Record<BoutPhase, readonly BoutPhase[]> = {
    SCHEDULED: ["CAMP", "CANCELLED"],
    CAMP: ["FIGHT_WEEK", "CANCELLED"],
    FIGHT_WEEK: ["WEIGHED_IN", "CANCELLED"],
    WEIGHED_IN: ["COMPLETED", "CANCELLED"],
    COMPLETED: [],
    CANCELLED: [],
};

/** No going back: a mistake is fixed by cancelling and creating the bout again. */
export function canTransition(from: BoutPhase, to: BoutPhase): boolean {
    return TRANSITIONS[from].includes(to);
}

/** F8: dates, class and the documents deadline change until the official weigh-in. */
export function canEditSchedule(phase: BoutPhase): boolean {
    return phase === "SCHEDULED" || phase === "CAMP" || phase === "FIGHT_WEEK";
}

/** Anything before a result can be cancelled. */
export function canCancel(phase: BoutPhase): boolean {
    return canTransition(phase, "CANCELLED");
}

/** F5: the checklist is open before fight week and locked from then on, unless a coach unlocks it with a reason. */
export function checklistLocked(bout: Pick<CampBout, "phase" | "checklistUnlock">): boolean {
    if (bout.phase === "SCHEDULED" || bout.phase === "CAMP") return false;
    if (bout.phase === "FIGHT_WEEK" || bout.phase === "WEIGHED_IN") return !bout.checklistUnlock;
    return true;
}

/* ─── Gate 1 (F4) ─────────────────────────────────────────────────────────── */

export type Gate1Reason = "MISSING" | "EXPIRED" | "REJECTED";

export interface Gate1Gap {
    requirement: BoutRequirement;
    reason: Gate1Reason;
}

export interface Gate1 {
    passed: boolean;
    missing: Gate1Gap[];
}

/**
 * Passes when every required item is provided or confirmed and valid through the bout day.
 * An optional item still missing does not block.
 */
export function gate1(requirements: BoutRequirement[], boutDay: string): Gate1 {
    const missing = requirements.flatMap((requirement): Gate1Gap[] => {
        if (!requirement.required) return [];
        if (requirement.state === "REJECTED") return [{ requirement, reason: "REJECTED" }];
        if (!isReadyState(requirement.state)) return [{ requirement, reason: "MISSING" }];
        if (!requirement.validUntil || requirement.validUntil < boutDay) return [{ requirement, reason: "EXPIRED" }];
        return [];
    });
    return { passed: missing.length === 0, missing };
}

export function boutGate1(bout: Pick<CampBout, "requirements" | "boutAt">): Gate1 {
    return gate1(bout.requirements, boutOn(bout));
}

/** Provided or confirmed, and valid through the bout day: what "ready" means on every screen. */
export function readyForBout(requirement: Pick<BoutRequirement, "state" | "validUntil">, boutDay: string): boolean {
    return isReadyState(requirement.state) && requirement.validUntil !== null && requirement.validUntil >= boutDay;
}

/** "2 of 3 ready · Brain CT missing": the checklist in one line, for the fighter's page and the coach's list. */
export function gateSummary(requirements: BoutRequirement[], boutDay: string): string {
    const ready = requirements.filter((item) => readyForBout(item, boutDay)).length;
    const { missing } = gate1(requirements, boutDay);
    const head = requirements.length === 0 ? "No documents listed" : `${ready} of ${requirements.length} ready`;
    if (missing.length === 0) return head;
    return `${head} · ${missing.map((gap) => `${gap.requirement.label} ${GATE1_REASON_LABELS[gap.reason]}`).join(", ")}`;
}

/** A ready document that runs out before the bout, shown in red even when it is optional. */
export function expiresBeforeBout(requirement: Pick<BoutRequirement, "state" | "validUntil">, boutDay: string): boolean {
    return isReadyState(requirement.state) && requirement.validUntil !== null && requirement.validUntil < boutDay;
}

/** Weigh-in day minus `requirementsDueDays`. */
export function requirementsDueOn(bout: Pick<CampBout, "weighInAt" | "requirementsDueDays">): string {
    return addDaysToKey(weighInOn(bout), -bout.requirementsDueDays);
}

/** "Documents late": past the deadline before fight week with Gate 1 still closed. */
export function requirementsOverdue(bout: Pick<CampBout, "phase" | "weighInAt" | "boutAt" | "requirementsDueDays" | "requirements">, todayOn: string): boolean {
    if (bout.phase !== "SCHEDULED" && bout.phase !== "CAMP") return false;
    return daysBetweenKeys(requirementsDueOn(bout), todayOn) > 0 && !boutGate1(bout).passed;
}

/** F4: required items not ready, from 14 days before the deadline, while the bout is still before fight week. */
export function requirementsDueSoon(bout: Pick<CampBout, "phase" | "weighInAt" | "boutAt" | "requirementsDueDays" | "requirements">, todayOn: string): Gate1Gap[] {
    if (bout.phase !== "SCHEDULED" && bout.phase !== "CAMP") return [];
    if (daysBetweenKeys(todayOn, requirementsDueOn(bout)) > REQUIREMENTS_WARNING_DAYS) return [];
    return boutGate1(bout).missing;
}

/* ─── Fight week ──────────────────────────────────────────────────────────── */

export function fightWeekOpensOn(bout: Pick<CampBout, "weighInAt" | "fightWeekDays">): string {
    return addDaysToKey(weighInOn(bout), -bout.fightWeekDays);
}

export type FightWeekBlock = "NOT_IN_CAMP" | "TOO_EARLY" | "REQUIREMENTS_INCOMPLETE";

export type FightWeekCheck = { ok: true } | { ok: false; reason: FightWeekBlock; missing: Gate1Gap[]; opensOn: string };

/** Tech spec §3: in camp, on or after weigh-in day minus `fightWeekDays`, and Gate 1 passed. */
export function canEnterFightWeek(
    bout: Pick<CampBout, "phase" | "weighInAt" | "boutAt" | "fightWeekDays" | "requirements">,
    todayOn: string,
): FightWeekCheck {
    const opensOn = fightWeekOpensOn(bout);
    const { missing } = boutGate1(bout);
    if (bout.phase !== "CAMP") return { ok: false, reason: "NOT_IN_CAMP", missing, opensOn };
    if (daysBetweenKeys(opensOn, todayOn) < 0) return { ok: false, reason: "TOO_EARLY", missing, opensOn };
    if (missing.length > 0) return { ok: false, reason: "REQUIREMENTS_INCOMPLETE", missing, opensOn };
    return { ok: true };
}

/* ─── Creating and editing a bout (F1, F8) ────────────────────────────────── */

export const EVENT_MAX = 120;
export const VENUE_MAX = 120;
export const OPPONENT_MAX = 80;
export const NOTES_MAX = 500;
export const DUE_DAYS_MAX = 60;

export interface BoutScheduleInput {
    event: string;
    venue: string;
    opponent: string;
    weightClassCode: string;
    weightLimitKg: string;
    /** datetime-local values on the academy wall clock. */
    weighInAt: string;
    boutAt: string;
}

export interface BoutSchedule {
    event: string;
    venue: string | null;
    opponent: string | null;
    weightClass: WeightClassOption;
    weighInAt: string;
    boutAt: string;
}

/** A class from the preset's list, or the coach's own limit when the ruleset has none ("Custom"). */
export function readWeightClass(ruleset: Pick<CompetitionRuleset, "weightClasses">, code: string, limitRaw: string): { ok: true; value: WeightClassOption } | { ok: false; field: string; message: string } {
    if (ruleset.weightClasses.length > 0) {
        const option = ruleset.weightClasses.find((item) => item.code === code.trim());
        return option ? { ok: true, value: option } : { ok: false, field: "weightClassCode", message: "Choose a weight class from the list." };
    }
    const parsed = parseWeightLimit(limitRaw);
    if (!parsed.ok) return { ok: false, field: "weightLimitKg", message: parsed.message };
    return { ok: true, value: { code: String(parsed.kg), label: kgLabel(parsed.kg), limitKg: parsed.kg } };
}

function readText(raw: string, max: number, tooLong: string): { ok: true; value: string | null } | { ok: false; message: string } {
    const value = raw.trim();
    if (value.length > max) return { ok: false, message: tooLong };
    return { ok: true, value: value || null };
}

/**
 * Validates the fields a bout is created or rescheduled with. Weigh-in must come before the bout and the bout
 * must be in the future (Business flows §3); errors come back per field so the form can show them in place.
 */
export function validateBoutSchedule(
    input: BoutScheduleInput,
    ruleset: Pick<CompetitionRuleset, "weightClasses">,
    now: Date,
    /** Editing a bout whose time has passed keeps it; a new or moved bout must still be in the future. */
    { allowPastBoutAt }: { allowPastBoutAt?: string } = {},
): Checked<BoutSchedule> {
    const fieldErrors: FieldErrors = {};

    const event = input.event.trim();
    if (!event) fieldErrors.event = "Enter the event name.";
    else if (event.length > EVENT_MAX) fieldErrors.event = `Keep the event name under ${EVENT_MAX} characters.`;

    const venue = readText(input.venue, VENUE_MAX, `Keep the venue under ${VENUE_MAX} characters.`);
    if (!venue.ok) fieldErrors.venue = venue.message;
    const opponent = readText(input.opponent, OPPONENT_MAX, `Keep the opponent's name under ${OPPONENT_MAX} characters.`);
    if (!opponent.ok) fieldErrors.opponent = opponent.message;

    const weightClass = readWeightClass(ruleset, input.weightClassCode, input.weightLimitKg);
    if (!weightClass.ok) fieldErrors[weightClass.field] = weightClass.message;

    const weighInAt = isDateTimeInputValue(input.weighInAt) ? wallClockIso(input.weighInAt) : null;
    const boutAt = isDateTimeInputValue(input.boutAt) ? wallClockIso(input.boutAt) : null;
    if (!weighInAt) fieldErrors.weighInAt = "Enter the weigh-in date and time.";
    if (!boutAt) fieldErrors.boutAt = "Enter the bout date and time.";
    if (weighInAt && boutAt) {
        if (Date.parse(weighInAt) >= Date.parse(boutAt)) fieldErrors.boutAt = "The bout must start after the weigh-in.";
        else if (Date.parse(boutAt) <= now.getTime() && boutAt !== allowPastBoutAt) fieldErrors.boutAt = "The bout must be in the future.";
    }

    if (Object.keys(fieldErrors).length > 0 || !weightClass.ok || !weighInAt || !boutAt || !venue.ok || !opponent.ok) {
        return { ok: false, fieldErrors };
    }
    return { ok: true, value: { event, venue: venue.value, opponent: opponent.value, weightClass: weightClass.value, weighInAt, boutAt } };
}

/** "2026-10-22T10:00" on the academy wall clock → ISO. */
export function wallClockIso(value: string): string {
    const [day, time] = value.split("T");
    return academyWallClockToIso(day, time);
}

/** The documents deadline in days before weigh-in, a whole number from 0 to 60. */
export function readDueDays(raw: string): { ok: true; value: number } | { ok: false; message: string } {
    const value = raw.trim();
    if (!/^\d{1,2}$/.test(value) || Number(value) > DUE_DAYS_MAX) {
        return { ok: false, message: `Enter a whole number of days from 0 to ${DUE_DAYS_MAX}.` };
    }
    return { ok: true, value: Number(value) };
}

/* ─── Medical checklist (F4) ──────────────────────────────────────────────── */

export const REQUIREMENT_LABEL_MAX = 80;
export const STATUS_REASON_MAX = 200;
export const VALIDITY_DAYS_MAX = 3650;

/** The states a coach can set. `CONFIRMED` belongs to a doctor (not in this release). */
export const COACH_REQUIREMENT_STATES = ["MISSING", "PROVIDED", "REJECTED"] as const satisfies readonly RequirementState[];

/** "Health certificate" → "HEALTH_CERTIFICATE", unique on this bout. */
export function requirementCode(label: string, taken: Iterable<string>): string {
    const base =
        label
            .normalize("NFD")
            .replace(/[̀-ͯ]/g, "")
            .replace(/đ/gi, "D")
            .toUpperCase()
            .replace(/[^A-Z0-9]+/g, "_")
            .replace(/^_+|_+$/g, "")
            .slice(0, 40) || "ITEM";
    const used = new Set(taken);
    if (!used.has(base)) return base;
    for (let n = 2; ; n += 1) {
        const candidate = `${base}_${n}`;
        if (!used.has(candidate)) return candidate;
    }
}

export interface NewRequirementInput {
    label: string;
    required: boolean;
    validityDays: string;
}

export function validateNewRequirement(input: NewRequirementInput, existingLabels: string[]): Checked<{ label: string; required: boolean; validityDays: number | null }> {
    const fieldErrors: FieldErrors = {};
    const label = input.label.trim();
    if (!label) fieldErrors.label = "Name the document, such as “Brain CT”.";
    else if (label.length > REQUIREMENT_LABEL_MAX) fieldErrors.label = `Keep the name under ${REQUIREMENT_LABEL_MAX} characters.`;
    else if (existingLabels.some((item) => item.trim().toLowerCase() === label.toLowerCase())) fieldErrors.label = "This bout already lists that document.";

    const days = input.validityDays.trim();
    let validityDays: number | null = null;
    if (days) {
        if (!/^\d+$/.test(days) || Number(days) < 1 || Number(days) > VALIDITY_DAYS_MAX) {
            fieldErrors.validityDays = `Enter a whole number of days from 1 to ${VALIDITY_DAYS_MAX}, or leave it empty.`;
        } else {
            validityDays = Number(days);
        }
    }
    if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };
    return { ok: true, value: { label, required: input.required, validityDays } };
}

export interface RequirementUpdateInput {
    state: string;
    issuedOn: string;
    validUntil: string;
    statusReason: string;
}

export interface RequirementUpdate {
    state: RequirementState;
    issuedOn: string | null;
    validUntil: string | null;
    statusReason: string | null;
}

/**
 * F4 and T-003 §2: `PROVIDED` needs a valid-until date, `REJECTED` needs a reason, `CONFIRMED` is a doctor's.
 * A missing document keeps no dates.
 */
export function validateRequirementUpdate(input: RequirementUpdateInput): Checked<RequirementUpdate> {
    const fieldErrors: FieldErrors = {};
    const state = input.state.trim();
    if (state === "CONFIRMED") fieldErrors.state = "Only a doctor can confirm a document.";
    else if (!(COACH_REQUIREMENT_STATES as readonly string[]).includes(state)) fieldErrors.state = "Choose a status.";

    const issuedOn = input.issuedOn.trim() || null;
    const validUntil = input.validUntil.trim() || null;
    const statusReason = input.statusReason.trim() || null;
    if (issuedOn && !isDateKey(issuedOn)) fieldErrors.issuedOn = "Enter a valid issue date.";
    if (validUntil && !isDateKey(validUntil)) fieldErrors.validUntil = "Enter a valid date.";
    if (state === "PROVIDED" && !validUntil) fieldErrors.validUntil = "Enter the date this document is valid until.";
    if (issuedOn && validUntil && isDateKey(issuedOn) && isDateKey(validUntil) && validUntil < issuedOn) {
        fieldErrors.validUntil = "The valid-until date can't be before the issue date.";
    }
    if (state === "REJECTED" && !statusReason) fieldErrors.statusReason = "Say why the document was rejected.";
    if (statusReason && statusReason.length > STATUS_REASON_MAX) fieldErrors.statusReason = `Keep the reason under ${STATUS_REASON_MAX} characters.`;

    if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };
    const value = state as RequirementState;
    if (value === "MISSING") return { ok: true, value: { state: value, issuedOn: null, validUntil: null, statusReason: null } };
    return { ok: true, value: { state: value, issuedOn, validUntil, statusReason: value === "REJECTED" ? statusReason : null } };
}

/** The valid-until date a document's validity suggests once its issue date is known. */
export function suggestedValidUntil(issuedOn: string, validityDays: number | null): string | null {
    if (!validityDays || !isDateKey(issuedOn)) return null;
    return addDaysToKey(issuedOn, validityDays);
}

/** The checklist a new bout starts with: the ruleset's templates, every item missing. */
export function requirementsFromTemplates(ruleset: Pick<CompetitionRuleset, "requirementTemplates">): BoutRequirement[] {
    return ruleset.requirementTemplates.map((template) => ({
        id: template.code,
        code: template.code,
        label: template.label,
        required: template.required,
        state: "MISSING",
        source: "PRESET",
        issuedOn: null,
        validUntil: null,
        statusReason: null,
        validityDays: template.validityDays,
    }));
}

/* ─── Official weigh-in and result (F5, F6) ───────────────────────────────── */

export const HYDRATION_CHECKS = ["NOT_APPLICABLE", "PASSED", "FAILED"] as const satisfies readonly HydrationCheck[];
export const BOUT_RESULTS = ["WIN", "LOSS", "DRAW", "NO_CONTEST"] as const satisfies readonly BoutResult[];
export const BOUT_METHODS = ["KO", "TKO", "DECISION", "SUBMISSION", "DQ", "OTHER"] as const satisfies readonly BoutMethod[];
export const LOSS_OF_CONSCIOUSNESS = ["NONE", "UNDER_1_MIN", "OVER_1_MIN", "UNKNOWN"] as const satisfies readonly LossOfConsciousness[];
export const MAX_ROUNDS = 12;
export const OUTCOME_TEXT_MAX = 500;

/** Methods a sport can end with: a submission is MMA only (F6). */
export function methodsFor(sport: BoutSport): BoutMethod[] {
    return BOUT_METHODS.filter((method) => method !== "SUBMISSION" || sport === "MMA");
}

/** The app's suggestion at the official weigh-in; the coach confirms it. An open class always makes weight. */
export function madeWeight(officialKg: number, limitKg: number | null): boolean {
    return limitKg === null || officialKg <= limitKg;
}

export function readOfficialWeight(raw: string) {
    return parseKg(raw, { noun: "the official weight", example: "60.0" });
}

export function readCatchweight(raw: string) {
    return parseKg(raw, { noun: "the catchweight", example: "61.5" });
}

/** F6: a result is recorded once weighed in and from the bout day. */
export function canRecordResult(bout: Pick<CampBout, "phase" | "boutAt">, todayOn: string): { ok: true } | { ok: false; reason: "NOT_WEIGHED_IN" | "BOUT_NOT_STARTED" } {
    if (bout.phase !== "WEIGHED_IN") return { ok: false, reason: "NOT_WEIGHED_IN" };
    if (daysBetweenKeys(boutOn(bout), todayOn) < 0) return { ok: false, reason: "BOUT_NOT_STARTED" };
    return { ok: true };
}

export interface OutcomeInput {
    result: string;
    method: string;
    round: string;
    knockedDown: boolean;
    lossOfConsciousness: string;
    stoppedByHeadStrikes: string;
    injuryNote: string;
    notes: string;
}

/** A loss by KO or TKO asks about consciousness; a TKO loss also asks whether head strikes stopped it (H3). */
export function asksLossOfConsciousness(result: string, method: string): boolean {
    return result === "LOSS" && (method === "KO" || method === "TKO");
}

export function asksHeadStrikes(result: string, method: string): boolean {
    return result === "LOSS" && method === "TKO";
}

export function validateOutcome(input: OutcomeInput, sport: BoutSport, recordedAt: string): Checked<BoutOutcome> {
    const fieldErrors: FieldErrors = {};
    const result = (BOUT_RESULTS as readonly string[]).includes(input.result) ? (input.result as BoutResult) : null;
    if (!result) fieldErrors.result = "Choose the result.";
    const method = (methodsFor(sport) as string[]).includes(input.method) ? (input.method as BoutMethod) : null;
    if (!method) fieldErrors.method = input.method === "SUBMISSION" ? "A submission ends MMA bouts only." : "Choose how the bout ended.";

    const roundRaw = input.round.trim();
    let round: number | null = null;
    if (roundRaw) {
        if (!/^\d{1,2}$/.test(roundRaw) || Number(roundRaw) < 1 || Number(roundRaw) > MAX_ROUNDS) {
            fieldErrors.round = `Enter a round from 1 to ${MAX_ROUNDS}, or leave it empty for a decision.`;
        } else {
            round = Number(roundRaw);
        }
    }

    let lossOfConsciousness: LossOfConsciousness | null = null;
    if (asksLossOfConsciousness(input.result, input.method)) {
        if ((LOSS_OF_CONSCIOUSNESS as readonly string[]).includes(input.lossOfConsciousness)) lossOfConsciousness = input.lossOfConsciousness as LossOfConsciousness;
        else fieldErrors.lossOfConsciousness = "Say whether the fighter lost consciousness.";
    }
    let stoppedByHeadStrikes: boolean | null = null;
    if (asksHeadStrikes(input.result, input.method)) {
        if (input.stoppedByHeadStrikes === "yes" || input.stoppedByHeadStrikes === "no") stoppedByHeadStrikes = input.stoppedByHeadStrikes === "yes";
        else fieldErrors.stoppedByHeadStrikes = "Say whether head strikes stopped the bout.";
    }

    const injuryNote = input.injuryNote.trim();
    const notes = input.notes.trim();
    if (injuryNote.length > OUTCOME_TEXT_MAX) fieldErrors.injuryNote = `Keep this under ${OUTCOME_TEXT_MAX} characters.`;
    if (notes.length > OUTCOME_TEXT_MAX) fieldErrors.notes = `Keep this under ${OUTCOME_TEXT_MAX} characters.`;

    if (Object.keys(fieldErrors).length > 0 || !result || !method) return { ok: false, fieldErrors };
    return {
        ok: true,
        value: {
            result,
            method,
            round,
            knockedDown: input.knockedDown,
            lossOfConsciousness,
            stoppedByHeadStrikes,
            injuryNote: injuryNote || null,
            notes: notes || null,
            recordedAt,
        },
    };
}

/* ─── Readiness (H7) ──────────────────────────────────────────────────────── */

/** The fighter's bout in camp, fight week or weighed in, if any: only one is allowed at a time. */
export function activeBoutOf<T extends Pick<CampBout, "fighterId" | "phase">>(bouts: T[], fighterId: string): T | null {
    return bouts.find((bout) => bout.fighterId === fighterId && isActivePhase(bout.phase)) ?? null;
}
