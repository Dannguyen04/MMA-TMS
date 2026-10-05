import {
  ConflictException,
  HttpException,
  HttpStatus,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';

function notFound(code: string, message: string): NotFoundException {
  return new NotFoundException({
    statusCode: HttpStatus.NOT_FOUND,
    error: 'Not Found',
    code,
    message,
  });
}

function conflict(code: string, message: string): ConflictException {
  return new ConflictException({
    statusCode: HttpStatus.CONFLICT,
    error: 'Conflict',
    code,
    message,
  });
}

// --- 404 ---

export const doctorNotFound = () =>
  notFound('DOCTOR_NOT_FOUND', 'Doctor profile not found or inactive');
export const doctorAssignmentNotFound = () =>
  notFound('DOCTOR_ASSIGNMENT_NOT_FOUND', 'Doctor assignment record not found');
export const injuryNotFound = () =>
  notFound('INJURY_NOT_FOUND', 'Injury record not found');
export const recoveryPlanNotFound = () =>
  notFound('RECOVERY_PLAN_NOT_FOUND', 'Recovery plan not found');
export const medicalExaminationNotFound = () =>
  notFound('MEDICAL_EXAMINATION_NOT_FOUND', 'Medical examination not found');
export const medicalClearanceNotFound = () =>
  notFound('MEDICAL_CLEARANCE_NOT_FOUND', 'Medical clearance not found');
export const medicalReviewRequestNotFound = () =>
  notFound(
    'MEDICAL_REVIEW_REQUEST_NOT_FOUND',
    'Medical review request not found',
  );
export const medicalReferenceNotFound = () =>
  notFound(
    'MEDICAL_REFERENCE_NOT_FOUND',
    'A referenced medical record does not exist',
  );

// --- 409 ---

export const doctorAssignmentAlreadyActive = () =>
  conflict(
    'DOCTOR_ASSIGNMENT_ALREADY_ACTIVE',
    'An active assignment already exists for this doctor and fighter',
  );
export const doctorAssignmentAlreadyClosed = () =>
  conflict(
    'DOCTOR_ASSIGNMENT_ALREADY_CLOSED',
    'This doctor assignment has already been ended',
  );
export const doctorAssignmentPeriodConflict = () =>
  conflict(
    'DOCTOR_ASSIGNMENT_PERIOD_CONFLICT',
    'The assignment cannot end at or before its start time',
  );
export const invalidInjuryStatusTransition = () =>
  conflict(
    'INVALID_INJURY_STATUS_TRANSITION',
    'The requested injury status transition is not allowed',
  );
export const invalidRecoveryPlanStatusTransition = () =>
  conflict(
    'INVALID_RECOVERY_PLAN_STATUS_TRANSITION',
    'The requested recovery plan status transition is not allowed',
  );
export const recoveryPlanDateConflict = () =>
  conflict(
    'RECOVERY_PLAN_DATE_CONFLICT',
    'The recovery plan dates conflict with its recorded start date',
  );
export const examinationNotEligibleForClearance = () =>
  conflict(
    'EXAMINATION_NOT_ELIGIBLE_FOR_CLEARANCE',
    'A clearance must derive from the current positive examination of the same scope without widening it',
  );
export const examinationCorrectionConflict = () =>
  conflict(
    'EXAMINATION_CORRECTION_CONFLICT',
    'A correction must supersede the current examination of the same scope',
  );
export const reviewRequestNotResolvable = () =>
  conflict(
    'REVIEW_REQUEST_NOT_RESOLVABLE',
    'The review request is not open or was submitted after the examination',
  );
export const medicalClearanceNotActive = () =>
  conflict('MEDICAL_CLEARANCE_NOT_ACTIVE', 'The clearance is no longer active');
export const medicalRecordConflict = () =>
  conflict(
    'MEDICAL_RECORD_CONFLICT',
    'A conflicting medical record already exists',
  );
export const medicalDataConstraintConflict = () =>
  conflict(
    'MEDICAL_DATA_CONSTRAINT_CONFLICT',
    'The operation conflicts with a medical record invariant',
  );

// --- 500 ---

export const medicalOperationFailed = () =>
  new InternalServerErrorException({
    statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
    error: 'Internal Server Error',
    code: 'MEDICAL_OPERATION_FAILED',
    message: 'Unable to complete the medical operation',
  });

// --- PostgreSQL mapping ---

interface PostgreSqlError {
  code: string;
  constraint?: string;
}

// Drizzle wraps driver errors; walk the cause chain to the PostgreSQL error.
function findPostgreSqlError(error: unknown): PostgreSqlError | undefined {
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

const UNIQUE_VIOLATIONS: Readonly<Record<string, () => HttpException>> = {
  uq_doctor_fighter_open: doctorAssignmentAlreadyActive,
  uq_medical_examination_successor: examinationCorrectionConflict,
  uq_medical_clearance_examination_active: medicalRecordConflict,
  uq_injury_record_revision: medicalRecordConflict,
  uq_recovery_plan_revision: medicalRecordConflict,
  uq_medical_clearance_revision: medicalRecordConflict,
  uq_medical_review_request_revision: medicalRecordConflict,
};

const CHECK_VIOLATIONS: Readonly<Record<string, () => HttpException>> = {
  ck_doctor_fighters_period: doctorAssignmentPeriodConflict,
  ck_recovery_dates: recoveryPlanDateConflict,
  ck_recovery_completion: medicalDataConstraintConflict,
  ck_injury_resolved: medicalDataConstraintConflict,
  ck_treatment_followup: medicalDataConstraintConflict,
  ck_clearance_revocation: medicalDataConstraintConflict,
  medical_clearances_check: medicalDataConstraintConflict,
  ck_medical_examination_restrictions: medicalDataConstraintConflict,
  ck_medical_examination_validity: medicalDataConstraintConflict,
  ck_medical_review_request_resolution: medicalDataConstraintConflict,
  ck_medical_examination_details_vitals: medicalDataConstraintConflict,
  ck_medical_examination_details_text: medicalDataConstraintConflict,
  ck_medical_examination_details_scat6: medicalDataConstraintConflict,
};

// Business references a client can name; actor/provenance FKs are backend-owned
// and fall through to 500.
const FOREIGN_KEY_VIOLATIONS: Readonly<Record<string, () => HttpException>> = {
  doctor_fighters_doctor_id_fkey: doctorNotFound,
  fk_recovery_injury_fighter: injuryNotFound,
  recovery_plans_injury_id_fkey: injuryNotFound,
  treatments_injury_id_fkey: injuryNotFound,
  fk_medical_clearance_examination: medicalExaminationNotFound,
  fk_medical_examination_correction: medicalExaminationNotFound,
  fk_medical_review_request_examination: medicalReferenceNotFound,
};

export function mapMedicalPersistenceError(error: unknown): HttpException {
  if (error instanceof HttpException) return error;
  const pgError = findPostgreSqlError(error);
  if (!pgError) return medicalOperationFailed();

  const byConstraint = (table: Readonly<Record<string, () => HttpException>>) =>
    pgError.constraint ? table[pgError.constraint]?.() : undefined;

  switch (pgError.code) {
    case '23505':
      return byConstraint(UNIQUE_VIOLATIONS) ?? medicalOperationFailed();
    case '23503':
      return byConstraint(FOREIGN_KEY_VIOLATIONS) ?? medicalOperationFailed();
    case '23514':
      // Constraint-less 23514 comes from the clinical guard/immutability
      // triggers of migrations 003/011 (history, lifecycle, derivation rules).
      if (!pgError.constraint) return medicalDataConstraintConflict();
      return byConstraint(CHECK_VIOLATIONS) ?? medicalOperationFailed();
    default:
      return medicalOperationFailed();
  }
}
