import { HttpException, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
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
import { readAuthProvider } from './auth-provider.config.js';
import {
  createOpaqueToken,
  hashLocalPassword,
  hashOpaqueToken,
  verifyLocalPassword,
} from './local-auth.crypto.js';

const LOCAL_ACCESS_TTL_SECONDS = 15 * 60;
const LOCAL_REFRESH_TTL_SECONDS = 7 * 24 * 60 * 60;
const PASSWORD_RESET_TTL_SECONDS = 30 * 60;

@Injectable()
export class AuthService implements AuthAccessService {
  /** Verified against for unknown emails so login timing does not reveal account existence. */
  private dummyPasswordHash?: Promise<string>;

  constructor(
    @Inject(SUPABASE_AUTH_CLIENT)
    private readonly supabase: SupabaseClient | null,
    @Inject(SUPABASE_ADMIN_CLIENT)
    private readonly supabaseAdmin: SupabaseClient | null,
    private readonly authRepository: AuthRepository,
    private readonly usersService: UsersService,
    private readonly config: ConfigService,
  ) {}

  async register(input: RegisterInput, requestId: string) {
    if (readAuthProvider(this.config) === 'local') {
      return this.registerLocal(input, requestId);
    }
    if (!this.supabase || !this.supabaseAdmin) throw authProviderUnavailable();

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
    if (readAuthProvider(this.config) === 'local') {
      return this.loginLocal(input);
    }
    if (!this.supabase || !this.supabaseAdmin) throw authProviderUnavailable();

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
      await this.authRepository.touchLastActive(user.id);
      return { user, session: this.toSession(data.session) };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw authProviderUnavailable();
    }
  }

  async refresh(
    input: RefreshInput,
  ): Promise<{ user: AuthenticatedUser; session: AuthSession }> {
    if (readAuthProvider(this.config) === 'local') {
      return this.refreshLocal(input.refreshToken);
    }
    if (!this.supabase || !this.supabaseAdmin) throw authProviderUnavailable();

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
    if (readAuthProvider(this.config) === 'local') {
      const revoked = await this.authRepository.revokeLocalSession(
        hashOpaqueToken(accessToken),
      );
      if (!revoked) throw authenticationRequired();
      return { loggedOut: true };
    }
    if (!this.supabaseAdmin) throw authProviderUnavailable();

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

  async requestPasswordReset(
    email: string,
    requestId: string,
  ): Promise<{ accepted: true }> {
    const resetToken = createOpaqueToken();
    try {
      await this.authRepository.createPasswordResetRequest(
        email,
        hashOpaqueToken(resetToken),
        new Date(Date.now() + PASSWORD_RESET_TTL_SECONDS * 1_000),
        requestId,
      );
      return { accepted: true };
    } catch {
      throw authProviderUnavailable();
    }
  }

  async authenticate(accessToken: string): Promise<AuthenticatedUser> {
    if (readAuthProvider(this.config) === 'local') {
      const user = await this.authRepository.findActiveLocalAccessSession(
        hashOpaqueToken(accessToken),
      );
      if (!user) throw authenticationRequired();
      return user;
    }
    if (!this.supabase) throw authenticationRequired();

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

  private async registerLocal(input: RegisterInput, requestId: string) {
    const subject = randomUUID();
    const passwordHash = await hashLocalPassword(input.password);
    const { session, ...sessionRecord } = this.createLocalSessionMaterial();

    try {
      return await this.authRepository.transaction(async (transaction) => {
        await this.authRepository.createLocalIdentity(subject, transaction);
        const user = await this.usersService.registerFighter(
          { subject, email: input.email },
          input.profile,
          requestId,
          transaction,
        );
        await this.authRepository.insertLocalCredential(
          user.id,
          passwordHash,
          transaction,
        );
        await this.authRepository.insertLocalSession(
          { userId: user.id, ...sessionRecord },
          transaction,
        );
        return { user, session, confirmationRequired: false };
      });
    } catch (error) {
      if (error instanceof HttpException) throw error;
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === '23505'
      ) {
        throw registrationConflict();
      }
      throw registrationFailed();
    }
  }

  private async loginLocal(
    input: LoginInput,
  ): Promise<{ user: AuthenticatedUser; session: AuthSession }> {
    const credential = await this.authRepository.findLocalCredentialByEmail(
      input.email,
    );
    const passwordHash =
      credential?.passwordHash ?? (await this.getDummyPasswordHash());
    const valid = await verifyLocalPassword(input.password, passwordHash);
    if (!credential || !valid) throw invalidCredentials();

    const { session, ...sessionRecord } = this.createLocalSessionMaterial();
    await this.authRepository.transaction(async (transaction) => {
      await this.authRepository.insertLocalSession(
        { userId: credential.user.id, ...sessionRecord },
        transaction,
      );
      await this.authRepository.touchLastActive(
        credential.user.id,
        transaction,
      );
    });
    return { user: credential.user, session };
  }

  private async refreshLocal(
    refreshToken: string,
  ): Promise<{ user: AuthenticatedUser; session: AuthSession }> {
    const { session, ...sessionRecord } = this.createLocalSessionMaterial();
    return this.authRepository.transaction(async (transaction) => {
      const current = await this.authRepository.findActiveLocalRefreshSession(
        hashOpaqueToken(refreshToken),
        transaction,
      );
      if (!current) throw invalidCredentials();

      const replacement = await this.authRepository.insertLocalSession(
        { userId: current.user.id, ...sessionRecord },
        transaction,
      );
      await this.authRepository.rotateLocalSession(
        current.id,
        replacement.id,
        transaction,
      );
      await this.authRepository.touchLastActive(current.user.id, transaction);
      return { user: current.user, session };
    });
  }

  private getDummyPasswordHash(): Promise<string> {
    this.dummyPasswordHash ??= hashLocalPassword(randomUUID());
    return this.dummyPasswordHash;
  }

  private createLocalSessionMaterial() {
    const now = Date.now();
    const accessToken = createOpaqueToken();
    const refreshToken = createOpaqueToken();
    const accessExpiresAt = new Date(now + LOCAL_ACCESS_TTL_SECONDS * 1_000);
    const refreshExpiresAt = new Date(now + LOCAL_REFRESH_TTL_SECONDS * 1_000);

    return {
      accessTokenHash: hashOpaqueToken(accessToken),
      refreshTokenHash: hashOpaqueToken(refreshToken),
      accessExpiresAt,
      refreshExpiresAt,
      session: {
        accessToken,
        refreshToken,
        expiresAt: Math.floor(accessExpiresAt.getTime() / 1_000),
        expiresIn: LOCAL_ACCESS_TTL_SECONDS,
        tokenType: 'bearer',
      },
    } satisfies {
      accessTokenHash: string;
      refreshTokenHash: string;
      accessExpiresAt: Date;
      refreshExpiresAt: Date;
      session: AuthSession;
    };
  }
}
