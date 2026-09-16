import type {
  AuthenticatedUser,
  PermissionRequirement,
} from '../models/auth-context.model.js';

export const AUTH_ACCESS_SERVICE = Symbol('AUTH_ACCESS_SERVICE');

export interface AuthAccessService {
  authenticate(accessToken: string): Promise<AuthenticatedUser>;
  hasPermissions(
    user: AuthenticatedUser,
    requirement: PermissionRequirement,
  ): Promise<boolean>;
}
