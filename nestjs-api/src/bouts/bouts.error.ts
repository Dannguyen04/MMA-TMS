import {
  ConflictException,
  HttpException,
  HttpStatus,
  InternalServerErrorException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { Gate1Item } from './bouts.model.js';

export function boutNotFound(): NotFoundException {
  return new NotFoundException({
    statusCode: HttpStatus.NOT_FOUND,
    error: 'Not Found',
    code: 'BOUT_NOT_FOUND',
    message: 'The requested bout does not exist or has been deleted.',
  });
}

export function rulesetNotFound(): NotFoundException {
  return new NotFoundException({
    statusCode: HttpStatus.NOT_FOUND,
    error: 'Not Found',
    code: 'RULESET_NOT_FOUND',
    message: 'The requested competition ruleset does not exist or has been deleted.',
  });
}

export function boutFighterNotFound(): NotFoundException {
  return new NotFoundException({
    statusCode: HttpStatus.NOT_FOUND,
    error: 'Not Found',
    code: 'BOUT_FIGHTER_NOT_FOUND',
    message: 'The fighter does not exist or is not active.',
  });
}

export function requirementNotFound(): NotFoundException {
  return new NotFoundException({
    statusCode: HttpStatus.NOT_FOUND,
    error: 'Not Found',
    code: 'BOUT_REQUIREMENT_NOT_FOUND',
    message: 'The requested bout requirement does not exist.',
  });
}

function unprocessable(
  code: string,
  message: string,
  details?: Record<string, unknown>,
): UnprocessableEntityException {
  return new UnprocessableEntityException({
    statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
    error: 'Unprocessable Entity',
    code,
    message,
    ...(details ? { details } : {}),
  });
}

export function boutCoachRequired(): UnprocessableEntityException {
  return unprocessable(
    'BOUT_COACH_REQUIRED',
    'An administrator must provide the coachId of the bout.',
  );
}

export function boutCoachNotAssigned(): UnprocessableEntityException {
  return unprocessable(
    'BOUT_COACH_NOT_ASSIGNED',
    'The coach is not currently assigned to this fighter.',
  );
}

export function boutInvalidSchedule(
  reason: 'WEIGH_IN_NOT_BEFORE_BOUT' | 'BOUT_NOT_IN_FUTURE',
): UnprocessableEntityException {
  return unprocessable(
    'BOUT_INVALID_SCHEDULE',
    reason === 'WEIGH_IN_NOT_BEFORE_BOUT'
      ? 'The weigh-in must be before the bout.'
      : 'The bout must be scheduled in the future.',
    { reason },
  );
}

export function boutInvalidWeightClass(
  reason: string,
): UnprocessableEntityException {
  return unprocessable(
    'BOUT_INVALID_WEIGHT_CLASS',
    'The weight class or weight limit is not valid for this ruleset.',
    { reason },
  );
}

export function boutInvalidPlan(
  reason: 'NOT_FOUND' | 'FIGHTER_MISMATCH' | 'PHASE_NOT_FIGHT_CAMP',
): UnprocessableEntityException {
  return unprocessable(
    'BOUT_PLAN_INVALID',
    'The training plan must belong to the same fighter, not be deleted, and be in the fight_camp phase.',
    { reason },
  );
}

export function requirementInvalid(
  reason: 'VALID_UNTIL_REQUIRED' | 'STATUS_REASON_REQUIRED' | 'PERIOD_INVALID',
): UnprocessableEntityException {
  const messages = {
    VALID_UNTIL_REQUIRED: 'A PROVIDED requirement must have a validUntil date.',
    STATUS_REASON_REQUIRED: 'A REJECTED requirement must have a statusReason.',
    PERIOD_INVALID: 'validUntil must not be before issuedOn.',
  } as const;
  return unprocessable('BOUT_REQUIREMENT_INVALID', messages[reason], { reason });
}

export function boutActiveExists(): ConflictException {
  return new ConflictException({
    statusCode: HttpStatus.CONFLICT,
    error: 'Conflict',
    code: 'BOUT_ACTIVE_EXISTS',
    message: 'The fighter already has a bout in CAMP, FIGHT_WEEK or WEIGHED_IN.',
  });
}

export function boutInvalidTransition(
  from: string,
  to: string,
): ConflictException {
  return new ConflictException({
    statusCode: HttpStatus.CONFLICT,
    error: 'Conflict',
    code: 'BOUT_INVALID_TRANSITION',
    message: `The bout cannot move from ${from} to ${to}.`,
    details: { from, to },
  });
}

export function boutNotEditable(status: string): ConflictException {
  return new ConflictException({
    statusCode: HttpStatus.CONFLICT,
    error: 'Conflict',
    code: 'BOUT_INVALID_TRANSITION',
    message: `The bout is ${status} and this change is no longer allowed.`,
    details: { status },
  });
}

export function boutRequirementsIncomplete(details: {
  missing: Gate1Item[];
  expiring: Gate1Item[];
}): ConflictException {
  return new ConflictException({
    statusCode: HttpStatus.CONFLICT,
    error: 'Conflict',
    code: 'BOUT_REQUIREMENTS_INCOMPLETE',
    message:
      'Gate 1 failed: required paperwork is missing or expires before the bout.',
    details,
  });
}

export function boutFightWeekTooEarly(earliestOn: string): ConflictException {
  return new ConflictException({
    statusCode: HttpStatus.CONFLICT,
    error: 'Conflict',
    code: 'BOUT_FIGHT_WEEK_TOO_EARLY',
    message: 'It is too early to enter fight week.',
    details: { earliestOn },
  });
}

export function requirementExists(): ConflictException {
  return new ConflictException({
    statusCode: HttpStatus.CONFLICT,
    error: 'Conflict',
    code: 'BOUT_REQUIREMENT_EXISTS',
    message: 'A requirement with this code already exists on the bout.',
  });
}

export function boutStateConflict(): ConflictException {
  return new ConflictException({
    statusCode: HttpStatus.CONFLICT,
    error: 'Conflict',
    code: 'BOUT_STATE_CONFLICT',
    message: 'The bout was modified concurrently. Reload and try again.',
  });
}


export function boutNotStarted(earliestOn: string): ConflictException {
  return new ConflictException({
    statusCode: HttpStatus.CONFLICT,
    error: 'Conflict',
    code: 'BOUT_NOT_STARTED',
    message: 'The bout has not started yet.',
    details: { earliestOn },
  });
}

export function boutWeighInTooEarly(earliestOn: string): ConflictException {
  return new ConflictException({
    statusCode: HttpStatus.CONFLICT,
    error: 'Conflict',
    code: 'BOUT_WEIGH_IN_TOO_EARLY',
    message: 'It is too early for official weigh-in.',
    details: { earliestOn },
  });
}

export function boutWeighInNotFailed(): ConflictException {
  return new ConflictException({
    statusCode: HttpStatus.CONFLICT,
    error: 'Conflict',
    code: 'BOUT_WEIGH_IN_NOT_FAILED',
    message: 'Catchweight can only be agreed after a failed weigh-in.',
  });
}

export function boutInvalidCatchweight(reason: string = 'OUT_OF_RANGE'): UnprocessableEntityException {
  return unprocessable(
    'BOUT_INVALID_CATCHWEIGHT',
    'The catchweight limit must be at least the official weight and above the original limit.',
    { reason },
  );
}

export function boutResultInvalid(
  reason:
    | 'ROUND_REQUIRED'
    | 'ROUND_NOT_ALLOWED'
    | 'CONSCIOUSNESS_REQUIRED'
    | 'CONSCIOUSNESS_NOT_ALLOWED'
    | 'HEAD_STRIKE_REQUIRED'
    | 'HEAD_STRIKE_NOT_ALLOWED'
    | string,
): UnprocessableEntityException {
  const messages: Record<string, string> = {
    ROUND_REQUIRED: 'A result round is required for KO, TKO and SUBMISSION.',
    ROUND_NOT_ALLOWED: 'A result round is not allowed for DECISION.',
    CONSCIOUSNESS_REQUIRED: 'Loss of consciousness evaluation is required for KO and TKO losses.',
    CONSCIOUSNESS_NOT_ALLOWED: 'Loss of consciousness is only evaluated on KO and TKO losses.',
    HEAD_STRIKE_REQUIRED: 'Stopped by head strike flag is required for TKO losses.',
    HEAD_STRIKE_NOT_ALLOWED: 'Stopped by head strike flag is only allowed on TKO losses.',
  };
  return unprocessable(
    'BOUT_RESULT_INVALID',
    messages[reason] ?? 'The provided bout result data is invalid.',
    { reason },
  );
}

export function boutRequirementsLocked(): ConflictException {
  return new ConflictException({
    statusCode: HttpStatus.CONFLICT,
    error: 'Conflict',
    code: 'BOUT_REQUIREMENTS_LOCKED',
    message: 'Requirements are locked during fight week and after weigh-in. An unlockReason is required.',
  });
}

export function boutChangeReasonRequired(): UnprocessableEntityException {
  return unprocessable(
    'BOUT_CHANGE_REASON_REQUIRED',
    'A reason is required when changing the weight class or weight limit.',
  );
}

export function boutOperationFailed(): InternalServerErrorException {
  return new InternalServerErrorException({
    statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
    error: 'Internal Server Error',
    code: 'BOUT_OPERATION_FAILED',
    message: 'An unexpected error occurred during the bout operation.',
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

export function mapBoutPersistenceError(error: unknown): HttpException {
  if (error instanceof HttpException) return error;
  const pgError = getPostgreSqlError(error);
  if (!pgError) return boutOperationFailed();

  switch (pgError.code) {
    case '23505':
      if (pgError.constraint === 'uq_bouts_active_per_fighter')
        return boutActiveExists();
      if (pgError.constraint === 'uq_bout_requirements_code')
        return requirementExists();
      return boutStateConflict();
    case '23503':
      if (pgError.constraint === 'fk_bout_plan_fighter')
        return boutInvalidPlan('FIGHTER_MISMATCH');
      return new NotFoundException({
        statusCode: HttpStatus.NOT_FOUND,
        error: 'Not Found',
        code: 'REFERENCED_ENTITY_NOT_FOUND',
        message: 'The operation references a non-existent entity.',
      });
    case '23514':
      return unprocessable(
        'BOUT_CHECK_VIOLATION',
        'The provided data violates a system constraint.',
      );
    default:
      return boutOperationFailed();
  }
}

export function boutAnalysisInvalid(
  code: 'OPPONENT_TACTIC_EVIDENCE_REQUIRED' | 'OPPONENT_SESSION_INVALID' |
    'OPPONENT_TACTIC_UNKNOWN' | 'BOUT_ROUNDS_NOT_SET' | 'BOUT_ROUND_OUT_OF_RANGE' |
    'BOUT_ROUND_MARK_UNKNOWN' | 'BOUT_ROUNDS_BELOW_RECORDED',
): UnprocessableEntityException {
  return unprocessable(code, 'The opponent analysis or round record is invalid.');
}
