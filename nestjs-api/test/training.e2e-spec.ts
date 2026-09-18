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
import {
  ExercisesController,
  PlansController,
  SessionsController,
} from '../src/training/training.controller.js';
import {
  planNotFound,
  sessionStateConflict,
} from '../src/training/training.error.js';
import { TRAINING_PERMISSIONS } from '../src/training/training.model.js';
import { TrainingService } from '../src/training/training.service.js';

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

function serviceMock() {
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
    listSessions: vi.fn().mockResolvedValue({
      data: [{ id: sessionId }],
      total: 1,
      hasNextPage: false,
    }),
    createSession: vi.fn().mockResolvedValue({ id: sessionId }),
    getSessionById: vi.fn().mockResolvedValue({ id: sessionId }),
    updateSession: vi.fn().mockResolvedValue({ id: sessionId }),
    updateSessionStatus: vi.fn().mockResolvedValue({ id: sessionId }),
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
  let trainingService: ReturnType<typeof serviceMock>;
  const authAccessService = {
    authenticate: vi.fn().mockResolvedValue(actor),
    hasPermissions: vi.fn().mockResolvedValue(true),
  };
  const authenticated = (path: string) =>
    request(app.getHttpServer()).get(path).set('Authorization', 'Bearer token');

  beforeAll(async () => {
    trainingService = serviceMock();
    const moduleRef = await Test.createTestingModule({
      controllers: [PlansController, SessionsController, ExercisesController],
      providers: [
        AccessTokenGuard,
        AuthorizationGuard,
        { provide: TrainingService, useValue: trainingService },
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
      [PlansController.prototype.listPlans, TRAINING_PERMISSIONS.PLAN_GET_ALL],
      [PlansController.prototype.createPlan, TRAINING_PERMISSIONS.PLAN_CREATE],
      [PlansController.prototype.getPlan, TRAINING_PERMISSIONS.PLAN_READ],
      [PlansController.prototype.updatePlan, TRAINING_PERMISSIONS.PLAN_UPDATE],
      [
        PlansController.prototype.updatePlanStatus,
        TRAINING_PERMISSIONS.PLAN_TRANSITION,
      ],
      [
        PlansController.prototype.listPlanExercises,
        TRAINING_PERMISSIONS.PLAN_EXERCISE_READ,
      ],
      [
        PlansController.prototype.addPlanExercise,
        TRAINING_PERMISSIONS.PLAN_EXERCISE_CREATE,
      ],
      [
        PlansController.prototype.updatePlanExercise,
        TRAINING_PERMISSIONS.PLAN_EXERCISE_UPDATE,
      ],
      [
        PlansController.prototype.removePlanExercise,
        TRAINING_PERMISSIONS.PLAN_EXERCISE_DELETE,
      ],
      [
        SessionsController.prototype.listSessions,
        TRAINING_PERMISSIONS.SESSION_GET_ALL,
      ],
      [
        SessionsController.prototype.createSession,
        TRAINING_PERMISSIONS.SESSION_CREATE,
      ],
      [
        SessionsController.prototype.getSession,
        TRAINING_PERMISSIONS.SESSION_READ,
      ],
      [
        SessionsController.prototype.updateSession,
        TRAINING_PERMISSIONS.SESSION_UPDATE,
      ],
      [
        SessionsController.prototype.updateSessionStatus,
        TRAINING_PERMISSIONS.SESSION_TRANSITION,
      ],
      [
        ExercisesController.prototype.listExercises,
        TRAINING_PERMISSIONS.EXERCISE_GET_ALL,
      ],
      [
        ExercisesController.prototype.getExercise,
        TRAINING_PERMISSIONS.EXERCISE_READ,
      ],
      [
        ExercisesController.prototype.createExercise,
        TRAINING_PERMISSIONS.EXERCISE_CREATE,
      ],
      [
        ExercisesController.prototype.updateExercise,
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
    expect(trainingService.listPlans).not.toHaveBeenCalled();
  });

  it('enforces route permission metadata before invoking the service', async () => {
    authAccessService.hasPermissions.mockResolvedValueOnce(false);

    const response = await authenticated('/training-sessions');

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
    expect(authAccessService.hasPermissions).toHaveBeenCalledWith(actor, {
      allOf: [TRAINING_PERMISSIONS.SESSION_GET_ALL],
    });
    expect(trainingService.listSessions).not.toHaveBeenCalled();
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
    expect(trainingService.listPlans).toHaveBeenCalledWith(actor, {
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
    expect(trainingService.createPlan).toHaveBeenCalledWith(actor, {
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
    expect(trainingService.updatePlan).toHaveBeenCalledWith(actor, planId, {
      title: 'Updated camp',
    });

    const transitioned = await request(app.getHttpServer())
      .patch(`/training-plans/${planId}/status`)
      .set('Authorization', 'Bearer token')
      .send({ status: 'ACTIVE' });
    expect(transitioned.status).toBe(200);
    expect(trainingService.updatePlanStatus).toHaveBeenCalledWith(
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
    expect(trainingService.addPlanExercise).toHaveBeenCalledWith(
      actor,
      planId,
      { exerciseId, orderIndex: 0 },
    );

    const exerciseUpdated = await request(app.getHttpServer())
      .patch(`/training-plans/${planId}/exercises/${planExerciseId}`)
      .set('Authorization', 'Bearer token')
      .send({ sets: 4 });
    expect(exerciseUpdated.status).toBe(200);
    expect(trainingService.updatePlanExercise).toHaveBeenCalledWith(
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
    expect(trainingService.listSessions).toHaveBeenCalledWith(actor, {
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
    expect(trainingService.createSession).toHaveBeenCalledWith(actor, {
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
    expect(trainingService.updateSession).toHaveBeenCalledWith(
      actor,
      sessionId,
      { title: 'Updated pad work' },
    );

    const transitioned = await request(app.getHttpServer())
      .patch(`/training-sessions/${sessionId}/status`)
      .set('Authorization', 'Bearer token')
      .send({ status: 'IN_PROGRESS' });
    expect(transitioned.status).toBe(200);
    expect(trainingService.updateSessionStatus).toHaveBeenCalledWith(
      actor,
      sessionId,
      'IN_PROGRESS',
    );
  });

  it('serves all global-exercise routes with validated inputs', async () => {
    const list = await authenticated(
      '/exercises?page=1&limit=10&category=STRIKING&search=jab',
    );
    expect(list.status).toBe(200);
    expect(trainingService.listExercises).toHaveBeenCalledWith({
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
    expect(trainingService.createExercise).toHaveBeenCalledWith({
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
    expect(trainingService.updateExercise).toHaveBeenCalledWith(exerciseId, {
      name: 'Cross',
    });
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
    trainingService.getPlanById.mockRejectedValueOnce(planNotFound());
    const missing = await authenticated(`/training-plans/${planId}`);
    expect(missing.status).toBe(404);
    expect(missing.body).toEqual({
      success: false,
      error: expect.objectContaining({
        statusCode: 404,
        code: 'TRAINING_PLAN_NOT_FOUND',
      }),
    });

    trainingService.updateSessionStatus.mockRejectedValueOnce(
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
  });
});
