import { createZodDto } from 'nestjs-zod';
import {
  authResponseSchema,
  loginBodySchema,
  logoutResponseSchema,
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
