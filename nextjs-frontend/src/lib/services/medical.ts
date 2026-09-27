import "server-only";

import { ApiError } from "@/lib/api/client";
import { isDemoAuthEnabled } from "@/lib/auth/constants";
import type { MedicalReviewRequest } from "@/lib/domain/medical-contract";
import { clearanceState } from "@/lib/domain/rules";
import type { Fighter, HealthStatus, Injury, MedicalClearance, MedicalExamination, MedicalRecord, RecoveryPlan, Treatment, TreatmentStatus, User } from "@/lib/domain/types";
import type {
    AddTreatmentInput,
    ClearanceFilter,
    ClearanceOverviewRow,
    CreateExaminationInput,
    CreateInjuryInput,
    CreateRecoveryPlanInput,
    DoctorOverview,
    ExaminationFilter,
    FighterHealthSummary,
    FighterScope,
    GrantClearanceInput,
    InjuryDetail,
    InjuryFilter,
    MedicalRecordPatch,
    MedicalResult,
    RecoveryCheckInInput,
    RecoveryPlanDetail,
    RecoveryPlanFilter,
    UpdateInjuryPatch,
} from "./medical.demo";
import * as api from "./medical.api";
import type { ClearanceStatus } from "./medical.api";

/*
 * Medical service. Demo mode delegates to the in-memory records in `medical.demo.ts`, loaded lazily so API
 * mode never touches mock state. In API mode every read and write goes to the NestJS medical API; anything
 * the backend doesn't offer yet fails with 501 API_OPERATION_UNSUPPORTED instead of falling back to mock
 * data. Pages hide those features up front (see `medical-features.ts`), so the 501 is only a backstop.
 */

export type { ClearanceStatus } from "./medical.api";
export type {
    AddTreatmentInput,
    ClearanceFilter,
    ClearanceOverviewRow,
    CreateExaminationInput,
    CreateInjuryInput,
    CreateRecoveryPlanInput,
    DoctorOverview,
    ExaminationFilter,
    ExpiringClearance,
    FighterHealthSummary,
    FighterScope,
    FollowUp,
    GrantClearanceInput,
    InjuryDetail,
    InjuryFilter,
    MedicalRecordPatch,
    MedicalResult,
    RecoveryCheckInInput,
    RecoveryPhaseInput,
    RecoveryPlanDetail,
    RecoveryPlanFilter,
    RecoveryPlanProgress,
    UpdateInjuryPatch,
} from "./medical.demo";

async function demoService(): Promise<typeof import("./medical.demo")> {
    return import("./medical.demo");
}

function unsupported(operation: string, detail: string): never {
    throw new ApiError({
        message: `${operation} is unavailable because the backend does not yet support ${detail}.`,
        kind: "http",
        status: 501,
        code: "API_OPERATION_UNSUPPORTED",
        details: { operation, missingCapability: detail },
    });
}

/* ─── Medical records (demo only) ─────────────────────────────────────────── */

export async function getMedicalRecord(fighterId: string): Promise<MedicalRecord | null> {
    if (isDemoAuthEnabled()) return (await demoService()).getMedicalRecord(fighterId);
    unsupported("Reading a medical record", "medical records");
}

export async function updateMedicalRecord(fighterId: string, patch: MedicalRecordPatch, actor: User): Promise<MedicalResult<MedicalRecord>> {
    if (isDemoAuthEnabled()) return (await demoService()).updateMedicalRecord(fighterId, patch, actor);
    unsupported("Updating a medical record", "medical records");
}

/* ─── Examinations ────────────────────────────────────────────────────────── */

export async function listExaminations(filter: ExaminationFilter = {}): Promise<MedicalExamination[]> {
    if (isDemoAuthEnabled()) return (await demoService()).listExaminations(filter);
    return api.listExaminations(filter);
}

export async function getExamination(id: string): Promise<MedicalExamination | null> {
    if (isDemoAuthEnabled()) return (await demoService()).getExamination(id);
    return api.getExamination(id);
}

export async function createExamination(input: CreateExaminationInput, actor: User): Promise<MedicalResult<MedicalExamination>> {
    if (isDemoAuthEnabled()) return (await demoService()).createExamination(input, actor);
    unsupported("Recording an examination with vitals", "vitals and assessments");
}

/* ─── Injuries & treatments ───────────────────────────────────────────────── */

export async function listInjuries(filter: InjuryFilter = {}): Promise<Injury[]> {
    if (isDemoAuthEnabled()) return (await demoService()).listInjuries(filter);
    return api.listInjuries(filter);
}

export async function getInjury(id: string): Promise<Injury | null> {
    if (isDemoAuthEnabled()) return (await demoService()).getInjury(id);
    return api.getInjury(id);
}

export async function getInjuryDetail(id: string): Promise<InjuryDetail | null> {
    if (isDemoAuthEnabled()) return (await demoService()).getInjuryDetail(id);
    return api.getInjuryDetail(id);
}

export async function createInjury(input: CreateInjuryInput, actor: User): Promise<MedicalResult<Injury>> {
    if (isDemoAuthEnabled()) return (await demoService()).createInjury(input, actor);
    unsupported("Recording an injury", "this injury form");
}

export async function updateInjury(id: string, patch: UpdateInjuryPatch, actor: User): Promise<MedicalResult<Injury>> {
    if (isDemoAuthEnabled()) return (await demoService()).updateInjury(id, patch, actor);
    unsupported("Updating an injury", "this injury form");
}

export async function addTreatment(input: AddTreatmentInput, actor: User): Promise<MedicalResult<Treatment>> {
    if (isDemoAuthEnabled()) return (await demoService()).addTreatment(input, actor);
    unsupported("Adding a treatment", "this treatment form");
}

export async function updateTreatmentStatus(id: string, status: TreatmentStatus, actor: User): Promise<MedicalResult<Treatment>> {
    if (isDemoAuthEnabled()) return (await demoService()).updateTreatmentStatus(id, status, actor);
    unsupported("Changing a treatment's status", "treatment status");
}

/* ─── Recovery plans ──────────────────────────────────────────────────────── */

export async function listRecoveryPlans(filter: RecoveryPlanFilter = {}): Promise<RecoveryPlan[]> {
    if (isDemoAuthEnabled()) return (await demoService()).listRecoveryPlans(filter);
    return api.listRecoveryPlans(filter);
}

export async function getRecoveryPlan(id: string): Promise<RecoveryPlan | null> {
    if (isDemoAuthEnabled()) return (await demoService()).getRecoveryPlan(id);
    return api.getRecoveryPlan(id);
}

export async function getRecoveryPlanDetail(id: string): Promise<RecoveryPlanDetail | null> {
    if (isDemoAuthEnabled()) return (await demoService()).getRecoveryPlanDetail(id);
    return api.getRecoveryPlanDetail(id);
}

export async function createRecoveryPlan(input: CreateRecoveryPlanInput, actor: User): Promise<MedicalResult<RecoveryPlan>> {
    if (isDemoAuthEnabled()) return (await demoService()).createRecoveryPlan(input, actor);
    unsupported("Creating a phased recovery plan", "recovery phases");
}

export async function addRecoveryCheckIn(planId: string, checkIn: RecoveryCheckInInput, actor: User): Promise<MedicalResult<RecoveryPlan>> {
    if (isDemoAuthEnabled()) return (await demoService()).addRecoveryCheckIn(planId, checkIn, actor);
    unsupported("Logging a recovery check-in", "recovery check-ins");
}

export async function setMilestone(planId: string, phaseId: string, milestoneIndex: number, done: boolean, actor: User): Promise<MedicalResult<RecoveryPlan>> {
    if (isDemoAuthEnabled()) return (await demoService()).setMilestone(planId, phaseId, milestoneIndex, done, actor);
    unsupported("Updating a recovery phase milestone", "recovery phases");
}

export async function advanceRecoveryPhase(planId: string, actor: User): Promise<MedicalResult<RecoveryPlan>> {
    if (isDemoAuthEnabled()) return (await demoService()).advanceRecoveryPhase(planId, actor);
    unsupported("Advancing a recovery phase", "recovery phases");
}

/* ─── Medical Clearance ───────────────────────────────────────────────────── */

export async function listClearances(filter: ClearanceFilter = {}): Promise<MedicalClearance[]> {
    if (isDemoAuthEnabled()) return (await demoService()).listClearances(filter);
    return api.listClearances(filter, new Date().toISOString());
}

/**
 * The fighter's training clearance state and the clearance behind it. In API mode the medical service's eligibility
 * verdict decides the state; the clearance is shown only when exactly one applies.
 */
export async function getClearanceStatus(fighterId: string, now: string | Date = new Date()): Promise<ClearanceStatus> {
    if (isDemoAuthEnabled()) {
        const clearance = (await demoService()).getCurrentClearanceFor(fighterId);
        return { state: clearanceState(clearance, now), clearance, eligibility: null };
    }
    return api.clearanceStatus(fighterId);
}

/** Medical review requests for one fighter, newest first. Demo mode has none yet. */
export async function listReviewRequests(fighterId: string): Promise<MedicalReviewRequest[]> {
    if (isDemoAuthEnabled()) return [];
    return api.reviewRequests(fighterId);
}

export async function getClearanceHistory(fighterId: string): Promise<MedicalClearance[]> {
    if (isDemoAuthEnabled()) return (await demoService()).getClearanceHistory(fighterId);
    return api.listClearances({ fighterIds: [fighterId] }, new Date().toISOString());
}

export async function grantClearance(input: GrantClearanceInput, actor: User): Promise<MedicalResult<MedicalClearance>> {
    if (isDemoAuthEnabled()) return (await demoService()).grantClearance(input, actor);
    unsupported("Granting a clearance with blocked lists", "blocked-list restrictions");
}

export async function revokeClearance(clearanceId: string, reason: string, actor: User): Promise<MedicalResult<MedicalClearance>> {
    if (isDemoAuthEnabled()) return (await demoService()).revokeClearance(clearanceId, reason, actor);
    unsupported("Revoking a clearance", "this clearance form");
}

/* ─── Health status (demo only) ───────────────────────────────────────────── */

export async function updateHealthStatus(fighterId: string, status: HealthStatus, actor: User): Promise<MedicalResult<Fighter>> {
    if (isDemoAuthEnabled()) return (await demoService()).updateHealthStatus(fighterId, status, actor);
    unsupported("Setting a fighter's health status", "manual health status");
}

/* ─── Overviews ───────────────────────────────────────────────────────────── */

export async function getFighterHealthSummary(fighterId: string, now: string | Date = new Date()): Promise<FighterHealthSummary | null> {
    if (isDemoAuthEnabled()) return (await demoService()).getFighterHealthSummary(fighterId, now);
    return api.healthSummary(fighterId);
}

export async function getDoctorOverview(fighterIds: FighterScope, now: string | Date = new Date()): Promise<DoctorOverview> {
    if (isDemoAuthEnabled()) return (await demoService()).getDoctorOverview(fighterIds, now);
    return api.doctorOverview(fighterIds, new Date(now).toISOString());
}

export async function getClearanceOverview(fighterIds: FighterScope, now: string | Date = new Date()): Promise<ClearanceOverviewRow[]> {
    if (isDemoAuthEnabled()) return (await demoService()).getClearanceOverview(fighterIds, now);
    return api.clearanceOverview(fighterIds, new Date(now).toISOString());
}
