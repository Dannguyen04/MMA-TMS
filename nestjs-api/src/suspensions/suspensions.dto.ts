import { createZodDto } from 'nestjs-zod';
import {
  clearSuspensionSchema,
  createSuspensionSchema,
  listSuspensionsQuerySchema,
  suspensionIdParamsSchema,
  suspensionListResponseSchema,
  suspensionResponseSchema,
} from './suspensions.model.js';

export class SuspensionIdParamsDto extends createZodDto(
  suspensionIdParamsSchema,
) {}
export class ListSuspensionsQueryDto extends createZodDto(
  listSuspensionsQuerySchema,
) {}
export class CreateSuspensionDto extends createZodDto(createSuspensionSchema) {}
export class ClearSuspensionDto extends createZodDto(clearSuspensionSchema) {}
export class SuspensionResponseDto extends createZodDto(
  suspensionResponseSchema,
) {}
export class SuspensionListResponseDto extends createZodDto(
  suspensionListResponseSchema,
) {}
