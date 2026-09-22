import { HttpException } from '@nestjs/common';
import type { AuthenticatedUser } from '../shared/models/auth-context.model.js';
import { USER } from '../shared/types/user.role.js';
import { userRoleMismatch } from './users.error.js';
import type { PublicUser } from './users.model.js';
import { UsersRepository } from './users.repo.js';
import { UsersService } from './users.service.js';

const actor: AuthenticatedUser = {
  id: '516a01dc-f842-40e4-ae88-abca224921b7',
  authSubject: '8473a317-317a-4b0a-8b01-eb4e961ff52f',
  email: 'admin@example.com',
  role: USER.ADMIN,
};
const fighter: PublicUser = {
  id: '59d6ba46-32f2-4e67-b486-e966b2064328',
  email: 'fighter@example.com',
  role: USER.FIGHTER,
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
    id: 'b13d7792-fbf9-4421-a4a4-e2ed8466b4a7',
    firstName: 'An',
    lastName: 'Nguyen',
    dateOfBirth: '2000-01-01',
    weightClass: 'LIGHTWEIGHT',
  },
};

function repositoryMock() {
  const transaction = { scope: 'transaction' };
  const executeAuditContext = vi.fn().mockResolvedValue([]);
  Object.defineProperty(transaction, 'execute', {
    value: executeAuditContext,
  });
  return {
    transaction: vi.fn(
      async (work: (value: object) => Promise<unknown>): Promise<unknown> =>
        work(transaction),
    ),
    executeAuditContext,
    createUser: vi.fn().mockResolvedValue({ id: fighter.id }),
    createLocalIdentity: vi.fn().mockResolvedValue(undefined),
    createLocalCredential: vi.fn().mockResolvedValue(undefined),
    createFighter: vi.fn().mockResolvedValue(undefined),
    createRoleProfile: vi.fn().mockResolvedValue(undefined),
    findActiveById: vi.fn().mockResolvedValue(fighter),
    findEffectivePermissionCodes: vi.fn().mockResolvedValue([]),
    findActiveAssignmentFighterIds: vi.fn().mockResolvedValue([]),
    updateRoleProfile: vi.fn().mockResolvedValue(undefined),
    updateOwnProfile: vi.fn().mockResolvedValue(undefined),
    softDelete: vi.fn().mockResolvedValue(undefined),
    findPage: vi.fn().mockResolvedValue({
      items: [fighter],
      pageInfo: { hasNextPage: false, endCursor: null },
      total: 1,
    }),
    updateAccountStatus: vi.fn().mockResolvedValue(undefined),
    createInvitedUser: vi.fn().mockResolvedValue({ id: fighter.id }),
    createInvitation: vi.fn().mockResolvedValue(undefined),
  };
}

function adminClientMock() {
  return {
    auth: {
      admin: {
        createUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'e069ca8a-d0f1-44da-8bd5-48a60bf44b99' } },
          error: null,
        }),
        deleteUser: vi.fn().mockResolvedValue({ data: {}, error: null }),
      },
    },
  };
}

function configMock(provider = 'supabase') {
  return {
    get: vi.fn((key: string, fallback: unknown) =>
      key === 'AUTH_PROVIDER' ? provider : fallback,
    ),
  };
}

describe('UsersService', () => {
  it('registers a fighter profile in one database transaction', async () => {
    const repository = repositoryMock();
    const service = new UsersService(
      repository as unknown as UsersRepository,
      adminClientMock() as never,
      configMock() as never,
    );

    await expect(
      service.registerFighter(
        {
          subject: 'e069ca8a-d0f1-44da-8bd5-48a60bf44b99',
          email: fighter.email,
        },
        {
          firstName: 'An',
          lastName: 'Nguyen',
          dateOfBirth: '2000-01-01',
          weightClass: 'LIGHTWEIGHT',
        },
        'request-id',
      ),
    ).resolves.toEqual(fighter);
    expect(repository.createUser).toHaveBeenCalledWith(
      expect.any(Object),
      USER.FIGHTER,
      { scope: 'transaction' },
    );
    expect(repository.executeAuditContext).toHaveBeenCalledTimes(1);
  });

  it('uses Supabase Admin and supports creating another role', async () => {
    const repository = repositoryMock();
    const admin = adminClientMock();
    const service = new UsersService(
      repository as unknown as UsersRepository,
      admin as never,
      configMock() as never,
    );
    const input = {
      email: 'coach@example.com',
      password: 'strong-password',
      role: USER.COACH,
      profile: { firstName: 'Bao', lastName: 'Tran' },
    };

    await service.create(actor, input, 'request-id');
    expect(admin.auth.admin.createUser).toHaveBeenCalledWith({
      email: input.email,
      password: input.password,
      email_confirm: true,
    });
    expect(repository.createRoleProfile).toHaveBeenCalledWith(
      fighter.id,
      input,
      { scope: 'transaction' },
    );
  });

  it('creates a local identity and credential in the user transaction', async () => {
    const repository = repositoryMock();
    const service = new UsersService(
      repository as unknown as UsersRepository,
      null,
      configMock('local') as never,
    );
    const input = {
      email: 'coach@example.com',
      password: 'strong-password',
      role: USER.COACH,
      profile: { firstName: 'Bao', lastName: 'Tran' },
    };

    await service.create(actor, input, 'request-id');

    expect(repository.createLocalIdentity).toHaveBeenCalledWith(
      expect.any(String),
      { scope: 'transaction' },
    );
    expect(repository.createLocalCredential).toHaveBeenCalledWith(
      fighter.id,
      expect.stringMatching(/^scrypt\$/),
      { scope: 'transaction' },
    );
  });

  it('rejects an update whose profile type differs from the stored role', async () => {
    const service = new UsersService(
      repositoryMock() as unknown as UsersRepository,
      adminClientMock() as never,
      configMock() as never,
    );
    const error = await service
      .update(
        fighter.id,
        actor,
        {
          role: USER.COACH,
          profile: { firstName: 'Wrong role' },
        },
        'request-id',
      )
      .catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(HttpException);
    expect((error as HttpException).getResponse()).toEqual(
      userRoleMismatch().getResponse(),
    );
  });

  it('soft-deletes the role profile and user atomically', async () => {
    const repository = repositoryMock();
    const service = new UsersService(
      repository as unknown as UsersRepository,
      adminClientMock() as never,
      configMock() as never,
    );

    await expect(
      service.remove(fighter.id, actor, 'request-id'),
    ).resolves.toEqual({ id: fighter.id, deleted: true });
    expect(repository.softDelete).toHaveBeenCalledWith(fighter, {
      scope: 'transaction',
    });
  });

  it('derives current-user capabilities and fighter scope from persisted grants', async () => {
    const repository = repositoryMock();
    repository.findEffectivePermissionCodes.mockResolvedValue([
      'fighter:get_all',
      'fighter:read',
      'videos:upload',
      'medical:read',
    ]);
    repository.findActiveAssignmentFighterIds.mockResolvedValue([
      fighter.profile!.id,
    ]);
    const service = new UsersService(
      repository as unknown as UsersRepository,
      adminClientMock() as never,
      configMock() as never,
    );

    await expect(
      service.findMe({ ...actor, role: USER.COACH }),
    ).resolves.toMatchObject({
      effectiveCapabilities: ['fighters:read', 'videos:upload'],
      assignmentScope: { fighterIds: [fighter.profile!.id] },
    });
    expect(repository.findEffectivePermissionCodes).toHaveBeenCalledWith(
      actor.id,
      USER.COACH,
    );
  });

  it('updates the authenticated user profile atomically', async () => {
    const repository = repositoryMock();
    repository.findActiveById
      .mockResolvedValueOnce(fighter)
      .mockResolvedValueOnce({
        ...fighter,
        displayName: 'An Updated',
        phone: '+84 912 345 678',
      });
    const service = new UsersService(
      repository as unknown as UsersRepository,
      adminClientMock() as never,
      configMock() as never,
    );

    await expect(
      service.updateMe(
        { ...actor, id: fighter.id, role: USER.FIGHTER },
        { displayName: 'An Updated', phone: '+84 912 345 678' },
        'request-id',
      ),
    ).resolves.toMatchObject({
      displayName: 'An Updated',
      phone: '+84 912 345 678',
    });
    expect(repository.updateOwnProfile).toHaveBeenCalledWith(
      fighter.id,
      { displayName: 'An Updated', phone: '+84 912 345 678' },
      { scope: 'transaction' },
    );
    expect(repository.executeAuditContext).toHaveBeenCalledTimes(1);
  });

  it('returns clinical capabilities only for a doctor with effective grants', async () => {
    const repository = repositoryMock();
    repository.findEffectivePermissionCodes.mockResolvedValue([
      'medical:read',
      'medical:write',
      'clearance:manage',
      'ai_alerts:review',
    ]);
    const service = new UsersService(
      repository as unknown as UsersRepository,
      adminClientMock() as never,
      configMock() as never,
    );

    const doctor = await service.findMe({ ...actor, role: USER.DOCTOR });
    expect(doctor.effectiveCapabilities).toEqual([
      'ai_alerts:review',
      'medical:read',
      'medical:write',
      'clearance:manage',
    ]);
  });

  it('returns a cursor page from the persisted user directory', async () => {
    const repository = repositoryMock();
    const service = new UsersService(
      repository as unknown as UsersRepository,
      adminClientMock() as never,
      configMock() as never,
    );

    await expect(
      service.list({ role: USER.FIGHTER, status: 'ACTIVE', limit: 25 }),
    ).resolves.toEqual({
      items: [fighter],
      pageInfo: { hasNextPage: false, endCursor: null },
      total: 1,
    });
    expect(repository.findPage).toHaveBeenCalledWith({
      role: USER.FIGHTER,
      status: 'ACTIVE',
      limit: 25,
    });
  });

  it('prevents an administrator from suspending their own account', async () => {
    const repository = repositoryMock();
    repository.findActiveById.mockResolvedValue({ ...fighter, id: actor.id });
    const service = new UsersService(
      repository as unknown as UsersRepository,
      adminClientMock() as never,
      configMock() as never,
    );

    const error = await service
      .updateStatus(actor.id, actor, 'SUSPENDED', 'request-id')
      .catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(HttpException);
    expect((error as HttpException).getResponse()).toMatchObject({
      code: 'OWN_ACCOUNT',
    });
    expect(repository.updateAccountStatus).not.toHaveBeenCalled();
  });

  it('updates status and revokes sessions atomically', async () => {
    const repository = repositoryMock();
    repository.findActiveById
      .mockResolvedValueOnce(fighter)
      .mockResolvedValueOnce({ ...fighter, status: 'SUSPENDED' });
    const service = new UsersService(
      repository as unknown as UsersRepository,
      adminClientMock() as never,
      configMock() as never,
    );

    await expect(
      service.updateStatus(fighter.id, actor, 'SUSPENDED', 'request-id'),
    ).resolves.toMatchObject({ status: 'SUSPENDED' });
    expect(repository.updateAccountStatus).toHaveBeenCalledWith(
      fighter.id,
      'SUSPENDED',
      { scope: 'transaction' },
    );
    expect(repository.executeAuditContext).toHaveBeenCalledTimes(1);
  });

  it('creates a local invited account and hashed invitation atomically', async () => {
    const repository = repositoryMock();
    repository.findActiveById.mockResolvedValueOnce({
      ...fighter,
      status: 'INVITED',
      profile: null,
    });
    const service = new UsersService(
      repository as unknown as UsersRepository,
      null,
      configMock('local') as never,
    );
    const input = {
      name: 'Linh Nguyen',
      email: 'linh@example.com',
      role: USER.DOCTOR,
      title: 'Team Doctor',
    };

    await expect(
      service.invite(actor, input, 'request-id'),
    ).resolves.toMatchObject({ status: 'INVITED' });
    expect(repository.createLocalIdentity).toHaveBeenCalledWith(
      expect.any(String),
      { scope: 'transaction' },
    );
    expect(repository.createInvitedUser).toHaveBeenCalledWith(
      expect.objectContaining({ email: input.email }),
      input,
      { scope: 'transaction' },
    );
    expect(repository.createInvitation).toHaveBeenCalledWith(
      fighter.id,
      input.email,
      expect.stringMatching(/^[0-9a-f]{64}$/),
      expect.any(Date),
      'request-id',
      { scope: 'transaction' },
    );
  });

  it('resends an invitation only for an invited account', async () => {
    const repository = repositoryMock();
    repository.findActiveById.mockResolvedValueOnce({
      ...fighter,
      status: 'ACTIVE',
    });
    const service = new UsersService(
      repository as unknown as UsersRepository,
      null,
      configMock('local') as never,
    );

    const error = await service
      .resendInvite(fighter.id, actor, 'request-id')
      .catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(HttpException);
    expect((error as HttpException).getResponse()).toMatchObject({
      code: 'NOT_INVITED',
    });
    expect(repository.createInvitation).not.toHaveBeenCalled();
  });
});
