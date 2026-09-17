import { HttpException, Injectable } from '@nestjs/common';
import type { DatabaseExecutor } from '../shared/utils/audit-context.util.js';
import type { AuthenticatedUser } from '../shared/models/auth-context.model.js';
import type { UserRole } from '../shared/types/user.role.js';
import { AuthorizationRepository } from './authorization.repo.js';
import type {
  RolePermissionParams,
  RolePermissionResponse,
  UserPermissionParams,
  UserPermissionResponse,
} from './authorization.model.js';
import {
  assignmentNotFound,
  mapAuthorizationPersistenceError,
  permissionNotFound,
} from './authorization.error.js';

@Injectable()
export class AuthorizationService {
  constructor(
    private readonly authorizationRepository: AuthorizationRepository,
  ) {}

  // =========================================================================
  // Admin operations — HTTP-triggered, each owns its own transaction
  // =========================================================================

  /**
   * Grants a permission to a user (is_granted = true). Idempotent — PUT
   * semantics: re-granting an existing permission returns 200 with current row.
   *
   * Transaction: setAudit → resolvePermission → upsert → commit.
   * grantedBy = actor.id (not from request body).
   */
  async grantUserPermission(
    params: UserPermissionParams,
    actor: AuthenticatedUser,
    requestId: string,
  ): Promise<UserPermissionResponse> {
    return this.mapPersistenceErrors(() =>
      this.authorizationRepository.transaction(async (tx) => {
        await this.authorizationRepository.setAudit(
          actor.authSubject,
          requestId,
          tx,
        );
        const permissionId = await this.resolvePermissionId(
          params.permissionCode,
          tx,
        );
        const row = await this.authorizationRepository.upsertUserPermission(
          {
            userId: params.userId,
            permissionId,
            isGranted: true,
            grantedBy: actor.id,
          },
          tx,
        );
        return this.toUserPermissionResponse(row, params.permissionCode);
      }),
    );
  }

  /**
   * Removes a user permission override, reverting the user to role-based
   * inheritance. Throws assignmentNotFound() if no override exists.
   *
   * Transaction: setAudit → resolvePermission → delete → commit.
   */
  async removeUserPermissionOverride(
    params: UserPermissionParams,
    actor: AuthenticatedUser,
    requestId: string,
  ): Promise<void> {
    await this.mapPersistenceErrors(() =>
      this.authorizationRepository.transaction(async (tx) => {
        await this.authorizationRepository.setAudit(
          actor.authSubject,
          requestId,
          tx,
        );
        const permissionId = await this.resolvePermissionId(
          params.permissionCode,
          tx,
        );
        const deleted =
          await this.authorizationRepository.deleteUserPermissionOverride(
            { userId: params.userId, permissionId },
            tx,
          );
        if (!deleted) throw assignmentNotFound();
      }),
    );
  }

  /**
   * Grants a permission to a role. Idempotent — re-granting returns 200.
   *
   * Transaction: setAudit → resolvePermission → upsert → commit.
   */
  async grantRolePermission(
    params: RolePermissionParams,
    actor: AuthenticatedUser,
    requestId: string,
  ): Promise<RolePermissionResponse> {
    return this.mapPersistenceErrors(() =>
      this.authorizationRepository.transaction(async (tx) => {
        await this.authorizationRepository.setAudit(
          actor.authSubject,
          requestId,
          tx,
        );
        const permissionId = await this.resolvePermissionId(
          params.permissionCode,
          tx,
        );
        const row = await this.authorizationRepository.upsertRolePermission(
          { role: params.role as UserRole, permissionId },
          tx,
        );
        return this.toRolePermissionResponse(row, params.permissionCode);
      }),
    );
  }

  /**
   * Revokes a permission from a role. Throws assignmentNotFound() if the
   * role permission row does not exist.
   *
   * Transaction: setAudit → resolvePermission → delete → commit.
   */
  async revokeRolePermission(
    params: RolePermissionParams,
    actor: AuthenticatedUser,
    requestId: string,
  ): Promise<void> {
    await this.mapPersistenceErrors(() =>
      this.authorizationRepository.transaction(async (tx) => {
        await this.authorizationRepository.setAudit(
          actor.authSubject,
          requestId,
          tx,
        );
        const permissionId = await this.resolvePermissionId(
          params.permissionCode,
          tx,
        );
        const deleted = await this.authorizationRepository.deleteRolePermission(
          { role: params.role as UserRole, permissionId },
          tx,
        );
        if (!deleted) throw assignmentNotFound();
      }),
    );
  }

  // =========================================================================
  // Private helpers
  // =========================================================================

  private async mapPersistenceErrors<T>(work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } catch (error) {
      if (error instanceof HttpException) throw error;
      mapAuthorizationPersistenceError(error);
    }
  }

  /** Resolves a single permission code to its database UUID. */
  private async resolvePermissionId(
    code: string,
    db: DatabaseExecutor,
  ): Promise<string> {
    const idMap = await this.authorizationRepository.findPermissionIdsByCodes(
      [code],
      db,
    );
    const permissionId = idMap.get(code);
    if (!permissionId) throw permissionNotFound();
    return permissionId;
  }

  private toUserPermissionResponse(
    row: Awaited<ReturnType<AuthorizationRepository['upsertUserPermission']>>,
    permissionCode: string,
  ): UserPermissionResponse {
    return {
      id: row.id,
      userId: row.userId,
      permissionCode,
      isGranted: row.isGranted,
      grantedBy: row.grantedBy ?? null,
      createdAt: row.createdAt.toISOString(),
    };
  }

  private toRolePermissionResponse(
    row: Awaited<ReturnType<AuthorizationRepository['upsertRolePermission']>>,
    permissionCode: string,
  ): RolePermissionResponse {
    return {
      id: row.id,
      role: row.role,
      permissionCode,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
