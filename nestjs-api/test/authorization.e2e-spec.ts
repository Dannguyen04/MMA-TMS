import type { INestApplication } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AuthorizationController } from '../src/authorization/authorization.controller.js';
import { AuthorizationService } from '../src/authorization/authorization.service.js';
import { AUTH_ACCESS_SERVICE } from '../src/shared/contracts/auth-access.contract.js';
import {
  REQUIRED_PERMISSIONS,
  REQUIRED_ROLES,
} from '../src/shared/decorators/auth.decorator.js';
import { ApiExceptionFilter } from '../src/shared/filters/api-exception.filter.js';
import {
  AccessTokenGuard,
  AuthorizationGuard,
} from '../src/shared/guards/auth.guard.js';
import { ApiResponseInterceptor } from '../src/shared/interceptors/api-response.interceptor.js';
import { USER } from '../src/shared/types/user.role.js';

const targetUserId = '59d6ba46-32f2-4e67-b486-e966b2064328';
const admin = {
  id: '516a01dc-f842-40e4-ae88-abca224921b7',
  authSubject: '8473a317-317a-4b0a-8b01-eb4e961ff52f',
  email: 'admin@example.com',
  role: USER.ADMIN,
};

describe('AuthorizationController (e2e)', () => {
  let app: INestApplication<App>;
  const authorizationService = {
    setUserPermissionOverride: vi.fn(),
    removeUserPermissionOverride: vi.fn(),
    grantRolePermission: vi.fn(),
    revokeRolePermission: vi.fn(),
  };
  const authService = {
    authenticate: vi.fn(),
    hasPermissions: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    authService.authenticate.mockResolvedValue(admin);

    const moduleFixture = await Test.createTestingModule({
      controllers: [AuthorizationController],
      providers: [
        AccessTokenGuard,
        AuthorizationGuard,
        { provide: AuthorizationService, useValue: authorizationService },
        { provide: AUTH_ACCESS_SERVICE, useValue: authService },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalFilters(new ApiExceptionFilter());
    app.useGlobalInterceptors(new ApiResponseInterceptor(app.get(Reflector)));
    await app.init();
  });

  afterEach(async () => app.close());

  it('classifies every assignment route as ADMIN-only without permission metadata', () => {
    const reflector = app.get(Reflector);
    expect(reflector.get(REQUIRED_ROLES, AuthorizationController)).toEqual([
      USER.ADMIN,
    ]);

    for (const handler of [
      AuthorizationController.prototype.setUserPermissionOverride,
      AuthorizationController.prototype.removeUserPermissionOverride,
      AuthorizationController.prototype.grantRolePermission,
      AuthorizationController.prototype.revokeRolePermission,
    ]) {
      expect(reflector.get(REQUIRED_ROLES, handler)).toEqual([USER.ADMIN]);
      expect(reflector.get(REQUIRED_PERMISSIONS, handler)).toBeUndefined();
    }
  });

  it('returns 401 before authorization when the token is missing', async () => {
    await request(app.getHttpServer())
      .put(
        `/authorization/users/${targetUserId}/permissions/users.profile.read`,
      )
      .expect(401);

    expect(
      authorizationService.setUserPermissionOverride,
    ).not.toHaveBeenCalled();
  });

  it('returns 403 for an authenticated non-ADMIN without resolving permissions', async () => {
    authService.authenticate.mockResolvedValueOnce({
      ...admin,
      role: USER.FIGHTER,
    });

    await request(app.getHttpServer())
      .put(
        `/authorization/users/${targetUserId}/permissions/users.profile.read`,
      )
      .set('Authorization', 'Bearer valid-token')
      .send({ isGranted: true })
      .expect(403);

    expect(authService.hasPermissions).not.toHaveBeenCalled();
    expect(
      authorizationService.setUserPermissionOverride,
    ).not.toHaveBeenCalled();
  });

  it.each([true, false])(
    'allows ADMIN to persist isGranted=%s',
    async (isGranted) => {
      authorizationService.setUserPermissionOverride.mockResolvedValueOnce({
        id: '2cd04cb8-61cc-45e4-8174-5b54107c4e98',
        userId: targetUserId,
        permissionCode: 'users.profile.read',
        isGranted,
        grantedBy: admin.id,
        createdAt: '2026-09-17T00:00:00.000Z',
      });

      const response = await request(app.getHttpServer())
        .put(
          `/authorization/users/${targetUserId}/permissions/users.profile.read`,
        )
        .set('Authorization', 'Bearer valid-token')
        .send({ isGranted })
        .expect(200);

      expect(authService.hasPermissions).not.toHaveBeenCalled();
      expect(
        authorizationService.setUserPermissionOverride,
      ).toHaveBeenCalledWith(
        {
          userId: targetUserId,
          permissionCode: 'users.profile.read',
        },
        { isGranted },
        admin,
        expect.any(String),
      );
      expect(response.body.data.isGranted).toBe(isGranted);
    },
  );

  it.each([undefined, null, 'true', 1, { isGranted: true, unexpected: true }])(
    'rejects invalid override payload %# with 422',
    async (payload) => {
      const pendingRequest = request(app.getHttpServer())
        .put(
          `/authorization/users/${targetUserId}/permissions/users.profile.read`,
        )
        .set('Authorization', 'Bearer valid-token');

      if (payload !== undefined)
        pendingRequest.send(
          typeof payload === 'object' &&
            payload !== null &&
            'isGranted' in payload
            ? payload
            : { isGranted: payload },
        );

      await pendingRequest.expect(422);
      expect(
        authorizationService.setUserPermissionOverride,
      ).not.toHaveBeenCalled();
    },
  );

  it('rejects invalid route parameters before calling the service', async () => {
    await request(app.getHttpServer())
      .put('/authorization/users/not-a-uuid/permissions/users.profile.read')
      .set('Authorization', 'Bearer valid-token')
      .send({ isGranted: true })
      .expect(422);

    expect(
      authorizationService.setUserPermissionOverride,
    ).not.toHaveBeenCalled();
  });
});
