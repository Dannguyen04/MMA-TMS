import { HttpException } from '@nestjs/common';
import type { PublicUser } from '../users/users.model.js';
import { UsersService } from '../users/users.service.js';
import { AuthRepository } from './auth.repo.js';
import { AuthService } from './auth.service.js';

const session = {
  access_token: 'access-token',
  refresh_token: 'refresh-token-that-is-long-enough',
  expires_at: 1_800_000_000,
  expires_in: 3600,
  token_type: 'bearer',
};
const authenticatedUser = {
  id: '516a01dc-f842-40e4-ae88-abca224921b7',
  authSubject: '8473a317-317a-4b0a-8b01-eb4e961ff52f',
  email: 'fighter@example.com',
  role: 'FIGHTER' as const,
};
const publicUser: PublicUser = {
  id: authenticatedUser.id,
  email: authenticatedUser.email,
  role: 'FIGHTER',
  isActive: true,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  deletedAt: null,
  profile: {
    id: '1317a43a-05af-4f2c-bc5b-781219643b68',
    firstName: 'An',
    lastName: 'Nguyen',
    dateOfBirth: '2000-01-01',
    weightClass: 'LIGHTWEIGHT',
  },
};

function dependencies() {
  const publicClient = {
    auth: {
      signUp: vi.fn().mockResolvedValue({
        data: {
          user: {
            id: authenticatedUser.authSubject,
            email: authenticatedUser.email,
            identities: [{ id: 'email-identity' }],
          },
          session,
        },
        error: null,
      }),
      signInWithPassword: vi.fn().mockResolvedValue({
        data: {
          user: { id: authenticatedUser.authSubject },
          session,
        },
        error: null,
      }),
      refreshSession: vi.fn().mockResolvedValue({
        data: {
          user: { id: authenticatedUser.authSubject },
          session: { ...session, refresh_token: 'rotated-refresh-token' },
        },
        error: null,
      }),
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: authenticatedUser.authSubject } },
        error: null,
      }),
    },
  };
  const adminClient = {
    auth: {
      admin: {
        deleteUser: vi.fn().mockResolvedValue({ error: null }),
        signOut: vi.fn().mockResolvedValue({ error: null }),
      },
    },
  };
  const repository = {
    findActiveUserBySubject: vi.fn().mockResolvedValue(authenticatedUser),
    resolvePermissions: vi.fn().mockResolvedValue(
      new Map([
        ['users.read', true],
        ['users.delete', false],
      ]),
    ),
  };
  const usersService = {
    registerFighter: vi.fn().mockResolvedValue(publicUser),
  };
  const service = new AuthService(
    publicClient as never,
    adminClient as never,
    repository as unknown as AuthRepository,
    usersService as unknown as UsersService,
  );
  return { service, publicClient, adminClient, repository, usersService };
}

describe('AuthService', () => {
  it('registers only a FIGHTER profile and returns the Supabase session', async () => {
    const { service, usersService } = dependencies();
    const result = await service.register(
      {
        email: authenticatedUser.email,
        password: 'strong-password',
        profile: {
          firstName: 'An',
          lastName: 'Nguyen',
          dateOfBirth: '2000-01-01',
          weightClass: 'LIGHTWEIGHT',
        },
      },
      'request-id',
    );

    expect(usersService.registerFighter).toHaveBeenCalledWith(
      {
        subject: authenticatedUser.authSubject,
        email: authenticatedUser.email,
      },
      expect.any(Object),
      'request-id',
    );
    expect(result.session?.refreshToken).toBe(session.refresh_token);
  });

  it('does not delete an existing obfuscated Supabase identity', async () => {
    const { service, publicClient, adminClient } = dependencies();
    publicClient.auth.signUp.mockResolvedValueOnce({
      data: {
        user: {
          id: 'obfuscated-id',
          email: authenticatedUser.email,
          identities: [],
        },
        session: null,
      },
      error: null,
    });

    const error = await service
      .register(
        {
          email: authenticatedUser.email,
          password: 'strong-password',
          profile: {
            firstName: 'An',
            lastName: 'Nguyen',
            dateOfBirth: '2000-01-01',
            weightClass: 'LIGHTWEIGHT',
          },
        },
        'request-id',
      )
      .catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(HttpException);
    expect((error as HttpException).getStatus()).toBe(409);
    expect(adminClient.auth.admin.deleteUser).not.toHaveBeenCalled();
  });

  it('cleans up created Supabase auth user when registerFighter fails', async () => {
    const { service, usersService, adminClient } = dependencies();
    usersService.registerFighter.mockRejectedValueOnce(new Error('auto grant failed'));

    const error = await service
      .register(
        {
          email: authenticatedUser.email,
          password: 'strong-password',
          profile: {
            firstName: 'An',
            lastName: 'Nguyen',
            dateOfBirth: '2000-01-01',
            weightClass: 'LIGHTWEIGHT',
          },
        },
        'request-id',
      )
      .catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(HttpException);
    expect(adminClient.auth.admin.deleteUser).toHaveBeenCalledWith(
      authenticatedUser.authSubject,
    );
  });

  it('logs in only a mapped active application user', async () => {
    const { service } = dependencies();
    await expect(
      service.login({
        email: authenticatedUser.email,
        password: 'strong-password',
      }),
    ).resolves.toMatchObject({
      user: authenticatedUser,
      session: { accessToken: session.access_token },
    });
  });

  it('rejects and revokes a Supabase session for an inactive app user', async () => {
    const { service, repository, adminClient } = dependencies();
    repository.findActiveUserBySubject.mockResolvedValueOnce(undefined);
    const error = await service
      .login({
        email: authenticatedUser.email,
        password: 'strong-password',
      })
      .catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(HttpException);
    expect((error as HttpException).getStatus()).toBe(401);
    expect(adminClient.auth.admin.signOut).toHaveBeenCalledWith(
      session.access_token,
      'local',
    );
  });

  it('rotates refresh tokens through Supabase', async () => {
    const { service } = dependencies();
    const result = await service.refresh({
      refreshToken: session.refresh_token,
    });
    expect(result.session.refreshToken).toBe('rotated-refresh-token');
  });

  it('rejects a valid Supabase token that is not mapped to an active app user', async () => {
    const { service, repository } = dependencies();
    repository.findActiveUserBySubject.mockResolvedValueOnce(undefined);
    const error = await service
      .authenticate(session.access_token)
      .catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(HttpException);
    expect((error as HttpException).getStatus()).toBe(401);
  });

  it('logs out only the current Supabase session', async () => {
    const { service, adminClient } = dependencies();
    await expect(service.logout(session.access_token)).resolves.toEqual({
      loggedOut: true,
    });
    expect(adminClient.auth.admin.signOut).toHaveBeenCalledWith(
      session.access_token,
      'local',
    );
  });

  it('supports explicit allOf and anyOf permission semantics', async () => {
    const { service } = dependencies();
    await expect(
      service.hasPermissions(authenticatedUser, { allOf: ['users.read'] }),
    ).resolves.toBe(true);
    await expect(
      service.hasPermissions(authenticatedUser, {
        anyOf: ['users.delete', 'users.read'],
      }),
    ).resolves.toBe(true);
    await expect(
      service.hasPermissions(authenticatedUser, {
        allOf: ['users.read'],
        anyOf: ['users.delete'],
      }),
    ).resolves.toBe(false);
    await expect(
      service.hasPermissions(authenticatedUser, {
        allOf: ['unknown.permission'],
      }),
    ).resolves.toBe(false);
  });
});
