import { createZodDto } from 'nestjs-zod';
import {
  listPlansQuerySchema,
  listSessionsQuerySchema,
  listExercisesQuerySchema,
  createTrainingPlanSchema,
  updateTrainingPlanSchema,
  createSessionSchema,
  updateSessionSchema,
  createExerciseSchema,
  updateExerciseSchema,
  createPlanExerciseSchema,
  updatePlanExerciseSchema,
  updatePlanStatusSchema,
  updateSessionStatusSchema,
  trainingPlanIdParamsSchema,
  trainingPlanExerciseParamsSchema,
  trainingSessionIdParamsSchema,
  exerciseIdParamsSchema,
  trainingPlanResponseSchema,
  trainingSessionBaseSchema,
  exerciseBaseSchema,
  trainingPlanExerciseBaseSchema,
  removedPlanExerciseSchema,
  listFeedbackQuerySchema,
  createFeedbackSchema,
  coachFeedbackBaseSchema,
} from './training.model.js';

export class ListPlansQueryDto extends createZodDto(listPlansQuerySchema) {}
export class ListSessionsQueryDto extends createZodDto(
  listSessionsQuerySchema,
) {}
export class ListExercisesQueryDto extends createZodDto(
  listExercisesQuerySchema,
) {}
export class ListFeedbackQueryDto extends createZodDto(
  listFeedbackQuerySchema,
) {}

export class CreateTrainingPlanDto extends createZodDto(
  createTrainingPlanSchema,
) {}
export class UpdateTrainingPlanDto extends createZodDto(
  updateTrainingPlanSchema,
) {}

export class CreateSessionDto extends createZodDto(createSessionSchema) {}
export class UpdateSessionDto extends createZodDto(updateSessionSchema) {}

export class CreateExerciseDto extends createZodDto(createExerciseSchema) {}
export class UpdateExerciseDto extends createZodDto(updateExerciseSchema) {}
export class CreateFeedbackDto extends createZodDto(createFeedbackSchema) {}

export class CreatePlanExerciseDto extends createZodDto(
  createPlanExerciseSchema,
) {}
export class UpdatePlanExerciseDto extends createZodDto(
  updatePlanExerciseSchema,
) {}

export class UpdatePlanStatusDto extends createZodDto(updatePlanStatusSchema) {}
export class UpdateSessionStatusDto extends createZodDto(
  updateSessionStatusSchema,
) {}

export class TrainingPlanIdParamsDto extends createZodDto(
  trainingPlanIdParamsSchema,
) {}
export class TrainingPlanExerciseParamsDto extends createZodDto(
  trainingPlanExerciseParamsSchema,
) {}
export class TrainingSessionIdParamsDto extends createZodDto(
  trainingSessionIdParamsSchema,
) {}
export class ExerciseIdParamsDto extends createZodDto(exerciseIdParamsSchema) {}

export class TrainingPlanResponseDto extends createZodDto(
  trainingPlanResponseSchema,
) {}
export class TrainingSessionResponseDto extends createZodDto(
  trainingSessionBaseSchema,
) {}
export class ExerciseResponseDto extends createZodDto(exerciseBaseSchema) {}
export class TrainingPlanExerciseResponseDto extends createZodDto(
  trainingPlanExerciseBaseSchema,
) {}
export class RemovedPlanExerciseDto extends createZodDto(
  removedPlanExerciseSchema,
) {}
export class CoachFeedbackResponseDto extends createZodDto(
  coachFeedbackBaseSchema,
) {}
