import "server-only";

/*
 * Demo medical service: the in-memory clinical records behind demo mode. Only `medical.ts` loads this file,
 * lazily and only in demo mode, so API mode never serves mock clinical data.
 */

import type { EligibilityReason, MedicalEligibility, MedicalReviewRequest } from "@/lib/domain/medical-contract";
import { SCAT6, type Scat6Input, type Scat6Record } from "@/lib/domain/scat6";
import { SCAT6_SCORING_VERSION, scoreScat6 } from "@/lib/domain/scat6-scoring";
import { BODY_REGION_LABELS, CLEARANCE_LEVEL_LABELS, examinationTitle, HEALTH_STATUS_DESCRIPTIONS, HEALTH_STATUS_LABELS, INJURY_STATUS_LABELS, injuryTypeName, TREATMENT_STATUS_LABELS, treatmentTitle } from "@/lib/domain/labels";
import {
    clearanceDaysRemaining,
    clearanceExpiresSoon,
    clearanceState,
    currentClearance,
    FOLLOW_UP_WINDOW_DAYS,
    healthStatusForClearance,
    recoveryProgressPct,
    type ClearanceState,
} from "@/lib/domain/rules";
import type {
    AbnormalMovementAlert,
    ClearanceLevel,
    ClearanceStatus,
    Doctor,
    ExaminationOutcome,
    ExaminationType,
    Fighter,
    HealthStatus,
    Injury,
    InjurySeverity,
    InjuryStatus,
    InjuryType,
    BodyRegion,
    MedicalClearance,
    MedicalExamination,
    MedicalRecord,
    RecoveryCheckIn,
    RecoveryPhase,
    RecoveryPlan,
    RecoveryPlanStatus,
    TrainingRestriction,
    Treatment,
    TreatmentStatus,
    User,
} from "@/lib/domain/types";
import { ageFromBirthDate, dayKey, daysBetween, formatDate } from "@/lib/format";
import { db, newId, nowIso, simulateLatency } from "@/lib/mocks/db";
import { matchesSearch } from "@/lib/query";
import { routes } from "@/lib/routes";
import { recordAudit } from "./audit.demo";
import { notifyUsers, staffUserIdsForFighter } from "./notifications.demo";

/* ─── Shared types & helpers ──────────────────────────────────────────────── */

/** Fighter ids the caller may see — pass `accessibleFighterIds(user)`. Omitted or "all" means unrestricted. */
export type FighterScope = string[] | "all";

/** Outcome of a medical mutation. Expected failures are returned with a user-facing message, never thrown. */
export type MedicalResult<T> = { ok: true; data: T } | { ok: false; error: string };

const success = <T>(data: T): MedicalResult<T> => ({ ok: true, data });
const failure = (error: string): MedicalResult<never> => ({ ok: false, error });

const PHYSICAL_EXAM_TYPES: ExaminationType[] = ["baseline", "routine", "pre_fight"];

function inScope(scope: FighterScope | undefined, fighterId: string): boolean {
    return scope === undefined || scope === "all" || scope.includes(fighterId);
}

/** Inclusive range check. Date-only bounds (YYYY-MM-DD) compare by academy calendar day. */
function withinRange(value: string, from?: string, to?: string): boolean {
    const comparable = (bound: string) => (bound.length === 10 ? dayKey(value) : value);
    if (from && comparable(from) < from) return false;
    if (to && comparable(to) > to) return false;
    return true;
}

function findFighter(fighterId: string): Fighter | undefined {
    return db().fighters.find((f) => f.id === fighterId);
}

/** Looks a doctor up by profile id (d-*) or user id. */
function findDoctor(doctorId: string): Doctor | null {
    return db().doctors.find((d) => d.id === doctorId || d.userId === doctorId) ?? null;
}

const NOT_A_DOCTOR = "Chỉ bác sĩ thể thao phụ trách mới ghi được mục này.";

/** Doctor profile id recorded on clinical entities created by `actor`; null when the actor isn't a sports doctor. */
function actingDoctorId(actor: User): string | null {
    return actor.role === "doctor" && actor.profileId ? actor.profileId : null;
}

const fighterUserIds = (fighterId: string) => staffUserIdsForFighter(fighterId, ["fighter"]);
const coachUserIds = (fighterId: string) => staffUserIdsForFighter(fighterId, ["coach"]);
const otherDoctorUserIds = (fighterId: string, actor: User) =>
    staffUserIdsForFighter(fighterId, ["doctor"]).filter((userId) => userId !== actor.id);

const isOpenInjury = (injury: Injury) => injury.status !== "resolved";

const byDateDesc = <T>(date: (item: T) => string) => (a: T, b: T) => date(b).localeCompare(date(a));

/** Copies defined patch values onto the target and returns the changed keys. */
function assignDefined<T extends object>(target: T, patch: Partial<T>): (keyof T)[] {
    const changed: (keyof T)[] = [];
    for (const key of Object.keys(patch) as (keyof T)[]) {
        const value = patch[key];
        if (value === undefined || value === target[key]) continue;
        target[key] = value as T[keyof T];
        changed.push(key);
    }
    return changed;
}

function joinDetails(parts: (string | null)[]): string | null {
    const present = parts.filter((part): part is string => Boolean(part));
    return present.length > 0 ? present.join("; ") : null;
}

function latestPhysicalDate(fighterId: string): string | null {
    const dates = db()
        .medicalExaminations.filter((e) => e.fighterId === fighterId && e.type !== null && PHYSICAL_EXAM_TYPES.includes(e.type))
        .map((e) => e.date)
        .sort();
    return dates.at(-1) ?? null;
}

/* ─── Health status ───────────────────────────────────────────────────────── */

/** Health status recomputed from clearance and injuries after an injury changes. */
function healthStatusFromRecords(fighter: Fighter): HealthStatus {
    const store = db();
    const state = clearanceState(currentClearance(store.medicalClearances, fighter.id));
    const cleared = state === "full" || state === "restricted";
    if (state === "not_cleared" || (!cleared && fighter.healthStatus === "not_cleared")) return "not_cleared";
    const open = store.injuries.filter((i) => i.fighterId === fighter.id && isOpenInjury(i));
    if (open.some((i) => i.status === "active")) return "injured";
    if (open.length > 0) return "recovery";
    if (state === "restricted" || fighter.healthStatus === "monitoring") return "monitoring";
    return "healthy";
}

/* ─── Medical records ─────────────────────────────────────────────────────── */

export type MedicalRecordPatch = Partial<
    Pick<MedicalRecord, "bloodType" | "allergies" | "chronicConditions" | "medications" | "surgicalHistory" | "emergencyContact" | "notes">
>;

/** The fighter's medical record, or null when none has been opened. */
export async function getMedicalRecord(fighterId: string): Promise<MedicalRecord | null> {
    await simulateLatency();
    return db().medicalRecords.find((r) => r.fighterId === fighterId) ?? null;
}

/** Updates a fighter's medical record, opening one first if the fighter has none. */
export async function updateMedicalRecord(fighterId: string, patch: MedicalRecordPatch, actor: User): Promise<MedicalResult<MedicalRecord>> {
    const store = db();
    const fighter = findFighter(fighterId);
    if (!fighter) return failure("Không tìm thấy võ sĩ.");
    const doctorId = actingDoctorId(actor);
    if (!doctorId) return failure(NOT_A_DOCTOR);

    let record = store.medicalRecords.find((r) => r.fighterId === fighterId);
    const opened = !record;
    if (!record) {
        record = {
            id: newId("mr"),
            fighterId,
            primaryDoctorId: doctorId,
            bloodType: "Chưa ghi nhận",
            allergies: [],
            chronicConditions: [],
            medications: [],
            surgicalHistory: [],
            emergencyContact: { name: "", relation: "", phone: "" },
            lastPhysicalAt: latestPhysicalDate(fighterId) ?? fighter.joinedAt,
            notes: "",
            documents: [],
            updatedAt: nowIso(),
        };
        store.medicalRecords.push(record);
    }

    const changed = assignDefined(record, patch);
    record.updatedAt = nowIso();

    recordAudit({
        actor,
        action: opened ? "medical_record.create" : "medical_record.update",
        resourceType: "medical_record",
        resourceId: record.id,
        resourceLabel: `Bệnh án — ${fighter.name}`,
        details: changed.length > 0 ? `Trường đã cập nhật: ${changed.join(", ")}` : null,
    });
    return success(record);
}

/* ─── Examinations ────────────────────────────────────────────────────────── */

export interface ExaminationFilter {
    fighterIds?: FighterScope;
    type?: ExaminationType;
    outcome?: ExaminationOutcome;
    /** Inclusive; ISO timestamp or YYYY-MM-DD. */
    from?: string;
    to?: string;
}

/** Examinations matching the filter, newest first. */
export async function listExaminations(filter: ExaminationFilter = {}): Promise<MedicalExamination[]> {
    await simulateLatency();
    return db()
        .medicalExaminations.filter(
            (e) =>
                inScope(filter.fighterIds, e.fighterId) &&
                (!filter.type || e.type === filter.type) &&
                (!filter.outcome || e.outcome === filter.outcome) &&
                withinRange(e.date, filter.from, filter.to),
        )
        .sort(byDateDesc((e) => e.date));
}

/** A single examination, or null. */
export async function getExamination(id: string): Promise<MedicalExamination | null> {
    await simulateLatency();
    return db().medicalExaminations.find((e) => e.id === id) ?? null;
}

/** A baseline carries its SCAT6 as recorded; the demo scores it the way the medical service does. */
export type CreateExaminationInput = Omit<MedicalExamination, "id" | "doctorId" | "scat6"> & { scat6: Scat6Input | null };

function scat6Record(input: Scat6Input): Scat6Record {
    return input.status === "ADMINISTERED"
        ? { formVersion: input.formVersion, responses: input, scoringVersion: SCAT6_SCORING_VERSION, scores: scoreScat6(input) }
        : { formVersion: input.formVersion, responses: input, scoringVersion: null, scores: null };
}

/**
 * Records an examination. Examinations never change Medical Clearance — grant or revoke a
 * clearance separately. Physical examinations update the record's lastPhysicalAt.
 */
export async function createExamination(input: CreateExaminationInput, actor: User): Promise<MedicalResult<MedicalExamination>> {
    const store = db();
    const fighter = findFighter(input.fighterId);
    if (!fighter) return failure("Không tìm thấy võ sĩ.");
    const doctorId = actingDoctorId(actor);
    if (!doctorId) return failure(NOT_A_DOCTOR);
    if (input.scat6?.status === "ADMINISTERED" && ageFromBirthDate(fighter.dateOfBirth, input.scat6.administeredAt) < SCAT6.MIN_AGE_YEARS) {
        return failure(`${fighter.name} dưới 13 tuổi khi thực hiện SCAT6. Hãy ghi là không thực hiện.`);
    }

    const examination: MedicalExamination = { ...input, id: newId("ex"), doctorId, scat6: input.scat6 ? scat6Record(input.scat6) : null };
    store.medicalExaminations.push(examination);

    // Like a training examination in the medical service, this answers the fighter's open review requests.
    for (const request of store.medicalReviewRequests) {
        if (request.fighterId !== fighter.id || request.status !== "OPEN") continue;
        Object.assign(request, { status: "RESOLVED", resolvedAt: examination.date, resolvedByExaminationId: examination.id });
    }

    const record = store.medicalRecords.find((r) => r.fighterId === fighter.id);
    if (record) {
        if (examination.type !== null && PHYSICAL_EXAM_TYPES.includes(examination.type) && examination.date > record.lastPhysicalAt) {
            record.lastPhysicalAt = examination.date;
        }
        record.updatedAt = nowIso();
    }

    recordAudit({
        actor,
        action: "examination.create",
        resourceType: "examination",
        resourceId: examination.id,
        resourceLabel: `Phiếu khám — ${fighter.name}`,
    });
    notifyUsers({
        userIds: fighterUserIds(fighter.id),
        category: "medical",
        title: "Đã ghi phiếu khám",
        body: `${findDoctor(examination.doctorId)?.name ?? actor.name} đã ghi phiếu ${examinationTitle(examination).toLowerCase()} của bạn. Xem kết luận và khuyến nghị trên trang Sức khỏe.`,
        href: routes.fighter.health,
    });
    return success(examination);
}

/* ─── Injuries ────────────────────────────────────────────────────────────── */

export interface InjuryFilter {
    fighterIds?: FighterScope;
    status?: InjuryStatus;
    severity?: InjurySeverity;
    type?: InjuryType;
    bodyRegion?: BodyRegion;
    /** Inclusive bounds on occurredAt; ISO timestamp or YYYY-MM-DD. */
    from?: string;
    to?: string;
    /** Matches fighter name, description, injury type and body region. */
    search?: string;
}

/** Injuries matching the filter, most recent first. */
export async function listInjuries(filter: InjuryFilter = {}): Promise<Injury[]> {
    await simulateLatency();
    const store = db();
    const fighterNames = new Map(store.fighters.map((f) => [f.id, f.name]));
    return store.injuries
        .filter(
            (i) =>
                inScope(filter.fighterIds, i.fighterId) &&
                (!filter.status || i.status === filter.status) &&
                (!filter.severity || i.severity === filter.severity) &&
                (!filter.type || i.type === filter.type) &&
                (!filter.bodyRegion || i.bodyRegion === filter.bodyRegion) &&
                withinRange(i.occurredAt, filter.from, filter.to) &&
                matchesSearch(filter.search, fighterNames.get(i.fighterId), i.description, injuryTypeName(i), BODY_REGION_LABELS[i.bodyRegion]),
        )
        .sort(byDateDesc((i) => i.occurredAt));
}

/** A single injury, or null. */
export async function getInjury(id: string): Promise<Injury | null> {
    await simulateLatency();
    return db().injuries.find((i) => i.id === id) ?? null;
}

export interface InjuryDetail {
    injury: Injury;
    fighter: Fighter;
    /** Oldest first. */
    treatments: Treatment[];
    /** The active plan for this injury, otherwise the most recent one. */
    recoveryPlan: RecoveryPlan | null;
    linkedAlert: AbnormalMovementAlert | null;
    recordedBy: Doctor | null;
}

/** An injury with its fighter, treatments, recovery plan, linked AI observation and recording doctor. */
export async function getInjuryDetail(id: string): Promise<InjuryDetail | null> {
    await simulateLatency();
    const store = db();
    const injury = store.injuries.find((i) => i.id === id);
    const fighter = injury ? findFighter(injury.fighterId) : undefined;
    if (!injury || !fighter) return null;

    const plans = store.recoveryPlans.filter((p) => p.injuryId === id).sort(byDateDesc((p) => p.startDate));
    const linkedAlert =
        store.abnormalMovementAlerts.find((a) => a.id === injury.linkedAlertId) ??
        store.abnormalMovementAlerts.find((a) => a.linkedInjuryId === id) ??
        null;

    return {
        injury,
        fighter,
        treatments: store.treatments.filter((t) => t.injuryId === id).sort((a, b) => a.startDate.localeCompare(b.startDate)),
        recoveryPlan: plans.find((p) => p.status === "active") ?? plans[0] ?? null,
        linkedAlert,
        recordedBy: findDoctor(injury.recordedById),
    };
}

export type CreateInjuryInput = Pick<
    Injury,
    "fighterId" | "type" | "bodyRegion" | "severity" | "mechanism" | "occurredAt" | "diagnosedAt" | "description" | "expectedReturnAt" | "linkedAlertId"
> & {
    /** Defaults to "active". */
    status?: Exclude<InjuryStatus, "resolved">;
};

/**
 * Records an injury, links the AI observation both ways, and moves the fighter to "injured"
 * ("recovery" when recorded as recovering) unless they are Not Cleared. Coaches are told to
 * check Medical Clearance without clinical detail.
 */
export async function createInjury(input: CreateInjuryInput, actor: User): Promise<MedicalResult<Injury>> {
    const store = db();
    const fighter = findFighter(input.fighterId);
    if (!fighter) return failure("Không tìm thấy võ sĩ.");
    const doctorId = actingDoctorId(actor);
    if (!doctorId) return failure(NOT_A_DOCTOR);

    const alert = input.linkedAlertId ? store.abnormalMovementAlerts.find((a) => a.id === input.linkedAlertId) : undefined;
    if (input.linkedAlertId && alert?.fighterId !== fighter.id) {
        return failure("Quan sát AI được liên kết không thuộc võ sĩ này.");
    }

    const { status = "active", ...fields } = input;
    const injury: Injury = { ...fields, id: newId("inj"), recordedById: doctorId, status, resolvedAt: null };
    store.injuries.push(injury);
    if (alert) alert.linkedInjuryId = injury.id;

    if (fighter.healthStatus !== "not_cleared") fighter.healthStatus = status === "recovering" ? "recovery" : "injured";

    recordAudit({
        actor,
        action: "injury.create",
        resourceType: "injury",
        resourceId: injury.id,
        resourceLabel: `Hồ sơ chấn thương — ${fighter.name}`,
        details: alert ? `Đã liên kết quan sát AI ${alert.id}` : null,
    });
    notifyUsers({
        userIds: coachUserIds(fighter.id),
        category: "medical",
        severity: "warning",
        title: `Ghi nhận chấn thương mới của ${fighter.name}`,
        body: `${fighter.name} có chấn thương mới — hãy kiểm tra giấy phép trước khi lên lịch tập.`,
        href: routes.coach.clearance,
    });
    notifyUsers({
        userIds: fighterUserIds(fighter.id),
        category: "medical",
        title: "Đã ghi nhận chấn thương",
        body: "Bác sĩ thể thao đã ghi một chấn thương vào hồ sơ sức khỏe của bạn. Điều trị, các bước phục hồi và hạn chế tập luyện sẽ hiện trên trang Sức khỏe.",
        href: routes.fighter.injury(injury.id),
    });
    return success(injury);
}

export type UpdateInjuryPatch = Partial<
    Pick<
        Injury,
        "type" | "bodyRegion" | "severity" | "status" | "mechanism" | "occurredAt" | "diagnosedAt" | "description" | "expectedReturnAt" | "linkedAlertId"
    >
>;

/**
 * Updates an injury. Resolving sets resolvedAt (reopening clears it) and the fighter's health
 * status is recomputed from their clearance and remaining injuries.
 */
export async function updateInjury(id: string, patch: UpdateInjuryPatch, actor: User): Promise<MedicalResult<Injury>> {
    const store = db();
    const injury = store.injuries.find((i) => i.id === id);
    if (!injury) return failure("Không tìm thấy chấn thương.");
    const fighter = findFighter(injury.fighterId);
    if (!fighter) return failure("Không tìm thấy võ sĩ.");

    if (patch.linkedAlertId !== undefined && patch.linkedAlertId !== injury.linkedAlertId) {
        const next = patch.linkedAlertId ? store.abnormalMovementAlerts.find((a) => a.id === patch.linkedAlertId) : undefined;
        if (patch.linkedAlertId && next?.fighterId !== injury.fighterId) {
            return failure("Quan sát AI được liên kết không thuộc võ sĩ này.");
        }
        const previous = store.abnormalMovementAlerts.find((a) => a.id === injury.linkedAlertId);
        if (previous?.linkedInjuryId === injury.id) previous.linkedInjuryId = null;
        if (next) next.linkedInjuryId = injury.id;
    }

    const previousStatus = injury.status;
    const changed = assignDefined(injury, patch);
    const resolvedNow = injury.status === "resolved" && previousStatus !== "resolved";
    if (resolvedNow) injury.resolvedAt = nowIso();
    if (injury.status !== "resolved") injury.resolvedAt = null;

    fighter.healthStatus = healthStatusFromRecords(fighter);

    recordAudit({
        actor,
        action: resolvedNow ? "injury.resolve" : "injury.update",
        resourceType: "injury",
        resourceId: injury.id,
        resourceLabel: `Hồ sơ chấn thương — ${fighter.name}`,
        details: joinDetails([
            changed.length > 0 ? `Trường đã cập nhật: ${changed.join(", ")}` : null,
            previousStatus !== injury.status ? `Trạng thái: ${INJURY_STATUS_LABELS[previousStatus]} → ${INJURY_STATUS_LABELS[injury.status]}` : null,
        ]),
    });

    if (resolvedNow) {
        notifyUsers({
            userIds: fighterUserIds(fighter.id),
            category: "medical",
            severity: "success",
            title: "Chấn thương đã khỏi",
            body: "Bác sĩ thể thao đã đánh dấu chấn thương của bạn đã khỏi. Hãy kiểm tra giấy phép trước khi tập lại đầy đủ.",
            href: routes.fighter.injury(injury.id),
        });
        notifyUsers({
            userIds: coachUserIds(fighter.id),
            category: "medical",
            title: `Chấn thương của ${fighter.name} đã khỏi`,
            body: `Chấn thương của ${fighter.name} đã được đánh dấu khỏi — hãy kiểm tra giấy phép để biết tình trạng tập hiện tại.`,
            href: routes.coach.clearance,
        });
    }
    return success(injury);
}

/* ─── Treatments ──────────────────────────────────────────────────────────── */

export type AddTreatmentInput = Pick<Treatment, "injuryId" | "providerName" | "type" | "description" | "frequency" | "startDate" | "endDate" | "notes"> & {
    /** Defaults from the dates: planned (future start), completed (past end) or ongoing. */
    status?: TreatmentStatus;
};

/** Adds a treatment to an injury and lets the fighter know. */
export async function addTreatment(input: AddTreatmentInput, actor: User): Promise<MedicalResult<Treatment>> {
    const store = db();
    const injury = store.injuries.find((i) => i.id === input.injuryId);
    if (!injury) return failure("Không tìm thấy chấn thương.");
    const fighter = findFighter(injury.fighterId);
    if (!fighter) return failure("Không tìm thấy võ sĩ.");
    if (input.endDate && input.endDate < input.startDate) return failure("Ngày kết thúc phải sau ngày bắt đầu.");

    const now = nowIso();
    const { status: requestedStatus, ...fields } = input;
    const status = requestedStatus ?? (input.startDate > now ? "planned" : input.endDate && input.endDate < now ? "completed" : "ongoing");
    const treatment: Treatment = { ...fields, id: newId("tr"), fighterId: injury.fighterId, status };
    store.treatments.push(treatment);

    recordAudit({
        actor,
        action: "treatment.create",
        resourceType: "treatment",
        resourceId: treatment.id,
        resourceLabel: `Điều trị — ${fighter.name}`,
        details: `Trạng thái: ${TREATMENT_STATUS_LABELS[status]}`,
    });
    notifyUsers({
        userIds: fighterUserIds(fighter.id),
        category: "medical",
        title: "Đã thêm điều trị",
        body: `Đã thêm ${treatmentTitle(treatment)} vào kế hoạch điều trị của bạn (${treatment.frequency}).`,
        href: routes.fighter.injury(injury.id),
    });
    return success(treatment);
}

/** Changes a treatment's status; completing it fills in a missing end date. */
export async function updateTreatmentStatus(id: string, status: TreatmentStatus, actor: User): Promise<MedicalResult<Treatment>> {
    const treatment = db().treatments.find((t) => t.id === id);
    if (!treatment) return failure("Không tìm thấy điều trị.");
    if (treatment.status === status) return success(treatment);

    const previous = treatment.status;
    treatment.status = status;
    if (status === "completed" && treatment.endDate === null) treatment.endDate = nowIso();

    recordAudit({
        actor,
        action: "treatment.status_change",
        resourceType: "treatment",
        resourceId: treatment.id,
        resourceLabel: `Điều trị — ${findFighter(treatment.fighterId)?.name ?? treatment.fighterId}`,
        details: `Trạng thái: ${previous ? TREATMENT_STATUS_LABELS[previous] : "chưa đặt"} → ${TREATMENT_STATUS_LABELS[status]}`,
    });
    return success(treatment);
}

/* ─── Recovery plans ──────────────────────────────────────────────────────── */

export interface RecoveryPlanFilter {
    fighterIds?: FighterScope;
    status?: RecoveryPlanStatus;
}

/** Recovery plans matching the filter, most recently started first. */
export async function listRecoveryPlans(filter: RecoveryPlanFilter = {}): Promise<RecoveryPlan[]> {
    await simulateLatency();
    return db()
        .recoveryPlans.filter((p) => inScope(filter.fighterIds, p.fighterId) && (!filter.status || p.status === filter.status))
        .sort(byDateDesc((p) => p.startDate));
}

/** A single recovery plan, or null. */
export async function getRecoveryPlan(id: string): Promise<RecoveryPlan | null> {
    await simulateLatency();
    return db().recoveryPlans.find((p) => p.id === id) ?? null;
}

export interface RecoveryPlanDetail {
    plan: RecoveryPlan;
    fighter: Fighter;
    injury: Injury | null;
    /** Treatments for the plan's injury, oldest first. */
    treatments: Treatment[];
    doctor: Doctor | null;
    progressPct: number;
}

/** A recovery plan with its fighter, injury, treatments, responsible doctor and progress. */
export async function getRecoveryPlanDetail(id: string): Promise<RecoveryPlanDetail | null> {
    await simulateLatency();
    const store = db();
    const plan = store.recoveryPlans.find((p) => p.id === id);
    const fighter = plan ? findFighter(plan.fighterId) : undefined;
    if (!plan || !fighter) return null;
    return {
        plan,
        fighter,
        injury: store.injuries.find((i) => i.id === plan.injuryId) ?? null,
        treatments: store.treatments.filter((t) => t.injuryId === plan.injuryId).sort((a, b) => a.startDate.localeCompare(b.startDate)),
        doctor: findDoctor(plan.doctorId),
        progressPct: recoveryProgressPct(plan),
    };
}

export interface RecoveryPhaseInput {
    name: string;
    goal: string;
    startDate: string;
    endDate: string;
    milestones: string[];
}

export interface CreateRecoveryPlanInput {
    injuryId: string;
    title: string;
    startDate: string;
    targetReturnDate: string;
    /** In order; the first phase starts as current. */
    phases: RecoveryPhaseInput[];
}

/** Creates an active recovery plan for an open injury that has no active or paused plan. */
export async function createRecoveryPlan(input: CreateRecoveryPlanInput, actor: User): Promise<MedicalResult<RecoveryPlan>> {
    const store = db();
    const injury = store.injuries.find((i) => i.id === input.injuryId);
    if (!injury) return failure("Không tìm thấy chấn thương.");
    const fighter = findFighter(injury.fighterId);
    if (!fighter) return failure("Không tìm thấy võ sĩ.");
    if (injury.status === "resolved") return failure("Chấn thương đã khỏi. Hãy mở lại trước khi tạo kế hoạch phục hồi.");
    if (input.phases.length === 0) return failure("Hãy thêm ít nhất một giai đoạn phục hồi.");
    if (input.targetReturnDate < input.startDate) return failure("Ngày mục tiêu trở lại phải sau ngày bắt đầu.");
    if (store.recoveryPlans.some((p) => p.injuryId === injury.id && p.status !== "completed")) {
        return failure("Chấn thương này đã có kế hoạch phục hồi đang thực hiện.");
    }
    const doctorId = actingDoctorId(actor);
    if (!doctorId) return failure(NOT_A_DOCTOR);

    const plan: RecoveryPlan = {
        id: newId("rp"),
        injuryId: injury.id,
        fighterId: injury.fighterId,
        doctorId,
        title: input.title.trim(),
        startDate: input.startDate,
        targetReturnDate: input.targetReturnDate,
        status: "active",
        phases: input.phases.map<RecoveryPhase>((phase, index) => ({
            id: newId("rph"),
            name: phase.name.trim(),
            goal: phase.goal.trim(),
            startDate: phase.startDate,
            endDate: phase.endDate,
            status: index === 0 ? "current" : "upcoming",
            milestones: phase.milestones.map((label) => ({ label: label.trim(), done: false })),
        })),
        checkIns: [],
    };
    store.recoveryPlans.push(plan);

    recordAudit({
        actor,
        action: "recovery_plan.create",
        resourceType: "recovery_plan",
        resourceId: plan.id,
        resourceLabel: `Kế hoạch phục hồi — ${fighter.name}`,
        details: `${plan.phases.length} giai đoạn`,
    });
    notifyUsers({
        userIds: fighterUserIds(fighter.id),
        category: "medical",
        title: "Kế hoạch phục hồi đã sẵn sàng",
        body: `Kế hoạch phục hồi "${plan.title}" của bạn đã bắt đầu.${plan.targetReturnDate ? ` Mục tiêu trở lại: ${formatDate(plan.targetReturnDate)}.` : ""}`,
        href: routes.fighter.injury(injury.id),
    });
    notifyUsers({
        userIds: coachUserIds(fighter.id),
        category: "medical",
        title: `Đã bắt đầu kế hoạch phục hồi cho ${fighter.name}`,
        body: `Đã bắt đầu kế hoạch trở lại tập cho ${fighter.name}. Hãy kiểm tra giấy phép để biết hạn chế tập hiện tại.`,
        href: routes.coach.clearance,
    });
    return success(plan);
}

export type RecoveryCheckInInput = Omit<RecoveryCheckIn, "date"> & {
    /** Defaults to now. */
    date?: string;
};

/** Pain increase between check-ins that is flagged to the responsible doctor. */
const PAIN_INCREASE_FLAG = 2;

/** Adds a check-in (kept in date order) and informs the responsible doctor when someone else logged it. */
export async function addRecoveryCheckIn(planId: string, checkIn: RecoveryCheckInInput, actor: User): Promise<MedicalResult<RecoveryPlan>> {
    const plan = db().recoveryPlans.find((p) => p.id === planId);
    if (!plan) return failure("Không tìm thấy kế hoạch phục hồi.");
    if (plan.status === "completed") return failure("Kế hoạch phục hồi này đã hoàn tất.");
    const inRange = (value: number, max: number) => Number.isFinite(value) && value >= 0 && value <= max;
    if (!Number.isInteger(checkIn.painLevel) || !inRange(checkIn.painLevel, 10)) return failure("Mức đau phải là số nguyên từ 0 đến 10.");
    if (!inRange(checkIn.mobilityPct, 100) || !inRange(checkIn.strengthPct, 100)) return failure("Vận động và sức mạnh phải từ 0 đến 100%.");

    const fighter = findFighter(plan.fighterId);
    const previousPain = plan.checkIns.at(-1)?.painLevel ?? null;
    const entry: RecoveryCheckIn = {
        date: checkIn.date ?? nowIso(),
        painLevel: checkIn.painLevel,
        mobilityPct: checkIn.mobilityPct,
        strengthPct: checkIn.strengthPct,
        note: checkIn.note.trim(),
    };
    plan.checkIns.push(entry);
    plan.checkIns.sort((a, b) => a.date.localeCompare(b.date));

    recordAudit({
        actor,
        action: "recovery_plan.check_in",
        resourceType: "recovery_plan",
        resourceId: plan.id,
        resourceLabel: `Kế hoạch phục hồi — ${fighter?.name ?? plan.fighterId}`,
    });

    const doctor = findDoctor(plan.doctorId);
    if (doctor?.userId && doctor.userId !== actor.id) {
        const painRose = previousPain !== null && entry.painLevel - previousPain >= PAIN_INCREASE_FLAG;
        const name = fighter?.name ?? "Một võ sĩ";
        notifyUsers({
            userIds: [doctor.userId],
            category: "medical",
            severity: painRose ? "warning" : "info",
            title: painRose ? `Mức đau tăng ở lần kiểm tra của ${name}` : `Kiểm tra phục hồi mới từ ${name}`,
            body: painRose
                ? `Mức đau tăng từ ${previousPain}/10 lên ${entry.painLevel}/10. Hãy xem lại kế hoạch phục hồi.`
                : `Đau ${entry.painLevel}/10, vận động ${entry.mobilityPct}%, sức mạnh ${entry.strengthPct}%.`,
            href: routes.doctor.recoveryPlan(plan.id),
        });
    }
    return success(plan);
}

/** Marks one milestone in a phase as done or not done. */
export async function setMilestone(
    planId: string,
    phaseId: string,
    milestoneIndex: number,
    done: boolean,
    actor: User,
): Promise<MedicalResult<RecoveryPlan>> {
    const plan = db().recoveryPlans.find((p) => p.id === planId);
    if (!plan) return failure("Không tìm thấy kế hoạch phục hồi.");
    const phaseNumber = plan.phases.findIndex((p) => p.id === phaseId);
    if (phaseNumber === -1) return failure("Không tìm thấy giai đoạn phục hồi.");
    const phase = plan.phases[phaseNumber];
    if (!Number.isInteger(milestoneIndex) || milestoneIndex < 0 || milestoneIndex >= phase.milestones.length) {
        return failure("Không tìm thấy mốc.");
    }
    const milestone = phase.milestones[milestoneIndex];
    if (milestone.done === done) return success(plan);
    milestone.done = done;

    recordAudit({
        actor,
        action: "recovery_plan.milestone_update",
        resourceType: "recovery_plan",
        resourceId: plan.id,
        resourceLabel: `Kế hoạch phục hồi — ${findFighter(plan.fighterId)?.name ?? plan.fighterId}`,
        details: `Giai đoạn ${phaseNumber + 1}, mốc ${milestoneIndex + 1}: ${done ? "đã đạt" : "chưa đạt"}`,
    });
    return success(plan);
}

/**
 * Completes the current phase and starts the next one. Completing the final phase completes
 * the plan; the injury and Medical Clearance are left for the doctor to update.
 */
export async function advanceRecoveryPhase(planId: string, actor: User): Promise<MedicalResult<RecoveryPlan>> {
    const plan = db().recoveryPlans.find((p) => p.id === planId);
    if (!plan) return failure("Không tìm thấy kế hoạch phục hồi.");
    if (plan.status !== "active") return failure("Chỉ kế hoạch đang thực hiện mới chuyển được giai đoạn.");

    const currentIndex = plan.phases.findIndex((p) => p.status === "current");
    const nextIndex = plan.phases.findIndex((p, index) => index > currentIndex && p.status === "upcoming");
    if (currentIndex === -1 && nextIndex === -1) return failure("Không còn giai đoạn nào để chuyển.");

    if (currentIndex !== -1) plan.phases[currentIndex].status = "completed";
    const nextPhase = nextIndex === -1 ? null : plan.phases[nextIndex];
    if (nextPhase) nextPhase.status = "current";
    else plan.status = "completed";

    const fighter = findFighter(plan.fighterId);
    recordAudit({
        actor,
        action: nextPhase ? "recovery_plan.phase_advance" : "recovery_plan.complete",
        resourceType: "recovery_plan",
        resourceId: plan.id,
        resourceLabel: `Kế hoạch phục hồi — ${fighter?.name ?? plan.fighterId}`,
        details: nextPhase ? `Đang ở giai đoạn ${nextIndex + 1}/${plan.phases.length}` : "Đã hoàn tất mọi giai đoạn",
    });
    notifyUsers({
        userIds: fighterUserIds(plan.fighterId),
        category: "medical",
        severity: "success",
        title: nextPhase ? `Giai đoạn phục hồi tiếp theo: ${nextPhase.name}` : "Đã hoàn tất kế hoạch phục hồi",
        body: nextPhase
            ? `Bạn đã chuyển sang "${nextPhase.name}". ${nextPhase.goal}`
            : "Bạn đã hoàn tất mọi giai đoạn của kế hoạch phục hồi. Bác sĩ thể thao sẽ xác nhận giấy phép trước khi bạn tập lại đầy đủ.",
        href: routes.fighter.injury(plan.injuryId),
    });
    return success(plan);
}

/* ─── Medical Clearance ───────────────────────────────────────────────────── */

export interface ClearanceFilter {
    fighterIds?: FighterScope;
    level?: ClearanceLevel;
    status?: ClearanceStatus;
}

/** Clearances matching the filter, most recently issued first. */
export async function listClearances(filter: ClearanceFilter = {}): Promise<MedicalClearance[]> {
    await simulateLatency();
    return db()
        .medicalClearances.filter(
            (c) => inScope(filter.fighterIds, c.fighterId) && (!filter.level || c.level === filter.level) && (!filter.status || c.status === filter.status),
        )
        .sort(byDateDesc((c) => c.issuedAt));
}

/** The clearance currently governing the fighter's training (may be expired), or null. Not delayed. */
export function getCurrentClearanceFor(fighterId: string): MedicalClearance | null {
    return currentClearance(db().medicalClearances, fighterId);
}

/**
 * The fighter's training clearance state with the reasons the medical service would give. Every fighter needs a
 * baseline examination before training, and an open review request pauses training until the doctor examines the
 * fighter, whatever the clearance says.
 */
export function getClearanceStatusFor(
    fighterId: string,
    now: string | Date = new Date(),
): { state: ClearanceState; clearance: MedicalClearance | null; eligibility: MedicalEligibility } {
    const store = db();
    const clearance = getCurrentClearanceFor(fighterId);
    const base = clearanceState(clearance, now);
    const pending = store.medicalReviewRequests.some((request) => request.fighterId === fighterId && request.status === "OPEN");
    const baselineOnFile = store.medicalExaminations.some((exam) => exam.fighterId === fighterId && exam.type === "baseline");
    const reasons: EligibilityReason[] = [];
    if (!baselineOnFile) reasons.push("EXAMINATION_REQUIRED");
    if (pending) reasons.push("REVIEW_REQUEST_PENDING");
    if (base === "not_cleared") reasons.push(clearance?.status === "revoked" ? "CLEARANCE_REQUIRED" : "EXAMINATION_NOT_ELIGIBLE");
    if (base === "expired") reasons.push("CLEARANCE_EXPIRED");
    // As in the service, a missing baseline blocks training once anything else is on file; with nothing yet it reads as none.
    return {
        state: pending || (!baselineOnFile && base !== "none") ? "not_cleared" : base,
        clearance,
        eligibility: { scope: "TRAINING", eligible: reasons.length === 0, reasons },
    };
}

/* ─── Medical review requests ─────────────────────────────────────────────── */

/** The fighter's review requests, newest first. */
export async function listReviewRequests(fighterId: string): Promise<MedicalReviewRequest[]> {
    await simulateLatency();
    return db()
        .medicalReviewRequests.filter((request) => request.fighterId === fighterId)
        .sort(byDateDesc((request) => request.requestedAt));
}

/** Asks the fighter's doctors for a review. Training pauses until an examination answers it. */
export async function createReviewRequest(fighterId: string, reason: string, actor: User): Promise<MedicalResult<MedicalReviewRequest>> {
    const store = db();
    const fighter = findFighter(fighterId);
    if (!fighter) return failure("Không tìm thấy võ sĩ.");

    const request: MedicalReviewRequest = {
        id: newId("mrr"),
        fighterId,
        requestedById: actor.id,
        requesterRole: actor.role === "fighter" ? "FIGHTER" : actor.role === "coach" ? "COACH" : actor.role === "doctor" ? "DOCTOR" : "ADMIN",
        reason: reason.trim(),
        status: "OPEN",
        requestedAt: nowIso(),
        resolvedByExaminationId: null,
        resolvedAt: null,
    };
    store.medicalReviewRequests.push(request);

    recordAudit({ actor, action: "medical_review.request", resourceType: "fighter", resourceId: fighter.id, resourceLabel: `Xem xét y tế — ${fighter.name}` });
    notifyUsers({
        userIds: staffUserIdsForFighter(fighter.id, ["doctor"]).filter((userId) => userId !== actor.id),
        category: "medical",
        title: `Yêu cầu xem xét y tế cho ${fighter.name}`,
        body: `${actor.name} yêu cầu xem xét: “${request.reason}”. Việc tập tạm dừng cho đến khi bạn ghi phiếu khám.`,
        href: routes.doctor.fighter(fighter.id),
    });
    return success(request);
}

/** Every clearance issued to the fighter, most recent first. */
export async function getClearanceHistory(fighterId: string): Promise<MedicalClearance[]> {
    await simulateLatency();
    return db()
        .medicalClearances.filter((c) => c.fighterId === fighterId)
        .sort(byDateDesc((c) => c.issuedAt));
}

export interface GrantClearanceInput {
    fighterId: string;
    level: ClearanceLevel;
    validUntil: string | null;
    reason: string;
    /** Required (at least one) for "restricted"; ignored for other levels. */
    restrictions: Omit<TrainingRestriction, "id">[];
    examinationId: string | null;
}

const CLEARANCE_SUMMARY_FOR_FIGHTER: Record<ClearanceLevel, string> = {
    full: "Bạn được tập đầy đủ.",
    restricted: "Bạn được tập có hạn chế.",
    not_cleared: "Bạn chưa được tập cho đến khi bác sĩ thể thao khám lại. Trong thời gian này hãy theo kế hoạch phục hồi.",
};

/**
 * Issues a Medical Clearance: supersedes the fighter's active clearance, sets their health
 * status from the level, and notifies the fighter, their coaches and other assigned doctors.
 */
export async function grantClearance(input: GrantClearanceInput, actor: User): Promise<MedicalResult<MedicalClearance>> {
    const store = db();
    const fighter = findFighter(input.fighterId);
    if (!fighter) return failure("Không tìm thấy võ sĩ.");
    const doctorId = actingDoctorId(actor);
    if (!doctorId) return failure(NOT_A_DOCTOR);
    if (!input.reason.trim()) return failure("Hãy ghi lý do cho quyết định cấp phép.");
    if (input.level === "restricted" && input.restrictions.length === 0) return failure("Hãy thêm ít nhất một hạn chế cho giấy phép có hạn chế.");
    if (input.validUntil && daysBetween(new Date(), input.validUntil) < 0) return failure("Ngày hiệu lực không thể ở quá khứ.");
    if (input.examinationId) {
        const examination = store.medicalExaminations.find((e) => e.id === input.examinationId);
        if (examination?.fighterId !== fighter.id) return failure("Phiếu khám liên kết không thuộc võ sĩ này.");
    }

    const superseded = store.medicalClearances.filter((c) => c.fighterId === fighter.id && c.status === "active");
    for (const previous of superseded) previous.status = "superseded";

    const clearance: MedicalClearance = {
        id: newId("cl"),
        fighterId: fighter.id,
        doctorId,
        level: input.level,
        status: "active",
        issuedAt: nowIso(),
        validUntil: input.validUntil,
        reason: input.reason.trim(),
        restrictions: input.level === "restricted" ? input.restrictions.map((r) => ({ ...r, id: newId("rst") })) : [],
        examinationId: input.examinationId,
        revokedAt: null,
        revokedReason: null,
    };
    store.medicalClearances.push(clearance);

    fighter.healthStatus = healthStatusForClearance(
        clearance.level,
        store.injuries.some((i) => i.fighterId === fighter.id && isOpenInjury(i)),
    );

    // Audit text stays neutral (no level, restrictions or health status): the audit trail is read outside the clinical team.
    recordAudit({
        actor,
        action: "clearance.grant",
        resourceType: "clearance",
        resourceId: clearance.id,
        resourceLabel: `Giấy phép — ${fighter.name}`,
        details: superseded.length > 0 ? `Thay thế ${superseded.map((c) => c.id).join(", ")}` : null,
    });

    const levelLabel = CLEARANCE_LEVEL_LABELS[clearance.level];

    const validity = clearance.validUntil ? ` Hiệu lực đến ${formatDate(clearance.validUntil)}.` : "";
    const restrictionList = clearance.restrictions.length > 0 ? ` Hạn chế: ${clearance.restrictions.map((r) => r.label).join("; ")}.` : "";
    const severity = clearance.level === "full" ? "success" : "warning";
    const coachBody: Record<ClearanceLevel, string> = {
        full: `${fighter.name} được tập đầy đủ.${validity}`,
        restricted: `${fighter.name} được tập có hạn chế.${restrictionList}${validity} Hãy kiểm tra các buổi đã lên lịch có xung đột không.`,
        not_cleared: `${fighter.name} chưa được tập. Hãy tạm dừng các buổi đã lên lịch cho đến khi bác sĩ thể thao cấp phép.`,
    };

    notifyUsers({
        userIds: fighterUserIds(fighter.id),
        category: "clearance",
        severity,
        title: `Giấy phép được cập nhật: ${levelLabel}`,
        body: `${CLEARANCE_SUMMARY_FOR_FIGHTER[clearance.level]}${clearance.level === "restricted" ? restrictionList : ""}${clearance.level === "not_cleared" ? "" : validity}`,
        href: routes.fighter.health,
    });
    notifyUsers({
        userIds: coachUserIds(fighter.id),
        category: "clearance",
        severity,
        title: `${fighter.name}: ${levelLabel}`,
        body: coachBody[clearance.level],
        href: routes.coach.clearance,
    });
    notifyUsers({
        userIds: otherDoctorUserIds(fighter.id, actor),
        category: "clearance",
        title: `Đã cập nhật giấy phép cho ${fighter.name}`,
        body: `${findDoctor(clearance.doctorId)?.name ?? actor.name} đặt ${fighter.name}: ${levelLabel}.${validity}`,
        href: routes.doctor.clearance,
    });
    return success(clearance);
}

/** Revokes an active clearance, marks the fighter Not Cleared and notifies everyone involved. */
export async function revokeClearance(clearanceId: string, reason: string, actor: User): Promise<MedicalResult<MedicalClearance>> {
    const clearance = db().medicalClearances.find((c) => c.id === clearanceId);
    if (!clearance) return failure("Không tìm thấy giấy phép.");
    if (clearance.status !== "active") return failure("Chỉ thu hồi được giấy phép đang hiệu lực.");
    if (!reason.trim()) return failure("Hãy ghi lý do thu hồi giấy phép.");
    const fighter = findFighter(clearance.fighterId);
    if (!fighter) return failure("Không tìm thấy võ sĩ.");

    clearance.status = "revoked";
    clearance.revokedAt = nowIso();
    clearance.revokedReason = reason.trim();
    fighter.healthStatus = "not_cleared";

    recordAudit({
        actor,
        action: "clearance.revoke",
        resourceType: "clearance",
        resourceId: clearance.id,
        resourceLabel: `Giấy phép — ${fighter.name}`,
    });
    notifyUsers({
        userIds: fighterUserIds(fighter.id),
        category: "clearance",
        severity: "warning",
        title: "Đã thu hồi giấy phép",
        body: "Giấy phép của bạn đã bị thu hồi và bạn chưa được tập. Bác sĩ thể thao sẽ giải thích các bước tiếp theo.",
        href: routes.fighter.health,
    });
    notifyUsers({
        userIds: coachUserIds(fighter.id),
        category: "clearance",
        severity: "warning",
        title: `${fighter.name} chưa được tập`,
        body: `Giấy phép của ${fighter.name} đã bị thu hồi. Hãy tạm dừng các buổi đã lên lịch cho đến khi bác sĩ thể thao cấp phép lại.`,
        href: routes.coach.clearance,
    });
    notifyUsers({
        userIds: otherDoctorUserIds(fighter.id, actor),
        category: "clearance",
        severity: "warning",
        title: `Đã thu hồi giấy phép của ${fighter.name}`,
        body: `${actor.name}: ${clearance.revokedReason}`,
        href: routes.doctor.clearance,
    });
    return success(clearance);
}

/** Sets a fighter's health status directly (e.g. to "monitoring") and tells their coaches. */
export async function updateHealthStatus(fighterId: string, status: HealthStatus, actor: User): Promise<MedicalResult<Fighter>> {
    const fighter = findFighter(fighterId);
    if (!fighter) return failure("Không tìm thấy võ sĩ.");
    if (fighter.healthStatus === status) return success(fighter);

    fighter.healthStatus = status;

    recordAudit({
        actor,
        action: "fighter.health_status_update",
        resourceType: "fighter",
        resourceId: fighter.id,
        resourceLabel: `Tình trạng sức khỏe — ${fighter.name}`,
    });
    notifyUsers({
        userIds: coachUserIds(fighter.id),
        category: "medical",
        severity: status === "healthy" ? "success" : status === "monitoring" ? "info" : "warning",
        title: `${fighter.name}: ${HEALTH_STATUS_LABELS[status]}`,
        body: `Tình trạng sức khỏe của ${fighter.name} chuyển thành ${HEALTH_STATUS_LABELS[status]}. ${HEALTH_STATUS_DESCRIPTIONS[status]}`,
        href: routes.coach.clearance,
    });
    return success(fighter);
}

/* ─── Summaries ───────────────────────────────────────────────────────────── */

export interface RecoveryPlanProgress {
    plan: RecoveryPlan;
    progressPct: number;
    currentPhase: RecoveryPhase | null;
}

export interface FollowUp {
    fighter: Fighter;
    /** The examination that set the follow-up. */
    examination: MedicalExamination;
    date: string;
    /** Negative when overdue. */
    daysUntil: number;
}

/** Follow-ups set by each fighter's latest examination that have not been superseded by a newer one. */
function pendingFollowUps(fighters: Fighter[], now: string | Date): FollowUp[] {
    const store = db();
    const followUps: FollowUp[] = [];
    for (const fighter of fighters) {
        const latest = store.medicalExaminations.filter((e) => e.fighterId === fighter.id).sort(byDateDesc((e) => e.date))[0];
        if (latest?.followUpDate) {
            followUps.push({ fighter, examination: latest, date: latest.followUpDate, daysUntil: daysBetween(now, latest.followUpDate) });
        }
    }
    return followUps.sort((a, b) => a.date.localeCompare(b.date));
}

export interface FighterHealthSummary {
    fighter: Fighter;
    clearance: MedicalClearance | null;
    clearanceState: ClearanceState;
    /** Active and recovering injuries, most recent first. */
    activeInjuries: Injury[];
    activeRecoveryPlan: RecoveryPlanProgress | null;
    latestExamination: MedicalExamination | null;
    /** No baseline examination on file yet, so the fighter can't train. */
    needsBaseline: boolean;
    nextFollowUp: FollowUp | null;
    /** Medical review requests still waiting for an examination, oldest first. */
    openReviewRequests: MedicalReviewRequest[];
}

/** Everything needed for a fighter's health overview card. */
export async function getFighterHealthSummary(fighterId: string, now: string | Date = new Date()): Promise<FighterHealthSummary | null> {
    await simulateLatency();
    const store = db();
    const fighter = findFighter(fighterId);
    if (!fighter) return null;

    const clearance = currentClearance(store.medicalClearances, fighterId);
    const plan = store.recoveryPlans.filter((p) => p.fighterId === fighterId && p.status === "active").sort(byDateDesc((p) => p.startDate))[0];
    const status = getClearanceStatusFor(fighterId, now);

    return {
        fighter,
        clearance,
        clearanceState: status.state,
        needsBaseline: status.eligibility.reasons.includes("EXAMINATION_REQUIRED"),
        activeInjuries: store.injuries.filter((i) => i.fighterId === fighterId && isOpenInjury(i)).sort(byDateDesc((i) => i.occurredAt)),
        activeRecoveryPlan: plan
            ? { plan, progressPct: recoveryProgressPct(plan), currentPhase: plan.phases.find((p) => p.status === "current") ?? null }
            : null,
        latestExamination: store.medicalExaminations.filter((e) => e.fighterId === fighterId).sort(byDateDesc((e) => e.date))[0] ?? null,
        nextFollowUp: pendingFollowUps([fighter], now)[0] ?? null,
        openReviewRequests: store.medicalReviewRequests
            .filter((request) => request.fighterId === fighterId && request.status === "OPEN")
            .sort((a, b) => a.requestedAt.localeCompare(b.requestedAt)),
    };
}

export interface ExpiringClearance {
    fighter: Fighter;
    clearance: MedicalClearance;
    daysRemaining: number;
}

export interface DoctorOverview {
    healthCounts: Record<HealthStatus, number>;
    /** Active clearances lapsing within settings.clearanceExpiryWarningDays, soonest first. */
    expiringClearances: ExpiringClearance[];
    /** Fighters with no clearance on file or whose clearance has expired. */
    fightersWithoutClearance: { fighter: Fighter; state: Extract<ClearanceState, "none" | "expired"> }[];
    /** Follow-ups due in the next 7 days, including overdue ones. */
    followUpsDue: FollowUp[];
    /** Active and recovering injuries, most recent first. */
    activeInjuries: { injury: Injury; fighter: Fighter }[];
    /** AI movement observations awaiting review, newest first. */
    newAlerts: { alert: AbnormalMovementAlert; fighter: Fighter }[];
    /** The 5 most recent examinations. */
    recentExaminations: { examination: MedicalExamination; fighter: Fighter }[];
}

const RECENT_EXAMINATIONS_LIMIT = 5;

/** Dashboard aggregates for a doctor's assigned fighters. */
export async function getDoctorOverview(fighterIds: FighterScope, now: string | Date = new Date()): Promise<DoctorOverview> {
    await simulateLatency();
    const store = db();
    const fighters = store.fighters.filter((f) => inScope(fighterIds, f.id));
    const fighterById = new Map(fighters.map((f) => [f.id, f]));
    const withFighter = <T extends { fighterId: string }>(items: T[]) =>
        items.flatMap((item) => {
            const fighter = fighterById.get(item.fighterId);
            return fighter ? [{ item, fighter }] : [];
        });

    const healthCounts: Record<HealthStatus, number> = { healthy: 0, monitoring: 0, injured: 0, recovery: 0, not_cleared: 0 };
    const expiringClearances: ExpiringClearance[] = [];
    const fightersWithoutClearance: DoctorOverview["fightersWithoutClearance"] = [];

    for (const fighter of fighters) {
        healthCounts[fighter.healthStatus] += 1;
        const clearance = currentClearance(store.medicalClearances, fighter.id);
        const state = clearanceState(clearance, now);
        if (state === "none" || state === "expired") {
            fightersWithoutClearance.push({ fighter, state });
        } else if (clearance && clearanceExpiresSoon(clearance, store.settings.clearanceExpiryWarningDays, now)) {
            expiringClearances.push({ fighter, clearance, daysRemaining: clearanceDaysRemaining(clearance, now) ?? 0 });
        }
    }

    return {
        healthCounts,
        expiringClearances: expiringClearances.sort((a, b) => a.daysRemaining - b.daysRemaining),
        fightersWithoutClearance,
        followUpsDue: pendingFollowUps(fighters, now).filter((f) => f.daysUntil <= FOLLOW_UP_WINDOW_DAYS),
        activeInjuries: withFighter(store.injuries.filter(isOpenInjury).sort(byDateDesc((i) => i.occurredAt))).map(({ item, fighter }) => ({
            injury: item,
            fighter,
        })),
        newAlerts: withFighter(store.abnormalMovementAlerts.filter((a) => a.status === "new").sort(byDateDesc((a) => a.detectedAt))).map(
            ({ item, fighter }) => ({ alert: item, fighter }),
        ),
        recentExaminations: withFighter([...store.medicalExaminations].sort(byDateDesc((e) => e.date)))
            .slice(0, RECENT_EXAMINATIONS_LIMIT)
            .map(({ item, fighter }) => ({ examination: item, fighter })),
    };
}

export interface ClearanceOverviewRow {
    fighter: Fighter;
    clearance: MedicalClearance | null;
    state: ClearanceState;
    /** Null when there is no clearance or it is open-ended. Negative once expired. */
    daysRemaining: number | null;
    /** Restrictions in force — empty unless the state is "restricted". */
    restrictions: TrainingRestriction[];
}

const CLEARANCE_STATE_PRIORITY: Record<ClearanceState, number> = { not_cleared: 0, expired: 1, none: 2, restricted: 3, full: 4 };

/** One row per fighter for the clearance board, ordered by what needs attention first. */
export async function getClearanceOverview(fighterIds: FighterScope, now: string | Date = new Date()): Promise<ClearanceOverviewRow[]> {
    await simulateLatency();
    const store = db();
    return store.fighters
        .filter((f) => inScope(fighterIds, f.id))
        .map<ClearanceOverviewRow>((fighter) => {
            const clearance = currentClearance(store.medicalClearances, fighter.id);
            const state = clearanceState(clearance, now);
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
