import {
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { userNotFound } from '../users/users.error.js';

/**
 * Re-exported so this module's error contract stays enumerable in one file.
 * The target user of a permission assignment is the same domain entity the
 * Users module exposes, so it must answer with the same stable
 * `USER_NOT_FOUND` payload rather than a second, divergent code.
 */
export { userNotFound };

// ---------------------------------------------------------------------------
// Error factories — stable codes, no DB internals exposed
// ---------------------------------------------------------------------------

/** The supplied permission code does not exist in the catalogue. */
export function permissionNotFound(): NotFoundException {
  return new NotFoundException({
    statusCode: 404,
    error: 'Not Found',
    code: 'PERMISSION_NOT_FOUND',
    message: 'The specified permission code does not exist',
  });
}

/** The permission assignment (user or role row) does not exist. */
export function assignmentNotFound(): NotFoundException {
  return new NotFoundException({
    statusCode: 404,
    error: 'Not Found',
    code: 'ASSIGNMENT_NOT_FOUND',
    message: 'The permission assignment does not exist',
  });
}

/** Generic internal failure — covers system-grant failures and unmapped errors. */
export function permissionGrantFailed(): InternalServerErrorException {
  return new InternalServerErrorException({
    statusCode: 500,
    error: 'Internal Server Error',
    code: 'PERMISSION_GRANT_FAILED',
    message: 'Failed to apply the permission change',
  });
}

/**
 * Maps persistence errors to stable application errors.
 *
 * Context: services resolve permissionId and verify the target user before
 * every insert, so a 23503 FK violation at insert time is a race (the row
 * disappeared between the check and the write) rather than the normal path.
 *
 * `user_permissions` has three foreign keys — `user_id`, `permission_id` and
 * `granted_by` — so the violated constraint decides the mapping. Only a
 * `user_id` violation means the assignment target is gone; that maps to the
 * shared `USER_NOT_FOUND` contract, matching what the pre-flight check would
 * have returned. Every other FK failure (a vanished actor, a permission row
 * removed mid-request, an unrecognised constraint) stays a generic internal
 * error. The constraint name is only read here — it is never returned.
 *
 * 23505 (unique violation) should not occur given upsert semantics, but is
 * mapped defensively to permissionGrantFailed.
 */
export function mapAuthorizationPersistenceError(err: unknown): never {
  const details =
    typeof err === 'object' && err !== null
      ? (err as { code?: unknown; constraint?: unknown })
      : {};

  // Conflict errors that slipped past upsert — treat as internal.
  if (details.code === '23505') throw permissionGrantFailed();

  // FK violation: only a user_id violation identifies a missing target user.
  if (details.code === '23503') {
    if (details.constraint === 'user_permissions_user_id_fkey') {
      throw userNotFound();
    }
    throw permissionGrantFailed();
  }

  throw permissionGrantFailed();
}
