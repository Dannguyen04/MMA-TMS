import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';

export function fighterNotFound(): NotFoundException {
  return new NotFoundException({
    statusCode: HttpStatus.NOT_FOUND,
    error: 'Not Found',
    code: 'FIGHTER_NOT_FOUND',
    message: 'Fighter profile not found',
  });
}

export function fighterInactive(): ForbiddenException {
  return new ForbiddenException({
    statusCode: HttpStatus.FORBIDDEN,
    error: 'Forbidden',
    code: 'FIGHTER_INACTIVE',
    message: 'Fighter profile is inactive',
  });
}

export function measurementNotFound(): NotFoundException {
  return new NotFoundException({
    statusCode: HttpStatus.NOT_FOUND,
    error: 'Not Found',
    code: 'MEASUREMENT_NOT_FOUND',
    message: 'Body measurement record not found',
  });
}

export function measurementAlreadySuperseded(): ConflictException {
  return new ConflictException({
    statusCode: HttpStatus.CONFLICT,
    error: 'Conflict',
    code: 'MEASUREMENT_ALREADY_SUPERSEDED',
    message:
      'This body measurement has already been superseded by a correction',
  });
}

export function measurementContextForbidden(): ForbiddenException {
  return new ForbiddenException({
    statusCode: HttpStatus.FORBIDDEN,
    error: 'Forbidden',
    code: 'MEASUREMENT_CONTEXT_FORBIDDEN',
    message:
      'Fighters may only submit body measurements under the SELF_REPORTED context',
  });
}

export function coachNotFound(): NotFoundException {
  return new NotFoundException({
    statusCode: HttpStatus.NOT_FOUND,
    error: 'Not Found',
    code: 'COACH_NOT_FOUND',
    message: 'Coach profile not found or inactive',
  });
}

export function coachAssignmentNotFound(): NotFoundException {
  return new NotFoundException({
    statusCode: HttpStatus.NOT_FOUND,
    error: 'Not Found',
    code: 'COACH_ASSIGNMENT_NOT_FOUND',
    message: 'Coach assignment record not found',
  });
}

export function coachAssignmentAlreadyActive(): ConflictException {
  return new ConflictException({
    statusCode: HttpStatus.CONFLICT,
    error: 'Conflict',
    code: 'COACH_ASSIGNMENT_ALREADY_ACTIVE',
    message: 'An active assignment already exists for this coach and fighter',
  });
}

export function coachAssignmentAlreadyClosed(): ConflictException {
  return new ConflictException({
    statusCode: HttpStatus.CONFLICT,
    error: 'Conflict',
    code: 'COACH_ASSIGNMENT_ALREADY_CLOSED',
    message: 'This coach assignment has already been ended',
  });
}

export function invalidAssignmentPeriod(): BadRequestException {
  return new BadRequestException({
    statusCode: HttpStatus.BAD_REQUEST,
    error: 'Bad Request',
    code: 'INVALID_ASSIGNMENT_PERIOD',
    message: 'Assignment end time must be after start time',
  });
}

export function medicalAccessDenied(): ForbiddenException {
  return new ForbiddenException({
    statusCode: HttpStatus.FORBIDDEN,
    error: 'Forbidden',
    code: 'MEDICAL_ACCESS_DENIED',
    message: 'You are not authorized to view medical records for this fighter',
  });
}

export function fighterOperationFailed(): InternalServerErrorException {
  return new InternalServerErrorException({
    statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
    error: 'Internal Server Error',
    code: 'FIGHTER_OPERATION_FAILED',
    message: 'Unable to complete the fighter operation',
  });
}

interface PostgreSqlError {
  code: string;
  constraint?: string;
  message?: string;
}

function isPostgreSqlError(error: unknown): error is PostgreSqlError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof (error as { code: unknown }).code === 'string'
  );
}

export function mapFighterPersistenceError(error: unknown): HttpException {
  if (!isPostgreSqlError(error)) {
    return fighterOperationFailed();
  }

  // 23505: unique_violation
  if (error.code === '23505') {
    if (error.constraint === 'uq_coach_fighter_open') {
      return coachAssignmentAlreadyActive();
    }
    if (error.constraint === 'uq_measurement_successor') {
      return measurementAlreadySuperseded();
    }
    return new ConflictException({
      statusCode: HttpStatus.CONFLICT,
      error: 'Conflict',
      code: 'FIGHTER_RESOURCE_CONFLICT',
      message: 'A conflicting record already exists',
    });
  }

  // 23503: foreign_key_violation
  if (error.code === '23503') {
    if (error.constraint?.includes('coach')) {
      return coachNotFound();
    }
    if (error.constraint?.includes('fighter')) {
      return fighterNotFound();
    }
    return new NotFoundException({
      statusCode: HttpStatus.NOT_FOUND,
      error: 'Not Found',
      code: 'REFERENCED_ENTITY_NOT_FOUND',
      message: 'A referenced entity does not exist',
    });
  }

  // 23514: check_violation
  if (error.code === '23514') {
    if (error.constraint === 'ck_coach_fighters_period') {
      return invalidAssignmentPeriod();
    }
    if (error.constraint === 'ck_coach_fighters_closure') {
      return new BadRequestException({
        statusCode: HttpStatus.BAD_REQUEST,
        error: 'Bad Request',
        code: 'INVALID_ASSIGNMENT_CLOSURE',
        message:
          'Closing an assignment requires both an end timestamp and a non-empty reason',
      });
    }
    return new BadRequestException({
      statusCode: HttpStatus.BAD_REQUEST,
      error: 'Bad Request',
      code: 'INVALID_FIGHTER_DATA',
      message: 'The submitted data violates database domain constraints',
    });
  }

  // P0001: raise_exception from database triggers (e.g. append-only triggers)
  if (error.code === 'P0001') {
    return new ConflictException({
      statusCode: HttpStatus.CONFLICT,
      error: 'Conflict',
      code: 'OPERATION_REJECTED_BY_TRIGGER',
      message: 'The operation was rejected by database invariants',
    });
  }

  return fighterOperationFailed();
}
