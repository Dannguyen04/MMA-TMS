import type { PublicUser } from '../users/users.model.js';
import type { UsersService } from '../users/users.service.js';
import type { AuthRepository } from './auth.repo.js';
import { AuthService } from './auth.service.js';
import { hashLocalPassword, hashOpaqueToken } from './local-auth.crypto.js';

const authUser = {
  id: '516a01dc-f842-40e4-ae88-abca224921b7',
  authSubject: '8473a317-317a-4b0a-8b01-eb4e961ff52f',
  email: 'fighter@example.com',
  role: 'FIGHTER' as const,
};

const publicUser: PublicUser = {
  id: authUser.id,
  email: authUser.email,
  role: authUser.role,
  isActive: true,
  status: 'ACTIVE',
  displayName: 'An Nguyen',
  phone: null,
  title: 'Fighter',
  lastActiveAt: null,
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

function localDependencies() {
  const transaction = { scope: 'transaction' };
  const repository = {
    transaction: vi.fn(async (work: (value: object) => Promise<unknown>) =>
      work(transaction),
    ),
    createLocalIdentity: vi.fn().mockResolvedValue(undefined),
    insertLocalCredential: vi.fn().mockResolvedValue(undefined),
    insertLocalSession: vi
      .fn()
      .mockResolvedValue({ id: '59d6ba46-32f2-4e67-b486-e966b2064328' }),
    touchLastActive: vi.fn().mockResolvedValue(undefined),
    findLocalCredentialByEmail: vi.fn(),
    findActiveLocalRefreshSession: vi.fn().mockResolvedValue({
      id: 'b13d7792-fbf9-4421-a4a4-e2ed8466b4a7',
      user: authUser,
    }),
    rotateLocalSession: vi.fn().mockResolvedValue(undefined),
    findActiveLocalAccessSession: vi.fn().mockResolvedValue(authUser),
    revokeLocalSession: vi.fn().mockResolvedValue(true),
    createPasswordResetRequest: vi.fn().mockResolvedValue(true),
    resolvePermissions: vi.fn().mockResolvedValue(new Map()),
  };
  const usersService = {
    registerFighter: vi.fn().mockResolvedValue(publicUser),
  };
  const config = {
    get: vi.fn((key: string, fallback: unknown) =>
      key === 'AUTH_PROVIDER' ? 'local' : fallback,
    ),
  };
  const service = new AuthService(
    null,
    null,
    repository as unknown as AuthRepository,
    usersService as unknown as UsersService,
    config as never,
  );
  return { service, repository, usersService, transaction };
}

describe('AuthService local provider', () => {
  it('registers identity, credential, app profile and hashed session atomically', async () => {
    const { service, repository, usersService, transaction } =
      localDependencies();

    const result = await service.register(
      {
        email: authUser.email,
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

    expect(result.confirmationRequired).toBe(false);
    expect(result.session?.expiresIn).toBe(900);
    expect(usersService.registerFighter).toHaveBeenCalledWith(
      expect.objectContaining({ email: authUser.email }),
      expect.any(Object),
      'request-id',
      transaction,
    );
    const passwordHash = repository.insertLocalCredential.mock.calls[0][1];
    expect(passwordHash).toMatch(/^scrypt\$/);
    expect(passwordHash).not.toContain('strong-password');
    const storedSession = repository.insertLocalSession.mock.calls[0][0];
    expect(storedSession.accessTokenHash).not.toBe(result.session?.accessToken);
    expect(storedSession.refreshTokenHash).not.toBe(
      result.session?.refreshToken,
    );
  });

  it('logs in with scrypt and stores a new opaque session', async () => {
    const { service, repository, transaction } = localDependencies();
    repository.findLocalCredentialByEmail.mockResolvedValueOnce({
      user: authUser,
      passwordHash: await hashLocalPassword('strong-password'),
    });

    await expect(
      service.login({ email: authUser.email, password: 'strong-password' }),
    ).resolves.toMatchObject({
      user: authUser,
      session: { expiresIn: 900, tokenType: 'bearer' },
    });
    expect(repository.insertLocalSession).toHaveBeenCalledTimes(1);
    expect(repository.touchLastActive).toHaveBeenCalledWith(
      authUser.id,
      transaction,
    );
  });

  it('rotates a refresh session in one transaction', async () => {
    const { service, repository, transaction } = localDependencies();
    const result = await service.refresh({
      refreshToken: 'refresh-token-that-is-long-enough',
    });

    expect(repository.findActiveLocalRefreshSession).toHaveBeenCalledWith(
      hashOpaqueToken('refresh-token-that-is-long-enough'),
      transaction,
    );
    expect(repository.rotateLocalSession).toHaveBeenCalledWith(
      'b13d7792-fbf9-4421-a4a4-e2ed8466b4a7',
      '59d6ba46-32f2-4e67-b486-e966b2064328',
      transaction,
    );
    expect(repository.touchLastActive).toHaveBeenCalledWith(
      authUser.id,
      transaction,
    );
    expect(result.session.refreshToken).not.toBe(
      'refresh-token-that-is-long-enough',
    );
  });

  it('authenticates and logs out using only token hashes', async () => {
    const { service, repository } = localDependencies();
    const token = 'opaque-access-token';

    await expect(service.authenticate(token)).resolves.toEqual(authUser);
    await expect(service.logout(token)).resolves.toEqual({ loggedOut: true });
    expect(repository.findActiveLocalAccessSession).toHaveBeenCalledWith(
      hashOpaqueToken(token),
    );
    expect(repository.revokeLocalSession).toHaveBeenCalledWith(
      hashOpaqueToken(token),
    );
  });

  it('returns the same reset response without revealing account existence', async () => {
    const { service, repository } = localDependencies();

    await expect(
      service.requestPasswordReset(authUser.email, 'request-id'),
    ).resolves.toEqual({ accepted: true });
    repository.createPasswordResetRequest.mockResolvedValueOnce(false);
    await expect(
      service.requestPasswordReset('unknown@example.com', 'request-id-2'),
    ).resolves.toEqual({ accepted: true });

    expect(repository.createPasswordResetRequest).toHaveBeenNthCalledWith(
      1,
      authUser.email,
      expect.stringMatching(/^[0-9a-f]{64}$/),
      expect.any(Date),
      'request-id',
    );
  });
});
