export const USER = {
  FIGHTER: 'FIGHTER',
  COACH: 'COACH',
  DOCTOR: 'DOCTOR',
  ADMIN: 'ADMIN',
  GUEST: 'GUEST',
} as const;

export const userRoles = [
  USER.FIGHTER,
  USER.COACH,
  USER.DOCTOR,
  USER.ADMIN,
  USER.GUEST,
] as const;

export type UserRole = (typeof userRoles)[number];
