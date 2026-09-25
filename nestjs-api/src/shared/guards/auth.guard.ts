import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  AUTHENTICATED_ENDPOINT,
  REQUIRED_PERMISSIONS,
  REQUIRED_ROLES,
} from '../decorators/auth.decorator.js';
import {
  AUTH_ACCESS_SERVICE,
  type AuthAccessService,
} from '../contracts/auth-access.contract.js';
import { authenticationRequired, forbidden } from '../errors/access.error.js';
import type {
  AuthenticatedRequest,
  PermissionRequirement,
  UserRole,
} from '../models/auth-context.model.js';
import { USER } from '../types/user.role.js';

@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(
    @Inject(AUTH_ACCESS_SERVICE)
    private readonly authAccessService: AuthAccessService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = request.headers.authorization;
    if (!authorization?.startsWith('Bearer ')) throw authenticationRequired();

    const accessToken = authorization.slice('Bearer '.length).trim();
    if (!accessToken) throw authenticationRequired();

    request.auth = {
      accessToken,
      user: await this.authAccessService.authenticate(accessToken),
    };
    return true;
  }
}

@Injectable()
export class AuthorizationGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(AUTH_ACCESS_SERVICE)
    private readonly authAccessService: AuthAccessService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.auth) throw authenticationRequired();

    const roles = this.reflector.getAllAndOverride<readonly UserRole[]>(
      REQUIRED_ROLES,
      [context.getHandler(), context.getClass()],
    );
    const permission = this.reflector.getAllAndOverride<PermissionRequirement>(
      REQUIRED_PERMISSIONS,
      [context.getHandler(), context.getClass()],
    );

    if (!roles?.length && !permission) {
      // Authenticated-only is an explicit, handler-level classification; a
      // handler without any metadata stays denied by default.
      const authenticatedOnly = this.reflector.get<boolean | undefined>(
        AUTHENTICATED_ENDPOINT,
        context.getHandler(),
      );
      if (authenticatedOnly) return true;
      throw forbidden();
    }
    if (permission) {
      // A Guest is a pre-admission identity and never holds an operational
      // permission. Denying here keeps an accidental user_permissions grant
      // from bypassing the role restriction, because permission metadata takes
      // precedence over role metadata below.
      if (request.auth.user.role === USER.GUEST) throw forbidden();
      try {
        if (
          !(await this.authAccessService.hasPermissions(
            request.auth.user,
            permission,
          ))
        ) {
          throw forbidden();
        }
      } catch {
        throw forbidden();
      }
    } else if (roles?.length && !roles.includes(request.auth.user.role)) {
      throw forbidden();
    }

    return true;
  }
}
