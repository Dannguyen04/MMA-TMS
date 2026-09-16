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
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import {
  AuthenticatedEndpoint,
  PublicEndpoint,
} from '../shared/decorators/auth.decorator.js';
import { ResponseMessage } from '../shared/decorators/response-message.decorator.js';
import { authenticationRequired } from '../shared/errors/access.error.js';
import { AccessTokenGuard } from '../shared/guards/auth.guard.js';
import type { AuthenticatedRequest } from '../shared/models/auth-context.model.js';
import { appZodValidationPipe } from '../shared/pipes/zod-validation.pipe.js';
import { LoginDto, RefreshDto, RegisterDto } from './auth.dto.js';
import { AuthService } from './auth.service.js';

@Controller('auth')
@UsePipes(appZodValidationPipe)
@UseGuards(ThrottlerGuard)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @PublicEndpoint()
  @ResponseMessage('Account registered successfully')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() body: RegisterDto) {
    return this.authService.register(body, randomUUID());
  }

  @Post('login')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @PublicEndpoint()
  @ResponseMessage('Login successful')
  @HttpCode(HttpStatus.OK)
  async login(@Body() body: LoginDto) {
    return this.authService.login(body);
  }

  @Post('refresh')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @PublicEndpoint()
  @ResponseMessage('Session refreshed successfully')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() body: RefreshDto) {
    return this.authService.refresh(body);
  }

  @Post('logout')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @AuthenticatedEndpoint()
  @ResponseMessage('Logout successful')
  @UseGuards(AccessTokenGuard)
  @HttpCode(HttpStatus.OK)
  async logout(@Req() request: AuthenticatedRequest) {
    if (!request.auth) throw authenticationRequired();
    return this.authService.logout(request.auth.accessToken);
  }
}
