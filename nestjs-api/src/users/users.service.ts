import { HttpException, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_ADMIN_CLIENT } from '../common/supabase/supabase.module.js';
import { readAuthProvider } from '../auth/auth-provider.config.js';
import {
  createOpaqueToken,
  hashLocalPassword,
  hashOpaqueToken,
} from '../auth/local-auth.crypto.js';
import type { AuthenticatedUser } from '../shared/models/auth-context.model.js';
import { USER } from '../shared/types/user.role.js';
import { setAuditContext } from '../shared/utils/audit-context.util.js';
import type { DatabaseExecutor } from '../shared/utils/audit-context.util.js';
import {
  isPostgreSqlError,
  mapUserPersistenceError,
  invalidUserStatusTransition,
  invitationEmailTaken,
  ownAccountStatusChange,
  userCreationFailed,
  userNotFound,
  userRoleMismatch,
  userNotInvited,
} from './users.error.js';
import type {
  CreateUserInput,
  AccountStatus,
  CurrentUser,
  FighterProfileInput,
  InviteUserInput,
  ListUsersQuery,
  PublicUser,
  UserDirectoryPage,
  UiCapability,
  UpdateOwnProfileInput,
  UpdateUserInput,
} from './users.model.js';
import { uiCapabilities } from './users.model.js';
import { UsersRepository } from './users.repo.js';

interface NewIdentity {
  subject: string;
  email: string;
}

const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1_000;

const DOCTOR_ONLY_CAPABILITIES: ReadonlySet<UiCapability> = new Set([
  'medical:read',
  'medical:write',
  'clearance:manage',
  'ai_alerts:review',
]);

const CAPABILITY_REQUIREMENTS: Partial<
  Record<UiCapability, readonly string[]>
> = {
  'fighters:read': ['fighter:get_all', 'fighter:read'],
  'fighters:write': ['fighter:update'],
  'training:read': [
    'training.plan:get_all',
    'training.plan:read',
    'training.plan_exercise:read',
    'training.session:get_all',
    'training.session:read',
    'training.exercise:get_all',
    'training.exercise:read',
  ],
  'training:write': [
    'training.plan:create',
    'training.plan:update',
    'training.plan:transition',
    'training.plan_exercise:create',
    'training.plan_exercise:update',
    'training.plan_exercise:delete',
    'training.session:create',
    'training.session:update',
    'training.session:transition',
    'training.exercise:create',
    'training.exercise:update',
  ],
  'medical:read_summary': ['fighter.medical:read'],
  'users:manage': [
    'users.create',
    'users.read',
    'users.update',
    'users.delete',
  ],
};

@Injectable()
export class UsersService {
  constructor(
    private readonly usersRepository: UsersRepository,
    @Inject(SUPABASE_ADMIN_CLIENT)
    private readonly supabaseAdmin: SupabaseClient | null,
    private readonly config: ConfigService,
  ) {}

  async registerFighter(
    identity: NewIdentity,
    profile: FighterProfileInput,
    requestId: string,
    database?: DatabaseExecutor,
  ): Promise<PublicUser> {
    try {
      const create = async (executor: DatabaseExecutor) => {
        await setAuditContext(identity.subject, requestId, executor);
        const user = await this.usersRepository.createUser(
          identity,
          USER.FIGHTER,
          executor,
        );
        await this.usersRepository.createFighter(user.id, profile, executor);
        const created = await this.usersRepository.findActiveById(
          user.id,
          executor,
          identity.subject,
        );
        if (!created) throw userNotFound();
        return created;
      };
      return database
        ? await create(database)
        : await this.usersRepository.transaction(create);
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
    if (readAuthProvider(this.config) === 'local') {
      return this.createLocal(actor, input, requestId);
    }
    if (!this.supabaseAdmin) throw userCreationFailed();
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

  async invite(
    actor: AuthenticatedUser,
    input: InviteUserInput,
    requestId: string,
  ): Promise<PublicUser> {
    const invitationTokenHash = hashOpaqueToken(createOpaqueToken());
    const expiresAt = new Date(Date.now() + INVITATION_TTL_MS);
    let subject: string = randomUUID();
    let supabaseIdentityCreated = false;

    if (readAuthProvider(this.config) === 'supabase') {
      if (!this.supabaseAdmin) throw userCreationFailed();
      const { data, error } =
        await this.supabaseAdmin.auth.admin.inviteUserByEmail(input.email);
      if (error || !data.user?.id) throw userCreationFailed();
      subject = data.user.id;
      supabaseIdentityCreated = true;
    }

    try {
      return await this.usersRepository.transaction(async (transaction) => {
        await setAuditContext(actor.authSubject, requestId, transaction);
        if (!supabaseIdentityCreated) {
          await this.usersRepository.createLocalIdentity(subject, transaction);
        }
        const user = await this.usersRepository.createInvitedUser(
          { subject, email: input.email },
          input,
          transaction,
        );
        await this.usersRepository.createInvitation(
          user.id,
          input.email,
          invitationTokenHash,
          expiresAt,
          requestId,
          transaction,
        );
        const created = await this.usersRepository.findActiveById(
          user.id,
          transaction,
        );
        if (!created) throw userNotFound();
        return created;
      });
    } catch (error) {
      if (supabaseIdentityCreated && this.supabaseAdmin) {
        await this.supabaseAdmin.auth.admin.deleteUser(subject);
      }
      if (error instanceof HttpException) throw error;
      // 23505: unique_violation
      if (isPostgreSqlError(error) && error.code === '23505') {
        throw invitationEmailTaken();
      }
      throw mapUserPersistenceError(error);
    }
  }

  async resendInvite(
    id: string,
    actor: AuthenticatedUser,
    requestId: string,
  ): Promise<PublicUser> {
    const invitationTokenHash = hashOpaqueToken(createOpaqueToken());
    const expiresAt = new Date(Date.now() + INVITATION_TTL_MS);
    try {
      return await this.usersRepository.transaction(async (transaction) => {
        const existing = await this.usersRepository.findActiveById(
          id,
          transaction,
        );
        if (!existing) throw userNotFound();
        if (existing.status !== 'INVITED') throw userNotInvited();
        await setAuditContext(actor.authSubject, requestId, transaction);
        await this.usersRepository.createInvitation(
          existing.id,
          existing.email,
          invitationTokenHash,
          expiresAt,
          requestId,
          transaction,
        );
        return existing;
      });
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw mapUserPersistenceError(error);
    }
  }

  private async createLocal(
    actor: AuthenticatedUser,
    input: CreateUserInput,
    requestId: string,
  ): Promise<PublicUser> {
    const subject = randomUUID();
    const passwordHash = await hashLocalPassword(input.password);
    try {
      return await this.usersRepository.transaction(async (transaction) => {
        await setAuditContext(actor.authSubject, requestId, transaction);
        await this.usersRepository.createLocalIdentity(subject, transaction);
        const user = await this.usersRepository.createUser(
          { subject, email: input.email },
          input.role,
          transaction,
        );
        await this.usersRepository.createRoleProfile(
          user.id,
          input,
          transaction,
        );
        await this.usersRepository.createLocalCredential(
          user.id,
          passwordHash,
          transaction,
        );
        const created = await this.usersRepository.findActiveById(
          user.id,
          transaction,
        );
        if (!created) throw userNotFound();
        return created;
      });
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw mapUserPersistenceError(error);
    }
  }

  async findOne(id: string): Promise<PublicUser> {
    const user = await this.usersRepository.findActiveById(id);
    if (!user) throw userNotFound();
    return user;
  }

  list(input: ListUsersQuery): Promise<UserDirectoryPage> {
    return this.usersRepository.findPage(input);
  }

  async updateStatus(
    id: string,
    actor: AuthenticatedUser,
    status: AccountStatus,
    requestId: string,
  ): Promise<PublicUser> {
    if (id === actor.id) throw ownAccountStatusChange();
    try {
      return await this.usersRepository.transaction(async (transaction) => {
        const existing = await this.usersRepository.findActiveById(
          id,
          transaction,
        );
        if (!existing) throw userNotFound();
        if (status === 'INVITED' && existing.status !== 'INVITED') {
          throw invalidUserStatusTransition();
        }
        await setAuditContext(actor.authSubject, requestId, transaction);
        await this.usersRepository.updateAccountStatus(id, status, transaction);
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

  async findMe(actor: AuthenticatedUser): Promise<CurrentUser> {
    const user = await this.findOne(actor.id);
    const [permissionCodes, fighterIds] = await Promise.all([
      this.usersRepository.findEffectivePermissionCodes(actor.id, actor.role),
      this.usersRepository.findActiveAssignmentFighterIds(actor.id, actor.role),
    ]);

    return {
      ...user,
      effectiveCapabilities: this.toUiCapabilities(permissionCodes, actor.role),
      assignmentScope: { fighterIds },
    };
  }

  async updateMe(
    actor: AuthenticatedUser,
    input: UpdateOwnProfileInput,
    requestId: string,
  ): Promise<PublicUser> {
    try {
      return await this.usersRepository.transaction(async (transaction) => {
        const existing = await this.usersRepository.findActiveById(
          actor.id,
          transaction,
          actor.authSubject,
        );
        if (!existing) throw userNotFound();
        await setAuditContext(actor.authSubject, requestId, transaction);
        await this.usersRepository.updateOwnProfile(
          actor.id,
          input,
          transaction,
        );
        const updated = await this.usersRepository.findActiveById(
          actor.id,
          transaction,
          actor.authSubject,
        );
        if (!updated) throw userNotFound();
        return updated;
      });
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw mapUserPersistenceError(error);
    }
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

  private toUiCapabilities(
    permissionCodes: readonly string[],
    role: AuthenticatedUser['role'],
  ): UiCapability[] {
    const granted = new Set(permissionCodes);

    return uiCapabilities.filter((capability) => {
      if (role !== USER.DOCTOR && DOCTOR_ONLY_CAPABILITIES.has(capability)) {
        return false;
      }
      if (granted.has(capability)) return true;
      const required = CAPABILITY_REQUIREMENTS[capability];
      return required?.every((code) => granted.has(code)) ?? false;
    });
  }
}
