import "server-only";

import { z } from "zod";

import {
    authenticatedApiRequest,
    authenticatedMutableApiRequest,
    drainAuthenticatedCursorPages,
} from "@/lib/api/client";
import { isDemoAuthEnabled } from "@/lib/auth/constants";
import type {
    Bout,
    BoutRequirement,
    BoutRequirementStatus,
    BoutStatus,
    CompetitionRuleset,
    User,
    WeightTrack,
} from "@/lib/domain/types";
import { isNotFound, nullIfNotFound, unsupportedOperation } from "./api-helpers";
import { platformFeatureAvailable } from "./platform-features";

/* ─── Zod Schemas matching T-003 §2–3 contract ─────────────────────────────── */

export const boutSportSchema = z.enum(["BOXING", "MUAY_THAI", "KICKBOXING", "MMA"]);
export const boutStatusSchema = z.enum(["SCHEDULED", "CAMP", "FIGHT_WEEK", "WEIGHED_IN", "COMPLETED", "CANCELLED"]);
export const boutResultSchema = z.enum(["WIN", "LOSS", "DRAW", "NO_CONTEST"]);
export const boutMethodSchema = z.enum(["KO", "TKO", "DECISION", "SUBMISSION", "DQ", "OTHER"]);
export const boutRequirementStatusSchema = z.enum(["MISSING", "PROVIDED", "CONFIRMED", "REJECTED"]);
export const boutRequirementSourceSchema = z.enum(["PRESET", "COACH"]);
export const weightWarningStatusSchema = z.enum(["ON_TRACK", "ABOVE_TARGET", "OVER_LIMIT", "NOT_WEIGHED", "NEUTRAL"]);

export const rulesetWeightClassSchema = z.object({
    code: z.string(),
    label: z.string(),
    limitKg: z.number(),
});

export const rulesetRequirementTemplateSchema = z.object({
    code: z.string(),
    label: z.string(),
    required: z.boolean(),
    validityDays: z.number().nullable().optional(),
});

export const backendRulesetSchema = z.object({
    id: z.string(),
    name: z.string(),
    sport: boutSportSchema,
    organizer: z.string().nullable().optional(),
    verified: z.boolean(),
    sourceNote: z.string().nullable().optional(),
    weightClasses: z.array(rulesetWeightClassSchema),
    requirementTemplates: z.array(rulesetRequirementTemplateSchema),
    fightWeekDays: z.number(),
    requirementsDueDays: z.number(),
    acuteWindowDays: z.number(),
    acuteLossLimitPctLong: z.number(),
    acuteLossLimitPctShort: z.number(),
    suspensionRules: z.array(z.unknown()),
    defaultBlockedSessionTypes: z.array(z.string()),
    restDaysAfterBout: z.number(),
    createdById: z.string(),
    createdAt: z.string(),
    updatedAt: z.string(),
    deletedAt: z.string().nullable().optional(),
});

export const backendRequirementSchema = z.object({
    id: z.string(),
    boutId: z.string(),
    code: z.string(),
    label: z.string(),
    required: z.boolean(),
    status: boutRequirementStatusSchema,
    issuedOn: z.string().nullable().optional(),
    validUntil: z.string().nullable().optional(),
    source: boutRequirementSourceSchema,
    statusReason: z.string().nullable().optional(),
    updatedById: z.string().nullable().optional(),
    confirmedById: z.string().nullable().optional(),
    confirmedAt: z.string().nullable().optional(),
});

export const backendHistoryEntrySchema = z.object({
    at: z.string(),
    by: z.string(),
    from: boutStatusSchema,
    to: boutStatusSchema,
    reason: z.string().optional(),
});

export const gate1Schema = z.object({
    passed: z.boolean(),
    missing: z.array(z.string()),
    expiring: z.array(z.string()),
});

export const referencePathPointSchema = z.object({
    date: z.string(),
    kg: z.number(),
});

export const weightStatusSummarySchema = z.object({
    latestKg: z.number().nullable(),
    latestOn: z.string().nullable(),
    remainingPct: z.number().nullable(),
    status: weightWarningStatusSchema,
    referencePath: z.array(referencePathPointSchema),
});

export const backendBoutSchema = z.object({
    id: z.string(),
    fighterId: z.string(),
    coachId: z.string(),
    rulesetId: z.string(),
    eventName: z.string(),
    venue: z.string().nullable().optional(),
    opponentName: z.string().nullable().optional(),
    weightClassCode: z.string(),
    weightLimitKg: z.number(),
    acuteLossLimitPct: z.number(),
    requirementsDueDays: z.number(),
    weighInAt: z.string(),
    boutAt: z.string(),
    status: boutStatusSchema,
    trainingPlanId: z.string().nullable().optional(),
    officialWeightKg: z.number().nullable().optional(),
    madeWeight: z.boolean().nullable().optional(),
    catchweightKg: z.number().nullable().optional(),
    hydrationCheck: z.enum(["NOT_APPLICABLE", "PASSED", "FAILED"]).nullable().optional(),
    result: boutResultSchema.nullable().optional(),
    method: boutMethodSchema.nullable().optional(),
    resultRound: z.number().nullable().optional(),
    knockedDown: z.boolean().nullable().optional(),
    cancelReason: z.string().nullable().optional(),
    notes: z.string().nullable().optional(),
    history: z.array(backendHistoryEntrySchema),
    createdById: z.string(),
    createdAt: z.string(),
    updatedAt: z.string(),
    deletedAt: z.string().nullable().optional(),
    requirements: z.array(backendRequirementSchema).optional().default([]),
    // Computed values returned by GET /bouts/:id (T-003 §3)
    daysToWeighIn: z.number().optional(),
    requirementsDueOn: z.string().optional(),
    gate1: gate1Schema.optional(),
    canEnterFightWeek: z.boolean().optional(),
    weight: weightStatusSummarySchema.optional(),
});

export const backendWeightTrackSchema = z.object({
    limitKg: z.number(),
    points: z.array(referencePathPointSchema),
    latestKg: z.number().nullable(),
    latestOn: z.string().nullable(),
    remainingPct: z.number().nullable(),
    status: weightWarningStatusSchema,
    referencePath: z.array(referencePathPointSchema),
});

export type BackendBout = z.infer<typeof backendBoutSchema>;

function toBout(b: BackendBout): Bout {
    return {
        ...b,
        venue: b.venue ?? null,
        opponentName: b.opponentName ?? null,
        trainingPlanId: b.trainingPlanId ?? null,
        officialWeightKg: b.officialWeightKg ?? null,
        madeWeight: b.madeWeight ?? null,
        catchweightKg: b.catchweightKg ?? null,
        hydrationCheck: b.hydrationCheck ?? null,
        result: b.result ?? null,
        method: b.method ?? null,
        resultRound: b.resultRound ?? null,
        knockedDown: b.knockedDown ?? null,
        cancelReason: b.cancelReason ?? null,
        notes: b.notes ?? null,
        deletedAt: b.deletedAt ?? null,
        requirements: b.requirements.map((r) => ({
            ...r,
            issuedOn: r.issuedOn ?? null,
            validUntil: r.validUntil ?? null,
            statusReason: r.statusReason ?? null,
        })),
    };
}

async function demoService(): Promise<typeof import("./bouts.demo")> {
    return import("./bouts.demo");
}

/* ─── Interfaces ──────────────────────────────────────────────────────────── */

export interface BoutFilter {
    fighterIds?: string[] | "all";
    status?: BoutStatus | BoutStatus[];
}

export interface CreateBoutInput {
    fighterId: string;
    coachId: string;
    rulesetId: string;
    eventName: string;
    venue?: string | null;
    opponentName?: string | null;
    weightClassCode: string;
    weightLimitKg: number;
    weighInAt: string;
    boutAt: string;
    requirementsDueDays?: number;
    notes?: string | null;
}

export interface UpdateBoutInput {
    eventName?: string;
    venue?: string | null;
    opponentName?: string | null;
    weightClassCode?: string;
    weightLimitKg?: number;
    requirementsDueDays?: number;
    weighInAt?: string;
    boutAt?: string;
    notes?: string | null;
}

export interface AddRequirementInput {
    code: string;
    label: string;
    required: boolean;
    validityDays?: number | null;
}

export interface UpdateRequirementInput {
    status?: BoutRequirementStatus;
    issuedOn?: string | null;
    validUntil?: string | null;
    label?: string;
    required?: boolean;
    statusReason?: string | null;
}

export type EnterFightWeekResult =
    | { ok: true; bout: Bout }
    | { ok: false; error: string; missing?: string[]; expiring?: string[] };

/* ─── Public Service Methods ──────────────────────────────────────────────── */

export async function listRulesets(): Promise<CompetitionRuleset[]> {
    if (isDemoAuthEnabled()) return (await demoService()).listRulesets();
    if (!platformFeatureAvailable("bouts")) return [];

    const rulesets = await authenticatedApiRequest("/competition-rulesets", z.array(backendRulesetSchema));
    return rulesets.map((r) => ({
        ...r,
        organizer: r.organizer ?? null,
        sourceNote: r.sourceNote ?? null,
        deletedAt: r.deletedAt ?? null,
    }));
}

export async function listBouts(filter: BoutFilter = {}): Promise<Bout[]> {
    if (isDemoAuthEnabled()) return (await demoService()).listBouts(filter);
    if (!platformFeatureAvailable("bouts") || (Array.isArray(filter.fighterIds) && filter.fighterIds.length === 0)) return [];

    const params = new URLSearchParams();
    if (Array.isArray(filter.fighterIds)) {
        filter.fighterIds.forEach((id) => params.append("fighterId", id));
    }
    const statuses = filter.status === undefined ? [] : Array.isArray(filter.status) ? filter.status : [filter.status];
    statuses.forEach((s) => params.append("status", s));

    const query = params.toString();
    const bouts = await drainAuthenticatedCursorPages(`/bouts${query ? `?${query}` : ""}`, backendBoutSchema);
    return bouts.map(toBout);
}

export async function getBout(id: string): Promise<Bout | null> {
    if (isDemoAuthEnabled()) return (await demoService()).getBout(id);
    if (!platformFeatureAvailable("bouts")) return null;

    const bout = await nullIfNotFound(authenticatedApiRequest(`/bouts/${encodeURIComponent(id)}`, backendBoutSchema));
    return bout ? toBout(bout) : null;
}

export async function createBout(input: CreateBoutInput, actor: User): Promise<Bout> {
    if (isDemoAuthEnabled()) return (await demoService()).createBout(input, actor);
    if (!platformFeatureAvailable("bouts")) unsupportedOperation("Creating a bout", "bouts");

    const bout = await authenticatedMutableApiRequest("/bouts", backendBoutSchema, {
        method: "POST",
        body: JSON.stringify(input),
    });
    return toBout(bout);
}

export async function updateBout(id: string, input: UpdateBoutInput, actor: User): Promise<Bout | null> {
    if (isDemoAuthEnabled()) return (await demoService()).updateBout(id, input, actor);
    if (!platformFeatureAvailable("bouts")) unsupportedOperation("Updating a bout", "bouts");

    const bout = await nullIfNotFound(
        authenticatedMutableApiRequest(`/bouts/${encodeURIComponent(id)}`, backendBoutSchema, {
            method: "PATCH",
            body: JSON.stringify(input),
        }),
    );
    return bout ? toBout(bout) : null;
}

export async function linkCamp(id: string, trainingPlanId: string, actor: User): Promise<Bout | null> {
    if (isDemoAuthEnabled()) return (await demoService()).linkCamp(id, trainingPlanId, actor);
    if (!platformFeatureAvailable("bouts")) unsupportedOperation("Linking training camp to bout", "bouts");

    const bout = await nullIfNotFound(
        authenticatedMutableApiRequest(`/bouts/${encodeURIComponent(id)}/camp`, backendBoutSchema, {
            method: "POST",
            body: JSON.stringify({ trainingPlanId }),
        }),
    );
    return bout ? toBout(bout) : null;
}

export async function enterFightWeek(id: string, actor: User): Promise<EnterFightWeekResult> {
    if (isDemoAuthEnabled()) return (await demoService()).enterFightWeek(id, actor);
    if (!platformFeatureAvailable("bouts")) unsupportedOperation("Entering fight week", "bouts");

    try {
        const bout = await authenticatedMutableApiRequest(`/bouts/${encodeURIComponent(id)}/fight-week`, backendBoutSchema, {
            method: "POST",
        });
        return { ok: true, bout: toBout(bout) };
    } catch (error: unknown) {
        const err = error as { status?: number; responseBody?: { code?: string; missing?: string[]; expiring?: string[] } };
        if (err?.status === 409) {
            const body = err?.responseBody ?? {};
            return {
                ok: false,
                error: body.code ?? "BOUT_REQUIREMENTS_INCOMPLETE",
                missing: body.missing ?? [],
                expiring: body.expiring ?? [],
            };
        }
        throw error;
    }
}

export async function cancelBout(id: string, reason: string, actor: User): Promise<Bout | null> {
    if (isDemoAuthEnabled()) return (await demoService()).cancelBout(id, reason, actor);
    if (!platformFeatureAvailable("bouts")) unsupportedOperation("Cancelling a bout", "bouts");

    const bout = await nullIfNotFound(
        authenticatedMutableApiRequest(`/bouts/${encodeURIComponent(id)}/cancel`, backendBoutSchema, {
            method: "POST",
            body: JSON.stringify({ reason }),
        }),
    );
    return bout ? toBout(bout) : null;
}

export async function addRequirement(id: string, input: AddRequirementInput, actor: User): Promise<BoutRequirement | null> {
    if (isDemoAuthEnabled()) return (await demoService()).addRequirement(id, input, actor);
    if (!platformFeatureAvailable("bouts")) unsupportedOperation("Adding requirement", "bouts");

    const req = await nullIfNotFound(
        authenticatedMutableApiRequest(`/bouts/${encodeURIComponent(id)}/requirements`, backendRequirementSchema, {
            method: "POST",
            body: JSON.stringify(input),
        }),
    );
    return req
        ? {
              ...req,
              issuedOn: req.issuedOn ?? null,
              validUntil: req.validUntil ?? null,
              statusReason: req.statusReason ?? null,
          }
        : null;
}

export async function updateRequirement(
    id: string,
    code: string,
    input: UpdateRequirementInput,
    actor: User,
): Promise<BoutRequirement | null> {
    if (isDemoAuthEnabled()) return (await demoService()).updateRequirement(id, code, input, actor);
    if (!platformFeatureAvailable("bouts")) unsupportedOperation("Updating requirement", "bouts");

    const req = await nullIfNotFound(
        authenticatedMutableApiRequest(
            `/bouts/${encodeURIComponent(id)}/requirements/${encodeURIComponent(code)}`,
            backendRequirementSchema,
            {
                method: "PATCH",
                body: JSON.stringify(input),
            },
        ),
    );
    return req
        ? {
              ...req,
              issuedOn: req.issuedOn ?? null,
              validUntil: req.validUntil ?? null,
              statusReason: req.statusReason ?? null,
          }
        : null;
}

export async function removeRequirement(id: string, code: string, actor: User): Promise<boolean> {
    if (isDemoAuthEnabled()) return (await demoService()).removeRequirement(id, code, actor);
    if (!platformFeatureAvailable("bouts")) unsupportedOperation("Removing requirement", "bouts");

    try {
        await authenticatedMutableApiRequest(
            `/bouts/${encodeURIComponent(id)}/requirements/${encodeURIComponent(code)}`,
            z.null(),
            { method: "DELETE" },
        );
        return true;
    } catch (error) {
        if (isNotFound(error)) return false;
        throw error;
    }
}

export async function getWeightTrack(id: string): Promise<WeightTrack | null> {
    if (isDemoAuthEnabled()) return (await demoService()).getWeightTrack(id);
    if (!platformFeatureAvailable("bouts")) return null;

    return nullIfNotFound(
        authenticatedApiRequest(`/bouts/${encodeURIComponent(id)}/weight-track`, backendWeightTrackSchema),
    );
}
