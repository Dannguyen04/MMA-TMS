import { Injectable, OnModuleInit } from '@nestjs/common';
import type { SuspensionRow } from '../database/schema.js';
import type { AuthenticatedUser } from '../shared/models/auth-context.model.js';
import type {
  DatabaseExecutor,
  Transaction,
} from '../shared/utils/audit-context.util.js';
import {
  SuspensionEffects,
  type SuspensionEffectResult,
} from '../suspensions/suspension.effects.js';
import {
  suspensionNotFound,
  suspensionValidationError,
} from '../suspensions/suspensions.error.js';
import {
  academyDateOf,
  applySuspensionConflictsSchema,
  isInForceOn,
  planConflicts,
  REHAB_TRIGGER_SUSPENSION_REASONS,
  type AffectedPlan,
  type AffectedSession,
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
}

function filterProposalsForSuspension(
  proposals: ConflictProposal[],
  suspension: SuspensionRow,
  sessions: TrainingSessionEntity[],
): ConflictProposal[] {
  const isOpenEnded =
    suspension.requiresClearance && suspension.clearedAt === null;
  const sessionById = new Map(sessions.map((s) => [s.id, s]));

  return proposals.filter((proposal) => {
    const session = sessionById.get(proposal.sessionId);
    if (!session) return false;
    const sessionDate = academyDateOf(new Date(session.scheduledAt));
    const inPeriod = isOpenEnded
      ? suspension.startsOn <= sessionDate
      : suspension.startsOn <= sessionDate && sessionDate <= suspension.endsOn;
    const typeBlocked = suspension.blockedSessionTypes.includes(
      session.sessionType,
    );
    return inPeriod && typeBlocked;
  });
}

@Injectable()
export class TrainingSuspensionConflictsService implements OnModuleInit {
  constructor(
    private readonly repo: TrainingRepository,
    private readonly suspensionsRepo: SuspensionsRepository,
    private readonly access: TrainingAccessService,
    private readonly sessionService: TrainingSessionService,
    private readonly suspensionEffects: SuspensionEffects,
  ) {}

  onModuleInit(): void {
    this.suspensionEffects.register((suspensions, tx) =>
      this.handleSuspensionsCreated(suspensions, tx),
    );
  }

  async handleSuspensionsCreated(
    createdSuspensions: SuspensionRow[],
    transaction: Transaction,
  ): Promise<SuspensionEffectResult> {
    if (createdSuspensions.length === 0) {
      return {
        affectedSessions: [],
        affectedPlans: [],
        afterCommit: async () => {},
      };
    }

    const affectedSessions: AffectedSession[] = [];
    const affectedPlans: AffectedPlan[] = [];
    const cancelledToNotify: {
      actorId: string;
      session: TrainingSessionEntity;
    }[] = [];

    const byFighter = new Map<string, SuspensionRow[]>();
    for (const susp of createdSuspensions) {
      const list = byFighter.get(susp.fighterId) ?? [];
      list.push(susp);
      byFighter.set(susp.fighterId, list);
    }

    for (const [fighterId, fighterCreated] of byFighter) {
      const [sessions, existingSuspensions] = await Promise.all([
        this.loadFighterSessions(fighterId, transaction),
        this.suspensionsRepo.findSuspensionsByFighterId(fighterId, transaction),
      ]);

      const mergedById = new Map<string, SuspensionRow>();
      for (const s of existingSuspensions) mergedById.set(s.id, s);
      for (const s of fighterCreated) mergedById.set(s.id, s);
      const allSuspensions = [...mergedById.values()];

      const proposals = planConflicts(sessions, allSuspensions).sort((a, b) =>
        a.sessionId.localeCompare(b.sessionId),
      );
      const actorId = fighterCreated[0]!.createdById;

      for (const proposal of proposals) {
        if (proposal.action === 'CANCEL') {
          const updated =
            await this.sessionService.applySessionCancelInTransaction(
              proposal.sessionId,
              SUSPENSION_CONFLICT_CANCELLATION_REASON,
              transaction,
            );
          affectedSessions.push({
            sessionId: updated.id,
            action: 'CANCEL',
          });
          cancelledToNotify.push({ actorId, session: updated });
        } else {
          const updated =
            await this.sessionService.applySessionPendingInTransaction(
              proposal.sessionId,
              transaction,
            );
          affectedSessions.push({
            sessionId: updated.id,
            action: 'PENDING',
          });
        }
      }

      const shouldTransitionPlansToRehab = fighterCreated.some((s) =>
        REHAB_TRIGGER_SUSPENSION_REASONS.includes(s.reason),
      );
      if (shouldTransitionPlansToRehab) {
        const lockedPlans = await this.repo.lockActiveCampPlansByFighterId(
          fighterId,
          transaction,
        );
        const eligiblePlans = lockedPlans
          .filter(
            (plan) =>
              plan.status === 'ACTIVE' &&
              plan.isActive !== false &&
              plan.deletedAt === null &&
              (plan.phase === 'fight_camp' || plan.phase === 'taper'),
          )
          .sort((a, b) => a.id.localeCompare(b.id));

        for (const plan of eligiblePlans) {
          const fromPhase = plan.phase;
          await this.repo.updatePlan(plan.id, { phase: 'rehab' }, transaction);
          affectedPlans.push({
            planId: plan.id,
            fromPhase,
            toPhase: 'rehab',
          });
        }
      }
    }

    return {
      affectedSessions,
      affectedPlans,
      afterCommit: async () => {
        for (const item of cancelledToNotify) {
          await this.sessionService.notifySessionCancelled(
            { id: item.actorId },
            item.session,
          );
        }
      },
    };
  }

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

      const today = academyDateOf(new Date());
      if (
        suspension.clearedAt !== null ||
        !isInForceOn(suspension, today)
      ) {
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

      const allProposals = planConflicts(sessions, allSuspensions);
      return filterProposalsForSuspension(allProposals, suspension, sessions);
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
        const today = academyDateOf(new Date());
        const isTargetInForce =
          currentSuspension.clearedAt === null &&
          isInForceOn(currentSuspension, today);

        const allProposals = isTargetInForce
          ? planConflicts(sessions, allSuspensions)
          : [];
        const proposals = filterProposalsForSuspension(
          allProposals,
          currentSuspension,
          sessions,
        );
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

        const ensureScheduled = (locked: TrainingSessionEntity) => {
          if (locked.status !== 'SCHEDULED') {
            throw suspensionValidationError(
              `Session ${locked.id} is not in the current conflict proposal`,
              [
                {
                  code: 'custom',
                  path: ['sessionIds'],
                  message: `Session ${locked.id} is not in the current conflict proposal`,
                },
              ],
            );
          }
        };

        const applied: AppliedConflictOutcome[] = [];
        for (const sessionId of data.sessionIds) {
          const proposal = proposalBySessionId.get(sessionId)!;
          if (proposal.action === 'PENDING') {
            const updated =
              await this.sessionService.applySessionPendingInTransaction(
                sessionId,
                transaction,
                ensureScheduled,
              );
            applied.push({
              session: updated,
              action: 'PENDING',
            });
          } else {
            const updated =
              await this.sessionService.applySessionCancelInTransaction(
                sessionId,
                SUSPENSION_CONFLICT_CANCELLATION_REASON,
                transaction,
                ensureScheduled,
              );
            applied.push({
              session: updated,
              action: 'CANCEL',
            });
          }
        }
        return applied;
      });
    } catch (error) {
      throw mapTrainingPersistenceError(error);
    }

    for (const outcome of outcomes) {
      if (outcome.action === 'CANCEL') {
        await this.sessionService.notifySessionCancelled(
          actor,
          outcome.session,
        );
      }
    }

    return outcomes.map((outcome) => outcome.session);
  }

  private loadFighterSessions(
    fighterId: string,
    database?: DatabaseExecutor,
  ): Promise<TrainingSessionEntity[]> {
    return this.repo.findScheduledSessionsByFighterId(fighterId, database);
  }
}
