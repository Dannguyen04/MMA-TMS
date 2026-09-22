import { z } from 'zod';
import {
  dateOnlySchema,
  isoDateTimeSchema,
  trimmedTextSchema,
  nullableTrimmedTextSchema,
} from '../shared/utils/zod-schema.util.js';

// --- Enums ---
export const TrainingPlanStatus = z.enum([
  'DRAFT',
  'ACTIVE',
  'COMPLETED',
  'CANCELLED',
]);
export type TrainingPlanStatusType = z.infer<typeof TrainingPlanStatus>;

export const SessionType = z.enum([
  'SHADOW_BOXING',
  'PAD_WORK',
  'HEAVY_BAG',
  'SPARRING',
  'GRAPPLING',
  'STRENGTH_CONDITIONING',
  'RECOVERY',
  'PHYSICAL_THERAPY',
]);

export const SessionStatus = z.enum([
  'SCHEDULED',
  'IN_PROGRESS',
  'COMPLETED',
  'SKIPPED',
  'CANCELLED',
  'ABANDONED',
]);
export type SessionStatusType = z.infer<typeof SessionStatus>;

export const ExerciseCategory = z.enum([
  'STRIKING',
  'GRAPPLING',
  'STRENGTH_CONDITIONING',
  'RECOVERY',
]);

// --- Milestone Schema ---
export const milestoneSchema = z
  .object({
    id: z.string().uuid().optional(),
    title: trimmedTextSchema(255),
    isCompleted: z.boolean().default(false),
    completedAt: isoDateTimeSchema.optional(),
    notes: nullableTrimmedTextSchema(500).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.isCompleted && !data.completedAt) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'completedAt is required when isCompleted is true',
        path: ['completedAt'],
      });
    }
    if (!data.isCompleted && data.completedAt) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'completedAt must be empty when isCompleted is false',
        path: ['completedAt'],
      });
    }
  });
export type Milestone = z.infer<typeof milestoneSchema>;

// --- Progress Metrics ---
export const progressMetricsSchema = z.object({
  totalSessions: z.number().int().nonnegative(),
  completedSessions: z.number().int().nonnegative(),
  completionPercentage: z.number().min(0).max(100),
});
export type ProgressMetrics = z.infer<typeof progressMetricsSchema>;

// --- Entities / Base Schemas ---

export const trainingPlanBaseSchema = z.object({
  id: z.string().uuid(),
  fighterId: z.string().uuid(),
  coachId: z.string().uuid(),
  title: trimmedTextSchema(255),
  description: nullableTrimmedTextSchema(1000),
  startDate: dateOnlySchema,
  endDate: dateOnlySchema.nullable(),
  status: TrainingPlanStatus,
  goals: nullableTrimmedTextSchema(1000),
  milestones: z.array(milestoneSchema),
  isActive: z.boolean(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
  deletedAt: isoDateTimeSchema.nullable(),
});
export type TrainingPlanEntity = z.infer<typeof trainingPlanBaseSchema>;

export const trainingSessionBaseSchema = z.object({
  id: z.string().uuid(),
  fighterId: z.string().uuid(),
  coachId: z.string().uuid().nullable(),
  planId: z.string().uuid().nullable(),
  title: trimmedTextSchema(255),
  scheduledAt: isoDateTimeSchema,
  plannedDurationSec: z.number().int().positive().nullable(),
  actualDurationSec: z.number().int().positive().nullable(),
  roundCount: z.number().int().nonnegative(),
  location: nullableTrimmedTextSchema(255),
  sessionType: SessionType,
  status: SessionStatus,
  coachNotes: nullableTrimmedTextSchema(1000),
  cancellationReason: nullableTrimmedTextSchema(500),
  checkedInAt: isoDateTimeSchema.nullable(),
  completedAt: isoDateTimeSchema.nullable(),
  abandonedAt: isoDateTimeSchema.nullable(),
  skippedAt: isoDateTimeSchema.nullable(),
  reportedRpe: z.number().int().min(1).max(10).nullable(),
  isActive: z.boolean(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
  deletedAt: isoDateTimeSchema.nullable(),
  cancelledAt: isoDateTimeSchema.nullable(),
});
export type TrainingSessionEntity = z.infer<typeof trainingSessionBaseSchema>;

export const exerciseBaseSchema = z.object({
  id: z.string().uuid(),
  name: trimmedTextSchema(255),
  description: nullableTrimmedTextSchema(1000),
  category: ExerciseCategory,
  targetMuscleGroups: z.array(z.string()),
  videoUrl: nullableTrimmedTextSchema(1000),
  thumbnailUrl: nullableTrimmedTextSchema(1000),
  isActive: z.boolean(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
  deletedAt: isoDateTimeSchema.nullable(),
});
export type ExerciseEntity = z.infer<typeof exerciseBaseSchema>;

export const trainingPlanExerciseBaseSchema = z.object({
  id: z.string().uuid(),
  planId: z.string().uuid(),
  exerciseId: z.string().uuid(),
  orderIndex: z.number().int().nonnegative(),
  sets: z.number().int().positive().nullable(),
  reps: z.number().int().positive().nullable(),
  durationSeconds: z.number().int().positive().nullable(),
  targetRpe: z.number().int().min(1).max(10).nullable(),
  coachNotes: nullableTrimmedTextSchema(500),
  createdAt: isoDateTimeSchema,
});
export type TrainingPlanExerciseEntity = z.infer<
  typeof trainingPlanExerciseBaseSchema
>;

export const FeedbackKind = z.enum(['PRAISE', 'CORRECTION', 'NOTE']);
export const FeedbackTechnique = z.enum([
  'jab',
  'cross',
  'hook',
  'kick',
  'combination',
  'footwork',
  'guard',
  'head_movement',
]);
export const coachFeedbackBaseSchema = z.object({
  id: z.string().uuid(),
  fighterId: z.string().uuid(),
  coachId: z.string().uuid(),
  sessionId: z.string().uuid().nullable(),
  videoId: z.string().uuid().nullable(),
  kind: FeedbackKind,
  body: trimmedTextSchema(1000),
  techniques: z.array(FeedbackTechnique),
  createdAt: isoDateTimeSchema,
});
export type CoachFeedbackEntity = z.infer<typeof coachFeedbackBaseSchema>;

// --- Request / Response Schemas ---

const paginationSchema = {
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
};

export const listPlansQuerySchema = z.strictObject({
  ...paginationSchema,
  fighterId: z.string().uuid().optional(),
  coachId: z.string().uuid().optional(),
  status: TrainingPlanStatus.optional(),
  isActive: z
    .preprocess(
      (value) => (value === 'true' ? true : value === 'false' ? false : value),
      z.boolean(),
    )
    .optional(),
});
export type ListPlansQuery = z.infer<typeof listPlansQuerySchema>;

export const listSessionsQuerySchema = z.strictObject({
  ...paginationSchema,
  fighterId: z.string().uuid().optional(),
  coachId: z.string().uuid().optional(),
  planId: z.string().uuid().optional(),
  status: SessionStatus.optional(),
  sessionType: SessionType.optional(),
  fromDate: isoDateTimeSchema.optional(),
  toDate: isoDateTimeSchema.optional(),
});
export type ListSessionsQuery = z.infer<typeof listSessionsQuerySchema>;

export const listExercisesQuerySchema = z.strictObject({
  ...paginationSchema,
  category: ExerciseCategory.optional(),
  targetMuscle: trimmedTextSchema(100).optional(),
  search: trimmedTextSchema(100).optional(),
});
export type ListExercisesQuery = z.infer<typeof listExercisesQuerySchema>;

export const listFeedbackQuerySchema = z.strictObject({
  ...paginationSchema,
  fighterId: z.string().uuid().optional(),
  coachId: z.string().uuid().optional(),
  sessionId: z.string().uuid().optional(),
  videoId: z.string().uuid().optional(),
  kind: FeedbackKind.optional(),
});
export type ListFeedbackQuery = z.infer<typeof listFeedbackQuerySchema>;

export const createFeedbackSchema = coachFeedbackBaseSchema
  .pick({
    fighterId: true,
    sessionId: true,
    videoId: true,
    kind: true,
    body: true,
    techniques: true,
  })
  .strict()
  .refine((value) => value.sessionId === null || value.videoId === null, {
    message: 'Feedback can reference either a session or a video, not both.',
  });
export type CreateFeedbackInput = z.infer<typeof createFeedbackSchema>;
export type CreateFeedbackRecordInput = CreateFeedbackInput & {
  coachId: string;
};

export const createTrainingPlanSchema = trainingPlanBaseSchema
  .pick({
    fighterId: true,
    coachId: true,
    title: true,
    startDate: true,
  })
  .extend({
    description: nullableTrimmedTextSchema(1000).optional(),
    endDate: dateOnlySchema.nullable().optional(),
    goals: nullableTrimmedTextSchema(1000).optional(),
    milestones: z.array(milestoneSchema).default([]),
  })
  .strict();
export type CreatePlanInput = z.infer<typeof createTrainingPlanSchema>;

export const updateTrainingPlanSchema = trainingPlanBaseSchema
  .pick({
    title: true,
    description: true,
    startDate: true,
    endDate: true,
    goals: true,
    milestones: true,
    isActive: true,
  })
  .partial()
  .strict()
  .refine((data) => Object.keys(data).length > 0, 'No fields to update');
export type UpdatePlanInput = z.infer<typeof updateTrainingPlanSchema>;

export const trainingPlanResponseSchema = trainingPlanBaseSchema.extend({
  progress: progressMetricsSchema.optional(),
});

export const trainingPlanIdParamsSchema = z.strictObject({
  id: z.string().uuid(),
});

export const trainingPlanExerciseParamsSchema = z.strictObject({
  id: z.string().uuid(),
  exerciseId: z.string().uuid(),
});

export const trainingSessionIdParamsSchema = z.strictObject({
  id: z.string().uuid(),
});

export const exerciseIdParamsSchema = z.strictObject({
  id: z.string().uuid(),
});

export const createSessionSchema = trainingSessionBaseSchema
  .pick({
    fighterId: true,
    title: true,
    scheduledAt: true,
    sessionType: true,
  })
  .extend({
    coachId: z.string().uuid().nullable().optional(),
    planId: z.string().uuid().nullable().optional(),
    plannedDurationSec: z.number().int().positive().nullable().optional(),
    roundCount: z.number().int().nonnegative().default(0),
    location: nullableTrimmedTextSchema(255).optional(),
    coachNotes: nullableTrimmedTextSchema(1000).optional(),
  })
  .strict();
export type CreateSessionInput = z.infer<typeof createSessionSchema>;

export const updateSessionSchema = trainingSessionBaseSchema
  .pick({
    title: true,
    scheduledAt: true,
    plannedDurationSec: true,
    actualDurationSec: true,
    roundCount: true,
    location: true,
    sessionType: true,
    coachNotes: true,
    cancellationReason: true,
    reportedRpe: true,
  })
  .partial()
  .strict()
  .refine((data) => Object.keys(data).length > 0, 'No fields to update');
export type UpdateSessionInput = z.infer<typeof updateSessionSchema>;

export const createExerciseSchema = exerciseBaseSchema
  .pick({
    name: true,
    category: true,
  })
  .extend({
    description: nullableTrimmedTextSchema(1000).optional(),
    targetMuscleGroups: z.array(z.string()).default([]),
    videoUrl: nullableTrimmedTextSchema(1000).optional(),
    thumbnailUrl: nullableTrimmedTextSchema(1000).optional(),
  })
  .strict();
export type CreateExerciseInput = z.infer<typeof createExerciseSchema>;

export const updateExerciseSchema = exerciseBaseSchema
  .pick({
    name: true,
    description: true,
    category: true,
    targetMuscleGroups: true,
    videoUrl: true,
    thumbnailUrl: true,
  })
  .partial()
  .strict()
  .refine((data) => Object.keys(data).length > 0, 'No fields to update');
export type UpdateExerciseInput = z.infer<typeof updateExerciseSchema>;

export const createPlanExerciseSchema = trainingPlanExerciseBaseSchema
  .pick({
    exerciseId: true,
    orderIndex: true,
  })
  .extend({
    sets: z.number().int().positive().nullable().optional(),
    reps: z.number().int().positive().nullable().optional(),
    durationSeconds: z.number().int().positive().nullable().optional(),
    targetRpe: z.number().int().min(1).max(10).nullable().optional(),
    coachNotes: nullableTrimmedTextSchema(500).optional(),
  })
  .strict();
export type CreatePlanExerciseInput = z.infer<typeof createPlanExerciseSchema>;
export type CreatePlanExerciseRecordInput = CreatePlanExerciseInput & {
  planId: string;
};

export const updatePlanExerciseSchema = createPlanExerciseSchema
  .omit({ exerciseId: true })
  .partial()
  .refine((data) => Object.keys(data).length > 0, 'No fields to update');
export type UpdatePlanExerciseInput = z.infer<typeof updatePlanExerciseSchema>;

export const removedPlanExerciseSchema = z.strictObject({
  id: z.string().uuid(),
});

export const TRAINING_PERMISSIONS = {
  PLAN_GET_ALL: 'training.plan:get_all',
  PLAN_READ: 'training.plan:read',
  PLAN_CREATE: 'training.plan:create',
  PLAN_UPDATE: 'training.plan:update',
  PLAN_TRANSITION: 'training.plan:transition',
  PLAN_EXERCISE_READ: 'training.plan_exercise:read',
  PLAN_EXERCISE_CREATE: 'training.plan_exercise:create',
  PLAN_EXERCISE_UPDATE: 'training.plan_exercise:update',
  PLAN_EXERCISE_DELETE: 'training.plan_exercise:delete',
  SESSION_GET_ALL: 'training.session:get_all',
  SESSION_READ: 'training.session:read',
  SESSION_CREATE: 'training.session:create',
  SESSION_UPDATE: 'training.session:update',
  SESSION_TRANSITION: 'training.session:transition',
  EXERCISE_GET_ALL: 'training.exercise:get_all',
  EXERCISE_READ: 'training.exercise:read',
  EXERCISE_CREATE: 'training.exercise:create',
  EXERCISE_UPDATE: 'training.exercise:update',
  FEEDBACK_GET_ALL: 'training.feedback:get_all',
  FEEDBACK_CREATE: 'training.feedback:create',
} as const;

export const updatePlanStatusSchema = z.strictObject({
  status: TrainingPlanStatus,
});
export const updateSessionStatusSchema = z.strictObject({
  status: SessionStatus,
});
