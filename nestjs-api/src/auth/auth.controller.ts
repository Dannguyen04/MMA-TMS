import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import {
  ApiConflictEnvelope,
  ApiSuccessEnvelope,
  ApiUnauthorizedEnvelope,
  ApiValidationErrorEnvelope,
} from '../shared/decorators/api-envelope.decorator.js';
import {
  AuthenticatedEndpoint,
  PublicEndpoint,
} from '../shared/decorators/auth.decorator.js';
import { ResponseMessage } from '../shared/decorators/response-message.decorator.js';
import { authenticationRequired } from '../shared/errors/access.error.js';
import { AccessTokenGuard } from '../shared/guards/auth.guard.js';
import type { AuthenticatedRequest } from '../shared/models/auth-context.model.js';
import { appZodValidationPipe } from '../shared/pipes/zod-validation.pipe.js';
import {
  AuthResponseDto,
  ForgotPasswordDto,
  ForgotPasswordResponseDto,
  LoginDto,
  LogoutResponseDto,
  RefreshDto,
  RegisterDto,
  RegisterResponseDto,
  ResetPasswordDto,
  ResetPasswordResponseDto,
} from './auth.dto.js';
import { AuthService } from './auth.service.js';

@ApiTags('Auth')
@Controller('auth')
@UsePipes(appZodValidationPipe)
@UseGuards(ThrottlerGuard)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @PublicEndpoint()
  @ApiOperation({
    summary: 'Register new guest account',
    description:
      'Registers credentials and creates the pre-admission GUEST identity. Fighter access is granted only after an admission application is approved and activated.',
  })
  @ResponseMessage('Account registered successfully')
  @HttpCode(HttpStatus.CREATED)
  @ApiSuccessEnvelope({
    status: HttpStatus.CREATED,
    message: 'Account registered successfully',
    model: RegisterResponseDto,
  })
  @ApiValidationErrorEnvelope(
    'Invalid registration payload or password policy failure',
  )
  @ApiConflictEnvelope(
    'REGISTRATION_CONFLICT',
    'The account could not be registered (e.g. email in use)',
  )
  async register(@Body() body: RegisterDto) {
    return this.authService.register(body, randomUUID());
  }

  @Post('login')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @PublicEndpoint()
  @ApiOperation({
    summary: 'User login',
    description:
      'Authenticates with email and password, issuing access and refresh tokens',
  })
  @ResponseMessage('Login successful')
  @HttpCode(HttpStatus.OK)
  @ApiSuccessEnvelope({
    status: HttpStatus.OK,
    message: 'Login successful',
    model: AuthResponseDto,
  })
  @ApiValidationErrorEnvelope('Invalid email or password structure')
  @ApiUnauthorizedEnvelope('Email, password, or session is invalid')
  async login(@Body() body: LoginDto) {
    return this.authService.login(body);
  }

  @Post('refresh')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @PublicEndpoint()
  @ApiOperation({
    summary: 'Refresh session tokens',
    description:
      'Exchange a valid refresh token for a new access and refresh token pair',
  })
  @ResponseMessage('Session refreshed successfully')
  @HttpCode(HttpStatus.OK)
  @ApiSuccessEnvelope({
    status: HttpStatus.OK,
    message: 'Session refreshed successfully',
    model: AuthResponseDto,
  })
  @ApiValidationErrorEnvelope('Invalid refresh token structure')
  @ApiUnauthorizedEnvelope('Refresh token is invalid or expired')
  async refresh(@Body() body: RefreshDto) {
    return this.authService.refresh(body);
  }

  @Post('forgot-password')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @PublicEndpoint()
  @ApiOperation({
    summary: 'Request a password recovery email',
    description:
      'Sends a password recovery link for any role. The response is identical whether or not an account exists, so it cannot be used to discover registered addresses.',
  })
  @ResponseMessage(
    'If an account exists, password reset instructions will be sent.',
  )
  @HttpCode(HttpStatus.OK)
  @ApiSuccessEnvelope({
    status: HttpStatus.OK,
    message: 'If an account exists, password reset instructions will be sent.',
    model: ForgotPasswordResponseDto,
  })
  @ApiValidationErrorEnvelope('Invalid email structure')
  async forgotPassword(@Body() body: ForgotPasswordDto) {
    await this.authService.sendPasswordRecoveryEmail(body.email);
    return { requested: true as const };
  }

  @Post('reset-password')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @PublicEndpoint()
  @ApiOperation({
    summary: 'Set a new password from a recovery link',
    description:
      'Redeems the token_hash carried by the recovery email and sets a new password. When the account has an approved admission awaiting activation, the successful change is recorded so the activation step can proceed.',
  })
  @ResponseMessage('Password updated successfully')
  @HttpCode(HttpStatus.OK)
  @ApiSuccessEnvelope({
    status: HttpStatus.OK,
    message: 'Password updated successfully',
    model: ResetPasswordResponseDto,
  })
  @ApiValidationErrorEnvelope(
    'Invalid recovery token or password structure (VALIDATION_ERROR), or the provider rejected the password policy (RESET_PASSWORD_TOO_WEAK)',
  )
  @ApiUnauthorizedEnvelope(
    'The recovery link is invalid, already used, or expired',
  )
  @ApiConflictEnvelope(
    'RESET_PASSWORD_SAME_AS_CURRENT',
    'The account already uses this password, or another recovery for the same activation is in progress',
  )
  async resetPassword(@Body() body: ResetPasswordDto) {
    return this.authService.resetPassword(body, randomUUID());
  }

  @Post('logout')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @AuthenticatedEndpoint()
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'User logout',
    description:
      'Terminates the current authenticated session on the authentication provider',
  })
  @ResponseMessage('Logout successful')
  @UseGuards(AccessTokenGuard)
  @HttpCode(HttpStatus.OK)
  @ApiSuccessEnvelope({
    status: HttpStatus.OK,
    message: 'Logout successful',
    model: LogoutResponseDto,
  })
  @ApiUnauthorizedEnvelope('A valid access token is required')
  async logout(@Req() request: AuthenticatedRequest) {
    if (!request.auth) throw authenticationRequired();
    return this.authService.logout(request.auth.accessToken);
  }
}
