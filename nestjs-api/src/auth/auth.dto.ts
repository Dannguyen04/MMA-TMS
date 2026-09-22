import { createZodDto } from 'nestjs-zod';
import {
  authResponseSchema,
  loginBodySchema,
  logoutResponseSchema,
  passwordResetRequestBodySchema,
  passwordResetRequestResponseSchema,
  refreshBodySchema,
  registerBodySchema,
  registerResponseSchema,
} from './auth.model.js';

export class LoginDto extends createZodDto(loginBodySchema) {}
export class RegisterDto extends createZodDto(registerBodySchema) {}
export class RefreshDto extends createZodDto(refreshBodySchema) {}
export class AuthResponseDto extends createZodDto(authResponseSchema) {}
export class RegisterResponseDto extends createZodDto(registerResponseSchema) {}
export class LogoutResponseDto extends createZodDto(logoutResponseSchema) {}
export class PasswordResetRequestDto extends createZodDto(
  passwordResetRequestBodySchema,
) {}
export class PasswordResetRequestResponseDto extends createZodDto(
  passwordResetRequestResponseSchema,
) {}
