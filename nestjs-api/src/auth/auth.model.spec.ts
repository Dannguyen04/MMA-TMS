import {
  loginBodySchema,
  refreshBodySchema,
  registerBodySchema,
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

  it('requires a complete fighter profile during registration', () => {
    expect(
      registerBodySchema.safeParse({
        email: 'fighter@example.com',
        password: 'strong-password',
        profile: {
          firstName: 'An',
          lastName: 'Nguyen',
          dateOfBirth: '2000-01-01',
          weightClass: 'LIGHTWEIGHT',
        },
      }).success,
    ).toBe(true);
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
});
