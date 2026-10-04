import {
  type ExecutionContext,
  type INestApplication,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { CoachingController } from '../src/coaching/coaching.controller.js';
import { CoachingService } from '../src/coaching/coaching.service.js';
import { ApiExceptionFilter } from '../src/shared/filters/api-exception.filter.js';
import { ApiResponseInterceptor } from '../src/shared/interceptors/api-response.interceptor.js';
import { AppValidationPipe } from '../src/shared/pipes/app-validation.pipe.js';
import {
  AccessTokenGuard,
  AuthorizationGuard,
} from '../src/shared/guards/auth.guard.js';
import { AUTH_ACCESS_SERVICE } from '../src/shared/contracts/auth-access.contract.js';
import type {
  AuthenticatedRequest,
  AuthenticatedUser,
} from '../src/shared/models/auth-context.model.js';
import { USER } from '../src/shared/types/user.role.js';

const coachId = '59d6ba46-32f2-4e67-b486-e966b2064328';
const otherCoachId = '7ca0a87a-af9e-4dcf-809c-35cc02c57bed';
const fighterId = '516a01dc-f842-40e4-ae88-abca224921b7';
const coachUserId = '11111111-1111-4000-8000-000000000001';
const fighterUserId = '22222222-2222-4000-8000-000000000002';
const adminUserId = '33333333-3333-4000-8000-000000000003';

const coachActor: AuthenticatedUser = {
  id: coachUserId,
  authSubject: 'coach-auth-subject',
  email: 'coach@example.com',
  role: USER.COACH,
};

const fighterActor: AuthenticatedUser = {
  id: fighterUserId,
  authSubject: 'fighter-auth-subject',
  email: 'fighter@example.com',
  role: USER.FIGHTER,
};

const adminActor: AuthenticatedUser = {
  id: adminUserId,
  authSubject: 'admin-auth-subject',
  email: 'admin@example.com',
  role: USER.ADMIN,
};

function coachingServiceMock() {
  return {
    createAssignment: vi.fn().mockResolvedValue({
      planId: 'plan-123',
      sessionId: 'session-123',
      title: 'Technique Mastery',
      status: 'SCHEDULED',
      scheduledAt: new Date().toISOString(),
    }),
    getCoachByUserId: vi.fn().mockResolvedValue({
      id: coachId,
      userId: coachUserId,
    }),
    getFighterByUserId: vi.fn().mockResolvedValue({
      id: fighterId,
      userId: fighterUserId,
    }),
    verifyCoachAuthorization: vi.fn().mockResolvedValue(undefined),
    uploadVideo: vi.fn().mockResolvedValue({ id: 'video-123' }),
    createAnalysisJob: vi.fn().mockResolvedValue({ jobId: 'job-123', analysisId: 'ana-123' }),
    reviewFinding: vi.fn().mockResolvedValue({ id: 'finding-123' }),
  };
}

describe('Coaching API - POST /coaching/assignments (e2e contract tests)', () => {
  let app: INestApplication;
  let coachingService: ReturnType<typeof coachingServiceMock>;
  let currentActor: AuthenticatedUser = coachActor;
  const authAccessService = {
    authenticate: vi.fn(),
    hasPermissions: vi.fn().mockResolvedValue(true),
  };

  beforeAll(async () => {
    coachingService = coachingServiceMock();

    const moduleRef = await Test.createTestingModule({
      controllers: [CoachingController],
      providers: [
        AuthorizationGuard,
        { provide: CoachingService, useValue: coachingService },
        { provide: AUTH_ACCESS_SERVICE, useValue: authAccessService },
      ],
    })
      .overrideGuard(AccessTokenGuard)
      .useValue({
        canActivate(context: ExecutionContext) {
          const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
          req.auth = {
            accessToken: 'valid-test-token',
            user: currentActor,
          };
          return true;
        },
      })
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new AppValidationPipe());
    app.useGlobalFilters(new ApiExceptionFilter());
    app.useGlobalInterceptors(new ApiResponseInterceptor(app.get(Reflector)));
    await app.init();
  });

  beforeEach(() => {
    currentActor = coachActor;
    vi.clearAllMocks();
    authAccessService.hasPermissions.mockResolvedValue(true);
    coachingService.getCoachByUserId.mockResolvedValue({
      id: coachId,
      userId: coachUserId,
    });
    coachingService.createAssignment.mockResolvedValue({
      planId: 'plan-123',
      sessionId: 'session-123',
      title: 'Technique Mastery',
      status: 'SCHEDULED',
      scheduledAt: new Date().toISOString(),
    });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Phases acceptance (201)', () => {
    const phases = ['base', 'build', 'fight_camp', 'taper', 'rehab', 'maintenance'] as const;

    for (const phase of phases) {
      it(`accepts phase "${phase}" with 201 and forwards phase to service`, async () => {
        const res = await request(app.getHttpServer())
          .post('/coaching/assignments')
          .set('Authorization', 'Bearer token')
          .send({
            coachId,
            fighterId,
            title: 'Technique Mastery',
            phase,
          });

        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.data.planId).toBe('plan-123');
        expect(coachingService.createAssignment).toHaveBeenCalledWith(
          expect.objectContaining({
            coachId,
            fighterId,
            title: 'Technique Mastery',
            phase,
          }),
        );
      });
    }
  });

  describe('Validation errors (422 VALIDATION_ERROR with path phase)', () => {
    it.each([
      ['missing phase', { coachId, fighterId, title: 'Session' }],
      ['null phase', { coachId, fighterId, title: 'Session', phase: null }],
      ['BASE phase (uppercase)', { coachId, fighterId, title: 'Session', phase: 'BASE' }],
      ['empty string phase', { coachId, fighterId, title: 'Session', phase: '' }],
      ['number phase', { coachId, fighterId, title: 'Session', phase: 123 }],
      ['unknown phase', { coachId, fighterId, title: 'Session', phase: 'hypertrophy' }],
    ])('returns 422 VALIDATION_ERROR when %s and does not call service', async (_label, body) => {
      const res = await request(app.getHttpServer())
        .post('/coaching/assignments')
        .set('Authorization', 'Bearer token')
        .send(body);

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');

      const issues = (res.body.error.details || []) as Array<{ path: string[] }>;
      const paths = issues.map((i) => (Array.isArray(i.path) ? i.path.join('.') : String(i.path)));
      expect(paths).toContain('phase');
      expect(coachingService.createAssignment).not.toHaveBeenCalled();
    });

    it('rejects unexpected body keys with 422 and does not call service', async () => {
      const res = await request(app.getHttpServer())
        .post('/coaching/assignments')
        .set('Authorization', 'Bearer token')
        .send({
          coachId,
          fighterId,
          title: 'Session',
          phase: 'base',
          extraProperty: 'disallowed',
        });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(coachingService.createAssignment).not.toHaveBeenCalled();
    });

    it('rejects sessionType outside enum with 422', async () => {
      const res = await request(app.getHttpServer())
        .post('/coaching/assignments')
        .set('Authorization', 'Bearer token')
        .send({
          coachId,
          fighterId,
          title: 'Session',
          phase: 'base',
          sessionType: 'SWIMMING',
        });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(coachingService.createAssignment).not.toHaveBeenCalled();
    });

    it('allows omitting sessionType and forwards request to service', async () => {
      const res = await request(app.getHttpServer())
        .post('/coaching/assignments')
        .set('Authorization', 'Bearer token')
        .send({
          coachId,
          fighterId,
          title: 'Session',
          phase: 'base',
        });

      expect(res.status).toBe(201);
      expect(coachingService.createAssignment).toHaveBeenCalledWith(
        expect.not.objectContaining({
          sessionType: expect.anything(),
        }),
      );
    });
  });

  describe('Permissions and authorization', () => {
    it('returns 403 when COACH attempts to create assignment for a different coachId', async () => {
      const res = await request(app.getHttpServer())
        .post('/coaching/assignments')
        .set('Authorization', 'Bearer token')
        .send({
          coachId: otherCoachId,
          fighterId,
          title: 'Session',
          phase: 'base',
        });

      expect(res.status).toBe(403);
      expect(coachingService.createAssignment).not.toHaveBeenCalled();
    });

    it('returns 403 when COACH has no coach profile registered', async () => {
      coachingService.getCoachByUserId.mockResolvedValue(null);

      const res = await request(app.getHttpServer())
        .post('/coaching/assignments')
        .set('Authorization', 'Bearer token')
        .send({
          coachId,
          fighterId,
          title: 'Session',
          phase: 'base',
        });

      expect(res.status).toBe(403);
      expect(coachingService.createAssignment).not.toHaveBeenCalled();
    });

    it('returns 403 when FIGHTER attempts to create assignment', async () => {
      currentActor = fighterActor;

      const res = await request(app.getHttpServer())
        .post('/coaching/assignments')
        .set('Authorization', 'Bearer token')
        .send({
          coachId,
          fighterId,
          title: 'Session',
          phase: 'base',
        });

      expect(res.status).toBe(403);
      expect(coachingService.createAssignment).not.toHaveBeenCalled();
    });

    it('allows ADMIN to create assignment', async () => {
      currentActor = adminActor;

      const res = await request(app.getHttpServer())
        .post('/coaching/assignments')
        .set('Authorization', 'Bearer token')
        .send({
          coachId,
          fighterId,
          title: 'Session',
          phase: 'fight_camp',
        });

      expect(res.status).toBe(201);
      expect(coachingService.createAssignment).toHaveBeenCalledWith(
        expect.objectContaining({
          coachId,
          fighterId,
          title: 'Session',
          phase: 'fight_camp',
        }),
      );
    });

    it('blocks coach when not authorized for fighter (service throws ForbiddenException)', async () => {
      coachingService.createAssignment.mockRejectedValue(
        new ForbiddenException('Coach is not assigned to fighter.'),
      );

      const res = await request(app.getHttpServer())
        .post('/coaching/assignments')
        .set('Authorization', 'Bearer token')
        .send({
          coachId,
          fighterId,
          title: 'Session',
          phase: 'base',
        });

      expect(res.status).toBe(403);
    });
  });

  describe('Other coaching routes preserve class-validator', () => {
    it('uses class-validator on POST /coaching/videos (fails with 422 VALIDATION_ERROR and errors tree on invalid input)', async () => {
      currentActor = coachActor;
      const res = await request(app.getHttpServer())
        .post('/coaching/videos')
        .set('Authorization', 'Bearer token')
        .send({
          // missing fighterId and title
        });

      // AppValidationPipe with class-validator throws 422 UnprocessableEntityException with errors tree
      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      // Verify class-validator generated error tree exists in details
      expect(res.body.error.details).toHaveProperty('fighterId');
      expect(res.body.error.details).toHaveProperty('title');
      expect(coachingService.uploadVideo).not.toHaveBeenCalled();
    });
  });
});
