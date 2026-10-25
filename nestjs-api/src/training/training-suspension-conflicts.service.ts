import { Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '../shared/models/auth-context.model.js';
import type { DatabaseExecutor } from '../shared/utils/audit-context.util.js';
import {
  suspensionNotFound,
  suspensionValidationError,
} from '../suspensions/suspensions.error.js';
import {
  applySuspensionConflictsSchema,
  planConflicts,
  type ApplySuspensionConflictsInput,
  type ConflictAction,
  type ConflictProposal,
} from '../suspensions/suspensions.model.js';
import { SuspensionsRepository } from '../suspensions/suspensions.repo.js';
import { TrainingSessionService } from './sessions/training-session.service.js';
import { TrainingAccessService } from './training-access.service.js';
import { SUSPENSION_CONFLICT_CANCELLATION_REASON } from './training.constants.js';
import { mapTrainingPersistenceError } from './training.error.js';
import type { TrainingSessionEntity } from './training.model.js';
import { TrainingRepository } from './training.repo.js';

interface AppliedConflictOutcome {
  session: TrainingSessionEntity;
  action: ConflictAction;
  rescheduled: boolean;
}

@Injectable()
export class TrainingSuspensionConflictsService {
  constructor(
    private readonly repo: TrainingRepository,
    private readonly suspensionsRepo: SuspensionsRepository,
    private readonly access: TrainingAccessService,
    private readonly sessionService: TrainingSessionService,
  ) {}

  async getConflicts(
    actor: AuthenticatedUser,
    suspensionId: string,
  ): Promise<ConflictProposal[]> {
    try {
      const suspension =
        await this.suspensionsRepo.findSuspensionById(suspensionId);
      if (!suspension || suspension.deletedAt !== null) {
        throw suspensionNotFound();
      }
      await this.access.assertFighterAccess(actor, suspension.fighterId);

      if (suspension.clearedAt !== null) {
        return [];
      }

      const [sessions, fighterSuspensions] = await Promise.all([
        this.loadFighterSessions(suspension.fighterId),
        this.suspensionsRepo.findSuspensionsByFighterId(suspension.fighterId),
      ]);
      const allSuspensions = fighterSuspensions.some(
        (s) => s.id === suspension.id,
      )
        ? fighterSuspensions
        : [suspension, ...fighterSuspensions];

      return planConflicts(sessions, allSuspensions);
    } catch (error) {
      throw mapTrainingPersistenceError(error);
    }
  }

  async applyConflicts(
    actor: AuthenticatedUser,
    suspensionId: string,
    input: ApplySuspensionConflictsInput,
  ): Promise<TrainingSessionEntity[]> {
    const parsed = applySuspensionConflictsSchema.safeParse(input);
    if (!parsed.success) {
      throw suspensionValidationError(
        'Validation failed',
        parsed.error.issues.map((issue) => ({
          code: issue.code,
          path: issue.path as (string | number)[],
          message: issue.message,
        })),
      );
    }
    const data = parsed.data;

    this.access.assertTrainingWriteAllowed(actor);

    let outcomes: AppliedConflictOutcome[];
    try {
      const suspension =
        await this.suspensionsRepo.findSuspensionById(suspensionId);
      if (!suspension || suspension.deletedAt !== null) {
        throw suspensionNotFound();
      }
      await this.access.assertFighterAccess(actor, suspension.fighterId);

      outcomes = await this.repo.transaction(async (transaction) => {
        const currentSuspension =
          (await this.suspensionsRepo.findSuspensionById(
            suspensionId,
            transaction,
          )) ?? suspension;
        if (currentSuspension.deletedAt !== null) {
          throw suspensionNotFound();
        }

        const [sessions, fighterSuspensions] = await Promise.all([
          this.loadFighterSessions(currentSuspension.fighterId, transaction),
          this.suspensionsRepo.findSuspensionsByFighterId(
            currentSuspension.fighterId,
            transaction,
          ),
        ]);
        const allSuspensions = fighterSuspensions.some(
          (s) => s.id === currentSuspension.id,
        )
          ? fighterSuspensions
          : [currentSuspension, ...fighterSuspensions];
        const proposals =
          currentSuspension.clearedAt === null
            ? planConflicts(sessions, allSuspensions)
            : [];
        const proposalBySessionId = new Map(
          proposals.map((proposal) => [proposal.sessionId, proposal]),
        );

        for (const sessionId of data.sessionIds) {
          if (!proposalBySessionId.has(sessionId)) {
            throw suspensionValidationError(
              `Session ${sessionId} is not in the current conflict proposal`,
              [
                {
                  code: 'custom',
                  path: ['sessionIds'],
                  message: `Session ${sessionId} is not in the current conflict proposal`,
                },
              ],
            );
          }
        }

        const applied: AppliedConflictOutcome[] = [];
        for (const sessionId of data.sessionIds) {
          const proposal = proposalBySessionId.get(sessionId)!;
          if (proposal.action === 'CHANGE_TYPE') {
            const { updated, rescheduled } =
              await this.sessionService.applySessionUpdateInTransaction(
                sessionId,
                { sessionType: proposal.toType ?? 'RECOVERY' },
                transaction,
              );
            applied.push({
              session: updated,
              action: 'CHANGE_TYPE',
              rescheduled,
            });
          } else if (proposal.action === 'RESCHEDULE') {
            const { updated, rescheduled } =
              await this.sessionService.applySessionUpdateInTransaction(
                sessionId,
                { scheduledAt: proposal.toScheduledAt!.toISOString() },
                transaction,
              );
            applied.push({
              session: updated,
              action: 'RESCHEDULE',
              rescheduled,
            });
          } else {
            const updated =
              await this.sessionService.applySessionCancelInTransaction(
                sessionId,
                SUSPENSION_CONFLICT_CANCELLATION_REASON,
                transaction,
              );
            applied.push({
              session: updated,
              action: 'CANCEL',
              rescheduled: false,
            });
          }
        }
        return applied;
      });
    } catch (error) {
      throw mapTrainingPersistenceError(error);
    }

    for (const outcome of outcomes) {
      if (outcome.action === 'RESCHEDULE' && outcome.rescheduled) {
        await this.sessionService.notifySessionRescheduled(
          actor,
          outcome.session,
        );
      } else if (outcome.action === 'CANCEL') {
        await this.sessionService.notifySessionCancelled(
          actor,
          outcome.session,
        );
      }
    }

    return outcomes.map((outcome) => outcome.session);
  }

  private async loadFighterSessions(
    fighterId: string,
    database?: DatabaseExecutor,
  ): Promise<TrainingSessionEntity[]> {
    if (typeof this.repo.findScheduledSessionsByFighterId === 'function') {
      return this.repo.findScheduledSessionsByFighterId(fighterId, database);
    }
    const result = await this.repo.findSessions(
      { fighterId, status: 'SCHEDULED', page: 1, limit: 100 },
      {},
      database,
    );
    return result.data;
  }
}
