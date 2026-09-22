import { z } from 'zod';

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
export const GoalStatus = z.enum(['ON_TRACK', 'AT_RISK', 'ACHIEVED', 'MISSED']);

/** Accepts `?key=a&key=b`, a single `?key=a`, or no value at all. */
const repeatedQueryParam = <T extends z.ZodType>(item: T, maximum: number) =>
  z.preprocess(
    (value) => (Array.isArray(value) ? value : value ? [value] : []),
    z.array(item).max(maximum),
  );

export const listGoalsQuerySchema = z.strictObject({
  fighterId: repeatedQueryParam(z.string().uuid(), 100),
  coachId: z.string().uuid().optional(),
  status: repeatedQueryParam(GoalStatus, GoalStatus.options.length),
  technique: GoalTechnique.optional(),
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const goalParamsSchema = z.strictObject({ id: z.string().uuid() });

const goalFields = z.strictObject({
  fighterId: z.string().uuid(),
  coachId: z.string().uuid(),
  title: z.string().trim().min(3).max(120),
  technique: GoalTechnique.nullable(),
  metricLabel: z.string().trim().min(2).max(80),
  unit: z.string().trim().min(1).max(16),
  lowerIsBetter: z.boolean(),
  baseline: z.number().finite(),
  target: z.number().finite(),
  current: z.number().finite().optional(),
  startDate: z.string().datetime(),
  dueDate: z.string().datetime(),
});

export const createGoalSchema = goalFields.superRefine((value, context) => {
  if (Date.parse(value.dueDate) <= Date.parse(value.startDate))
    context.addIssue({
      code: 'custom',
      path: ['dueDate'],
      message: 'dueDate must be after startDate',
    });
  if (value.target === value.baseline)
    context.addIssue({
      code: 'custom',
      path: ['target'],
      message: 'target must differ from baseline',
    });
  if (value.lowerIsBetter && value.target > value.baseline)
    context.addIssue({
      code: 'custom',
      path: ['target'],
      message: 'target must be below baseline when lowerIsBetter is true',
    });
  if (!value.lowerIsBetter && value.target < value.baseline)
    context.addIssue({
      code: 'custom',
      path: ['target'],
      message: 'target must be above baseline when lowerIsBetter is false',
    });
});

export const updateGoalSchema = goalFields
  .omit({ fighterId: true, current: true })
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required',
  });

export const goalProgressSchema = z.strictObject({
  value: z.number().finite(),
});

export const goalHistorySchema = z.object({
  date: z.string().datetime(),
  value: z.number(),
});
export const goalResponseSchema = z.object({
  id: z.string().uuid(),
  fighterId: z.string().uuid(),
  coachId: z.string().uuid(),
  title: z.string(),
  technique: GoalTechnique.nullable(),
  metricLabel: z.string(),
  unit: z.string(),
  lowerIsBetter: z.boolean(),
  baseline: z.number(),
  target: z.number(),
  current: z.number(),
  startDate: z.string().datetime(),
  dueDate: z.string().datetime(),
  status: GoalStatus,
  history: z.array(goalHistorySchema),
  createdAt: z.string().datetime(),
});
export const goalPageSchema = z.object({
  items: z.array(goalResponseSchema),
  pageInfo: z.object({
    hasNextPage: z.boolean(),
    endCursor: z.string().uuid().nullable(),
  }),
  total: z.number().int().nonnegative(),
});

export type GoalStatusType = z.infer<typeof GoalStatus>;
export type ListGoalsQuery = z.infer<typeof listGoalsQuerySchema>;
export type CreateGoalInput = z.infer<typeof createGoalSchema>;
export type UpdateGoalInput = z.infer<typeof updateGoalSchema>;
export type GoalProgressInput = z.infer<typeof goalProgressSchema>;
export type GoalResponse = z.infer<typeof goalResponseSchema>;

export const GOAL_PERMISSIONS = { WRITE: 'goals:write' } as const;
