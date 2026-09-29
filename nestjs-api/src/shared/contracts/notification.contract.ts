export const NOTIFICATION_PUBLISHER = Symbol('NOTIFICATION_PUBLISHER');

/**
 * Notification types a business module may request. Each value exists in the
 * `notification_type` enum (migration 014) and belongs to an approved trigger;
 * legacy enum values stay readable in the inbox but are not accepted here.
 */
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
} as const;

export type NotificationType =
  (typeof NOTIFICATION_TYPE)[keyof typeof NOTIFICATION_TYPE];

export const notificationTypes = Object.values(
  NOTIFICATION_TYPE,
) as readonly NotificationType[];

/** Resource a notification points at. Clients re-read it through its own API. */
export const NOTIFICATION_TARGET = {
  FIGHTER_APPLICATION: 'FIGHTER_APPLICATION',
  FIGHTER: 'FIGHTER',
  COACH_ASSIGNMENT: 'COACH_ASSIGNMENT',
  TRAINING_PLAN: 'TRAINING_PLAN',
  TRAINING_SESSION: 'TRAINING_SESSION',
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
  /** The user who caused the event; removed from the recipients. */
  actorUserId?: string;
  type: NotificationType;
  title: string;
  message: string;
  target?: { type: NotificationTargetType; id: string };
  data?: Readonly<Record<string, NotificationDataValue>>;
  /**
   * Stable identity of one occurrence of the event (for example the ID of the
   * row the mutation created, or its revision timestamp). Never random per
   * call: a retry of the same occurrence must produce the same key.
   */
  dedupeKey: string;
}

export interface NotifyContext {
  correlationId?: string;
}

/**
 * State of the enqueue request only. `queued` never means the notification was
 * stored or delivered; `failed` may still hide a job Redis accepted after the
 * enqueue timeout, which the dedupe key makes harmless.
 */
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

/**
 * Post-commit notification port. Implementations never throw: a failure is
 * logged and reported as `failed`, so it can never turn a committed business
 * operation into an error response. Never call it inside a transaction.
 */
export interface NotificationPublisher {
  notify(input: NotifyInput, context?: NotifyContext): Promise<NotifyResult>;

  /**
   * Runs caller-owned recipient resolution and then `notify` for each input,
   * under the same isolation: a resolution error is logged and reported as
   * `RECIPIENT_RESOLUTION_FAILED` instead of reaching the business response.
   */
  notifyResolved(
    resolve: () => Promise<readonly NotifyInput[]>,
    context?: NotifyContext,
  ): Promise<readonly NotifyResult[]>;
}
