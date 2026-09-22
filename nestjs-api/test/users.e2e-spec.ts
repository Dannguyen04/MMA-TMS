import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import request from 'supertest';
import { AUTH_ACCESS_SERVICE } from '../src/shared/contracts/auth-access.contract.js';
import {
  AUTHENTICATED_ENDPOINT,
  REQUIRED_PERMISSIONS,
  REQUIRED_ROLES,
} from '../src/shared/decorators/auth.decorator.js';
import { ApiExceptionFilter } from '../src/shared/filters/api-exception.filter.js';
import { ApiResponseInterceptor } from '../src/shared/interceptors/api-response.interceptor.js';
import {
  AccessTokenGuard,
  AuthorizationGuard,
} from '../src/shared/guards/auth.guard.js';
import { UsersController } from '../src/users/users.controller.js';
import { USER_PERMISSIONS } from '../src/users/users.model.js';
import { UsersService } from '../src/users/users.service.js';

const userId = '59d6ba46-32f2-4e67-b486-e966b2064328';
const admin = {
  id: '516a01dc-f842-40e4-ae88-abca224921b7',
  authSubject: '8473a317-317a-4b0a-8b01-eb4e961ff52f',
  email: 'admin@example.com',
  role: 'ADMIN' as const,
};

describe('UsersController authorization (e2e)', () => {
  let app: INestApplication;
  const usersService = {
    create: vi.fn(),
    invite: vi.fn(),
    findMe: vi.fn(),
    updateMe: vi.fn(),
    list: vi.fn(),
    findOne: vi.fn(),
    update: vi.fn(),
    updateStatus: vi.fn(),
    resendInvite: vi.fn(),
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

  it('declares a concrete permission for every Users route', () => {
    const reflector = app.get(Reflector);
    const permissionFor = (handler: (...args: never[]) => unknown) =>
      reflector.get(REQUIRED_PERMISSIONS, handler);

    expect(reflector.get(REQUIRED_ROLES, UsersController)).toBeUndefined();
    expect(permissionFor(UsersController.prototype.create)).toEqual({
      allOf: [USER_PERMISSIONS.CREATE],
    });
    expect(permissionFor(UsersController.prototype.invite)).toEqual({
      allOf: [USER_PERMISSIONS.CREATE],
    });
    expect(permissionFor(UsersController.prototype.findMe)).toBeUndefined();
    expect(
      reflector.get(AUTHENTICATED_ENDPOINT, UsersController.prototype.findMe),
    ).toBe(true);
    expect(permissionFor(UsersController.prototype.updateMe)).toEqual({
      allOf: [USER_PERMISSIONS.PROFILE_READ],
    });
    expect(permissionFor(UsersController.prototype.list)).toEqual({
      allOf: [USER_PERMISSIONS.READ],
    });
    expect(permissionFor(UsersController.prototype.findOne)).toEqual({
      allOf: [USER_PERMISSIONS.READ],
    });
    expect(permissionFor(UsersController.prototype.update)).toEqual({
      allOf: [USER_PERMISSIONS.UPDATE],
    });
    expect(permissionFor(UsersController.prototype.updateStatus)).toEqual({
      allOf: [USER_PERMISSIONS.UPDATE],
    });
    expect(permissionFor(UsersController.prototype.resendInvite)).toEqual({
      allOf: [USER_PERMISSIONS.UPDATE],
    });
    expect(permissionFor(UsersController.prototype.remove)).toEqual({
      allOf: [USER_PERMISSIONS.DELETE],
    });
  });

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
      message: 'Get user successfully',
      data: { id: userId, role: 'COACH' },
    });
    expect(authService.hasPermissions).toHaveBeenCalled();
    expect(usersService.findOne).toHaveBeenCalledWith(userId);
  });

  it('lets any authenticated user read their own profile', async () => {
    const coach = { ...admin, role: 'COACH' as const };
    authService.authenticate.mockResolvedValueOnce(coach);
    usersService.findMe.mockResolvedValueOnce({
      id: coach.id,
      role: 'COACH',
      effectiveCapabilities: [],
      assignmentScope: { fighterIds: [] },
    });

    await request(app.getHttpServer())
      .get('/users/me')
      .set('Authorization', 'Bearer valid-token')
      .expect(200);

    expect(authService.hasPermissions).not.toHaveBeenCalled();
    expect(usersService.findMe).toHaveBeenCalledWith(coach);
  });

  it('updates only the authenticated user display profile', async () => {
    usersService.updateMe.mockResolvedValueOnce({
      id: admin.id,
      displayName: 'Nora Updated',
      phone: '+84 912 345 678',
    });

    await request(app.getHttpServer())
      .patch('/users/me')
      .set('Authorization', 'Bearer valid-token')
      .send({ displayName: 'Nora Updated', phone: '+84 912 345 678' })
      .expect(200)
      .expect({
        success: true,
        message: 'Current user profile updated successfully',
        data: {
          id: admin.id,
          displayName: 'Nora Updated',
          phone: '+84 912 345 678',
        },
      });

    expect(usersService.updateMe).toHaveBeenCalledWith(
      admin,
      { displayName: 'Nora Updated', phone: '+84 912 345 678' },
      expect.any(String),
    );
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

  it('returns a cursor-paginated user directory', async () => {
    usersService.list.mockResolvedValueOnce({
      items: [{ id: userId, role: 'COACH', status: 'ACTIVE' }],
      pageInfo: { hasNextPage: false, endCursor: null },
      total: 1,
    });

    const response = await request(app.getHttpServer())
      .get('/users?role=COACH&status=ACTIVE&limit=25')
      .set('Authorization', 'Bearer valid-token')
      .expect(200);

    expect(response.body).toEqual({
      success: true,
      message: 'Get users successfully',
      data: {
        items: [{ id: userId, role: 'COACH', status: 'ACTIVE' }],
        pageInfo: { hasNextPage: false, endCursor: null },
        total: 1,
      },
    });
    expect(usersService.list).toHaveBeenCalledWith({
      role: 'COACH',
      status: 'ACTIVE',
      limit: 25,
    });
  });

  it('updates account status with the authenticated actor', async () => {
    usersService.updateStatus.mockResolvedValueOnce({
      id: userId,
      role: 'COACH',
      status: 'SUSPENDED',
    });

    await request(app.getHttpServer())
      .patch(`/users/${userId}/status`)
      .set('Authorization', 'Bearer valid-token')
      .send({ status: 'SUSPENDED' })
      .expect(200)
      .expect({
        success: true,
        message: 'User status updated successfully',
        data: { id: userId, role: 'COACH', status: 'SUSPENDED' },
      });

    expect(usersService.updateStatus).toHaveBeenCalledWith(
      userId,
      admin,
      'SUSPENDED',
      expect.any(String),
    );
  });

  it('creates an invitation without accepting a caller-controlled password', async () => {
    usersService.invite.mockResolvedValueOnce({
      id: userId,
      role: 'DOCTOR',
      status: 'INVITED',
    });

    await request(app.getHttpServer())
      .post('/users/invite')
      .set('Authorization', 'Bearer valid-token')
      .send({
        name: 'Linh Nguyen',
        email: 'linh@example.com',
        role: 'DOCTOR',
        title: 'Team Doctor',
      })
      .expect(201)
      .expect({
        success: true,
        message: 'User invitation created successfully',
        data: { id: userId, role: 'DOCTOR', status: 'INVITED' },
      });

    expect(usersService.invite).toHaveBeenCalledWith(
      admin,
      expect.not.objectContaining({ password: expect.anything() }),
      expect.any(String),
    );
  });

  it('resends an invitation for the requested account', async () => {
    usersService.resendInvite.mockResolvedValueOnce({
      id: userId,
      role: 'DOCTOR',
      status: 'INVITED',
    });

    await request(app.getHttpServer())
      .post(`/users/${userId}/resend-invite`)
      .set('Authorization', 'Bearer valid-token')
      .expect(200)
      .expect({
        success: true,
        message: 'User invitation resent successfully',
        data: { id: userId, role: 'DOCTOR', status: 'INVITED' },
      });
    expect(usersService.resendInvite).toHaveBeenCalledWith(
      userId,
      admin,
      expect.any(String),
    );
  });
});
