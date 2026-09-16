import { Inject, Injectable } from '@nestjs/common';
import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../database/database.module.js';
import {
  permissions,
  rolePermissions,
  userPermissions,
  users,
} from '../database/schema.js';
import type {
  AuthenticatedUser,
  UserRole,
} from '../shared/models/auth-context.model.js';

export function resolveEffectivePermission(
  userOverride: boolean | null,
  roleGranted: boolean,
): boolean {
  return userOverride ?? roleGranted;
}

@Injectable()
export class AuthRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async findActiveUserBySubject(
    authSubject: string,
  ): Promise<AuthenticatedUser | undefined> {
    const [user] = await this.db
      .select({
        id: users.id,
        authSubject: users.authUserId,
        email: users.email,
        role: users.role,
      })
      .from(users)
      .where(
        and(
          eq(users.authUserId, authSubject),
          eq(users.isActive, true),
          isNull(users.deletedAt),
        ),
      )
      .limit(1);

    return user;
  }

  async resolvePermissions(
    userId: string,
    role: UserRole,
    codes: readonly string[],
  ): Promise<Map<string, boolean>> {
    if (codes.length === 0) return new Map();

    const rows = await this.db
      .select({
        code: permissions.code,
        userOverride: userPermissions.isGranted,
        roleGranted: sql<boolean>`${rolePermissions.permissionId} is not null`,
      })
      .from(permissions)
      .leftJoin(
        userPermissions,
        and(
          eq(userPermissions.userId, userId),
          eq(userPermissions.permissionId, permissions.id),
        ),
      )
      .leftJoin(
        rolePermissions,
        and(
          eq(rolePermissions.role, role),
          eq(rolePermissions.permissionId, permissions.id),
        ),
      )
      .where(inArray(permissions.code, [...codes]));

    return new Map(
      rows.map((row) => [
        row.code,
        resolveEffectivePermission(row.userOverride, row.roleGranted),
      ]),
    );
  }
}
