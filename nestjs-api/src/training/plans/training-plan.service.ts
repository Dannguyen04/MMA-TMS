import { Inject, Injectable } from '@nestjs/common';
import {
  NOTIFICATION_PUBLISHER,
  NOTIFICATION_TARGET,
  NOTIFICATION_TYPE,
  type NotificationPublisher,
} from '../../shared/contracts/notification.contract.js';
import { TrainingRepository } from '../training.repo.js';
import { TrainingAccessService } from '../training-access.service.js';
import {
  planNotFound,
  invalidPlanStatusTransition,
  mapTrainingPersistenceError,
  planExerciseNotFound,
  invalidPlanDateRange,
  planStateConflict,
} from '../training.error.js';
import type {
  CreatePlanInput,
  UpdatePlanInput,
  CreatePlanExerciseInput,
  UpdatePlanExerciseInput,
  ListPlansQuery,
  TrainingPlanEntity,
  TrainingPlanStatusType,
} from '../training.model.js';
import type { AuthenticatedUser } from '../../shared/models/auth-context.model.js';
import { USER } from '../../shared/types/user.role.js';
import { forbidden } from '../../shared/errors/access.error.js';
import {
  FORBIDDEN_PLAN_TRANSITIONS,
  TRAINING_NOTIFICATION_TEXT,
} from '../training.constants.js';

@Injectable()
export class TrainingPlanService {
  constructor(
    private readonly repo: TrainingRepository,
    private readonly access: TrainingAccessService,
    @Inject(NOTIFICATION_PUBLISHER)
    private readonly notifications: NotificationPublisher,
  ) {}

  async listPlans(actor: AuthenticatedUser, query: ListPlansQuery) {
    const { scopedQuery, activeCoachId } = await this.access.scopeListQuery(
      actor,
      query,
    );

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

      await this.access.assertFighterAccess(actor, plan.fighterId);

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
    this.access.assertTrainingWriteAllowed(actor);
    await this.access.assertFighterAccess(actor, data.fighterId);
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

  async updatePlan(actor: AuthenticatedUser, id: string, data: UpdatePlanInput) {
    this.access.assertTrainingWriteAllowed(actor);
    try {
      const existing = await this.repo.findPlanById(id);
      if (!existing) throw planNotFound();
      await this.access.assertFighterAccess(actor, existing.fighterId);

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
    this.access.assertTrainingWriteAllowed(actor);
    let previousStatus: TrainingPlanStatusType;
    let updated: TrainingPlanEntity;
    try {
      const existing = await this.repo.findPlanById(id);
      if (!existing) throw planNotFound();
      await this.access.assertFighterAccess(actor, existing.fighterId);

      // Invalid intent (400) is decided before the conditional update, so it
      // is never reported as the 409 that signals a concurrent modification.
      if (FORBIDDEN_PLAN_TRANSITIONS[existing.status]?.includes(newStatus)) {
        throw invalidPlanStatusTransition(existing.status, newStatus);
      }

      const result = await this.repo.updatePlanStatus(
        id,
        existing.status,
        newStatus,
      );
      if (!result) {
        throw planStateConflict();
      }
      previousStatus = existing.status;
      updated = result;
    } catch (error) {
      throw mapTrainingPersistenceError(error);
    }

    // T2: only a real transition into ACTIVE (never a same-status request or
    // a DRAFT save). The conditional update above already committed.
    if (previousStatus !== 'ACTIVE' && updated.status === 'ACTIVE') {
      await this.notifyPlanActivated(actor, updated);
    }
    return updated;
  }

  private notifyPlanActivated(
    actor: AuthenticatedUser,
    plan: TrainingPlanEntity,
  ) {
    return this.notifications.notifyResolved(async () => [
      {
        recipientUserIds: await this.repo.findParticipantUserIds(
          plan.fighterId,
          null,
        ),
        actorUserId: actor.id,
        type: NOTIFICATION_TYPE.TRAINING_PLAN_ACTIVATED,
        ...TRAINING_NOTIFICATION_TEXT.PLAN_ACTIVATED,
        target: { type: NOTIFICATION_TARGET.TRAINING_PLAN, id: plan.id },
        // updatedAt is the revision written by this transition, so a later
        // re-activation is a distinct event.
        dedupeKey: `plan:${plan.id}:activated:${plan.updatedAt}`,
      },
    ]);
  }

  // --- Plan Exercises ---

  async listPlanExercises(actor: AuthenticatedUser, planId: string) {
    try {
      const plan = await this.repo.findPlanById(planId);
      if (!plan) throw planNotFound();
      await this.access.assertFighterAccess(actor, plan.fighterId);

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
    this.access.assertTrainingWriteAllowed(actor);
    try {
      const plan = await this.repo.findPlanById(planId);
      if (!plan) throw planNotFound();
      await this.access.assertFighterAccess(actor, plan.fighterId);

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
    this.access.assertTrainingWriteAllowed(actor);
    try {
      const planExercise = await this.repo.findPlanExerciseById(id);
      if (!planExercise || planExercise.planId !== planId) {
        throw planExerciseNotFound();
      }

      const plan = await this.repo.findPlanById(planId);
      if (!plan) throw planNotFound();
      await this.access.assertFighterAccess(actor, plan.fighterId);

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
    this.access.assertTrainingWriteAllowed(actor);
    try {
      const planExercise = await this.repo.findPlanExerciseById(id);
      if (!planExercise || planExercise.planId !== planId) {
        throw planExerciseNotFound();
      }

      const plan = await this.repo.findPlanById(planId);
      if (!plan) throw planNotFound();
      await this.access.assertFighterAccess(actor, plan.fighterId);

      const removedId = await this.repo.removePlanExercise(id);
      if (!removedId) throw planExerciseNotFound();
      return { id: removedId };
    } catch (error) {
      throw mapTrainingPersistenceError(error);
    }
  }
}
