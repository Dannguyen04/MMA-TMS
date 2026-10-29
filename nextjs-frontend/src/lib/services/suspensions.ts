import "server-only";

import { z } from "zod";

import {
    ApiError,
    authenticatedApiRequest,
    authenticatedMutableApiRequest,
} from "@/lib/api/client";
import { isDemoAuthEnabled } from "@/lib/auth/constants";
import { SESSION_TYPES, type SessionType } from "@/lib/domain/medical-contract";
import type {
    ConflictAction,
    ConflictProposal,
    ReadinessRow,
    Suspension,
    SuspensionCreation,
    SuspensionReason,
    TrainingSession,
    User,
} from "@/lib/domain/types";
import { backendSessionSchema, toSession } from "./training";
import { weightWarningStatusSchema } from "./bouts";

/* ─── Zod Schemas matching backend contract ───────────────────────────────── */

export const backendGradedReturnSchema = z.object({
    ceiling: z.union([z.literal(3), z.literal(4)]),
    fullReturnOn: z.string(),
});

export const backendConflictActionSchema = z.enum(["PENDING", "CANCEL"]);

export const backendAffectedSessionSchema = z.object({
    sessionId: z.string(),
    action: backendConflictActionSchema,
});

export const backendAffectedPlanSchema = z.object({
    planId: z.string(),
    fromPhase: z.enum(["base", "build", "fight_camp", "taper", "rehab", "maintenance"]),
    toPhase: z.enum(["base", "build", "fight_camp", "taper", "rehab", "maintenance"]),
});

export const backendSuspensionSchema = z.object({
    id: z.string(),
    fighterId: z.string(),
    boutId: z.string().nullable(),
    reason: z.enum(["KO", "TKO", "DQ", "MANDATORY_REST", "MEDICAL", "OTHER"]),
    startsOn: z.string(),
    endsOn: z.string(),
    lossOfConsciousness: z.enum(["NONE", "UNDER_1_MIN", "OVER_1_MIN", "UNKNOWN"]).nullable(),
    suggestedDays: z.number().int().nullable(),
    overrideReason: z.string().nullable(),
    blockedSessionTypes: z.array(z.enum(SESSION_TYPES)),
    maxAllowedTier: z.number().int().min(0).max(5),
    requiresClearance: z.boolean(),
    clearedAt: z.string().nullable(),
    clearedById: z.string().nullable(),
    clearanceNote: z.string().nullable(),
    createdById: z.string(),
    createdAt: z.string(),
    updatedAt: z.string(),
    status: z.enum(["UPCOMING", "ACTIVE", "AWAITING_CLEARANCE", "ENDED"]),
    gradedReturn: backendGradedReturnSchema.nullable(),
    affectedSessions: z.array(backendAffectedSessionSchema).optional(),
    affectedPlans: z.array(backendAffectedPlanSchema).optional(),
});

export const backendCreateSuspensionResponseSchema = backendSuspensionSchema.extend({
    affectedSessions: z.array(backendAffectedSessionSchema),
    affectedPlans: z.array(backendAffectedPlanSchema),
});

export const backendSuspensionListSchema = z.object({
    data: z.array(backendSuspensionSchema),
    hasNextPage: z.boolean(),
    nextCursor: z.string().nullable(),
});

export const backendConflictProposalSchema = z.object({
    sessionId: z.string(),
    action: backendConflictActionSchema,
});

export const backendReadinessSuspensionSchema = z.object({
    startsOn: z.string(),
    endsOn: z.string(),
    blockedSessionTypes: z.array(z.enum(SESSION_TYPES)),
    allowedSessionTypes: z.array(z.enum(SESSION_TYPES)),
    expectedResumeOn: z.string().nullable(),
    fullReturnOn: z.string().nullable().optional(),
    gradedReturn: backendGradedReturnSchema.nullable().optional(),
});

export const backendReadinessRowSchema = z.object({
    fighterId: z.string(),
    fighterName: z.string(),
    ready: z.boolean(),
    status: z.enum(["SUSPENDED", "AWAITING_CLEARANCE", "IN_BOUT", "READY"]),
    latestWeightKg: z.number().nullable(),
    latestWeightOn: z.string().nullable(),
    activeBout: z
        .object({
            id: z.string(),
            eventName: z.string(),
            status: z.enum(["SCHEDULED", "CAMP", "FIGHT_WEEK", "WEIGHED_IN", "COMPLETED", "CANCELLED"]),
            boutAt: z.string(),
        })
        .nullable(),
    suspension: backendReadinessSuspensionSchema.nullable(),
    fullReturnOn: z.string().nullable(),
    gradedReturn: backendGradedReturnSchema.nullable(),
    notReadyReasons: z.array(z.enum(["SUSPENDED_PAST_BOUT_DATE", "ACTIVE_BOUT"])).optional(),
    feasibility: z
        .object({
            status: weightWarningStatusSchema,
            remainingPct: z.number().nullable(),
            latestKg: z.number().nullable(),
            latestOn: z.string().nullable(),
            daysToWeighIn: z.number().int(),
        })
        .optional(),
});

/* ─── Mapping Functions ───────────────────────────────────────────────────── */

function mapConflictAction(action: "PENDING" | "CANCEL"): ConflictAction {
    return action === "PENDING" ? "pending" : "cancel";
}

export function toSuspension(raw: z.infer<typeof backendSuspensionSchema>): Suspension {
    return {
        ...raw,
        affectedSessions: raw.affectedSessions?.map((s) => ({
            sessionId: s.sessionId,
            action: mapConflictAction(s.action),
        })),
        affectedPlans: raw.affectedPlans?.map((p) => ({
            planId: p.planId,
            fromPhase: p.fromPhase,
            toPhase: p.toPhase,
        })),
    };
}

export function toSuspensionCreation(raw: z.infer<typeof backendCreateSuspensionResponseSchema>): SuspensionCreation {
    return {
        ...toSuspension(raw),
        affectedSessions: raw.affectedSessions.map((s) => ({
            sessionId: s.sessionId,
            action: mapConflictAction(s.action),
        })),
        affectedPlans: raw.affectedPlans.map((p) => ({
            planId: p.planId,
            fromPhase: p.fromPhase,
            toPhase: p.toPhase,
        })),
    };
}

export function toReadinessRow(raw: z.infer<typeof backendReadinessRowSchema>): ReadinessRow {
    return {
        ...raw,
        suspension: raw.suspension
            ? {
                  ...raw.suspension,
                  fullReturnOn: raw.suspension.fullReturnOn ?? null,
                  gradedReturn: raw.suspension.gradedReturn ?? null,
              }
            : null,
        feasibility: raw.feasibility,
    };
}

/* ─── Input Types ─────────────────────────────────────────────────────────── */

export interface SuspensionFilter {
    fighterId?: string;
    fighterIds?: string[];
    active?: boolean;
}

export interface CreateSuspensionInput {
    fighterId: string;
    reason: SuspensionReason;
    days: number;
    startsOn?: string;
    blockedSessionTypes?: SessionType[];
    maxTier?: number;
    requiresClearance?: boolean;
    lossOfConsciousness?: "NONE" | "UNDER_1_MIN" | "OVER_1_MIN" | "UNKNOWN" | null;
}

export interface ReadinessFilter {
    weightLimitKg?: number;
    rulesetId?: string;
    boutOn?: string;
}

/* ─── Demo Service Import ─────────────────────────────────────────────────── */

async function demoService(): Promise<typeof import("./suspensions.demo")> {
    return import("./suspensions.demo");
}

/* ─── Public Service Methods ──────────────────────────────────────────────── */

export async function listSuspensions(
    filter: SuspensionFilter = {},
    actor?: User,
): Promise<Suspension[]> {
    if (isDemoAuthEnabled()) return (await demoService()).listSuspensions(filter, actor);
    if (Array.isArray(filter.fighterIds) && filter.fighterIds.length === 0) return [];

    const params = new URLSearchParams();
    params.set("limit", "100");

    const fighterIds = filter.fighterIds ?? (filter.fighterId ? [filter.fighterId] : undefined);
    if (fighterIds && fighterIds.length === 1) {
        params.set("fighterId", fighterIds[0]);
    }
    if (filter.active !== undefined) {
        params.set("active", String(filter.active));
    }

    // Drain cursor pages according to backend pagination contract
    const MAX_PAGES = 25;
    const MAX_ITEMS = 500;
    const items: Suspension[] = [];
    const seenCursors = new Set<string>();
    let cursor: string | null = null;

    for (let page = 1; page <= MAX_PAGES; page += 1) {
        const pageParams = new URLSearchParams(params);
        if (cursor) pageParams.set("cursor", cursor);
        const query = pageParams.toString();
        const res = await authenticatedApiRequest(
            `/suspensions${query ? `?${query}` : ""}`,
            backendSuspensionListSchema,
        );
        items.push(...res.data.map(toSuspension));
        if (items.length > MAX_ITEMS) {
            throw new ApiError({
                message: `The service returned more than the configured ${MAX_ITEMS} item limit.`,
                kind: "invalid_response",
                code: "PAGINATION_LIMIT_EXCEEDED",
            });
        }
        if (!res.hasNextPage) break;
        const nextCursor = res.nextCursor;
        if (!nextCursor || seenCursors.has(nextCursor)) {
            throw new ApiError({
                message: "The service returned an invalid pagination cursor.",
                kind: "invalid_response",
            });
        }
        seenCursors.add(nextCursor);
        cursor = nextCursor;
        if (page === MAX_PAGES) {
            throw new ApiError({
                message: `The service exceeded the configured ${MAX_PAGES} page limit.`,
                kind: "invalid_response",
                code: "PAGINATION_LIMIT_EXCEEDED",
            });
        }
    }

    if (fighterIds && fighterIds.length > 0) {
        const allowed = new Set(fighterIds);
        return items.filter((s) => allowed.has(s.fighterId));
    }

    return items;
}

export async function createSuspension(input: CreateSuspensionInput, actor: User): Promise<SuspensionCreation> {
    if (isDemoAuthEnabled()) return (await demoService()).createSuspension(input, actor);

    const body = await authenticatedMutableApiRequest(
        "/suspensions",
        backendCreateSuspensionResponseSchema,
        {
            method: "POST",
            body: JSON.stringify(input),
        },
    );
    return toSuspensionCreation(body);
}

export async function clearSuspension(id: string, clearanceNote: string, actor: User): Promise<Suspension> {
    if (isDemoAuthEnabled()) return (await demoService()).clearSuspension(id, clearanceNote, actor);

    const body = await authenticatedMutableApiRequest(
        `/suspensions/${encodeURIComponent(id)}/clear`,
        backendSuspensionSchema,
        {
            method: "POST",
            body: JSON.stringify({ clearanceNote }),
        },
    );
    return toSuspension(body);
}

export async function getSuspension(id: string, actor?: User): Promise<Suspension | null> {
    if (isDemoAuthEnabled()) return (await demoService()).getSuspension(id, actor);

    const items = await listSuspensions({}, actor);
    return items.find((s) => s.id === id) ?? null;
}

export async function listConflicts(id: string, actor: User): Promise<ConflictProposal[]> {
    if (isDemoAuthEnabled()) return (await demoService()).listConflicts(id, actor);

    const proposals = await authenticatedApiRequest(
        `/suspensions/${encodeURIComponent(id)}/conflicts`,
        z.array(backendConflictProposalSchema),
    );
    return proposals.map((p) => ({
        sessionId: p.sessionId,
        action: mapConflictAction(p.action),
    }));
}

export async function applyConflicts(
    id: string,
    sessionIds: string[],
    actor: User,
): Promise<TrainingSession[]> {
    if (isDemoAuthEnabled()) return (await demoService()).applyConflicts(id, sessionIds, actor);

    const rawSessions = await authenticatedMutableApiRequest(
        `/suspensions/${encodeURIComponent(id)}/conflicts/apply`,
        z.array(backendSessionSchema),
        {
            method: "POST",
            body: JSON.stringify({ sessionIds }),
        },
    );
    return rawSessions.map(toSession);
}

export async function getReadiness(
    filter: ReadinessFilter = {},
    actor?: User,
): Promise<ReadinessRow[]> {
    if (isDemoAuthEnabled()) return (await demoService()).getReadiness(filter, actor);

    const params = new URLSearchParams();
    if (filter.weightLimitKg !== undefined) params.append("weightLimitKg", String(filter.weightLimitKg));
    if (filter.rulesetId) params.append("rulesetId", filter.rulesetId);
    if (filter.boutOn) params.append("boutOn", filter.boutOn);

    const query = params.toString();
    const rows = await authenticatedApiRequest(
        `/readiness${query ? `?${query}` : ""}`,
        z.array(backendReadinessRowSchema),
    );
    return rows.map(toReadinessRow);
}
