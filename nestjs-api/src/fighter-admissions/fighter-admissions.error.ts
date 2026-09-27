import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';

export function applicationNotFound(): NotFoundException {
  return new NotFoundException({
    statusCode: HttpStatus.NOT_FOUND,
    error: 'Not Found',
    code: 'FIGHTER_APPLICATION_NOT_FOUND',
    message: 'Admission application not found',
  });
}

export function openApplicationExists(): ConflictException {
  return new ConflictException({
    statusCode: HttpStatus.CONFLICT,
    error: 'Conflict',
    code: 'FIGHTER_APPLICATION_ALREADY_OPEN',
    message: 'An admission application is already in progress for this account',
  });
}

export function applicationStateConflict(): ConflictException {
  return new ConflictException({
    statusCode: HttpStatus.CONFLICT,
    error: 'Conflict',
    code: 'FIGHTER_APPLICATION_STATE_CONFLICT',
    message: 'The application is not in a state that allows this action',
  });
}

export function coachNotAssignable(): NotFoundException {
  return new NotFoundException({
    statusCode: HttpStatus.NOT_FOUND,
    error: 'Not Found',
    code: 'FIGHTER_APPLICATION_COACH_NOT_ASSIGNABLE',
    message: 'Coach profile not found or inactive',
  });
}

export function assignmentLockedByAssessment(): ConflictException {
  return new ConflictException({
    statusCode: HttpStatus.CONFLICT,
    error: 'Conflict',
    code: 'FIGHTER_APPLICATION_ASSIGNMENT_LOCKED',
    message:
      'The coach assignment can no longer change because the entrance assessment has been submitted',
  });
}

export function reassignmentReasonRequired(): BadRequestException {
  return new BadRequestException({
    statusCode: HttpStatus.BAD_REQUEST,
    error: 'Bad Request',
    code: 'FIGHTER_APPLICATION_REASSIGNMENT_REASON_REQUIRED',
    message: 'Replacing the assigned coach requires a reassignment reason',
  });
}

export function applicationNotAssignedToCoach(): ForbiddenException {
  return new ForbiddenException({
    statusCode: HttpStatus.FORBIDDEN,
    error: 'Forbidden',
    code: 'FIGHTER_APPLICATION_NOT_ASSIGNED',
    message: 'This admission application is not assigned to you',
  });
}

export function assessmentAlreadySubmitted(): ConflictException {
  return new ConflictException({
    statusCode: HttpStatus.CONFLICT,
    error: 'Conflict',
    code: 'FIGHTER_APPLICATION_ASSESSMENT_EXISTS',
    message: 'An entrance assessment has already been submitted',
  });
}

export function decisionRequiresPass(): ConflictException {
  return new ConflictException({
    statusCode: HttpStatus.CONFLICT,
    error: 'Conflict',
    code: 'FIGHTER_APPLICATION_DECISION_REQUIRES_PASS',
    message: 'Only an application with a PASS assessment can be decided',
  });
}

export function decisionAlreadyRecorded(): ConflictException {
  return new ConflictException({
    statusCode: HttpStatus.CONFLICT,
    error: 'Conflict',
    code: 'FIGHTER_APPLICATION_DECISION_EXISTS',
    message: 'A final decision has already been recorded',
  });
}

export function activationNotApproved(): NotFoundException {
  return new NotFoundException({
    statusCode: HttpStatus.NOT_FOUND,
    error: 'Not Found',
    code: 'FIGHTER_ACTIVATION_NOT_APPROVED',
    message: 'No approved admission is awaiting activation for this account',
  });
}

export function activationPasswordNotSet(): ConflictException {
  return new ConflictException({
    statusCode: HttpStatus.CONFLICT,
    error: 'Conflict',
    code: 'FIGHTER_ACTIVATION_PASSWORD_NOT_SET',
    message:
      'Set a new password through the recovery link before activating the fighter account',
  });
}

export function activationInProgress(): ConflictException {
  return new ConflictException({
    statusCode: HttpStatus.CONFLICT,
    error: 'Conflict',
    code: 'FIGHTER_ACTIVATION_IN_PROGRESS',
    message: 'A password recovery for this activation is being processed',
  });
}

export function activationStateConflict(): ConflictException {
  return new ConflictException({
    statusCode: HttpStatus.CONFLICT,
    error: 'Conflict',
    code: 'FIGHTER_ACTIVATION_STATE_CONFLICT',
    message: 'The activation is not in a state that allows this action',
  });
}

export function resendCooldownActive(): ConflictException {
  return new ConflictException({
    statusCode: HttpStatus.CONFLICT,
    error: 'Conflict',
    code: 'FIGHTER_ACTIVATION_RESEND_COOLDOWN',
    message: 'A recovery email was sent recently; wait before sending another',
  });
}

export function admissionOperationFailed(): InternalServerErrorException {
  return new InternalServerErrorException({
    statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
    error: 'Internal Server Error',
    code: 'FIGHTER_ADMISSION_OPERATION_FAILED',
    message: 'Unable to complete the admission operation',
  });
}

interface PostgreSqlError {
  code: string;
  constraint?: string;
}

function isPostgreSqlError(error: unknown): error is PostgreSqlError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof (error as { code: unknown }).code === 'string'
  );
}

export function mapAdmissionPersistenceError(error: unknown): HttpException {
  if (!isPostgreSqlError(error)) return admissionOperationFailed();

  // 23505: unique_violation
  if (error.code === '23505') {
    if (error.constraint === 'uq_fighter_application_open') {
      return openApplicationExists();
    }
    if (error.constraint === 'uq_application_assignment_open') {
      return assignmentLockedByAssessment();
    }
    if (
      error.constraint === 'fighter_application_assessments_application_id_key'
    ) {
      return assessmentAlreadySubmitted();
    }
    if (
      error.constraint === 'fighter_application_decisions_application_id_key'
    ) {
      return decisionAlreadyRecorded();
    }
    return new ConflictException({
      statusCode: HttpStatus.CONFLICT,
      error: 'Conflict',
      code: 'FIGHTER_ADMISSION_RESOURCE_CONFLICT',
      message: 'A conflicting admission record already exists',
    });
  }

  // 23503: foreign_key_violation
  if (error.code === '23503') {
    if (error.constraint?.includes('coach')) return coachNotAssignable();
    return new NotFoundException({
      statusCode: HttpStatus.NOT_FOUND,
      error: 'Not Found',
      code: 'REFERENCED_ENTITY_NOT_FOUND',
      message: 'A referenced entity does not exist',
    });
  }

  // 23514: check_violation
  if (error.code === '23514') {
    return new BadRequestException({
      statusCode: HttpStatus.BAD_REQUEST,
      error: 'Bad Request',
      code: 'INVALID_FIGHTER_ADMISSION_DATA',
      message: 'The submitted data violates database domain constraints',
    });
  }

  // P0001: raise_exception from the admission guard triggers
  if (error.code === 'P0001') {
    return new ConflictException({
      statusCode: HttpStatus.CONFLICT,
      error: 'Conflict',
      code: 'OPERATION_REJECTED_BY_TRIGGER',
      message: 'The operation was rejected by database invariants',
    });
  }

  return admissionOperationFailed();
}
