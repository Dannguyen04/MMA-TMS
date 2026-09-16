import { HttpException, Inject, Injectable } from '@nestjs/common';
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import {
  SUPABASE_ADMIN_CLIENT,
  SUPABASE_AUTH_CLIENT,
} from '../common/supabase/supabase.module.js';
import type { AuthAccessService } from '../shared/contracts/auth-access.contract.js';
import { authenticationRequired } from '../shared/errors/access.error.js';
import type {
  AuthenticatedUser,
  PermissionRequirement,
} from '../shared/models/auth-context.model.js';
import { UsersService } from '../users/users.service.js';
import {
  authProviderUnavailable,
  invalidCredentials,
  registrationConflict,
  registrationFailed,
} from './auth.error.js';
import type {
  AuthSession,
  LoginInput,
  RefreshInput,
  RegisterInput,
} from './auth.model.js';
import { AuthRepository } from './auth.repo.js';

@Injectable()
export class AuthService implements AuthAccessService {
  constructor(
    @Inject(SUPABASE_AUTH_CLIENT)
    private readonly supabase: SupabaseClient,
    @Inject(SUPABASE_ADMIN_CLIENT)
    private readonly supabaseAdmin: SupabaseClient,
    private readonly authRepository: AuthRepository,
    private readonly usersService: UsersService,
  ) {}

  async register(input: RegisterInput, requestId: string) {
    let newlyCreatedAuthUserId: string | undefined;
    try {
      const { data, error } = await this.supabase.auth.signUp({
        email: input.email,
        password: input.password,
      });
      
      if (error) throw registrationConflict();
      if (!data.user?.id || !data.user.email) throw registrationFailed();
      if (data.user.identities?.length === 0) throw registrationConflict();
      if (data.user.identities && data.user.identities.length > 0) {
        newlyCreatedAuthUserId = data.user.id;
      }

      const user = await this.usersService.registerFighter(
        { subject: data.user.id, email: data.user.email },
        input.profile,
        requestId,
      );

      return {
        user,
        session: data.session ? this.toSession(data.session) : null,
        confirmationRequired: data.session === null,
      };
    } catch (error) {
      if (newlyCreatedAuthUserId) {
        await this.supabaseAdmin.auth.admin.deleteUser(newlyCreatedAuthUserId);
      }
      if (error instanceof HttpException) throw error;
      throw registrationFailed();
    }
  }

  async login(
    input: LoginInput,
  ): Promise<{ user: AuthenticatedUser; session: AuthSession }> {
    try {
      const { data, error } =
        await this.supabase.auth.signInWithPassword(input);
      if (error || !data.session || !data.user) throw invalidCredentials();

      const user = await this.authRepository.findActiveUserBySubject(
        data.user.id,
      );
      if (!user) {
        await this.supabaseAdmin.auth.admin.signOut(
          data.session.access_token,
          'local',
        );
        throw invalidCredentials();
      }
      return { user, session: this.toSession(data.session) };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw authProviderUnavailable();
    }
  }

  async refresh(
    input: RefreshInput,
  ): Promise<{ user: AuthenticatedUser; session: AuthSession }> {
    try {
      const { data, error } = await this.supabase.auth.refreshSession({
        refresh_token: input.refreshToken,
      });
      if (error || !data.session || !data.user) throw invalidCredentials();

      const user = await this.authRepository.findActiveUserBySubject(
        data.user.id,
      );
      if (!user) {
        await this.supabaseAdmin.auth.admin.signOut(
          data.session.access_token,
          'local',
        );
        throw invalidCredentials();
      }
      return { user, session: this.toSession(data.session) };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw authProviderUnavailable();
    }
  }

  async logout(accessToken: string): Promise<{ loggedOut: true }> {
    try {
      const { error } = await this.supabaseAdmin.auth.admin.signOut(
        accessToken,
        'local',
      );
      if (error) throw authenticationRequired();
      return { loggedOut: true };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw authProviderUnavailable();
    }
  }

  async authenticate(accessToken: string): Promise<AuthenticatedUser> {
    try {
      const { data, error } = await this.supabase.auth.getUser(accessToken);
      if (error || !data.user?.id) throw authenticationRequired();

      const user = await this.authRepository.findActiveUserBySubject(
        data.user.id,
      );
      if (!user) throw authenticationRequired();
      return user;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw authenticationRequired();
    }
  }

  async hasPermissions(
    user: AuthenticatedUser,
    requirement: PermissionRequirement,
  ): Promise<boolean> {
    const allOf = requirement.allOf ?? [];
    const anyOf = requirement.anyOf ?? [];
    if ((allOf.length === 0) === (anyOf.length === 0)) return false;

    const requested = [...new Set([...allOf, ...anyOf])];
    const resolved = await this.authRepository.resolvePermissions(
      user.id,
      user.role,
      requested,
    );

    return allOf.length > 0
      ? allOf.every((code) => resolved.get(code) === true)
      : anyOf.some((code) => resolved.get(code) === true);
  }

  private toSession(session: Session): AuthSession {
    return {
      accessToken: session.access_token,
      refreshToken: session.refresh_token,
      expiresAt: session.expires_at ?? null,
      expiresIn: session.expires_in,
      tokenType: session.token_type,
    };
  }
}
