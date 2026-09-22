import {
  permissionNotFound,
  assignmentNotFound,
  permissionGrantFailed,
  mapAuthorizationPersistenceError,
  userNotFound,
} from './authorization.error.js';
import { HttpException } from '@nestjs/common';

describe('authorization.error', () => {
  it('creates stable permissionNotFound error', () => {
    const err = permissionNotFound();
    expect(err).toBeInstanceOf(HttpException);
    expect(err.getStatus()).toBe(404);
    expect(err.getResponse()).toEqual({
      statusCode: 404,
      error: 'Not Found',
      code: 'PERMISSION_NOT_FOUND',
      message: 'The specified permission code does not exist',
    });
  });

  it('creates stable assignmentNotFound error', () => {
    const err = assignmentNotFound();
    expect(err).toBeInstanceOf(HttpException);
    expect(err.getStatus()).toBe(404);
    expect(err.getResponse()).toEqual({
      statusCode: 404,
      error: 'Not Found',
      code: 'ASSIGNMENT_NOT_FOUND',
      message: 'The permission assignment does not exist',
    });
  });

  it('creates stable permissionGrantFailed error', () => {
    const err = permissionGrantFailed();
    expect(err).toBeInstanceOf(HttpException);
    expect(err.getStatus()).toBe(500);
    expect(err.getResponse()).toEqual({
      statusCode: 500,
      error: 'Internal Server Error',
      code: 'PERMISSION_GRANT_FAILED',
      message: 'Failed to apply the permission change',
    });
  });

  it('re-exports userNotFound with matching 404 USER_NOT_FOUND contract', () => {
    const err = userNotFound();
    expect(err).toBeInstanceOf(HttpException);
    expect(err.getStatus()).toBe(404);
    expect(err.getResponse()).toEqual({
      statusCode: 404,
      error: 'Not Found',
      code: 'USER_NOT_FOUND',
      message: 'User not found',
    });
  });

  describe('mapAuthorizationPersistenceError', () => {
    it('maps 23503 on user_permissions_user_id_fkey to 404 USER_NOT_FOUND without leaking DB details', () => {
      const dbError = {
        code: '23503',
        constraint: 'user_permissions_user_id_fkey',
        table: 'user_permissions',
        detail: 'Key (user_id)=(missing-id) is not present in table "users".',
      };

      try {
        mapAuthorizationPersistenceError(dbError);
        expect.unreachable('Should have thrown');
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(HttpException);
        const httpErr = err as HttpException;
        expect(httpErr.getStatus()).toBe(404);
        expect(httpErr.getResponse()).toEqual({
          statusCode: 404,
          error: 'Not Found',
          code: 'USER_NOT_FOUND',
          message: 'User not found',
        });
        const serialized = JSON.stringify(httpErr.getResponse());
        expect(serialized).not.toContain('user_permissions_user_id_fkey');
        expect(serialized).not.toContain('missing-id');
        expect(serialized).not.toContain('table');
        expect(serialized).not.toContain('detail');
      }
    });

    it.each([
      'user_permissions_granted_by_fkey',
      'user_permissions_permission_id_fkey',
      'other_foreign_key_fkey',
      undefined,
    ])('maps 23503 on constraint %s to 500 PERMISSION_GRANT_FAILED (never 404)', (constraint) => {
      const dbError = {
        code: '23503',
        constraint,
      };

      expect(() => mapAuthorizationPersistenceError(dbError)).toThrowError(
        expect.objectContaining({
          status: 500,
          response: expect.objectContaining({
            code: 'PERMISSION_GRANT_FAILED',
          }),
        }),
      );
    });

    it('maps 23505 unique violation to 500 PERMISSION_GRANT_FAILED', () => {
      expect(() => mapAuthorizationPersistenceError({ code: '23505' })).toThrowError(
        expect.objectContaining({
          status: 500,
          response: expect.objectContaining({
            code: 'PERMISSION_GRANT_FAILED',
          }),
        }),
      );
    });

    it('maps non-object or unmapped errors to 500 PERMISSION_GRANT_FAILED', () => {
      expect(() => mapAuthorizationPersistenceError('some-string-error')).toThrowError(
        expect.objectContaining({
          status: 500,
          response: expect.objectContaining({
            code: 'PERMISSION_GRANT_FAILED',
          }),
        }),
      );
      expect(() => mapAuthorizationPersistenceError(null)).toThrowError(
        expect.objectContaining({ status: 500 }),
      );
      expect(() => mapAuthorizationPersistenceError(new Error('crash'))).toThrowError(
        expect.objectContaining({ status: 500 }),
      );
    });
  });
});

