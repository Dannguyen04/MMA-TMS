import { z } from 'zod';
import {
  SessionType,
  TrainingPlanPhase,
  trainingPlanBaseSchema,
  trainingSessionBaseSchema,
} from '../training/training.model.js';
import { isoDateTimeSchema } from '../shared/utils/zod-schema.util.js';

export const createAssignmentBodySchema = z.strictObject({
  coachId: z.string().uuid(),
  fighterId: z.string().uuid(),
  title: trainingSessionBaseSchema.shape.title,
  planTitle: trainingPlanBaseSchema.shape.title.optional(),
  phase: TrainingPlanPhase,
  scheduledAt: isoDateTimeSchema.optional(),
  sessionType: SessionType.optional(),
});
export type CreateAssignmentInput = z.infer<typeof createAssignmentBodySchema>;
