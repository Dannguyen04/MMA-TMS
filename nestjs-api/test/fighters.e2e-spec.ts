import { type ExecutionContext, type INestApplication } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AUTH_ACCESS_SERVICE } from '../src/shared/contracts/auth-access.contract.js';
import {
  REQUIRED_PERMISSIONS,
  REQUIRED_ROLES,
} from '../src/shared/decorators/auth.decorator.js';
import type {
  AuthenticatedRequest,
  AuthenticatedUser,
} from '../src/shared/models/auth-context.model.js';
import { USER } from '../src/shared/types/user.role.js';
import { forbidden } from '../src/shared/errors/access.error.js';
import { ApiExceptionFilter } from '../src/shared/filters/api-exception.filter.js';
import {
  AccessTokenGuard,
  AuthorizationGuard,
} from '../src/shared/guards/auth.guard.js';
import { ApiResponseInterceptor } from '../src/shared/interceptors/api-response.interceptor.js';
import { FightersController } from '../src/fighters/fighters.controller.js';
import { FIGHTER_PERMISSIONS } from '../src/fighters/fighters.model.js';
import { FightersService } from '../src/fighters/fighters.service.js';

const fighterId = '59d6ba46-32f2-4e67-b486-e966b2064328';
const fighterUserId = '516a01dc-f842-40e4-ae88-abca224921b7';
const assignmentId = 'e069ca8a-d0f1-44da-8bd5-48a60bf44b99';

const fighterActor: AuthenticatedUser = {
  id: fighterUserId,
  authSubject: 'fighter-auth-subject',
  email: 'fighter@example.com',
  role: USER.FIGHTER,
};

const publicFighter = {
  id: fighterId,
  userId: fighterUserId,
  firstName: 'An',
  lastName: 'Nguyen',
  dateOfBirth: '2000-01-01',
  nationality: 'VN',
  weightClass: 'LIGHTWEIGHT',
  heightCm: 175,
  reachCm: 180,
  dominantStance: 'ORTHODOX',
  leftArmCm: null,
  rightArmCm: null,
  leftLegCm: null,
  rightLegCm: null,
  gym: 'MMA Gym',
  currentMedicalStatus: 'HEALTHY',
  bio: null,
  profileImageUrl: null,
  isActive: true,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

function serviceMock() {
  return {
    findAll: vi.fn().mockResolvedValue({
      data: [publicFighter],
      total: 1,
      hasNextPage: false,
    }),
    findById: vi.fn().mockResolvedValue(publicFighter),
    updateProfile: vi.fn().mockResolvedValue(publicFighter),
    findMeasurements: vi.fn().mockResolvedValue({
      data: [],
      total: 0,
      hasNextPage: false,
    }),
    createMeasurement: vi.fn().mockResolvedValue({
      id: 'b13d7792-fbf9-4421-a4a4-e2ed8466b4a7',
      fighterId,
      recordedById: fighterUserId,
      measuredAt: new Date('2026-02-01T00:00:00.000Z'),
      measurementContext: 'SELF_REPORTED',
      weightKg: 70.35,
      heightCm: null,
      reachCm: null,
      notes: null,
      supersedesId: null,
      isSuperseded: false,
      createdAt: new Date('2026-02-01T00:00:00.000Z'),
    }),
    supersedeMeasurement: vi.fn(),
    findCoachAssignments: vi.fn().mockResolvedValue([]),
    assignCoach: vi.fn(),
    endCoachAssignment: vi.fn(),
    findTrainingSessions: vi.fn().mockResolvedValue({
      data: [],
      total: 0,
      hasNextPage: false,
    }),
    getMedicalSummary: vi.fn(),
  };
}

describe('FightersController (e2e)', () => {
  let app: INestApplication;
  let fightersService: ReturnType<typeof serviceMock>;
  let currentActor = fighterActor;
  const authAccessService = {
    authenticate: vi.fn(),
    hasPermissions: vi.fn(),
  };

  beforeAll(async () => {
    fightersService = serviceMock();
    const moduleRef = await Test.createTestingModule({
      controllers: [FightersController],
      providers: [
        AuthorizationGuard,
        { provide: FightersService, useValue: fightersService },
        { provide: AUTH_ACCESS_SERVICE, useValue: authAccessService },
      ],
    })
      .overrideGuard(AccessTokenGuard)
      .useValue({
        canActivate(context: ExecutionContext) {
          const authenticatedRequest = context
            .switchToHttp()
            .getRequest<AuthenticatedRequest>();
          authenticatedRequest.auth = {
            accessToken: 'test-token',
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
    currentActor = fighterActor;
    vi.clearAllMocks();
    authAccessService.hasPermissions.mockResolvedValue(true);
  });

  afterAll(async () => {
    await app.close();
  });

  it('declares a concrete permission for every Fighters route', () => {
    const reflector = app.get(Reflector);
    const permissionFor = (handler: (...args: never[]) => unknown) =>
      reflector.get(REQUIRED_PERMISSIONS, handler);

    expect(reflector.get(REQUIRED_ROLES, FightersController)).toBeUndefined();
    expect(permissionFor(FightersController.prototype.findAll)).toEqual({
      allOf: [FIGHTER_PERMISSIONS.GET_ALL],
    });
    expect(permissionFor(FightersController.prototype.findById)).toEqual({
      allOf: [FIGHTER_PERMISSIONS.READ],
    });
    expect(permissionFor(FightersController.prototype.updateProfile)).toEqual({
      allOf: [FIGHTER_PERMISSIONS.UPDATE],
    });
    expect(
      permissionFor(FightersController.prototype.findMeasurements),
    ).toEqual({ allOf: [FIGHTER_PERMISSIONS.MEASUREMENTS_READ] });
    expect(
      permissionFor(FightersController.prototype.createMeasurement),
    ).toEqual({ allOf: [FIGHTER_PERMISSIONS.MEASUREMENTS_WRITE] });
    expect(
      permissionFor(FightersController.prototype.supersedeMeasurement),
    ).toEqual({ allOf: [FIGHTER_PERMISSIONS.MEASUREMENTS_WRITE] });
    expect(
      permissionFor(FightersController.prototype.findCoachAssignments),
    ).toEqual({ allOf: [FIGHTER_PERMISSIONS.COACHES_READ] });
    expect(permissionFor(FightersController.prototype.assignCoach)).toEqual({
      allOf: [FIGHTER_PERMISSIONS.COACHES_ASSIGN],
    });
    expect(
      permissionFor(FightersController.prototype.endCoachAssignment),
    ).toEqual({ allOf: [FIGHTER_PERMISSIONS.COACHES_END] });
    expect(
      permissionFor(FightersController.prototype.findTrainingSessions),
    ).toEqual({ allOf: [FIGHTER_PERMISSIONS.SESSIONS_READ] });
    expect(
      permissionFor(FightersController.prototype.getMedicalSummary),
    ).toEqual({ allOf: [FIGHTER_PERMISSIONS.MEDICAL_READ] });
  });

  it('coerces and delegates fighter-list filters', async () => {
    currentActor = { ...fighterActor, role: USER.DOCTOR };
    const response = await request(app.getHttpServer()).get(
      '/fighters?page=1&limit=10&weightClass=LIGHTWEIGHT',
    );

    expect(response.status).toBe(200);
    expect(fightersService.findAll).toHaveBeenCalledWith(currentActor, {
      page: 1,
      limit: 10,
      weightClass: 'LIGHTWEIGHT',
    });
    expect(response.body.message).toBe('Get fighters list successfully');
  });

  it('returns the standard forbidden error envelope from the use case', async () => {
    fightersService.findById.mockRejectedValueOnce(forbidden());
    const response = await request(app.getHttpServer()).get(
      `/fighters/${fighterId}`,
    );

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      success: false,
      error: {
        statusCode: 403,
        code: 'FORBIDDEN',
        message: 'You are not allowed to perform this action',
      },
    });
  });

  it('denies before the service when the required permission is absent', async () => {
    authAccessService.hasPermissions.mockResolvedValueOnce(false);

    const response = await request(app.getHttpServer()).get(
      `/fighters/${fighterId}/measurements`,
    );

    expect(response.status).toBe(403);
    expect(response.body.error).toMatchObject({
      statusCode: 403,
      code: 'FORBIDDEN',
    });
    expect(authAccessService.hasPermissions).toHaveBeenCalledWith(
      fighterActor,
      { allOf: [FIGHTER_PERMISSIONS.MEASUREMENTS_READ] },
    );
    expect(fightersService.findMeasurements).not.toHaveBeenCalled();
  });

  it('rejects a negative profile measurement before invoking the service', async () => {
    const response = await request(app.getHttpServer())
      .patch(`/fighters/${fighterId}`)
      .send({ heightCm: -10 });

    expect(response.status).toBe(422);
    expect(response.body).toMatchObject({
      success: false,
      error: { statusCode: 422, code: 'VALIDATION_ERROR' },
    });
    expect(fightersService.updateProfile).not.toHaveBeenCalled();
  });

  it.each(['invalid', -5, 600])(
    'rejects invalid measurement weight %s at the HTTP boundary',
    async (weightKg) => {
      const response = await request(app.getHttpServer())
        .post(`/fighters/${fighterId}/measurements`)
        .send({ measurementContext: 'SELF_REPORTED', weightKg });

      expect(response.status).toBe(422);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(fightersService.createMeasurement).not.toHaveBeenCalled();
    },
  );

  it('records a valid self-reported measurement with a 201 envelope', async () => {
    const response = await request(app.getHttpServer())
      .post(`/fighters/${fighterId}/measurements`)
      .send({ measurementContext: 'SELF_REPORTED', weightKg: 70.35 });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      success: true,
      message: 'Record body measurement successfully',
      data: {
        fighterId,
        recordedById: fighterUserId,
        supersedesId: null,
        isSuperseded: false,
      },
    });
    expect(fightersService.createMeasurement).toHaveBeenCalledWith(
      fighterActor,
      fighterId,
      { measurementContext: 'SELF_REPORTED', weightKg: 70.35 },
      expect.any(String),
    );
  });

  it('rejects an empty coach-assignment end reason', async () => {
    const response = await request(app.getHttpServer())
      .post(`/fighters/${fighterId}/coaches/${assignmentId}/end`)
      .send({ endReason: '' });

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(fightersService.endCoachAssignment).not.toHaveBeenCalled();
  });
});
