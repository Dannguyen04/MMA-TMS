import { HttpException, Inject, Injectable } from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_ADMIN_CLIENT } from '../common/supabase/supabase.module.js';
import type { AuthenticatedUser } from '../shared/models/auth-context.model.js';
import { USER } from '../shared/types/user.role.js';
import {
  setAuditContext,
  type Transaction,
} from '../shared/utils/audit-context.util.js';
import {
  guestPromotionConflict,
  mapUserPersistenceError,
  userCreationFailed,
  userNotFound,
  userRoleMismatch,
} from './users.error.js';
import type {
  CreateUserInput,
  FighterProfileInput,
  PublicUser,
  UpdateUserInput,
} from './users.model.js';
import { UsersRepository } from './users.repo.js';

interface NewIdentity {
  subject: string;
  email: string;
}

@Injectable()
export class UsersService {
  constructor(
    private readonly usersRepository: UsersRepository,
    @Inject(SUPABASE_ADMIN_CLIENT)
    private readonly supabaseAdmin: SupabaseClient,
  ) {}

  /**
   * Registration creates the pre-admission identity only. A Guest has no role
   * profile until an approved admission is activated.
   */
  async registerGuest(
    identity: NewIdentity,
    requestId: string,
  ): Promise<PublicUser> {
    try {
      return await this.usersRepository.transaction(async (transaction) => {
        await setAuditContext(identity.subject, requestId, transaction);
        const user = await this.usersRepository.createUser(
          identity,
          USER.GUEST,
          transaction,
        );
        const created = await this.usersRepository.findActiveById(
          user.id,
          transaction,
          identity.subject,
        );
        if (!created) throw userNotFound();
        return created;
      });
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw mapUserPersistenceError(error);
    }
  }

  /**
   * Joins the caller's activation transaction: the role change and the fighter
   * profile must commit together. Throws when the row is no longer a GUEST so
   * the caller never continues on an unverified promotion.
   */
  async promoteGuestToFighter(
    userId: string,
    profile: FighterProfileInput,
    transaction: Transaction,
  ): Promise<void> {
    const promoted = await this.usersRepository.promoteGuestToFighter(
      userId,
      transaction,
    );
    if (!promoted) throw guestPromotionConflict();
    await this.usersRepository.createFighter(userId, profile, transaction);
  }

  async create(
    actor: AuthenticatedUser,
    input: CreateUserInput,
    requestId: string,
  ): Promise<PublicUser> {
    const { data, error } = await this.supabaseAdmin.auth.admin.createUser({
      email: input.email,
      password: input.password,
      email_confirm: true,
    });
    if (error || !data.user?.id) {
      throw userCreationFailed();
    }

    try {
      return await this.usersRepository.transaction(async (transaction) => {
        await setAuditContext(actor.authSubject, requestId, transaction);
        const user = await this.usersRepository.createUser(
          { subject: data.user.id, email: input.email },
          input.role,
          transaction,
        );
        await this.usersRepository.createRoleProfile(
          user.id,
          input,
          transaction,
        );
        const created = await this.usersRepository.findActiveById(
          user.id,
          transaction,
        );
        if (!created) throw userNotFound();
        return created;
      });
    } catch (databaseError) {
      await this.supabaseAdmin.auth.admin.deleteUser(data.user.id);
      if (databaseError instanceof HttpException) throw databaseError;
      throw mapUserPersistenceError(databaseError);
    }
  }

  async findOne(id: string): Promise<PublicUser> {
    const user = await this.usersRepository.findActiveById(id);
    if (!user) throw userNotFound();
    return user;
  }

  async update(
    id: string,
    actor: AuthenticatedUser,
    input: UpdateUserInput,
    requestId: string,
  ): Promise<PublicUser> {
    try {
      return await this.usersRepository.transaction(async (transaction) => {
        const existing = await this.usersRepository.findActiveById(
          id,
          transaction,
        );
        if (!existing) throw userNotFound();
        if (existing.role !== input.role) {
          throw userRoleMismatch();
        }

        await setAuditContext(actor.authSubject, requestId, transaction);
        await this.usersRepository.updateRoleProfile(
          existing,
          input,
          transaction,
        );
        const updated = await this.usersRepository.findActiveById(
          id,
          transaction,
        );
        if (!updated) throw userNotFound();
        return updated;
      });
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw mapUserPersistenceError(error);
    }
  }

  async remove(
    id: string,
    actor: AuthenticatedUser,
    requestId: string,
  ): Promise<{ id: string; deleted: true }> {
    try {
      await this.usersRepository.transaction(async (transaction) => {
        const existing = await this.usersRepository.findActiveById(
          id,
          transaction,
        );
        if (!existing) throw userNotFound();
        await setAuditContext(actor.authSubject, requestId, transaction);
        await this.usersRepository.softDelete(existing, transaction);
      });
      return { id, deleted: true };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw mapUserPersistenceError(error);
    }
  }
}
