import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  type HttpException,
} from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import type { Mocked } from 'vitest';
import type { AuthenticatedUser } from '../../shared/models/auth-context.model.js';
import { USER } from '../../shared/types/user.role.js';
import type {
  TrainingPlanEntity,
  TrainingPlanExerciseEntity,
} from '../training.model.js';
import { TrainingRepository } from '../training.repo.js';
import { TrainingAccessService } from '../training-access.service.js';
import { TrainingPlanService } from './training-plan.service.js';

const fighterUserId = '516a01dc-f842-40e4-ae88-abca224921b7';
const coachUserId = '59d6ba46-32f2-4e67-b486-e966b2064328';
const adminUserId = 'e069ca8a-d0f1-44da-8bd5-48a60bf44b99';
const doctorUserId = '3a119889-e544-4c66-938a-4c511b184baa';
const fighterId = 'c61e6859-4a4e-4313-b762-9343270153f5';
const otherFighterId = 'a481035b-961c-4411-995d-2bd576fbb749';
const coachId = '88f97dd5-8f68-45bf-81db-4a778d30853a';
const planId = '07fe1247-ac7a-4832-9fff-77f6effa35cb';
const exerciseId = 'fc9d9ca7-b105-4650-aa80-e96872159309';
const planExerciseId = '50ee2921-819a-4d0e-b8b1-813251da83a4';
const now = '2026-09-17T10:00:00.000Z';

const fighterActor: AuthenticatedUser = {
  id: fighterUserId,
  authSubject: 'fighter-subject',
  email: 'fighter@example.com',
  role: USER.FIGHTER,
};
const coachActor: AuthenticatedUser = {
  id: coachUserId,
  authSubject: 'coach-subject',
  email: 'coach@example.com',
  role: USER.COACH,
};
const doctorActor: AuthenticatedUser = {
  id: doctorUserId,
  authSubject: 'doctor-subject',
  email: 'doctor@example.com',
  role: USER.DOCTOR,
};
const adminActor: AuthenticatedUser = {
  id: adminUserId,
  authSubject: 'admin-subject',
  email: 'admin@example.com',
  role: USER.ADMIN,
};

const plan: TrainingPlanEntity = {
  id: planId,
  fighterId,
  coachId,
  title: 'Fight camp',
  description: null,
  startDate: '2026-09-20',
  endDate: null,
  status: 'DRAFT',
  goals: null,
  milestones: [],
  isActive: true,
  createdAt: now,
  updatedAt: now,
  deletedAt: null,
};

const planExercise: TrainingPlanExerciseEntity = {
  id: planExerciseId,
  planId,
  exerciseId,
  orderIndex: 0,
  sets: 3,
  reps: 10,
  durationSeconds: null,
  targetRpe: 7,
  coachNotes: null,
  createdAt: now,
};

function repositoryMock() {
  return {
    findActiveFighterIdByUserId: vi.fn(),
    findActiveCoachIdByUserId: vi.fn(),
    findActiveDoctorIdByUserId: vi.fn(),
    isCoachAssignedToFighter: vi.fn(),
    isDoctorAssignedToFighter: vi.fn(),
    isCoachProfileOwnedByUser: vi.fn(),
    findPlans: vi.fn(),
    findPlanById: vi.fn(),
    createPlan: vi.fn(),
    updatePlan: vi.fn(),
    updatePlanStatus: vi.fn(),
    getPlanProgress: vi.fn(),
    findPlanExercises: vi.fn(),
    findPlanExerciseById: vi.fn(),
    addPlanExercise: vi.fn(),
    updatePlanExercise: vi.fn(),
    removePlanExercise: vi.fn(),
  };
}

function responseOf(error: unknown): Record<string, unknown> {
  return (error as HttpException).getResponse() as Record<string, unknown>;
}

describe('TrainingPlanService', () => {
  let service: TrainingPlanService;
  let repo: Mocked<TrainingRepository>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TrainingPlanService,
        TrainingAccessService,
        { provide: TrainingRepository, useValue: repositoryMock() },
      ],
    }).compile();

    service = module.get(TrainingPlanService);
    repo = module.get<Mocked<TrainingRepository>>(TrainingRepository);
  });

  describe('listPlans scoping', () => {
    it('scopes coach list queries by the active coach and assignment relation', async () => {
      repo.findActiveCoachIdByUserId.mockResolvedValue(coachId);
      repo.findPlans.mockResolvedValue({ data: [], total: 21 });

      await expect(
        service.listPlans(coachActor, { page: 2, limit: 10 }),
      ).resolves.toEqual({ data: [], total: 21, hasNextPage: true });
      expect(repo.findPlans).toHaveBeenCalledWith(
        { page: 2, limit: 10, coachId },
        { activeCoachId: coachId },
      );
    });

    it('forces fighter list queries to the authenticated active profile', async () => {
      repo.findActiveFighterIdByUserId.mockResolvedValue(fighterId);
      repo.findPlans.mockResolvedValue({ data: [], total: 0 });

      await service.listPlans(fighterActor, {
        page: 1,
        limit: 20,
        fighterId: otherFighterId,
      });

      expect(repo.findPlans).toHaveBeenCalledWith(
        { page: 1, limit: 20, fighterId },
        { activeCoachId: undefined },
      );
    });

    it('denies fighter list query when fighter has no active profile', async () => {
      repo.findActiveFighterIdByUserId.mockResolvedValue(undefined);

      await expect(
        service.listPlans(fighterActor, { page: 1, limit: 20 }),
      ).rejects.toThrow(ForbiddenException);
      expect(repo.findPlans).not.toHaveBeenCalled();
    });

    it('denies coach list query when coach has no active profile', async () => {
      repo.findActiveCoachIdByUserId.mockResolvedValue(undefined);

      await expect(
        service.listPlans(coachActor, { page: 1, limit: 20 }),
      ).rejects.toThrow(ForbiddenException);
      expect(repo.findPlans).not.toHaveBeenCalled();
    });

    it('denies coach list query when specified coachId is not owned', async () => {
      repo.isCoachProfileOwnedByUser.mockResolvedValue(false);

      await expect(
        service.listPlans(coachActor, { page: 1, limit: 20, coachId: 'unowned-id' }),
      ).rejects.toThrow(ForbiddenException);
      expect(repo.findPlans).not.toHaveBeenCalled();
    });

    it('requires doctors to provide an authorized fighter scope for lists', async () => {
      await expect(
        service.listPlans(doctorActor, { page: 1, limit: 20 }),
      ).rejects.toMatchObject({ status: 400 });
      expect(repo.findPlans).not.toHaveBeenCalled();
    });

    it('computes hasNextPage correctly when on last page', async () => {
      repo.findActiveCoachIdByUserId.mockResolvedValue(coachId);
      repo.findPlans.mockResolvedValue({ data: [], total: 20 });

      const res = await service.listPlans(coachActor, { page: 2, limit: 10 });
      expect(res.hasNextPage).toBe(false);
    });
  });

  describe('getPlanById', () => {
    it('computes plan progress after authorizing the fighter', async () => {
      repo.findPlanById.mockResolvedValue(plan);
      repo.findActiveFighterIdByUserId.mockResolvedValue(fighterId);
      repo.getPlanProgress.mockResolvedValue({
        totalSessions: 3,
        completedSessions: 2,
      });

      await expect(service.getPlanById(fighterActor, planId)).resolves.toEqual({
        ...plan,
        progress: {
          totalSessions: 3,
          completedSessions: 2,
          completionPercentage: 67,
        },
      });
    });

    it('denies a fighter attempting to access another fighter resource', async () => {
      repo.findPlanById.mockResolvedValue({ ...plan, fighterId: otherFighterId });
      repo.findActiveFighterIdByUserId.mockResolvedValue(fighterId);

      await expect(service.getPlanById(fighterActor, planId)).rejects.toThrow(
        ForbiddenException,
      );
      expect(repo.getPlanProgress).not.toHaveBeenCalled();
    });

    it.each([
      [coachActor, 'isCoachAssignedToFighter'],
      [doctorActor, 'isDoctorAssignedToFighter'],
    ] as const)(
      'denies unassigned coach/doctor resource access',
      async (actor, assignmentMethod) => {
        repo.findPlanById.mockResolvedValue(plan);
        repo[assignmentMethod].mockResolvedValue(false);

        await expect(service.getPlanById(actor, planId)).rejects.toThrow(
          ForbiddenException,
        );
        expect(repo.getPlanProgress).not.toHaveBeenCalled();
      },
    );

    it('throws 404 when plan does not exist', async () => {
      repo.findPlanById.mockResolvedValue(undefined);

      await expect(service.getPlanById(adminActor, planId)).rejects.toMatchObject({
        status: 404,
      });
    });
  });

  describe('createPlan', () => {
    it('creates a plan for admin', async () => {
      repo.createPlan.mockResolvedValue(plan);

      await expect(
        service.createPlan(adminActor, {
          fighterId,
          coachId,
          title: 'Fight camp',
          startDate: '2026-09-20',
          milestones: [],
        }),
      ).resolves.toEqual(plan);
    });

    it('rejects invalid date range (endDate < startDate)', async () => {
      await expect(
        service.createPlan(adminActor, {
          fighterId,
          coachId,
          title: 'Fight camp',
          startDate: '2026-09-20',
          endDate: '2026-09-19',
          milestones: [],
        }),
      ).rejects.toThrow(BadRequestException);
      expect(repo.createPlan).not.toHaveBeenCalled();
    });

    it('validates coach ownership when coach creates plan', async () => {
      repo.isCoachProfileOwnedByUser.mockResolvedValue(false);

      await expect(
        service.createPlan(coachActor, {
          fighterId,
          coachId,
          title: 'Fight camp',
          startDate: '2026-09-20',
          milestones: [],
        }),
      ).rejects.toThrow(ForbiddenException);
      expect(repo.createPlan).not.toHaveBeenCalled();
    });
  });

  describe('updatePlan', () => {
    it('rejects a plan update whose merged dates are invalid', async () => {
      repo.findPlanById.mockResolvedValue({
        ...plan,
        startDate: '2026-09-20',
        endDate: '2026-09-30',
      });

      await expect(
        service.updatePlan(adminActor, planId, { endDate: '2026-09-19' }),
      ).rejects.toThrow(BadRequestException);
      expect(repo.updatePlan).not.toHaveBeenCalled();
    });

    it('updates plan successfully', async () => {
      const updated = { ...plan, title: 'New Title' };
      repo.findPlanById.mockResolvedValue(plan);
      repo.updatePlan.mockResolvedValue(updated);

      await expect(
        service.updatePlan(adminActor, planId, { title: 'New Title' }),
      ).resolves.toEqual(updated);
      expect(repo.updatePlan).toHaveBeenCalledWith(planId, { title: 'New Title' });
    });
  });

  describe('updatePlanStatus', () => {
    it('reports a plan state conflict when the conditional update loses a race', async () => {
      repo.findPlanById.mockResolvedValue(plan);
      repo.updatePlanStatus.mockResolvedValue(undefined);

      await expect(
        service.updatePlanStatus(adminActor, planId, 'ACTIVE'),
      ).rejects.toSatisfy(
        (error: unknown) =>
          error instanceof ConflictException &&
          responseOf(error).code === 'PLAN_STATE_CONFLICT',
      );
      expect(repo.updatePlanStatus).toHaveBeenCalledWith(
        planId,
        'DRAFT',
        'ACTIVE',
      );
    });

    describe('plan status transitions', () => {
      it.each([
        ['COMPLETED', 'DRAFT'],
        ['CANCELLED', 'DRAFT'],
      ] as const)(
        'rejects transition from %s to %s with 400 INVALID_PLAN_STATUS_TRANSITION (not 409)',
        async (fromStatus, toStatus) => {
          repo.findPlanById.mockResolvedValue({ ...plan, status: fromStatus });

          await expect(
            service.updatePlanStatus(adminActor, planId, toStatus),
          ).rejects.toSatisfy((error: unknown) => {
            const resp = responseOf(error);
            return (
              (error as HttpException).getStatus() === 400 &&
              resp.code === 'INVALID_PLAN_STATUS_TRANSITION'
            );
          });
          expect(repo.updatePlanStatus).not.toHaveBeenCalled();
        },
      );

      it.each([
        ['DRAFT', 'ACTIVE'],
        ['ACTIVE', 'COMPLETED'],
        ['ACTIVE', 'CANCELLED'],
        ['DRAFT', 'CANCELLED'],
        ['COMPLETED', 'ACTIVE'],
        ['CANCELLED', 'ACTIVE'],
      ] as const)(
        'allows valid plan transition from %s to %s',
        async (fromStatus, toStatus) => {
          const updatedPlan = { ...plan, status: toStatus };
          repo.findPlanById.mockResolvedValue({ ...plan, status: fromStatus });
          repo.updatePlanStatus.mockResolvedValue(updatedPlan);

          await expect(
            service.updatePlanStatus(adminActor, planId, toStatus),
          ).resolves.toEqual(updatedPlan);
          expect(repo.updatePlanStatus).toHaveBeenCalledWith(
            planId,
            fromStatus,
            toStatus,
          );
        },
      );

      it.each(['DRAFT', 'ACTIVE', 'COMPLETED', 'CANCELLED'] as const)(
        'returns updated plan for same-status request (%s -> %s)',
        async (status) => {
          const samePlan = { ...plan, status };
          repo.findPlanById.mockResolvedValue(samePlan);
          repo.updatePlanStatus.mockResolvedValue(samePlan);

          await expect(
            service.updatePlanStatus(adminActor, planId, status),
          ).resolves.toEqual(samePlan);
          expect(repo.updatePlanStatus).toHaveBeenCalledWith(
            planId,
            status,
            status,
          );
        },
      );
    });
  });

  describe('plan exercises', () => {
    it('lists plan exercises after authorizing access', async () => {
      repo.findPlanById.mockResolvedValue(plan);
      repo.findPlanExercises.mockResolvedValue([planExercise]);

      await expect(
        service.listPlanExercises(adminActor, planId),
      ).resolves.toEqual([planExercise]);
    });

    it('adds plan exercise after authorizing access', async () => {
      repo.findPlanById.mockResolvedValue(plan);
      repo.addPlanExercise.mockResolvedValue(planExercise);

      await expect(
        service.addPlanExercise(adminActor, planId, {
          exerciseId,
          orderIndex: 0,
        }),
      ).resolves.toEqual(planExercise);
      expect(repo.addPlanExercise).toHaveBeenCalledWith({
        exerciseId,
        orderIndex: 0,
        planId,
      });
    });

    it('rejects a nested exercise ID that belongs to another plan', async () => {
      repo.findPlanExerciseById.mockResolvedValue({
        ...planExercise,
        planId: 'a50dc41f-1ed1-4eb5-b31b-bb327ad0bba8',
      });

      await expect(
        service.updatePlanExercise(adminActor, planId, planExerciseId, {
          sets: 4,
        }),
      ).rejects.toSatisfy(
        (error: unknown) => responseOf(error).code === 'PLAN_EXERCISE_NOT_FOUND',
      );
      expect(repo.findPlanById).not.toHaveBeenCalled();
      expect(repo.updatePlanExercise).not.toHaveBeenCalled();
    });

    it('returns the deleted plan-exercise identifier', async () => {
      repo.findPlanExerciseById.mockResolvedValue(planExercise);
      repo.findPlanById.mockResolvedValue(plan);
      repo.removePlanExercise.mockResolvedValue(planExerciseId);

      await expect(
        service.removePlanExercise(adminActor, planId, planExerciseId),
      ).resolves.toEqual({ id: planExerciseId });
    });
  });

  describe('DOCTOR write prohibition', () => {
    it('still rejects DOCTOR writes even if individual permissions exist (domain-level role check)', async () => {
      await expect(
        service.createPlan(doctorActor, {
          fighterId,
          coachId,
          title: 'Plan',
          startDate: '2026-09-20',
          milestones: [],
        }),
      ).rejects.toSatisfy(
        (err: unknown) =>
          err instanceof ForbiddenException &&
          (err.getResponse() as Record<string, unknown>).message ===
            'You are not allowed to perform this action',
      );
      expect(repo.createPlan).not.toHaveBeenCalled();
    });

    it('rejects POST /training-plans (createPlan) for DOCTOR before repo read', async () => {
      await expect(
        service.createPlan(doctorActor, {
          fighterId,
          coachId,
          title: 'Plan',
          startDate: '2026-09-20',
          milestones: [],
        }),
      ).rejects.toThrow(ForbiddenException);
      expect(repo.findPlanById).not.toHaveBeenCalled();
      expect(repo.createPlan).not.toHaveBeenCalled();
    });

    it('rejects PATCH /training-plans/:id (updatePlan) for DOCTOR before repo read', async () => {
      await expect(
        service.updatePlan(doctorActor, 'non-existent-id', { title: 'Updated' }),
      ).rejects.toThrow(ForbiddenException);
      expect(repo.findPlanById).not.toHaveBeenCalled();
      expect(repo.updatePlan).not.toHaveBeenCalled();
    });

    it('rejects PATCH /training-plans/:id/status (updatePlanStatus) for DOCTOR before repo read', async () => {
      await expect(
        service.updatePlanStatus(doctorActor, 'non-existent-id', 'ACTIVE'),
      ).rejects.toThrow(ForbiddenException);
      expect(repo.findPlanById).not.toHaveBeenCalled();
      expect(repo.updatePlanStatus).not.toHaveBeenCalled();
    });

    it('rejects POST /training-plans/:id/exercises (addPlanExercise) for DOCTOR before repo read', async () => {
      await expect(
        service.addPlanExercise(doctorActor, 'non-existent-id', {
          exerciseId,
          orderIndex: 0,
        }),
      ).rejects.toThrow(ForbiddenException);
      expect(repo.findPlanById).not.toHaveBeenCalled();
      expect(repo.addPlanExercise).not.toHaveBeenCalled();
    });

    it('rejects PATCH /training-plans/:id/exercises/:exerciseId (updatePlanExercise) for DOCTOR before repo read', async () => {
      await expect(
        service.updatePlanExercise(doctorActor, 'non-existent-id', 'ex-id', {
          sets: 5,
        }),
      ).rejects.toThrow(ForbiddenException);
      expect(repo.findPlanExerciseById).not.toHaveBeenCalled();
      expect(repo.updatePlanExercise).not.toHaveBeenCalled();
    });

    it('rejects DELETE /training-plans/:id/exercises/:exerciseId (removePlanExercise) for DOCTOR before repo read', async () => {
      await expect(
        service.removePlanExercise(doctorActor, 'non-existent-id', 'ex-id'),
      ).rejects.toThrow(ForbiddenException);
      expect(repo.findPlanExerciseById).not.toHaveBeenCalled();
      expect(repo.removePlanExercise).not.toHaveBeenCalled();
    });

    it('allows DOCTOR to perform reads when scoped to an assigned fighter', async () => {
      repo.findPlanById.mockResolvedValue(plan);
      repo.isDoctorAssignedToFighter.mockResolvedValue(true);
      repo.getPlanProgress.mockResolvedValue({ totalSessions: 0, completedSessions: 0 });

      await expect(service.getPlanById(doctorActor, planId)).resolves.toMatchObject({
        id: planId,
      });
    });
  });
});

