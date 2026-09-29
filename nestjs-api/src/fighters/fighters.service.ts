import { HttpException, Inject, Injectable } from '@nestjs/common';
import {
  NOTIFICATION_PUBLISHER,
  NOTIFICATION_TARGET,
  NOTIFICATION_TYPE,
  type NotificationPublisher,
} from '../shared/contracts/notification.contract.js';
import type { AuthenticatedUser } from '../shared/models/auth-context.model.js';
import { USER } from '../shared/types/user.role.js';
import { forbidden } from '../shared/errors/access.error.js';
import { setAuditContext } from '../shared/utils/audit-context.util.js';
import {
  coachAssignmentAlreadyActive,
  coachAssignmentAlreadyClosed,
  coachAssignmentNotFound,
  coachNotFound,
  fighterNotFound,
  invalidAssignmentPeriod,
  mapFighterPersistenceError,
  measurementAlreadySuperseded,
  measurementContextForbidden,
  measurementNotFound,
} from './fighters.error.js';
import { MedicalAccessService } from '../medical/medical-access.service.js';
import { MEDICAL_READ_VIEW } from '../medical/medical.constants.js';
import { MedicalService } from '../medical/medical.service.js';
import {
  type AssignCoachInput,
  type CoachAssignment,
  type CreateMeasurementInput,
  type EndCoachAssignmentInput,
  type FighterMeasurement,
  type FighterMedicalSummary,
  type ListFighterSessionsQuery,
  type ListFightersQuery,
  type ListMeasurementsQuery,
  type PublicFighter,
  type TrainingSessionSummary,
  type UpdateFighterProfileInput,
} from './fighters.model.js';
import { COACH_ASSIGNMENT_NOTIFICATION_TEXT } from './fighters.constants.js';
import { FightersRepository } from './fighters.repo.js';

const MEDICAL_DISCLAIMER =
  'Measurements are estimated from 2D video using AI pose estimation. Results are NOT clinically validated. This system does not provide medical diagnosis. Consult a qualified healthcare professional for medical assessment.';

@Injectable()
export class FightersService {
  constructor(
    private readonly fightersRepository: FightersRepository,
    private readonly medicalAccess: MedicalAccessService,
    private readonly medicalService: MedicalService,
    @Inject(NOTIFICATION_PUBLISHER)
    private readonly notifications: NotificationPublisher,
  ) {}

  // --- Profile Operations ---

  private assertFighterOwnerScope(
    actor: AuthenticatedUser,
    fighterUserId: string,
  ): void {
    if (actor.role === USER.FIGHTER && actor.id !== fighterUserId) {
      throw forbidden();
    }
  }

  /**
   * A Coach's access to any specific Fighter is bounded by a currently
   * effective `coach_fighters` assignment, never by role alone. No-op for
   * every other role; those keep their existing scope checks.
   */
  private async assertCoachAssignmentScope(
    actor: AuthenticatedUser,
    fighterId: string,
  ): Promise<void> {
    if (actor.role !== USER.COACH) return;
    const coachId = await this.fightersRepository.findActiveCoachIdByUserId(
      actor.id,
    );
    if (!coachId) throw forbidden();
    const assigned = await this.fightersRepository.isFighterAssignedToCoach(
      coachId,
      fighterId,
    );
    if (!assigned) throw forbidden();
  }

  async findAll(
    actor: AuthenticatedUser,
    query: ListFightersQuery,
  ): Promise<{ data: PublicFighter[]; total: number; hasNextPage: boolean }> {
    // If fighter, they only see themselves in listing to avoid leaking other fighters' data
    if (actor.role === USER.FIGHTER) {
      const self = await this.fightersRepository.findByUserId(actor.id);
      if (!self) throw fighterNotFound();
      return { data: [self], total: 1, hasNextPage: false };
    }

    // Coach athlete management means assigned Fighters, not a global directory.
    if (actor.role === USER.COACH) {
      const coachId = await this.fightersRepository.findActiveCoachIdByUserId(
        actor.id,
      );
      if (!coachId) throw forbidden();
      const { data, total } = await this.fightersRepository.findAllForCoach(
        coachId,
        query,
      );
      return { data, total, hasNextPage: query.page * query.limit < total };
    }

    // Fighter data carries health-related fields: a Doctor sees only the
    // Fighters under a currently effective doctor assignment.
    if (actor.role === USER.DOCTOR) {
      return this.medicalService.listFightersForDoctorUser(actor.id, query);
    }

    const { data, total } = await this.fightersRepository.findAll(query);
    return {
      data,
      total,
      hasNextPage: query.page * query.limit < total,
    };
  }

  async findById(actor: AuthenticatedUser, id: string): Promise<PublicFighter> {
    const fighter = await this.fightersRepository.findById(id);
    if (!fighter) throw fighterNotFound();

    // Resource-level authorization: Fighter can only view own profile
    this.assertFighterOwnerScope(actor, fighter.userId);
    // Coach can only view Fighters covered by a currently effective assignment
    await this.assertCoachAssignmentScope(actor, id);
    await this.medicalAccess.assertDoctorFighterScope(actor, id);

    return fighter;
  }

  async updateProfile(
    actor: AuthenticatedUser,
    id: string,
    input: UpdateFighterProfileInput,
    requestId: string,
  ): Promise<PublicFighter> {
    const fighter = await this.fightersRepository.findById(id);
    if (!fighter) throw fighterNotFound();

    // Fighters remain owner-scoped; other actors require the route permission.
    this.assertFighterOwnerScope(actor, fighter.userId);

    try {
      return await this.fightersRepository.transaction(async (tx) => {
        await setAuditContext(actor.authSubject, requestId, tx);
        const updated = await this.fightersRepository.update(id, input, tx);
        if (!updated) throw fighterNotFound();
        return updated;
      });
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw mapFighterPersistenceError(error);
    }
  }

  // --- Body Measurements (Append-Only) ---

  async findMeasurements(
    actor: AuthenticatedUser,
    fighterId: string,
    query: ListMeasurementsQuery,
  ): Promise<{
    data: FighterMeasurement[];
    total: number;
    hasNextPage: boolean;
  }> {
    const fighter = await this.fightersRepository.findById(fighterId);
    if (!fighter) throw fighterNotFound();

    this.assertFighterOwnerScope(actor, fighter.userId);
    await this.assertCoachAssignmentScope(actor, fighterId);

    const { data, total } = await this.fightersRepository.findMeasurements(
      fighterId,
      query,
    );
    return {
      data,
      total,
      hasNextPage: query.page * query.limit < total,
    };
  }

  async createMeasurement(
    actor: AuthenticatedUser,
    fighterId: string,
    input: CreateMeasurementInput,
    requestId: string,
  ): Promise<FighterMeasurement> {
    const fighter = await this.fightersRepository.findById(fighterId);
    if (!fighter) throw fighterNotFound();

    this.assertFighterOwnerScope(actor, fighter.userId);

    // Business rule: Fighter can only record for self and with SELF_REPORTED context
    if (actor.role === USER.FIGHTER) {
      if (input.measurementContext !== 'SELF_REPORTED') {
        throw measurementContextForbidden();
      }
    }

    try {
      return await this.fightersRepository.transaction(async (tx) => {
        await setAuditContext(actor.authSubject, requestId, tx);
        return this.fightersRepository.insertMeasurement(
          fighterId,
          actor.id,
          input,
          undefined,
          tx,
        );
      });
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw mapFighterPersistenceError(error);
    }
  }

  async supersedeMeasurement(
    actor: AuthenticatedUser,
    fighterId: string,
    measurementId: string,
    input: CreateMeasurementInput,
    requestId: string,
  ): Promise<FighterMeasurement> {
    const fighter = await this.fightersRepository.findById(fighterId);
    if (!fighter) throw fighterNotFound();

    // Authorize the fighter scope before reading details about the target record.
    this.assertFighterOwnerScope(actor, fighter.userId);

    // Verify target measurement exists and belongs to this fighter
    const target = await this.fightersRepository.findMeasurementById(
      fighterId,
      measurementId,
    );
    if (!target) throw measurementNotFound();
    if (target.isSuperseded) throw measurementAlreadySuperseded();

    // Role check for context
    if (actor.role === USER.FIGHTER) {
      if (input.measurementContext !== 'SELF_REPORTED') {
        throw measurementContextForbidden();
      }
    }

    try {
      return await this.fightersRepository.transaction(async (tx) => {
        await setAuditContext(actor.authSubject, requestId, tx);
        return this.fightersRepository.insertMeasurement(
          fighterId,
          actor.id,
          input,
          measurementId,
          tx,
        );
      });
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw mapFighterPersistenceError(error);
    }
  }

  // --- Coach Assignments (Temporal) ---

  async findCoachAssignments(
    actor: AuthenticatedUser,
    fighterId: string,
  ): Promise<CoachAssignment[]> {
    const fighter = await this.fightersRepository.findById(fighterId);
    if (!fighter) throw fighterNotFound();

    this.assertFighterOwnerScope(actor, fighter.userId);
    await this.assertCoachAssignmentScope(actor, fighterId);

    return this.fightersRepository.findCoachAssignments(fighterId);
  }

  async assignCoach(
    actor: AuthenticatedUser,
    fighterId: string,
    input: AssignCoachInput,
    requestId: string,
  ): Promise<CoachAssignment> {
    const fighter = await this.fightersRepository.findById(fighterId);
    if (!fighter) throw fighterNotFound();

    const coach = await this.fightersRepository.findCoachById(input.coachId);
    if (!coach) throw coachNotFound();

    const activeAssignment =
      await this.fightersRepository.findActiveCoachAssignment(
        input.coachId,
        fighterId,
      );
    if (activeAssignment) throw coachAssignmentAlreadyActive();

    const startsAt = input.startsAt ? new Date(input.startsAt) : new Date();

    let assignment: CoachAssignment;
    try {
      assignment = await this.fightersRepository.transaction(async (tx) => {
        await setAuditContext(actor.authSubject, requestId, tx);
        return this.fightersRepository.insertCoachAssignment(
          input.coachId,
          fighterId,
          actor.id,
          startsAt,
          tx,
        );
      });
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw mapFighterPersistenceError(error);
    }

    // T1, after commit; the publisher never throws.
    await this.notifications.notifyResolved(
      async () => [
        {
          recipientUserIds: [coach.userId],
          actorUserId: actor.id,
          type: NOTIFICATION_TYPE.COACH_ASSIGNMENT_STARTED,
          ...COACH_ASSIGNMENT_NOTIFICATION_TEXT.STARTED_COACH,
          target: { type: NOTIFICATION_TARGET.FIGHTER, id: fighterId },
          data: { startsAt: assignment.startsAt.toISOString() },
          dedupeKey: `coach-assignment:${assignment.id}:coach`,
        },
        {
          recipientUserIds: [fighter.userId],
          actorUserId: actor.id,
          type: NOTIFICATION_TYPE.COACH_ASSIGNMENT_STARTED,
          ...COACH_ASSIGNMENT_NOTIFICATION_TEXT.STARTED_FIGHTER,
          target: {
            type: NOTIFICATION_TARGET.COACH_ASSIGNMENT,
            id: assignment.id,
          },
          data: { startsAt: assignment.startsAt.toISOString() },
          dedupeKey: `coach-assignment:${assignment.id}:fighter`,
        },
      ],
      { correlationId: requestId },
    );
    return assignment;
  }

  async endCoachAssignment(
    actor: AuthenticatedUser,
    fighterId: string,
    assignmentId: string,
    input: EndCoachAssignmentInput,
    requestId: string,
  ): Promise<CoachAssignment> {
    const fighter = await this.fightersRepository.findById(fighterId);
    if (!fighter) throw fighterNotFound();

    const assignment = await this.fightersRepository.findCoachAssignmentById(
      fighterId,
      assignmentId,
    );
    if (!assignment) throw coachAssignmentNotFound();
    if (assignment.ends_at !== null) throw coachAssignmentAlreadyClosed();

    const endsAt = input.endsAt ? new Date(input.endsAt) : new Date();
    if (endsAt.getTime() <= new Date(assignment.starts_at).getTime()) {
      throw invalidAssignmentPeriod();
    }

    let closed: CoachAssignment;
    try {
      closed = await this.fightersRepository.transaction(async (tx) => {
        await setAuditContext(actor.authSubject, requestId, tx);
        return this.fightersRepository.closeCoachAssignment(
          assignmentId,
          actor.id,
          input.endReason,
          endsAt,
          tx,
        );
      });
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw mapFighterPersistenceError(error);
    }

    // T1, after commit. Minimal reminders: no end reason and, for the Coach,
    // no link to Fighter data it can no longer read.
    await this.notifications.notifyResolved(
      async () => {
        const coachUserId = await this.fightersRepository.findCoachUserId(
          closed.coachId,
        );
        return [
          {
            recipientUserIds: coachUserId ? [coachUserId] : [],
            actorUserId: actor.id,
            type: NOTIFICATION_TYPE.COACH_ASSIGNMENT_ENDED,
            ...COACH_ASSIGNMENT_NOTIFICATION_TEXT.ENDED_COACH,
            dedupeKey: `coach-assignment:${closed.id}:coach`,
          },
          {
            recipientUserIds: [fighter.userId],
            actorUserId: actor.id,
            type: NOTIFICATION_TYPE.COACH_ASSIGNMENT_ENDED,
            ...COACH_ASSIGNMENT_NOTIFICATION_TEXT.ENDED_FIGHTER,
            target: {
              type: NOTIFICATION_TARGET.COACH_ASSIGNMENT,
              id: closed.id,
            },
            dedupeKey: `coach-assignment:${closed.id}:fighter`,
          },
        ];
      },
      { correlationId: requestId },
    );
    return closed;
  }

  // --- Training History ---

  async findTrainingSessions(
    actor: AuthenticatedUser,
    fighterId: string,
    query: ListFighterSessionsQuery,
  ): Promise<{
    data: TrainingSessionSummary[];
    total: number;
    hasNextPage: boolean;
  }> {
    const fighter = await this.fightersRepository.findById(fighterId);
    if (!fighter) throw fighterNotFound();

    this.assertFighterOwnerScope(actor, fighter.userId);
    await this.assertCoachAssignmentScope(actor, fighterId);

    const { data, total } = await this.fightersRepository.findTrainingSessions(
      fighterId,
      query,
    );
    return {
      data,
      total,
      hasNextPage: query.page * query.limit < total,
    };
  }

  // --- Medical Record Link ---

  async getMedicalSummary(
    actor: AuthenticatedUser,
    fighterId: string,
    requestId: string,
  ): Promise<FighterMedicalSummary> {
    // Same clinical READ matrix and access audit as the Medical module:
    // ADMIN all, FIGHTER self, COACH/DOCTOR only currently assigned Fighters.
    await this.medicalAccess.authorizeClinicalRead(
      actor,
      fighterId,
      MEDICAL_READ_VIEW.SUMMARY,
      requestId,
    );

    const summary = await this.fightersRepository.findMedicalSummary(fighterId);
    if (!summary) throw fighterNotFound();

    return {
      ...summary,
      disclaimer: MEDICAL_DISCLAIMER,
    };
  }
}
