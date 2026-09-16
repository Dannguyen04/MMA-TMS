import { Inject, Injectable } from '@nestjs/common';
import { and, eq, isNull } from 'drizzle-orm';
import {
  type DatabaseExecutor,
  setAuditContext,
  type Transaction,
} from '../shared/utils/audit-context.util.js';
import type { UserRole } from '../shared/models/auth-context.model.js';
import { USER } from '../shared/types/user.role.js';
import { DRIZZLE, type DrizzleDB } from '../database/database.module.js';
import { coaches, fighters, sportsDoctors, users } from '../database/schema.js';
import type {
  CreateUserInput,
  FighterProfileInput,
  PublicUser,
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
  createdAt: users.createdAt,
  updatedAt: users.updatedAt,
  deletedAt: users.deletedAt,
};

@Injectable()
export class UsersRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  transaction<T>(work: (transaction: Transaction) => Promise<T>): Promise<T> {
    return this.db.transaction(work);
  }

  setAudit(
    subject: string,
    requestId: string,
    database: DatabaseExecutor,
  ): Promise<void> {
    return setAuditContext(subject, requestId, database);
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
    if (user.role !== USER.ADMIN && !profile) return undefined;
    return { ...user, profile };
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
