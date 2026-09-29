import { z } from 'zod';
import {
  credentialPasswordSchema,
  normalizedEmailSchema,
} from '../shared/utils/zod-schema.util.js';
import { userRoles } from '../shared/types/user.role.js';
import { publicUserSchema } from '../users/users.model.js';

export type {
  AuthenticatedUser,
  PermissionRequirement,
  UserRole,
} from '../shared/models/auth-context.model.js';

export const loginBodySchema = z.strictObject({
  email: normalizedEmailSchema,
  password: credentialPasswordSchema,
});

// Registration creates the pre-admission GUEST identity only. Fighter details are
// collected later by the admission application and applied at activation.
export const registerBodySchema = z.strictObject({
  email: normalizedEmailSchema,
  password: credentialPasswordSchema,
});

export const forgotPasswordBodySchema = z.strictObject({
  email: normalizedEmailSchema,
});

export const resetPasswordBodySchema = z.strictObject({
  // The `token_hash` query parameter carried by the recovery email link.
  tokenHash: z.string().trim().min(16).max(512),
  newPassword: credentialPasswordSchema,
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

// The response is identical for known and unknown addresses so it cannot be used
// to discover whether an account exists.
export const forgotPasswordResponseSchema = z.strictObject({
  requested: z.literal(true),
});

export const resetPasswordResponseSchema = z.strictObject({
  passwordUpdated: z.literal(true),
  // True when an approved admission is now waiting for the activation call.
  admissionActivationReady: z.boolean(),
});

export type LoginInput = z.infer<typeof loginBodySchema>;
export type RegisterInput = z.infer<typeof registerBodySchema>;
export type RefreshInput = z.infer<typeof refreshBodySchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordBodySchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordBodySchema>;
export type ForgotPasswordResponse = z.infer<
  typeof forgotPasswordResponseSchema
>;
export type ResetPasswordResponse = z.infer<typeof resetPasswordResponseSchema>;
export type AuthSession = z.infer<typeof authSessionSchema>;
export type AuthResponse = z.infer<typeof authResponseSchema>;
export type RegisterResponse = z.infer<typeof registerResponseSchema>;
export type LogoutResponse = z.infer<typeof logoutResponseSchema>;
