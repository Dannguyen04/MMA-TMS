import "server-only";

import { cache } from "react";
import { z } from "zod";

import { ApiError, authenticatedApiRequest } from "@/lib/api/client";
import { getCurrentUser } from "@/lib/auth/session";
import {
    BODY_JOINTS,
    ELIGIBILITY_REASONS,
    SESSION_TYPES,
    TECHNIQUE_TYPES,
    type ClinicalRestrictions,
    type EligibilityReason,
    type MedicalEligibility,
    type MedicalReviewRequest,
} from "@/lib/domain/medical-contract";
import { JOINT_REGIONS, OUTCOME_FROM_DECISION, clearanceStateFromEligibility, isRestricted, latestRevisions, milestoneProgressPct, restrictionFromAllowLists, standardMilestones } from "@/lib/domain/medical-mappings";
import { clearanceDaysRemaining, type ClearanceState } from "@/lib/domain/rules";
import type { Fighter, HealthStatus, Injury, MedicalClearance, MedicalExamination, RecoveryPlan, Treatment } from "@/lib/domain/types";
import { dayKey } from "@/lib/format";
import { matchesSearch } from "@/lib/query";
import { getSettings } from "./admin";
import { drainNumberedPages } from "./api-helpers";
import type {
    ClearanceFilter,
    ClearanceOverviewRow,
    DoctorOverview,
    ExaminationFilter,
    FighterHealthSummary,
    FighterScope,
    InjuryDetail,
    InjuryFilter,
    RecoveryPlanDetail,
    RecoveryPlanFilter,
} from "./medical.demo";
import { getDoctor, getFighter, listFighters, listScopedFighterIds } from "./people";

/*
 * API-mode reads for the medical service. Every clinical read is audited by the backend, so each fighter's dossier,
 * examinations and history are read at most once per request (React `cache`), and dashboards stay on the dossier.
 * The service has no lookup by record id: detail reads search the fighters the caller can see.
 */

/* ─── Contract schemas ────────────────────────────────────────────────────── */

/** Timestamps arrive as ISO strings, or in Postgres' JSON format inside history snapshots. */
const timestamp = z.string().transform((value) => {
    const ms = Date.parse(value);
    return Number.isNaN(ms) ? value : new Date(ms).toISOString();
});

const restrictionListsShape = {
    allowedSessionTypes: z.array(z.enum(SESSION_TYPES)).nullable(),
    allowedTechniqueTypes: z.array(z.enum(TECHNIQUE_TYPES)).nullable(),
    excludedJoints: z.array(z.enum(BODY_JOINTS)).nullable(),
};

const restrictionsSchema = z.object({ ...restrictionListsShape, notes: z.string().nullable() });

const injurySchema = z.object({
    id: z.string(),
    fighterId: z.string(),
    reportedById: z.string(),
    affectedJoint: z.enum(BODY_JOINTS),
    injuryType: z.string(),
    severity: z.enum(["MINOR", "MODERATE", "SEVERE", "CRITICAL"]),
    occurredAt: timestamp,
    description: z.string().nullable(),
    status: z.enum(["ACTIVE", "RECOVERING", "RESOLVED"]),
    resolvedAt: timestamp.nullable(),
    sourceAlertId: z.string().nullable().optional(),
});

const treatmentSchema = z.object({
    id: z.string(),
    injuryId: z.string(),
    doctorId: z.string(),
    treatmentDate: timestamp,
    treatmentType: z.string(),
    description: z.string().nullable(),
    outcomeNotes: z.string().nullable(),
    nextReviewAt: timestamp.nullable(),
});

const recoveryPlanSchema = z.object({
    id: z.string(),
    fighterId: z.string(),
    injuryId: z.string(),
    doctorId: z.string(),
    title: z.string(),
    description: z.string().nullable(),
    startDate: z.string(),
    estimatedEndDate: z.string().nullable(),
    actualEndDate: z.string().nullable(),
    status: z.enum(["ACTIVE", "COMPLETED", "CANCELLED"]),
    milestones: z.array(z.unknown()),
});

const examinationSchema = z.object({
    id: z.string(),
    fighterId: z.string(),
    doctorId: z.string(),
    scope: z.enum(["TRAINING", "COMPETITION"]),
    decision: z.enum(["ELIGIBLE", "ELIGIBLE_WITH_RESTRICTIONS", "NOT_ELIGIBLE"]),
    examinedAt: timestamp,
    reason: z.string(),
    restrictions: restrictionsSchema.nullable(),
    validUntil: timestamp.nullable(),
});

const clearanceSchema = z.object({
    id: z.string(),
    fighterId: z.string(),
    examinationId: z.string().nullable(),
    issuedById: z.string(),
    clearanceType: z.enum(["TRAINING", "COMPETITION", "RETURN_FROM_INJURY"]),
    status: z.enum(["ACTIVE", "EXPIRED", "REVOKED"]),
    validFrom: timestamp,
    validUntil: timestamp.nullable(),
    notes: z.string().nullable(),
    restrictions: restrictionsSchema,
    revokedAt: timestamp.nullable(),
    revokedReason: z.string().nullable(),
    isCurrentlyValid: z.boolean(),
});

/** History keeps a clearance's lists flat and has no validity flag. */
const clearanceSnapshotSchema = clearanceSchema.omit({ restrictions: true, isCurrentlyValid: true }).extend(restrictionListsShape);

const reviewRequestSchema = z.object({
    id: z.string(),
    fighterId: z.string(),
    requestedById: z.string(),
    requesterRole: z.enum(["FIGHTER", "COACH", "DOCTOR", "ADMIN"]),
    reason: z.string(),
    status: z.enum(["OPEN", "RESOLVED"]),
    requestedAt: timestamp,
    resolvedByExaminationId: z.string().nullable(),
    resolvedAt: timestamp.nullable(),
});

const knownReasons = new Set<string>(ELIGIBILITY_REASONS);
const eligibilitySchema = z.object({
    scope: z.enum(["TRAINING", "COMPETITION"]),
    eligible: z.boolean(),
    // A reason the interface doesn't know yet is dropped rather than failing the whole dossier.
    reasons: z.array(z.string()).transform((reasons) => reasons.filter((reason): reason is EligibilityReason => knownReasons.has(reason))),
});

const dossierSchema = z.object({
    fighterId: z.string(),
    activeInjuries: z.array(injurySchema),
    activeRecoveryPlans: z.array(recoveryPlanSchema),
    currentExaminations: z.object({ training: examinationSchema.nullable(), competition: examinationSchema.nullable() }),
    activeClearances: z.array(clearanceSchema),
    openReviewRequests: z.array(reviewRequestSchema),
    eligibility: z.object({ training: eligibilitySchema, competition: eligibilitySchema }),
});

const historyEntrySchema = z.object({
    recordType: z.string(),
    recordId: z.string(),
    revision: z.number().int(),
    recordedAt: timestamp,
    snapshot: z.record(z.string(), z.unknown()),
});

type ApiInjury = z.output<typeof injurySchema>;
type ApiTreatment = z.output<typeof treatmentSchema>;
type ApiRecoveryPlan = z.output<typeof recoveryPlanSchema>;
type ApiExamination = z.output<typeof examinationSchema>;
type ApiClearance = z.output<typeof clearanceSchema>;
type Dossier = z.output<typeof dossierSchema>;
type HistoryRecordType = "INJURY" | "TREATMENT" | "RECOVERY_PLAN" | "MEDICAL_CLEARANCE";

/* ─── Reads (once per fighter per request) ────────────────────────────────── */

/** A record the caller may no longer read (403) or that doesn't exist (404) reads as absent. */
async function unlessUnreadable<T>(request: Promise<T>): Promise<T | null> {
    try {
        return await request;
    } catch (error) {
        if (error instanceof ApiError && (error.status === 403 || error.status === 404)) return null;
        throw error;
    }
}

const path = (fighterId: string, rest: string) => `/fighters/${encodeURIComponent(fighterId)}${rest}`;

const dossierFor = cache((fighterId: string) => unlessUnreadable(authenticatedApiRequest(path(fighterId, "/medical"), dossierSchema)));

const examinationsFor = cache(async (fighterId: string) => (await unlessUnreadable(drainNumberedPages(path(fighterId, "/medical-examinations"), examinationSchema))) ?? []);

const historyFor = cache(
    async (fighterId: string, recordType: HistoryRecordType) =>
        (await unlessUnreadable(drainNumberedPages(path(fighterId, "/medical/history"), historyEntrySchema, { recordType }))) ?? [],
);

const reviewRequestsFor = cache(async (fighterId: string) => (await unlessUnreadable(drainNumberedPages(path(fighterId, "/medical-review-requests"), reviewRequestSchema))) ?? []);

/** The newest revision of each record, parsed; snapshots in a shape the interface can't read are skipped. */
function snapshots<T extends z.ZodType>(entries: z.output<typeof historyEntrySchema>[], schema: T): z.output<T>[] {
    return latestRevisions(entries).flatMap((entry) => {
        const parsed = schema.safeParse(entry.snapshot);
        return parsed.success ? [parsed.data] : [];
    });
}

async function fighterIdsIn(scope: FighterScope | undefined): Promise<string[]> {
    return scope && scope !== "all" ? scope : listScopedFighterIds();
}

/* ─── Adapters ────────────────────────────────────────────────────────────── */

const lower = <T extends string>(value: T) => value.toLowerCase() as Lowercase<T>;

function toInjury(injury: ApiInjury): Injury {
    return {
        id: injury.id,
        fighterId: injury.fighterId,
        recordedById: injury.reportedById,
        type: null,
        typeLabel: injury.injuryType,
        bodyRegion: JOINT_REGIONS[injury.affectedJoint],
        joint: injury.affectedJoint,
        severity: lower(injury.severity),
        status: lower(injury.status),
        mechanism: null,
        occurredAt: injury.occurredAt,
        diagnosedAt: null,
        description: injury.description ?? "",
        expectedReturnAt: null,
        resolvedAt: injury.resolvedAt,
        linkedAlertId: injury.sourceAlertId ?? null,
    };
}

function toTreatment(treatment: ApiTreatment, fighterId: string): Treatment {
    return {
        id: treatment.id,
        injuryId: treatment.injuryId,
        fighterId,
        providerName: null,
        type: null,
        typeLabel: treatment.treatmentType,
        description: treatment.description ?? "",
        frequency: null,
        startDate: treatment.treatmentDate,
        endDate: null,
        status: null,
        notes: treatment.outcomeNotes,
        nextReviewAt: treatment.nextReviewAt,
    };
}

function toRecoveryPlan(plan: ApiRecoveryPlan): RecoveryPlan {
    const milestones = standardMilestones(plan.milestones);
    return {
        id: plan.id,
        injuryId: plan.injuryId,
        fighterId: plan.fighterId,
        doctorId: plan.doctorId,
        title: plan.title,
        startDate: plan.startDate,
        targetReturnDate: plan.actualEndDate ?? plan.estimatedEndDate,
        status: lower(plan.status),
        phases: [],
        checkIns: [],
        description: plan.description,
        ...(milestones ? { milestones } : { legacyMilestones: plan.milestones }),
    };
}

function toExamination(exam: ApiExamination): MedicalExamination {
    return {
        id: exam.id,
        fighterId: exam.fighterId,
        doctorId: exam.doctorId,
        date: exam.examinedAt,
        type: null,
        vitals: null,
        assessments: [],
        outcome: OUTCOME_FROM_DECISION[exam.decision],
        summary: exam.reason,
        recommendations: exam.restrictions?.notes ?? "",
        followUpDate: null,
        scope: exam.scope,
        decisionRestrictions: exam.restrictions,
        validUntil: exam.validUntil,
    };
}

function isValidNow(clearance: Pick<ApiClearance, "status" | "validFrom" | "validUntil">, now: string): boolean {
    return clearance.status === "ACTIVE" && clearance.validFrom <= now && (clearance.validUntil === null || clearance.validUntil > now);
}

/** The service keeps no expiry job: a lapsed clearance can still say ACTIVE, so validity decides. */
function toClearance(clearance: ApiClearance): MedicalClearance {
    const restricted = isRestricted(clearance.restrictions);
    return {
        id: clearance.id,
        fighterId: clearance.fighterId,
        doctorId: clearance.issuedById,
        level: restricted ? "restricted" : "full",
        status: clearance.status === "REVOKED" ? "revoked" : clearance.status === "EXPIRED" || !clearance.isCurrentlyValid ? "expired" : "active",
        issuedAt: clearance.validFrom,
        validUntil: clearance.validUntil,
        reason: clearance.notes ?? clearance.restrictions.notes ?? "",
        restrictions: restricted ? [restrictionFromAllowLists(clearance.restrictions, `${clearance.id}-restrictions`)] : [],
        examinationId: clearance.examinationId,
        revokedAt: clearance.revokedAt,
        revokedReason: clearance.revokedReason,
        clearanceType: clearance.clearanceType,
        allowLists: clearance.restrictions,
        isCurrentlyValid: clearance.isCurrentlyValid,
    };
}

function clearanceFromSnapshot(snapshot: z.output<typeof clearanceSnapshotSchema>, now: string): MedicalClearance {
    const restrictions: ClinicalRestrictions = {
        allowedSessionTypes: snapshot.allowedSessionTypes,
        allowedTechniqueTypes: snapshot.allowedTechniqueTypes,
        excludedJoints: snapshot.excludedJoints,
        notes: null,
    };
    return toClearance({ ...snapshot, restrictions, isCurrentlyValid: isValidNow(snapshot, now) });
}

const byNewest = <T>(date: (item: T) => string) => (a: T, b: T) => date(b).localeCompare(date(a));

/* ─── Clearance state ─────────────────────────────────────────────────────── */

export interface ClearanceStatus {
    state: ClearanceState;
    /** The clearance behind the state, when exactly one applies; null otherwise. */
    clearance: MedicalClearance | null;
    eligibility: MedicalEligibility | null;
}

/**
 * The training clearance that governs, without guessing: a currently valid training (or return-from-injury)
 * clearance from the current training examination, or the only valid one. For an expired verdict, the most recent
 * lapsed clearance explains it.
 */
function governingClearance(dossier: Dossier): MedicalClearance | null {
    const current = dossier.currentExaminations.training;
    const valid = dossier.activeClearances.filter((c) => c.isCurrentlyValid && c.clearanceType !== "COMPETITION");
    const fromExam = current ? valid.filter((c) => c.examinationId === current.id) : [];
    const pick = fromExam.length === 1 ? fromExam[0] : valid.length === 1 ? valid[0] : null;
    if (pick) return toClearance(pick);
    if (dossier.eligibility.training.reasons.includes("CLEARANCE_EXPIRED")) {
        const lapsed = [...dossier.activeClearances].filter((c) => c.clearanceType !== "COMPETITION").sort(byNewest((c) => c.validFrom))[0];
        return lapsed ? toClearance(lapsed) : null;
    }
    return null;
}

function statusFromDossier(dossier: Dossier): ClearanceStatus {
    const clearance = governingClearance(dossier);
    return {
        state: clearanceStateFromEligibility(dossier.eligibility.training, dossier.currentExaminations.training, clearance?.level === "restricted"),
        clearance,
        eligibility: dossier.eligibility.training,
    };
}

export async function clearanceStatus(fighterId: string): Promise<ClearanceStatus> {
    const dossier = await dossierFor(fighterId);
    return dossier ? statusFromDossier(dossier) : { state: "none", clearance: null, eligibility: null };
}

/* ─── Health summary ──────────────────────────────────────────────────────── */

function summaryFrom(fighter: Fighter, dossier: Dossier): FighterHealthSummary {
    const { state, clearance } = statusFromDossier(dossier);
    const plan = dossier.activeRecoveryPlans[0];
    const recoveryPlan = plan ? toRecoveryPlan(plan) : null;
    const exams = [dossier.currentExaminations.training, dossier.currentExaminations.competition].filter((e): e is ApiExamination => e !== null);
    return {
        fighter,
        clearance,
        clearanceState: state,
        activeInjuries: dossier.activeInjuries.map(toInjury).sort(byNewest((i) => i.occurredAt)),
        activeRecoveryPlan: recoveryPlan ? { plan: recoveryPlan, progressPct: milestoneProgressPct(recoveryPlan.milestones ?? []), currentPhase: null } : null,
        latestExamination: exams.map(toExamination).sort(byNewest((e) => e.date))[0] ?? null,
        openAlerts: [],
        nextFollowUp: null,
    };
}

export async function healthSummary(fighterId: string): Promise<FighterHealthSummary | null> {
    const [fighter, dossier] = await Promise.all([getFighter(fighterId), dossierFor(fighterId)]);
    return fighter && dossier ? summaryFrom(fighter, dossier) : null;
}

/** Open medical review requests and their history for one fighter, newest first. */
export async function reviewRequests(fighterId: string): Promise<MedicalReviewRequest[]> {
    return [...(await reviewRequestsFor(fighterId))].sort(byNewest((r) => r.requestedAt));
}

/* ─── Clearances ──────────────────────────────────────────────────────────── */

async function clearancesOf(fighterId: string, now: string): Promise<MedicalClearance[]> {
    const [dossier, history] = await Promise.all([dossierFor(fighterId), historyFor(fighterId, "MEDICAL_CLEARANCE")]);
    const active = (dossier?.activeClearances ?? []).map(toClearance);
    const activeIds = new Set(active.map((c) => c.id));
    const past = snapshots(history, clearanceSnapshotSchema)
        .filter((snapshot) => !activeIds.has(snapshot.id))
        .map((snapshot) => clearanceFromSnapshot(snapshot, now));
    return [...active, ...past];
}

export async function listClearances(filter: ClearanceFilter, now: string): Promise<MedicalClearance[]> {
    const ids = await fighterIdsIn(filter.fighterIds);
    const all = (await Promise.all(ids.map((id) => clearancesOf(id, now)))).flat();
    return all.filter((c) => (!filter.level || c.level === filter.level) && (!filter.status || c.status === filter.status)).sort(byNewest((c) => c.issuedAt));
}

/* ─── Examinations ────────────────────────────────────────────────────────── */

function withinDates(value: string, from?: string, to?: string): boolean {
    const comparable = (bound: string) => (bound.length === 10 ? dayKey(value) : value);
    return (!from || comparable(from) >= from) && (!to || comparable(to) <= to);
}

export async function listExaminations(filter: ExaminationFilter): Promise<MedicalExamination[]> {
    const ids = await fighterIdsIn(filter.fighterIds);
    const all = (await Promise.all(ids.map(examinationsFor))).flat().map(toExamination);
    return all
        .filter((e) => (!filter.type || e.type === filter.type) && (!filter.outcome || e.outcome === filter.outcome) && withinDates(e.date, filter.from, filter.to))
        .sort(byNewest((e) => e.date));
}

export async function getExamination(id: string): Promise<MedicalExamination | null> {
    return (await listExaminations({})).find((exam) => exam.id === id) ?? null;
}

/* ─── Injuries & treatments ───────────────────────────────────────────────── */

async function injuriesOf(fighterId: string): Promise<Injury[]> {
    const [dossier, history] = await Promise.all([dossierFor(fighterId), historyFor(fighterId, "INJURY")]);
    const active = (dossier?.activeInjuries ?? []).map(toInjury);
    const activeIds = new Set(active.map((i) => i.id));
    const past = snapshots(history, injurySchema)
        .filter((snapshot) => !activeIds.has(snapshot.id))
        .map(toInjury);
    return [...active, ...past];
}

export async function listInjuries(filter: InjuryFilter): Promise<Injury[]> {
    const ids = await fighterIdsIn(filter.fighterIds);
    const all = (await Promise.all(ids.map(injuriesOf))).flat();
    return all
        .filter(
            (i) =>
                (!filter.status || i.status === filter.status) &&
                (!filter.severity || i.severity === filter.severity) &&
                (!filter.type || i.type === filter.type) &&
                (!filter.bodyRegion || i.bodyRegion === filter.bodyRegion) &&
                withinDates(i.occurredAt, filter.from, filter.to) &&
                matchesSearch(filter.search, i.typeLabel, i.description),
        )
        .sort(byNewest((i) => i.occurredAt));
}

export async function getInjury(id: string): Promise<Injury | null> {
    return (await listInjuries({})).find((injury) => injury.id === id) ?? null;
}

async function treatmentsFor(injury: Pick<Injury, "id" | "fighterId">): Promise<Treatment[]> {
    const history = await historyFor(injury.fighterId, "TREATMENT");
    return snapshots(history, treatmentSchema)
        .filter((t) => t.injuryId === injury.id)
        .map((t) => toTreatment(t, injury.fighterId))
        .sort((a, b) => a.startDate.localeCompare(b.startDate));
}

async function plansOf(fighterId: string): Promise<RecoveryPlan[]> {
    const [dossier, history] = await Promise.all([dossierFor(fighterId), historyFor(fighterId, "RECOVERY_PLAN")]);
    const active = (dossier?.activeRecoveryPlans ?? []).map(toRecoveryPlan);
    const activeIds = new Set(active.map((p) => p.id));
    const past = snapshots(history, recoveryPlanSchema)
        .filter((snapshot) => !activeIds.has(snapshot.id))
        .map(toRecoveryPlan);
    return [...active, ...past];
}

export async function getInjuryDetail(id: string): Promise<InjuryDetail | null> {
    const injury = await getInjury(id);
    if (!injury) return null;
    const [fighter, treatments, plans, recordedBy] = await Promise.all([getFighter(injury.fighterId), treatmentsFor(injury), plansOf(injury.fighterId), getDoctor(injury.recordedById)]);
    if (!fighter) return null;
    const forInjury = plans.filter((p) => p.injuryId === injury.id);
    return {
        injury,
        fighter,
        treatments,
        recoveryPlan: forInjury.find((p) => p.status === "active") ?? forInjury.sort(byNewest((p) => p.startDate))[0] ?? null,
        linkedAlert: null,
        recordedBy,
    };
}

/* ─── Recovery plans ──────────────────────────────────────────────────────── */

export async function listRecoveryPlans(filter: RecoveryPlanFilter): Promise<RecoveryPlan[]> {
    const ids = await fighterIdsIn(filter.fighterIds);
    const all = (await Promise.all(ids.map(plansOf))).flat();
    return all.filter((p) => !filter.status || p.status === filter.status).sort(byNewest((p) => p.startDate));
}

export async function getRecoveryPlan(id: string): Promise<RecoveryPlan | null> {
    return (await listRecoveryPlans({})).find((plan) => plan.id === id) ?? null;
}

export async function getRecoveryPlanDetail(id: string): Promise<RecoveryPlanDetail | null> {
    const plan = await getRecoveryPlan(id);
    if (!plan) return null;
    const [fighter, injuries, doctor] = await Promise.all([getFighter(plan.fighterId), injuriesOf(plan.fighterId), getDoctor(plan.doctorId)]);
    if (!fighter) return null;
    const injury = injuries.find((i) => i.id === plan.injuryId) ?? null;
    return {
        plan,
        fighter,
        injury,
        treatments: injury ? await treatmentsFor(injury) : [],
        doctor,
        progressPct: milestoneProgressPct(plan.milestones ?? []),
    };
}

/* ─── Overviews ───────────────────────────────────────────────────────────── */

const RECENT_EXAMINATIONS_LIMIT = 5;
const CLEARANCE_STATE_PRIORITY: Record<ClearanceState, number> = { not_cleared: 0, expired: 1, none: 2, restricted: 3, full: 4 };

/** The caller's fighters in scope with their dossiers; fighters whose dossier can't be read are left out. */
async function fightersWithDossiers(scope: FighterScope): Promise<{ fighter: Fighter; dossier: Dossier }[]> {
    const user = await getCurrentUser();
    if (!user) return [];
    const ids = new Set(await fighterIdsIn(scope));
    const fighters = (await listFighters(user)).filter((fighter) => ids.has(fighter.id));
    const dossiers = await Promise.all(fighters.map((fighter) => dossierFor(fighter.id)));
    return fighters.flatMap((fighter, index) => {
        const dossier = dossiers[index];
        return dossier ? [{ fighter, dossier }] : [];
    });
}

export async function doctorOverview(scope: FighterScope, now: string): Promise<DoctorOverview> {
    const [rows, settings] = await Promise.all([fightersWithDossiers(scope), getSettings()]);
    const warningDays = settings.clearanceExpiryWarningDays;
    const healthCounts: Record<HealthStatus, number> = { healthy: 0, monitoring: 0, injured: 0, recovery: 0, not_cleared: 0 };
    for (const { fighter } of rows) healthCounts[fighter.healthStatus] += 1;

    const expiringClearances: DoctorOverview["expiringClearances"] = [];
    const fightersWithoutClearance: DoctorOverview["fightersWithoutClearance"] = [];
    for (const { fighter, dossier } of rows) {
        const { state, clearance } = statusFromDossier(dossier);
        if (state === "none" || state === "expired") fightersWithoutClearance.push({ fighter, state });
        const daysRemaining = clearance && clearance.status === "active" ? clearanceDaysRemaining(clearance, now) : null;
        if (clearance && daysRemaining !== null && daysRemaining >= 0 && daysRemaining <= warningDays) {
            expiringClearances.push({ fighter, clearance, daysRemaining });
        }
    }

    return {
        healthCounts,
        expiringClearances: expiringClearances.sort((a, b) => a.daysRemaining - b.daysRemaining),
        fightersWithoutClearance,
        followUpsDue: [],
        activeInjuries: rows
            .flatMap(({ fighter, dossier }) => dossier.activeInjuries.map((injury) => ({ injury: toInjury(injury), fighter })))
            .sort(byNewest((row) => row.injury.occurredAt)),
        newAlerts: [],
        recentExaminations: rows
            .flatMap(({ fighter, dossier }) =>
                [dossier.currentExaminations.training, dossier.currentExaminations.competition]
                    .filter((exam): exam is ApiExamination => exam !== null)
                    .map((exam) => ({ examination: toExamination(exam), fighter })),
            )
            .sort(byNewest((row) => row.examination.date))
            .slice(0, RECENT_EXAMINATIONS_LIMIT),
    };
}

export async function clearanceOverview(scope: FighterScope, now: string): Promise<ClearanceOverviewRow[]> {
    const rows = await fightersWithDossiers(scope);
    return rows
        .map<ClearanceOverviewRow>(({ fighter, dossier }) => {
            const { state, clearance } = statusFromDossier(dossier);
            return {
                fighter,
                clearance,
                state,
                daysRemaining: clearance ? clearanceDaysRemaining(clearance, now) : null,
                restrictions: state === "restricted" && clearance ? clearance.restrictions : [],
            };
        })
        .sort(
            (a, b) =>
                CLEARANCE_STATE_PRIORITY[a.state] - CLEARANCE_STATE_PRIORITY[b.state] ||
                (a.daysRemaining ?? Number.POSITIVE_INFINITY) - (b.daysRemaining ?? Number.POSITIVE_INFINITY) ||
                a.fighter.name.localeCompare(b.fighter.name),
        );
}
