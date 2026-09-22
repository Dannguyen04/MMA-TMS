import { createZodDto } from 'nestjs-zod';
import {
  createGoalSchema,
  goalPageSchema,
  goalParamsSchema,
  goalProgressSchema,
  goalResponseSchema,
  listGoalsQuerySchema,
  updateGoalSchema,
} from './goals.model.js';

export class ListGoalsQueryDto extends createZodDto(listGoalsQuerySchema) {}
export class GoalParamsDto extends createZodDto(goalParamsSchema) {}
export class CreateGoalDto extends createZodDto(createGoalSchema) {}
export class UpdateGoalDto extends createZodDto(updateGoalSchema) {}
export class GoalProgressDto extends createZodDto(goalProgressSchema) {}
export class GoalResponseDto extends createZodDto(goalResponseSchema) {}
export class GoalPageDto extends createZodDto(goalPageSchema) {}
