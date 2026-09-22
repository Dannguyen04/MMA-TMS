import { Inject, Injectable } from '@nestjs/common';
import { and, eq, gt, inArray, isNull, sql } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../database/database.module.js';
import {
  permissions,
  passwordResetRequests,
  authOutbox,
  localAuthCredentials,
  localAuthSessions,
  rolePermissions,
  userPermissions,
  users,
} from '../database/schema.js';
import type {
  DatabaseExecutor,
  Transaction,
} from '../shared/utils/audit-context.util.js';
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

const authenticatedUserColumns = {
  id: users.id,
  authSubject: users.authUserId,
  email: users.email,
  role: users.role,
};

/** Only active, non-suspended, non-deleted accounts may authenticate. */
function activeAccount() {
  return and(
    eq(users.isActive, true),
    eq(users.accountStatus, 'ACTIVE'),
    isNull(users.deletedAt),
  );
}

@Injectable()
export class AuthRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  transaction<T>(work: (transaction: Transaction) => Promise<T>): Promise<T> {
    return this.db.transaction(work);
  }

  async createLocalIdentity(
    subject: string,
    database: DatabaseExecutor,
  ): Promise<void> {
    await database.execute(sql`insert into auth.users(id) values (${subject})`);
  }

  async insertLocalCredential(
    userId: string,
    passwordHash: string,
    database: DatabaseExecutor,
  ): Promise<void> {
    await database
      .insert(localAuthCredentials)
      .values({ userId, passwordHash });
  }

  async findLocalCredentialByEmail(email: string): Promise<
    | {
        user: AuthenticatedUser;
        passwordHash: string;
      }
    | undefined
  > {
    const [row] = await this.db
      .select({
        ...authenticatedUserColumns,
        passwordHash: localAuthCredentials.passwordHash,
      })
      .from(users)
      .innerJoin(
        localAuthCredentials,
        eq(localAuthCredentials.userId, users.id),
      )
      .where(and(eq(users.email, email.toLowerCase().trim()), activeAccount()))
      .limit(1);
    if (!row) return undefined;

    const { passwordHash, ...user } = row;
    return { user, passwordHash };
  }

  async insertLocalSession(
    input: {
      userId: string;
      accessTokenHash: string;
      refreshTokenHash: string;
      accessExpiresAt: Date;
      refreshExpiresAt: Date;
    },
    database: DatabaseExecutor,
  ): Promise<{ id: string }> {
    const [session] = await database
      .insert(localAuthSessions)
      .values(input)
      .returning({ id: localAuthSessions.id });
    return session;
  }

  async touchLastActive(
    userId: string,
    database: DatabaseExecutor = this.db,
  ): Promise<void> {
    await database
      .update(users)
      .set({ lastActiveAt: new Date(), updatedAt: new Date() })
      .where(eq(users.id, userId));
  }

  async findActiveLocalAccessSession(
    accessTokenHash: string,
  ): Promise<AuthenticatedUser | undefined> {
    const [row] = await this.db
      .select(authenticatedUserColumns)
      .from(localAuthSessions)
      .innerJoin(users, eq(localAuthSessions.userId, users.id))
      .where(
        and(
          eq(localAuthSessions.accessTokenHash, accessTokenHash),
          isNull(localAuthSessions.revokedAt),
          gt(localAuthSessions.accessExpiresAt, new Date()),
          activeAccount(),
        ),
      )
      .limit(1);
    return row;
  }

  async findActiveLocalRefreshSession(
    refreshTokenHash: string,
    database: Transaction,
  ): Promise<{ id: string; user: AuthenticatedUser } | undefined> {
    const [row] = await database
      .select({
        sessionId: localAuthSessions.id,
        ...authenticatedUserColumns,
      })
      .from(localAuthSessions)
      .innerJoin(users, eq(localAuthSessions.userId, users.id))
      .where(
        and(
          eq(localAuthSessions.refreshTokenHash, refreshTokenHash),
          isNull(localAuthSessions.revokedAt),
          gt(localAuthSessions.refreshExpiresAt, new Date()),
          activeAccount(),
        ),
      )
      .limit(1)
      .for('update');
    if (!row) return undefined;

    const { sessionId, ...user } = row;
    return { id: sessionId, user };
  }

  async rotateLocalSession(
    previousSessionId: string,
    replacementSessionId: string,
    database: DatabaseExecutor,
  ): Promise<void> {
    await database
      .update(localAuthSessions)
      .set({
        revokedAt: new Date(),
        replacedBySessionId: replacementSessionId,
        lastUsedAt: new Date(),
      })
      .where(
        and(
          eq(localAuthSessions.id, previousSessionId),
          isNull(localAuthSessions.revokedAt),
        ),
      );
  }

  async revokeLocalSession(accessTokenHash: string): Promise<boolean> {
    const rows = await this.db
      .update(localAuthSessions)
      .set({ revokedAt: new Date(), lastUsedAt: new Date() })
      .where(
        and(
          eq(localAuthSessions.accessTokenHash, accessTokenHash),
          isNull(localAuthSessions.revokedAt),
        ),
      )
      .returning({ id: localAuthSessions.id });
    return rows.length > 0;
  }

  async createPasswordResetRequest(
    email: string,
    tokenHash: string,
    expiresAt: Date,
    requestId: string,
  ): Promise<boolean> {
    return this.transaction(async (transaction) => {
      const [user] = await transaction
        .select({ id: users.id, email: users.email })
        .from(users)
        .where(
          and(eq(users.email, email.toLowerCase().trim()), activeAccount()),
        )
        .limit(1);
      if (!user) return false;

      const [request] = await transaction
        .insert(passwordResetRequests)
        .values({ userId: user.id, tokenHash, expiresAt, requestId })
        .returning({ id: passwordResetRequests.id });
      await transaction.insert(authOutbox).values({
        userId: user.id,
        eventType: 'PASSWORD_RESET_REQUESTED',
        recipientEmail: user.email,
        payload: {
          resetRequestId: request.id,
          expiresAt: expiresAt.toISOString(),
        },
        requestId,
      });
      return true;
    });
  }

  async findActiveUserBySubject(
    authSubject: string,
  ): Promise<AuthenticatedUser | undefined> {
    const [user] = await this.db
      .select(authenticatedUserColumns)
      .from(users)
      .where(and(eq(users.authUserId, authSubject), activeAccount()))
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
