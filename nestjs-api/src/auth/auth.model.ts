import { z } from 'zod';
import {
  credentialPasswordSchema,
  normalizedEmailSchema,
} from '../shared/utils/zod-schema.util.js';
import { fighterProfileSchema } from '../users/users.model.js';

export type {
  AuthenticatedUser,
  PermissionRequirement,
  UserRole,
} from '../shared/models/auth-context.model.js';

export const loginBodySchema = z.strictObject({
  email: normalizedEmailSchema,
  password: credentialPasswordSchema,
});

export const registerBodySchema = z.strictObject({
  email: normalizedEmailSchema,
  password: credentialPasswordSchema,
  profile: fighterProfileSchema,
});

export const refreshBodySchema = z.strictObject({
  refreshToken: z.string().min(20).max(4_096),
});

export const authSessionSchema = z.strictObject({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresAt: z.number().int().nullable(),
  expiresIn: z.number().int().positive(),
  tokenType: z.string(),
});

export type LoginInput = z.infer<typeof loginBodySchema>;
export type RegisterInput = z.infer<typeof registerBodySchema>;
export type RefreshInput = z.infer<typeof refreshBodySchema>;
export type AuthSession = z.infer<typeof authSessionSchema>;
