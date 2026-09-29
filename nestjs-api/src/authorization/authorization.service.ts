import { HttpException, Injectable } from '@nestjs/common';
import {
  type DatabaseExecutor,
  setAuditContext,
} from '../shared/utils/audit-context.util.js';
import type { AuthenticatedUser } from '../shared/models/auth-context.model.js';
import { USER, type UserRole } from '../shared/types/user.role.js';
import { forbidden } from '../shared/errors/access.error.js';
import { AuthorizationRepository } from './authorization.repo.js';
import type {
  RolePermissionParams,
  RolePermissionResponse,
  SetUserPermissionOverrideBody,
  UserPermissionParams,
  UserPermissionResponse,
} from './authorization.model.js';
import {
  assignmentNotFound,
  mapAuthorizationPersistenceError,
  permissionNotFound,
  userNotFound,
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
   * Sets a per-user permission override. Idempotent — PUT semantics:
   * updates the override state and returns 200 with the current row.
   *
   * Transaction: setAuditContext → resolvePermission → assertAssignableUser
   *              → upsert → commit.
   * grantedBy = actor.id (not from request body).
   *
   * Lookup order is fixed: the permission code is resolved before the target
   * user, so an unknown code answers PERMISSION_NOT_FOUND even when the user
   * is also missing. Both checks run on the transaction handle, so they see
   * the same snapshot as the write that follows.
   */
  async setUserPermissionOverride(
    params: UserPermissionParams,
    body: SetUserPermissionOverrideBody,
    actor: AuthenticatedUser,
    requestId: string,
  ): Promise<UserPermissionResponse> {
    return this.mapPersistenceErrors(() =>
      this.authorizationRepository.transaction(async (tx) => {
        await setAuditContext(actor.authSubject, requestId, tx);
        const permissionId = await this.resolvePermissionId(
          params.permissionCode,
          tx,
        );
        await this.assertAssignableUser(params.userId, tx);
        const row = await this.authorizationRepository.upsertUserPermission(
          {
            userId: params.userId,
            permissionId,
            isGranted: body.isGranted,
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
   * Transaction: setAuditContext → resolvePermission → delete → commit.
   *
   * Deliberately does not assert target-user eligibility: an existing
   * override row already proves the foreign key is satisfied, and an operator
   * must stay able to clear a stale override left on a deactivated or
   * soft-deleted account. A missing user therefore yields
   * ASSIGNMENT_NOT_FOUND (also 404), never a false success.
   */
  async removeUserPermissionOverride(
    params: UserPermissionParams,
    actor: AuthenticatedUser,
    requestId: string,
  ): Promise<void> {
    await this.mapPersistenceErrors(() =>
      this.authorizationRepository.transaction(async (tx) => {
        await setAuditContext(actor.authSubject, requestId, tx);
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
   * Rejects the ADMIN role before opening a transaction.
   *
   * Transaction: setAuditContext → resolvePermission → upsert → commit.
   */
  async grantRolePermission(
    params: RolePermissionParams,
    actor: AuthenticatedUser,
    requestId: string,
  ): Promise<RolePermissionResponse> {
    this.assertRoleGrantsMutable(params.role);
    return this.mapPersistenceErrors(() =>
      this.authorizationRepository.transaction(async (tx) => {
        await setAuditContext(actor.authSubject, requestId, tx);
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
   * Rejects the ADMIN role before opening a transaction.
   *
   * Transaction: setAuditContext → resolvePermission → delete → commit.
   */
  async revokeRolePermission(
    params: RolePermissionParams,
    actor: AuthenticatedUser,
    requestId: string,
  ): Promise<void> {
    this.assertRoleGrantsMutable(params.role);
    await this.mapPersistenceErrors(() =>
      this.authorizationRepository.transaction(async (tx) => {
        await setAuditContext(actor.authSubject, requestId, tx);
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

  /**
   * ADMIN baseline grants are migration-owned: every migration that
   * introduces a concrete permission inserts the matching ADMIN
   * `role_permissions` row in the same transaction. The assignment API must
   * not add to or remove from that baseline, so ADMIN is rejected before any
   * transaction is opened — including an idempotent PUT for a grant that
   * already exists and a DELETE for an assignment that does not. Nothing is
   * written and no audit context is set for a rejected request.
   *
   * This restricts ADMIN *role* grants only. Per-user overrides for an
   * individual ADMIN — including an explicit deny — stay fully supported
   * through the user assignment routes.
   */
  private assertRoleGrantsMutable(role: UserRole): void {
    if (role === USER.ADMIN) throw forbidden();
  }

  /**
   * Fails with the shared USER_NOT_FOUND contract when the assignment target
   * is not an eligible user. Runs on the caller's transaction handle so the
   * check and the mutation observe one snapshot.
   */
  private async assertAssignableUser(
    userId: string,
    db: DatabaseExecutor,
  ): Promise<void> {
    const assignable = await this.authorizationRepository.isAssignableUser(
      userId,
      db,
    );
    if (!assignable) throw userNotFound();
  }

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
