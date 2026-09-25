export const FIGHTER_APPLICATION_PERMISSIONS = {
  GET_ALL: 'fighter_application:get_all',
  READ: 'fighter_application:read',
  EVALUATE: 'fighter_application:evaluate',
} as const;

export const APPLICATION_STATUS = {
  SUBMITTED: 'SUBMITTED',
  FAILED: 'FAILED',
  PASSED: 'PASSED',
  REJECTED: 'REJECTED',
  APPROVED: 'APPROVED',
  ACTIVATED: 'ACTIVATED',
} as const;

export const ACTIVATION_STATUS = {
  PENDING: 'PENDING',
  IN_PROGRESS: 'IN_PROGRESS',
  PASSWORD_SET: 'PASSWORD_SET',
  COMPLETED: 'COMPLETED',
} as const;

export const ASSESSMENT_CONCLUSION = {
  PASS: 'PASS',
  FAIL: 'FAIL',
} as const;

export const ADMIN_DECISION = {
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
} as const;

export type ApplicationStatus =
  (typeof APPLICATION_STATUS)[keyof typeof APPLICATION_STATUS];
export type ActivationStatus =
  (typeof ACTIVATION_STATUS)[keyof typeof ACTIVATION_STATUS];

/**
 * A Guest may hold only one attempt in these states; closed attempts stay as
 * history and allow a new application. Mirrors uq_fighter_application_open.
 */
export const OPEN_APPLICATION_STATUSES: readonly ApplicationStatus[] = [
  APPLICATION_STATUS.SUBMITTED,
  APPLICATION_STATUS.PASSED,
  APPLICATION_STATUS.APPROVED,
];

/**
 * Mirrors mma_private.guard_fighter_application_status(). The SQL trigger is
 * authoritative; this table keeps the use cases readable and must be changed
 * together with the migration that changes the trigger.
 */
export const APPLICATION_TRANSITIONS = {
  SUBMITTED: [APPLICATION_STATUS.FAILED, APPLICATION_STATUS.PASSED],
  PASSED: [APPLICATION_STATUS.REJECTED, APPLICATION_STATUS.APPROVED],
  APPROVED: [APPLICATION_STATUS.ACTIVATED],
  FAILED: [],
  REJECTED: [],
  ACTIVATED: [],
} as const satisfies Record<ApplicationStatus, readonly ApplicationStatus[]>;

export const CRITERIA_MIN_ITEMS = 1;
export const CRITERIA_MAX_ITEMS = 30;

/**
 * Minimum gap between recovery-mail sends for one activation. The cooldown is
 * claimed in the database before the provider call, so two concurrent requests
 * cannot both send, and a process that dies after claiming simply delays the
 * next attempt until the cooldown expires.
 */
export const RECOVERY_RESEND_COOLDOWN_MS = 5 * 60_000;

/**
 * An activation claimed for a password reset (IN_PROGRESS) is considered
 * abandoned after this window and may be released back to PENDING. This covers
 * a process that died between claiming and recording the outcome. It never
 * marks PASSWORD_SET, which still requires a confirmed provider password
 * change.
 */
export const ACTIVATION_CLAIM_STALE_MS = 15 * 60_000;

export const APPLICATION_PAGE_SIZE_DEFAULT = 20;
export const APPLICATION_PAGE_SIZE_MAX = 100;
