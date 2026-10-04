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

export const demoSessionExchangeBodySchema = z.strictObject({
  email: normalizedEmailSchema,
});

// Passwordless admission (decided 2026-10-04): the applicant proves the email
// with a one-time code, gets a session and a GUEST identity, and sets a
// password only after approval, through the existing recovery/reset flow.
export const admissionEmailCodeBodySchema = z.strictObject({
  email: normalizedEmailSchema,
});

export const admissionEmailVerifyBodySchema = z.strictObject({
  email: normalizedEmailSchema,
  // The numeric email OTP; its length is configured in the provider.
  token: z
    .string()
    .trim()
    .regex(/^\d{6,10}$/, 'Expected the numeric code from the email'),
});

// Identical for every address so it cannot reveal accounts or applications.
export const admissionEmailCodeResponseSchema = z.strictObject({
  requested: z.literal(true),
});

// Legacy password registration of a pre-admission GUEST, kept for existing
// clients. Fighter details are collected later by the admission application.
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
export type DemoSessionExchangeInput = z.infer<
  typeof demoSessionExchangeBodySchema
>;
export type RegisterInput = z.infer<typeof registerBodySchema>;
export type AdmissionEmailVerifyInput = z.infer<
  typeof admissionEmailVerifyBodySchema
>;
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
