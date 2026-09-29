import { createZodDto } from 'nestjs-zod';
import {
  authResponseSchema,
  forgotPasswordBodySchema,
  forgotPasswordResponseSchema,
  loginBodySchema,
  logoutResponseSchema,
  refreshBodySchema,
  registerBodySchema,
  registerResponseSchema,
  resetPasswordBodySchema,
  resetPasswordResponseSchema,
} from './auth.model.js';

export class LoginDto extends createZodDto(loginBodySchema) {}
export class RegisterDto extends createZodDto(registerBodySchema) {}
export class RefreshDto extends createZodDto(refreshBodySchema) {}
export class ForgotPasswordDto extends createZodDto(forgotPasswordBodySchema) {}
export class ResetPasswordDto extends createZodDto(resetPasswordBodySchema) {}
export class AuthResponseDto extends createZodDto(authResponseSchema) {}
export class RegisterResponseDto extends createZodDto(registerResponseSchema) {}
export class LogoutResponseDto extends createZodDto(logoutResponseSchema) {}
export class ForgotPasswordResponseDto extends createZodDto(
  forgotPasswordResponseSchema,
) {}
export class ResetPasswordResponseDto extends createZodDto(
  resetPasswordResponseSchema,
) {}
