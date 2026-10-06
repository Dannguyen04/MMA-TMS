import "server-only";

import { isDemoAuthEnabled } from "@/lib/auth/constants";
import type { ClearanceInput, ExaminationDecisionInput, InjuryInput, RecoveryPlanInput, RecoveryPlanPatch, TreatmentInput } from "@/lib/domain/medical-bodies";
import type { ApiInjuryStatus, MedicalReviewRequest } from "@/lib/domain/medical-contract";
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
import { unsupportedOperation } from "./api-helpers";
import * as api from "./medical.api";
import type { ClearanceStatus, ClinicalDossier } from "./medical.api";

/*
 * Medical service. Demo mode delegates to the in-memory records in `medical.demo.ts`, loaded lazily so API
 * mode never touches mock state. In API mode every read and write goes to the NestJS medical API; anything
 * the backend doesn't offer yet fails with 501 API_OPERATION_UNSUPPORTED instead of falling back to mock
 * data. Pages hide those features up front (see `medical-features.ts`), so the 501 is only a backstop.
 *
 * API-mode writes throw the service's ApiError on failure; Server Actions map it with `medicalWriteFailure`.
 * Writes in the service's own terms (examination decisions, clearances issued from an examination, flat recovery
 * milestones) exist only in API mode; demo mode keeps its own forms for those.
 */

export type { ClearanceStatus, ClinicalDossier, CurrentExamination } from "./medical.api";
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

/* ─── Medical records (demo only) ─────────────────────────────────────────── */

export async function getMedicalRecord(fighterId: string): Promise<MedicalRecord | null> {
    if (isDemoAuthEnabled()) return (await demoService()).getMedicalRecord(fighterId);
    unsupportedOperation("Reading a medical record", "medical records");
}

export async function updateMedicalRecord(fighterId: string, patch: MedicalRecordPatch, actor: User): Promise<MedicalResult<MedicalRecord>> {
    if (isDemoAuthEnabled()) return (await demoService()).updateMedicalRecord(fighterId, patch, actor);
    unsupportedOperation("Updating a medical record", "medical records");
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
    unsupportedOperation("Recording an examination with vitals", "vitals and assessments");
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
    unsupportedOperation("Recording an injury", "this injury form");
}

/** In API mode only the status can change, within the service's rules (a resolved injury stays resolved). */
export async function updateInjury(id: string, patch: UpdateInjuryPatch, actor: User): Promise<MedicalResult<Injury>> {
    if (isDemoAuthEnabled()) return (await demoService()).updateInjury(id, patch, actor);
    const { status, ...rest } = patch;
    if (!status || Object.keys(rest).length > 0) unsupportedOperation("Editing an injury's details", "this injury form");
    return { ok: true, data: await api.updateInjury(id, { status: status.toUpperCase() as ApiInjuryStatus }) };
}

/** Records an injury in the medical service's terms (joint, free-text type). API mode only. */
export async function recordInjury(fighterId: string, input: InjuryInput): Promise<Injury> {
    if (isDemoAuthEnabled()) unsupportedOperation("Recording an injury by joint", "the demo injury form");
    return api.recordInjury(fighterId, input);
}

/** Appends a treatment to an injury. API mode only; demo mode keeps its own treatment form. */
export async function recordTreatment(injury: Pick<Injury, "id" | "fighterId">, input: TreatmentInput): Promise<Treatment> {
    if (isDemoAuthEnabled()) unsupportedOperation("Recording a treatment", "the demo treatment form");
    return api.recordTreatment(injury, input);
}

export async function addTreatment(input: AddTreatmentInput, actor: User): Promise<MedicalResult<Treatment>> {
    if (isDemoAuthEnabled()) return (await demoService()).addTreatment(input, actor);
    unsupportedOperation("Adding a treatment", "this treatment form");
}

export async function updateTreatmentStatus(id: string, status: TreatmentStatus, actor: User): Promise<MedicalResult<Treatment>> {
    if (isDemoAuthEnabled()) return (await demoService()).updateTreatmentStatus(id, status, actor);
    unsupportedOperation("Changing a treatment's status", "treatment status");
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
    unsupportedOperation("Creating a phased recovery plan", "recovery phases");
}

export async function addRecoveryCheckIn(planId: string, checkIn: RecoveryCheckInInput, actor: User): Promise<MedicalResult<RecoveryPlan>> {
    if (isDemoAuthEnabled()) return (await demoService()).addRecoveryCheckIn(planId, checkIn, actor);
    unsupportedOperation("Logging a recovery check-in", "recovery check-ins");
}

export async function setMilestone(planId: string, phaseId: string, milestoneIndex: number, done: boolean, actor: User): Promise<MedicalResult<RecoveryPlan>> {
    if (isDemoAuthEnabled()) return (await demoService()).setMilestone(planId, phaseId, milestoneIndex, done, actor);
    unsupportedOperation("Updating a recovery phase milestone", "recovery phases");
}

export async function advanceRecoveryPhase(planId: string, actor: User): Promise<MedicalResult<RecoveryPlan>> {
    if (isDemoAuthEnabled()) return (await demoService()).advanceRecoveryPhase(planId, actor);
    unsupportedOperation("Advancing a recovery phase", "recovery phases");
}

/** Creates a recovery plan with flat milestones. API mode only; demo plans are phased. */
export async function createMilestonePlan(fighterId: string, input: RecoveryPlanInput): Promise<RecoveryPlan> {
    if (isDemoAuthEnabled()) unsupportedOperation("Creating a milestone recovery plan", "the demo's phased plans");
    return api.createRecoveryPlan(fighterId, input);
}

/** Updates a milestone plan: its milestones (the whole list), end date or status. API mode only. */
export async function updateMilestonePlan(planId: string, patch: RecoveryPlanPatch): Promise<RecoveryPlan> {
    if (isDemoAuthEnabled()) unsupportedOperation("Updating a milestone recovery plan", "the demo's phased plans");
    return api.updateRecoveryPlan(planId, patch);
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
    if (isDemoAuthEnabled()) return (await demoService()).getClearanceStatusFor(fighterId, now);
    return api.clearanceStatus(fighterId);
}

/** Medical review requests for one fighter, newest first. */
export async function listReviewRequests(fighterId: string): Promise<MedicalReviewRequest[]> {
    if (isDemoAuthEnabled()) return (await demoService()).listReviewRequests(fighterId);
    return api.reviewRequests(fighterId);
}

/** Asks the fighter's doctors for a review; training pauses until an examination answers it. */
export async function createReviewRequest(fighterId: string, reason: string, actor: User): Promise<MedicalResult<MedicalReviewRequest>> {
    if (isDemoAuthEnabled()) return (await demoService()).createReviewRequest(fighterId, reason, actor);
    return { ok: true, data: await api.createReviewRequest(fighterId, reason) };
}

/**
 * What the doctor's forms need about one fighter: current examinations, active clearances, open review requests and
 * eligibility, from one dossier read. Null in demo mode, whose forms work from the demo records instead.
 */
export async function getClinicalDossier(fighterId: string): Promise<ClinicalDossier | null> {
    if (isDemoAuthEnabled()) return null;
    return api.clinicalDossier(fighterId);
}

/** Records an examination decision for a scope. API mode only; demo mode records vitals-based examinations. */
export async function recordExaminationDecision(fighterId: string, input: ExaminationDecisionInput): Promise<MedicalExamination> {
    if (isDemoAuthEnabled()) unsupportedOperation("Recording an examination decision", "the demo examination form");
    return api.recordExamination(fighterId, input);
}

/** Issues a clearance from the fighter's current positive examination. API mode only. */
export async function issueClearance(fighterId: string, input: ClearanceInput): Promise<MedicalClearance> {
    if (isDemoAuthEnabled()) unsupportedOperation("Issuing a clearance from an examination", "the demo clearance form");
    return api.issueClearance(fighterId, input);
}

export async function getClearanceHistory(fighterId: string): Promise<MedicalClearance[]> {
    if (isDemoAuthEnabled()) return (await demoService()).getClearanceHistory(fighterId);
    return api.listClearances({ fighterIds: [fighterId] }, new Date().toISOString());
}

export async function grantClearance(input: GrantClearanceInput, actor: User): Promise<MedicalResult<MedicalClearance>> {
    if (isDemoAuthEnabled()) return (await demoService()).grantClearance(input, actor);
    unsupportedOperation("Granting a clearance with blocked lists", "blocked-list restrictions");
}

export async function revokeClearance(clearanceId: string, reason: string, actor: User): Promise<MedicalResult<MedicalClearance>> {
    if (isDemoAuthEnabled()) return (await demoService()).revokeClearance(clearanceId, reason, actor);
    return { ok: true, data: await api.revokeClearance(clearanceId, reason) };
}

/* ─── Health status (demo only) ───────────────────────────────────────────── */

export async function updateHealthStatus(fighterId: string, status: HealthStatus, actor: User): Promise<MedicalResult<Fighter>> {
    if (isDemoAuthEnabled()) return (await demoService()).updateHealthStatus(fighterId, status, actor);
    unsupportedOperation("Setting a fighter's health status", "manual health status");
}

/* ─── Overviews ───────────────────────────────────────────────────────────── */

export async function getFighterHealthSummary(fighterId: string, now: string | Date = new Date()): Promise<FighterHealthSummary | null> {
    if (isDemoAuthEnabled()) return (await demoService()).getFighterHealthSummary(fighterId, now);
    return api.healthSummary(fighterId, now);
}

export async function getDoctorOverview(fighterIds: FighterScope, now: string | Date = new Date()): Promise<DoctorOverview> {
    if (isDemoAuthEnabled()) return (await demoService()).getDoctorOverview(fighterIds, now);
    return api.doctorOverview(fighterIds, new Date(now).toISOString());
}

export async function getClearanceOverview(fighterIds: FighterScope, now: string | Date = new Date()): Promise<ClearanceOverviewRow[]> {
    if (isDemoAuthEnabled()) return (await demoService()).getClearanceOverview(fighterIds, now);
    return api.clearanceOverview(fighterIds, new Date(now).toISOString());
}
