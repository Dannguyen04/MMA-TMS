import { academyWallClockToIso, addDaysToKey, dayKey, daysBetweenKeys, isDateKey, isDateTimeInputValue } from "@/lib/format";
import { createTranslator, type Translator } from "@/lib/i18n/translate";

import {
    isActivePhase,
    isReadyState,
    type AcuteLoss,
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
import { kgLabel, parseKg, parseWeightLimit } from "./weight-input";

/**
 * Bout rules from the business flows (§3, F1, F2, F4, F5, F6, F8) and the computed values of Tech spec §3.
 * Pure functions: the demo service, the server actions and the pages all call these, and the backend
 * (bouts.model.ts, T-003) implements the same rules.
 */

type FieldErrors = Record<string, string>;

/** Messages default to English, so the demo store, the tests and the API adapter need no translator. */
const english = createTranslator("en");
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
export function gateSummary(requirements: BoutRequirement[], boutDay: string, t: Translator = english): string {
    const ready = requirements.filter((item) => readyForBout(item, boutDay)).length;
    const { missing } = gate1(requirements, boutDay);
    const head = requirements.length === 0 ? t("boutMsg.gate.noDocuments") : t("boutMsg.gate.ready", { ready, total: requirements.length });
    if (missing.length === 0) return head;
    const gaps = missing.map((gap) => t("boutMsg.gate.gap", { label: gap.requirement.label, reason: t(`boutLabel.gate1Reason.${gap.reason}`) }));
    return `${head} · ${gaps.join(", ")}`;
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
export function readWeightClass(
    ruleset: Pick<CompetitionRuleset, "weightClasses">,
    code: string,
    limitRaw: string,
    t: Translator = english,
): { ok: true; value: WeightClassOption } | { ok: false; field: string; message: string } {
    if (ruleset.weightClasses.length > 0) {
        const option = ruleset.weightClasses.find((item) => item.code === code.trim());
        return option ? { ok: true, value: option } : { ok: false, field: "weightClassCode", message: t("boutMsg.schedule.weightClass") };
    }
    const parsed = parseWeightLimit(limitRaw, t);
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
    t: Translator = english,
): Checked<BoutSchedule> {
    const fieldErrors: FieldErrors = {};

    const event = input.event.trim();
    if (!event) fieldErrors.event = t("boutMsg.schedule.eventRequired");
    else if (event.length > EVENT_MAX) fieldErrors.event = t("boutMsg.schedule.eventTooLong", { max: EVENT_MAX });

    const venue = readText(input.venue, VENUE_MAX, t("boutMsg.schedule.venueTooLong", { max: VENUE_MAX }));
    if (!venue.ok) fieldErrors.venue = venue.message;
    const opponent = readText(input.opponent, OPPONENT_MAX, t("boutMsg.schedule.opponentTooLong", { max: OPPONENT_MAX }));
    if (!opponent.ok) fieldErrors.opponent = opponent.message;

    const weightClass = readWeightClass(ruleset, input.weightClassCode, input.weightLimitKg, t);
    if (!weightClass.ok) fieldErrors[weightClass.field] = weightClass.message;

    const weighInAt = isDateTimeInputValue(input.weighInAt) ? wallClockIso(input.weighInAt) : null;
    const boutAt = isDateTimeInputValue(input.boutAt) ? wallClockIso(input.boutAt) : null;
    if (!weighInAt) fieldErrors.weighInAt = t("boutMsg.schedule.weighInRequired");
    if (!boutAt) fieldErrors.boutAt = t("boutMsg.schedule.boutRequired");
    if (weighInAt && boutAt) {
        if (Date.parse(weighInAt) >= Date.parse(boutAt)) fieldErrors.boutAt = t("boutMsg.schedule.boutAfterWeighIn");
        else if (Date.parse(boutAt) <= now.getTime() && boutAt !== allowPastBoutAt) fieldErrors.boutAt = t("boutMsg.schedule.boutInFuture");
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
export function readDueDays(raw: string, t: Translator = english): { ok: true; value: number } | { ok: false; message: string } {
    const value = raw.trim();
    if (!/^\d{1,2}$/.test(value) || Number(value) > DUE_DAYS_MAX) {
        return { ok: false, message: t("boutMsg.schedule.dueDays", { max: DUE_DAYS_MAX }) };
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

export function validateNewRequirement(
    input: NewRequirementInput,
    existingLabels: string[],
    t: Translator = english,
): Checked<{ label: string; required: boolean; validityDays: number | null }> {
    const fieldErrors: FieldErrors = {};
    const label = input.label.trim();
    if (!label) fieldErrors.label = t("boutMsg.requirement.labelRequired");
    else if (label.length > REQUIREMENT_LABEL_MAX) fieldErrors.label = t("boutMsg.common.nameTooLong", { max: REQUIREMENT_LABEL_MAX });
    else if (existingLabels.some((item) => item.trim().toLowerCase() === label.toLowerCase())) fieldErrors.label = t("boutMsg.requirement.labelTaken");

    const days = input.validityDays.trim();
    let validityDays: number | null = null;
    if (days) {
        if (!/^\d+$/.test(days) || Number(days) < 1 || Number(days) > VALIDITY_DAYS_MAX) {
            fieldErrors.validityDays = t("boutMsg.requirement.validityDays", { max: VALIDITY_DAYS_MAX });
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
export function validateRequirementUpdate(input: RequirementUpdateInput, t: Translator = english): Checked<RequirementUpdate> {
    const fieldErrors: FieldErrors = {};
    const state = input.state.trim();
    if (state === "CONFIRMED") fieldErrors.state = t("boutMsg.requirement.doctorConfirms");
    else if (!(COACH_REQUIREMENT_STATES as readonly string[]).includes(state)) fieldErrors.state = t("boutMsg.requirement.stateRequired");

    const issuedOn = input.issuedOn.trim() || null;
    const validUntil = input.validUntil.trim() || null;
    const statusReason = input.statusReason.trim() || null;
    if (issuedOn && !isDateKey(issuedOn)) fieldErrors.issuedOn = t("boutMsg.requirement.issuedOnInvalid");
    if (validUntil && !isDateKey(validUntil)) fieldErrors.validUntil = t("boutMsg.requirement.validUntilInvalid");
    if (state === "PROVIDED" && !validUntil) fieldErrors.validUntil = t("boutMsg.requirement.validUntilRequired");
    if (issuedOn && validUntil && isDateKey(issuedOn) && isDateKey(validUntil) && validUntil < issuedOn) {
        fieldErrors.validUntil = t("boutMsg.requirement.validUntilBeforeIssued");
    }
    if (state === "REJECTED" && !statusReason) fieldErrors.statusReason = t("boutMsg.requirement.reasonRequired");
    if (statusReason && statusReason.length > STATUS_REASON_MAX) fieldErrors.statusReason = t("boutMsg.common.reasonTooLong", { max: STATUS_REASON_MAX });

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
    // In hundredths, so 60.0 against 60 never misses on a floating-point remainder.
    return limitKg === null || Math.round(officialKg * 100) <= Math.round(limitKg * 100);
}

/** R17: the bout goes on only when the fighter made weight and didn't fail the hydration check. */
export function passesWeighIn(officialKg: number, limitKg: number | null, hydrationCheck: HydrationCheck | null): boolean {
    return madeWeight(officialKg, limitKg) && hydrationCheck !== "FAILED";
}

/** Weighed in but neither passed nor decided: the coach still has to choose a catchweight or cancel (R18). */
export function awaitsWeighInDecision(bout: Pick<CampBout, "phase" | "weighIn">): boolean {
    return bout.phase === "FIGHT_WEEK" && bout.weighIn !== null && (!bout.weighIn.madeWeight || bout.weighIn.hydrationCheck === "FAILED");
}

/**
 * R19: the loss from the first morning weight in the `windowDays` before the weigh-in day to the official weight.
 * `weights` are the fighter's daily weights (never the official one), oldest first or in any order.
 */
export function computeAcuteLoss(
    weights: { on: string; kg: number }[],
    officialKg: number,
    weighInOn: string,
    windowDays: number,
    limitPct: number,
): AcuteLoss {
    const opensOn = addDaysToKey(weighInOn, -windowDays);
    const start = weights
        .filter((point) => daysBetweenKeys(opensOn, point.on) >= 0 && daysBetweenKeys(point.on, weighInOn) >= 0)
        .sort((a, b) => a.on.localeCompare(b.on))[0];
    if (!start) return { status: "NO_DATA", startKg: null, startOn: null, lossPct: null, limitPct };
    const lossPct = Math.round(((start.kg - officialKg) / start.kg) * 1000) / 10;
    return { status: lossPct > limitPct ? "EXCEEDED" : "WITHIN", startKg: start.kg, startOn: start.on, lossPct, limitPct };
}

export function readOfficialWeight(raw: string, t: Translator = english) {
    return parseKg(raw, "official", t);
}

export function readCatchweight(raw: string, t: Translator = english) {
    return parseKg(raw, "catchweight", t);
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

/** T-006 §4: a stoppage names its round, a decision goes the distance, DQ and "Other" may say either. */
export function roundRuleFor(method: string): "REQUIRED" | "NOT_ALLOWED" | "OPTIONAL" {
    if (method === "KO" || method === "TKO" || method === "SUBMISSION") return "REQUIRED";
    if (method === "DECISION") return "NOT_ALLOWED";
    return "OPTIONAL";
}

export function validateOutcome(input: OutcomeInput, sport: BoutSport, recordedAt: string, t: Translator = english): Checked<BoutOutcome> {
    const fieldErrors: FieldErrors = {};
    const result = (BOUT_RESULTS as readonly string[]).includes(input.result) ? (input.result as BoutResult) : null;
    if (!result) fieldErrors.result = t("boutMsg.outcome.resultRequired");
    const method = (methodsFor(sport) as string[]).includes(input.method) ? (input.method as BoutMethod) : null;
    if (!method) fieldErrors.method = input.method === "SUBMISSION" ? t("boutMsg.outcome.submissionMmaOnly") : t("boutMsg.outcome.methodRequired");

    const roundRaw = input.round.trim();
    let round: number | null = null;
    if (roundRaw) {
        if (!/^\d{1,2}$/.test(roundRaw) || Number(roundRaw) < 1 || Number(roundRaw) > MAX_ROUNDS) {
            fieldErrors.round = t("boutMsg.outcome.round", { max: MAX_ROUNDS });
        } else {
            round = Number(roundRaw);
        }
    }
    const roundRule = roundRuleFor(input.method);
    if (roundRule === "REQUIRED" && !roundRaw) fieldErrors.round = t("boutMsg.outcome.roundRequired");
    if (roundRule === "NOT_ALLOWED" && roundRaw) fieldErrors.round = t("boutMsg.outcome.roundNotAllowed");

    let lossOfConsciousness: LossOfConsciousness | null = null;
    if (asksLossOfConsciousness(input.result, input.method)) {
        if ((LOSS_OF_CONSCIOUSNESS as readonly string[]).includes(input.lossOfConsciousness)) lossOfConsciousness = input.lossOfConsciousness as LossOfConsciousness;
        else fieldErrors.lossOfConsciousness = t("boutMsg.outcome.locRequired");
    }
    let stoppedByHeadStrikes: boolean | null = null;
    if (asksHeadStrikes(input.result, input.method)) {
        if (input.stoppedByHeadStrikes === "yes" || input.stoppedByHeadStrikes === "no") stoppedByHeadStrikes = input.stoppedByHeadStrikes === "yes";
        else fieldErrors.stoppedByHeadStrikes = t("boutMsg.outcome.headStrikesRequired");
    }

    const injuryNote = input.injuryNote.trim();
    const notes = input.notes.trim();
    if (injuryNote.length > OUTCOME_TEXT_MAX) fieldErrors.injuryNote = t("boutMsg.common.textTooLong", { max: OUTCOME_TEXT_MAX });
    if (notes.length > OUTCOME_TEXT_MAX) fieldErrors.notes = t("boutMsg.common.textTooLong", { max: OUTCOME_TEXT_MAX });

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
