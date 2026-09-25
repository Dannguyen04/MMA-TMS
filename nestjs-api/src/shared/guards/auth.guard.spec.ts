import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthAccessService } from '../contracts/auth-access.contract.js';
import { REQUIRED_PERMISSIONS } from '../decorators/auth.decorator.js';
import { forbidden } from '../errors/access.error.js';
import { AuthorizationGuard } from './auth.guard.js';
import { USER } from '../types/user.role.js';

describe('AuthorizationGuard — GUEST boundary (§2)', () => {
  function createMockContext(userRole: string) {
    const request = {
      auth: {
        accessToken: 'valid-token',
        user: {
          id: 'user-id-1',
          authSubject: 'sub-1',
          email: 'user@example.com',
          role: userRole,
        },
      },
      headers: {},
    };

    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;
  }

  it('rejects GUEST with 403 on permission-protected routes even if user_permissions is granted', async () => {
    const reflector = {
      getAllAndOverride: vi.fn((key: unknown) => {
        if (key === REQUIRED_PERMISSIONS) {
          return { allOf: ['fighter_application:get_all'] };
        }
        return undefined;
      }),
      get: vi.fn(),
    } as unknown as Reflector;

    const authAccessService: AuthAccessService = {
      authenticate: vi.fn(),
      hasPermissions: vi.fn().mockResolvedValue(true), // Accidental permission grant
    };

    const guard = new AuthorizationGuard(reflector, authAccessService);
    const context = createMockContext(USER.GUEST);

    // GUEST must be rejected before checking hasPermissions
    await expect(guard.canActivate(context)).rejects.toThrow(forbidden());
    expect(authAccessService.hasPermissions).not.toHaveBeenCalled();
  });

  it('allows COACH or ADMIN with valid permissions', async () => {
    const reflector = {
      getAllAndOverride: vi.fn((key: unknown) => {
        if (key === REQUIRED_PERMISSIONS) {
          return { allOf: ['fighter_application:get_all'] };
        }
        return undefined;
      }),
      get: vi.fn(),
    } as unknown as Reflector;

    const authAccessService: AuthAccessService = {
      authenticate: vi.fn(),
      hasPermissions: vi.fn().mockResolvedValue(true),
    };

    const guard = new AuthorizationGuard(reflector, authAccessService);
    const context = createMockContext(USER.COACH);

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(authAccessService.hasPermissions).toHaveBeenCalledWith(
      expect.objectContaining({ role: USER.COACH }),
      { allOf: ['fighter_application:get_all'] },
    );
  });
});
