import { HttpException } from '@nestjs/common';
import type { DatabaseExecutor } from '../shared/utils/audit-context.util.js';
import type { AuthenticatedUser } from '../shared/models/auth-context.model.js';
import { AuthorizationRepository } from './authorization.repo.js';
import { AuthorizationService } from './authorization.service.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const adminActor: AuthenticatedUser = {
  id: 'admin-user-id',
  authSubject: 'admin-auth-subject',
  email: 'admin@example.com',
  role: 'ADMIN',
};

const REQUEST_ID = 'test-request-id';

const userPermRow = {
  id: 'up-id',
  userId: 'target-user-id',
  permissionId: 'perm-id',
  isGranted: true,
  grantedBy: 'admin-user-id',
  createdAt: new Date('2026-01-01T00:00:00Z'),
};

const rolePermRow = {
  id: 'rp-id',
  role: 'FIGHTER' as const,
  permissionId: 'perm-id',
  createdAt: new Date('2026-01-01T00:00:00Z'),
};

// ---------------------------------------------------------------------------
// Repository mock factory
// ---------------------------------------------------------------------------

function makeRepo(callOrder?: string[]): AuthorizationRepository {
  const tx = {
    execute: vi.fn().mockImplementation(async () => {
      callOrder?.push('setAuditContext');
      return [];
    }),
  } as unknown as DatabaseExecutor;
  const repo = {
    transaction: vi.fn((work: (tx: DatabaseExecutor) => Promise<unknown>) =>
      work(tx),
    ),
    findPermissionIdsByCodes: vi
      .fn()
      .mockResolvedValue(new Map([['users.profile.read', 'perm-id']])),
    upsertUserPermission: vi.fn().mockResolvedValue(userPermRow),
    deleteUserPermissionOverride: vi.fn().mockResolvedValue(userPermRow),
    upsertRolePermission: vi.fn().mockResolvedValue(rolePermRow),
    deleteRolePermission: vi.fn().mockResolvedValue(rolePermRow),
  } as unknown as AuthorizationRepository;
  return repo;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AuthorizationService', () => {
  // -------------------------------------------------------------------------
  // setUserPermissionOverride
  // -------------------------------------------------------------------------
  describe('setUserPermissionOverride', () => {
    it('calls setAuditContext before any repo operation', async () => {
      const callOrder: string[] = [];
      const repo = makeRepo(callOrder);
      (
        repo.upsertUserPermission as ReturnType<typeof vi.fn>
      ).mockImplementation(async () => {
        callOrder.push('upsert');
        return userPermRow;
      });
      const service = new AuthorizationService(repo);
      await service.setUserPermissionOverride(
        { userId: 'u', permissionCode: 'users.profile.read' },
        { isGranted: true },
        adminActor,
        REQUEST_ID,
      );
      expect(callOrder).toEqual(['setAuditContext', 'upsert']);
    });

    it('throws permissionNotFound when code is not in catalogue', async () => {
      const repo = makeRepo();
      (
        repo.findPermissionIdsByCodes as ReturnType<typeof vi.fn>
      ).mockResolvedValue(new Map());
      const service = new AuthorizationService(repo);
      const err = await service
        .setUserPermissionOverride(
          { userId: 'u', permissionCode: 'unknown.code' },
          { isGranted: true },
          adminActor,
          REQUEST_ID,
        )
        .catch((e: unknown) => e);
      expect(err).toBeInstanceOf(HttpException);
      expect((err as HttpException).getStatus()).toBe(404);
    });

    it('updates the same override between explicit grant and explicit deny', async () => {
      const repo = makeRepo();
      (
        repo.findPermissionIdsByCodes as ReturnType<typeof vi.fn>
      ).mockResolvedValue(new Map([['users.profile.read', 'perm-id']]));
      (repo.upsertUserPermission as ReturnType<typeof vi.fn>).mockResolvedValue(
        userPermRow,
      );
      const service = new AuthorizationService(repo);
      await service.setUserPermissionOverride(
        { userId: 'u', permissionCode: 'users.profile.read' },
        { isGranted: true },
        adminActor,
        REQUEST_ID,
      );
      await service.setUserPermissionOverride(
        { userId: 'u', permissionCode: 'users.profile.read' },
        { isGranted: false },
        adminActor,
        REQUEST_ID,
      );
      expect(repo.upsertUserPermission).toHaveBeenCalledTimes(2);
      expect(repo.upsertUserPermission).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ isGranted: true }),
        expect.anything(),
      );
      expect(repo.upsertUserPermission).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ isGranted: false }),
        expect.anything(),
      );
    });

    it('sets grantedBy to actor.id — not from request body', async () => {
      const repo = makeRepo();
      (
        repo.findPermissionIdsByCodes as ReturnType<typeof vi.fn>
      ).mockResolvedValue(new Map([['users.profile.read', 'perm-id']]));
      const service = new AuthorizationService(repo);
      await service.setUserPermissionOverride(
        { userId: 'u', permissionCode: 'users.profile.read' },
        { isGranted: false },
        adminActor,
        REQUEST_ID,
      );
      expect(repo.upsertUserPermission).toHaveBeenCalledWith(
        expect.objectContaining({
          grantedBy: adminActor.id,
          isGranted: false,
        }),
        expect.anything(),
      );
    });

    it('returns the persisted explicit-deny state', async () => {
      const repo = makeRepo();
      (repo.upsertUserPermission as ReturnType<typeof vi.fn>).mockResolvedValue(
        { ...userPermRow, isGranted: false },
      );
      const service = new AuthorizationService(repo);

      await expect(
        service.setUserPermissionOverride(
          { userId: 'u', permissionCode: 'users.profile.read' },
          { isGranted: false },
          adminActor,
          REQUEST_ID,
        ),
      ).resolves.toMatchObject({ isGranted: false });
    });

    it('maps an unknown-user foreign-key failure to a stable error', async () => {
      const repo = makeRepo();
      (repo.upsertUserPermission as ReturnType<typeof vi.fn>).mockRejectedValue(
        { code: '23503', detail: 'database detail' },
      );
      const service = new AuthorizationService(repo);

      const error = await service
        .setUserPermissionOverride(
          { userId: 'unknown-user', permissionCode: 'users.profile.read' },
          { isGranted: true },
          adminActor,
          REQUEST_ID,
        )
        .catch((reason: unknown) => reason);

      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(500);
      expect((error as HttpException).getResponse()).toEqual({
        statusCode: 500,
        error: 'Internal Server Error',
        code: 'PERMISSION_GRANT_FAILED',
        message: 'Failed to apply the permission change',
      });
      expect(
        JSON.stringify((error as HttpException).getResponse()),
      ).not.toContain('database detail');
    });
  });

  // -------------------------------------------------------------------------
  // removeUserPermissionOverride
  // -------------------------------------------------------------------------
  describe('removeUserPermissionOverride', () => {
    it('calls setAudit before delete', async () => {
      const callOrder: string[] = [];
      const repo = makeRepo(callOrder);
      (
        repo.deleteUserPermissionOverride as ReturnType<typeof vi.fn>
      ).mockImplementation(async () => {
        callOrder.push('delete');
        return userPermRow;
      });
      const service = new AuthorizationService(repo);
      await service.removeUserPermissionOverride(
        { userId: 'u', permissionCode: 'users.profile.read' },
        adminActor,
        REQUEST_ID,
      );
      expect(callOrder).toEqual(['setAuditContext', 'delete']);
    });

    it('completes when override exists', async () => {
      const repo = makeRepo();
      (
        repo.findPermissionIdsByCodes as ReturnType<typeof vi.fn>
      ).mockResolvedValue(new Map([['users.profile.read', 'perm-id']]));
      const service = new AuthorizationService(repo);
      await expect(
        service.removeUserPermissionOverride(
          { userId: 'u', permissionCode: 'users.profile.read' },
          adminActor,
          REQUEST_ID,
        ),
      ).resolves.toBeUndefined();
    });

    it('throws assignmentNotFound when no override exists', async () => {
      const repo = makeRepo();
      (
        repo.findPermissionIdsByCodes as ReturnType<typeof vi.fn>
      ).mockResolvedValue(new Map([['users.profile.read', 'perm-id']]));
      (
        repo.deleteUserPermissionOverride as ReturnType<typeof vi.fn>
      ).mockResolvedValue(undefined);
      const service = new AuthorizationService(repo);
      const err = await service
        .removeUserPermissionOverride(
          { userId: 'u', permissionCode: 'users.profile.read' },
          adminActor,
          REQUEST_ID,
        )
        .catch((e: unknown) => e);
      expect(err).toBeInstanceOf(HttpException);
      expect((err as HttpException).getStatus()).toBe(404);
    });
  });

  // -------------------------------------------------------------------------
  // grantRolePermission
  // -------------------------------------------------------------------------
  describe('grantRolePermission', () => {
    it('calls setAudit before upsert', async () => {
      const callOrder: string[] = [];
      const repo = makeRepo(callOrder);
      (
        repo.upsertRolePermission as ReturnType<typeof vi.fn>
      ).mockImplementation(async () => {
        callOrder.push('upsert');
        return rolePermRow;
      });
      (
        repo.findPermissionIdsByCodes as ReturnType<typeof vi.fn>
      ).mockResolvedValue(new Map([['fighter:read', 'perm-id']]));
      const service = new AuthorizationService(repo);
      await service.grantRolePermission(
        { role: 'FIGHTER', permissionCode: 'fighter:read' },
        adminActor,
        REQUEST_ID,
      );
      expect(callOrder).toEqual(['setAuditContext', 'upsert']);
    });

    it('is idempotent — re-granting does not throw', async () => {
      const repo = makeRepo();
      (
        repo.findPermissionIdsByCodes as ReturnType<typeof vi.fn>
      ).mockResolvedValue(new Map([['fighter:read', 'perm-id']]));
      (repo.upsertRolePermission as ReturnType<typeof vi.fn>).mockResolvedValue(
        rolePermRow,
      );
      const service = new AuthorizationService(repo);
      await service.grantRolePermission(
        { role: 'FIGHTER', permissionCode: 'fighter:read' },
        adminActor,
        REQUEST_ID,
      );
      await service.grantRolePermission(
        { role: 'FIGHTER', permissionCode: 'fighter:read' },
        adminActor,
        REQUEST_ID,
      );
      expect(repo.upsertRolePermission).toHaveBeenCalledTimes(2);
    });
  });

  // -------------------------------------------------------------------------
  // revokeRolePermission
  // -------------------------------------------------------------------------
  describe('revokeRolePermission', () => {
    it('calls setAudit before delete', async () => {
      const callOrder: string[] = [];
      const repo = makeRepo(callOrder);
      (
        repo.deleteRolePermission as ReturnType<typeof vi.fn>
      ).mockImplementation(async () => {
        callOrder.push('delete');
        return rolePermRow;
      });
      (
        repo.findPermissionIdsByCodes as ReturnType<typeof vi.fn>
      ).mockResolvedValue(new Map([['fighter:read', 'perm-id']]));
      const service = new AuthorizationService(repo);
      await service.revokeRolePermission(
        { role: 'FIGHTER', permissionCode: 'fighter:read' },
        adminActor,
        REQUEST_ID,
      );
      expect(callOrder).toEqual(['setAuditContext', 'delete']);
    });

    it('throws assignmentNotFound when role permission does not exist', async () => {
      const repo = makeRepo();
      (
        repo.findPermissionIdsByCodes as ReturnType<typeof vi.fn>
      ).mockResolvedValue(new Map([['fighter:read', 'perm-id']]));
      (repo.deleteRolePermission as ReturnType<typeof vi.fn>).mockResolvedValue(
        undefined,
      );
      const service = new AuthorizationService(repo);
      const err = await service
        .revokeRolePermission(
          { role: 'FIGHTER', permissionCode: 'fighter:read' },
          adminActor,
          REQUEST_ID,
        )
        .catch((e: unknown) => e);
      expect(err).toBeInstanceOf(HttpException);
      expect((err as HttpException).getStatus()).toBe(404);
    });
  });
});
