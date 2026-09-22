import { Injectable } from '@nestjs/common';
import { TrainingRepository } from '../training.repo.js';
import { TrainingAccessService } from '../training-access.service.js';
import {
  feedbackContextMismatch,
  fighterScopeRequired,
  mapTrainingPersistenceError,
} from '../training.error.js';
import type {
  CreateFeedbackInput,
  ListFeedbackQuery,
} from '../training.model.js';
import type { AuthenticatedUser } from '../../shared/models/auth-context.model.js';
import { USER } from '../../shared/types/user.role.js';
import { forbidden } from '../../shared/errors/access.error.js';

@Injectable()
export class CoachFeedbackService {
  constructor(
    private readonly repo: TrainingRepository,
    private readonly access: TrainingAccessService,
  ) {}

  /**
   * Unlike plans and sessions, a coach reading one assigned fighter sees every
   * coach's feedback for that fighter; without a fighter it defaults to the
   * coach's own feedback.
   */
  async listFeedback(actor: AuthenticatedUser, query: ListFeedbackQuery) {
    const scopedQuery = { ...query };
    let activeCoachId: string | undefined;

    if (actor.role === USER.FIGHTER) {
      const fighterId = await this.repo.findActiveFighterIdByUserId(actor.id);
      if (!fighterId) throw forbidden();
      scopedQuery.fighterId = fighterId;
      delete scopedQuery.coachId;
    } else if (actor.role === USER.COACH) {
      activeCoachId = await this.repo.findActiveCoachIdByUserId(actor.id);
      if (!activeCoachId) throw forbidden();
      if (scopedQuery.coachId) {
        const owns = await this.repo.isCoachProfileOwnedByUser(
          actor.id,
          scopedQuery.coachId,
        );
        if (!owns) throw forbidden();
      } else if (!scopedQuery.fighterId) {
        scopedQuery.coachId = activeCoachId;
      }
    } else if (actor.role === USER.DOCTOR && !scopedQuery.fighterId) {
      throw fighterScopeRequired();
    }

    if (scopedQuery.fighterId) {
      await this.access.assertFighterAccess(actor, scopedQuery.fighterId);
    }

    try {
      const result = await this.repo.findFeedback(
        scopedQuery,
        activeCoachId ? { activeCoachId } : {},
      );
      return {
        ...result,
        hasNextPage: scopedQuery.page * scopedQuery.limit < result.total,
      };
    } catch (error) {
      throw mapTrainingPersistenceError(error);
    }
  }

  async createFeedback(actor: AuthenticatedUser, data: CreateFeedbackInput) {
    if (actor.role !== USER.COACH) throw forbidden();
    const coachId = await this.repo.findActiveCoachIdByUserId(actor.id);
    if (!coachId) throw forbidden();
    await this.access.assertFighterAccess(actor, data.fighterId);

    if (data.sessionId) {
      const session = await this.repo.findSessionById(data.sessionId);
      if (!session || session.fighterId !== data.fighterId) {
        throw feedbackContextMismatch();
      }
    }
    if (data.videoId) {
      const video = await this.repo.findVideoContext(data.videoId);
      if (!video || video.fighterId !== data.fighterId) {
        throw feedbackContextMismatch();
      }
    }

    try {
      return await this.repo.createFeedback({ ...data, coachId });
    } catch (error) {
      throw mapTrainingPersistenceError(error);
    }
  }
}
