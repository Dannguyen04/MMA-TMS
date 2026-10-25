import { z } from "zod";

import { dayKey } from "@/lib/format";

import {
    CANCEL_REASONS,
    type AcuteLoss,
    type BoutOutcome,
    type BoutPhase,
    type CampBout,
    type CancelReason,
    type CompetitionRuleset,
    type HydrationCheck,
    type OfficialWeighIn,
    type RequirementState,
} from "./bout";
import type { RequirementUpdate } from "./bout-rules";
import { SESSION_TYPES, type SessionType } from "./medical-contract";
import { TRAINING_TYPE_FOR, sessionTypeFor } from "./training-contract";
import type { TrainingType } from "./types";
import { kgLabel } from "./weight-input";

/**
 * The bouts service's vocabulary (T-003 §2, T-006 §3–6, Tech spec §2.2–2.4) and request bodies, checked against
 * `nestjs-api/src/bouts/bouts.model.ts`. Fields the contract leaves open are optional so a missing one degrades
 * the screen instead of failing the read.
 */

const PHASES = ["SCHEDULED", "CAMP", "FIGHT_WEEK", "WEIGHED_IN", "COMPLETED", "CANCELLED"] as const;
const REQUIREMENT_STATES = ["MISSING", "PROVIDED", "CONFIRMED", "REJECTED"] as const;
const HYDRATION_CHECKS = ["NOT_APPLICABLE", "PASSED", "FAILED"] as const;
const RESULTS = ["WIN", "LOSS", "DRAW", "NO_CONTEST"] as const;
const METHODS = ["KO", "TKO", "DECISION", "SUBMISSION", "DQ", "OTHER"] as const;
const LOSS_OF_CONSCIOUSNESS = ["NONE", "UNDER_1_MIN", "OVER_1_MIN", "UNKNOWN"] as const;

/** One `bouts.history` entry. T-006 adds the optional fields; entries saved before it have none of them. */
const apiHistoryEntrySchema = z.object({
    at: z.string(),
    by: z.string(),
    from: z.enum(PHASES).nullable(),
    to: z.enum(PHASES),
    reason: z.string().nullable().optional(),
    action: z.string().optional(),
    catchweightKg: z.coerce.number().optional(),
    lossOfConsciousness: z.enum(LOSS_OF_CONSCIOUSNESS).optional(),
    stoppedByHeadStrike: z.boolean().optional(),
    injuryNote: z.string().optional(),
});

const apiAcuteLossSchema = z.object({
    status: z.enum(["EXCEEDED", "WITHIN", "NO_DATA"]),
    startKg: z.coerce.number().nullable(),
    startOn: z.string().nullable(),
    lossPct: z.coerce.number().nullable(),
    limitPct: z.coerce.number(),
});

export const apiRulesetSchema = z.object({
    id: z.string(),
    name: z.string(),
    sport: z.enum(["BOXING", "MUAY_THAI", "KICKBOXING", "MMA"]),
    organizer: z.string().nullable().optional(),
    verified: z.boolean(),
    sourceNote: z.string().nullable().optional(),
    weightClasses: z.array(z.object({ code: z.string(), label: z.string(), limitKg: z.number().nullable() })),
    requirementTemplates: z.array(z.object({ code: z.string(), label: z.string(), required: z.boolean(), validityDays: z.number().nullable().optional() })),
    fightWeekDays: z.number(),
    requirementsDueDays: z.number(),
    acuteWindowDays: z.number(),
    acuteLossLimitPctLong: z.coerce.number(),
    acuteLossLimitPctShort: z.coerce.number(),
    suspensionRules: z.array(z.record(z.string(), z.unknown())).optional(),
    defaultBlockedSessionTypes: z.array(z.string()).optional(),
    restDaysAfterBout: z.number().optional(),
});

export const apiRequirementSchema = z.object({
    code: z.string(),
    label: z.string(),
    required: z.boolean(),
    status: z.enum(REQUIREMENT_STATES),
    issuedOn: z.string().nullable().optional(),
    validUntil: z.string().nullable().optional(),
    source: z.enum(["PRESET", "COACH"]),
    statusReason: z.string().nullable().optional(),
    validityDays: z.number().nullable().optional(),
});

export const apiBoutSchema = z.object({
    id: z.string(),
    fighterId: z.string(),
    coachId: z.string(),
    rulesetId: z.string(),
    eventName: z.string(),
    venue: z.string().nullable().optional(),
    opponentName: z.string().nullable().optional(),
    weightClassCode: z.string(),
    weightLimitKg: z.coerce.number().nullable(),
    catchweightKg: z.coerce.number().nullable().optional(),
    acuteLossLimitPct: z.coerce.number(),
    requirementsDueDays: z.number(),
    weighInAt: z.string(),
    boutAt: z.string(),
    status: z.enum(PHASES),
    trainingPlanId: z.string().nullable().optional(),
    /** T-003 §3: the linked plan's start, or the creation day. Optional until the service sends it. */
    campStartedOn: z.string().nullable().optional(),
    cancelReason: z.string().nullable().optional(),
    notes: z.string().nullable().optional(),
    createdAt: z.string(),
    updatedAt: z.string().optional(),
    history: z.array(apiHistoryEntrySchema).optional(),
    requirements: z.array(apiRequirementSchema).optional(),
    // T-006: the official weigh-in and the result, on the bout row.
    officialWeightKg: z.coerce.number().nullable().optional(),
    madeWeight: z.boolean().nullable().optional(),
    hydrationCheck: z.enum(HYDRATION_CHECKS).nullable().optional(),
    result: z.enum(RESULTS).nullable().optional(),
    method: z.enum(METHODS).nullable().optional(),
    resultRound: z.number().nullable().optional(),
    knockedDown: z.boolean().nullable().optional(),
    /** Only on `GET /bouts/:id`, and null until the official weigh-in (R19). */
    acuteLoss: apiAcuteLossSchema.nullable().optional(),
});

export type ApiRuleset = z.output<typeof apiRulesetSchema>;
export type ApiBout = z.output<typeof apiBoutSchema>;

const isCancelReason = (value: string | null | undefined): value is CancelReason => (CANCEL_REASONS as readonly string[]).includes(value ?? "");
const isSessionType = (value: string): value is SessionType => (SESSION_TYPES as readonly string[]).includes(value);

export function toRuleset(raw: ApiRuleset): CompetitionRuleset {
    return {
        id: raw.id,
        name: raw.name,
        sport: raw.sport,
        organizer: raw.organizer ?? null,
        verified: raw.verified,
        sourceNote: raw.sourceNote ?? null,
        weightClasses: raw.weightClasses,
        requirementTemplates: raw.requirementTemplates.map((template) => ({ ...template, validityDays: template.validityDays ?? null })),
        fightWeekDays: raw.fightWeekDays,
        requirementsDueDays: raw.requirementsDueDays,
        acuteWindowDays: raw.acuteWindowDays,
        acuteLossLimitPctLong: raw.acuteLossLimitPctLong,
        acuteLossLimitPctShort: raw.acuteLossLimitPctShort,
        // Suggestions run on the service once T-007 lands; the screens only need the defaults below.
        suspensionRules: [],
        defaultBlockedSessionTypes: [...new Set((raw.defaultBlockedSessionTypes ?? []).filter(isSessionType).map((type): TrainingType => TRAINING_TYPE_FOR[type]))],
        restDaysAfterBout: raw.restDaysAfterBout ?? 0,
    };
}

/** A bout from the service, with the ruleset it was created from filling what the bout row doesn't repeat. */
export function toCampBout(raw: ApiBout, ruleset: CompetitionRuleset | null): CampBout {
    const weightClass = ruleset?.weightClasses.find((option) => option.code === raw.weightClassCode);
    const createdOn = dayKey(raw.createdAt);
    return {
        id: raw.id,
        fighterId: raw.fighterId,
        coachId: raw.coachId,
        rulesetId: raw.rulesetId,
        rulesetName: ruleset?.name ?? "Ruleset",
        rulesetVerified: ruleset?.verified ?? false,
        sport: ruleset?.sport ?? "MMA",
        event: raw.eventName,
        venue: raw.venue ?? null,
        opponent: raw.opponentName ?? null,
        weightClassCode: raw.weightClassCode,
        weightClassLabel: weightClass?.label ?? (raw.weightLimitKg === null ? raw.weightClassCode : kgLabel(raw.weightLimitKg)),
        limitKg: raw.weightLimitKg,
        catchweightKg: raw.catchweightKg ?? null,
        acuteLossLimitPct: raw.acuteLossLimitPct,
        acuteWindowDays: ruleset?.acuteWindowDays ?? 7,
        requirementsDueDays: raw.requirementsDueDays,
        fightWeekDays: ruleset?.fightWeekDays ?? 7,
        weighInAt: raw.weighInAt,
        boutAt: raw.boutAt,
        phase: raw.status as BoutPhase,
        trainingPlanId: raw.trainingPlanId ?? null,
        campStartedOn: raw.campStartedOn ?? createdOn,
        createdOn,
        notes: raw.notes ?? null,
        cancelReason: isCancelReason(raw.cancelReason) ? raw.cancelReason : null,
        cancelNote: raw.cancelReason && !isCancelReason(raw.cancelReason) ? raw.cancelReason : null,
        requirements: (raw.requirements ?? []).map((item) => ({
            id: item.code,
            code: item.code,
            label: item.label,
            required: item.required,
            state: item.status as RequirementState,
            source: item.source,
            issuedOn: item.issuedOn ?? null,
            validUntil: item.validUntil ?? null,
            statusReason: item.statusReason ?? null,
            validityDays: item.validityDays ?? null,
        })),
        nutritionPlan: { camp: null, fightWeek: null, postWeighIn: null },
        history: (raw.history ?? []).map((entry) => ({ at: entry.at, by: entry.by, from: entry.from, to: entry.to, reason: entry.reason ?? null })),
        weighIn: weighInOf(raw),
        outcome: outcomeOf(raw),
        checklistUnlock: null,
    };
}

const lastEntry = (raw: ApiBout, match: (entry: z.output<typeof apiHistoryEntrySchema>) => boolean) => (raw.history ?? []).filter(match).at(-1);

/** The official weigh-in from the bout row; when it happened comes from the history, the row keeps no time. */
function weighInOf(raw: ApiBout): OfficialWeighIn | null {
    if (raw.officialWeightKg === null || raw.officialWeightKg === undefined) return null;
    const passed = lastEntry(raw, (entry) => entry.to === "WEIGHED_IN");
    const catchweight = lastEntry(raw, (entry) => entry.catchweightKg !== undefined);
    const acuteLoss: AcuteLoss | null = raw.acuteLoss ?? null;
    return {
        weightKg: raw.officialWeightKg,
        madeWeight: raw.madeWeight ?? true,
        hydrationCheck: raw.hydrationCheck ?? null,
        recordedAt: passed?.at ?? raw.updatedAt ?? raw.createdAt,
        catchweightNote: catchweight?.reason ?? null,
        acuteLoss,
    };
}

/** The result; consciousness, head strikes and the injury note live on the history entry that completed the bout. */
function outcomeOf(raw: ApiBout): BoutOutcome | null {
    if (!raw.result || !raw.method) return null;
    const completed = lastEntry(raw, (entry) => entry.to === "COMPLETED");
    return {
        result: raw.result,
        method: raw.method,
        round: raw.resultRound ?? null,
        knockedDown: raw.knockedDown ?? false,
        lossOfConsciousness: completed?.lossOfConsciousness ?? null,
        stoppedByHeadStrikes: completed?.stoppedByHeadStrike ?? null,
        injuryNote: completed?.injuryNote ?? null,
        notes: raw.notes ?? null,
        recordedAt: completed?.at ?? raw.updatedAt ?? raw.createdAt,
    };
}

/** POST /bouts (T-003 §2): a preset class by code, or the coach's own limit for a ruleset without classes. */
export function createBoutBody(input: {
    fighterId: string;
    rulesetId: string;
    event: string;
    venue: string | null;
    opponent: string | null;
    weightClass: { code: string; limitKg: number | null };
    customLimit: boolean;
    weighInAt: string;
    boutAt: string;
}) {
    return {
        fighterId: input.fighterId,
        rulesetId: input.rulesetId,
        eventName: input.event,
        venue: input.venue,
        opponentName: input.opponent,
        ...(input.customLimit ? { weightLimitKg: input.weightClass.limitKg } : { weightClassCode: input.weightClass.code }),
        weighInAt: input.weighInAt,
        boutAt: input.boutAt,
    };
}

/**
 * PATCH /bouts/:id/requirements/:code: `status` is the service's name for the state. In fight week the service
 * takes the change only with an `unlockReason` (T-006 §2).
 */
export function requirementUpdateBody(update: RequirementUpdate, unlockReason: string | null = null) {
    return {
        status: update.state,
        issuedOn: update.issuedOn,
        validUntil: update.validUntil,
        statusReason: update.statusReason,
        ...(unlockReason ? { unlockReason } : {}),
    };
}

/** POST /bouts/:id/weigh-in (T-006 §3). "Not recorded" goes as nothing; the service reads it as NOT_APPLICABLE. */
export function weighInBody(entry: { weightKg: number; hydrationCheck: HydrationCheck | null }) {
    return { weightKg: entry.weightKg, ...(entry.hydrationCheck ? { hydrationCheck: entry.hydrationCheck } : {}) };
}

/** POST /bouts/:id/catchweight (T-006 §3). */
export function catchweightBody(entry: { catchweightKg: number | null; note: string | null }) {
    return { ...(entry.catchweightKg === null ? {} : { catchweightKg: entry.catchweightKg }), ...(entry.note ? { note: entry.note } : {}) };
}

/** POST /bouts/:id/result (T-006 §4). Fields the rules leave out for this result are not sent at all. */
export function resultBody(outcome: BoutOutcome) {
    return {
        result: outcome.result,
        method: outcome.method,
        ...(outcome.round === null ? {} : { resultRound: outcome.round }),
        knockedDown: outcome.knockedDown,
        ...(outcome.lossOfConsciousness === null ? {} : { lossOfConsciousness: outcome.lossOfConsciousness }),
        ...(outcome.stoppedByHeadStrikes === null ? {} : { stoppedByHeadStrike: outcome.stoppedByHeadStrikes }),
        ...(outcome.injuryNote ? { injuryNote: outcome.injuryNote } : {}),
        ...(outcome.notes ? { notes: outcome.notes } : {}),
    };
}

/** What the service answers to an official weigh-in: passed, or what the coach may do next (R18). */
export const apiWeighInBlockSchema = z.object({
    weighIn: z.object({
        outcome: z.enum(["PASSED", "FAILED"]),
        reason: z.enum(["OVER_LIMIT", "HYDRATION_FAILED"]).nullable(),
        overByKg: z.coerce.number().nullable(),
        overByPct: z.coerce.number().nullable(),
        options: z.array(z.enum(["CATCHWEIGHT", "CANCEL"])),
    }),
});

/** The blocked session types in the training service's terms, for a suspension body (T-007). */
export function sessionTypesFor(types: TrainingType[]): SessionType[] {
    return types.map(sessionTypeFor).filter((type): type is SessionType => type !== null);
}
