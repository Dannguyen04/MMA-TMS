import { z } from "zod";

import { dayKey } from "@/lib/format";

import { CANCEL_REASONS, type BoutPhase, type CampBout, type CancelReason, type CompetitionRuleset, type RequirementState } from "./bout";
import type { RequirementUpdate } from "./bout-rules";
import { SESSION_TYPES, type SessionType } from "./medical-contract";
import { TRAINING_TYPE_FOR, sessionTypeFor } from "./training-contract";
import type { TrainingType } from "./types";
import { kgLabel } from "./weight-input";

/**
 * The bouts service's vocabulary (T-003 §2, Tech spec §2.2–2.4) and request bodies. Not yet checked against a
 * running backend: T-003 is not on this branch. Every schema follows the camelCase the ticket names; fields the
 * contract leaves open are optional so a missing one degrades the screen instead of failing the read.
 */

const PHASES = ["SCHEDULED", "CAMP", "FIGHT_WEEK", "WEIGHED_IN", "COMPLETED", "CANCELLED"] as const;
const REQUIREMENT_STATES = ["MISSING", "PROVIDED", "CONFIRMED", "REJECTED"] as const;

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
    history: z.array(z.object({ at: z.string(), by: z.string(), from: z.enum(PHASES).nullable(), to: z.enum(PHASES), reason: z.string().nullable().optional() })).optional(),
    requirements: z.array(apiRequirementSchema).optional(),
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
        history: (raw.history ?? []).map((entry) => ({ ...entry, reason: entry.reason ?? null })),
        weighIn: null,
        outcome: null,
        checklistUnlock: null,
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

/** PATCH /bouts/:id/requirements/:code: `status` is the service's name for the state. */
export function requirementUpdateBody(update: RequirementUpdate) {
    return { status: update.state, issuedOn: update.issuedOn, validUntil: update.validUntil, statusReason: update.statusReason };
}

/** The blocked session types in the training service's terms, for a suspension body (T-007). */
export function sessionTypesFor(types: TrainingType[]): SessionType[] {
    return types.map(sessionTypeFor).filter((type): type is SessionType => type !== null);
}
