import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import request from 'supertest';
import { App } from 'supertest/types';
import { AUTH_ACCESS_SERVICE } from '../src/shared/contracts/auth-access.contract.js';
import { ApiExceptionFilter } from '../src/shared/filters/api-exception.filter.js';
import { ApiResponseInterceptor } from '../src/shared/interceptors/api-response.interceptor.js';
import {
  AccessTokenGuard,
  AuthorizationGuard,
} from '../src/shared/guards/auth.guard.js';
import { UsersController } from '../src/users/users.controller.js';
import { UsersService } from '../src/users/users.service.js';

const userId = '59d6ba46-32f2-4e67-b486-e966b2064328';
const admin = {
  id: '516a01dc-f842-40e4-ae88-abca224921b7',
  authSubject: '8473a317-317a-4b0a-8b01-eb4e961ff52f',
  email: 'admin@example.com',
  role: 'ADMIN' as const,
};

describe('UsersController authorization (e2e)', () => {
  let app: INestApplication<App>;
  const usersService = {
    create: vi.fn(),
    findOne: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  };
  const authService = {
    authenticate: vi.fn(),
    hasPermissions: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    authService.authenticate.mockResolvedValue(admin);
    authService.hasPermissions.mockResolvedValue(true);

    const moduleFixture = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        AccessTokenGuard,
        AuthorizationGuard,
        { provide: UsersService, useValue: usersService },
        { provide: AUTH_ACCESS_SERVICE, useValue: authService },
      ],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalFilters(new ApiExceptionFilter());
    app.useGlobalInterceptors(new ApiResponseInterceptor(app.get(Reflector)));
    await app.init();
  });

  afterEach(async () => app.close());

  it('runs authentication before authorization', async () => {
    const response = await request(app.getHttpServer())
      .get(`/users/${userId}`)
      .expect(401);
    expect(response.body).toEqual({
      success: false,
      error: {
        statusCode: 401,
        code: 'AUTHENTICATION_REQUIRED',
        message: 'A valid access token is required',
      },
    });
    expect(authService.hasPermissions).not.toHaveBeenCalled();
  });

  it('allows a non-ADMIN when the required permission is granted', async () => {
    authService.authenticate.mockResolvedValueOnce({
      ...admin,
      role: 'COACH',
    });
    usersService.findOne.mockResolvedValueOnce({ id: userId, role: 'COACH' });
    const response = await request(app.getHttpServer())
      .get(`/users/${userId}`)
      .set('Authorization', 'Bearer valid-token')
      .expect(200);
    expect(response.body).toEqual({
      success: true,
      message: 'User retrieved successfully',
      data: { id: userId, role: 'COACH' },
    });
    expect(authService.hasPermissions).toHaveBeenCalled();
    expect(usersService.findOne).toHaveBeenCalledWith(userId);
  });

  it('denies ADMIN when the concrete permission is absent', async () => {
    authService.hasPermissions.mockResolvedValueOnce(false);
    await request(app.getHttpServer())
      .get(`/users/${userId}`)
      .set('Authorization', 'Bearer valid-token')
      .expect(403);
    expect(usersService.findOne).not.toHaveBeenCalled();
  });

  it('fails closed when permission resolution is unavailable', async () => {
    authService.hasPermissions.mockRejectedValueOnce(
      new Error('database unavailable'),
    );
    await request(app.getHttpServer())
      .get(`/users/${userId}`)
      .set('Authorization', 'Bearer valid-token')
      .expect(403);
    expect(usersService.findOne).not.toHaveBeenCalled();
  });

  it('allows ADMIN with permission to create a COACH', async () => {
    usersService.create.mockResolvedValue({ id: userId, role: 'COACH' });
    await request(app.getHttpServer())
      .post('/users')
      .set('Authorization', 'Bearer valid-token')
      .send({
        user: {
          email: 'coach@example.com',
          password: 'strong-password',
          role: 'COACH',
          profile: { firstName: 'Bao', lastName: 'Tran' },
        },
      })
      .expect(201)
      .expect({
        success: true,
        message: 'User created successfully',
        data: { id: userId, role: 'COACH' },
      });
    expect(usersService.create).toHaveBeenCalledWith(
      admin,
      expect.objectContaining({ role: 'COACH' }),
      expect.any(String),
    );
  });

  it('rejects unknown identity fields before the service', async () => {
    await request(app.getHttpServer())
      .post('/users')
      .set('Authorization', 'Bearer valid-token')
      .send({
        user: {
          email: 'coach@example.com',
          password: 'strong-password',
          role: 'COACH',
          profile: { firstName: 'Bao', lastName: 'Tran' },
          authUserId: 'client-controlled',
        },
      })
      .expect(422);
    expect(usersService.create).not.toHaveBeenCalled();
  });
});
