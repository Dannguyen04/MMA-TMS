import { z } from 'zod';
import {
  credentialPasswordSchema,
  normalizedEmailSchema,
} from '../shared/utils/zod-schema.util.js';
import { userRoles } from '../shared/types/user.role.js';
import {
  fighterProfileSchema,
  publicUserSchema,
} from '../users/users.model.js';

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

export const authResponseSchema = z.strictObject({
  user: z.strictObject({
    id: z.uuid(),
    authSubject: z.string(),
    email: z.email(),
    role: z.enum(userRoles),
  }),
  session: authSessionSchema,
});

export const registerResponseSchema = z.strictObject({
  user: publicUserSchema,
  session: authSessionSchema.nullable(),
  confirmationRequired: z.boolean(),
});

export const logoutResponseSchema = z.strictObject({
  loggedOut: z.literal(true),
});

export type LoginInput = z.infer<typeof loginBodySchema>;
export type RegisterInput = z.infer<typeof registerBodySchema>;
export type RefreshInput = z.infer<typeof refreshBodySchema>;
export type AuthSession = z.infer<typeof authSessionSchema>;
export type AuthResponse = z.infer<typeof authResponseSchema>;
export type RegisterResponse = z.infer<typeof registerResponseSchema>;
export type LogoutResponse = z.infer<typeof logoutResponseSchema>;
