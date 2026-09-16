import { HttpException } from '@nestjs/common';
import type { AuthenticatedUser } from '../shared/models/auth-context.model.js';
import { USER } from '../shared/types/user.role.js';
import { USER_ERROR } from './users.error.js';
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
  return {
    transaction: vi.fn(
      async (work: (value: object) => Promise<unknown>): Promise<unknown> =>
        work(transaction),
    ),
    setAuditContext: vi.fn().mockResolvedValue(undefined),
    createUser: vi.fn().mockResolvedValue({ id: fighter.id }),
    createFighter: vi.fn().mockResolvedValue(undefined),
    createRoleProfile: vi.fn().mockResolvedValue(undefined),
    findActiveById: vi.fn().mockResolvedValue(fighter),
    updateRoleProfile: vi.fn().mockResolvedValue(undefined),
    softDelete: vi.fn().mockResolvedValue(undefined),
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

describe('UsersService', () => {
  it('registers a fighter profile in one database transaction', async () => {
    const repository = repositoryMock();
    const service = new UsersService(
      repository as unknown as UsersRepository,
      adminClientMock() as never,
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
  });

  it('uses Supabase Admin and supports creating another role', async () => {
    const repository = repositoryMock();
    const admin = adminClientMock();
    const service = new UsersService(
      repository as unknown as UsersRepository,
      admin as never,
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

  it('rejects an update whose profile type differs from the stored role', async () => {
    const service = new UsersService(
      repositoryMock() as unknown as UsersRepository,
      adminClientMock() as never,
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
    expect((error as HttpException).getResponse()).toMatchObject({
      code: USER_ERROR.ROLE_MISMATCH.code,
    });
  });

  it('soft-deletes the role profile and user atomically', async () => {
    const repository = repositoryMock();
    const service = new UsersService(
      repository as unknown as UsersRepository,
      adminClientMock() as never,
    );

    await expect(
      service.remove(fighter.id, actor, 'request-id'),
    ).resolves.toEqual({ id: fighter.id, deleted: true });
    expect(repository.softDelete).toHaveBeenCalledWith(fighter, {
      scope: 'transaction',
    });
  });
});
