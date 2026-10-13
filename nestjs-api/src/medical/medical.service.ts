import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type {
  ListFightersQuery,
  PublicFighter,
} from '../fighters/fighters.model.js';
import { forbidden } from '../shared/errors/access.error.js';
import type { AuthenticatedUser } from '../shared/models/auth-context.model.js';
import { USER } from '../shared/types/user.role.js';
import {
  setAuditContext,
  type DatabaseExecutor,
  type Transaction,
} from '../shared/utils/audit-context.util.js';
import { MedicalAccessService } from './medical-access.service.js';
import {
  CLEARANCE_TYPES_BY_SCOPE,
  INJURY_STATUS_TRANSITIONS,
  MEDICAL_ELIGIBILITY_REASON,
  MEDICAL_READ_VIEW,
  RECOVERY_PLAN_STATUS_TRANSITIONS,
  SCAT6,
  type MedicalEligibilityReason,
} from './medical.constants.js';
import {
  doctorAssignmentAlreadyClosed,
  doctorAssignmentNotFound,
  doctorNotFound,
  examinationCorrectionConflict,
  examinationNotEligibleForClearance,
  injuryNotFound,
  invalidInjuryStatusTransition,
  invalidRecoveryPlanStatusTransition,
  mapMedicalPersistenceError,
  medicalDataConstraintConflict,
  medicalClearanceNotActive,
  medicalClearanceNotFound,
  medicalReferenceNotFound,
  medicalExaminationNotFound,
  medicalRecordConflict,
  medicalReviewRequestNotFound,
  medicalSupervisionDisabled,
  recoveryPlanDateConflict,
  recoveryPlanNotFound,
  reviewRequestNotResolvable,
} from './medical.error.js';
import { AcademySettingsRepository } from '../academy-settings/academy-settings.repo.js';
import type {
  AssignDoctorInput,
  Clearance,
  CreateExaminationInput,
  CreateInjuryInput,
  CreateRecoveryPlanInput,
  CreateReviewRequestInput,
  CreateTreatmentInput,
  DoctorAssignment,
  EndDoctorAssignmentInput,
  Examination,
  ExaminationScope,
  Injury,
  IssueClearanceInput,
  ListDoctorAssignmentsQuery,
  ListExaminationsQuery,
  ListMedicalHistoryQuery,
  ListReviewRequestsQuery,
  MedicalDossier,
  MedicalEligibility,
  MedicalHistoryEntry,
  Paginated,
  CreateRecoveryMilestoneInput,
  RecoveryMilestone,
  RecoveryPlan,
  UpdateRecoveryMilestoneInput,
  RevokeClearanceInput,
  ReviewRequest,
  SessionTypeValue,
  Treatment,
  UpdateInjuryInput,
  UpdateRecoveryPlanInput,
} from './medical.model.js';
import { standardRecoveryMilestonesSchema } from './medical.model.js';
import {
  isClearanceCurrentlyValid,
  MedicalRepository,
  toExamination,
  type ClearanceEligibilityRow,
  type ExaminationDetailsInsert,
} from './medical.repo.js';
import type { Scat6Input } from './scat6.model.js';
import { scoreScat6 } from './scat6.scoring.js';

interface EligibilityState {
  scope: ExaminationScope;
  supervision: 'DOCTOR' | 'NONE';
  openReviewRequests: number;
  /** TRAINING only: a BASELINE examination (or the 016 legacy exemption) is on file. */
  baselineOnFile: boolean;
  currentExamination:
    | { decision: Examination['decision'] }
    | undefined;
  clearances: readonly ClearanceEligibilityRow[];
  now: Date;
  sessionType?: SessionTypeValue;
}

function isRestricted(clearance: ClearanceEligibilityRow): boolean {
  return (
    clearance.allowedSessionTypes !== null ||
    clearance.allowedTechniqueTypes !== null ||
    clearance.excludedJoints !== null
  );
}

/**
 * Medical eligibility for one scope (D6, D8, D9 as amended 2026-10-04).
 *
 * Every Fighter has a BASELINE examination before training, whatever created
 * the account (Admin or admission): without one TRAINING is not eligible
 * (EXAMINATION_REQUIRED). Fighters with a real TRAINING examination recorded
 * before migration 016 are exempt once (`medical_baseline_exemptions`); their
 * records keep counting without SCAT6 details. An OPEN review request also
 * blocks. Having the baseline is necessary, not sufficient: the current
 * examination and clearance rules below still apply. A current NOT_ELIGIBLE
 * decision blocks.
 * A current positive decision needs a clearance issued from that examination.
 * The governing clearance is the newest by server issuance order, chosen
 * BEFORE its status is considered: if it is revoked or not yet valid, no older
 * (possibly wider) clearance stands in for it, and clearances are never merged
 * into a broader permission. For COMPETITION, a restricted decision or a
 * restricted governing clearance, it must be valid now; only an expired
 * unrestricted training clearance creates no periodic re-examination duty.
 * Clearances from older examinations never count.
 *
 * `state.clearances` must be ordered newest issuance first.
 */
export function evaluateEligibility(state: EligibilityState): MedicalEligibility {
  const { scope, supervision, currentExamination: exam, now } = state;

  const isNoDoctorTraining = supervision === 'NONE' && scope === 'TRAINING';

  if (isNoDoctorTraining && !exam) {
    return {
      scope,
      eligible: true,
      reasons: [],
      supervision,
    };
  }

  const reasons: MedicalEligibilityReason[] = [];

  if (scope === 'TRAINING' && !isNoDoctorTraining && !state.baselineOnFile) {
    reasons.push(MEDICAL_ELIGIBILITY_REASON.EXAMINATION_REQUIRED);
  }
  if (scope === 'TRAINING' && !isNoDoctorTraining && state.openReviewRequests > 0) {
    reasons.push(MEDICAL_ELIGIBILITY_REASON.REVIEW_REQUEST_PENDING);
  }

  if (!exam) {
    // A baseline of another scope (COMPETITION) does not stand in for the
    // TRAINING examination: still EXAMINATION_REQUIRED, never twice.
    const missing =
      scope === 'TRAINING'
        ? MEDICAL_ELIGIBILITY_REASON.EXAMINATION_REQUIRED
        : MEDICAL_ELIGIBILITY_REASON.CLEARANCE_REQUIRED;
    if (!reasons.includes(missing)) reasons.push(missing);
    return { scope, eligible: false, reasons, supervision };
  }

  if (exam.decision === 'NOT_ELIGIBLE') {
    reasons.push(MEDICAL_ELIGIBILITY_REASON.EXAMINATION_NOT_ELIGIBLE);
    return { scope, eligible: false, reasons, supervision };
  }

  const governing = state.clearances.at(0);
  const current =
    governing && isClearanceCurrentlyValid(governing, now)
      ? governing
      : undefined;

  if (
    !governing ||
    governing.status === 'REVOKED' ||
    governing.validFrom.getTime() > now.getTime()
  ) {
    // Never issued, revoked without a replacement, or not yet in force.
    reasons.push(MEDICAL_ELIGIBILITY_REASON.CLEARANCE_REQUIRED);
  } else if (!current) {
    // ACTIVE/EXPIRED, already in force, not currently valid: it has expired
    // (status EXPIRED or validUntil passed). A restricted one keeps its
    // restrictions until a Doctor replaces it: the Fighter is blocked rather
    // than silently unrestricted, even under an unrestricted examination.
    const needsCurrentClearance =
      scope === 'COMPETITION' ||
      exam.decision === 'ELIGIBLE_WITH_RESTRICTIONS' ||
      isRestricted(governing);
    if (needsCurrentClearance) {
      reasons.push(MEDICAL_ELIGIBILITY_REASON.CLEARANCE_EXPIRED);
    }
  }

  if (
    current &&
    state.sessionType &&
    current.allowedSessionTypes &&
    !current.allowedSessionTypes.includes(state.sessionType)
  ) {
    reasons.push(MEDICAL_ELIGIBILITY_REASON.SESSION_TYPE_RESTRICTED);
  }

  return { scope, eligible: reasons.length === 0, reasons, supervision };
}

function isSubset<T>(values: readonly T[], allowed: readonly T[]): boolean {
  return values.every((value) => allowed.includes(value));
}

function paginate<T>(
  result: { data: T[]; total: number },
  query: { page: number; limit: number },
): Paginated<T> {
  return { ...result, hasNextPage: query.page * query.limit < result.total };
}

function newMilestone(
  input: CreateRecoveryMilestoneInput,
  now: string,
): RecoveryMilestone {
  const isCompleted = input.isCompleted ?? false;
  return {
    id: randomUUID(),
    title: input.title,
    criteria: input.criteria,
    targetDate: input.targetDate ?? null,
    isCompleted,
    completedAt: isCompleted ? now : null,
    notes: input.notes ?? null,
  };
}

/**
 * Builds the full replacement milestone list for a plan. Elements with an `id`
 * update the plan's existing standard milestone of that id (content and
 * position change, the id never does); elements without one are new. Existing
 * ids are recognized only when the stored array is entirely standard: a legacy
 * array has no ids to update. Completion time is server-owned:
 * false → true stamps `now`, true → true keeps the recorded time, true → false
 * clears it (the previous revision keeps the evidence). Omitted optional
 * fields keep an existing milestone's value.
 *
 * Returns undefined when an id does not belong to this plan.
 */
function replaceMilestones(
  inputs: readonly UpdateRecoveryMilestoneInput[],
  stored: unknown,
  now: string,
): RecoveryMilestone[] | undefined {
  const parsed = standardRecoveryMilestonesSchema.safeParse(stored);
  const existingById = new Map(
    (parsed.success ? parsed.data : []).map((m) => [m.id, m] as const),
  );

  const result: RecoveryMilestone[] = [];
  for (const input of inputs) {
    if (input.id === undefined) {
      result.push(newMilestone(input, now));
      continue;
    }
    const existing = existingById.get(input.id);
    if (!existing) return undefined;
    const isCompleted = input.isCompleted ?? existing.isCompleted;
    result.push({
      id: existing.id,
      title: input.title,
      criteria: input.criteria,
      targetDate:
        input.targetDate !== undefined ? input.targetDate : existing.targetDate,
      isCompleted,
      completedAt: !isCompleted
        ? null
        : existing.isCompleted
          ? existing.completedAt
          : now,
      notes: input.notes !== undefined ? input.notes : existing.notes,
    });
  }
  return result;
}

/** Whole years between a date of birth (YYYY-MM-DD) and an instant, in UTC. */
function ageInYears(dateOfBirth: string, at: Date): number {
  const [year, month, day] = dateOfBirth.split('-').map(Number);
  let age = at.getUTCFullYear() - year;
  const beforeBirthday =
    at.getUTCMonth() + 1 < month ||
    (at.getUTCMonth() + 1 === month && at.getUTCDate() < day);
  if (beforeBirthday) age -= 1;
  return age;
}

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

@Injectable()
export class MedicalService {
  constructor(
    private readonly repo: MedicalRepository,
    private readonly access: MedicalAccessService,
    private readonly academySettingsRepo: AcademySettingsRepository,
  ) {}

  private async write<T>(
    actor: AuthenticatedUser,
    requestId: string,
    work: (transaction: Transaction) => Promise<T>,
  ): Promise<T> {
    try {
      return await this.repo.transaction(async (transaction) => {
        await setAuditContext(actor.authSubject, requestId, transaction);
        return work(transaction);
      });
    } catch (error) {
      throw mapMedicalPersistenceError(error);
    }
  }

  // --- Doctor assignments ---

  /**
   * D5: assignment is an ADMIN duty. A permission override alone must not let
   * another role (e.g. a DOCTOR) assign itself and gain clinical scope.
   */
  async assignDoctor(
    actor: AuthenticatedUser,
    fighterId: string,
    input: AssignDoctorInput,
    requestId: string,
  ): Promise<DoctorAssignment> {
    if (actor.role !== USER.ADMIN) throw forbidden();
    await this.access.requireFighter(fighterId);
    if (!(await this.repo.isAssignableDoctor(input.doctorId))) {
      throw doctorNotFound();
    }
    return this.write(actor, requestId, (tx) =>
      this.repo.insertDoctorAssignment(input.doctorId, fighterId, actor.id, tx),
    );
  }

  /** ADMIN may end any episode; a DOCTOR only an episode of their own profile. */
  async endDoctorAssignment(
    actor: AuthenticatedUser,
    fighterId: string,
    assignmentId: string,
    input: EndDoctorAssignmentInput,
    requestId: string,
  ): Promise<DoctorAssignment> {
    await this.access.requireFighter(fighterId);
    const assignment = await this.repo.findDoctorAssignment(
      fighterId,
      assignmentId,
    );
    if (!assignment) throw doctorAssignmentNotFound();

    if (actor.role === USER.DOCTOR) {
      const ownDoctorId = await this.repo.findActiveDoctorIdByUserId(actor.id);
      if (!ownDoctorId || ownDoctorId !== assignment.doctorId) {
        throw forbidden();
      }
    } else if (actor.role !== USER.ADMIN) {
      throw forbidden();
    }
    if (assignment.endsAt !== null) throw doctorAssignmentAlreadyClosed();

    return this.write(actor, requestId, async (tx) => {
      const closed = await this.repo.closeDoctorAssignment(
        assignmentId,
        actor.id,
        input.endReason,
        tx,
      );
      if (!closed) throw doctorAssignmentAlreadyClosed();
      return closed;
    });
  }

  async listDoctorAssignments(
    actor: AuthenticatedUser,
    fighterId: string,
    query: ListDoctorAssignmentsQuery,
  ): Promise<Paginated<DoctorAssignment>> {
    await this.access.assertReadScope(actor, fighterId);
    return paginate(
      await this.repo.listDoctorAssignments(fighterId, query),
      query,
    );
  }

  /** ADMIN may list any active Doctor; a DOCTOR only their own profile. */
  async listDoctorRoster(
    actor: AuthenticatedUser,
    doctorId: string,
    query: ListFightersQuery,
  ): Promise<Paginated<PublicFighter>> {
    if (actor.role === USER.DOCTOR) {
      const ownDoctorId = await this.repo.findActiveDoctorIdByUserId(actor.id);
      if (!ownDoctorId || ownDoctorId !== doctorId) throw forbidden();
    } else if (actor.role === USER.ADMIN) {
      if (!(await this.repo.isAssignableDoctor(doctorId))) {
        throw doctorNotFound();
      }
    } else {
      throw forbidden();
    }
    return paginate(
      await this.repo.findFightersForDoctor(doctorId, query),
      query,
    );
  }

  /** Doctor-scoped Fighter list used by the Fighters module. */
  async listFightersForDoctorUser(
    userId: string,
    query: ListFightersQuery,
  ): Promise<Paginated<PublicFighter>> {
    const doctorId = await this.repo.findActiveDoctorIdByUserId(userId);
    if (!doctorId) throw forbidden();
    return paginate(
      await this.repo.findFightersForDoctor(doctorId, query),
      query,
    );
  }

  // --- Clinical reads ---

  async getDossier(
    actor: AuthenticatedUser,
    fighterId: string,
    requestId: string,
  ): Promise<MedicalDossier> {
    await this.access.authorizeClinicalRead(
      actor,
      fighterId,
      MEDICAL_READ_VIEW.DOSSIER,
      requestId,
    );
    const now = new Date();
    const [
      activeInjuries,
      activeRecoveryPlans,
      activeClearances,
      openReviewRequests,
      trainingExam,
      competitionExam,
      baselineOnFile,
      supervision,
    ] = await Promise.all([
      this.repo.listActiveInjuries(fighterId),
      this.repo.listActiveRecoveryPlans(fighterId),
      this.repo.listActiveClearances(fighterId),
      this.repo.listOpenReviewRequests(fighterId),
      this.repo.findCurrentExamination(fighterId, 'TRAINING'),
      this.repo.findCurrentExamination(fighterId, 'COMPETITION'),
      this.repo.hasBaselineOnFile(fighterId),
      this.academySettingsRepo.getMedicalSupervision(),
    ]);
    const [training, competition, details] = await Promise.all([
      this.eligibilityFrom(
        'TRAINING',
        trainingExam,
        openReviewRequests.length,
        baselineOnFile,
        now,
        undefined,
        undefined,
        supervision,
      ),
      this.eligibilityFrom(
        'COMPETITION',
        competitionExam,
        0,
        true,
        now,
        undefined,
        undefined,
        supervision,
      ),
      this.repo.findExaminationDetails(
        [trainingExam?.id, competitionExam?.id].filter(
          (id): id is string => id !== undefined,
        ),
      ),
    ]);
    const withDetails = (exam: typeof trainingExam) =>
      exam ? toExamination(exam, details.get(exam.id) ?? null) : null;

    return {
      fighterId,
      activeInjuries,
      activeRecoveryPlans,
      currentExaminations: {
        training: withDetails(trainingExam),
        competition: withDetails(competitionExam),
      },
      activeClearances,
      openReviewRequests,
      eligibility: { training, competition },
    };
  }

  async listHistory(
    actor: AuthenticatedUser,
    fighterId: string,
    query: ListMedicalHistoryQuery,
    requestId: string,
  ): Promise<Paginated<MedicalHistoryEntry>> {
    await this.access.authorizeClinicalRead(
      actor,
      fighterId,
      MEDICAL_READ_VIEW.HISTORY,
      requestId,
    );
    return paginate(await this.repo.listHistory(fighterId, query), query);
  }

  async listExaminations(
    actor: AuthenticatedUser,
    fighterId: string,
    query: ListExaminationsQuery,
    requestId: string,
  ): Promise<Paginated<Examination>> {
    await this.access.authorizeClinicalRead(
      actor,
      fighterId,
      MEDICAL_READ_VIEW.EXAMINATIONS,
      requestId,
    );
    return paginate(await this.repo.listExaminations(fighterId, query), query);
  }

  async listReviewRequests(
    actor: AuthenticatedUser,
    fighterId: string,
    query: ListReviewRequestsQuery,
    requestId: string,
  ): Promise<Paginated<ReviewRequest>> {
    await this.access.authorizeClinicalRead(
      actor,
      fighterId,
      MEDICAL_READ_VIEW.REVIEW_REQUESTS,
      requestId,
    );
    return paginate(
      await this.repo.listReviewRequests(fighterId, query),
      query,
    );
  }

  // --- Eligibility ---

  private async eligibilityFrom(
    scope: ExaminationScope,
    exam: Awaited<ReturnType<MedicalRepository['findCurrentExamination']>>,
    openReviewRequests: number,
    baselineOnFile: boolean,
    now: Date,
    database: DatabaseExecutor | undefined,
    sessionType: SessionTypeValue | undefined,
    supervision: 'DOCTOR' | 'NONE',
  ): Promise<MedicalEligibility> {
    const clearances =
      exam && exam.decision !== 'NOT_ELIGIBLE'
        ? await this.repo.listClearancesForExamination(
            exam.id,
            CLEARANCE_TYPES_BY_SCOPE[scope],
            database,
          )
        : [];
    return evaluateEligibility({
      scope,
      supervision,
      openReviewRequests,
      baselineOnFile,
      currentExamination: exam,
      clearances,
      now,
      sessionType,
    });
  }

  /**
   * Training start gate. Takes the per-Fighter medical lock inside the caller's
   * transaction so a concurrent review request, negative decision or revoke
   * cannot interleave with the start.
   */
  async evaluateTrainingEligibility(
    fighterId: string,
    sessionType: SessionTypeValue,
    transaction: Transaction,
  ): Promise<MedicalEligibility> {
    const supervision =
      await this.academySettingsRepo.getMedicalSupervision(transaction);
    await this.repo.lockFighterMedicalState(fighterId, transaction);
    const openReviewRequests = await this.repo.countOpenReviewRequests(
      fighterId,
      transaction,
    );
    const exam = await this.repo.findCurrentExamination(
      fighterId,
      'TRAINING',
      transaction,
    );
    const baselineOnFile = await this.repo.hasBaselineOnFile(
      fighterId,
      transaction,
    );
    return this.eligibilityFrom(
      'TRAINING',
      exam,
      openReviewRequests,
      baselineOnFile,
      new Date(),
      transaction,
      sessionType,
      supervision,
    );
  }

  // --- Review requests ---

  async createReviewRequest(
    actor: AuthenticatedUser,
    fighterId: string,
    input: CreateReviewRequestInput,
    requestId: string,
  ): Promise<ReviewRequest> {
    const supervision = await this.academySettingsRepo.getMedicalSupervision();
    if (supervision === 'NONE') {
      throw medicalSupervisionDisabled();
    }
    const fighter = await this.access.requireFighter(fighterId);
    return this.write(actor, requestId, async (tx) => {
      await this.access.assertReviewRequestScope(actor, fighter, tx);
      await this.repo.lockFighterMedicalState(fighterId, tx);
      return this.repo.insertReviewRequest(
        fighterId,
        actor.id,
        actor.role,
        input.reason,
        tx,
      );
    });
  }

  // --- Injuries, treatments, recovery ---

  async createInjury(
    actor: AuthenticatedUser,
    fighterId: string,
    input: CreateInjuryInput,
    requestId: string,
  ): Promise<Injury> {
    await this.access.requireFighter(fighterId);
    return this.write(actor, requestId, async (tx) => {
      const doctorId = await this.access.requireAssignedDoctor(
        actor,
        fighterId,
        tx,
      );
      return this.repo.insertInjury(fighterId, doctorId, input, tx);
    });
  }

  async updateInjury(
    actor: AuthenticatedUser,
    injuryId: string,
    input: UpdateInjuryInput,
    requestId: string,
  ): Promise<Injury> {
    const injury = await this.repo.findInjury(injuryId);
    if (!injury) throw injuryNotFound();

    return this.write(actor, requestId, async (tx) => {
      await this.access.requireAssignedDoctor(actor, injury.fighterId, tx);
      const current = await this.repo.lockInjury(injuryId, tx);
      if (!current) throw injuryNotFound();

      // RESOLVED is a final status, but severity/description stay correctable;
      // every correction is a new revision.
      const nextStatus = input.status;
      const changesStatus =
        nextStatus !== undefined && nextStatus !== current.status;
      if (
        nextStatus !== undefined &&
        changesStatus &&
        !INJURY_STATUS_TRANSITIONS[current.status]?.includes(nextStatus)
      ) {
        throw invalidInjuryStatusTransition();
      }

      const updated = await this.repo.updateInjury(
        injuryId,
        {
          severity: input.severity,
          description: input.description,
          status: changesStatus ? input.status : undefined,
          resolve: changesStatus && input.status === 'RESOLVED',
        },
        tx,
      );
      if (!updated) throw injuryNotFound();
      return updated;
    });
  }

  async createTreatment(
    actor: AuthenticatedUser,
    injuryId: string,
    input: CreateTreatmentInput,
    requestId: string,
  ): Promise<Treatment> {
    const injury = await this.repo.findInjury(injuryId);
    if (!injury) throw injuryNotFound();

    return this.write(actor, requestId, async (tx) => {
      const doctorId = await this.access.requireAssignedDoctor(
        actor,
        injury.fighterId,
        tx,
      );
      return this.repo.insertTreatment(injuryId, doctorId, input, tx);
    });
  }

  async createRecoveryPlan(
    actor: AuthenticatedUser,
    fighterId: string,
    input: CreateRecoveryPlanInput,
    requestId: string,
  ): Promise<RecoveryPlan> {
    await this.access.requireFighter(fighterId);
    return this.write(actor, requestId, async (tx) => {
      const doctorId = await this.access.requireAssignedDoctor(
        actor,
        fighterId,
        tx,
      );
      const injury = await this.repo.findInjury(input.injuryId, tx);
      if (!injury || injury.fighterId !== fighterId) throw injuryNotFound();
      const now = new Date().toISOString();
      const milestones = input.milestones.map((m) => newMilestone(m, now));
      return this.repo.insertRecoveryPlan(
        fighterId,
        doctorId,
        input,
        milestones,
        tx,
      );
    });
  }

  async updateRecoveryPlan(
    actor: AuthenticatedUser,
    planId: string,
    input: UpdateRecoveryPlanInput,
    requestId: string,
  ): Promise<RecoveryPlan> {
    const plan = await this.repo.findRecoveryPlan(planId);
    if (!plan) throw recoveryPlanNotFound();

    return this.write(actor, requestId, async (tx) => {
      await this.access.requireAssignedDoctor(actor, plan.fighterId, tx);
      const current = await this.repo.lockRecoveryPlan(planId, tx);
      if (!current) throw recoveryPlanNotFound();

      // COMPLETED/CANCELLED are final statuses, but plan content stays
      // correctable; every correction is a new revision.
      const nextStatus = input.status;
      const changesStatus =
        nextStatus !== undefined && nextStatus !== current.status;
      if (
        nextStatus !== undefined &&
        changesStatus &&
        !RECOVERY_PLAN_STATUS_TRANSITIONS[current.status]?.includes(nextStatus)
      ) {
        throw invalidRecoveryPlanStatusTransition();
      }
      if (input.estimatedEndDate && input.estimatedEndDate < current.startDate) {
        throw recoveryPlanDateConflict();
      }

      const completing = changesStatus && input.status === 'COMPLETED';
      const actualEndDate = completing ? todayUtc() : undefined;
      if (actualEndDate && actualEndDate < current.startDate) {
        throw recoveryPlanDateConflict();
      }

      // Milestones change only when the Doctor sends them; otherwise the
      // stored array (legacy included) is left exactly as it is. Completing
      // milestones never completes the plan or decides eligibility.
      let milestones: RecoveryMilestone[] | undefined;
      if (input.milestones !== undefined) {
        milestones = replaceMilestones(
          input.milestones,
          current.milestones,
          new Date().toISOString(),
        );
        if (!milestones) throw medicalReferenceNotFound();
      }

      const updated = await this.repo.updateRecoveryPlan(
        planId,
        {
          ...(input.description !== undefined
            ? { description: input.description }
            : {}),
          ...(input.estimatedEndDate !== undefined
            ? { estimatedEndDate: input.estimatedEndDate }
            : {}),
          ...(milestones !== undefined ? { milestones } : {}),
          ...(changesStatus ? { status: input.status } : {}),
          ...(actualEndDate ? { actualEndDate } : {}),
        },
        tx,
      );
      if (!updated) throw recoveryPlanNotFound();
      return updated;
    });
  }

  // --- Examinations and clearances ---

  async createExamination(
    actor: AuthenticatedUser,
    fighterId: string,
    input: CreateExaminationInput,
    requestId: string,
  ): Promise<Examination> {
    await this.access.requireFighter(fighterId);
    const examinedAt = new Date(input.examinedAt);

    return this.write(actor, requestId, async (tx) => {
      const doctorId = await this.access.requireAssignedDoctor(
        actor,
        fighterId,
        tx,
      );
      await this.repo.lockFighterMedicalState(fighterId, tx);

      if (input.supersedesId) {
        const target = await this.repo.findExamination(
          fighterId,
          input.supersedesId,
          tx,
        );
        if (!target) throw medicalExaminationNotFound();
        const current = await this.repo.findCurrentExamination(
          fighterId,
          input.scope,
          tx,
        );
        if (target.scope !== input.scope || current?.id !== target.id) {
          throw examinationCorrectionConflict();
        }
      }

      const requestIds = input.reviewRequestIds ?? [];
      if (requestIds.length > 0) {
        const requests = await this.repo.lockReviewRequests(
          fighterId,
          requestIds,
          tx,
        );
        if (requests.length !== requestIds.length) {
          throw medicalReviewRequestNotFound();
        }
        const unresolvable = requests.some(
          (request) =>
            request.status !== 'OPEN' ||
            new Date(request.requestedAt).getTime() > examinedAt.getTime(),
        );
        if (unresolvable) throw reviewRequestNotResolvable();
      }

      const restrictions = input.restrictions;
      const row = await this.repo.insertExamination(
        {
          fighterId,
          doctorId,
          recordedById: actor.id,
          scope: input.scope,
          decision: input.decision,
          examinedAt,
          reason: input.reason,
          allowedSessionTypes: restrictions?.allowedSessionTypes ?? null,
          allowedTechniqueTypes: restrictions?.allowedTechniqueTypes ?? null,
          excludedJoints: restrictions?.excludedJoints ?? null,
          restrictionNotes: restrictions?.notes ?? null,
          validUntil: input.validUntil ? new Date(input.validUntil) : null,
          supersedesId: input.supersedesId ?? null,
        },
        tx,
      );

      // Details and SCAT6 are written in the examination's transaction: a
      // rejected detail rolls the whole examination back.
      const details = input.examinationType
        ? await this.repo.insertExaminationDetails(
            row,
            {
              examinationType: input.examinationType,
              vitals: input.vitals ?? null,
              assessments: input.assessments ?? [],
              recommendations: input.recommendations ?? null,
              followUpDate: input.followUpDate ?? null,
              scat6: input.scat6
                ? await this.scat6Record(fighterId, input.scat6, tx)
                : null,
            },
            tx,
          )
        : null;

      if (requestIds.length > 0) {
        const resolved = await this.repo.resolveReviewRequests(
          requestIds,
          row.id,
          tx,
        );
        if (resolved !== requestIds.length) throw reviewRequestNotResolvable();
      }
      return toExamination(row, details);
    });
  }

  /**
   * The SCAT6 applies from age 13 (Child SCAT6 is out of scope): an
   * administered SCAT6 for a younger Fighter is rejected rather than scored.
   * Scores are always computed here from the raw answers.
   */
  private async scat6Record(
    fighterId: string,
    scat6: Scat6Input,
    tx: Transaction,
  ): Promise<ExaminationDetailsInsert['scat6']> {
    if (scat6.status === 'NOT_ADMINISTERED') {
      return {
        formVersion: scat6.formVersion,
        responses: scat6,
        scoringVersion: null,
        scores: null,
      };
    }
    const dateOfBirth = await this.repo.findFighterDateOfBirth(fighterId, tx);
    if (
      !dateOfBirth ||
      ageInYears(dateOfBirth, new Date(scat6.administeredAt)) <
        SCAT6.MIN_AGE_YEARS
    ) {
      throw medicalDataConstraintConflict();
    }
    return {
      formVersion: scat6.formVersion,
      responses: scat6,
      scoringVersion: SCAT6.SCORING_VERSION,
      scores: scoreScat6(scat6),
    };
  }

  async issueClearance(
    actor: AuthenticatedUser,
    fighterId: string,
    input: IssueClearanceInput,
    requestId: string,
  ): Promise<Clearance> {
    await this.access.requireFighter(fighterId);

    return this.write(actor, requestId, async (tx) => {
      const doctorId = await this.access.requireAssignedDoctor(
        actor,
        fighterId,
        tx,
      );
      await this.repo.lockFighterMedicalState(fighterId, tx);

      const exam = await this.repo.findExamination(
        fighterId,
        input.examinationId,
        tx,
      );
      if (!exam) throw medicalExaminationNotFound();
      const current = await this.repo.findCurrentExamination(
        fighterId,
        exam.scope,
        tx,
      );

      const validFrom = input.validFrom ? new Date(input.validFrom) : new Date();
      const validUntil = input.validUntil
        ? new Date(input.validUntil)
        : exam.validUntil;
      const allowedSessionTypes =
        input.restrictions?.allowedSessionTypes ?? exam.allowedSessionTypes;
      const allowedTechniqueTypes =
        input.restrictions?.allowedTechniqueTypes ??
        exam.allowedTechniqueTypes;
      const excludedJoints =
        input.restrictions?.excludedJoints ?? exam.excludedJoints;

      const derivable =
        exam.decision !== 'NOT_ELIGIBLE' &&
        current?.id === exam.id &&
        (CLEARANCE_TYPES_BY_SCOPE[exam.scope] as readonly string[]).includes(
          input.clearanceType,
        ) &&
        validFrom.getTime() >= exam.examinedAt.getTime() &&
        (!exam.validUntil ||
          (validUntil !== null &&
            validUntil.getTime() <= exam.validUntil.getTime())) &&
        (!exam.allowedSessionTypes ||
          (allowedSessionTypes !== null &&
            isSubset(allowedSessionTypes, exam.allowedSessionTypes))) &&
        (!exam.allowedTechniqueTypes ||
          (allowedTechniqueTypes !== null &&
            isSubset(allowedTechniqueTypes, exam.allowedTechniqueTypes))) &&
        (!exam.excludedJoints ||
          (excludedJoints !== null &&
            isSubset(exam.excludedJoints, excludedJoints)));
      if (!derivable) throw examinationNotEligibleForClearance();

      if (
        await this.repo.hasActiveClearanceForExamination(
          exam.id,
          input.clearanceType,
          tx,
        )
      ) {
        throw medicalRecordConflict();
      }

      return this.repo.insertClearance(
        {
          fighterId,
          examinationId: exam.id,
          issuedById: doctorId,
          clearanceType: input.clearanceType,
          validFrom,
          validUntil,
          notes: input.notes ?? null,
          allowedSessionTypes,
          allowedTechniqueTypes,
          excludedJoints,
        },
        tx,
      );
    });
  }

  async revokeClearance(
    actor: AuthenticatedUser,
    clearanceId: string,
    input: RevokeClearanceInput,
    requestId: string,
  ): Promise<Clearance> {
    const clearance = await this.repo.findClearance(clearanceId);
    if (!clearance) throw medicalClearanceNotFound();

    return this.write(actor, requestId, async (tx) => {
      const doctorId = await this.access.requireAssignedDoctor(
        actor,
        clearance.fighterId,
        tx,
      );
      await this.repo.lockFighterMedicalState(clearance.fighterId, tx);
      const revoked = await this.repo.revokeClearance(
        clearanceId,
        doctorId,
        input.revokedReason,
        tx,
      );
      if (!revoked) throw medicalClearanceNotActive();
      return revoked;
    });
  }
}
