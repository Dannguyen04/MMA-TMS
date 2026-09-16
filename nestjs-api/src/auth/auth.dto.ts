import { createZodDto } from 'nestjs-zod';
import {
  loginBodySchema,
  refreshBodySchema,
  registerBodySchema,
} from './auth.model.js';

export class LoginDto extends createZodDto(loginBodySchema) {}
export class RegisterDto extends createZodDto(registerBodySchema) {}
export class RefreshDto extends createZodDto(refreshBodySchema) {}
