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
    ReadinessRow,
    Suspension,
    SuspensionCreation,
    SuspensionReason,
    User,
} from "@/lib/domain/types";
import { queryPath } from "./api-helpers";
import { listCampBouts, weightWarningStatusSchema } from "./bouts";

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
    };
}

export function toSuspensionCreation(raw: z.infer<typeof backendCreateSuspensionResponseSchema>): SuspensionCreation {
    return toSuspension(raw) as SuspensionCreation;
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

export async function getReadiness(
    filter: ReadinessFilter = {},
    actor?: User,
): Promise<ReadinessRow[]> {
    if (isDemoAuthEnabled()) return (await demoService()).getReadiness(filter, actor);

    const rows = await authenticatedApiRequest(
        queryPath("/readiness", { weightLimitKg: filter.weightLimitKg, rulesetId: filter.rulesetId, boutOn: filter.boutOn }),
        z.array(backendReadinessRowSchema),
    );
    return rows.map(toReadinessRow);
}

/**
 * Event names of the bouts suspensions point at. Demo mode reads the suspensions store's own bouts, the ones its
 * sample suspensions were made from (T-030 B); API mode asks the bouts service.
 */
export async function suspensionBoutNames(fighterIds: string[] | "all"): Promise<Map<string, string>> {
    if (isDemoAuthEnabled()) {
        const { db } = await import("@/lib/mocks/db");
        return new Map(db().bouts.filter((bout) => fighterIds === "all" || fighterIds.includes(bout.fighterId)).map((bout) => [bout.id, bout.eventName]));
    }
    return new Map((await listCampBouts(fighterIds)).map((bout) => [bout.id, bout.event]));
}
