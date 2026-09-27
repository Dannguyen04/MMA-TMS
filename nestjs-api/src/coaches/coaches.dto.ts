import { createZodDto } from 'nestjs-zod';
import { PublicFighterDto } from '../fighters/fighters.dto.js';
import {
  coachIdParamsSchema,
  listCoachFightersQuerySchema,
} from './coaches.model.js';

export class CoachIdParamsDto extends createZodDto(coachIdParamsSchema) {}

export class ListCoachFightersQueryDto extends createZodDto(
  listCoachFightersQuerySchema,
) {}

export { PublicFighterDto };
