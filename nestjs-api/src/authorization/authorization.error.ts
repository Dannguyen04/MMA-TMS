import {
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';

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
 * Context: services resolve permissionId before every insert, so a 23503
 * FK violation at insert time is most likely caused by an invalid userId or
 * grantedBy — not a missing permission code. We map it to a generic
 * permissionGrantFailed rather than leaking constraint names.
 *
 * 23505 (unique violation) should not occur given upsert semantics, but is
 * mapped defensively to permissionGrantFailed.
 */
export function mapAuthorizationPersistenceError(err: unknown): never {
  const code =
    typeof err === 'object' && err !== null && 'code' in err
      ? (err as { code: unknown }).code
      : undefined;

  // Conflict errors that slipped past upsert — treat as internal.
  if (code === '23505') throw permissionGrantFailed();

  // FK violation: user or actor no longer exists.
  if (code === '23503') throw permissionGrantFailed();

  throw permissionGrantFailed();
}
