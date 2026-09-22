import {
  createUserBodySchema,
  currentUserSchema,
  fighterProfileSchema,
  inviteUserBodySchema,
  listUsersQuerySchema,
  publicUserSchema,
  updateUserBodySchema,
  updateUserStatusBodySchema,
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

  it('requires backend-derived capabilities and assignment scope for the current user', () => {
    const currentUser = {
      id: '59d6ba46-32f2-4e67-b486-e966b2064328',
      email: 'fighter@example.com',
      role: 'FIGHTER',
      isActive: true,
      status: 'ACTIVE',
      displayName: 'An Nguyen',
      phone: null,
      title: 'Fighter',
      lastActiveAt: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      deletedAt: null,
      profile: {
        id: 'b13d7792-fbf9-4421-a4a4-e2ed8466b4a7',
        ...fighterProfile,
      },
      effectiveCapabilities: ['training:read', 'videos:upload'],
      assignmentScope: {
        fighterIds: ['b13d7792-fbf9-4421-a4a4-e2ed8466b4a7'],
      },
    };

    expect(currentUserSchema.safeParse(currentUser).success).toBe(true);
    expect(
      currentUserSchema.safeParse({
        ...currentUser,
        effectiveCapabilities: ['unknown:permission'],
      }).success,
    ).toBe(false);
    expect(
      currentUserSchema.safeParse({
        ...currentUser,
        assignmentScope: undefined,
      }).success,
    ).toBe(false);
  });

  it('requires account fields consumed by the administration UI', () => {
    const account = {
      id: '59d6ba46-32f2-4e67-b486-e966b2064328',
      email: 'fighter@example.com',
      role: 'FIGHTER',
      isActive: true,
      status: 'SUSPENDED',
      displayName: 'An Nguyen',
      phone: null,
      title: 'Professional Fighter',
      lastActiveAt: '2026-09-21T01:02:03.000Z',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      deletedAt: null,
      profile: {
        id: 'b13d7792-fbf9-4421-a4a4-e2ed8466b4a7',
        ...fighterProfile,
      },
    };

    expect(publicUserSchema.safeParse(account).success).toBe(true);
    expect(
      publicUserSchema.safeParse({ ...account, status: undefined }).success,
    ).toBe(false);
    expect(
      publicUserSchema.safeParse({ ...account, title: undefined }).success,
    ).toBe(false);
    expect(
      publicUserSchema.safeParse({ ...account, lastActiveAt: undefined })
        .success,
    ).toBe(false);
  });

  it('validates bounded user-directory filters and account status updates', () => {
    expect(
      listUsersQuerySchema.parse({
        search: '  coach  ',
        role: 'COACH',
        status: 'SUSPENDED',
        limit: '25',
      }),
    ).toEqual({
      search: 'coach',
      role: 'COACH',
      status: 'SUSPENDED',
      limit: 25,
    });
    expect(listUsersQuerySchema.safeParse({ limit: 101 }).success).toBe(false);
    expect(
      updateUserStatusBodySchema.safeParse({ status: 'INVITED' }).success,
    ).toBe(true);
    expect(
      updateUserStatusBodySchema.safeParse({ status: 'DELETED' }).success,
    ).toBe(false);
  });

  it('validates the invitation fields supplied by the administration UI', () => {
    expect(
      inviteUserBodySchema.parse({
        name: '  Linh Nguyen  ',
        email: 'LINH@EXAMPLE.COM',
        role: 'DOCTOR',
        title: '  Team Doctor  ',
      }),
    ).toEqual({
      name: 'Linh Nguyen',
      email: 'linh@example.com',
      role: 'DOCTOR',
      title: 'Team Doctor',
    });
    expect(
      inviteUserBodySchema.safeParse({
        name: '',
        email: 'not-an-email',
        role: 'OWNER',
        title: '',
      }).success,
    ).toBe(false);
  });
});
