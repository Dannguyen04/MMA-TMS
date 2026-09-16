import { HttpException, HttpStatus } from '@nestjs/common';
import {
  mapUserPersistenceError,
  userCreationFailed,
  userNotFound,
  userRoleMismatch,
} from './users.error.js';

function responseOf(exception: HttpException): Record<string, unknown> {
  return exception.getResponse() as Record<string, unknown>;
}

describe('users errors', () => {
  it.each([
    [userNotFound, HttpStatus.NOT_FOUND, 'USER_NOT_FOUND'],
    [userCreationFailed, HttpStatus.CONFLICT, 'USER_CREATION_FAILED'],
    [userRoleMismatch, HttpStatus.BAD_REQUEST, 'USER_ROLE_MISMATCH'],
  ] as const)(
    'creates a stable HTTP error payload',
    (factory, status, code) => {
      const exception = factory();

      expect(exception).toBeInstanceOf(HttpException);
      expect(exception.getStatus()).toBe(status);
      expect(Object.keys(responseOf(exception)).sort()).toEqual(
        ['statusCode', 'error', 'code', 'message'].sort(),
      );
      expect(responseOf(exception)).toMatchObject({ statusCode: status, code });
    },
  );

  it.each([
    [{ code: '23505' }, HttpStatus.CONFLICT, 'USER_ALREADY_EXISTS'],
    [{ code: '23503' }, HttpStatus.CONFLICT, 'AUTH_IDENTITY_NOT_FOUND'],
    [{ code: '23514' }, HttpStatus.BAD_REQUEST, 'INVALID_USER_DATA'],
    [{ code: '22P02' }, HttpStatus.BAD_REQUEST, 'INVALID_USER_DATA'],
  ] as const)(
    'maps PostgreSQL failures to stable application errors',
    (databaseError, status, code) => {
      const exception = mapUserPersistenceError(databaseError);

      expect(exception.getStatus()).toBe(status);
      expect(responseOf(exception)).toMatchObject({ statusCode: status, code });
    },
  );

  it('falls back to a stable internal error for unknown failures', () => {
    const exception = mapUserPersistenceError(new Error('connection lost'));

    expect(exception.getStatus()).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(responseOf(exception)).toMatchObject({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'USER_OPERATION_FAILED',
      message: 'Unable to complete the user operation',
    });
  });
});
