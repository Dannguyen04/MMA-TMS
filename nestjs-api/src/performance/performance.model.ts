import { z } from 'zod';

export const Technique = z.enum([
  'jab',
  'cross',
  'hook',
  'kick',
  'combination',
  'footwork',
  'guard',
  'head_movement',
]);
export type TechniqueType = z.infer<typeof Technique>;

export const techniqueScoresSchema = z.record(Technique, z.number());
export const strikeCountsSchema = z.object({
  jab: z.number().int().nonnegative(),
  cross: z.number().int().nonnegative(),
  hook: z.number().int().nonnegative(),
  kick: z.number().int().nonnegative(),
});
export const performanceMetricSchema = z.object({
  id: z.string(),
  fighterId: z.string().uuid(),
  weekStart: z.string().datetime(),
  scores: techniqueScoresSchema,
  strikeCounts: strikeCountsSchema,
  combinations: z.number().int().nonnegative(),
  sessionsCompleted: z.number().int().nonnegative(),
  trainingMinutes: z.number().nonnegative(),
  avgRpe: z.number().nonnegative(),
  avgPunchSpeed: z.number().nonnegative(),
  avgKickSpeed: z.number().nonnegative(),
  guardUptimePct: z.number().min(0).max(100),
  headMovementsPerMin: z.number().nonnegative(),
});
export type PerformanceMetric = z.infer<typeof performanceMetricSchema>;

export const performanceSummarySchema = z.object({
  latest: performanceMetricSchema,
  previous: performanceMetricSchema.nullable(),
  overall: z.number(),
  overallDelta: z.number(),
  deltas: techniqueScoresSchema,
  comparisonWeeks: z.number().int().nonnegative(),
  strongest: Technique,
  weakest: Technique,
  trend: z.enum(['improving', 'steady', 'declining']),
});

export const techniqueDetailSchema = z.object({
  technique: Technique,
  history: z.array(
    z.object({ weekStart: z.string().datetime(), score: z.number() }),
  ),
  latestScore: z.number(),
  change4w: z.number(),
  relatedCounts: z
    .array(z.object({ weekStart: z.string().datetime(), value: z.number() }))
    .nullable(),
  speedSeries: z
    .object({
      kind: z.enum(['punch', 'kick']),
      points: z.array(
        z.object({
          weekStart: z.string().datetime(),
          value: z.number().nullable(),
        }),
      ),
    })
    .nullable(),
  rateSeries: z
    .object({
      metric: z.enum(['guardUptimePct', 'headMovementsPerMin']),
      points: z.array(
        z.object({
          weekStart: z.string().datetime(),
          value: z.number().nullable(),
        }),
      ),
    })
    .nullable(),
  findings: z.array(z.unknown()),
});

export const teamPerformanceRowSchema = z.object({
  fighterId: z.string().uuid(),
  overall: z.number(),
  overallDelta: z.number(),
  scores: techniqueScoresSchema,
  trainingMinutes: z.number().nonnegative(),
  sessionsCompleted: z.number().int().nonnegative(),
  trend: z.enum(['improving', 'steady', 'declining']),
});

export const weeklyVolumeSchema = z.object({
  weekStart: z.string().datetime(),
  complete: z.boolean(),
  fighters: z.number().int().nonnegative(),
  sessionsCompleted: z.number().int().nonnegative(),
  trainingMinutes: z.number().nonnegative(),
  strikes: z.number().int().nonnegative(),
  combinations: z.number().int().nonnegative(),
  avgRpe: z.number().nonnegative(),
});

export const fighterPerformanceParamsSchema = z.strictObject({
  fighterId: z.string().uuid(),
});
export const techniqueParamsSchema = z.strictObject({
  fighterId: z.string().uuid(),
  technique: Technique,
});
export const DEFAULT_HISTORY_WEEKS = 12;
const weeksQuerySchema = z.coerce
  .number()
  .int()
  .min(1)
  .max(52)
  .default(DEFAULT_HISTORY_WEEKS);
export const historyQuerySchema = z.strictObject({ weeks: weeksQuerySchema });
const fighterIdsSchema = z.preprocess(
  (value) => (Array.isArray(value) ? value : value ? [value] : []),
  z.array(z.string().uuid()).min(1).max(100),
);
export const teamQuerySchema = z.strictObject({ fighterId: fighterIdsSchema });
export const weeklyVolumeQuerySchema = z.strictObject({
  fighterId: fighterIdsSchema,
  weeks: weeksQuerySchema,
});

export const PERFORMANCE_PERMISSIONS = { READ: 'performance:read' } as const;
export const WEEK_MS = 7 * 86_400_000;
