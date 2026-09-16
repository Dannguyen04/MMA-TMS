import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import request from 'supertest';
import { App } from 'supertest/types';
import { AuthController } from '../src/auth/auth.controller.js';
import { AuthService } from '../src/auth/auth.service.js';
import { AUTH_ACCESS_SERVICE } from '../src/shared/contracts/auth-access.contract.js';
import { ApiExceptionFilter } from '../src/shared/filters/api-exception.filter.js';
import { AccessTokenGuard } from '../src/shared/guards/auth.guard.js';
import { ApiResponseInterceptor } from '../src/shared/interceptors/api-response.interceptor.js';
import { AppValidationPipe } from '../src/shared/pipes/app-validation.pipe.js';

describe('AuthController (e2e)', () => {
  let app: INestApplication<App>;
  const authService = {
    register: vi.fn(),
    login: vi.fn(),
    refresh: vi.fn(),
    logout: vi.fn(),
    authenticate: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    authService.authenticate.mockResolvedValue({
      id: '516a01dc-f842-40e4-ae88-abca224921b7',
      authSubject: '8473a317-317a-4b0a-8b01-eb4e961ff52f',
      email: 'fighter@example.com',
      role: 'FIGHTER',
    });

    const moduleFixture = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot([{ ttl: 60_000, limit: 60 }])],
      controllers: [AuthController],
      providers: [
        AccessTokenGuard,
        { provide: AuthService, useValue: authService },
        { provide: AUTH_ACCESS_SERVICE, useValue: authService },
      ],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new AppValidationPipe());
    app.useGlobalFilters(new ApiExceptionFilter());
    app.useGlobalInterceptors(new ApiResponseInterceptor(app.get(Reflector)));
    await app.init();
  });

  afterEach(async () => app.close());

  it('registers a default fighter profile', async () => {
    authService.register.mockResolvedValue({
      user: { role: 'FIGHTER' },
      session: null,
      confirmationRequired: true,
    });
    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'fighter@example.com',
        password: 'strong-password',
        profile: {
          firstName: 'An',
          lastName: 'Nguyen',
          dateOfBirth: '2000-01-01',
          weightClass: 'LIGHTWEIGHT',
        },
      })
      .expect(201);
    expect(response.body).toEqual({
      success: true,
      message: 'Account registered successfully',
      data: {
        user: { role: 'FIGHTER' },
        session: null,
        confirmationRequired: true,
      },
    });
    expect(authService.register).toHaveBeenCalledWith(
      expect.not.objectContaining({ role: expect.anything() }),
      expect.any(String),
    );
  });

  it('rejects malformed login input before the service', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'not-an-email', password: 'short' })
      .expect(422);
    expect(response.body).toMatchObject({
      success: false,
      error: {
        statusCode: 422,
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
      },
    });
    expect(response.body.error.details).toBeInstanceOf(Array);
    expect(authService.login).not.toHaveBeenCalled();
  });

  it('does not expose unexpected internal errors', async () => {
    authService.login.mockRejectedValueOnce(
      new Error('database connection string must stay private'),
    );

    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'fighter@example.com',
        password: 'strong-password',
      })
      .expect(500);

    expect(response.body).toEqual({
      success: false,
      error: {
        statusCode: 500,
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Internal server error',
      },
    });
    expect(JSON.stringify(response.body)).not.toContain('connection string');
  });

  it('passes a refresh token only to the refresh use case', async () => {
    authService.refresh.mockResolvedValue({ session: { accessToken: 'new' } });
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: 'r'.repeat(40) })
      .expect(200);
    expect(authService.refresh).toHaveBeenCalledWith({
      refreshToken: 'r'.repeat(40),
    });
  });

  it('requires a valid access token before logout', async () => {
    await request(app.getHttpServer()).post('/auth/logout').expect(401);
    expect(authService.logout).not.toHaveBeenCalled();

    authService.logout.mockResolvedValue(undefined);
    const response = await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Authorization', 'Bearer valid-access-token')
      .expect(200);
    expect(response.body).toEqual({
      success: true,
      message: 'Logout successful',
    });
    expect(response.body).not.toHaveProperty('data');
    expect(authService.logout).toHaveBeenCalledWith('valid-access-token');
  });

  it('rate-limits repeated login attempts', async () => {
    authService.login.mockResolvedValue({ user: {}, session: {} });
    const login = () =>
      request(app.getHttpServer()).post('/auth/login').send({
        email: 'fighter@example.com',
        password: 'strong-password',
      });

    for (let attempt = 0; attempt < 10; attempt += 1) {
      await login().expect(200);
    }
    await login().expect(429);
  });
});
