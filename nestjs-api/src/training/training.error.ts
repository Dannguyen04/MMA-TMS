import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';

export function planNotFound(): NotFoundException {
  return new NotFoundException({
    statusCode: HttpStatus.NOT_FOUND,
    error: 'Not Found',
    code: 'TRAINING_PLAN_NOT_FOUND',
    message: 'The requested training plan does not exist or has been deleted.',
  });
}

export function sessionNotFound(): NotFoundException {
  return new NotFoundException({
    statusCode: HttpStatus.NOT_FOUND,
    error: 'Not Found',
    code: 'TRAINING_SESSION_NOT_FOUND',
    message: 'The requested training session does not exist or has been deleted.',
  });
}

export function exerciseNotFound(): NotFoundException {
  return new NotFoundException({
    statusCode: HttpStatus.NOT_FOUND,
    error: 'Not Found',
    code: 'EXERCISE_NOT_FOUND',
    message: 'The requested exercise does not exist or has been deleted.',
  });
}

export function planExerciseNotFound(): NotFoundException {
  return new NotFoundException({
    statusCode: HttpStatus.NOT_FOUND,
    error: 'Not Found',
    code: 'PLAN_EXERCISE_NOT_FOUND',
    message: 'The requested exercise configuration for this plan does not exist.',
  });
}

export function invalidSessionStatusTransition(
  current: string,
  next: string,
): BadRequestException {
  return new BadRequestException({
    statusCode: HttpStatus.BAD_REQUEST,
    error: 'Bad Request',
    code: 'INVALID_SESSION_STATUS_TRANSITION',
    message: `Cannot transition training session from ${current} to ${next}.`,
  });
}

export function fighterScopeRequired(): BadRequestException {
  return new BadRequestException({
    statusCode: HttpStatus.BAD_REQUEST,
    error: 'Bad Request',
    code: 'FIGHTER_SCOPE_REQUIRED',
    message: 'A fighterId is required for this operation.',
  });
}

export function unavailableSessionPlan(): BadRequestException {
  return new BadRequestException({
    statusCode: HttpStatus.BAD_REQUEST,
    error: 'Bad Request',
    code: 'INVALID_SESSION_PLAN',
    message: 'The selected training plan is unavailable.',
  });
}

export function fighterPlanMismatch(): BadRequestException {
  return new BadRequestException({
    statusCode: HttpStatus.BAD_REQUEST,
    error: 'Bad Request',
    code: 'FIGHTER_PLAN_MISMATCH',
    message:
      'The training session fighter must match the training plan fighter.',
  });
}

export function invalidSessionPlanReference(): BadRequestException {
  return new BadRequestException({
    statusCode: HttpStatus.BAD_REQUEST,
    error: 'Bad Request',
    code: 'INVALID_SESSION_PLAN_REFERENCE',
    message:
      'The training plan does not exist or does not belong to the session fighter.',
  });
}

export function planStateConflict(): ConflictException {
  return new ConflictException({
    statusCode: HttpStatus.CONFLICT,
    error: 'Conflict',
    code: 'PLAN_STATE_CONFLICT',
    message: 'The training plan state was modified concurrently.',
  });
}

export function sessionStateConflict(): ConflictException {
  return new ConflictException({
    statusCode: HttpStatus.CONFLICT,
    error: 'Conflict',
    code: 'SESSION_STATE_CONFLICT',
    message: 'The training session state was modified concurrently.',
  });
}

export function invalidPlanDateRange(): BadRequestException {
  return new BadRequestException({
    statusCode: HttpStatus.BAD_REQUEST,
    error: 'Bad Request',
    code: 'INVALID_PLAN_DATE_RANGE',
    message: 'The plan end date must be after or equal to the start date.',
  });
}

export function trainingOperationFailed(): InternalServerErrorException {
  return new InternalServerErrorException({
    statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
    error: 'Internal Server Error',
    code: 'TRAINING_OPERATION_FAILED',
    message: 'An unexpected error occurred during the training operation.',
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

export function mapTrainingPersistenceError(error: unknown): HttpException {
  if (error instanceof HttpException) {
    return error;
  }

  const pgError = getPostgreSqlError(error);
  if (!pgError) {
    return trainingOperationFailed();
  }

  switch (pgError.code) {
    case '23505': // unique_violation
      return new ConflictException({
        statusCode: HttpStatus.CONFLICT,
        error: 'Conflict',
        code: 'TRAINING_CONFLICT',
        message: 'The operation violates a unique constraint.',
      });
    case '23503': // foreign_key_violation
      if (pgError.constraint === 'fk_session_plan_fighter') {
        return invalidSessionPlanReference();
      }
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
        code: 'TRAINING_CHECK_VIOLATION',
        message: 'The provided data violates a system constraint.',
      });
    case 'P0001': // raise_exception from a database invariant trigger
      return new ConflictException({
        statusCode: HttpStatus.CONFLICT,
        error: 'Conflict',
        code: 'TRAINING_INVARIANT_CONFLICT',
        message: 'The operation conflicts with a training data invariant.',
      });
    default:
      return trainingOperationFailed();
  }
}
