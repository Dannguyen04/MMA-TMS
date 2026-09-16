import {
  BadRequestException,
  ConflictException,
  HttpException,
  Inject,
  Injectable,
} from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_ADMIN_CLIENT } from '../common/supabase/supabase.module.js';
import type { AuthenticatedUser } from '../shared/models/auth-context.model.js';
import { mapUserPersistenceError, userNotFound } from './users.error.js';
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

  async registerFighter(
    identity: NewIdentity,
    profile: FighterProfileInput,
    requestId: string,
  ): Promise<PublicUser> {
    try {
      return await this.usersRepository.transaction(async (transaction) => {
        await this.usersRepository.setAuditContext(
          identity.subject,
          requestId,
          transaction,
        );
        const user = await this.usersRepository.createUser(
          identity,
          'FIGHTER',
          transaction,
        );
        await this.usersRepository.createFighter(user.id, profile, transaction);
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
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        code: 'USER_ALREADY_EXISTS',
        message: 'The user could not be created',
      });
    }

    try {
      return await this.usersRepository.transaction(async (transaction) => {
        await this.usersRepository.setAuditContext(
          actor.authSubject,
          requestId,
          transaction,
        );
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
          throw new BadRequestException({
            statusCode: 400,
            error: 'Bad Request',
            code: 'USER_ROLE_MISMATCH',
            message: 'The profile type does not match the user role',
          });
        }

        await this.usersRepository.setAuditContext(
          actor.authSubject,
          requestId,
          transaction,
        );
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
        await this.usersRepository.setAuditContext(
          actor.authSubject,
          requestId,
          transaction,
        );
        await this.usersRepository.softDelete(existing, transaction);
      });
      return { id, deleted: true };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw mapUserPersistenceError(error);
    }
  }
}
