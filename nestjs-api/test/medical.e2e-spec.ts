import { type ExecutionContext, type INestApplication } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AUTH_ACCESS_SERVICE } from '../src/shared/contracts/auth-access.contract.js';
import { REQUIRED_PERMISSIONS } from '../src/shared/decorators/auth.decorator.js';
import type {
  AuthenticatedRequest,
  AuthenticatedUser,
} from '../src/shared/models/auth-context.model.js';
import { USER } from '../src/shared/types/user.role.js';
import { ApiExceptionFilter } from '../src/shared/filters/api-exception.filter.js';
import {
  AccessTokenGuard,
  AuthorizationGuard,
} from '../src/shared/guards/auth.guard.js';
import { ApiResponseInterceptor } from '../src/shared/interceptors/api-response.interceptor.js';
import { MedicalController } from '../src/medical/medical.controller.js';
import { MedicalAssignmentController } from '../src/medical/medical-assignment.controller.js';
import { MEDICAL_PERMISSIONS } from '../src/medical/medical.constants.js';
import { MedicalService } from '../src/medical/medical.service.js';
import { authenticationRequired } from '../src/shared/errors/access.error.js';
import { TrainingSessionController } from '../src/training/sessions/training-session.controller.js';
import { TrainingSessionService } from '../src/training/sessions/training-session.service.js';
import { trainingMedicalEligibilityRequired } from '../src/training/training.error.js';

const fighterId = '59d6ba46-32f2-4e67-b486-e966b2064328';
const doctorId = '7ca0a87a-af9e-4dcf-809c-35cc02c57bed';
const assignmentId = 'e069ca8a-d0f1-44da-8bd5-48a60bf44b99';
const injuryId = 'b13d7792-fbf9-4421-a4a4-e2ed8466b4a7';
const planId = 'c13d7792-fbf9-4421-a4a4-e2ed8466b4a8';
const clearanceId = 'd13d7792-fbf9-4421-a4a4-e2ed8466b4a9';
const examId = 'e13d7792-fbf9-4421-a4a4-e2ed8466b4b0';
const sessionId = 'f13d7792-fbf9-4421-a4a4-e2ed8466b4b1';

const doctorActor: AuthenticatedUser = {
  id: doctorId,
  authSubject: 'doctor-auth-subject',
  email: 'doctor@example.com',
  role: USER.DOCTOR,
};

const adminActor: AuthenticatedUser = {
  id: 'ad310000-0000-4000-8000-000000000001',
  authSubject: 'admin-auth-subject',
  email: 'admin@example.com',
  role: USER.ADMIN,
};

function medicalServiceMock() {
  return {
    getDossier: vi.fn().mockResolvedValue({
      fighterId,
      currentStatus: 'HEALTHY',
      currentTrainingExamination: null,
      currentCompetitionExamination: null,
      activeClearances: [],
      activeInjuries: [],
      activeRecoveryPlans: [],
      pendingReviewRequests: [],
    }),
    listHistory: vi.fn().mockResolvedValue({
      data: [],
      total: 0,
      hasNextPage: false,
    }),
    listExaminations: vi.fn().mockResolvedValue({
      data: [],
      total: 0,
      hasNextPage: false,
    }),
    listReviewRequests: vi.fn().mockResolvedValue({
      data: [],
      total: 0,
      hasNextPage: false,
    }),
    createReviewRequest: vi.fn().mockResolvedValue({
      id: 'req-1',
      fighterId,
      requestedById: doctorId,
      requesterRole: 'DOCTOR',
      reason: 'Checkup needed',
      status: 'OPEN',
      requestedAt: new Date().toISOString(),
      resolvedByExaminationId: null,
      resolvedAt: null,
      revision: 1,
    }),
    createInjury: vi.fn().mockResolvedValue({
      id: injuryId,
      fighterId,
      injuryType: 'KNEE_SPRAIN',
      affectedJoint: 'RIGHT_KNEE',
      severity: 'MODERATE',
      status: 'ACTIVE',
      occurredAt: '2026-09-20T00:00:00.000Z',
      resolvedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      description: null,
    }),
    updateInjury: vi.fn().mockResolvedValue({
      id: injuryId,
      fighterId,
      status: 'RECOVERING',
    }),
    createTreatment: vi.fn().mockResolvedValue({
      id: 'treat-1',
      injuryId,
      doctorId,
      treatmentDate: '2026-09-22T00:00:00.000Z',
      treatmentType: 'PHYSICAL_THERAPY',
      description: 'Ice and rest',
      outcomeNotes: null,
      nextReviewAt: null,
      createdAt: new Date().toISOString(),
    }),
    createRecoveryPlan: vi.fn().mockResolvedValue({
      id: planId,
      fighterId,
      injuryId,
      doctorId,
      title: 'Knee rehab',
      description: null,
      startDate: '2026-09-22',
      estimatedEndDate: '2026-10-06',
      actualEndDate: null,
      status: 'ACTIVE',
      milestones: [],
      revision: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }),
    updateRecoveryPlan: vi.fn().mockResolvedValue({
      id: planId,
      status: 'COMPLETED',
    }),
    createExamination: vi.fn().mockResolvedValue({
      id: examId,
      fighterId,
      scope: 'TRAINING',
      decision: 'ELIGIBLE',
      examinedAt: new Date().toISOString(),
      validUntil: null,
      restrictions: null,
      supersedesId: null,
      createdAt: new Date().toISOString(),
    }),
    issueClearance: vi.fn().mockResolvedValue({
      id: clearanceId,
      fighterId,
      examinationId: examId,
      clearanceType: 'TRAINING',
      status: 'ACTIVE',
      validFrom: new Date().toISOString(),
      validUntil: null,
      restrictions: {
        allowedSessionTypes: null,
        allowedTechniqueTypes: null,
        excludedJoints: null,
        notes: null,
      },
      createdAt: new Date().toISOString(),
    }),
    revokeClearance: vi.fn().mockResolvedValue({
      id: clearanceId,
      status: 'REVOKED',
      revokedReason: 'New pain reported',
    }),
    assignDoctor: vi.fn().mockResolvedValue({
      id: assignmentId,
      fighterId,
      doctorId,
      startsAt: new Date().toISOString(),
      endsAt: null,
      assignedById: adminActor.id,
      endedById: null,
      endReason: null,
      createdAt: new Date().toISOString(),
    }),
    endDoctorAssignment: vi.fn().mockResolvedValue({
      id: assignmentId,
      fighterId,
      doctorId,
      startsAt: new Date().toISOString(),
      endsAt: new Date().toISOString(),
      assignedById: adminActor.id,
      endedById: doctorId,
      endReason: 'Treatment complete',
      createdAt: new Date().toISOString(),
    }),
    listDoctorAssignments: vi.fn().mockResolvedValue({
      data: [],
      total: 0,
      hasNextPage: false,
    }),
    listDoctorRoster: vi.fn().mockResolvedValue({
      data: [],
      total: 0,
      hasNextPage: false,
    }),
    listFightersForDoctorUser: vi.fn().mockResolvedValue({
      data: [],
      total: 0,
      hasNextPage: false,
    }),
  };
}

function trainingSessionServiceMock() {
  return {
    updateSessionStatus: vi.fn(),
  };
}

describe('Medical API (e2e)', () => {
  let app: INestApplication;
  let medicalService: ReturnType<typeof medicalServiceMock>;
  let trainingService: ReturnType<typeof trainingSessionServiceMock>;
  let currentActor: AuthenticatedUser = doctorActor;
  let isAuthenticated = true;
  const authAccessService = {
    authenticate: vi.fn(),
    hasPermissions: vi.fn(),
  };

  beforeAll(async () => {
    medicalService = medicalServiceMock();
    trainingService = trainingSessionServiceMock();

    const moduleRef = await Test.createTestingModule({
      controllers: [
        MedicalController,
        MedicalAssignmentController,
        TrainingSessionController,
      ],
      providers: [
        AuthorizationGuard,
        { provide: MedicalService, useValue: medicalService },
        { provide: TrainingSessionService, useValue: trainingService },
        { provide: AUTH_ACCESS_SERVICE, useValue: authAccessService },
      ],
    })
      .overrideGuard(AccessTokenGuard)
      .useValue({
        canActivate(context: ExecutionContext) {
          if (!isAuthenticated) throw authenticationRequired();
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
    app.useGlobalFilters(new ApiExceptionFilter());
    app.useGlobalInterceptors(new ApiResponseInterceptor(app.get(Reflector)));
    await app.init();
  });

  beforeEach(() => {
    currentActor = doctorActor;
    isAuthenticated = true;
    vi.clearAllMocks();
    authAccessService.hasPermissions.mockResolvedValue(true);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Route Permission Declarations', () => {
    it('declares concrete permissions for all medical and assignment routes', () => {
      const reflector = app.get(Reflector);
      const perm = (handler: (...args: never[]) => unknown) =>
        reflector.get(REQUIRED_PERMISSIONS, handler);

      expect(perm(MedicalController.prototype.getDossier)).toEqual({
        allOf: [MEDICAL_PERMISSIONS.READ],
      });
      expect(perm(MedicalController.prototype.listHistory)).toEqual({
        allOf: [MEDICAL_PERMISSIONS.READ],
      });
      expect(perm(MedicalController.prototype.listExaminations)).toEqual({
        allOf: [MEDICAL_PERMISSIONS.READ],
      });
      expect(perm(MedicalController.prototype.listReviewRequests)).toEqual({
        allOf: [MEDICAL_PERMISSIONS.READ],
      });
      expect(perm(MedicalController.prototype.createReviewRequest)).toEqual({
        allOf: [MEDICAL_PERMISSIONS.REVIEW_REQUEST_CREATE],
      });
      expect(perm(MedicalController.prototype.createInjury)).toEqual({
        allOf: [MEDICAL_PERMISSIONS.WRITE],
      });
      expect(perm(MedicalController.prototype.updateInjury)).toEqual({
        allOf: [MEDICAL_PERMISSIONS.WRITE],
      });
      expect(perm(MedicalController.prototype.createTreatment)).toEqual({
        allOf: [MEDICAL_PERMISSIONS.WRITE],
      });
      expect(perm(MedicalController.prototype.createRecoveryPlan)).toEqual({
        allOf: [MEDICAL_PERMISSIONS.WRITE],
      });
      expect(perm(MedicalController.prototype.updateRecoveryPlan)).toEqual({
        allOf: [MEDICAL_PERMISSIONS.WRITE],
      });
      expect(perm(MedicalController.prototype.createExamination)).toEqual({
        allOf: [MEDICAL_PERMISSIONS.EXAMINATION_CREATE],
      });
      expect(perm(MedicalController.prototype.issueClearance)).toEqual({
        allOf: [MEDICAL_PERMISSIONS.CLEARANCE_ISSUE],
      });
      expect(perm(MedicalController.prototype.revokeClearance)).toEqual({
        allOf: [MEDICAL_PERMISSIONS.CLEARANCE_REVOKE],
      });

      // Assignment routes
      expect(perm(MedicalAssignmentController.prototype.assignDoctor)).toEqual({
        allOf: [MEDICAL_PERMISSIONS.DOCTOR_ASSIGN],
      });
      expect(perm(MedicalAssignmentController.prototype.endDoctorAssignment)).toEqual({
        allOf: [MEDICAL_PERMISSIONS.DOCTOR_END],
      });
      expect(perm(MedicalAssignmentController.prototype.listDoctorAssignments)).toEqual({
        allOf: [MEDICAL_PERMISSIONS.DOCTOR_READ],
      });
      expect(perm(MedicalAssignmentController.prototype.listDoctorRoster)).toEqual({
        allOf: [MEDICAL_PERMISSIONS.DOCTOR_ROSTER],
      });
    });
  });

  describe('Authentication & Authorization Guards', () => {
    it('returns 401 when token is missing or invalid', async () => {
      isAuthenticated = false;
      await request(app.getHttpServer())
        .get(`/fighters/${fighterId}/medical`)
        .expect(401);
    });

    it('returns 403 when required permission is not granted', async () => {
      authAccessService.hasPermissions.mockResolvedValueOnce(false);
      await request(app.getHttpServer())
        .get(`/fighters/${fighterId}/medical`)
        .expect(403);
    });
  });

  describe('READ routes & Global Envelopes', () => {
    it('GET /fighters/:id/medical returns 200 with standard success envelope', async () => {
      const res = await request(app.getHttpServer())
        .get(`/fighters/${fighterId}/medical`)
        .expect(200);

      expect(res.body).toMatchObject({
        success: true,
        message: 'Get fighter medical dossier successfully',
        data: {
          fighterId,
          currentStatus: 'HEALTHY',
        },
      });
      expect(medicalService.getDossier).toHaveBeenCalledWith(
        doctorActor,
        fighterId,
        expect.any(String),
      );
    });

    it('GET /fighters/:id/medical/history returns 200 with paginated structure', async () => {
      const res = await request(app.getHttpServer())
        .get(`/fighters/${fighterId}/medical/history?page=1&limit=20`)
        .expect(200);

      expect(res.body).toMatchObject({
        success: true,
        message: 'Get fighter medical history successfully',
        data: {
          data: [],
          total: 0,
          hasNextPage: false,
        },
      });
    });

    it('GET /fighters/:id/medical/history rejects limit > 100 with 422', async () => {
      await request(app.getHttpServer())
        .get(`/fighters/${fighterId}/medical/history?limit=101`)
        .expect(422);
    });
  });

  describe('WRITE routes & Validation Rules', () => {
    it('POST /fighters/:id/injuries returns 201 on valid body', async () => {
      const payload = {
        injuryType: 'KNEE_SPRAIN',
        affectedJoint: 'RIGHT_KNEE',
        severity: 'MODERATE',
        occurredAt: '2026-09-20T00:00:00.000Z',
      };

      const res = await request(app.getHttpServer())
        .post(`/fighters/${fighterId}/injuries`)
        .send(payload)
        .expect(201);

      expect(res.body).toMatchObject({
        success: true,
        message: 'Record injury successfully',
        data: {
          id: injuryId,
          fighterId,
        },
      });
      expect(medicalService.createInjury).toHaveBeenCalledWith(
        doctorActor,
        fighterId,
        expect.objectContaining(payload),
        expect.any(String),
      );
    });

    it('POST /fighters/:id/injuries rejects unknown/actor-spoofing fields with 422', async () => {
      await request(app.getHttpServer())
        .post(`/fighters/${fighterId}/injuries`)
        .send({
          injuryType: 'KNEE_SPRAIN',
          affectedJoint: 'RIGHT_KNEE',
          severity: 'MODERATE',
          occurredAt: '2026-09-20T00:00:00.000Z',
          reportedById: 'attacker-id', // prohibited key
        })
        .expect(422);

      expect(medicalService.createInjury).not.toHaveBeenCalled();
    });

    it('POST /fighters/:id/injuries rejects future occurredAt with 422', async () => {
      await request(app.getHttpServer())
        .post(`/fighters/${fighterId}/injuries`)
        .send({
          injuryType: 'KNEE_SPRAIN',
          affectedJoint: 'RIGHT_KNEE',
          severity: 'MODERATE',
          occurredAt: '2099-01-01T00:00:00.000Z',
        })
        .expect(422);
    });

    it('POST /fighters/:id/medical-examinations rejects ELIGIBLE_WITH_RESTRICTIONS without restrictions (422)', async () => {
      await request(app.getHttpServer())
        .post(`/fighters/${fighterId}/medical-examinations`)
        .send({
          scope: 'TRAINING',
          decision: 'ELIGIBLE_WITH_RESTRICTIONS',
          reason: 'Checkup reason',
          examinedAt: '2026-09-20T00:00:00.000Z',
          // restrictions omitted
        })
        .expect(422);
    });

    it('POST /fighters/:id/medical-examinations rejects NOT_ELIGIBLE with validUntil (422)', async () => {
      await request(app.getHttpServer())
        .post(`/fighters/${fighterId}/medical-examinations`)
        .send({
          scope: 'TRAINING',
          decision: 'NOT_ELIGIBLE',
          reason: 'Severe injury',
          examinedAt: '2026-09-20T00:00:00.000Z',
          validUntil: '2026-10-20T00:00:00.000Z',
        })
        .expect(422);
    });

    it('POST /medical-clearances/:id/revoke returns 200 (not 201)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/medical-clearances/${clearanceId}/revoke`)
        .send({ revokedReason: 'New pain reported' })
        .expect(200);

      expect(res.body).toMatchObject({
        success: true,
        message: 'Revoke medical clearance successfully',
        data: {
          id: clearanceId,
          status: 'REVOKED',
        },
      });
    });

    it('POST /fighters/:id/doctors/:assignmentId/end returns 200 (not 201)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/fighters/${fighterId}/doctors/${assignmentId}/end`)
        .send({ endReason: 'Treatment complete' })
        .expect(200);

      expect(res.body).toMatchObject({
        success: true,
        message: 'End doctor assignment successfully',
      });
    });
  });

  describe('Training Session Status Medical Gate Integration', () => {
    it('PATCH /training-sessions/:id/status returns 409 TRAINING_MEDICAL_ELIGIBILITY_REQUIRED with details.reasons', async () => {
      trainingService.updateSessionStatus.mockRejectedValueOnce(
        trainingMedicalEligibilityRequired(['REVIEW_REQUEST_PENDING']),
      );

      const res = await request(app.getHttpServer())
        .patch(`/training-sessions/${sessionId}/status`)
        .send({ status: 'IN_PROGRESS' })
        .expect(409);

      expect(res.body).toMatchObject({
        success: false,
        error: {
          statusCode: 409,
          code: 'TRAINING_MEDICAL_ELIGIBILITY_REQUIRED',
          details: {
            reasons: ['REVIEW_REQUEST_PENDING'],
          },
        },
      });
    });
  });
});
