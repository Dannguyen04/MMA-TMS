import type { GoalStatusType } from './goals.model.js';

/**
 * The academy's calendar. Goal dates are academy days and one measurement is
 * kept per academy day, matching the web app, which uses this time zone.
 */
const GOAL_ACADEMY_TIMEZONE = 'Asia/Ho_Chi_Minh';
/** Fixed offset of that zone, which has no daylight saving time. */
const GOAL_ACADEMY_UTC_OFFSET = '+07:00';

/**
 * Business Flows, Flow 7: a goal is on track while its progress is at least
 * this share of the progress expected by a straight line from the baseline at
 * the start date to the target at the due date.
 */
const GOAL_ON_TRACK_RATIO = 0.9;

/** Most urgent first; ties are ordered by due date. */
const GOAL_STATUS_ORDER: readonly GoalStatusType[] = [
  'AT_RISK',
  'ON_TRACK',
  'ACHIEVED',
  'MISSED',
];

/**
 * Status is derived from the clock, so a list is filtered and ordered in
 * memory. A scope larger than this must be narrowed by fighter instead of
 * being truncated silently.
 */
const GOAL_LIST_SCAN_LIMIT = 2000;

/** Inbox texts of the Goal triggers (G1–G2). */
const GOAL_NOTIFICATION_TEXT = {
  GOAL_SET: {
    title: 'New goal set',
    message: 'Your coach set a new goal for you.',
  },
  GOAL_ACHIEVED: {
    title: 'Goal achieved',
    message: 'A goal reached its target.',
  },
} as const;

export {
  GOAL_ACADEMY_TIMEZONE,
  GOAL_ACADEMY_UTC_OFFSET,
  GOAL_ON_TRACK_RATIO,
  GOAL_STATUS_ORDER,
  GOAL_LIST_SCAN_LIMIT,
  GOAL_NOTIFICATION_TEXT,
};
