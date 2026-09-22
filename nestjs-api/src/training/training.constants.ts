import { SessionStatusType, TrainingPlanStatusType } from "./training.model.js";

/**
 * Plan transitions the domain forbids. This is a denylist, not a full matrix:
 * only terminal-to-DRAFT was approved, so every other transition keeps its
 * current behaviour, including idempotent same-status requests.
 */
const FORBIDDEN_PLAN_TRANSITIONS: Partial<
  Record<TrainingPlanStatusType, readonly TrainingPlanStatusType[]>
> = {
  COMPLETED: ['DRAFT'],
  CANCELLED: ['DRAFT'],
};

/**
 * Session transitions the domain allows. Statuses absent as keys are terminal
 * and cannot transition further. IN_PROGRESS → CANCELLED covers a started
 * session that is stopped early.
 */
const ALLOWED_SESSION_TRANSITIONS: Partial<
  Record<SessionStatusType, readonly SessionStatusType[]>
> = {
  SCHEDULED: ['IN_PROGRESS', 'CANCELLED', 'SKIPPED'],
  IN_PROGRESS: ['COMPLETED', 'ABANDONED', 'CANCELLED'],
};

const TERMINAL_SESSION_STATUSES: readonly SessionStatusType[] = [
  'COMPLETED',
  'CANCELLED',
  'SKIPPED',
  'ABANDONED',
];

export {
  FORBIDDEN_PLAN_TRANSITIONS,
  ALLOWED_SESSION_TRANSITIONS,
  TERMINAL_SESSION_STATUSES,
};