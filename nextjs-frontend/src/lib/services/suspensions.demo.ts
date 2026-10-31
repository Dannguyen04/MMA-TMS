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
    ACTIVE_BOUT_STATUSES,
    applySuspensionSideEffects,
    classifyReadiness,
    deriveRequiresClearance,
    endsOnFor,
    gradedReturnFor,
    isInForceOn,
    suspensionStatusOn,
} from "@/lib/domain/suspension-rules";
import type {
    CompetitionRuleset,
    ReadinessRow,
    Suspension,
    SuspensionCreation,
    User,
} from "@/lib/domain/types";
import { db, newId, nowIso } from "@/lib/mocks/db";
import type { CreateSuspensionInput, ReadinessFilter, SuspensionFilter } from "./suspensions";

const forbidden = () => new ApiError({ message: "Forbidden", kind: "http", status: 403, code: "FORBIDDEN" });

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
    const store = db().suspensions;
    let items = store.map((s) => resolveSuspensionStatusAndGradedReturn(s, today));

    // Actor visibility scoping
    if (actor) {
        if (actor.role === "fighter") {
            if (filter.fighterId && filter.fighterId !== actor.profileId) {
                throw forbidden();
            }
            if (filter.fighterIds && filter.fighterIds.some((id) => id !== actor.profileId)) {
                throw forbidden();
            }
            items = items.filter((s) => s.fighterId === actor.profileId);
        } else if (actor.role === "coach" || actor.role === "doctor") {
            const allowed = accessibleFighterIds(actor);
            if (Array.isArray(allowed)) {
                if (filter.fighterId && !allowed.includes(filter.fighterId)) {
                    throw forbidden();
                }
                if (filter.fighterIds && filter.fighterIds.some((id) => !allowed.includes(id))) {
                    throw forbidden();
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
        const message =
            clearanceResult.reason === "REQUIRES_CLEARANCE_MANDATORY"
                ? "requiresClearance cannot be false for KO or TKO"
                : "requiresClearance cannot be true for DQ or MANDATORY_REST";
        throw new ApiError({
            message,
            kind: "http",
            status: 422,
            code: "VALIDATION_ERROR",
            details: [{ code: "custom", path: ["requiresClearance"], message }],
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
    const index = db().suspensions.findIndex((s) => s.id === id);
    if (index === -1) {
        throw new ApiError({ message: "Suspension not found", kind: "http", status: 404, code: "SUSPENSION_NOT_FOUND" });
    }

    const current = db().suspensions[index];
    if (actor.role !== "coach" && actor.role !== "doctor") {
        throw forbidden();
    }

    if (!canAccessFighter(actor, current.fighterId)) {
        throw forbidden();
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

export async function getReadiness(
    filter: ReadinessFilter = {},
    actor?: User,
): Promise<ReadinessRow[]> {
    if (actor) {
        if (actor.role !== "coach" && actor.role !== "admin") {
            throw forbidden();
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

    const allSuspensions = db().suspensions.map((s) =>
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
                    (ACTIVE_BOUT_STATUSES as readonly string[]).includes(b.status),
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
