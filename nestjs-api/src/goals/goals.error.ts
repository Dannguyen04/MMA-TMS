import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import type { GoalDefinitionIssue } from './goals.model.js';

/** Also returned for a goal outside the actor's scope, so rosters aren't revealed. */
export function goalNotFound(): NotFoundException {
  return new NotFoundException({
    statusCode: HttpStatus.NOT_FOUND,
    error: 'Not Found',
    code: 'GOAL_NOT_FOUND',
    message: 'The requested goal does not exist or you cannot access it.',
  });
}

export function goalFighterNotFound(): NotFoundException {
  return new NotFoundException({
    statusCode: HttpStatus.NOT_FOUND,
    error: 'Not Found',
    code: 'GOAL_FIGHTER_NOT_FOUND',
    message: 'The fighter does not exist or is no longer active.',
  });
}

/** The goal coach must be an active coach currently assigned to the fighter. */
export function goalCoachNotAssigned(): BadRequestException {
  return new BadRequestException({
    statusCode: HttpStatus.BAD_REQUEST,
    error: 'Bad Request',
    code: 'GOAL_COACH_NOT_ASSIGNED',
    message: 'The coach must be actively assigned to this fighter.',
  });
}

/** Cross-field rules checked after merging a partial update with the stored goal. */
export function invalidGoalDefinition(
  issues: readonly GoalDefinitionIssue[],
): BadRequestException {
  return new BadRequestException({
    statusCode: HttpStatus.BAD_REQUEST,
    error: 'Bad Request',
    code: issues.includes('TARGET')
      ? 'INVALID_GOAL_TARGET'
      : 'INVALID_GOAL_DATE_RANGE',
    message: issues.includes('TARGET')
      ? 'The target must differ from the baseline in the direction set by lowerIsBetter.'
      : 'The due date must be after the start date.',
    details: { issues },
  });
}

export function goalDueDateInPast(): BadRequestException {
  return new BadRequestException({
    statusCode: HttpStatus.BAD_REQUEST,
    error: 'Bad Request',
    code: 'GOAL_DUE_DATE_IN_PAST',
    message: 'A new goal cannot be due in the past.',
  });
}

export function invalidGoalCursor(): BadRequestException {
  return new BadRequestException({
    statusCode: HttpStatus.BAD_REQUEST,
    error: 'Bad Request',
    code: 'INVALID_GOAL_CURSOR',
    message: 'The pagination cursor is invalid.',
  });
}

/** Status is derived per read, so an oversized scope is refused instead of truncated. */
export function goalScopeTooLarge(limit: number): BadRequestException {
  return new BadRequestException({
    statusCode: HttpStatus.BAD_REQUEST,
    error: 'Bad Request',
    code: 'GOAL_SCOPE_TOO_LARGE',
    message: `More than ${limit} goals match. Filter by fighter to narrow the list.`,
  });
}

export function goalOperationFailed(): InternalServerErrorException {
  return new InternalServerErrorException({
    statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
    error: 'Internal Server Error',
    code: 'GOAL_OPERATION_FAILED',
    message: 'An unexpected error occurred during the goal operation.',
  });
}

export function mapGoalPersistenceError(error: unknown): HttpException {
  if (error instanceof HttpException) return error;

  switch (getPostgreSqlErrorCode(error)) {
    case '23503': // foreign_key_violation
      return new NotFoundException({
        statusCode: HttpStatus.NOT_FOUND,
        error: 'Not Found',
        code: 'REFERENCED_ENTITY_NOT_FOUND',
        message: 'The operation references a non-existent entity.',
      });
    case '23514': // check_violation
      return new BadRequestException({
        statusCode: HttpStatus.BAD_REQUEST,
        error: 'Bad Request',
        code: 'GOAL_CHECK_VIOLATION',
        message: 'The provided data violates a system constraint.',
      });
    case 'P0001': // raise_exception from a database invariant trigger
      return new ConflictException({
        statusCode: HttpStatus.CONFLICT,
        error: 'Conflict',
        code: 'GOAL_INVARIANT_CONFLICT',
        message: 'The operation conflicts with a goal data invariant.',
      });
    default:
      return goalOperationFailed();
  }
}

function getPostgreSqlErrorCode(error: unknown): string | undefined {
  let current = error;
  const visited = new Set<object>();
  while (typeof current === 'object' && current !== null) {
    if (visited.has(current)) return undefined;
    visited.add(current);
    if ('code' in current && typeof current.code === 'string') {
      return current.code;
    }
    if (!('cause' in current)) return undefined;
    current = current.cause;
  }
  return undefined;
}
