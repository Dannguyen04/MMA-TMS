import { HttpException, Injectable } from '@nestjs/common';
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
  medicalAccessDenied,
} from './fighters.error.js';
import type {
  AssignCoachInput,
  CoachAssignment,
  CreateMeasurementInput,
  EndCoachAssignmentInput,
  FighterMeasurement,
  FighterMedicalSummary,
  ListFighterSessionsQuery,
  ListFightersQuery,
  ListMeasurementsQuery,
  PublicFighter,
  TrainingSessionSummary,
  UpdateFighterProfileInput,
} from './fighters.model.js';
import { FightersRepository } from './fighters.repo.js';

const MEDICAL_DISCLAIMER =
  'Measurements are estimated from 2D video using AI pose estimation. Results are NOT clinically validated. This system does not provide medical diagnosis. Consult a qualified healthcare professional for medical assessment.';

@Injectable()
export class FightersService {
  constructor(private readonly fightersRepository: FightersRepository) {}

  // --- Profile Operations ---

  private assertFighterOwnerScope(
    actor: AuthenticatedUser,
    fighterUserId: string,
  ): void {
    if (actor.role === USER.FIGHTER && actor.id !== fighterUserId) {
      throw forbidden();
    }
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

    try {
      return await this.fightersRepository.transaction(async (tx) => {
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

    try {
      return await this.fightersRepository.transaction(async (tx) => {
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
  ): Promise<FighterMedicalSummary> {
    const fighter = await this.fightersRepository.findById(fighterId);
    if (!fighter) throw fighterNotFound();

    // Medical Read Matrix enforcement:
    // - Fighter: only own records
    // - Coach, Doctor, Admin: all fighters
    if (actor.role === USER.FIGHTER && fighter.userId !== actor.id) {
      throw medicalAccessDenied();
    }

    const summary = await this.fightersRepository.findMedicalSummary(fighterId);
    if (!summary) throw fighterNotFound();

    return {
      ...summary,
      disclaimer: MEDICAL_DISCLAIMER,
    };
  }
}
