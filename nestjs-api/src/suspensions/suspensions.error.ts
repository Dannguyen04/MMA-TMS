import {
  ConflictException,
  HttpException,
  HttpStatus,
  InternalServerErrorException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { fighterNotFound } from '../fighters/fighters.error.js';

export function suspensionNotFound(): NotFoundException {
  return new NotFoundException({
    statusCode: HttpStatus.NOT_FOUND,
    error: 'Not Found',
    code: 'SUSPENSION_NOT_FOUND',
    message: 'The requested suspension does not exist or has been deleted.',
  });
}

export function suspensionAlreadyCleared(): ConflictException {
  return new ConflictException({
    statusCode: HttpStatus.CONFLICT,
    error: 'Conflict',
    code: 'SUSPENSION_ALREADY_CLEARED',
    message: 'The suspension has already been cleared.',
  });
}

export function suspensionValidationError(
  message = 'Validation failed',
  issues?: { code: string; path: (string | number)[]; message: string }[],
): UnprocessableEntityException {
  return new UnprocessableEntityException({
    statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
    error: 'Unprocessable Entity',
    code: 'VALIDATION_ERROR',
    message,
    ...(issues ? { issues } : {}),
  });
}

interface PostgreSqlError {
  code: string;
  constraint?: string;
}

function getPostgreSqlError(error: unknown): PostgreSqlError | undefined {
  let current = error;
  const visited = new Set<object>();
  while (typeof current === 'object' && current !== null) {
    if (visited.has(current)) return undefined;
    visited.add(current);
    if ('code' in current && typeof current.code === 'string') {
      return {
        code: current.code,
        ...('constraint' in current && typeof current.constraint === 'string'
          ? { constraint: current.constraint }
          : {}),
      };
    }
    if (!('cause' in current)) return undefined;
    current = current.cause;
  }
  return undefined;
}

export function mapSuspensionPersistenceError(error: unknown): HttpException {
  if (error instanceof HttpException) return error;
  const pgError = getPostgreSqlError(error);
  if (pgError?.code === '23503') {
    return fighterNotFound();
  }
  if (pgError?.code === '23514') {
    return suspensionValidationError(
      'The provided suspension data violates a constraint.',
    );
  }
  return new InternalServerErrorException(
    'An unexpected error occurred during the suspension operation.',
  );
}
