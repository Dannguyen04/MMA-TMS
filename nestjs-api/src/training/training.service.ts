import { Injectable } from '@nestjs/common';
import { TrainingRepository } from './training.repo.js';
import {
  planNotFound,
  sessionNotFound,
  exerciseNotFound,
  invalidSessionStatusTransition,
  mapTrainingPersistenceError,
  planExerciseNotFound,
  invalidPlanDateRange,
  fighterScopeRequired,
  unavailableSessionPlan,
  fighterPlanMismatch,
  planStateConflict,
  sessionStateConflict,
  feedbackContextMismatch,
} from './training.error.js';
import type {
  CreatePlanInput,
  UpdatePlanInput,
  CreateSessionInput,
  UpdateSessionInput,
  CreateExerciseInput,
  UpdateExerciseInput,
  CreatePlanExerciseInput,
  UpdatePlanExerciseInput,
  ListPlansQuery,
  ListSessionsQuery,
  ListExercisesQuery,
  SessionStatusType,
  TrainingPlanStatusType,
  ListFeedbackQuery,
  CreateFeedbackInput,
} from './training.model.js';
import type { AuthenticatedUser } from '../shared/models/auth-context.model.js';
import { USER } from '../shared/types/user.role.js';
import { forbidden } from '../shared/errors/access.error.js';

@Injectable()
export class TrainingService {
  constructor(private readonly repo: TrainingRepository) {}

  private async assertFighterAccess(
    actor: AuthenticatedUser,
    fighterId: string,
  ): Promise<void> {
    if (actor.role === USER.FIGHTER) {
      const activeFighterId = await this.repo.findActiveFighterIdByUserId(
        actor.id,
      );
      if (activeFighterId !== fighterId) throw forbidden();
    } else if (actor.role === USER.COACH) {
      const isAssigned = await this.repo.isCoachAssignedToFighter(
        actor.id,
        fighterId,
      );
      if (!isAssigned) throw forbidden();
    } else if (actor.role === USER.DOCTOR) {
      const isAssigned = await this.repo.isDoctorAssignedToFighter(
        actor.id,
        fighterId,
      );
      if (!isAssigned) throw forbidden();
    }
  }

  // --- Plans ---

  async listPlans(actor: AuthenticatedUser, query: ListPlansQuery) {
    const scopedQuery = { ...query };
    let activeCoachId: string | undefined;

    if (actor.role === USER.FIGHTER) {
      const activeFighterId = await this.repo.findActiveFighterIdByUserId(
        actor.id,
      );
      if (!activeFighterId) throw forbidden();
      scopedQuery.fighterId = activeFighterId;
    } else if (actor.role === USER.COACH) {
      if (scopedQuery.coachId) {
        const owns = await this.repo.isCoachProfileOwnedByUser(
          actor.id,
          scopedQuery.coachId,
        );
        if (!owns) throw forbidden();
        activeCoachId = scopedQuery.coachId;
      } else {
        const coachId = await this.repo.findActiveCoachIdByUserId(actor.id);
        if (!coachId) throw forbidden();
        scopedQuery.coachId = coachId;
        activeCoachId = coachId;
      }
    } else if (actor.role === USER.DOCTOR && !scopedQuery.fighterId) {
      throw fighterScopeRequired();
    }

    if (scopedQuery.fighterId) {
      await this.assertFighterAccess(actor, scopedQuery.fighterId);
    }

    try {
      const result = await this.repo.findPlans(scopedQuery, { activeCoachId });
      return {
        ...result,
        hasNextPage: scopedQuery.page * scopedQuery.limit < result.total,
      };
    } catch (error) {
      throw mapTrainingPersistenceError(error);
    }
  }

  async getPlanById(actor: AuthenticatedUser, id: string) {
    try {
      const plan = await this.repo.findPlanById(id);
      if (!plan) throw planNotFound();

      await this.assertFighterAccess(actor, plan.fighterId);

      const progress = await this.repo.getPlanProgress(id);
      let completionPercentage = 0;
      if (progress.totalSessions > 0) {
        completionPercentage = Math.round(
          (progress.completedSessions / progress.totalSessions) * 100,
        );
      }

      return {
        ...plan,
        progress: {
          ...progress,
          completionPercentage,
        },
      };
    } catch (error) {
      throw mapTrainingPersistenceError(error);
    }
  }

  async createPlan(actor: AuthenticatedUser, data: CreatePlanInput) {
    await this.assertFighterAccess(actor, data.fighterId);
    if (data.endDate && new Date(data.endDate) < new Date(data.startDate)) {
      throw invalidPlanDateRange();
    }

    if (actor.role === USER.COACH && data.coachId) {
      const owns = await this.repo.isCoachProfileOwnedByUser(
        actor.id,
        data.coachId,
      );
      if (!owns) throw forbidden();
    }

    try {
      return await this.repo.createPlan(data);
    } catch (error) {
      throw mapTrainingPersistenceError(error);
    }
  }

  async updatePlan(
    actor: AuthenticatedUser,
    id: string,
    data: UpdatePlanInput,
  ) {
    try {
      const existing = await this.repo.findPlanById(id);
      if (!existing) throw planNotFound();
      await this.assertFighterAccess(actor, existing.fighterId);

      const nextStartDate = data.startDate ?? existing.startDate;
      const nextEndDate =
        data.endDate === undefined ? existing.endDate : data.endDate;
      if (nextEndDate && nextEndDate < nextStartDate) {
        throw invalidPlanDateRange();
      }

      const updated = await this.repo.updatePlan(id, data);
      if (!updated) throw planNotFound();
      return updated;
    } catch (error) {
      throw mapTrainingPersistenceError(error);
    }
  }

  async updatePlanStatus(
    actor: AuthenticatedUser,
    id: string,
    newStatus: TrainingPlanStatusType,
  ) {
    try {
      const existing = await this.repo.findPlanById(id);
      if (!existing) throw planNotFound();
      await this.assertFighterAccess(actor, existing.fighterId);

      const updated = await this.repo.updatePlanStatus(
        id,
        existing.status,
        newStatus,
      );
      if (!updated) {
        throw planStateConflict();
      }
      return updated;
    } catch (error) {
      throw mapTrainingPersistenceError(error);
    }
  }

  // --- Sessions ---

  async listSessions(actor: AuthenticatedUser, query: ListSessionsQuery) {
    const scopedQuery = { ...query };
    let activeCoachId: string | undefined;

    if (actor.role === USER.FIGHTER) {
      const activeFighterId = await this.repo.findActiveFighterIdByUserId(
        actor.id,
      );
      if (!activeFighterId) throw forbidden();
      scopedQuery.fighterId = activeFighterId;
    } else if (actor.role === USER.COACH) {
      if (scopedQuery.coachId) {
        const owns = await this.repo.isCoachProfileOwnedByUser(
          actor.id,
          scopedQuery.coachId,
        );
        if (!owns) throw forbidden();
        activeCoachId = scopedQuery.coachId;
      } else {
        const coachId = await this.repo.findActiveCoachIdByUserId(actor.id);
        if (!coachId) throw forbidden();
        scopedQuery.coachId = coachId;
        activeCoachId = coachId;
      }
    } else if (actor.role === USER.DOCTOR && !scopedQuery.fighterId) {
      throw fighterScopeRequired();
    }

    if (scopedQuery.fighterId) {
      await this.assertFighterAccess(actor, scopedQuery.fighterId);
    }

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
      await this.assertFighterAccess(actor, session.fighterId);
      return session;
    } catch (error) {
      throw mapTrainingPersistenceError(error);
    }
  }

  async createSession(actor: AuthenticatedUser, data: CreateSessionInput) {
    await this.assertFighterAccess(actor, data.fighterId);

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
    try {
      const existing = await this.repo.findSessionById(id);
      if (!existing) throw sessionNotFound();
      await this.assertFighterAccess(actor, existing.fighterId);

      const updated = await this.repo.updateSession(id, data);
      if (!updated) throw sessionNotFound();
      return updated;
    } catch (error) {
      throw mapTrainingPersistenceError(error);
    }
  }

  async updateSessionStatus(
    actor: AuthenticatedUser,
    id: string,
    newStatus: SessionStatusType,
  ) {
    try {
      const session = await this.repo.findSessionById(id);
      if (!session) throw sessionNotFound();
      await this.assertFighterAccess(actor, session.fighterId);

      const currentStatus = session.status;
      if (currentStatus === newStatus) return session;

      const allowedTransitions: Partial<
        Record<SessionStatusType, readonly SessionStatusType[]>
      > = {
        SCHEDULED: ['IN_PROGRESS', 'CANCELLED', 'SKIPPED'],
        IN_PROGRESS: ['COMPLETED', 'ABANDONED'],
      };

      if (!allowedTransitions[currentStatus]?.includes(newStatus)) {
        throw invalidSessionStatusTransition(currentStatus, newStatus);
      }

      const updated = await this.repo.updateSessionStatus(
        id,
        currentStatus,
        newStatus,
        new Date(),
      );
      if (!updated) {
        throw sessionStateConflict();
      }
      return updated;
    } catch (error) {
      throw mapTrainingPersistenceError(error);
    }
  }

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
      await this.assertFighterAccess(actor, scopedQuery.fighterId);
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
    await this.assertFighterAccess(actor, data.fighterId);

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

  // --- Exercises ---

  async listExercises(query: ListExercisesQuery) {
    try {
      const result = await this.repo.findExercises(query);
      return {
        ...result,
        hasNextPage: query.page * query.limit < result.total,
      };
    } catch (error) {
      throw mapTrainingPersistenceError(error);
    }
  }

  async getExerciseById(id: string) {
    try {
      const exercise = await this.repo.findExerciseById(id);
      if (!exercise) throw exerciseNotFound();
      return exercise;
    } catch (error) {
      throw mapTrainingPersistenceError(error);
    }
  }

  async createExercise(data: CreateExerciseInput) {
    try {
      return await this.repo.createExercise(data);
    } catch (error) {
      throw mapTrainingPersistenceError(error);
    }
  }

  async updateExercise(id: string, data: UpdateExerciseInput) {
    try {
      const updated = await this.repo.updateExercise(id, data);
      if (!updated) throw exerciseNotFound();
      return updated;
    } catch (error) {
      throw mapTrainingPersistenceError(error);
    }
  }

  // --- Plan Exercises ---

  async listPlanExercises(actor: AuthenticatedUser, planId: string) {
    try {
      const plan = await this.repo.findPlanById(planId);
      if (!plan) throw planNotFound();
      await this.assertFighterAccess(actor, plan.fighterId);

      return await this.repo.findPlanExercises(planId);
    } catch (error) {
      throw mapTrainingPersistenceError(error);
    }
  }

  async addPlanExercise(
    actor: AuthenticatedUser,
    planId: string,
    data: CreatePlanExerciseInput,
  ) {
    try {
      const plan = await this.repo.findPlanById(planId);
      if (!plan) throw planNotFound();
      await this.assertFighterAccess(actor, plan.fighterId);

      return await this.repo.addPlanExercise({ ...data, planId });
    } catch (error) {
      throw mapTrainingPersistenceError(error);
    }
  }

  async updatePlanExercise(
    actor: AuthenticatedUser,
    planId: string,
    id: string,
    data: UpdatePlanExerciseInput,
  ) {
    try {
      const planExercise = await this.repo.findPlanExerciseById(id);
      if (!planExercise || planExercise.planId !== planId) {
        throw planExerciseNotFound();
      }

      const plan = await this.repo.findPlanById(planId);
      if (!plan) throw planNotFound();
      await this.assertFighterAccess(actor, plan.fighterId);

      const updated = await this.repo.updatePlanExercise(id, data);
      if (!updated) throw planExerciseNotFound();
      return updated;
    } catch (error) {
      throw mapTrainingPersistenceError(error);
    }
  }

  async removePlanExercise(
    actor: AuthenticatedUser,
    planId: string,
    id: string,
  ) {
    try {
      const planExercise = await this.repo.findPlanExerciseById(id);
      if (!planExercise || planExercise.planId !== planId) {
        throw planExerciseNotFound();
      }

      const plan = await this.repo.findPlanById(planId);
      if (!plan) throw planNotFound();
      await this.assertFighterAccess(actor, plan.fighterId);

      const removedId = await this.repo.removePlanExercise(id);
      if (!removedId) throw planExerciseNotFound();
      return { id: removedId };
    } catch (error) {
      throw mapTrainingPersistenceError(error);
    }
  }
}
