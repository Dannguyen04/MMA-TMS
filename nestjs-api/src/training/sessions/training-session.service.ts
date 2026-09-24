import { Injectable } from '@nestjs/common';
import { TrainingRepository } from '../training.repo.js';
import type { SessionTransitionOutcome } from '../training.repo.js';
import { TrainingAccessService } from '../training-access.service.js';
import {
  sessionNotFound,
  invalidSessionStatusTransition,
  mapTrainingPersistenceError,
  unavailableSessionPlan,
  fighterPlanMismatch,
  sessionStateConflict,
} from '../training.error.js';
import type {
  CreateSessionInput,
  UpdateSessionInput,
  ListSessionsQuery,
  SessionStatusType,
} from '../training.model.js';
import type { AuthenticatedUser } from '../../shared/models/auth-context.model.js';
import { USER } from '../../shared/types/user.role.js';
import { forbidden } from '../../shared/errors/access.error.js';
import {
  ALLOWED_SESSION_TRANSITIONS,
  TERMINAL_SESSION_STATUSES,
} from '../training.constants.js';

@Injectable()
export class TrainingSessionService {
  constructor(
    private readonly repo: TrainingRepository,
    private readonly access: TrainingAccessService,
  ) {}

  async listSessions(actor: AuthenticatedUser, query: ListSessionsQuery) {
    const { scopedQuery, activeCoachId } = await this.access.scopeListQuery(
      actor,
      query,
    );

    try {
      const result = await this.repo.findSessions(scopedQuery, {
        activeCoachId,
      });
      return {
        ...result,
        hasNextPage: scopedQuery.page * scopedQuery.limit < result.total,
      };
    } catch (error) {
      throw mapTrainingPersistenceError(error);
    }
  }

  async getSessionById(actor: AuthenticatedUser, id: string) {
    try {
      const session = await this.repo.findSessionById(id);
      if (!session) throw sessionNotFound();
      await this.access.assertFighterAccess(actor, session.fighterId);
      return session;
    } catch (error) {
      throw mapTrainingPersistenceError(error);
    }
  }

  async createSession(actor: AuthenticatedUser, data: CreateSessionInput) {
    this.access.assertTrainingWriteAllowed(actor);
    await this.access.assertFighterAccess(actor, data.fighterId);

    if (actor.role === USER.COACH && data.coachId) {
      const owns = await this.repo.isCoachProfileOwnedByUser(
        actor.id,
        data.coachId,
      );
      if (!owns) throw forbidden();
    }

    try {
      if (data.planId) {
        const plan = await this.repo.findPlanById(data.planId);
        if (!plan || !plan.isActive) {
          throw unavailableSessionPlan();
        }
        if (plan.fighterId !== data.fighterId) {
          throw fighterPlanMismatch();
        }
      }

      return await this.repo.createSession(data);
    } catch (error) {
      throw mapTrainingPersistenceError(error);
    }
  }

  async updateSession(
    actor: AuthenticatedUser,
    id: string,
    data: UpdateSessionInput,
  ) {
    this.access.assertTrainingWriteAllowed(actor);
    try {
      const existing = await this.repo.findSessionById(id);
      if (!existing) throw sessionNotFound();
      await this.access.assertFighterAccess(actor, existing.fighterId);

      const updated = await this.repo.updateSession(id, data);
      if (!updated) throw sessionNotFound();
      return updated;
    } catch (error) {
      throw mapTrainingPersistenceError(error);
    }
  }

  /**
   * Transitions a session and writes the server-owned outcome of that
   * transition: the cancellation reason (CANCELLED only) and the measured
   * duration. `cancellationReason` arrives already validated — present and
   * nonempty exactly for CANCELLED — from `updateSessionStatusSchema`.
   */
  async updateSessionStatus(
    actor: AuthenticatedUser,
    id: string,
    newStatus: SessionStatusType,
    cancellationReason?: string,
  ) {
    this.access.assertTrainingWriteAllowed(actor);
    try {
      const session = await this.repo.findSessionById(id);
      if (!session) throw sessionNotFound();
      await this.access.assertFighterAccess(actor, session.fighterId);

      const currentStatus = session.status;
      if (currentStatus === newStatus) return session;

      if (!ALLOWED_SESSION_TRANSITIONS[currentStatus]?.includes(newStatus)) {
        throw invalidSessionStatusTransition(currentStatus, newStatus);
      }

      // One server instant for both the status timestamp and the elapsed
      // duration, so they can never disagree.
      const stoppedAt = new Date();
      const outcome: SessionTransitionOutcome = {
        cancellationReason:
          newStatus === 'CANCELLED' ? (cancellationReason ?? null) : null,
        actualDurationSec: this.measureElapsedSeconds(
          session.checkedInAt,
          newStatus,
          stoppedAt,
        ),
      };

      const updated = await this.repo.updateSessionStatus(
        id,
        currentStatus,
        newStatus,
        stoppedAt,
        outcome,
      );
      if (!updated) {
        throw sessionStateConflict();
      }
      return updated;
    } catch (error) {
      throw mapTrainingPersistenceError(error);
    }
  }

  /**
   * Elapsed seconds for a session that actually began, rounded up with a
   * floor of one second so the value always satisfies the database's
   * `actual_duration_sec > 0` check even for a sub-second session.
   *
   * Returns null when the session never checked in (a SCHEDULED session that
   * is cancelled or skipped has no measured duration) or when the new status
   * is not terminal — clearing any value a previous status left behind.
   */
  private measureElapsedSeconds(
    checkedInAt: string | null,
    newStatus: SessionStatusType,
    stoppedAt: Date,
  ): number | null {
    if (!checkedInAt) return null;
    if (!TERMINAL_SESSION_STATUSES.includes(newStatus)) return null;
    const elapsedMs = stoppedAt.getTime() - new Date(checkedInAt).getTime();
    return Math.max(1, Math.ceil(elapsedMs / 1000));
  }
}
