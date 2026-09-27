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
    'valid_until', 'supersedes_id', 'created_at',
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
