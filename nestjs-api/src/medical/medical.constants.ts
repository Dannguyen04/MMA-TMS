import type {
  ClearanceType,
  ExaminationScope,
  InjuryStatus,
  RecoveryPlanStatus,
} from './medical.model.js';

export const MEDICAL_PERMISSIONS = {
  READ: 'fighter.medical:read',
  WRITE: 'fighter.medical:write',
  EXAMINATION_CREATE: 'fighter.medical_examination:create',
  CLEARANCE_ISSUE: 'fighter.medical_clearance:issue',
  CLEARANCE_REVOKE: 'fighter.medical_clearance:revoke',
  REVIEW_REQUEST_CREATE: 'fighter.medical_review_request:create',
  DOCTOR_READ: 'fighter.doctor:read',
  DOCTOR_ASSIGN: 'fighter.doctor:assign',
  DOCTOR_END: 'fighter.doctor:end',
  DOCTOR_ROSTER: 'doctor.fighter:get_all',
} as const;

export const MEDICAL_ELIGIBILITY_REASON = {
  /** TRAINING: no BASELINE examination on file (nor the 016 legacy exemption). */
  EXAMINATION_REQUIRED: 'EXAMINATION_REQUIRED',
  REVIEW_REQUEST_PENDING: 'REVIEW_REQUEST_PENDING',
  EXAMINATION_NOT_ELIGIBLE: 'EXAMINATION_NOT_ELIGIBLE',
  CLEARANCE_REQUIRED: 'CLEARANCE_REQUIRED',
  CLEARANCE_EXPIRED: 'CLEARANCE_EXPIRED',
  SESSION_TYPE_RESTRICTED: 'SESSION_TYPE_RESTRICTED',
} as const;
export type MedicalEligibilityReason =
  (typeof MEDICAL_ELIGIBILITY_REASON)[keyof typeof MEDICAL_ELIGIBILITY_REASON];

export const MEDICAL_HISTORY_RECORD_TYPE = {
  INJURY: 'INJURY',
  TREATMENT: 'TREATMENT',
  RECOVERY_PLAN: 'RECOVERY_PLAN',
  MEDICAL_EXAMINATION: 'MEDICAL_EXAMINATION',
  MEDICAL_CLEARANCE: 'MEDICAL_CLEARANCE',
  MEDICAL_REVIEW_REQUEST: 'MEDICAL_REVIEW_REQUEST',
} as const;
export type MedicalHistoryRecordType =
  (typeof MEDICAL_HISTORY_RECORD_TYPE)[keyof typeof MEDICAL_HISTORY_RECORD_TYPE];

/**
 * Snapshot columns exposed per history record type. Snapshots are stored as
 * full rows; only these clinical/provenance columns ever leave the API.
 */
export const MEDICAL_HISTORY_SNAPSHOT_FIELDS = {
  INJURY: [
    'id', 'fighter_id', 'reported_by_id', 'affected_joint', 'injury_type',
    'severity', 'occurred_at', 'description', 'status', 'resolved_at',
    'source_alert_id', 'trigger_video_id', 'created_at', 'updated_at',
  ],
  TREATMENT: [
    'id', 'injury_id', 'doctor_id', 'treatment_date', 'treatment_type',
    'description', 'outcome_notes', 'next_review_at', 'created_at',
  ],
  RECOVERY_PLAN: [
    'id', 'fighter_id', 'injury_id', 'doctor_id', 'title', 'description',
    'start_date', 'estimated_end_date', 'actual_end_date', 'status',
    'milestones', 'created_at', 'updated_at',
  ],
  MEDICAL_EXAMINATION: [
    'id', 'sequence_no', 'fighter_id', 'doctor_id', 'scope', 'decision',
    'examined_at', 'reason', 'allowed_session_types',
    'allowed_technique_types', 'excluded_joints', 'restriction_notes',
    'valid_until', 'supersedes_id', 'created_at', 'details',
  ],
  MEDICAL_CLEARANCE: [
    'id', 'fighter_id', 'examination_id', 'issued_by_id', 'clearance_type',
    'status', 'valid_from', 'valid_until', 'notes', 'allowed_session_types',
    'allowed_technique_types', 'excluded_joints', 'revoked_at',
    'revoked_by_id', 'revoked_reason', 'created_at', 'updated_at',
  ],
  MEDICAL_REVIEW_REQUEST: [
    'id', 'fighter_id', 'requested_by_id', 'requester_role', 'reason',
    'status', 'requested_at', 'resolved_by_examination_id', 'resolved_at',
  ],
} as const satisfies Record<MedicalHistoryRecordType, readonly string[]>;

/**
 * RESOLVED is a final status (a recurrence is a new injury record); the
 * record's content remains correctable with a new revision.
 */
export const INJURY_STATUS_TRANSITIONS: Partial<
  Record<InjuryStatus, readonly InjuryStatus[]>
> = {
  ACTIVE: ['RECOVERING', 'RESOLVED'],
  RECOVERING: ['ACTIVE', 'RESOLVED'],
};

export const RECOVERY_PLAN_STATUS_TRANSITIONS: Partial<
  Record<RecoveryPlanStatus, readonly RecoveryPlanStatus[]>
> = {
  ACTIVE: ['COMPLETED', 'CANCELLED'],
};

/** Clearance types that can derive from an examination of each scope. */
export const CLEARANCE_TYPES_BY_SCOPE = {
  TRAINING: ['TRAINING', 'RETURN_FROM_INJURY'],
  COMPETITION: ['COMPETITION'],
} as const satisfies Record<ExaminationScope, readonly ClearanceType[]>;

/** Existing recovery-plan text bounds, reused by recovery milestones. */
export const RECOVERY_PLAN_TITLE_MAX_LENGTH = 200;
export const CLINICAL_TEXT_MAX_LENGTH = 4_000;

/**
 * Technical input bound for milestones sent in one request. Not a medical or
 * protocol limit, and never applied to stored/legacy data when reading.
 */
export const RECOVERY_MILESTONES_MAX_INPUT = 50;

/**
 * Structure of the official SCAT6 (adolescents 13+ and adults; BJSM/CISG 2023,
 * doi:10.1136/bjsports-2023-107036) and its supplement "Guidelines to using
 * the SCAT6". Answers are recorded by item position on the official English
 * form; the form's own wording is not reproduced here (BMJ consent is
 * required for digital re-formatting). Bump SCORING_VERSION whenever scoring
 * changes: stored scores keep the version that produced them.
 */
export const SCAT6 = {
  FORM_VERSION: 'SCAT6-2023-EN',
  /** 2: Months scores 1 only when every response is correct (2026-10-04). */
  SCORING_VERSION: 2,
  MIN_AGE_YEARS: 13,
  OBSERVABLE_SIGNS: 8,
  GCS_MAX_ASSESSMENTS: 3,
  MADDOCKS_QUESTIONS: 5,
  SYMPTOMS: 22,
  SYMPTOM_MAX_RATING: 6,
  ORIENTATION_QUESTIONS: 5,
  WORDS_PER_LIST: 10,
  MEMORY_TRIALS: 3,
  DIGIT_STRING_LENGTHS: 4,
  /** "1 point if no errors and completion under 30 seconds". */
  MONTHS_TIME_LIMIT_SECONDS: 30,
  MONTHS: 12,
  /** "after a minimum of 5 minutes has elapsed since the end of the Immediate Memory". */
  DELAYED_RECALL_MIN_DELAY_MS: 5 * 60 * 1000,
  /** Max errors per stance; also the score of a stance not held for 5 s. */
  MBESS_MAX_ERRORS: 10,
  GAIT_TRIALS: 3,
  /** Printed dual-task sequences (serial 7s): practice 93…44, trials 88/90/98…. */
  DUAL_TASK_STEP: 7,
  DUAL_TASK_PRACTICE_RESPONSES: 8,
  DUAL_TASK_TRIAL_RESPONSES: 13,
  /** Cells of the form's alternate starting-integer row. */
  DUAL_TASK_ALTERNATE_MAX_RESPONSES: 30,
} as const;

export const SCAT6_LISTS = ['A', 'B', 'C'] as const;

/** Inbox text follows the existing English notification convention. */
export const MEDICAL_NOTIFICATION_TEXT = {
  DOCTOR_ASSIGNMENT_REQUIRED: {
    title: 'Assign a Doctor',
    message:
      'A new Fighter needs an assigned Doctor for the baseline examination before training.',
  },
} as const;

export const ACTIVE_INJURY_STATUSES: readonly InjuryStatus[] = [
  'ACTIVE',
  'RECOVERING',
];

/**
 * First key of the two-key advisory lock that serializes medical-state
 * changes and training starts per Fighter (second key: hashtext(fighter_id)).
 */
export const MEDICAL_FIGHTER_LOCK_NAMESPACE = 20260927;

export const MEDICAL_READ_AUDIT = {
  ACTION: 'MEDICAL_READ',
  RESOURCE_TYPE: 'fighter_medical',
} as const;

export const MEDICAL_READ_VIEW = {
  SUMMARY: 'SUMMARY',
  DOSSIER: 'DOSSIER',
  HISTORY: 'HISTORY',
  EXAMINATIONS: 'EXAMINATIONS',
  REVIEW_REQUESTS: 'REVIEW_REQUESTS',
} as const;
export type MedicalReadView =
  (typeof MEDICAL_READ_VIEW)[keyof typeof MEDICAL_READ_VIEW];
