import type { TrainingType } from "./types";
import type { PlanAdherence } from "./weight-chart";

/**
 * A bout and its camp, in the frontend's terms. Field names follow the bouts contract (T-003 §2–3) where the
 * contract has one; `event`, `opponent`, `limitKg`, `phase` and `state` predate it and the API adapter maps them.
 */

/** Bout lifecycle. Running camps are the first four. */
export type BoutPhase = "SCHEDULED" | "CAMP" | "FIGHT_WEEK" | "WEIGHED_IN" | "COMPLETED" | "CANCELLED";

export const BOUT_PHASES = ["SCHEDULED", "CAMP", "FIGHT_WEEK", "WEIGHED_IN", "COMPLETED", "CANCELLED"] as const satisfies readonly BoutPhase[];

export type BoutSport = "BOXING" | "MUAY_THAI" | "KICKBOXING" | "MMA";

export type RequirementState = "MISSING" | "PROVIDED" | "CONFIRMED" | "REJECTED";

/** Who put an item on the checklist: the ruleset, or the coach from the event's notice ("Coach-entered, not verified"). */
export type RequirementSource = "PRESET" | "COACH";

export interface WeightClassOption {
    code: string;
    label: string;
    /** Upper limit in kg. Null for an open class ("Over 120 kg"). */
    limitKg: number | null;
}

export interface RequirementTemplate {
    code: string;
    label: string;
    required: boolean;
    validityDays: number | null;
}

export type SuspensionReason = "KO" | "TKO" | "DQ" | "MANDATORY_REST" | "MEDICAL" | "OTHER";

export type LossOfConsciousness = "NONE" | "UNDER_1_MIN" | "OVER_1_MIN" | "UNKNOWN";

/**
 * One suggestion rule from a ruleset (Tech spec §2.2). A rule matches when every condition it states holds;
 * the app suggests the longest matching rule.
 */
export interface SuspensionRule {
    reason?: SuspensionReason[];
    /** Earlier KO/TKO suspensions within `withinDays` days needed for the rule to apply. */
    priorCount?: number;
    withinDays?: number;
    loc?: LossOfConsciousness;
    minDays: number;
}

export interface CompetitionRuleset {
    id: string;
    name: string;
    sport: BoutSport;
    organizer: string | null;
    /** False for a reference preset the team could not check with the organiser. */
    verified: boolean;
    sourceNote: string | null;
    /** Empty for "Custom": the coach types the limit in kg. */
    weightClasses: WeightClassOption[];
    requirementTemplates: RequirementTemplate[];
    fightWeekDays: number;
    requirementsDueDays: number;
    acuteWindowDays: number;
    /** Acute-loss limit when the weigh-in is 12 hours or more before the bout. */
    acuteLossLimitPctLong: number;
    /** Acute-loss limit when the weigh-in is under 12 hours before the bout. */
    acuteLossLimitPctShort: number;
    suspensionRules: SuspensionRule[];
    defaultBlockedSessionTypes: TrainingType[];
    restDaysAfterBout: number;
}

export interface BoutRequirement {
    /** Stable key of the item on this bout; the same as `code`. */
    id: string;
    code: string;
    label: string;
    required: boolean;
    state: RequirementState;
    source: RequirementSource;
    issuedOn: string | null;
    validUntil: string | null;
    /** Why the item was rejected. */
    statusReason: string | null;
    /** How long a document stays valid, used to suggest `validUntil` from `issuedOn`. */
    validityDays: number | null;
}

/** Text a coach, or a specialist they name, typed. The app does not calculate a diet. */
export interface NutritionNote {
    text: string;
    authorName: string;
    updatedAt: string;
}

export interface NutritionPlan {
    camp: NutritionNote | null;
    fightWeek: NutritionNote | null;
    postWeighIn: NutritionNote | null;
}

export type NutritionPhaseKey = keyof NutritionPlan;

/** One status change, as `bouts.history` records it. */
export interface BoutHistoryEntry {
    at: string;
    /** Name of the person who made the change. */
    by: string;
    from: BoutPhase | null;
    to: BoutPhase;
    reason?: string | null;
}

export type CancelReason = "OPPONENT_WITHDREW" | "INJURY" | "MISSED_WEIGHT" | "DOCUMENTS" | "ORGANISER_CANCELLED" | "OTHER";

export const CANCEL_REASONS = [
    "OPPONENT_WITHDREW",
    "INJURY",
    "MISSED_WEIGHT",
    "DOCUMENTS",
    "ORGANISER_CANCELLED",
    "OTHER",
] as const satisfies readonly CancelReason[];

export type HydrationCheck = "NOT_APPLICABLE" | "PASSED" | "FAILED";

export type BoutResult = "WIN" | "LOSS" | "DRAW" | "NO_CONTEST";

export type BoutMethod = "KO" | "TKO" | "DECISION" | "SUBMISSION" | "DQ" | "OTHER";

/** The official weigh-in (F5). */
export interface OfficialWeighIn {
    weightKg: number;
    madeWeight: boolean;
    hydrationCheck: HydrationCheck | null;
    recordedAt: string;
    /** Set when the coach went on at a catchweight after missing the limit. */
    catchweightNote: string | null;
}

/** How the bout ended (F6). */
export interface BoutOutcome {
    result: BoutResult;
    method: BoutMethod;
    round: number | null;
    knockedDown: boolean;
    /** Asked only after a KO or TKO loss. */
    lossOfConsciousness: LossOfConsciousness | null;
    /** Asked only after a TKO loss (H3). */
    stoppedByHeadStrikes: boolean | null;
    /** What the coach saw; not an injury record (H2). */
    injuryNote: string | null;
    notes: string | null;
    recordedAt: string;
}

export interface CampBout {
    id: string;
    fighterId: string;
    coachId: string;
    rulesetId: string;
    rulesetName: string;
    rulesetVerified: boolean;
    sport: BoutSport;
    event: string;
    venue: string | null;
    opponent: string | null;
    weightClassCode: string;
    /** "60 kg", or "63.5 kg" for a custom limit. */
    weightClassLabel: string;
    /** Agreed limit in kg; null for an open class. A catchweight replaces it. */
    limitKg: number | null;
    catchweightKg: number | null;
    acuteLossLimitPct: number;
    acuteWindowDays: number;
    requirementsDueDays: number;
    fightWeekDays: number;
    weighInAt: string;
    boutAt: string;
    phase: BoutPhase;
    trainingPlanId: string | null;
    /** Academy date the camp started: the linked plan's start, or the day the bout was created. */
    campStartedOn: string;
    createdOn: string;
    notes: string | null;
    cancelReason: CancelReason | null;
    cancelNote: string | null;
    requirements: BoutRequirement[];
    nutritionPlan: NutritionPlan;
    history: BoutHistoryEntry[];
    weighIn: OfficialWeighIn | null;
    outcome: BoutOutcome | null;
    /** F5: the checklist locks in fight week; a coach can reopen it with a reason. */
    checklistUnlock: { at: string; by: string; reason: string } | null;
}

export interface NutritionCheckin {
    boutId: string;
    /** Academy date the question is about (yesterday). */
    academyDate: string;
    /** Academy date the fighter answered. */
    loggedOn: string;
    adherence: PlanAdherence;
    note: string | null;
    recordedAt: string;
}

export interface Suspension {
    id: string;
    fighterId: string;
    /** Null for a suspension entered by hand, e.g. after a knockout in sparring. */
    boutId: string | null;
    reason: SuspensionReason;
    startsOn: string;
    endsOn: string;
    lossOfConsciousness: LossOfConsciousness | null;
    /** What the ruleset suggested; null when it has no rule and the coach chose the days. */
    suggestedDays: number | null;
    /** Required when the days differ from the suggestion. */
    overrideReason: string | null;
    blockedSessionTypes: TrainingType[];
    /** True when someone has to confirm the fighter may train again after `endsOn`. */
    requiresClearance: boolean;
    clearedAt: string | null;
    clearedBy: string | null;
    clearanceNote: string | null;
    createdBy: string;
    createdAt: string;
    note: string | null;
}

export function isRunningPhase(phase: BoutPhase): boolean {
    return phase === "SCHEDULED" || phase === "CAMP" || phase === "FIGHT_WEEK" || phase === "WEIGHED_IN";
}

/** Camp, fight week or weighed in: the phases a fighter can have only one bout in at a time. */
export function isActivePhase(phase: BoutPhase): boolean {
    return phase === "CAMP" || phase === "FIGHT_WEEK" || phase === "WEIGHED_IN";
}

export function isReadyState(state: RequirementState): boolean {
    return state === "PROVIDED" || state === "CONFIRMED";
}

/** The limit the scale is judged against: the catchweight once agreed, otherwise the class limit. */
export function boutLimitKg(bout: Pick<CampBout, "catchweightKg" | "limitKg">): number | null {
    return bout.catchweightKg ?? bout.limitKg;
}
