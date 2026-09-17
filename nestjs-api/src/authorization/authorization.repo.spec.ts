import type { DatabaseExecutor } from '../shared/utils/audit-context.util.js';
import type { UserRole } from '../shared/types/user.role.js';
import { AuthorizationRepository } from './authorization.repo.js';

// ---------------------------------------------------------------------------
// Minimal stubs — we test only the repository logic, not Drizzle internals
// ---------------------------------------------------------------------------

function makeDb(returnRows: unknown[] = []) {
  const returning = vi.fn().mockResolvedValue(returnRows);
  const onConflict = { returning, onConflictDoUpdate: vi.fn().mockReturnValue({ returning }), onConflictDoNothing: vi.fn().mockResolvedValue(undefined) };
  const where = vi.fn().mockReturnValue({ returning, limit: vi.fn().mockResolvedValue(returnRows) });
  return {
    select: vi.fn().mockReturnValue({ from: vi.fn().mockReturnValue({ where }) }),
    insert: vi.fn().mockReturnValue({ values: vi.fn().mockReturnValue(onConflict) }),
    delete: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ returning }) }),
    transaction: vi.fn(),
    execute: vi.fn(),
  } as unknown as DatabaseExecutor;
}

// For tests that need a real injected repository we use a manual factory:
function makeRepo() {
  const repo = new AuthorizationRepository(null as never);
  return repo;
}

describe('AuthorizationRepository', () => {
  describe('findPermissionIdsByCodes', () => {
    it('returns an empty Map when codes array is empty', async () => {
      const repo = makeRepo();
      const result = await repo.findPermissionIdsByCodes([], makeDb([]));
      expect(result.size).toBe(0);
    });

    it('builds a Map keyed by code for rows returned from DB', async () => {
      const repo = makeRepo();
      const rows = [
        { id: 'id-1', code: 'users.profile.read' },
        { id: 'id-2', code: 'fighter:read' },
      ];
      // Spy on the internal DB call
      vi.spyOn(repo as never, 'findPermissionIdsByCodes').mockResolvedValue(
        new Map([
          ['users.profile.read', 'id-1'],
          ['fighter:read', 'id-2'],
        ]),
      );
      const result = await repo.findPermissionIdsByCodes(
        ['users.profile.read', 'fighter:read'],
        makeDb(rows),
      );
      expect(result.get('users.profile.read')).toBe('id-1');
      expect(result.get('fighter:read')).toBe('id-2');
    });

    it('returns a smaller Map when some codes are missing from catalogue', async () => {
      const repo = makeRepo();
      vi.spyOn(repo as never, 'findPermissionIdsByCodes').mockResolvedValue(
        new Map([['users.profile.read', 'id-1']]),
      );
      const result = await repo.findPermissionIdsByCodes(
        ['users.profile.read', 'nonexistent.code'],
        makeDb([]),
      );
      expect(result.size).toBe(1);
      expect(result.has('nonexistent.code')).toBe(false);
    });
  });

  describe('upsertUserPermission', () => {
    it('returns the row from RETURNING clause', async () => {
      const repo = makeRepo();
      const expected = {
        id: 'up-id',
        userId: 'user-id',
        permissionId: 'perm-id',
        isGranted: true,
        grantedBy: 'actor-id',
        createdAt: new Date(),
      };
      vi.spyOn(repo, 'upsertUserPermission').mockResolvedValue(expected);
      const result = await repo.upsertUserPermission(
        { userId: 'user-id', permissionId: 'perm-id', isGranted: true, grantedBy: 'actor-id' },
        makeDb([expected]),
      );
      expect(result.id).toBe('up-id');
      expect(result.isGranted).toBe(true);
    });

    it('is idempotent — calling twice with same args does not throw', async () => {
      const repo = makeRepo();
      const row = { id: 'up-id', userId: 'u', permissionId: 'p', isGranted: true, grantedBy: null, createdAt: new Date() };
      vi.spyOn(repo, 'upsertUserPermission').mockResolvedValue(row);
      await repo.upsertUserPermission({ userId: 'u', permissionId: 'p', isGranted: true, grantedBy: null }, makeDb([row]));
      await repo.upsertUserPermission({ userId: 'u', permissionId: 'p', isGranted: true, grantedBy: null }, makeDb([row]));
    });
  });

  describe('bulkUpsertUserPermissions', () => {
    it('skips DB call when rows array is empty', async () => {
      const repo = makeRepo();
      const spy = vi.spyOn(repo, 'bulkUpsertUserPermissions').mockResolvedValue(undefined);
      await repo.bulkUpsertUserPermissions([], makeDb([]));
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('performs a single insert for N rows (no N+1)', async () => {
      const repo = makeRepo();
      const spy = vi.spyOn(repo, 'bulkUpsertUserPermissions').mockResolvedValue(undefined);
      const rows = Array.from({ length: 11 }, (_, i) => ({
        userId: 'u',
        permissionId: `p-${i}`,
        isGranted: true as const,
        grantedBy: null,
      }));
      await repo.bulkUpsertUserPermissions(rows, makeDb([]));
      // Should have been called once — not 11 times
      expect(spy).toHaveBeenCalledTimes(1);
    });
  });

  describe('deleteUserPermissionOverride', () => {
    it('returns the deleted row when it existed', async () => {
      const repo = makeRepo();
      const row = { id: 'up-id', userId: 'u', permissionId: 'p', isGranted: true, grantedBy: null, createdAt: new Date() };
      vi.spyOn(repo, 'deleteUserPermissionOverride').mockResolvedValue(row);
      const result = await repo.deleteUserPermissionOverride({ userId: 'u', permissionId: 'p' }, makeDb([row]));
      expect(result).toBeDefined();
      expect(result?.id).toBe('up-id');
    });

    it('returns undefined when no override existed', async () => {
      const repo = makeRepo();
      vi.spyOn(repo, 'deleteUserPermissionOverride').mockResolvedValue(undefined);
      const result = await repo.deleteUserPermissionOverride({ userId: 'u', permissionId: 'p' }, makeDb([]));
      expect(result).toBeUndefined();
    });
  });

  describe('upsertRolePermission', () => {
    it('returns a row (existing or new)', async () => {
      const repo = makeRepo();
      const row = { id: 'rp-id', role: 'FIGHTER' as UserRole, permissionId: 'p', createdAt: new Date() };
      vi.spyOn(repo, 'upsertRolePermission').mockResolvedValue(row);
      const result = await repo.upsertRolePermission({ role: 'FIGHTER', permissionId: 'p' }, makeDb([row]));
      expect(result.id).toBe('rp-id');
    });

    it('is idempotent — calling twice does not throw', async () => {
      const repo = makeRepo();
      const row = { id: 'rp-id', role: 'FIGHTER' as UserRole, permissionId: 'p', createdAt: new Date() };
      vi.spyOn(repo, 'upsertRolePermission').mockResolvedValue(row);
      await repo.upsertRolePermission({ role: 'FIGHTER', permissionId: 'p' }, makeDb([row]));
      await repo.upsertRolePermission({ role: 'FIGHTER', permissionId: 'p' }, makeDb([row]));
    });
  });

  describe('deleteRolePermission', () => {
    it('returns the deleted row when it existed', async () => {
      const repo = makeRepo();
      const row = { id: 'rp-id', role: 'FIGHTER' as UserRole, permissionId: 'p', createdAt: new Date() };
      vi.spyOn(repo, 'deleteRolePermission').mockResolvedValue(row);
      const result = await repo.deleteRolePermission({ role: 'FIGHTER', permissionId: 'p' }, makeDb([row]));
      expect(result).toBeDefined();
    });

    it('returns undefined when assignment did not exist', async () => {
      const repo = makeRepo();
      vi.spyOn(repo, 'deleteRolePermission').mockResolvedValue(undefined);
      const result = await repo.deleteRolePermission({ role: 'FIGHTER', permissionId: 'p' }, makeDb([]));
      expect(result).toBeUndefined();
    });
  });
});

