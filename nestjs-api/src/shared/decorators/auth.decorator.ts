import {
  createParamDecorator,
  ExecutionContext,
  SetMetadata,
} from '@nestjs/common';
import type {
  AuthenticatedRequest,
  AuthenticatedUser,
  PermissionRequirement,
  UserRole,
} from '../models/auth-context.model.js';

export const PUBLIC_ENDPOINT = Symbol('PUBLIC_ENDPOINT');
export const AUTHENTICATED_ENDPOINT = Symbol('AUTHENTICATED_ENDPOINT');
export const REQUIRED_PERMISSIONS = Symbol('REQUIRED_PERMISSIONS');
export const REQUIRED_ROLES = Symbol('REQUIRED_ROLES');

export const PublicEndpoint = () => SetMetadata(PUBLIC_ENDPOINT, true);
export const AuthenticatedEndpoint = () =>
  SetMetadata(AUTHENTICATED_ENDPOINT, true);
export const RequirePermissions = (requirement: PermissionRequirement) =>
  SetMetadata(REQUIRED_PERMISSIONS, requirement);
export const RequireRoles = (...roles: UserRole[]) =>
  SetMetadata(REQUIRED_ROLES, roles);

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser | undefined =>
    context.switchToHttp().getRequest<AuthenticatedRequest>().auth?.user,
);
