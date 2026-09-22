import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, gt, ilike, isNull, lte, or, sql } from 'drizzle-orm';
import {
  type DatabaseExecutor,
  type Transaction,
} from '../shared/utils/audit-context.util.js';
import type { UserRole } from '../shared/models/auth-context.model.js';
import { USER } from '../shared/types/user.role.js';
import { DRIZZLE, type DrizzleDB } from '../database/database.module.js';
import {
  authOutbox,
  coaches,
  coachFighters,
  doctorFighters,
  fighters,
  localAuthCredentials,
  localAuthSessions,
  permissions,
  rolePermissions,
  sportsDoctors,
  userInvitationRequests,
  userPermissions,
  users,
} from '../database/schema.js';
import type {
  AccountStatus,
  CreateUserInput,
  FighterProfileInput,
  InviteUserInput,
  ListUsersQuery,
  PublicUser,
  UserDirectoryPage,
  UpdateOwnProfileInput,
  UpdateUserInput,
} from './users.model.js';

interface NewIdentity {
  subject: string;
  email: string;
}

const userProjection = {
  id: users.id,
  email: users.email,
  role: users.role,
  isActive: users.isActive,
  status: users.accountStatus,
  displayName: users.displayName,
  phone: users.phone,
  title: users.title,
  lastActiveAt: users.lastActiveAt,
  createdAt: users.createdAt,
  updatedAt: users.updatedAt,
  deletedAt: users.deletedAt,
};

export function buildUserDirectorySearch(search: string) {
  const pattern = `%${search}%`;
  return or(
    ilike(users.email, pattern),
    ilike(users.displayName, pattern),
    ilike(users.title, pattern),
    sql`exists (
      select 1 from public.fighters f
      where f.user_id = ${users.id}
        and (f.first_name ilike ${pattern} or f.last_name ilike ${pattern})
    )`,
    sql`exists (
      select 1 from public.coaches c
      where c.user_id = ${users.id}
        and (c.first_name ilike ${pattern} or c.last_name ilike ${pattern})
    )`,
    sql`exists (
      select 1 from public.sports_doctors d
      where d.user_id = ${users.id}
        and (d.first_name ilike ${pattern} or d.last_name ilike ${pattern})
    )`,
  )!;
}

@Injectable()
export class UsersRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  transaction<T>(work: (transaction: Transaction) => Promise<T>): Promise<T> {
    return this.db.transaction(work);
  }

  async createUser(
    identity: NewIdentity,
    role: UserRole,
    database: DatabaseExecutor,
  ): Promise<{ id: string }> {
    const [user] = await database
      .insert(users)
      .values({
        authUserId: identity.subject,
        email: identity.email.toLowerCase().trim(),
        role,
      })
      .returning({ id: users.id });
    return user;
  }

  async createInvitedUser(
    identity: NewIdentity,
    input: InviteUserInput,
    database: DatabaseExecutor,
  ): Promise<{ id: string }> {
    const [user] = await database
      .insert(users)
      .values({
        authUserId: identity.subject,
        email: identity.email.toLowerCase().trim(),
        role: input.role,
        accountStatus: 'INVITED',
        displayName: input.name,
        title: input.title,
      })
      .returning({ id: users.id });
    return user;
  }

  async createInvitation(
    userId: string,
    recipientEmail: string,
    tokenHash: string,
    expiresAt: Date,
    requestId: string,
    database: DatabaseExecutor,
  ): Promise<void> {
    const now = new Date();
    await database
      .update(userInvitationRequests)
      .set({ consumedAt: now })
      .where(
        and(
          eq(userInvitationRequests.userId, userId),
          isNull(userInvitationRequests.consumedAt),
        ),
      );
    const [invitation] = await database
      .insert(userInvitationRequests)
      .values({ userId, tokenHash, expiresAt, requestId })
      .returning({ id: userInvitationRequests.id });
    await database.insert(authOutbox).values({
      userId,
      eventType: 'USER_INVITED',
      recipientEmail,
      payload: {
        invitationRequestId: invitation.id,
        expiresAt: expiresAt.toISOString(),
      },
      requestId,
    });
  }

  async createLocalIdentity(
    subject: string,
    database: DatabaseExecutor,
  ): Promise<void> {
    await database.execute(sql`insert into auth.users(id) values (${subject})`);
  }

  async createLocalCredential(
    userId: string,
    passwordHash: string,
    database: DatabaseExecutor,
  ): Promise<void> {
    await database
      .insert(localAuthCredentials)
      .values({ userId, passwordHash });
  }

  async createFighter(
    userId: string,
    profile: FighterProfileInput,
    database: DatabaseExecutor,
  ): Promise<void> {
    await database.insert(fighters).values({ userId, ...profile });
  }

  async createRoleProfile(
    userId: string,
    input: CreateUserInput,
    database: DatabaseExecutor,
  ): Promise<void> {
    if (input.role === USER.FIGHTER) {
      await database.insert(fighters).values({ userId, ...input.profile });
      return;
    }
    if (input.role === USER.COACH) {
      await database.insert(coaches).values({ userId, ...input.profile });
      return;
    }
    if (input.role === USER.DOCTOR) {
      await database.insert(sportsDoctors).values({ userId, ...input.profile });
    }
  }

  async findActiveById(
    id: string,
    database: DatabaseExecutor = this.db,
    authSubject?: string,
  ): Promise<PublicUser | undefined> {
    const filters = [
      eq(users.id, id),
      eq(users.isActive, true),
      isNull(users.deletedAt),
    ];
    if (authSubject) filters.push(eq(users.authUserId, authSubject));

    const [user] = await database
      .select(userProjection)
      .from(users)
      .where(and(...filters))
      .limit(1);
    if (!user) return undefined;

    const profile = await this.findProfile(user.id, user.role, database);
    if (user.role !== USER.ADMIN && user.status !== 'INVITED' && !profile) {
      return undefined;
    }
    return { ...user, profile };
  }

  async findPage(input: ListUsersQuery): Promise<UserDirectoryPage> {
    const filters = [eq(users.isActive, true), isNull(users.deletedAt)];
    if (input.role) filters.push(eq(users.role, input.role));
    if (input.status) filters.push(eq(users.accountStatus, input.status));
    if (input.search) filters.push(buildUserDirectorySearch(input.search));

    const [totalRow] = await this.db
      .select({ value: sql<number>`count(*)::int` })
      .from(users)
      .where(and(...filters));
    const pageFilters = input.cursor
      ? [...filters, gt(users.id, input.cursor)]
      : filters;
    const rows = await this.db
      .select({ id: users.id })
      .from(users)
      .where(and(...pageFilters))
      .orderBy(asc(users.id))
      .limit(input.limit + 1);
    const hasNextPage = rows.length > input.limit;
    const visibleRows = rows.slice(0, input.limit);
    const items = await Promise.all(
      visibleRows.map((row) => this.findActiveById(row.id)),
    );

    return {
      items: items.filter((item): item is PublicUser => item !== undefined),
      pageInfo: {
        hasNextPage,
        endCursor:
          hasNextPage && visibleRows.length > 0
            ? visibleRows[visibleRows.length - 1].id
            : null,
      },
      total: totalRow?.value ?? 0,
    };
  }

  async updateAccountStatus(
    userId: string,
    status: AccountStatus,
    database: DatabaseExecutor,
  ): Promise<void> {
    const changedAt = new Date();
    await database
      .update(users)
      .set({ accountStatus: status, updatedAt: changedAt })
      .where(eq(users.id, userId));
    if (status !== 'ACTIVE') {
      await database
        .update(localAuthSessions)
        .set({ revokedAt: changedAt, lastUsedAt: changedAt })
        .where(
          and(
            eq(localAuthSessions.userId, userId),
            isNull(localAuthSessions.revokedAt),
          ),
        );
    }
  }

  async updateOwnProfile(
    userId: string,
    input: UpdateOwnProfileInput,
    database: DatabaseExecutor,
  ): Promise<void> {
    await database
      .update(users)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(users.id, userId));
  }

  async findEffectivePermissionCodes(
    userId: string,
    role: UserRole,
  ): Promise<string[]> {
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
      );

    return rows
      .filter((row) => row.userOverride ?? row.roleGranted)
      .map((row) => row.code);
  }

  async findActiveAssignmentFighterIds(
    userId: string,
    role: UserRole,
  ): Promise<string[]> {
    if (role === USER.ADMIN) return [];

    if (role === USER.FIGHTER) {
      const [fighter] = await this.db
        .select({ id: fighters.id })
        .from(fighters)
        .where(
          and(
            eq(fighters.userId, userId),
            eq(fighters.isActive, true),
            isNull(fighters.deletedAt),
          ),
        )
        .limit(1);
      return fighter ? [fighter.id] : [];
    }

    const now = new Date();
    const activeFighter = and(
      eq(fighters.isActive, true),
      isNull(fighters.deletedAt),
    );

    if (role === USER.COACH) {
      const rows = await this.db
        .select({ fighterId: coachFighters.fighterId })
        .from(coachFighters)
        .innerJoin(coaches, eq(coaches.id, coachFighters.coachId))
        .innerJoin(fighters, eq(fighters.id, coachFighters.fighterId))
        .innerJoin(users, eq(users.id, fighters.userId))
        .where(
          and(
            eq(coaches.userId, userId),
            eq(coaches.isActive, true),
            isNull(coaches.deletedAt),
            lte(coachFighters.startsAt, now),
            or(isNull(coachFighters.endsAt), gt(coachFighters.endsAt, now)),
            activeFighter,
            eq(users.isActive, true),
            isNull(users.deletedAt),
          ),
        );
      return rows.map((row) => row.fighterId);
    }

    const rows = await this.db
      .select({ fighterId: doctorFighters.fighterId })
      .from(doctorFighters)
      .innerJoin(sportsDoctors, eq(sportsDoctors.id, doctorFighters.doctorId))
      .innerJoin(fighters, eq(fighters.id, doctorFighters.fighterId))
      .innerJoin(users, eq(users.id, fighters.userId))
      .where(
        and(
          eq(sportsDoctors.userId, userId),
          eq(sportsDoctors.isActive, true),
          isNull(sportsDoctors.deletedAt),
          lte(doctorFighters.startsAt, now),
          or(isNull(doctorFighters.endsAt), gt(doctorFighters.endsAt, now)),
          activeFighter,
          eq(users.isActive, true),
          isNull(users.deletedAt),
        ),
      );
    return rows.map((row) => row.fighterId);
  }

  async updateRoleProfile(
    user: PublicUser,
    input: UpdateUserInput,
    database: DatabaseExecutor,
  ): Promise<void> {
    if (user.role === USER.FIGHTER && input.role === USER.FIGHTER) {
      await database
        .update(fighters)
        .set({ ...input.profile, updatedAt: new Date() })
        .where(eq(fighters.userId, user.id));
      return;
    }
    if (user.role === USER.COACH && input.role === USER.COACH) {
      await database
        .update(coaches)
        .set({ ...input.profile, updatedAt: new Date() })
        .where(eq(coaches.userId, user.id));
      return;
    }
    if (user.role === USER.DOCTOR && input.role === USER.DOCTOR) {
      await database
        .update(sportsDoctors)
        .set({ ...input.profile, updatedAt: new Date() })
        .where(eq(sportsDoctors.userId, user.id));
    }
  }

  async softDelete(
    user: PublicUser,
    database: DatabaseExecutor,
  ): Promise<void> {
    const deletedAt = new Date();
    const state = { isActive: false, deletedAt, updatedAt: deletedAt };

    if (user.role === USER.FIGHTER) {
      await database
        .update(fighters)
        .set(state)
        .where(eq(fighters.userId, user.id));
    } else if (user.role === USER.COACH) {
      await database
        .update(coaches)
        .set(state)
        .where(eq(coaches.userId, user.id));
    } else if (user.role === USER.DOCTOR) {
      await database
        .update(sportsDoctors)
        .set(state)
        .where(eq(sportsDoctors.userId, user.id));
    }

    await database.update(users).set(state).where(eq(users.id, user.id));
  }

  private async findProfile(
    userId: string,
    role: UserRole,
    database: DatabaseExecutor,
  ): Promise<PublicUser['profile']> {
    if (role === USER.ADMIN) return null;
    if (role === USER.FIGHTER) {
      const [profile] = await database
        .select({
          id: fighters.id,
          firstName: fighters.firstName,
          lastName: fighters.lastName,
          dateOfBirth: fighters.dateOfBirth,
          nationality: fighters.nationality,
          weightClass: fighters.weightClass,
          heightCm: fighters.heightCm,
          reachCm: fighters.reachCm,
          dominantStance: fighters.dominantStance,
          leftArmCm: fighters.leftArmCm,
          rightArmCm: fighters.rightArmCm,
          leftLegCm: fighters.leftLegCm,
          rightLegCm: fighters.rightLegCm,
          gym: fighters.gym,
          bio: fighters.bio,
          profileImageUrl: fighters.profileImageUrl,
        })
        .from(fighters)
        .where(
          and(
            eq(fighters.userId, userId),
            eq(fighters.isActive, true),
            isNull(fighters.deletedAt),
          ),
        )
        .limit(1);
      return profile ?? null;
    }
    if (role === USER.COACH) {
      const [profile] = await database
        .select({
          id: coaches.id,
          firstName: coaches.firstName,
          lastName: coaches.lastName,
          isHeadCoach: coaches.isHeadCoach,
          specialization: coaches.specialization,
          profileImageUrl: coaches.profileImageUrl,
        })
        .from(coaches)
        .where(
          and(
            eq(coaches.userId, userId),
            eq(coaches.isActive, true),
            isNull(coaches.deletedAt),
          ),
        )
        .limit(1);
      return profile ?? null;
    }

    const [profile] = await database
      .select({
        id: sportsDoctors.id,
        firstName: sportsDoctors.firstName,
        lastName: sportsDoctors.lastName,
        licenseNumber: sportsDoctors.licenseNumber,
        specialization: sportsDoctors.specialization,
        profileImageUrl: sportsDoctors.profileImageUrl,
      })
      .from(sportsDoctors)
      .where(
        and(
          eq(sportsDoctors.userId, userId),
          eq(sportsDoctors.isActive, true),
          isNull(sportsDoctors.deletedAt),
        ),
      )
      .limit(1);
    return profile ?? null;
  }
}
