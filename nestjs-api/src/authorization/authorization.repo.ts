import { Inject, Injectable } from '@nestjs/common';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../database/database.module.js';
import {
  permissions,
  rolePermissions,
  userPermissions,
} from '../database/schema.js';
import {
  setAuditContext,
  type DatabaseExecutor,
  type Transaction,
} from '../shared/utils/audit-context.util.js';
import type { UserRole } from '../shared/types/user.role.js';

// ---------------------------------------------------------------------------
// Internal row types (not exposed via HTTP responses directly)
// ---------------------------------------------------------------------------

export interface UserPermissionRow {
  id: string;
  userId: string;
  permissionId: string;
  isGranted: boolean;
  grantedBy: string | null;
  createdAt: Date;
}

export interface RolePermissionRow {
  id: string;
  role: UserRole;
  permissionId: string;
  createdAt: Date;
}

// ---------------------------------------------------------------------------
// Repository
// ---------------------------------------------------------------------------

@Injectable()
export class AuthorizationRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  transaction<T>(work: (tx: Transaction) => Promise<T>): Promise<T> {
    return this.db.transaction(work);
  }

  setAudit(
    subject: string,
    requestId: string,
    db: DatabaseExecutor,
  ): Promise<void> {
    return setAuditContext(subject, requestId, db);
  }

  // -------------------------------------------------------------------------
  // Permission catalogue lookup — resolves N codes in a single query
  // -------------------------------------------------------------------------

  /**
   * Returns a Map<code, permissionId> for the given codes.
   * Codes not found in the catalogue are absent from the map.
   * The caller is responsible for checking map.size vs codes.length.
   */
  async findPermissionIdsByCodes(
    codes: readonly string[],
    db: DatabaseExecutor = this.db,
  ): Promise<Map<string, string>> {
    if (codes.length === 0) return new Map();
    const rows = await db
      .select({ id: permissions.id, code: permissions.code })
      .from(permissions)
      .where(inArray(permissions.code, [...codes]));
    return new Map(rows.map((r) => [r.code, r.id]));
  }

  // -------------------------------------------------------------------------
  // User permission operations
  // -------------------------------------------------------------------------

  /**
   * Upsert a user permission row.
   * ON CONFLICT (user_id, permission_id) DO UPDATE SET
   *   is_granted = EXCLUDED.is_granted,
   *   granted_by = EXCLUDED.granted_by
   * Always returns the final row — idempotent for PUT.
   */
  async upsertUserPermission(
    input: {
      userId: string;
      permissionId: string;
      isGranted: boolean;
      grantedBy: string | null;
    },
    db: DatabaseExecutor,
  ): Promise<UserPermissionRow> {
    const [row] = await db
      .insert(userPermissions)
      .values({
        userId: input.userId,
        permissionId: input.permissionId,
        isGranted: input.isGranted,
        grantedBy: input.grantedBy ?? undefined,
      })
      .onConflictDoUpdate({
        target: [userPermissions.userId, userPermissions.permissionId],
        set: {
          isGranted: sql`excluded.is_granted`,
          grantedBy: sql`excluded.granted_by`,
        },
      })
      .returning({
        id: userPermissions.id,
        userId: userPermissions.userId,
        permissionId: userPermissions.permissionId,
        isGranted: userPermissions.isGranted,
        grantedBy: userPermissions.grantedBy,
        createdAt: userPermissions.createdAt,
      });
    return row as UserPermissionRow;
  }

  /**
   * Deletes a user permission override.
   * Returns the deleted row, or undefined if no override existed.
   */
  async deleteUserPermissionOverride(
    input: { userId: string; permissionId: string },
    db: DatabaseExecutor,
  ): Promise<UserPermissionRow | undefined> {
    const [row] = await db
      .delete(userPermissions)
      .where(
        and(
          eq(userPermissions.userId, input.userId),
          eq(userPermissions.permissionId, input.permissionId),
        ),
      )
      .returning({
        id: userPermissions.id,
        userId: userPermissions.userId,
        permissionId: userPermissions.permissionId,
        isGranted: userPermissions.isGranted,
        grantedBy: userPermissions.grantedBy,
        createdAt: userPermissions.createdAt,
      });
    return row as UserPermissionRow | undefined;
  }

  // -------------------------------------------------------------------------
  // Role permission operations
  // -------------------------------------------------------------------------

  /**
   * Grants a permission to a role. Idempotent — ON CONFLICT DO NOTHING,
   * then selects and returns the existing row so the caller always gets a row.
   */
  async upsertRolePermission(
    input: { role: UserRole; permissionId: string },
    db: DatabaseExecutor,
  ): Promise<RolePermissionRow> {
    // Insert; ignore if already exists.
    await db
      .insert(rolePermissions)
      .values({ role: input.role, permissionId: input.permissionId })
      .onConflictDoNothing();

    // Always select the current row (handles both new insert and conflict).
    const [row] = await db
      .select({
        id: rolePermissions.id,
        role: rolePermissions.role,
        permissionId: rolePermissions.permissionId,
        createdAt: rolePermissions.createdAt,
      })
      .from(rolePermissions)
      .where(
        and(
          eq(rolePermissions.role, input.role),
          eq(rolePermissions.permissionId, input.permissionId),
        ),
      )
      .limit(1);
    return row as RolePermissionRow;
  }

  /**
   * Deletes a role permission.
   * Returns the deleted row, or undefined if the assignment did not exist.
   */
  async deleteRolePermission(
    input: { role: UserRole; permissionId: string },
    db: DatabaseExecutor,
  ): Promise<RolePermissionRow | undefined> {
    const [row] = await db
      .delete(rolePermissions)
      .where(
        and(
          eq(rolePermissions.role, input.role),
          eq(rolePermissions.permissionId, input.permissionId),
        ),
      )
      .returning({
        id: rolePermissions.id,
        role: rolePermissions.role,
        permissionId: rolePermissions.permissionId,
        createdAt: rolePermissions.createdAt,
      });
    return row as RolePermissionRow | undefined;
  }
}
