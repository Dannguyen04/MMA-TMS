export const USER = {
  FIGHTER: 'FIGHTER',
  COACH: 'COACH',
  DOCTOR: 'DOCTOR',
  ADMIN: 'ADMIN',
} as const;

export const userRoles = [
  USER.FIGHTER,
  USER.COACH,
  USER.DOCTOR,
  USER.ADMIN,
] as const;

export type UserRole = (typeof userRoles)[number];
