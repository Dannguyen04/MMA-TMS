import "server-only";

import { ApiError } from "@/lib/api/client";
import { accessibleFighterIds, canAccessFighter } from "@/lib/auth/access";
import {
    blockedTypesForMaxTier,
    DEFAULT_MANUAL_BLOCKED_SESSION_TYPES,
    maxAllowedTier,
} from "@/lib/domain/intensity-tiers";
import { type SessionType } from "@/lib/domain/medical-contract";
import {
    academyDateOf,
    addDaysToDate,
    applySuspensionSideEffects,
    classifyReadiness,
    daysBetweenDates,
    deriveRequiresClearance,
    endsOnFor,
    filterProposalsForSuspension,
    gradedReturnFor,
    isInForceOn,
    planConflicts,
    suspensionStatusOn,
} from "@/lib/domain/suspension-rules";
import { sessionTypeFor } from "@/lib/domain/training-contract";
import type {
    CompetitionRuleset,
    ConflictProposal,
    ReadinessRow,
    Suspension,
    SuspensionCreation,
    TrainingSession,
    User,
} from "@/lib/domain/types";
import { db, newId, nowIso } from "@/lib/mocks/db";
import type { CreateSuspensionInput, ReadinessFilter, SuspensionFilter } from "./suspensions";

// Re-export pure helpers for any test convenience
export {
    academyDateOf,
    addDaysToDate,
    daysBetweenDates,
    deriveRequiresClearance,
    endsOnFor,
    gradedReturnFor,
    isInForceOn,
    suspensionStatusOn,
};

function resolveSuspensionStatusAndGradedReturn(s: Suspension, today: string): Suspension {
    const status = suspensionStatusOn(s, today);
    const gradedReturn = gradedReturnFor(s, today);
    return {
        ...s,
        status,
        gradedReturn,
    };
}

/* ─── Public Demo Service Methods ─────────────────────────────────────────── */

export async function listSuspensions(
    filter: SuspensionFilter = {},
    actor?: User,
): Promise<Suspension[]> {
    const today = academyDateOf(new Date());
    const store = db().suspensions ?? [];
    let items = store.map((s) => resolveSuspensionStatusAndGradedReturn(s, today));

    // Actor visibility scoping
    if (actor) {
        if (actor.role === "fighter") {
            if (filter.fighterId && filter.fighterId !== actor.profileId) {
                throw new ApiError({
                    message: "Forbidden",
                    kind: "http",
                    status: 403,
                    code: "FORBIDDEN",
                });
            }
            if (filter.fighterIds && filter.fighterIds.some((id) => id !== actor.profileId)) {
                throw new ApiError({
                    message: "Forbidden",
                    kind: "http",
                    status: 403,
                    code: "FORBIDDEN",
                });
            }
            items = items.filter((s) => s.fighterId === actor.profileId);
        } else if (actor.role === "coach" || actor.role === "doctor") {
            const allowed = accessibleFighterIds(actor);
            if (Array.isArray(allowed)) {
                if (filter.fighterId && !allowed.includes(filter.fighterId)) {
                    throw new ApiError({
                        message: "Forbidden",
                        kind: "http",
                        status: 403,
                        code: "FORBIDDEN",
                    });
                }
                if (filter.fighterIds && filter.fighterIds.some((id) => !allowed.includes(id))) {
                    throw new ApiError({
                        message: "Forbidden",
                        kind: "http",
                        status: 403,
                        code: "FORBIDDEN",
                    });
                }
                items = items.filter((s) => allowed.includes(s.fighterId));
            }
        }
    }

    if (filter.fighterId) {
        items = items.filter((s) => s.fighterId === filter.fighterId);
    } else if (Array.isArray(filter.fighterIds)) {
        items = items.filter((s) => filter.fighterIds!.includes(s.fighterId));
    }

    if (filter.active !== undefined) {
        if (filter.active) {
            items = items.filter((s) => isInForceOn(s, today));
        } else {
            items = items.filter((s) => !isInForceOn(s, today));
        }
    }

    return items.sort((a, b) => a.startsOn.localeCompare(b.startsOn) || a.id.localeCompare(b.id));
}

export async function createSuspension(
    input: CreateSuspensionInput,
    actor: User,
): Promise<SuspensionCreation> {
    const today = academyDateOf(new Date());
    const startsOn = input.startsOn ?? today;
    const endsOn = endsOnFor(startsOn, input.days);

    const clearanceResult = deriveRequiresClearance(input.reason, input.requiresClearance);
    if (!clearanceResult.ok) {
        throw new ApiError({
            message:
                clearanceResult.reason === "REQUIRES_CLEARANCE_MANDATORY"
                    ? "requiresClearance cannot be false for KO or TKO"
                    : "requiresClearance cannot be true for DQ or MANDATORY_REST",
            kind: "http",
            status: 422,
            code: "VALIDATION_ERROR",
            details: [
                {
                    code: "custom",
                    path: ["requiresClearance"],
                    message:
                        clearanceResult.reason === "REQUIRES_CLEARANCE_MANDATORY"
                            ? "requiresClearance cannot be false for KO or TKO"
                            : "requiresClearance cannot be true for DQ or MANDATORY_REST",
                },
            ],
        });
    }
    const requiresClearance = clearanceResult.requiresClearance;

    const blockedSessionTypes: SessionType[] =
        input.maxTier !== undefined
            ? blockedTypesForMaxTier(input.maxTier)
            : input.blockedSessionTypes ?? [...DEFAULT_MANUAL_BLOCKED_SESSION_TYPES];

    const maxTier = maxAllowedTier(blockedSessionTypes);

    const suspensionId = newId("susp");
    const created: Suspension = {
        id: suspensionId,
        fighterId: input.fighterId,
        boutId: null,
        reason: input.reason,
        startsOn,
        endsOn,
        lossOfConsciousness: input.lossOfConsciousness ?? null,
        suggestedDays: null,
        overrideReason: null,
        blockedSessionTypes,
        maxAllowedTier: maxTier,
        requiresClearance,
        clearedAt: null,
        clearedById: null,
        clearanceNote: null,
        createdById: actor.id,
        createdAt: nowIso(),
        updatedAt: nowIso(),
        status: suspensionStatusOn({ startsOn, endsOn, requiresClearance, clearedAt: null }, today),
        gradedReturn: null,
    };

    db().suspensions = db().suspensions ?? [];
    const fighterSuspensions = db().suspensions.filter((s) => s.fighterId === input.fighterId);
    const allSuspensions = [...fighterSuspensions, created];

    // Auto-apply side effects to demo sessions and plans
    const { affectedSessions, affectedPlans } = applySuspensionSideEffects(
        created,
        allSuspensions,
        db().trainingSessions,
        db().trainingPlans,
    );

    db().suspensions.push(created);

    return {
        ...created,
        affectedSessions,
        affectedPlans,
    };
}

export async function clearSuspension(
    id: string,
    clearanceNote: string,
    actor: User,
): Promise<Suspension> {
    const today = academyDateOf(new Date());
    db().suspensions = db().suspensions ?? [];
    const index = db().suspensions.findIndex((s) => s.id === id);
    if (index === -1) {
        throw new ApiError({
            message: "Suspension not found",
            kind: "http",
            status: 404,
            code: "SUSPENSION_NOT_FOUND",
        });
    }

    const current = db().suspensions[index];
    if (actor.role !== "coach" && actor.role !== "doctor") {
        throw new ApiError({
            message: "Forbidden",
            kind: "http",
            status: 403,
            code: "FORBIDDEN",
        });
    }

    if (!canAccessFighter(actor, current.fighterId)) {
        throw new ApiError({
            message: "Forbidden",
            kind: "http",
            status: 403,
            code: "FORBIDDEN",
        });
    }

    if (current.clearedAt !== null) {
        throw new ApiError({
            message: "The suspension has already been cleared",
            kind: "http",
            status: 409,
            code: "SUSPENSION_ALREADY_CLEARED",
        });
    }

    current.clearedAt = nowIso();
    current.clearedById = actor.id;
    current.clearanceNote = clearanceNote;
    current.status = "ENDED";
    current.gradedReturn = gradedReturnFor(current, today);

    return { ...current };
}

export async function getSuspension(
    id: string,
    actor?: User,
): Promise<Suspension | null> {
    const today = academyDateOf(new Date());
    db().suspensions = db().suspensions ?? [];
    const found = db().suspensions.find((s) => s.id === id);
    if (!found) return null;

    if (actor) {
        if (actor.role === "fighter" && found.fighterId !== actor.profileId) {
            return null;
        }
        if (
            (actor.role === "coach" || actor.role === "doctor") &&
            !canAccessFighter(actor, found.fighterId)
        ) {
            return null;
        }
    }

    return resolveSuspensionStatusAndGradedReturn(found, today);
}

export async function listConflicts(
    id: string,
    actor: User,
): Promise<ConflictProposal[]> {
    const today = academyDateOf(new Date());
    db().suspensions = db().suspensions ?? [];
    const suspension = db().suspensions.find((s) => s.id === id);
    if (!suspension) {
        throw new ApiError({
            message: "Suspension not found",
            kind: "http",
            status: 404,
            code: "SUSPENSION_NOT_FOUND",
        });
    }

    if (actor.role !== "admin" && !canAccessFighter(actor, suspension.fighterId)) {
        throw new ApiError({
            message: "Forbidden",
            kind: "http",
            status: 403,
            code: "FORBIDDEN",
        });
    }

    if (suspension.clearedAt !== null || !isInForceOn(suspension, today)) {
        return [];
    }

    const fighterSessions = db().trainingSessions.filter((s) => s.fighterId === suspension.fighterId);
    const sessionInputs = fighterSessions.map((s) => ({
        id: s.id,
        scheduledAt: s.scheduledAt,
        status: s.status,
        sessionType: sessionTypeFor(s.type) ?? undefined,
        type: s.type,
    }));

    const fighterSuspensions = db().suspensions.filter((s) => s.fighterId === suspension.fighterId);
    const allProposals = planConflicts(sessionInputs, fighterSuspensions);
    return filterProposalsForSuspension(allProposals, suspension, sessionInputs);
}

export async function applyConflicts(
    id: string,
    sessionIds: string[],
    actor: User,
): Promise<TrainingSession[]> {
    db().suspensions = db().suspensions ?? [];
    const suspension = db().suspensions.find((s) => s.id === id);
    if (!suspension) {
        throw new ApiError({
            message: "Suspension not found",
            kind: "http",
            status: 404,
            code: "SUSPENSION_NOT_FOUND",
        });
    }

    if (actor.role === "doctor" || actor.role === "fighter") {
        throw new ApiError({
            message: "Forbidden",
            kind: "http",
            status: 403,
            code: "FORBIDDEN",
        });
    }

    if (actor.role !== "admin" && !canAccessFighter(actor, suspension.fighterId)) {
        throw new ApiError({
            message: "Forbidden",
            kind: "http",
            status: 403,
            code: "FORBIDDEN",
        });
    }

    const proposals = await listConflicts(id, actor);
    const proposalMap = new Map(proposals.map((p) => [p.sessionId, p.action]));

    for (const sid of sessionIds) {
        if (!proposalMap.has(sid)) {
            throw new ApiError({
                message: `Session ${sid} is not an eligible conflict proposal for suspension ${id}`,
                kind: "http",
                status: 422,
                code: "VALIDATION_ERROR",
            });
        }
    }

    const updated: TrainingSession[] = [];

    for (const session of db().trainingSessions) {
        if (!sessionIds.includes(session.id)) continue;
        const action = proposalMap.get(session.id);
        if (!action) continue;

        if (action === "cancel") {
            session.status = "cancelled";
            session.cancellationReason = "Suspension in force";
        } else {
            session.status = "pending";
        }
        updated.push({ ...session });
    }
    return updated;
}

export async function getReadiness(
    filter: ReadinessFilter = {},
    actor?: User,
): Promise<ReadinessRow[]> {
    if (actor) {
        if (actor.role !== "coach" && actor.role !== "admin") {
            throw new ApiError({
                message: "Forbidden",
                kind: "http",
                status: 403,
                code: "FORBIDDEN",
            });
        }
    }

    if (
        (filter.weightLimitKg !== undefined || filter.boutOn !== undefined) &&
        !filter.rulesetId
    ) {
        throw new ApiError({
            message: "rulesetId is required when weightLimitKg or boutOn is provided.",
            kind: "http",
            status: 422,
            code: "VALIDATION_ERROR",
        });
    }

    const today = academyDateOf(new Date());
    let ruleset: CompetitionRuleset | undefined;
    if (filter.rulesetId) {
        ruleset = db().rulesets.find((r) => r.id === filter.rulesetId);
        if (!ruleset) {
            throw new ApiError({
                message: "Ruleset not found",
                kind: "http",
                status: 404,
                code: "RULESET_NOT_FOUND",
            });
        }
    }

    let fighters = db().fighters.filter((f) => {
        const anyF = f as unknown as { status?: string; isActive?: boolean; deletedAt?: string | null };
        const notDeleted = anyF.deletedAt === null || anyF.deletedAt === undefined;
        const isActive =
            anyF.isActive !== false &&
            anyF.status !== "inactive" &&
            anyF.status !== "suspended";
        return notDeleted && isActive;
    });

    if (actor && actor.role === "coach") {
        const allowed = accessibleFighterIds(actor);
        if (Array.isArray(allowed)) {
            fighters = fighters.filter((f) => allowed.includes(f.id));
        }
    }

    fighters.sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));

    const allSuspensions = (db().suspensions ?? []).map((s) =>
        resolveSuspensionStatusAndGradedReturn(s, today),
    );

    const rows: ReadinessRow[] = [];

    for (const fighter of fighters) {
        const fighterSuspensions = allSuspensions.filter((s) => s.fighterId === fighter.id);

        const candidateBouts = db().bouts
            .filter(
                (b) =>
                    b.fighterId === fighter.id &&
                    (b.deletedAt === null || b.deletedAt === undefined) &&
                    (b.status === "CAMP" ||
                        b.status === "FIGHT_WEEK" ||
                        b.status === "WEIGHED_IN"),
            )
            .sort((a, b) => a.boutAt.localeCompare(b.boutAt));
        const activeBoutMatch = candidateBouts[0] ?? null;

        const measurements = db().boutMeasurements
            .filter((m) => m.fighterId === fighter.id && !m.superseded)
            .sort((a, b) => b.measuredAt.localeCompare(a.measuredAt));
        const latestWeight = measurements[0];

        const row = classifyReadiness({
            fighterId: fighter.id,
            fighterName: fighter.name,
            today,
            suspensions: fighterSuspensions,
            activeBout: activeBoutMatch
                ? {
                      id: activeBoutMatch.id,
                      eventName: activeBoutMatch.eventName,
                      status: activeBoutMatch.status,
                      boutAt: activeBoutMatch.boutAt,
                  }
                : null,
            latestWeight: latestWeight
                ? {
                      kg: latestWeight.weightKg,
                      date: academyDateOf(latestWeight.measuredAt),
                  }
                : null,
            boutOn: filter.boutOn,
            weightLimitKg: filter.weightLimitKg,
            ruleset: ruleset
                ? {
                      acuteWindowDays: ruleset.acuteWindowDays,
                      acuteLossLimitPctLong: ruleset.acuteLossLimitPctLong,
                      acuteLossLimitPctShort: ruleset.acuteLossLimitPctShort,
                  }
                : undefined,
        });

        rows.push(row);
    }

    return rows;
}
