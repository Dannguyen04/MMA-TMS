import {
  forgotPasswordBodySchema,
  loginBodySchema,
  refreshBodySchema,
  registerBodySchema,
  registerResponseSchema,
  resetPasswordBodySchema,
  forgotPasswordResponseSchema,
  resetPasswordResponseSchema,
} from './auth.model.js';

describe('auth Zod contracts', () => {
  it('normalizes login email without coercing the password', () => {
    expect(
      loginBodySchema.parse({
        email: 'Fighter@Example.com',
        password: 'strong-password',
      }),
    ).toEqual({
      email: 'fighter@example.com',
      password: 'strong-password',
    });
  });

  it('rejects short passwords and unknown keys', () => {
    expect(
      loginBodySchema.safeParse({
        email: 'fighter@example.com',
        password: 'short',
        role: 'ADMIN',
      }).success,
    ).toBe(false);
  });

  it('accepts only email and password for registration (no profile)', () => {
    expect(
      registerBodySchema.safeParse({
        email: 'guest@example.com',
        password: 'strong-password',
      }).success,
    ).toBe(true);
  });

  it('rejects registration with a profile or unknown keys', () => {
    expect(
      registerBodySchema.safeParse({
        email: 'guest@example.com',
        password: 'strong-password',
        profile: {
          firstName: 'An',
          lastName: 'Nguyen',
          dateOfBirth: '2000-01-01',
          weightClass: 'LIGHTWEIGHT',
        },
      }).success,
    ).toBe(false);
  });

  it('bounds refresh tokens and rejects unknown keys', () => {
    expect(refreshBodySchema.safeParse({ refreshToken: 'short' }).success).toBe(
      false,
    );
    expect(
      refreshBodySchema.safeParse({
        refreshToken: 'r'.repeat(40),
        accessToken: 'must-not-be-accepted-here',
      }).success,
    ).toBe(false);
  });

  it('documents registration responses with nullable sessions and confirmation state', () => {
    const response = {
      user: {
        id: '516a01dc-f842-40e4-ae88-abca224921b7',
        email: 'guest@example.com',
        role: 'GUEST' as const,
        isActive: true,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        deletedAt: null,
        profile: null,
      },
      session: null,
      confirmationRequired: true,
    };

    expect(registerResponseSchema.parse(response)).toMatchObject({
      session: null,
      confirmationRequired: true,
      user: {
        role: 'GUEST',
        profile: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    });
  });

  it('normalizes and validates the forgot-password email', () => {
    expect(
      forgotPasswordBodySchema.parse({ email: 'User@Example.COM' }),
    ).toEqual({ email: 'user@example.com' });

    expect(
      forgotPasswordBodySchema.safeParse({ email: 'not-an-email' }).success,
    ).toBe(false);

    expect(
      forgotPasswordBodySchema.safeParse({
        email: 'user@example.com',
        extra: 'key',
      }).success,
    ).toBe(false);
  });

  it('validates reset-password token and new password', () => {
    expect(
      resetPasswordBodySchema.safeParse({
        tokenHash: 'a'.repeat(16),
        newPassword: 'strong-password',
      }).success,
    ).toBe(true);

    // tokenHash too short
    expect(
      resetPasswordBodySchema.safeParse({
        tokenHash: 'short',
        newPassword: 'strong-password',
      }).success,
    ).toBe(false);

    // rejects unknown keys
    expect(
      resetPasswordBodySchema.safeParse({
        tokenHash: 'a'.repeat(16),
        newPassword: 'strong-password',
        extra: 'key',
      }).success,
    ).toBe(false);
  });

  it('constrains the forgot-password response to literal true', () => {
    expect(
      forgotPasswordResponseSchema.parse({ requested: true }),
    ).toEqual({ requested: true });

    expect(
      forgotPasswordResponseSchema.safeParse({ requested: false }).success,
    ).toBe(false);
  });

  it('validates the reset-password response with activation readiness', () => {
    expect(
      resetPasswordResponseSchema.parse({
        passwordUpdated: true,
        admissionActivationReady: true,
      }),
    ).toEqual({ passwordUpdated: true, admissionActivationReady: true });

    expect(
      resetPasswordResponseSchema.parse({
        passwordUpdated: true,
        admissionActivationReady: false,
      }),
    ).toEqual({ passwordUpdated: true, admissionActivationReady: false });

    expect(
      resetPasswordResponseSchema.safeParse({
        passwordUpdated: true,
      }).success,
    ).toBe(false);
  });
});

