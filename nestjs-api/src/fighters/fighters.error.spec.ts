import { HttpException, HttpStatus } from '@nestjs/common';
import {
  fighterNotFound,
  mapFighterPersistenceError,
  measurementAlreadySuperseded,
} from './fighters.error.js';

function responseOf(exception: HttpException): Record<string, unknown> {
  return exception.getResponse() as Record<string, unknown>;
}

describe('fighters errors', () => {
  it.each([
    [fighterNotFound, HttpStatus.NOT_FOUND, 'FIGHTER_NOT_FOUND'],
    [
      measurementAlreadySuperseded,
      HttpStatus.CONFLICT,
      'MEASUREMENT_ALREADY_SUPERSEDED',
    ],
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
    [
      { code: '23505', constraint: 'uq_coach_fighter_open' },
      HttpStatus.CONFLICT,
      'COACH_ASSIGNMENT_ALREADY_ACTIVE',
    ],
    [
      { code: '23505', constraint: 'uq_measurement_successor' },
      HttpStatus.CONFLICT,
      'MEASUREMENT_ALREADY_SUPERSEDED',
    ],
    [
      { code: '23514', constraint: 'ck_coach_fighters_period' },
      HttpStatus.BAD_REQUEST,
      'INVALID_ASSIGNMENT_PERIOD',
    ],
    [
      { code: '23503', constraint: 'coach_fighters_coach_id_fkey' },
      HttpStatus.NOT_FOUND,
      'COACH_NOT_FOUND',
    ],
    [
      { code: 'P0001', message: 'append-only trigger rejected the write' },
      HttpStatus.CONFLICT,
      'OPERATION_REJECTED_BY_TRIGGER',
    ],
  ] as const)(
    'maps PostgreSQL failures to stable application errors',
    (databaseError, status, code) => {
      const exception = mapFighterPersistenceError(databaseError);

      expect(exception.getStatus()).toBe(status);
      expect(responseOf(exception)).toMatchObject({ statusCode: status, code });
    },
  );

  it('falls back to a stable internal error for unknown failures', () => {
    const exception = mapFighterPersistenceError(new Error('connection lost'));

    expect(exception.getStatus()).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(responseOf(exception)).toMatchObject({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'FIGHTER_OPERATION_FAILED',
      message: 'Unable to complete the fighter operation',
    });
  });

  it('does not expose a trigger-raised PostgreSQL message', () => {
    const exception = mapFighterPersistenceError({
      code: 'P0001',
      message: 'sensitive trigger and schema details',
    });

    expect(responseOf(exception)).toMatchObject({
      code: 'OPERATION_REJECTED_BY_TRIGGER',
      message: 'The operation was rejected by database invariants',
    });
  });
});
