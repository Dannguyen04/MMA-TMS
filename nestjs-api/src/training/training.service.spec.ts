import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  type HttpException,
} from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import type { Mocked } from 'vitest';
import type { AuthenticatedUser } from '../shared/models/auth-context.model.js';
import { USER } from '../shared/types/user.role.js';
import type {
  TrainingPlanEntity,
  TrainingPlanExerciseEntity,
  TrainingSessionEntity,
} from './training.model.js';
import { TrainingRepository } from './training.repo.js';
import { TrainingService } from './training.service.js';

const fighterUserId = '516a01dc-f842-40e4-ae88-abca224921b7';
const coachUserId = '59d6ba46-32f2-4e67-b486-e966b2064328';
const adminUserId = 'e069ca8a-d0f1-44da-8bd5-48a60bf44b99';
const doctorUserId = '3a119889-e544-4c66-938a-4c511b184baa';
const fighterId = 'c61e6859-4a4e-4313-b762-9343270153f5';
const otherFighterId = 'a481035b-961c-4411-995d-2bd576fbb749';
const coachId = '88f97dd5-8f68-45bf-81db-4a778d30853a';
const planId = '07fe1247-ac7a-4832-9fff-77f6effa35cb';
const sessionId = '51c38f60-0f4e-48aa-848b-20f5ef828f57';
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

const session: TrainingSessionEntity = {
  id: sessionId,
  fighterId,
  coachId,
  planId,
  title: 'Pad work',
  scheduledAt: now,
  plannedDurationSec: 3600,
  actualDurationSec: null,
  roundCount: 5,
  location: null,
  sessionType: 'PAD_WORK',
  status: 'SCHEDULED',
  coachNotes: null,
  cancellationReason: null,
  checkedInAt: null,
  completedAt: null,
  abandonedAt: null,
  skippedAt: null,
  reportedRpe: null,
  isActive: true,
  createdAt: now,
  updatedAt: now,
  deletedAt: null,
  cancelledAt: null,
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
    findSessions: vi.fn(),
    findSessionById: vi.fn(),
    createSession: vi.fn(),
    updateSession: vi.fn(),
    updateSessionStatus: vi.fn(),
    findExercises: vi.fn(),
    findExerciseById: vi.fn(),
    createExercise: vi.fn(),
    updateExercise: vi.fn(),
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

describe('TrainingService', () => {
  let service: TrainingService;
  let repo: Mocked<TrainingRepository>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TrainingService,
        { provide: TrainingRepository, useValue: repositoryMock() },
      ],
    }).compile();

    service = module.get(TrainingService);
    repo = module.get<Mocked<TrainingRepository>>(TrainingRepository);
  });

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
    repo.findSessions.mockResolvedValue({ data: [], total: 0 });

    await service.listSessions(fighterActor, {
      page: 1,
      limit: 20,
      fighterId: otherFighterId,
    });

    expect(repo.findSessions).toHaveBeenCalledWith(
      { page: 1, limit: 20, fighterId },
      { activeCoachId: undefined },
    );
  });

  it('requires doctors to provide an authorized fighter scope for lists', async () => {
    await expect(
      service.listPlans(doctorActor, { page: 1, limit: 20 }),
    ).rejects.toMatchObject({ status: 400 });
    expect(repo.findPlans).not.toHaveBeenCalled();
  });

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

  it('reports a plan state conflict when the conditional update loses a race', async () => {
    repo.findPlanById.mockResolvedValue(plan);
    repo.updatePlanStatus.mockResolvedValue(undefined);

    await expect(
      service.updatePlanStatus(adminActor, planId, 'ACTIVE'),
    ).rejects.toThrow(ConflictException);
    expect(repo.updatePlanStatus).toHaveBeenCalledWith(
      planId,
      'DRAFT',
      'ACTIVE',
    );
  });

  it('rejects an invalid session transition without issuing an update', async () => {
    repo.findSessionById.mockResolvedValue({ ...session, status: 'COMPLETED' });
    repo.findActiveFighterIdByUserId.mockResolvedValue(fighterId);

    await expect(
      service.updateSessionStatus(fighterActor, sessionId, 'IN_PROGRESS'),
    ).rejects.toThrow(BadRequestException);
    expect(repo.updateSessionStatus).not.toHaveBeenCalled();
  });

  it('performs valid session transitions with an atomic expected status', async () => {
    const completed = { ...session, status: 'COMPLETED' as const };
    repo.findSessionById.mockResolvedValue({
      ...session,
      status: 'IN_PROGRESS',
    });
    repo.findActiveFighterIdByUserId.mockResolvedValue(fighterId);
    repo.updateSessionStatus.mockResolvedValue(completed);

    await expect(
      service.updateSessionStatus(fighterActor, sessionId, 'COMPLETED'),
    ).resolves.toEqual(completed);
    expect(repo.updateSessionStatus).toHaveBeenCalledWith(
      sessionId,
      'IN_PROGRESS',
      'COMPLETED',
      expect.any(Date),
    );
  });

  it('returns the existing session for an idempotent status request', async () => {
    repo.findSessionById.mockResolvedValue(session);
    repo.findActiveFighterIdByUserId.mockResolvedValue(fighterId);

    await expect(
      service.updateSessionStatus(fighterActor, sessionId, 'SCHEDULED'),
    ).resolves.toEqual(session);
    expect(repo.updateSessionStatus).not.toHaveBeenCalled();
  });

  it('reports a session state conflict when the conditional update loses a race', async () => {
    repo.findSessionById.mockResolvedValue({
      ...session,
      status: 'IN_PROGRESS',
    });
    repo.findActiveFighterIdByUserId.mockResolvedValue(fighterId);
    repo.updateSessionStatus.mockResolvedValue(undefined);

    await expect(
      service.updateSessionStatus(fighterActor, sessionId, 'COMPLETED'),
    ).rejects.toThrow(ConflictException);
  });

  it.each([
    [{ ...plan, isActive: false }, 'INVALID_SESSION_PLAN'],
    [{ ...plan, fighterId: otherFighterId }, 'FIGHTER_PLAN_MISMATCH'],
  ] as const)(
    'rejects a session plan that violates plan availability',
    async (selectedPlan, expectedCode) => {
      repo.findPlanById.mockResolvedValue(selectedPlan);

      await expect(
        service.createSession(adminActor, {
          fighterId,
          planId,
          title: 'Pad work',
          scheduledAt: now,
          sessionType: 'PAD_WORK',
          roundCount: 0,
        }),
      ).rejects.toSatisfy(
        (error: unknown) => responseOf(error).code === expectedCode,
      );
      expect(repo.createSession).not.toHaveBeenCalled();
    },
  );

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

  it('maps a nested database cause without leaking persistence details', async () => {
    const databaseError = Object.assign(new Error('insert failed'), {
      cause: {
        code: '23503',
        constraint: 'fk_session_plan_fighter',
        detail: 'sensitive persistence detail',
      },
    });
    repo.findPlanById.mockResolvedValue(plan);
    repo.createSession.mockRejectedValue(databaseError);

    await expect(
      service.createSession(adminActor, {
        fighterId,
        planId,
        title: 'Pad work',
        scheduledAt: now,
        sessionType: 'PAD_WORK',
        roundCount: 0,
      }),
    ).rejects.toSatisfy((error: unknown) => {
      const response = responseOf(error);
      return (
        response.code === 'INVALID_SESSION_PLAN_REFERENCE' &&
        !('detail' in response) &&
        !('constraint' in response)
      );
    });
  });
});
