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
    isAssignableUser: vi.fn().mockResolvedValue(true),
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

    it('throws userNotFound when target user is nonexistent or ineligible', async () => {
      const repo = makeRepo();
      (repo.isAssignableUser as ReturnType<typeof vi.fn>).mockResolvedValue(false);
      const service = new AuthorizationService(repo);

      const err = await service
        .setUserPermissionOverride(
          { userId: 'missing-or-inactive-user', permissionCode: 'users.profile.read' },
          { isGranted: true },
          adminActor,
          REQUEST_ID,
        )
        .catch((e: unknown) => e);

      expect(err).toBeInstanceOf(HttpException);
      expect((err as HttpException).getStatus()).toBe(404);
      expect((err as HttpException).getResponse()).toEqual({
        statusCode: 404,
        error: 'Not Found',
        code: 'USER_NOT_FOUND',
        message: 'User not found',
      });
      expect(repo.upsertUserPermission).not.toHaveBeenCalled();
    });

    it('resolves permission code before checking target user (ordering contract)', async () => {
      const repo = makeRepo();
      (repo.findPermissionIdsByCodes as ReturnType<typeof vi.fn>).mockResolvedValue(new Map());
      (repo.isAssignableUser as ReturnType<typeof vi.fn>).mockResolvedValue(false);
      const service = new AuthorizationService(repo);

      const err = await service
        .setUserPermissionOverride(
          { userId: 'missing-user', permissionCode: 'unknown.code' },
          { isGranted: true },
          adminActor,
          REQUEST_ID,
        )
        .catch((e: unknown) => e);

      expect(err).toBeInstanceOf(HttpException);
      expect((err as HttpException).getStatus()).toBe(404);
      expect((err as HttpException).getResponse()).toMatchObject({
        code: 'PERMISSION_NOT_FOUND',
      });
      // The user check must NOT run if the permission code failed to resolve
      expect(repo.isAssignableUser).not.toHaveBeenCalled();
    });

    it('allows a per-user override where the target user is an ADMIN with isGranted: false', async () => {
      const repo = makeRepo();
      const adminTargetUserId = 'another-admin-user-id';
      (repo.upsertUserPermission as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...userPermRow,
        userId: adminTargetUserId,
        isGranted: false,
      });
      const service = new AuthorizationService(repo);

      const result = await service.setUserPermissionOverride(
        { userId: adminTargetUserId, permissionCode: 'users.profile.read' },
        { isGranted: false },
        adminActor,
        REQUEST_ID,
      );

      expect(result).toMatchObject({
        userId: adminTargetUserId,
        isGranted: false,
      });
      expect(repo.upsertUserPermission).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: adminTargetUserId,
          isGranted: false,
          grantedBy: adminActor.id,
        }),
        expect.anything(),
      );
    });

    it('maps user_permissions_user_id_fkey FK race to 404 USER_NOT_FOUND without leaking DB details', async () => {
      const repo = makeRepo();
      (repo.upsertUserPermission as ReturnType<typeof vi.fn>).mockRejectedValue({
        code: '23503',
        constraint: 'user_permissions_user_id_fkey',
        table: 'user_permissions',
        detail: 'Key (user_id)=(missing) is not present in table "users".',
      });
      const service = new AuthorizationService(repo);

      const error = await service
        .setUserPermissionOverride(
          { userId: 'raced-user', permissionCode: 'users.profile.read' },
          { isGranted: true },
          adminActor,
          REQUEST_ID,
        )
        .catch((reason: unknown) => reason);

      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(404);
      expect((error as HttpException).getResponse()).toEqual({
        statusCode: 404,
        error: 'Not Found',
        code: 'USER_NOT_FOUND',
        message: 'User not found',
      });
      const serialized = JSON.stringify((error as HttpException).getResponse());
      expect(serialized).not.toContain('user_permissions_user_id_fkey');
      expect(serialized).not.toContain('table');
      expect(serialized).not.toContain('detail');
    });

    it.each([
      'user_permissions_granted_by_fkey',
      'user_permissions_permission_id_fkey',
      'unknown_constraint',
    ])('maps 23503 on %s to 500 PERMISSION_GRANT_FAILED (never 404)', async (constraint) => {
      const repo = makeRepo();
      (repo.upsertUserPermission as ReturnType<typeof vi.fn>).mockRejectedValue({
        code: '23503',
        constraint,
      });
      const service = new AuthorizationService(repo);

      const error = await service
        .setUserPermissionOverride(
          { userId: 'u', permissionCode: 'users.profile.read' },
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

    it('throws assignmentNotFound when no override exists (including nonexistent user)', async () => {
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
          { userId: 'nonexistent-user-id', permissionCode: 'users.profile.read' },
          adminActor,
          REQUEST_ID,
        )
        .catch((e: unknown) => e);
      expect(err).toBeInstanceOf(HttpException);
      expect((err as HttpException).getStatus()).toBe(404);
      expect((err as HttpException).getResponse()).toMatchObject({
        code: 'ASSIGNMENT_NOT_FOUND',
      });
      // Crucial: eligibility must NOT be checked on DELETE
      expect(repo.isAssignableUser).not.toHaveBeenCalled();
    });

    it('removes override for a deactivated user that has an existing override', async () => {
      const repo = makeRepo();
      (
        repo.findPermissionIdsByCodes as ReturnType<typeof vi.fn>
      ).mockResolvedValue(new Map([['users.profile.read', 'perm-id']]));
      (
        repo.deleteUserPermissionOverride as ReturnType<typeof vi.fn>
      ).mockResolvedValue(userPermRow);
      const service = new AuthorizationService(repo);

      await expect(
        service.removeUserPermissionOverride(
          { userId: 'deactivated-user-id', permissionCode: 'users.profile.read' },
          adminActor,
          REQUEST_ID,
        ),
      ).resolves.toBeUndefined();
      expect(repo.deleteUserPermissionOverride).toHaveBeenCalled();
      expect(repo.isAssignableUser).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // grantRolePermission
  // -------------------------------------------------------------------------
  describe('grantRolePermission', () => {
    it('throws 403 FORBIDDEN when attempting to grant permission to ADMIN role', async () => {
      const callOrder: string[] = [];
      const repo = makeRepo(callOrder);
      const service = new AuthorizationService(repo);

      const err = await service
        .grantRolePermission(
          { role: 'ADMIN', permissionCode: 'users.profile.read' },
          adminActor,
          REQUEST_ID,
        )
        .catch((e: unknown) => e);

      expect(err).toBeInstanceOf(HttpException);
      expect((err as HttpException).getStatus()).toBe(403);
      expect((err as HttpException).getResponse()).toMatchObject({
        code: 'FORBIDDEN',
      });
      // No transaction, no audit context, no repo mutation
      expect(repo.transaction).not.toHaveBeenCalled();
      expect(callOrder).toHaveLength(0);
      expect(repo.upsertRolePermission).not.toHaveBeenCalled();
    });

    it('rejects ADMIN role even if the grant already exists or permission is unknown', async () => {
      const repo = makeRepo();
      const service = new AuthorizationService(repo);

      await expect(
        service.grantRolePermission(
          { role: 'ADMIN', permissionCode: 'completely.unknown.permission' },
          adminActor,
          REQUEST_ID,
        ),
      ).rejects.toMatchObject({ status: 403 });
      expect(repo.findPermissionIdsByCodes).not.toHaveBeenCalled();
    });

    it('calls setAudit before upsert for valid roles', async () => {
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

    it.each(['FIGHTER', 'COACH', 'DOCTOR'] as const)(
      'is idempotent — granting to role %s returns 200',
      async (role) => {
        const repo = makeRepo();
        (
          repo.findPermissionIdsByCodes as ReturnType<typeof vi.fn>
        ).mockResolvedValue(new Map([['perm.code', 'perm-id']]));
        (repo.upsertRolePermission as ReturnType<typeof vi.fn>).mockResolvedValue({
          ...rolePermRow,
          role,
        });
        const service = new AuthorizationService(repo);
        const res1 = await service.grantRolePermission(
          { role, permissionCode: 'perm.code' },
          adminActor,
          REQUEST_ID,
        );
        const res2 = await service.grantRolePermission(
          { role, permissionCode: 'perm.code' },
          adminActor,
          REQUEST_ID,
        );
        expect(res1.role).toBe(role);
        expect(res2.role).toBe(role);
        expect(repo.upsertRolePermission).toHaveBeenCalledTimes(2);
      },
    );
  });

  // -------------------------------------------------------------------------
  // revokeRolePermission
  // -------------------------------------------------------------------------
  describe('revokeRolePermission', () => {
    it('throws 403 FORBIDDEN when attempting to revoke permission from ADMIN role', async () => {
      const callOrder: string[] = [];
      const repo = makeRepo(callOrder);
      const service = new AuthorizationService(repo);

      const err = await service
        .revokeRolePermission(
          { role: 'ADMIN', permissionCode: 'users.profile.read' },
          adminActor,
          REQUEST_ID,
        )
        .catch((e: unknown) => e);

      expect(err).toBeInstanceOf(HttpException);
      expect((err as HttpException).getStatus()).toBe(403);
      expect((err as HttpException).getResponse()).toMatchObject({
        code: 'FORBIDDEN',
      });
      // No transaction, no audit context, no repo mutation
      expect(repo.transaction).not.toHaveBeenCalled();
      expect(callOrder).toHaveLength(0);
      expect(repo.deleteRolePermission).not.toHaveBeenCalled();
    });

    it('rejects ADMIN role revocation even when no such assignment exists', async () => {
      const repo = makeRepo();
      const service = new AuthorizationService(repo);

      await expect(
        service.revokeRolePermission(
          { role: 'ADMIN', permissionCode: 'any.code' },
          adminActor,
          REQUEST_ID,
        ),
      ).rejects.toMatchObject({ status: 403 });
      expect(repo.findPermissionIdsByCodes).not.toHaveBeenCalled();
      expect(repo.deleteRolePermission).not.toHaveBeenCalled();
    });

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

    it.each(['FIGHTER', 'COACH', 'DOCTOR'] as const)(
      'revokes permission from role %s when assignment exists',
      async (role) => {
        const repo = makeRepo();
        (
          repo.findPermissionIdsByCodes as ReturnType<typeof vi.fn>
        ).mockResolvedValue(new Map([['perm.code', 'perm-id']]));
        (repo.deleteRolePermission as ReturnType<typeof vi.fn>).mockResolvedValue({
          ...rolePermRow,
          role,
        });
        const service = new AuthorizationService(repo);
        await expect(
          service.revokeRolePermission(
            { role, permissionCode: 'perm.code' },
            adminActor,
            REQUEST_ID,
          ),
        ).resolves.toBeUndefined();
      },
    );

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
      expect((err as HttpException).getResponse()).toMatchObject({
        code: 'ASSIGNMENT_NOT_FOUND',
      });
    });
  });
});
