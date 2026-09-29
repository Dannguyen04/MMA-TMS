import { HttpException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type {
  AdmissionActivationClaimResult,
  AdmissionActivationPort,
} from '../shared/contracts/admission-activation.contract.js';
import type { PublicUser } from '../users/users.model.js';
import { UsersService } from '../users/users.service.js';
import {
  SAME_PASSWORD_ERROR_CODE,
  WEAK_PASSWORD_ERROR_CODE,
} from './auth.constants.js';
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
const guestUser: PublicUser = {
  id: authenticatedUser.id,
  email: authenticatedUser.email,
  role: 'GUEST',
  isActive: true,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  deletedAt: null,
  profile: null,
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
      resetPasswordForEmail: vi.fn().mockResolvedValue({ error: null }),
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
  const requestClient = {
    auth: {
      verifyOtp: vi.fn().mockResolvedValue({
        data: { user: { id: authenticatedUser.authSubject } },
        error: null,
      }),
      updateUser: vi.fn().mockResolvedValue({
        data: { user: { id: authenticatedUser.authSubject } },
        error: null,
      }),
    },
  };
  const createRequestClient = vi.fn().mockReturnValue(requestClient);
  const admissionActivation: Record<string, ReturnType<typeof vi.fn>> = {
    claimPendingActivation: vi
      .fn()
      .mockResolvedValue({ outcome: 'NOT_APPLICABLE' } satisfies AdmissionActivationClaimResult),
    markPasswordSet: vi.fn().mockResolvedValue(undefined),
    releaseClaim: vi.fn().mockResolvedValue(undefined),
  };
  const config = {
    getOrThrow: vi.fn().mockReturnValue('https://app.example.com/reset'),
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
    registerGuest: vi.fn().mockResolvedValue(guestUser),
  };
  const service = new AuthService(
    publicClient as never,
    adminClient as never,
    createRequestClient as never,
    admissionActivation as unknown as AdmissionActivationPort,
    config as unknown as ConfigService,
    repository as unknown as AuthRepository,
    usersService as unknown as UsersService,
  );
  return {
    service,
    publicClient,
    adminClient,
    requestClient,
    createRequestClient,
    admissionActivation,
    config,
    repository,
    usersService,
  };
}

describe('AuthService', () => {
  // ── Registration ──────────────────────────────────────────────────────────

  it('registers a GUEST identity and returns the Supabase session', async () => {
    const { service, usersService } = dependencies();
    const result = await service.register(
      {
        email: authenticatedUser.email,
        password: 'strong-password',
      },
      'request-id',
    );

    expect(usersService.registerGuest).toHaveBeenCalledWith(
      {
        subject: authenticatedUser.authSubject,
        email: authenticatedUser.email,
      },
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
        },
        'request-id',
      )
      .catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(HttpException);
    expect((error as HttpException).getStatus()).toBe(409);
    expect(adminClient.auth.admin.deleteUser).not.toHaveBeenCalled();
  });

  it('cleans up created Supabase auth user when registerGuest fails', async () => {
    const { service, usersService, adminClient } = dependencies();
    usersService.registerGuest.mockRejectedValueOnce(
      new Error('auto grant failed'),
    );

    const error = await service
      .register(
        {
          email: authenticatedUser.email,
          password: 'strong-password',
        },
        'request-id',
      )
      .catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(HttpException);
    expect(adminClient.auth.admin.deleteUser).toHaveBeenCalledWith(
      authenticatedUser.authSubject,
    );
  });

  // ── Login / Refresh / Authenticate / Logout ───────────────────────────────

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

  // ── sendPasswordRecoveryEmail (§8 handover) ──────────────────────────────

  it('returns accepted true when the provider takes the recovery request', async () => {
    const { service } = dependencies();
    await expect(
      service.sendPasswordRecoveryEmail('user@example.com'),
    ).resolves.toEqual({ accepted: true });
  });

  it('returns accepted false when the provider returns an error', async () => {
    const { service, publicClient } = dependencies();
    publicClient.auth.resetPasswordForEmail.mockResolvedValueOnce({
      error: { message: 'rate limited' },
    });
    await expect(
      service.sendPasswordRecoveryEmail('user@example.com'),
    ).resolves.toEqual({ accepted: false });
  });

  it('returns accepted false when the provider throws', async () => {
    const { service, publicClient } = dependencies();
    publicClient.auth.resetPasswordForEmail.mockRejectedValueOnce(
      new Error('network down'),
    );
    await expect(
      service.sendPasswordRecoveryEmail('user@example.com'),
    ).resolves.toEqual({ accepted: false });
  });

  // ── resetPassword (§5 handover) ──────────────────────────────────────────

  it('resets a password without admission claim (non-applicant)', async () => {
    const { service, admissionActivation } = dependencies();
    const result = await service.resetPassword(
      { tokenHash: 'a'.repeat(32), newPassword: 'new-strong-password' },
      'request-id',
    );

    expect(result).toEqual({
      passwordUpdated: true,
      admissionActivationReady: false,
    });
    expect(admissionActivation.claimPendingActivation).toHaveBeenCalledWith(
      authenticatedUser.authSubject,
      'request-id',
    );
  });

  it('resets a password and marks admission activation as ready', async () => {
    const { service, admissionActivation } = dependencies();
    const claim = {
      applicationId: 'app-1',
      activationId: 'act-1',
      authSubject: authenticatedUser.authSubject,
    };
    admissionActivation.claimPendingActivation.mockResolvedValueOnce({
      outcome: 'CLAIMED',
      claim,
    });

    const result = await service.resetPassword(
      { tokenHash: 'a'.repeat(32), newPassword: 'new-strong-password' },
      'request-id',
    );

    expect(result).toEqual({
      passwordUpdated: true,
      admissionActivationReady: true,
    });
    expect(admissionActivation.markPasswordSet).toHaveBeenCalledWith(
      claim,
      'request-id',
    );
  });

  it('rejects an expired or reused recovery token with 401', async () => {
    const { service, requestClient, admissionActivation } = dependencies();
    requestClient.auth.verifyOtp.mockResolvedValueOnce({
      data: { user: null },
      error: { message: 'OTP expired' },
    });

    const error = await service
      .resetPassword(
        { tokenHash: 'expired-token-hash-long-enough', newPassword: 'pw' },
        'request-id',
      )
      .catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(HttpException);
    expect((error as HttpException).getStatus()).toBe(401);
    expect(
      ((error as HttpException).getResponse() as { code: string }).code,
    ).toBe('RESET_TOKEN_INVALID');
    expect(admissionActivation.claimPendingActivation).not.toHaveBeenCalled();
  });

  it('returns 409 when the same password is submitted', async () => {
    const { service, requestClient, admissionActivation } = dependencies();
    admissionActivation.claimPendingActivation.mockResolvedValueOnce({
      outcome: 'CLAIMED',
      claim: {
        applicationId: 'app-1',
        activationId: 'act-1',
        authSubject: authenticatedUser.authSubject,
      },
    });
    requestClient.auth.updateUser.mockResolvedValueOnce({
      data: null,
      error: { code: SAME_PASSWORD_ERROR_CODE, message: 'same password' },
    });

    const error = await service
      .resetPassword(
        { tokenHash: 'a'.repeat(32), newPassword: 'same-password' },
        'request-id',
      )
      .catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(HttpException);
    expect((error as HttpException).getStatus()).toBe(409);
    expect(
      ((error as HttpException).getResponse() as { code: string }).code,
    ).toBe('RESET_PASSWORD_SAME_AS_CURRENT');
    expect(admissionActivation.releaseClaim).toHaveBeenCalled();
  });

  it('returns 422 when the new password is too weak', async () => {
    const { service, requestClient, admissionActivation } = dependencies();
    admissionActivation.claimPendingActivation.mockResolvedValueOnce({
      outcome: 'NOT_APPLICABLE',
    });
    requestClient.auth.updateUser.mockResolvedValueOnce({
      data: null,
      error: { code: WEAK_PASSWORD_ERROR_CODE, message: 'weak' },
    });

    const error = await service
      .resetPassword(
        { tokenHash: 'a'.repeat(32), newPassword: 'weak' },
        'request-id',
      )
      .catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(HttpException);
    expect((error as HttpException).getStatus()).toBe(422);
    expect(
      ((error as HttpException).getResponse() as { code: string }).code,
    ).toBe('RESET_PASSWORD_TOO_WEAK');
  });

  it('returns 500 when DB fails after provider password change', async () => {
    vi.useFakeTimers();
    try {
      const { service, admissionActivation } = dependencies();
      const claim = {
        applicationId: 'app-1',
        activationId: 'act-1',
        authSubject: authenticatedUser.authSubject,
      };
      admissionActivation.claimPendingActivation.mockResolvedValueOnce({
        outcome: 'CLAIMED',
        claim,
      });
      admissionActivation.markPasswordSet.mockRejectedValue(
        new Error('DB down'),
      );

      let rejectedError: unknown;
      const promise = service
        .resetPassword(
          { tokenHash: 'a'.repeat(32), newPassword: 'new-strong-password' },
          'request-id',
        )
        .catch((reason: unknown) => {
          rejectedError = reason;
          return reason;
        });

      // Advance past all retry delays
      await vi.runAllTimersAsync();
      await promise;

      expect(rejectedError).toBeInstanceOf(HttpException);
      expect((rejectedError as HttpException).getStatus()).toBe(500);
      expect(
        ((rejectedError as HttpException).getResponse() as { code: string }).code,
      ).toBe('RESET_PASSWORD_CONFIRMATION_FAILED');
      // Claim is NOT released — the password was already changed
      expect(admissionActivation.releaseClaim).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('returns 409 when another request already claimed the activation', async () => {
    const { service, admissionActivation } = dependencies();
    admissionActivation.claimPendingActivation.mockResolvedValueOnce({
      outcome: 'CLAIMED_BY_ANOTHER_REQUEST',
    });

    const error = await service
      .resetPassword(
        { tokenHash: 'a'.repeat(32), newPassword: 'new-strong-password' },
        'request-id',
      )
      .catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(HttpException);
    expect((error as HttpException).getStatus()).toBe(409);
    expect(
      ((error as HttpException).getResponse() as { code: string }).code,
    ).toBe('RESET_PASSWORD_IN_PROGRESS');
  });

  it('reports activation ready when password was already set', async () => {
    const { service, admissionActivation } = dependencies();
    admissionActivation.claimPendingActivation.mockResolvedValueOnce({
      outcome: 'ALREADY_PASSWORD_SET',
    });

    const result = await service.resetPassword(
      { tokenHash: 'a'.repeat(32), newPassword: 'new-strong-password' },
      'request-id',
    );

    expect(result).toEqual({
      passwordUpdated: true,
      admissionActivationReady: true,
    });
  });
});
