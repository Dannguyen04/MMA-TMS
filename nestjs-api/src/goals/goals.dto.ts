import { createZodDto } from 'nestjs-zod';
import {
  createGoalSchema,
  goalIdParamsSchema,
  goalPageSchema,
  goalProgressSchema,
  goalResponseSchema,
  listGoalsQuerySchema,
  updateGoalSchema,
} from './goals.model.js';

export class ListGoalsQueryDto extends createZodDto(listGoalsQuerySchema) {}
export class CreateGoalDto extends createZodDto(createGoalSchema) {}
export class UpdateGoalDto extends createZodDto(updateGoalSchema) {}
export class GoalProgressDto extends createZodDto(goalProgressSchema) {}
export class GoalIdParamsDto extends createZodDto(goalIdParamsSchema) {}

export class GoalResponseDto extends createZodDto(goalResponseSchema) {}
export class GoalPageResponseDto extends createZodDto(goalPageSchema) {}
