import type { UserRole } from '../shared/models/auth-context.model.js';
import { USER } from '../shared/types/user.role.js';

/**
 * Roles that intentionally have no role-profile row. ADMIN never had one; GUEST
 * only gains a fighters row when an approved admission is activated.
 */
export const PROFILE_LESS_ROLES: readonly UserRole[] = [
  USER.ADMIN,
  USER.GUEST,
];

export const USER_PAGE_SIZE_DEFAULT = 20;
export const USER_PAGE_SIZE_MAX = 100;
