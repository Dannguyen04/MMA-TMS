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

function makeRepo(): AuthorizationRepository {
  const tx = {} as DatabaseExecutor;
  const repo = {
    transaction: vi.fn((work: (tx: DatabaseExecutor) => Promise<unknown>) => work(tx)),
    setAudit: vi.fn().mockResolvedValue(undefined),
    findPermissionIdsByCodes: vi.fn().mockResolvedValue(new Map([['users.profile.read', 'perm-id']])),
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
  // grantUserPermission
  // -------------------------------------------------------------------------
  describe('grantUserPermission', () => {
    it('calls setAudit before any repo operation', async () => {
      const repo = makeRepo();
      const callOrder: string[] = [];
      (repo.setAudit as ReturnType<typeof vi.fn>).mockImplementation(async () => {
        callOrder.push('setAudit');
      });
      (repo.upsertUserPermission as ReturnType<typeof vi.fn>).mockImplementation(async () => {
        callOrder.push('upsert');
        return userPermRow;
      });
      const service = new AuthorizationService(repo);
      await service.grantUserPermission(
        { userId: 'u', permissionCode: 'users.profile.read' },
        adminActor,
        REQUEST_ID,
      );
      expect(callOrder.indexOf('setAudit')).toBeLessThan(callOrder.indexOf('upsert'));
    });

    it('throws permissionNotFound when code is not in catalogue', async () => {
      const repo = makeRepo();
      (repo.findPermissionIdsByCodes as ReturnType<typeof vi.fn>).mockResolvedValue(new Map());
      const service = new AuthorizationService(repo);
      const err = await service
        .grantUserPermission({ userId: 'u', permissionCode: 'unknown.code' }, adminActor, REQUEST_ID)
        .catch((e: unknown) => e);
      expect(err).toBeInstanceOf(HttpException);
      expect((err as HttpException).getStatus()).toBe(404);
    });

    it('is idempotent — re-granting returns 200 without throwing', async () => {
      const repo = makeRepo();
      (repo.findPermissionIdsByCodes as ReturnType<typeof vi.fn>).mockResolvedValue(new Map([['users.profile.read', 'perm-id']]));
      (repo.upsertUserPermission as ReturnType<typeof vi.fn>).mockResolvedValue(userPermRow);
      const service = new AuthorizationService(repo);
      await service.grantUserPermission({ userId: 'u', permissionCode: 'users.profile.read' }, adminActor, REQUEST_ID);
      await service.grantUserPermission({ userId: 'u', permissionCode: 'users.profile.read' }, adminActor, REQUEST_ID);
      expect(repo.upsertUserPermission).toHaveBeenCalledTimes(2);
    });

    it('sets grantedBy to actor.id — not from request body', async () => {
      const repo = makeRepo();
      (repo.findPermissionIdsByCodes as ReturnType<typeof vi.fn>).mockResolvedValue(new Map([['users.profile.read', 'perm-id']]));
      const service = new AuthorizationService(repo);
      await service.grantUserPermission({ userId: 'u', permissionCode: 'users.profile.read' }, adminActor, REQUEST_ID);
      expect(repo.upsertUserPermission).toHaveBeenCalledWith(
        expect.objectContaining({ grantedBy: adminActor.id }),
        expect.anything(),
      );
    });
  });

  // -------------------------------------------------------------------------
  // removeUserPermissionOverride
  // -------------------------------------------------------------------------
  describe('removeUserPermissionOverride', () => {
    it('calls setAudit before delete', async () => {
      const repo = makeRepo();
      const callOrder: string[] = [];
      (repo.setAudit as ReturnType<typeof vi.fn>).mockImplementation(async () => { callOrder.push('setAudit'); });
      (repo.deleteUserPermissionOverride as ReturnType<typeof vi.fn>).mockImplementation(async () => { callOrder.push('delete'); return userPermRow; });
      const service = new AuthorizationService(repo);
      await service.removeUserPermissionOverride({ userId: 'u', permissionCode: 'users.profile.read' }, adminActor, REQUEST_ID);
      expect(callOrder.indexOf('setAudit')).toBeLessThan(callOrder.indexOf('delete'));
    });

    it('completes when override exists', async () => {
      const repo = makeRepo();
      (repo.findPermissionIdsByCodes as ReturnType<typeof vi.fn>).mockResolvedValue(new Map([['users.profile.read', 'perm-id']]));
      const service = new AuthorizationService(repo);
      await expect(
        service.removeUserPermissionOverride({ userId: 'u', permissionCode: 'users.profile.read' }, adminActor, REQUEST_ID),
      ).resolves.toBeUndefined();
    });

    it('throws assignmentNotFound when no override exists', async () => {
      const repo = makeRepo();
      (repo.findPermissionIdsByCodes as ReturnType<typeof vi.fn>).mockResolvedValue(new Map([['users.profile.read', 'perm-id']]));
      (repo.deleteUserPermissionOverride as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
      const service = new AuthorizationService(repo);
      const err = await service
        .removeUserPermissionOverride({ userId: 'u', permissionCode: 'users.profile.read' }, adminActor, REQUEST_ID)
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
      const repo = makeRepo();
      const callOrder: string[] = [];
      (repo.setAudit as ReturnType<typeof vi.fn>).mockImplementation(async () => { callOrder.push('setAudit'); });
      (repo.upsertRolePermission as ReturnType<typeof vi.fn>).mockImplementation(async () => { callOrder.push('upsert'); return rolePermRow; });
      (repo.findPermissionIdsByCodes as ReturnType<typeof vi.fn>).mockResolvedValue(new Map([['fighter:read', 'perm-id']]));
      const service = new AuthorizationService(repo);
      await service.grantRolePermission({ role: 'FIGHTER', permissionCode: 'fighter:read' }, adminActor, REQUEST_ID);
      expect(callOrder.indexOf('setAudit')).toBeLessThan(callOrder.indexOf('upsert'));
    });

    it('is idempotent — re-granting does not throw', async () => {
      const repo = makeRepo();
      (repo.findPermissionIdsByCodes as ReturnType<typeof vi.fn>).mockResolvedValue(new Map([['fighter:read', 'perm-id']]));
      (repo.upsertRolePermission as ReturnType<typeof vi.fn>).mockResolvedValue(rolePermRow);
      const service = new AuthorizationService(repo);
      await service.grantRolePermission({ role: 'FIGHTER', permissionCode: 'fighter:read' }, adminActor, REQUEST_ID);
      await service.grantRolePermission({ role: 'FIGHTER', permissionCode: 'fighter:read' }, adminActor, REQUEST_ID);
      expect(repo.upsertRolePermission).toHaveBeenCalledTimes(2);
    });
  });

  // -------------------------------------------------------------------------
  // revokeRolePermission
  // -------------------------------------------------------------------------
  describe('revokeRolePermission', () => {
    it('calls setAudit before delete', async () => {
      const repo = makeRepo();
      const callOrder: string[] = [];
      (repo.setAudit as ReturnType<typeof vi.fn>).mockImplementation(async () => { callOrder.push('setAudit'); });
      (repo.deleteRolePermission as ReturnType<typeof vi.fn>).mockImplementation(async () => { callOrder.push('delete'); return rolePermRow; });
      (repo.findPermissionIdsByCodes as ReturnType<typeof vi.fn>).mockResolvedValue(new Map([['fighter:read', 'perm-id']]));
      const service = new AuthorizationService(repo);
      await service.revokeRolePermission({ role: 'FIGHTER', permissionCode: 'fighter:read' }, adminActor, REQUEST_ID);
      expect(callOrder.indexOf('setAudit')).toBeLessThan(callOrder.indexOf('delete'));
    });

    it('throws assignmentNotFound when role permission does not exist', async () => {
      const repo = makeRepo();
      (repo.findPermissionIdsByCodes as ReturnType<typeof vi.fn>).mockResolvedValue(new Map([['fighter:read', 'perm-id']]));
      (repo.deleteRolePermission as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
      const service = new AuthorizationService(repo);
      const err = await service
        .revokeRolePermission({ role: 'FIGHTER', permissionCode: 'fighter:read' }, adminActor, REQUEST_ID)
        .catch((e: unknown) => e);
      expect(err).toBeInstanceOf(HttpException);
      expect((err as HttpException).getStatus()).toBe(404);
    });
  });

});
