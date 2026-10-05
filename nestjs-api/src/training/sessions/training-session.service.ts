import { Inject, Injectable } from '@nestjs/common';
import {
  NOTIFICATION_PUBLISHER,
  NOTIFICATION_TARGET,
  NOTIFICATION_TYPE,
  type NotificationPublisher,
  type NotificationType,
} from '../../shared/contracts/notification.contract.js';
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
  trainingMedicalEligibilityRequired,
} from '../training.error.js';
import type {
  CreateSessionInput,
  UpdateSessionInput,
  ListSessionsQuery,
  SessionStatusType,
  TrainingSessionEntity,
} from '../training.model.js';
import type {
  DatabaseExecutor,
  Transaction,
} from '../../shared/utils/audit-context.util.js';
import { MedicalService } from '../../medical/medical.service.js';
import type { AuthenticatedUser } from '../../shared/models/auth-context.model.js';
import { USER } from '../../shared/types/user.role.js';
import { forbidden } from '../../shared/errors/access.error.js';
import {
  ALLOWED_SESSION_TRANSITIONS,
  TERMINAL_SESSION_STATUSES,
  TRAINING_NOTIFICATION_TEXT,
} from '../training.constants.js';

@Injectable()
export class TrainingSessionService {
  constructor(
    private readonly repo: TrainingRepository,
    private readonly access: TrainingAccessService,
    private readonly medical: MedicalService,
    @Inject(NOTIFICATION_PUBLISHER)
    private readonly notifications: NotificationPublisher,
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

      const created = await this.repo.createSession(data);
      // T3, after the autocommitted insert; the publisher never throws.
      await this.notifySessionEvent(
        actor,
        created,
        NOTIFICATION_TYPE.TRAINING_SESSION_SCHEDULED,
        TRAINING_NOTIFICATION_TEXT.SESSION_SCHEDULED,
        `session:${created.id}`,
      );
      return created;
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
    let result: { updated: TrainingSessionEntity; rescheduled: boolean };
    try {
      const existing = await this.repo.findSessionById(id);
      if (!existing) throw sessionNotFound();
      await this.access.assertFighterAccess(actor, existing.fighterId);

      // The lock makes the reschedule check compare against exactly the row this
      // UPDATE replaces, never a snapshot a concurrent request changed.
      result = await this.repo.transaction(async (transaction) => {
        const locked = await this.repo.lockSessionById(id, transaction);
        if (!locked) throw sessionNotFound();
        const nextSessionType = data.sessionType;
        // Switching a running session to another type could step outside a
        // medical restriction, so it passes the same gate as starting it.
        if (
          nextSessionType !== undefined &&
          locked.status === 'IN_PROGRESS' &&
          nextSessionType !== locked.sessionType
        ) {
          await this.assertMedicallyEligible(
            locked.fighterId,
            nextSessionType,
            transaction,
          );
        }
        const rescheduled = this.isRescheduled(locked, data);
        const updated = await this.repo.updateSession(id, data, transaction);
        if (!updated) throw sessionNotFound();
        return { updated, rescheduled };
      });
    } catch (error) {
      throw mapTrainingPersistenceError(error);
    }

    // T4, after commit: only a real time/location change; notes, RPE, title, type
    // or a repeated request notify nobody.
    if (result.rescheduled) {
      await this.notifySessionEvent(
        actor,
        result.updated,
        NOTIFICATION_TYPE.TRAINING_SESSION_RESCHEDULED,
        TRAINING_NOTIFICATION_TEXT.SESSION_RESCHEDULED,
        `session:${id}:rescheduled:${result.updated.updatedAt}`,
      );
    }
    return result.updated;
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
      const isSameStatus = currentStatus === newStatus;
      if (
        !isSameStatus &&
        !ALLOWED_SESSION_TRANSITIONS[currentStatus]?.includes(newStatus)
      ) {
        throw invalidSessionStatusTransition(currentStatus, newStatus);
      }

      // Stopping, cancelling or reading is never medically gated.
      if (newStatus !== 'IN_PROGRESS') {
        if (isSameStatus) return session;
        const updated = await this.applyStatusTransition(
          session,
          newStatus,
          cancellationReason,
        );
        // T4: CANCELLED is terminal, so the session ID identifies the cancellation.
        if (updated.status === 'CANCELLED') {
          await this.notifySessionEvent(
            actor,
            updated,
            NOTIFICATION_TYPE.TRAINING_SESSION_CANCELLED,
            TRAINING_NOTIFICATION_TEXT.SESSION_CANCELLED,
            `session:${id}:cancelled`,
          );
        }
        return updated;
      }

      // Starting (or re-confirming) IN_PROGRESS runs the medical gate first,
      // including the same-status request. The session row is locked and
      // re-read so the gate judges the type actually being started, and the
      // per-Fighter medical lock keeps a concurrent review request, negative
      // decision or revoke from interleaving with the start.
      return await this.repo.transaction(async (transaction) => {
        const locked = await this.repo.lockSessionById(id, transaction);
        if (!locked) throw sessionNotFound();
        const lockedSameStatus = locked.status === newStatus;
        if (
          !lockedSameStatus &&
          !ALLOWED_SESSION_TRANSITIONS[locked.status]?.includes(newStatus)
        ) {
          throw invalidSessionStatusTransition(locked.status, newStatus);
        }
        await this.assertMedicallyEligible(
          locked.fighterId,
          locked.sessionType,
          transaction,
        );
        if (lockedSameStatus) return locked;
        return this.applyStatusTransition(
          locked,
          newStatus,
          cancellationReason,
          transaction,
        );
      });
    } catch (error) {
      throw mapTrainingPersistenceError(error);
    }
  }

  /**
   * True only when the mutation sends `scheduledAt` or `location` and the sent
   * value differs from the locked row. Instants are compared, not ISO strings;
   * `location` keeps the contract's null normalization (validated input is
   * already trimmed and never empty).
   */
  private isRescheduled(
    locked: TrainingSessionEntity,
    data: UpdateSessionInput,
  ): boolean {
    const timeChanged =
      data.scheduledAt !== undefined &&
      new Date(data.scheduledAt).getTime() !==
        new Date(locked.scheduledAt).getTime();
    const locationChanged =
      data.location !== undefined &&
      (data.location ?? null) !== (locked.location ?? null);
    return timeChanged || locationChanged;
  }

  /**
   * Notifies the session's Fighter and, when set, its Coach, never the user
   * who made the change. Recipient lookup runs inside the publisher's
   * isolation, so it cannot fail the committed operation.
   */
  private notifySessionEvent(
    actor: AuthenticatedUser,
    session: TrainingSessionEntity,
    type: NotificationType,
    text: { title: string; message: string },
    dedupeKey: string,
  ) {
    return this.notifications.notifyResolved(async () => [
      {
        recipientUserIds: await this.repo.findParticipantUserIds(
          session.fighterId,
          session.coachId,
        ),
        actorUserId: actor.id,
        type,
        ...text,
        target: { type: NOTIFICATION_TARGET.TRAINING_SESSION, id: session.id },
        data: {
          scheduledAt: session.scheduledAt,
          location: session.location,
        },
        dedupeKey,
      },
    ]);
  }

  private async assertMedicallyEligible(
    fighterId: string,
    sessionType: TrainingSessionEntity['sessionType'],
    transaction: Transaction,
  ): Promise<void> {
    const eligibility = await this.medical.evaluateTrainingEligibility(
      fighterId,
      sessionType,
      transaction,
    );
    if (!eligibility.eligible) {
      throw trainingMedicalEligibilityRequired(eligibility.reasons);
    }
  }

  private async applyStatusTransition(
    session: TrainingSessionEntity,
    newStatus: SessionStatusType,
    cancellationReason: string | undefined,
    database?: DatabaseExecutor,
  ): Promise<TrainingSessionEntity> {
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
      session.id,
      session.status,
      newStatus,
      stoppedAt,
      outcome,
      database,
    );
    if (!updated) {
      throw sessionStateConflict();
    }
    return updated;
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
