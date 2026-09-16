import type { Request } from 'express';
import type { UserRole } from '../types/user.role.js';

export { USER, userRoles } from '../types/user.role.js';
export type { UserRole } from '../types/user.role.js';

export interface AuthenticatedUser {
  id: string;
  authSubject: string;
  email: string;
  role: UserRole;
}

export interface PermissionRequirement {
  allOf?: readonly string[];
  anyOf?: readonly string[];
}

export interface AuthenticatedRequest extends Request {
  auth?: {
    accessToken: string;
    user: AuthenticatedUser;
  };
}
