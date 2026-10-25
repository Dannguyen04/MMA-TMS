import { createZodDto } from 'nestjs-zod';
import {
  academySettingsResponseSchema,
  updateAcademySettingsSchema,
} from './academy-settings.model.js';

export class AcademySettingsResponseDto extends createZodDto(
  academySettingsResponseSchema,
) {}

export class UpdateAcademySettingsDto extends createZodDto(
  updateAcademySettingsSchema,
) {}
