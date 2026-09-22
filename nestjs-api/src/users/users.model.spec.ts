import {
  createUserBodySchema,
  fighterProfileSchema,
  updateUserBodySchema,
} from './users.model.js';

const fighterProfile = {
  firstName: 'An',
  lastName: 'Nguyen',
  dateOfBirth: '2000-02-29',
  weightClass: 'LIGHTWEIGHT' as const,
};

describe('users Zod contracts', () => {
  it('parses a valid fighter profile without coercion', () => {
    expect(fighterProfileSchema.parse(fighterProfile)).toEqual(fighterProfile);
  });

  it.each([
    ['FIGHTER', fighterProfile],
    ['COACH', { firstName: 'Bao', lastName: 'Tran', isHeadCoach: true }],
    ['DOCTOR', { firstName: 'Chi', lastName: 'Le', licenseNumber: 'MED-123' }],
  ] as const)('accepts an admin-created %s profile', (role, profile) => {
    expect(
      createUserBodySchema.safeParse({
        user: {
          email: `${role.toLowerCase()}@example.com`,
          password: 'strong-password',
          role,
          profile,
        },
      }).success,
    ).toBe(true);
  });

  it('accepts an ADMIN without a domain profile', () => {
    expect(
      createUserBodySchema.safeParse({
        user: {
          email: 'admin@example.com',
          password: 'strong-password',
          role: 'ADMIN',
        },
      }).success,
    ).toBe(true);
  });

  it('rejects a role/profile mismatch and unknown identity fields', () => {
    expect(
      createUserBodySchema.safeParse({
        user: {
          email: 'doctor@example.com',
          password: 'strong-password',
          role: 'DOCTOR',
          profile: fighterProfile,
          authUserId: '63dd2ce8-42ee-4425-8bf1-d756bd12c2b9',
        },
      }).success,
    ).toBe(false);
  });

  it('rejects malformed dates, enums, and non-finite measurements', () => {
    expect(
      fighterProfileSchema.safeParse({
        ...fighterProfile,
        dateOfBirth: '2001-02-29',
        weightClass: 'SUPER_HEAVYWEIGHT',
        reachCm: Number.NaN,
      }).success,
    ).toBe(false);
  });

  it('requires a non-empty, role-specific update', () => {
    expect(
      updateUserBodySchema.safeParse({
        user: { role: 'COACH', profile: {} },
      }).success,
    ).toBe(false);
  });
});
