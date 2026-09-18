import {
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  Put,
  Body,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  ApiForbiddenEnvelope,
  ApiNotFoundEnvelope,
  ApiSuccessEnvelope,
  ApiUnauthorizedEnvelope,
  ApiValidationErrorEnvelope,
} from '../shared/decorators/api-envelope.decorator.js';
import {
  CurrentUser,
  RequireRoles,
} from '../shared/decorators/auth.decorator.js';
import { ResponseMessage } from '../shared/decorators/response-message.decorator.js';
import { authenticationRequired } from '../shared/errors/access.error.js';
import {
  AccessTokenGuard,
  AuthorizationGuard,
} from '../shared/guards/auth.guard.js';
import type { AuthenticatedUser } from '../shared/models/auth-context.model.js';
import { appZodValidationPipe } from '../shared/pipes/zod-validation.pipe.js';
import { USER } from '../shared/types/user.role.js';
import {
  RolePermissionParamsDto,
  RolePermissionResponseDto,
  SetUserPermissionOverrideBodyDto,
  UserPermissionParamsDto,
  UserPermissionResponseDto,
} from './authorization.dto.js';
import { AuthorizationService } from './authorization.service.js';

/**
 * AuthorizationController — admin-only permission assignment management.
 *
 * Exposes CRUD for role/user permission assignments (role_permissions,
 * user_permissions). Does NOT expose permission catalogue operations
 * (public.permissions) — those are managed exclusively via SQL migrations.
 *
 * All routes require ADMIN role via @RequireRoles. @RequirePermissions is
 * intentionally absent: the Authorization Guard gives permission metadata
 * precedence over role metadata, which would allow any user who has been
 * individually granted an authorization permission to bypass the ADMIN-only
 * restriction (see auth.guard.ts).
 *
 * Later scope (not in this phase):
 *   - Explicit deny: PATCH /users/:userId/permissions/:permissionCode { isGranted: boolean }
 *   - List endpoints with pagination
 */
@ApiTags('Authorization')
@ApiBearerAuth()
@Controller('authorization')
@UseGuards(AccessTokenGuard, AuthorizationGuard)
@RequireRoles(USER.ADMIN)
@UsePipes(appZodValidationPipe)
export class AuthorizationController {
  constructor(private readonly authorizationService: AuthorizationService) {}

  // -------------------------------------------------------------------------
  // User permission assignment
  // -------------------------------------------------------------------------

  /**
   * PUT /authorization/users/:userId/permissions/:permissionCode
   *
   * Sets a per-user permission override.
   * - isGranted = true explicitly grants the permission (overrides role).
   * - isGranted = false explicitly denies the permission (overrides role).
   * Idempotent — calling this on an already-matching state returns 200.
   */
  @Put('users/:userId/permissions/:permissionCode')
  @RequireRoles(USER.ADMIN)
  @ResponseMessage('User permission override saved successfully')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Set user permission override',
    description:
      'Sets a per-user permission override. `isGranted: true` explicitly ' +
      'grants the permission, bypassing role limits. `isGranted: false` ' +
      'explicitly denies it, overriding role baseline grants. Idempotent. ' +
      'Requires ADMIN role.',
  })
  @ApiBody({ type: SetUserPermissionOverrideBodyDto, required: true })
  @ApiSuccessEnvelope({
    status: HttpStatus.OK,
    message: 'User permission override saved successfully',
    model: UserPermissionResponseDto,
  })
  @ApiUnauthorizedEnvelope()
  @ApiForbiddenEnvelope('Requires ADMIN role')
  @ApiValidationErrorEnvelope('Invalid payload or parameters')
  @ApiNotFoundEnvelope(
    'PERMISSION_NOT_FOUND',
    'The specified permission code does not exist',
  )
  async setUserPermissionOverride(
    @Param() params: UserPermissionParamsDto,
    @Body() body: SetUserPermissionOverrideBodyDto,
    @CurrentUser() actor: AuthenticatedUser | undefined,
  ) {
    return this.authorizationService.setUserPermissionOverride(
      params,
      body,
      this.requireActor(actor),
      randomUUID(),
    );
  }

  /**
   * DELETE /authorization/users/:userId/permissions/:permissionCode
   *
   * Removes a user permission override, reverting the user to role-based
   * permission inheritance. Returns 404 if no override exists.
   *
   * Note: this deletes the user_permissions row entirely.
   * It does NOT create an explicit deny (is_granted = false).
   * Explicit deny support will be added in a later phase.
   */
  @Delete('users/:userId/permissions/:permissionCode')
  @RequireRoles(USER.ADMIN)
  @ResponseMessage('User permission override removed successfully')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Remove user permission override',
    description:
      'Deletes the user permission override, reverting the user to ' +
      'role-based permission inheritance. Returns 404 if no override exists. ' +
      'Requires ADMIN role.',
  })
  @ApiSuccessEnvelope({
    status: HttpStatus.OK,
    message: 'User permission override removed successfully',
  })
  @ApiUnauthorizedEnvelope()
  @ApiForbiddenEnvelope('Requires ADMIN role')
  @ApiValidationErrorEnvelope('Invalid user ID or permission code')
  @ApiNotFoundEnvelope(
    'ASSIGNMENT_NOT_FOUND',
    'No permission override exists for this user',
    'The permission code or user permission assignment does not exist',
  )
  async removeUserPermissionOverride(
    @Param() params: UserPermissionParamsDto,
    @CurrentUser() actor: AuthenticatedUser | undefined,
  ) {
    await this.authorizationService.removeUserPermissionOverride(
      params,
      this.requireActor(actor),
      randomUUID(),
    );
  }

  // -------------------------------------------------------------------------
  // Role permission assignment
  // -------------------------------------------------------------------------

  /**
   * PUT /authorization/roles/:role/permissions/:permissionCode
   *
   * Grants a permission to a role baseline. Idempotent.
   */
  @Put('roles/:role/permissions/:permissionCode')
  @RequireRoles(USER.ADMIN)
  @ResponseMessage('Permission granted to role successfully')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Grant permission to role',
    description:
      'Grants a concrete permission to a role baseline. Idempotent — ' +
      're-granting an existing role permission returns the current state. ' +
      'Requires ADMIN role.',
  })
  @ApiSuccessEnvelope({
    status: HttpStatus.OK,
    message: 'Permission granted to role successfully',
    model: RolePermissionResponseDto,
  })
  @ApiUnauthorizedEnvelope()
  @ApiForbiddenEnvelope('Requires ADMIN role')
  @ApiValidationErrorEnvelope('Invalid role or permission code')
  @ApiNotFoundEnvelope(
    'PERMISSION_NOT_FOUND',
    'The specified permission code does not exist',
  )
  async grantRolePermission(
    @Param() params: RolePermissionParamsDto,
    @CurrentUser() actor: AuthenticatedUser | undefined,
  ) {
    return this.authorizationService.grantRolePermission(
      params,
      this.requireActor(actor),
      randomUUID(),
    );
  }

  /**
   * DELETE /authorization/roles/:role/permissions/:permissionCode
   *
   * Revokes a permission from a role baseline. Returns 404 if no assignment
   * exists for this role/permission pair.
   */
  @Delete('roles/:role/permissions/:permissionCode')
  @RequireRoles(USER.ADMIN)
  @ResponseMessage('Role permission revoked successfully')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Revoke permission from role',
    description:
      'Removes a permission from a role baseline. Returns 404 if the ' +
      'role permission assignment does not exist. Requires ADMIN role.',
  })
  @ApiSuccessEnvelope({
    status: HttpStatus.OK,
    message: 'Role permission revoked successfully',
  })
  @ApiUnauthorizedEnvelope()
  @ApiForbiddenEnvelope('Requires ADMIN role')
  @ApiValidationErrorEnvelope('Invalid role or permission code')
  @ApiNotFoundEnvelope(
    'ASSIGNMENT_NOT_FOUND',
    'No permission assignment exists for this role',
    'The permission code or role permission assignment does not exist',
  )
  async revokeRolePermission(
    @Param() params: RolePermissionParamsDto,
    @CurrentUser() actor: AuthenticatedUser | undefined,
  ) {
    await this.authorizationService.revokeRolePermission(
      params,
      this.requireActor(actor),
      randomUUID(),
    );
  }

  // -------------------------------------------------------------------------
  // Private helper
  // -------------------------------------------------------------------------

  private requireActor(
    actor: AuthenticatedUser | undefined,
  ): AuthenticatedUser {
    if (!actor) throw authenticationRequired();
    return actor;
  }
}
