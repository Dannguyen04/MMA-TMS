export const NOTIFICATION_PUBLISHER = Symbol('NOTIFICATION_PUBLISHER');

// Approved trigger types (migrations 015, 017, 022). Legacy enum values stay readable in
// the inbox but cannot be published.
export const NOTIFICATION_TYPE = {
  /** A1 — Admin: a Guest submitted an application to triage. */
  ADMISSION_APPLICATION_SUBMITTED: 'ADMISSION_APPLICATION_SUBMITTED',
  /** A2 — Coach: assigned to evaluate an application. */
  ADMISSION_ASSESSMENT_ASSIGNED: 'ADMISSION_ASSESSMENT_ASSIGNED',
  /** A2 — previous Coach: the evaluation was handed to another Coach. */
  ADMISSION_ASSESSMENT_UNASSIGNED: 'ADMISSION_ASSESSMENT_UNASSIGNED',
  /** A3 — Admin: a PASS assessment awaits approval or rejection. */
  ADMISSION_DECISION_REQUIRED: 'ADMISSION_DECISION_REQUIRED',
  /** A3/A4 — applicant: the assessment of the attempt was recorded. */
  ADMISSION_ASSESSMENT_RESULT: 'ADMISSION_ASSESSMENT_RESULT',
  /** A5 — applicant: the Admin decision was recorded. */
  ADMISSION_DECISION_RECORDED: 'ADMISSION_DECISION_RECORDED',
  /** A6 — Admin: a new Fighter completed activation and needs a training Coach. */
  ADMISSION_ACTIVATION_COMPLETED: 'ADMISSION_ACTIVATION_COMPLETED',
  /** T1 — Coach and Fighter: a training assignment was created. */
  COACH_ASSIGNMENT_STARTED: 'COACH_ASSIGNMENT_STARTED',
  /** T1 — Coach and Fighter: a training assignment was ended. */
  COACH_ASSIGNMENT_ENDED: 'COACH_ASSIGNMENT_ENDED',
  /** T2 — Fighter: a plan became ACTIVE. */
  TRAINING_PLAN_ACTIVATED: 'TRAINING_PLAN_ACTIVATED',
  /** T3 — session participants: a session was scheduled. */
  TRAINING_SESSION_SCHEDULED: 'TRAINING_SESSION_SCHEDULED',
  /** T4 — session participants: time or location actually changed. */
  TRAINING_SESSION_RESCHEDULED: 'TRAINING_SESSION_RESCHEDULED',
  /** T4 — session participants: the session was cancelled. */
  TRAINING_SESSION_CANCELLED: 'TRAINING_SESSION_CANCELLED',
  /**
   * M1 — Admins with `fighter.doctor:assign` (migration 017): a new Fighter has
   * no effective Doctor assignment, needed for the baseline examination.
   */
  FIGHTER_DOCTOR_ASSIGNMENT_REQUIRED: 'FIGHTER_DOCTOR_ASSIGNMENT_REQUIRED',
  /** G1 — Fighter: a Coach set a new goal (migration 022). */
  GOAL_SET: 'GOAL_SET',
  /** G2 — Fighter and goal Coach: a measurement reached the target (migration 022). */
  GOAL_ACHIEVED: 'GOAL_ACHIEVED',
} as const;

export type NotificationType =
  (typeof NOTIFICATION_TYPE)[keyof typeof NOTIFICATION_TYPE];

export const notificationTypes = Object.values(
  NOTIFICATION_TYPE,
) as readonly NotificationType[];

/** Clients re-read the target through its own API, which re-checks access. */
export const NOTIFICATION_TARGET = {
  FIGHTER_APPLICATION: 'FIGHTER_APPLICATION',
  FIGHTER: 'FIGHTER',
  COACH_ASSIGNMENT: 'COACH_ASSIGNMENT',
  TRAINING_PLAN: 'TRAINING_PLAN',
  TRAINING_SESSION: 'TRAINING_SESSION',
  GOAL: 'GOAL',
} as const;

export type NotificationTargetType =
  (typeof NOTIFICATION_TARGET)[keyof typeof NOTIFICATION_TARGET];

export const notificationTargetTypes = Object.values(
  NOTIFICATION_TARGET,
) as readonly NotificationTargetType[];

/** Flat, non-sensitive values only; no tokens, request data or clinical content. */
export type NotificationDataValue = string | number | boolean | null;

export interface NotifyInput {
  /** `public.users.id` values, never auth subjects or profile IDs. */
  recipientUserIds: readonly string[];
  /** Removed from the recipients. */
  actorUserId?: string;
  type: NotificationType;
  title: string;
  message: string;
  target?: { type: NotificationTargetType; id: string };
  data?: Readonly<Record<string, NotificationDataValue>>;
  // Stable per event occurrence (row ID or written revision), never random:
  // a retry must produce the same key.
  dedupeKey: string;
}

export interface NotifyContext {
  correlationId?: string;
}

// Enqueue state only: `queued` is not stored/delivered, and `failed` may hide a
// job Redis accepted after the timeout (harmless thanks to the dedupe key).
export type NotifyResult =
  | { status: 'queued' }
  | { status: 'skipped'; reason: 'NO_RECIPIENTS' }
  | {
      status: 'failed';
      reason:
        | 'INVALID_INPUT'
        | 'RECIPIENT_RESOLUTION_FAILED'
        | 'ENQUEUE_FAILED'
        | 'ENQUEUE_TIMEOUT';
    };

// Call only after commit, never inside a transaction. Implementations never
// throw, so a committed operation never becomes an error response.
export interface NotificationPublisher {
  notify(input: NotifyInput, context?: NotifyContext): Promise<NotifyResult>;

  /** A resolver error is reported as `RECIPIENT_RESOLUTION_FAILED`, never thrown. */
  notifyResolved(
    resolve: () => Promise<readonly NotifyInput[]>,
    context?: NotifyContext,
  ): Promise<readonly NotifyResult[]>;
}
