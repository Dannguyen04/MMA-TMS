import {
  forwardRef,
  ForbiddenException,
  HttpException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import {
  SUPABASE_ADMIN_CLIENT,
  SUPABASE_AUTH_CLIENT,
  SUPABASE_REQUEST_CLIENT_FACTORY,
  type SupabaseRequestClientFactory,
} from '../common/supabase/supabase.module.js';
import {
  ADMISSION_ACTIVATION_PORT,
  type AdmissionActivationClaim,
  type AdmissionActivationPort,
} from '../shared/contracts/admission-activation.contract.js';
import type { AuthAccessService } from '../shared/contracts/auth-access.contract.js';
import type {
  RecoveryEmailResult,
  RecoveryEmailService,
} from '../shared/contracts/recovery-email.contract.js';
import { authenticationRequired } from '../shared/errors/access.error.js';
import type {
  AuthenticatedUser,
  PermissionRequirement,
} from '../shared/models/auth-context.model.js';
import { USER } from '../shared/types/user.role.js';
import { UsersService } from '../users/users.service.js';
import {
  PASSWORD_RESET_REDIRECT_URL_KEY,
  PASSWORD_SET_RETRY_ATTEMPTS,
  PASSWORD_SET_RETRY_DELAY_MS,
  SAME_PASSWORD_ERROR_CODE,
  WEAK_PASSWORD_ERROR_CODE,
} from './auth.constants.js';
import {
  authProviderUnavailable,
  invalidCredentials,
  registrationConflict,
  registrationFailed,
  resetPasswordConfirmationFailed,
  resetPasswordInProgress,
  resetPasswordProviderFailed,
  resetPasswordSameAsCurrent,
  resetPasswordTooWeak,
  resetTokenInvalid,
} from './auth.error.js';
import type {
  AdmissionEmailVerifyInput,
  AuthSession,
  DemoSessionExchangeInput,
  LoginInput,
  RefreshInput,
  RegisterInput,
  ResetPasswordInput,
  ResetPasswordResponse,
} from './auth.model.js';
import { TtlCache, jwtExpiryMs } from './auth-cache.js';
import { AuthRepository } from './auth.repo.js';

@Injectable()
export class AuthService implements AuthAccessService, RecoveryEmailService {
  private readonly logger = new Logger(AuthService.name);
  private readonly identityCache = new TtlCache<AuthenticatedUser>();
  private readonly permissionCache = new TtlCache<Map<string, boolean>>();

  constructor(
    @Inject(SUPABASE_AUTH_CLIENT)
    private readonly supabase: SupabaseClient,
    @Inject(SUPABASE_ADMIN_CLIENT)
    private readonly supabaseAdmin: SupabaseClient,
    @Inject(SUPABASE_REQUEST_CLIENT_FACTORY)
    private readonly createRequestClient: SupabaseRequestClientFactory,
    // FighterAdmissionsService injects RECOVERY_EMAIL_SERVICE (this class) back,
    // so this specific provider pair is circular across modules. Module-level
    // forwardRef alone is not enough; Nest also needs it here at the injection
    // site, on at least one side of the pair, or the DI container deadlocks
    // during startup instead of throwing.
    @Inject(forwardRef(() => ADMISSION_ACTIVATION_PORT))
    private readonly admissionActivation: AdmissionActivationPort,
    private readonly config: ConfigService,
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

      const user = await this.usersService.registerGuest(
        { subject: data.user.id, email: data.user.email },
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

  /**
   * Passwordless admission, step 1: asks the provider to email a one-time
   * code. `shouldCreateUser` lets a brand-new address get an auth identity;
   * no public user exists until the code is verified. The caller always gets
   * the same answer, so the endpoint reveals nothing about accounts.
   */
  async requestAdmissionEmailCode(email: string): Promise<void> {
    try {
      const { error } = await this.supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: true },
      });
      if (error) {
        this.logger.warn('Admission email code request was not accepted');
      }
    } catch {
      this.logger.warn(
        'Admission email code request failed to reach the provider',
      );
    }
  }

  /**
   * Passwordless admission, step 2: the provider verifies the code and returns
   * a session for that subject, then the GUEST is provisioned idempotently
   * (find-or-create by verified subject). Verification never grants FIGHTER,
   * never records PASSWORD_SET and never touches an existing user's role.
   * Only GUEST accounts sign in this way; other roles keep password login.
   *
   * Provider and database are not one transaction: when provisioning fails
   * after a consumed code, the session is signed out and the applicant asks
   * for a new code; verifying it reaches the same subject, and the
   * provisioning step completes without creating a second user.
   */
  async verifyAdmissionEmail(
    input: AdmissionEmailVerifyInput,
    requestId: string,
  ): Promise<{ user: AuthenticatedUser; session: AuthSession }> {
    const client = this.createRequestClient();
    const verified = await client.auth
      .verifyOtp({ email: input.email, token: input.token, type: 'email' })
      .catch(() => null);
    const session = verified?.data.session;
    const authUser = verified?.data.user;
    if (
      !verified ||
      verified.error ||
      !session ||
      !authUser?.id ||
      !authUser.email
    ) {
      throw invalidCredentials();
    }

    try {
      await this.usersService.provisionGuest(
        { subject: authUser.id, email: authUser.email },
        requestId,
      );
      const user = await this.authRepository.findActiveUserBySubject(
        authUser.id,
      );
      if (!user || user.role !== USER.GUEST) throw invalidCredentials();
      return { user, session: this.toSession(session) };
    } catch (error) {
      await this.supabaseAdmin.auth.admin
        .signOut(session.access_token, 'local')
        .catch(() => undefined);
      if (error instanceof HttpException) throw error;
      throw authProviderUnavailable();
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

  async exchangeDemoSession(
    input: DemoSessionExchangeInput,
    suppliedSecret: string | undefined,
  ): Promise<{ user: AuthenticatedUser; session: AuthSession }> {
    const nodeEnv = this.config.get<string>('NODE_ENV');
    const expectedSecret = this.config.get<string>(
      'DEMO_SESSION_EXCHANGE_SECRET',
    );
    if (nodeEnv === 'production' || !expectedSecret) {
      throw new NotFoundException(
        'Development session exchange is unavailable',
      );
    }
    if (!suppliedSecret || suppliedSecret !== expectedSecret) {
      throw new ForbiddenException('Development session exchange is forbidden');
    }

    try {
      const generated = await this.supabaseAdmin.auth.admin.generateLink({
        type: 'magiclink',
        email: input.email,
      });
      const tokenHash = generated.data.properties?.hashed_token;
      if (generated.error || !tokenHash) throw invalidCredentials();

      const requestClient = this.createRequestClient();
      const verified = await requestClient.auth.verifyOtp({
        token_hash: tokenHash,
        type: 'magiclink',
      });
      if (verified.error || !verified.data.session || !verified.data.user) {
        throw invalidCredentials();
      }
      const user = await this.authRepository.findActiveUserBySubject(
        verified.data.user.id,
      );
      if (!user) throw invalidCredentials();
      return { user, session: this.toSession(verified.data.session) };
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

  /**
   * Shared recovery-mail entry point for every role. `accepted` reports only
   * that the provider took the request; delivery is never asserted. The public
   * endpoint discards the distinction, while the admission flow records it.
   */
  async sendPasswordRecoveryEmail(email: string): Promise<RecoveryEmailResult> {
    try {
      const { error } = await this.supabase.auth.resetPasswordForEmail(email, {
        redirectTo: this.config.getOrThrow<string>(
          PASSWORD_RESET_REDIRECT_URL_KEY,
        ),
      });
      if (error) {
        this.logger.warn('Password recovery request was not accepted');
        return { accepted: false };
      }
      return { accepted: true };
    } catch {
      this.logger.warn(
        'Password recovery request failed to reach the provider',
      );
      return { accepted: false };
    }
  }

  /**
   * Redeems a recovery link. `verifyOtp` with type `recovery` is the proof that
   * this request came from a real recovery mail: the provider validates the
   * token it issued and only then returns a session. The password update runs
   * on that same request-scoped client, so it is a normal user-context change
   * rather than an administrative override.
   */
  async resetPassword(
    input: ResetPasswordInput,
    requestId: string,
  ): Promise<ResetPasswordResponse> {
    const client = this.createRequestClient();

    // A recovery link is single use: a second redemption, an expired link, or a
    // malformed token_hash all land in the same stable 401.
    const verified = await client.auth
      .verifyOtp({ token_hash: input.tokenHash, type: 'recovery' })
      .catch(() => null);
    if (!verified || verified.error || !verified.data.user?.id) {
      throw resetTokenInvalid();
    }
    const authSubject = verified.data.user.id;

    // Claim the approved admission before the provider call so two concurrent
    // redemptions cannot both drive the same activation forward.
    const claim = await this.admissionActivation.claimPendingActivation(
      authSubject,
      requestId,
    );
    if (claim.outcome === 'CLAIMED_BY_ANOTHER_REQUEST') {
      throw resetPasswordInProgress();
    }

    const updated = await client.auth
      .updateUser({ password: input.newPassword })
      .catch(() => null);

    if (!updated || updated.error) {
      // Release the claim first: the password was not changed, so the applicant
      // must be able to redeem a new recovery link immediately.
      if (claim.outcome === 'CLAIMED') {
        await this.releaseClaimQuietly(claim.claim, requestId);
      }
      throw this.toPasswordUpdateError(updated?.error);
    }

    if (claim.outcome !== 'CLAIMED') {
      return {
        passwordUpdated: true,
        admissionActivationReady: claim.outcome === 'ALREADY_PASSWORD_SET',
      };
    }

    const recorded = await this.recordPasswordSet(claim.claim, requestId);
    if (!recorded) throw resetPasswordConfirmationFailed();
    return { passwordUpdated: true, admissionActivationReady: true };
  }

  /**
   * Classifies by `AuthError.code` only. The provider message is never parsed
   * and never returned to the caller.
   */
  private toPasswordUpdateError(error: unknown): HttpException {
    const code =
      typeof error === 'object' && error !== null && 'code' in error
        ? error.code
        : undefined;
    if (code === SAME_PASSWORD_ERROR_CODE) return resetPasswordSameAsCurrent();
    if (code === WEAK_PASSWORD_ERROR_CODE) return resetPasswordTooWeak();
    return resetPasswordProviderFailed();
  }

  private async recordPasswordSet(
    claim: AdmissionActivationClaim,
    requestId: string,
  ): Promise<boolean> {
    for (
      let attempt = 1;
      attempt <= PASSWORD_SET_RETRY_ATTEMPTS;
      attempt += 1
    ) {
      try {
        await this.admissionActivation.markPasswordSet(claim, requestId);
        return true;
      } catch {
        if (attempt === PASSWORD_SET_RETRY_ATTEMPTS) {
          this.logger.error(
            `Password changed but activation ${claim.activationId} was not marked as password-set`,
          );
          return false;
        }
        await new Promise((resolve) =>
          setTimeout(resolve, PASSWORD_SET_RETRY_DELAY_MS * attempt),
        );
      }
    }
    return false;
  }

  private async releaseClaimQuietly(
    claim: AdmissionActivationClaim,
    requestId: string,
  ): Promise<void> {
    try {
      await this.admissionActivation.releaseClaim(claim, requestId);
    } catch {
      this.logger.error(
        `Activation ${claim.activationId} stayed claimed after a failed password change`,
      );
    }
  }

  async authenticate(accessToken: string): Promise<AuthenticatedUser> {
    const cacheKey = createHash('sha256').update(accessToken).digest('hex');
    const cached = this.identityCache.get(cacheKey);
    if (cached) return cached;
    try {
      const { data, error } = await this.supabase.auth.getUser(accessToken);
      if (error || !data.user?.id) throw authenticationRequired();

      const user = await this.authRepository.findActiveUserBySubject(
        data.user.id,
      );
      if (!user) throw authenticationRequired();
      this.identityCache.set(
        cacheKey,
        user,
        jwtExpiryMs(accessToken) ?? undefined,
      );
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
    const permissionKey = `${user.id}:${user.role}:${[...requested].sort().join(',')}`;
    let resolved = this.permissionCache.get(permissionKey);
    if (!resolved) {
      resolved = await this.authRepository.resolvePermissions(
        user.id,
        user.role,
        requested,
      );
      this.permissionCache.set(permissionKey, resolved);
    }

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
