import { z } from 'zod';
import {
  isoDateTimeSchema,
  trimmedTextSchema,
} from '../shared/utils/zod-schema.util.js';
import {
  GOAL_ACADEMY_TIMEZONE,
  GOAL_ACADEMY_UTC_OFFSET,
  GOAL_ON_TRACK_RATIO,
} from './goals.constants.js';

// --- Enums ---
export const GoalTechnique = z.enum([
  'JAB',
  'CROSS',
  'HOOK',
  'KICK',
  'COMBINATION',
  'FOOTWORK',
  'GUARD',
  'HEAD_MOVEMENT',
]);
export type GoalTechniqueType = z.infer<typeof GoalTechnique>;

export const GoalStatus = z.enum(['ON_TRACK', 'AT_RISK', 'ACHIEVED', 'MISSED']);
export type GoalStatusType = z.infer<typeof GoalStatus>;

/** Progress is recorded with `goal:update` ("update a goal or record progress"). */
export const GOAL_PERMISSIONS = {
  GET_ALL: 'goal:get_all',
  READ: 'goal:read',
  CREATE: 'goal:create',
  UPDATE: 'goal:update',
  DELETE: 'goal:delete',
} as const;

// --- Academy calendar ---
// Goals store calendar days (`YYYY-MM-DD`) of the academy. A goal starts at the
// beginning of its start day and is due at the end of its due day.

const academyDayFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: GOAL_ACADEMY_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** The academy day containing `instant`. */
export function academyDay(instant: Date): string {
  return academyDayFormat.format(instant);
}

export function academyDayStart(day: string): Date {
  return new Date(`${day}T00:00:00.000${GOAL_ACADEMY_UTC_OFFSET}`);
}

export function academyDayEnd(day: string): Date {
  return new Date(`${day}T23:59:59.999${GOAL_ACADEMY_UTC_OFFSET}`);
}

// --- Status ---

export interface GoalStatusInput {
  baseline: number;
  target: number;
  current: number;
  lowerIsBetter: boolean;
  startDate: string;
  dueDate: string;
}

export function hasReachedTarget(
  goal: Pick<GoalStatusInput, 'current' | 'target' | 'lowerIsBetter'>,
): boolean {
  return goal.lowerIsBetter
    ? goal.current <= goal.target
    : goal.current >= goal.target;
}

/**
 * Business Flows, Flow 7. Achieved once the target is reached; missed when the
 * due day ended without it. Otherwise progress is compared with a straight
 * line from the baseline at the start to the target at the due date: on track
 * at or above 90% of the expected progress, at risk below it. Progress is a
 * fraction of the baseline→target span, so lower-is-better goals follow the
 * same rule.
 */
export function deriveGoalStatus(
  goal: GoalStatusInput,
  now: Date,
): GoalStatusType {
  if (hasReachedTarget(goal)) return 'ACHIEVED';
  const start = academyDayStart(goal.startDate).getTime();
  const due = academyDayEnd(goal.dueDate).getTime();
  if (now.getTime() > due) return 'MISSED';
  const elapsed = Math.min(
    Math.max((now.getTime() - start) / (due - start), 0),
    1,
  );
  const span = goal.target - goal.baseline;
  const progress = span === 0 ? 1 : (goal.current - goal.baseline) / span;
  return progress >= GOAL_ON_TRACK_RATIO * elapsed ? 'ON_TRACK' : 'AT_RISK';
}

// --- Definition rules ---

export interface GoalDefinition {
  lowerIsBetter: boolean;
  baseline: number;
  target: number;
  /** Academy days. */
  startDate: string;
  dueDate: string;
}

export type GoalDefinitionIssue = 'TARGET' | 'DATE_RANGE';

/** A real change to aim for, in the declared direction, over at least one day. */
export function goalDefinitionIssues(
  goal: GoalDefinition,
): GoalDefinitionIssue[] {
  const issues: GoalDefinitionIssue[] = [];
  if (
    goal.lowerIsBetter
      ? goal.target >= goal.baseline
      : goal.target <= goal.baseline
  ) {
    issues.push('TARGET');
  }
  if (goal.dueDate <= goal.startDate) issues.push('DATE_RANGE');
  return issues;
}

// --- Request / Response Schemas ---

/** The database stores non-negative finite measurements. */
const goalValueSchema = z.number().finite().nonnegative();

/** Accepts `?key=a&key=b` and `?key=a` alike. */
const repeatedQueryValue = <T extends z.ZodType>(item: T, maximum: number) =>
  z.preprocess(
    (value) =>
      value === undefined || Array.isArray(value) ? value : [value],
    z.array(item).min(1).max(maximum),
  );

export const listGoalsQuerySchema = z.strictObject({
  fighterId: repeatedQueryValue(z.uuid(), 500).optional(),
  coachId: z.uuid().optional(),
  status: repeatedQueryValue(GoalStatus, GoalStatus.options.length).optional(),
  technique: GoalTechnique.optional(),
  cursor: z.string().min(1).max(512).optional(),
  limit: z.coerce.number().int().positive().max(100).default(100),
});
export type ListGoalsQuery = z.infer<typeof listGoalsQuerySchema>;

/** An instant converted to the academy day it falls on. */
const academyDaySchema = isoDateTimeSchema.transform((value) =>
  academyDay(new Date(value)),
);

const goalFieldsSchema = {
  coachId: z.uuid(),
  title: trimmedTextSchema(120, 3),
  technique: GoalTechnique.nullable(),
  metricLabel: trimmedTextSchema(80, 2),
  unit: trimmedTextSchema(16),
  lowerIsBetter: z.boolean(),
  baseline: goalValueSchema,
  target: goalValueSchema,
  startDate: academyDaySchema,
  dueDate: academyDaySchema,
};

const definitionIssueMessages: Record<
  GoalDefinitionIssue,
  { path: string; message: string }
> = {
  TARGET: {
    path: 'target',
    message:
      'The target must differ from the baseline in the direction set by lowerIsBetter.',
  },
  DATE_RANGE: {
    path: 'dueDate',
    message: 'The due date must be after the start date.',
  },
};

export const createGoalSchema = z
  .strictObject({
    fighterId: z.uuid(),
    ...goalFieldsSchema,
    /** Latest measured value. Defaults to the baseline. */
    current: goalValueSchema.optional(),
  })
  .superRefine((data, ctx) => {
    for (const issue of goalDefinitionIssues(data)) {
      const { path, message } = definitionIssueMessages[issue];
      ctx.addIssue({ code: 'custom', path: [path], message });
    }
  });
export type CreateGoalInput = z.infer<typeof createGoalSchema>;

/**
 * Any subset of the definition. The fighter never changes; the measured value
 * changes only through progress. Rules spanning fields are checked against the
 * stored goal once merged.
 */
export const updateGoalSchema = z
  .strictObject(goalFieldsSchema)
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Provide at least one field to update.',
  });
export type UpdateGoalInput = z.infer<typeof updateGoalSchema>;

export const goalProgressSchema = z.strictObject({
  value: goalValueSchema,
});
export type GoalProgressInput = z.infer<typeof goalProgressSchema>;

export const goalIdParamsSchema = z.strictObject({
  id: z.uuid(),
});

export const goalCheckpointSchema = z.object({
  date: isoDateTimeSchema,
  value: z.number(),
});

/** Dates are returned as instants: the start of the start day and the end of the due day. */
export const goalResponseSchema = z.object({
  id: z.uuid(),
  fighterId: z.uuid(),
  coachId: z.uuid(),
  title: z.string(),
  technique: GoalTechnique.nullable(),
  metricLabel: z.string(),
  unit: z.string(),
  lowerIsBetter: z.boolean(),
  baseline: z.number(),
  target: z.number(),
  current: z.number(),
  startDate: isoDateTimeSchema,
  dueDate: isoDateTimeSchema,
  status: GoalStatus,
  history: z.array(goalCheckpointSchema),
  createdAt: isoDateTimeSchema,
});
export type GoalResponse = z.infer<typeof goalResponseSchema>;

export const goalPageSchema = z.object({
  items: z.array(goalResponseSchema),
  pageInfo: z.object({
    hasNextPage: z.boolean(),
    endCursor: z.string().nullable(),
  }),
  total: z.number().int().nonnegative(),
});
