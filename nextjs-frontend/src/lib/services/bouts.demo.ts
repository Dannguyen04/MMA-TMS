import "server-only";

import {
    calculateSnapshotAcuteLimit,
    calculateWeightWarning,
    canEnterFightWeek,
    computeBoutComputedFields,
    computeWeightPoints,
    evaluateGate1,
} from "@/lib/domain/bout-rules";
import type {
    Bout,
    BoutRequirement,
    CompetitionRuleset,
    User,
    WeightTrack,
} from "@/lib/domain/types";
import { dayKey } from "@/lib/format";
import { db, newId, nowIso, simulateLatency } from "@/lib/mocks/db";
import type {
    AddRequirementInput,
    BoutFilter,
    CreateBoutInput,
    EnterFightWeekResult,
    UpdateBoutInput,
    UpdateRequirementInput,
} from "./bouts";

function getCampStartDate(bout: Bout): string {
    if (bout.trainingPlanId) {
        const plan = db().trainingPlans.find((p) => p.id === bout.trainingPlanId);
        if (plan?.startDate) return plan.startDate;
    }
    return bout.createdAt;
}

function measurementsForFighter(fighterId: string, sinceDate: string) {
    const sinceKey = dayKey(sinceDate);
    return db()
        .boutMeasurements.filter((m) => m.fighterId === fighterId && !m.superseded && dayKey(m.measuredAt) >= sinceKey)
        .map((m) => ({ date: m.measuredAt, kg: m.weightKg }));
}

function enrichBout(bout: Bout): Bout {
    const ruleset = db().rulesets.find((r) => r.id === bout.rulesetId) ?? null;
    const campStart = getCampStartDate(bout);
    const measurements = measurementsForFighter(bout.fighterId, campStart);
    const computed = computeBoutComputedFields(bout, ruleset, measurements, new Date(), campStart);
    return {
        ...bout,
        ...computed,
    };
}

export async function listRulesets(): Promise<CompetitionRuleset[]> {
    await simulateLatency(0.5);
    return db().rulesets.filter((r) => r.deletedAt === null);
}

export async function listBouts(filter: BoutFilter = {}): Promise<Bout[]> {
    await simulateLatency();
    const statuses = filter.status === undefined ? null : Array.isArray(filter.status) ? filter.status : [filter.status];

    const bouts = db().bouts.filter((b) => {
        if (b.deletedAt !== null) return false;
        if (Array.isArray(filter.fighterIds) && !filter.fighterIds.includes(b.fighterId)) return false;
        if (statuses && !statuses.includes(b.status)) return false;
        return true;
    });

    return bouts.map(enrichBout).sort((a, b) => a.weighInAt.localeCompare(b.weighInAt));
}

export async function getBout(id: string): Promise<Bout | null> {
    await simulateLatency(0.5);
    const bout = db().bouts.find((b) => b.id === id && b.deletedAt === null);
    return bout ? enrichBout(bout) : null;
}

export async function createBout(input: CreateBoutInput, actor: User): Promise<Bout> {
    await simulateLatency(0.5);
    const ruleset = db().rulesets.find((r) => r.id === input.rulesetId);

    const acuteLimit = calculateSnapshotAcuteLimit(input.weighInAt, input.boutAt, ruleset);
    const requirementsDueDays = input.requirementsDueDays ?? ruleset?.requirementsDueDays ?? 7;

    const id = newId("bout");
    const now = nowIso();

    const requirements: BoutRequirement[] = (ruleset?.requirementTemplates ?? []).map((tpl) => ({
        id: newId("req"),
        boutId: id,
        code: tpl.code,
        label: tpl.label,
        required: tpl.required,
        status: "MISSING",
        issuedOn: null,
        validUntil: null,
        source: "PRESET",
        statusReason: null,
    }));

    const bout: Bout = {
        id,
        fighterId: input.fighterId,
        coachId: input.coachId,
        rulesetId: input.rulesetId,
        eventName: input.eventName.trim(),
        venue: input.venue?.trim() || null,
        opponentName: input.opponentName?.trim() || null,
        weightClassCode: input.weightClassCode,
        weightLimitKg: input.weightLimitKg,
        acuteLossLimitPct: acuteLimit,
        requirementsDueDays,
        weighInAt: input.weighInAt,
        boutAt: input.boutAt,
        status: "SCHEDULED",
        trainingPlanId: null,
        officialWeightKg: null,
        madeWeight: null,
        catchweightKg: null,
        hydrationCheck: null,
        result: null,
        method: null,
        resultRound: null,
        knockedDown: null,
        cancelReason: null,
        notes: input.notes?.trim() || null,
        history: [{ at: now, by: actor.id, from: "SCHEDULED", to: "SCHEDULED", reason: "Bout created" }],
        createdById: actor.id,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
        requirements,
    };

    db().bouts.push(bout);
    return enrichBout(bout);
}

export async function updateBout(id: string, input: UpdateBoutInput, actor: User): Promise<Bout | null> {
    await simulateLatency(0.5);
    const bout = db().bouts.find((b) => b.id === id && b.deletedAt === null);
    if (!bout) return null;

    if (input.eventName !== undefined) bout.eventName = input.eventName.trim();
    if (input.venue !== undefined) bout.venue = input.venue?.trim() || null;
    if (input.opponentName !== undefined) bout.opponentName = input.opponentName?.trim() || null;
    if (input.weightClassCode !== undefined) bout.weightClassCode = input.weightClassCode;
    if (input.weightLimitKg !== undefined) bout.weightLimitKg = input.weightLimitKg;
    if (input.requirementsDueDays !== undefined) bout.requirementsDueDays = input.requirementsDueDays;
    if (input.notes !== undefined) bout.notes = input.notes?.trim() || null;

    const weighInChanged = input.weighInAt !== undefined && input.weighInAt !== bout.weighInAt;
    const boutAtChanged = input.boutAt !== undefined && input.boutAt !== bout.boutAt;

    if (input.weighInAt !== undefined) bout.weighInAt = input.weighInAt;
    if (input.boutAt !== undefined) bout.boutAt = input.boutAt;

    if (weighInChanged || boutAtChanged) {
        const ruleset = db().rulesets.find((r) => r.id === bout.rulesetId);
        bout.acuteLossLimitPct = calculateSnapshotAcuteLimit(bout.weighInAt, bout.boutAt, ruleset);
    }

    bout.updatedAt = nowIso();
    bout.history.push({ at: nowIso(), by: actor.id, from: bout.status, to: bout.status, reason: "Bout updated" });
    return enrichBout(bout);
}

export async function linkCamp(id: string, trainingPlanId: string, actor: User): Promise<Bout | null> {
    await simulateLatency(0.5);
    const bout = db().bouts.find((b) => b.id === id && b.deletedAt === null);
    if (!bout || bout.status !== "SCHEDULED") return null;

    const from = bout.status;
    bout.trainingPlanId = trainingPlanId;
    bout.status = "CAMP";
    bout.history.push({ at: nowIso(), by: actor.id, from, to: "CAMP", reason: "Linked training camp" });
    bout.updatedAt = nowIso();

    return enrichBout(bout);
}

export async function enterFightWeek(id: string, actor: User): Promise<EnterFightWeekResult> {
    await simulateLatency(0.5);
    const bout = db().bouts.find((b) => b.id === id && b.deletedAt === null);
    if (!bout) return { ok: false, error: "BOUT_NOT_FOUND" };
    if (bout.status !== "CAMP") return { ok: false, error: "BOUT_INVALID_TRANSITION" };

    const gate1 = evaluateGate1(bout.requirements, bout.boutAt);
    if (!gate1.passed) {
        return {
            ok: false,
            error: "BOUT_REQUIREMENTS_INCOMPLETE",
            missing: gate1.missing,
            expiring: gate1.expiring,
        };
    }

    const ruleset = db().rulesets.find((r) => r.id === bout.rulesetId);
    if (!canEnterFightWeek(bout, gate1, ruleset?.fightWeekDays ?? 7)) {
        return { ok: false, error: "BOUT_FIGHT_WEEK_TOO_EARLY" };
    }

    const from = bout.status;
    bout.status = "FIGHT_WEEK";
    bout.history.push({ at: nowIso(), by: actor.id, from, to: "FIGHT_WEEK", reason: "Entered fight week" });
    bout.updatedAt = nowIso();

    return { ok: true, bout: enrichBout(bout) };
}

export async function cancelBout(id: string, reason: string, actor: User): Promise<Bout | null> {
    await simulateLatency(0.5);
    const bout = db().bouts.find((b) => b.id === id && b.deletedAt === null);
    if (!bout || bout.status === "COMPLETED" || bout.status === "CANCELLED") return null;

    const from = bout.status;
    bout.status = "CANCELLED";
    bout.cancelReason = reason.trim();
    bout.history.push({ at: nowIso(), by: actor.id, from, to: "CANCELLED", reason: reason.trim() });
    bout.updatedAt = nowIso();

    return enrichBout(bout);
}

export async function addRequirement(id: string, input: AddRequirementInput, actor: User): Promise<BoutRequirement | null> {
    await simulateLatency(0.5);
    const bout = db().bouts.find((b) => b.id === id && b.deletedAt === null);
    if (!bout) return null;

    // Check code uniqueness within bout
    if (bout.requirements.some((r) => r.code === input.code)) return null;

    const req: BoutRequirement = {
        id: newId("req"),
        boutId: id,
        code: input.code.trim().toUpperCase(),
        label: input.label.trim(),
        required: input.required,
        status: "MISSING",
        issuedOn: null,
        validUntil: null,
        source: "COACH",
        statusReason: null,
        updatedById: actor.id,
    };

    bout.requirements.push(req);
    bout.updatedAt = nowIso();
    return req;
}

export async function updateRequirement(
    id: string,
    code: string,
    input: UpdateRequirementInput,
    actor: User,
): Promise<BoutRequirement | null> {
    await simulateLatency(0.5);
    const bout = db().bouts.find((b) => b.id === id && b.deletedAt === null);
    if (!bout) return null;

    const req = bout.requirements.find((r) => r.code === code);
    if (!req) return null;

    if (input.label !== undefined) req.label = input.label.trim();
    if (input.required !== undefined) req.required = input.required;
    if (input.status !== undefined) req.status = input.status;
    if (input.issuedOn !== undefined) req.issuedOn = input.issuedOn;
    if (input.validUntil !== undefined) req.validUntil = input.validUntil;
    if (input.statusReason !== undefined) req.statusReason = input.statusReason?.trim() || null;

    req.updatedById = actor.id;
    bout.updatedAt = nowIso();
    return req;
}

export async function removeRequirement(id: string, code: string, actor: User): Promise<boolean> {
    await simulateLatency(0.5);
    const bout = db().bouts.find((b) => b.id === id && b.deletedAt === null);
    if (!bout) return false;

    const idx = bout.requirements.findIndex((r) => r.code === code);
    if (idx === -1) return false;

    bout.requirements.splice(idx, 1);
    bout.updatedAt = nowIso();
    bout.history.push({
        at: nowIso(),
        by: actor.id,
        from: bout.status,
        to: bout.status,
        reason: `Removed requirement ${code}`,
    });
    return true;
}

export async function getWeightTrack(id: string): Promise<WeightTrack | null> {
    await simulateLatency(0.5);
    const bout = db().bouts.find((b) => b.id === id && b.deletedAt === null);
    if (!bout) return null;

    const ruleset = db().rulesets.find((r) => r.id === bout.rulesetId) ?? null;
    const campStart = getCampStartDate(bout);
    const measurements = measurementsForFighter(bout.fighterId, campStart);

    const points = computeWeightPoints(measurements);

    const limitKg = bout.catchweightKg ?? bout.weightLimitKg;
    const summary = calculateWeightWarning({
        limitKg,
        acuteLossLimitPct: bout.acuteLossLimitPct,
        acuteWindowDays: ruleset?.acuteWindowDays ?? 7,
        weighInAt: bout.weighInAt,
        campStartDate: campStart,
        measurements,
    });

    return {
        limitKg,
        points,
        latestKg: summary.latestKg,
        latestOn: summary.latestOn,
        remainingPct: summary.remainingPct,
        status: summary.status,
        referencePath: summary.referencePath,
    };
}
