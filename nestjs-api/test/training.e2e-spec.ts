import { type INestApplication } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AUTH_ACCESS_SERVICE } from '../src/shared/contracts/auth-access.contract.js';
import { REQUIRED_PERMISSIONS } from '../src/shared/decorators/auth.decorator.js';
import { ApiExceptionFilter } from '../src/shared/filters/api-exception.filter.js';
import {
  AccessTokenGuard,
  AuthorizationGuard,
} from '../src/shared/guards/auth.guard.js';
import { ApiResponseInterceptor } from '../src/shared/interceptors/api-response.interceptor.js';
import type { AuthenticatedUser } from '../src/shared/models/auth-context.model.js';
import { USER } from '../src/shared/types/user.role.js';
import { TrainingPlanController } from '../src/training/plans/training-plan.controller.js';
import { TrainingSessionController } from '../src/training/sessions/training-session.controller.js';
import { ExerciseController } from '../src/training/exercises/exercise.controller.js';
import {
  invalidPlanStatusTransition,
  planNotFound,
  planStateConflict,
  sessionStateConflict,
} from '../src/training/training.error.js';
import { forbidden } from '../src/shared/errors/access.error.js';
import { TRAINING_PERMISSIONS } from '../src/training/training.model.js';
import { TrainingPlanService } from '../src/training/plans/training-plan.service.js';
import { TrainingSessionService } from '../src/training/sessions/training-session.service.js';
import { ExerciseService } from '../src/training/exercises/exercise.service.js';

const fighterId = '516a01dc-f842-40e4-ae88-abca224921b7';
const coachId = '59d6ba46-32f2-4e67-b486-e966b2064328';
const planId = 'e069ca8a-d0f1-44da-8bd5-48a60bf44b99';
const sessionId = '3a119889-e544-4c66-938a-4c511b184baa';
const exerciseId = 'c61e6859-4a4e-4313-b762-9343270153f5';
const planExerciseId = 'a481035b-961c-4411-995d-2bd576fbb749';

const actor: AuthenticatedUser = {
  id: '88f97dd5-8f68-45bf-81db-4a778d30853a',
  authSubject: 'admin-subject',
  email: 'admin@example.com',
  role: USER.ADMIN,
};

function planServiceMock() {
  return {
    listPlans: vi.fn().mockResolvedValue({
      data: [{ id: planId }],
      total: 1,
      hasNextPage: false,
    }),
    createPlan: vi.fn().mockResolvedValue({ id: planId }),
    getPlanById: vi.fn().mockResolvedValue({ id: planId }),
    updatePlan: vi.fn().mockResolvedValue({ id: planId }),
    updatePlanStatus: vi.fn().mockResolvedValue({ id: planId }),
    listPlanExercises: vi
      .fn()
      .mockResolvedValue([{ id: planExerciseId, planId }]),
    addPlanExercise: vi.fn().mockResolvedValue({ id: planExerciseId, planId }),
    updatePlanExercise: vi
      .fn()
      .mockResolvedValue({ id: planExerciseId, planId }),
    removePlanExercise: vi.fn().mockResolvedValue({ id: planExerciseId }),
  };
}

function sessionServiceMock() {
  return {
    listSessions: vi.fn().mockResolvedValue({
      data: [{ id: sessionId }],
      total: 1,
      hasNextPage: false,
    }),
    createSession: vi.fn().mockResolvedValue({ id: sessionId }),
    getSessionById: vi.fn().mockResolvedValue({ id: sessionId }),
    updateSession: vi.fn().mockResolvedValue({ id: sessionId }),
    updateSessionStatus: vi.fn().mockResolvedValue({ id: sessionId }),
  };
}

function exerciseServiceMock() {
  return {
    listExercises: vi.fn().mockResolvedValue({
      data: [{ id: exerciseId }],
      total: 1,
      hasNextPage: false,
    }),
    createExercise: vi.fn().mockResolvedValue({ id: exerciseId }),
    getExerciseById: vi.fn().mockResolvedValue({ id: exerciseId }),
    updateExercise: vi.fn().mockResolvedValue({ id: exerciseId }),
  };
}

describe('Training controllers (e2e)', () => {
  let app: INestApplication;
  let planService: ReturnType<typeof planServiceMock>;
  let sessionService: ReturnType<typeof sessionServiceMock>;
  let exerciseService: ReturnType<typeof exerciseServiceMock>;

  const authAccessService = {
    authenticate: vi.fn().mockResolvedValue(actor),
    hasPermissions: vi.fn().mockResolvedValue(true),
  };
  const authenticated = (path: string) =>
    request(app.getHttpServer()).get(path).set('Authorization', 'Bearer token');

  beforeAll(async () => {
    planService = planServiceMock();
    sessionService = sessionServiceMock();
    exerciseService = exerciseServiceMock();

    const moduleRef = await Test.createTestingModule({
      controllers: [
        TrainingPlanController,
        TrainingSessionController,
        ExerciseController,
      ],
      providers: [
        AccessTokenGuard,
        AuthorizationGuard,
        { provide: TrainingPlanService, useValue: planService },
        { provide: TrainingSessionService, useValue: sessionService },
        { provide: ExerciseService, useValue: exerciseService },
        { provide: AUTH_ACCESS_SERVICE, useValue: authAccessService },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalFilters(new ApiExceptionFilter());
    app.useGlobalInterceptors(new ApiResponseInterceptor(app.get(Reflector)));
    await app.init();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    authAccessService.authenticate.mockResolvedValue(actor);
    authAccessService.hasPermissions.mockResolvedValue(true);
  });

  afterAll(async () => {
    await app.close();
  });

  it('declares one concrete permission for every training route', () => {
    const reflector = app.get(Reflector);
    const permissionFor = (handler: (...args: never[]) => unknown) =>
      reflector.get(REQUIRED_PERMISSIONS, handler);
    const expectations = [
      [TrainingPlanController.prototype.listPlans, TRAINING_PERMISSIONS.PLAN_GET_ALL],
      [TrainingPlanController.prototype.createPlan, TRAINING_PERMISSIONS.PLAN_CREATE],
      [TrainingPlanController.prototype.getPlan, TRAINING_PERMISSIONS.PLAN_READ],
      [TrainingPlanController.prototype.updatePlan, TRAINING_PERMISSIONS.PLAN_UPDATE],
      [
        TrainingPlanController.prototype.updatePlanStatus,
        TRAINING_PERMISSIONS.PLAN_TRANSITION,
      ],
      [
        TrainingPlanController.prototype.listPlanExercises,
        TRAINING_PERMISSIONS.PLAN_EXERCISE_READ,
      ],
      [
        TrainingPlanController.prototype.addPlanExercise,
        TRAINING_PERMISSIONS.PLAN_EXERCISE_CREATE,
      ],
      [
        TrainingPlanController.prototype.updatePlanExercise,
        TRAINING_PERMISSIONS.PLAN_EXERCISE_UPDATE,
      ],
      [
        TrainingPlanController.prototype.removePlanExercise,
        TRAINING_PERMISSIONS.PLAN_EXERCISE_DELETE,
      ],
      [
        TrainingSessionController.prototype.listSessions,
        TRAINING_PERMISSIONS.SESSION_GET_ALL,
      ],
      [
        TrainingSessionController.prototype.createSession,
        TRAINING_PERMISSIONS.SESSION_CREATE,
      ],
      [
        TrainingSessionController.prototype.getSession,
        TRAINING_PERMISSIONS.SESSION_READ,
      ],
      [
        TrainingSessionController.prototype.updateSession,
        TRAINING_PERMISSIONS.SESSION_UPDATE,
      ],
      [
        TrainingSessionController.prototype.updateSessionStatus,
        TRAINING_PERMISSIONS.SESSION_TRANSITION,
      ],
      [
        ExerciseController.prototype.listExercises,
        TRAINING_PERMISSIONS.EXERCISE_GET_ALL,
      ],
      [
        ExerciseController.prototype.getExercise,
        TRAINING_PERMISSIONS.EXERCISE_READ,
      ],
      [
        ExerciseController.prototype.createExercise,
        TRAINING_PERMISSIONS.EXERCISE_CREATE,
      ],
      [
        ExerciseController.prototype.updateExercise,
        TRAINING_PERMISSIONS.EXERCISE_UPDATE,
      ],
    ] as const;

    for (const [handler, permission] of expectations) {
      expect(permissionFor(handler)).toEqual({ allOf: [permission] });
    }
  });

  it('requires a bearer token before invoking a training use case', async () => {
    const response = await request(app.getHttpServer()).get('/training-plans');

    expect(response.status).toBe(401);
    expect(response.body.error).toMatchObject({
      statusCode: 401,
      code: 'AUTHENTICATION_REQUIRED',
    });
    expect(planService.listPlans).not.toHaveBeenCalled();
  });

  it('enforces route permission metadata before invoking the service', async () => {
    authAccessService.hasPermissions.mockResolvedValueOnce(false);

    const response = await authenticated('/training-sessions');

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
    expect(authAccessService.hasPermissions).toHaveBeenCalledWith(actor, {
      allOf: [TRAINING_PERMISSIONS.SESSION_GET_ALL],
    });
    expect(sessionService.listSessions).not.toHaveBeenCalled();
  });

  it('serves all training-plan routes with validated inputs and envelopes', async () => {
    const list = await authenticated(
      `/training-plans?page=2&limit=10&fighterId=${fighterId}&isActive=false`,
    );
    expect(list.status).toBe(200);
    expect(list.body).toMatchObject({
      success: true,
      message: 'Get training plans successfully',
      data: { total: 1, hasNextPage: false },
    });
    expect(planService.listPlans).toHaveBeenCalledWith(actor, {
      page: 2,
      limit: 10,
      fighterId,
      isActive: false,
    });

    const created = await request(app.getHttpServer())
      .post('/training-plans')
      .set('Authorization', 'Bearer token')
      .send({
        fighterId,
        coachId,
        title: 'Fight camp',
        startDate: '2026-09-20',
      });
    expect(created.status).toBe(201);
    expect(created.body.message).toBe('Create training plan successfully');
    expect(planService.createPlan).toHaveBeenCalledWith(actor, {
      fighterId,
      coachId,
      title: 'Fight camp',
      startDate: '2026-09-20',
      milestones: [],
    });

    expect((await authenticated(`/training-plans/${planId}`)).status).toBe(200);

    const updated = await request(app.getHttpServer())
      .patch(`/training-plans/${planId}`)
      .set('Authorization', 'Bearer token')
      .send({ title: 'Updated camp' });
    expect(updated.status).toBe(200);
    expect(planService.updatePlan).toHaveBeenCalledWith(actor, planId, {
      title: 'Updated camp',
    });

    const transitioned = await request(app.getHttpServer())
      .patch(`/training-plans/${planId}/status`)
      .set('Authorization', 'Bearer token')
      .send({ status: 'ACTIVE' });
    expect(transitioned.status).toBe(200);
    expect(planService.updatePlanStatus).toHaveBeenCalledWith(
      actor,
      planId,
      'ACTIVE',
    );

    expect(
      (await authenticated(`/training-plans/${planId}/exercises`)).status,
    ).toBe(200);

    const added = await request(app.getHttpServer())
      .post(`/training-plans/${planId}/exercises`)
      .set('Authorization', 'Bearer token')
      .send({ exerciseId, orderIndex: 0 });
    expect(added.status).toBe(201);
    expect(planService.addPlanExercise).toHaveBeenCalledWith(
      actor,
      planId,
      { exerciseId, orderIndex: 0 },
    );

    const exerciseUpdated = await request(app.getHttpServer())
      .patch(`/training-plans/${planId}/exercises/${planExerciseId}`)
      .set('Authorization', 'Bearer token')
      .send({ sets: 4 });
    expect(exerciseUpdated.status).toBe(200);
    expect(planService.updatePlanExercise).toHaveBeenCalledWith(
      actor,
      planId,
      planExerciseId,
      { sets: 4 },
    );

    const removed = await request(app.getHttpServer())
      .delete(`/training-plans/${planId}/exercises/${planExerciseId}`)
      .set('Authorization', 'Bearer token');
    expect(removed.status).toBe(200);
    expect(removed.body).toMatchObject({
      success: true,
      message: 'Remove training plan exercise successfully',
      data: { id: planExerciseId },
    });
  });

  it('serves all training-session routes with validated inputs', async () => {
    const list = await authenticated(
      `/training-sessions?page=1&limit=5&fighterId=${fighterId}&status=SCHEDULED`,
    );
    expect(list.status).toBe(200);
    expect(sessionService.listSessions).toHaveBeenCalledWith(actor, {
      page: 1,
      limit: 5,
      fighterId,
      status: 'SCHEDULED',
    });

    const created = await request(app.getHttpServer())
      .post('/training-sessions')
      .set('Authorization', 'Bearer token')
      .send({
        fighterId,
        title: 'Pad work',
        scheduledAt: '2026-09-20T10:00:00.000Z',
        sessionType: 'PAD_WORK',
      });
    expect(created.status).toBe(201);
    expect(sessionService.createSession).toHaveBeenCalledWith(actor, {
      fighterId,
      title: 'Pad work',
      scheduledAt: '2026-09-20T10:00:00.000Z',
      sessionType: 'PAD_WORK',
      roundCount: 0,
    });

    expect(
      (await authenticated(`/training-sessions/${sessionId}`)).status,
    ).toBe(200);

    const updated = await request(app.getHttpServer())
      .patch(`/training-sessions/${sessionId}`)
      .set('Authorization', 'Bearer token')
      .send({ title: 'Updated pad work' });
    expect(updated.status).toBe(200);
    expect(sessionService.updateSession).toHaveBeenCalledWith(
      actor,
      sessionId,
      { title: 'Updated pad work' },
    );

    const transitioned = await request(app.getHttpServer())
      .patch(`/training-sessions/${sessionId}/status`)
      .set('Authorization', 'Bearer token')
      .send({ status: 'IN_PROGRESS' });
    expect(transitioned.status).toBe(200);
    expect(sessionService.updateSessionStatus).toHaveBeenCalledWith(
      actor,
      sessionId,
      'IN_PROGRESS',
      undefined,
    );
  });

  it('serves all global-exercise routes with validated inputs', async () => {
    const list = await authenticated(
      '/exercises?page=1&limit=10&category=STRIKING&search=jab',
    );
    expect(list.status).toBe(200);
    expect(exerciseService.listExercises).toHaveBeenCalledWith({
      page: 1,
      limit: 10,
      category: 'STRIKING',
      search: 'jab',
    });

    const created = await request(app.getHttpServer())
      .post('/exercises')
      .set('Authorization', 'Bearer token')
      .send({ name: 'Jab', category: 'STRIKING' });
    expect(created.status).toBe(201);
    expect(exerciseService.createExercise).toHaveBeenCalledWith(actor, {
      name: 'Jab',
      category: 'STRIKING',
      targetMuscleGroups: [],
    });

    expect((await authenticated(`/exercises/${exerciseId}`)).status).toBe(200);

    const updated = await request(app.getHttpServer())
      .patch(`/exercises/${exerciseId}`)
      .set('Authorization', 'Bearer token')
      .send({ name: 'Cross' });
    expect(updated.status).toBe(200);
    expect(exerciseService.updateExercise).toHaveBeenCalledWith(
      actor,
      exerciseId,
      {
        name: 'Cross',
      },
    );
  });

  it.each([
    ['/training-plans/not-a-uuid', 'get'],
    ['/training-plans?isActive=yes', 'get'],
    [`/training-sessions/${sessionId}`, 'patch'],
    [`/exercises/${exerciseId}`, 'patch'],
  ] as const)('rejects invalid input for %s', async (path, method) => {
    const builder = request(app.getHttpServer())
      [method](path)
      .set('Authorization', 'Bearer token');
    const response =
      method === 'patch' ? await builder.send({}) : await builder;

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns stable 404 and 409 domain error envelopes', async () => {
    planService.getPlanById.mockRejectedValueOnce(planNotFound());
    const missing = await authenticated(`/training-plans/${planId}`);
    expect(missing.status).toBe(404);
    expect(missing.body).toEqual({
      success: false,
      error: expect.objectContaining({
        statusCode: 404,
        code: 'TRAINING_PLAN_NOT_FOUND',
      }),
    });

    sessionService.updateSessionStatus.mockRejectedValueOnce(
      sessionStateConflict(),
    );
    const conflict = await request(app.getHttpServer())
      .patch(`/training-sessions/${sessionId}/status`)
      .set('Authorization', 'Bearer token')
      .send({ status: 'COMPLETED' });
    expect(conflict.status).toBe(409);
    expect(conflict.body.error).toMatchObject({
      statusCode: 409,
      code: 'SESSION_STATE_CONFLICT',
    });

    planService.updatePlanStatus.mockRejectedValueOnce(planStateConflict());
    const planConflict = await request(app.getHttpServer())
      .patch(`/training-plans/${planId}/status`)
      .set('Authorization', 'Bearer token')
      .send({ status: 'ACTIVE' });
    expect(planConflict.status).toBe(409);
    expect(planConflict.body.error).toMatchObject({
      statusCode: 409,
      code: 'PLAN_STATE_CONFLICT',
    });

    planService.updatePlanStatus.mockRejectedValueOnce(
      invalidPlanStatusTransition('COMPLETED', 'DRAFT'),
    );
    const planTransitionError = await request(app.getHttpServer())
      .patch(`/training-plans/${planId}/status`)
      .set('Authorization', 'Bearer token')
      .send({ status: 'DRAFT' });
    expect(planTransitionError.status).toBe(400);
    expect(planTransitionError.body.error).toMatchObject({
      statusCode: 400,
      code: 'INVALID_PLAN_STATUS_TRANSITION',
    });
  });

  it('validates cancellationReason on session status transition', async () => {
    // Missing cancellationReason for CANCELLED -> 422
    const missingReason = await request(app.getHttpServer())
      .patch(`/training-sessions/${sessionId}/status`)
      .set('Authorization', 'Bearer token')
      .send({ status: 'CANCELLED' });
    expect(missingReason.status).toBe(422);

    // Whitespace only -> 422
    const emptyReason = await request(app.getHttpServer())
      .patch(`/training-sessions/${sessionId}/status`)
      .set('Authorization', 'Bearer token')
      .send({ status: 'CANCELLED', cancellationReason: '   ' });
    expect(emptyReason.status).toBe(422);

    // Valid cancellationReason -> 200
    const validCancelled = await request(app.getHttpServer())
      .patch(`/training-sessions/${sessionId}/status`)
      .set('Authorization', 'Bearer token')
      .send({ status: 'CANCELLED', cancellationReason: 'Weather issue' });
    expect(validCancelled.status).toBe(200);
    expect(sessionService.updateSessionStatus).toHaveBeenCalledWith(
      actor,
      sessionId,
      'CANCELLED',
      'Weather issue',
    );

    // Supplying cancellationReason for non-CANCELLED status -> 422
    const unexpectedReason = await request(app.getHttpServer())
      .patch(`/training-sessions/${sessionId}/status`)
      .set('Authorization', 'Bearer token')
      .send({ status: 'COMPLETED', cancellationReason: 'Finished early' });
    expect(unexpectedReason.status).toBe(422);
  });

  it('rejects server-owned fields in generic session update', async () => {
    const durationAttempt = await request(app.getHttpServer())
      .patch(`/training-sessions/${sessionId}`)
      .set('Authorization', 'Bearer token')
      .send({ title: 'New', actualDurationSec: 1200 });
    expect(durationAttempt.status).toBe(422);

    const reasonAttempt = await request(app.getHttpServer())
      .patch(`/training-sessions/${sessionId}`)
      .set('Authorization', 'Bearer token')
      .send({ title: 'New', cancellationReason: 'Weather' });
    expect(reasonAttempt.status).toBe(422);
  });

  describe('DOCTOR write prohibition across all 11 write endpoints', () => {
    const doctorUser: AuthenticatedUser = {
      id: '3a119889-e544-4c66-938a-4c511b184baa',
      authSubject: 'doctor-subject',
      email: 'doctor@example.com',
      role: USER.DOCTOR,
    };

    beforeEach(() => {
      authAccessService.authenticate.mockResolvedValue(doctorUser);
      authAccessService.hasPermissions.mockResolvedValue(true);
    });

    const writeCases: Array<{
      name: string;
      method: 'post' | 'patch' | 'delete';
      path: string;
      body?: Record<string, unknown>;
      mockFn: () => ReturnType<typeof vi.fn>;
    }> = [
      {
        name: 'POST /training-plans',
        method: 'post',
        path: '/training-plans',
        body: {
          fighterId,
          coachId,
          title: 'Plan',
          startDate: '2026-09-20',
        },
        mockFn: () => planService.createPlan,
      },
      {
        name: 'PATCH /training-plans/:id',
        method: 'patch',
        path: `/training-plans/${planId}`,
        body: { title: 'Updated Plan' },
        mockFn: () => planService.updatePlan,
      },
      {
        name: 'PATCH /training-plans/:id/status',
        method: 'patch',
        path: `/training-plans/${planId}/status`,
        body: { status: 'ACTIVE' },
        mockFn: () => planService.updatePlanStatus,
      },
      {
        name: 'POST /training-plans/:id/exercises',
        method: 'post',
        path: `/training-plans/${planId}/exercises`,
        body: { exerciseId, orderIndex: 0 },
        mockFn: () => planService.addPlanExercise,
      },
      {
        name: 'PATCH /training-plans/:id/exercises/:exerciseId',
        method: 'patch',
        path: `/training-plans/${planId}/exercises/${exerciseId}`,
        body: { sets: 5 },
        mockFn: () => planService.updatePlanExercise,
      },
      {
        name: 'DELETE /training-plans/:id/exercises/:exerciseId',
        method: 'delete',
        path: `/training-plans/${planId}/exercises/${exerciseId}`,
        mockFn: () => planService.removePlanExercise,
      },
      {
        name: 'POST /training-sessions',
        method: 'post',
        path: '/training-sessions',
        body: {
          fighterId,
          title: 'Session',
          scheduledAt: '2026-09-20T10:00:00.000Z',
          sessionType: 'SPARRING',
        },
        mockFn: () => sessionService.createSession,
      },
      {
        name: 'PATCH /training-sessions/:id',
        method: 'patch',
        path: `/training-sessions/${sessionId}`,
        body: { title: 'Updated Session' },
        mockFn: () => sessionService.updateSession,
      },
      {
        name: 'PATCH /training-sessions/:id/status',
        method: 'patch',
        path: `/training-sessions/${sessionId}/status`,
        body: { status: 'IN_PROGRESS' },
        mockFn: () => sessionService.updateSessionStatus,
      },
      {
        name: 'POST /exercises',
        method: 'post',
        path: '/exercises',
        body: { name: 'New Exercise', category: 'STRIKING' },
        mockFn: () => exerciseService.createExercise,
      },
      {
        name: 'PATCH /exercises/:id',
        method: 'patch',
        path: `/exercises/${exerciseId}`,
        body: { name: 'Updated Exercise' },
        mockFn: () => exerciseService.updateExercise,
      },
    ];

    it.each(writeCases)(
      'rejects $name with 403 FORBIDDEN when invoked by DOCTOR',
      async ({ method, path, body, mockFn }) => {
        mockFn().mockRejectedValueOnce(forbidden());

        const builder = request(app.getHttpServer())
          [method](path)
          .set('Authorization', 'Bearer token');

        const res = body ? await builder.send(body) : await builder;
        expect(res.status).toBe(403);
        expect(res.body.error).toMatchObject({
          statusCode: 403,
          code: 'FORBIDDEN',
        });
      },
    );
  });
});
