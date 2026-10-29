import { createZodDto } from 'nestjs-zod';
import {
  affectedPlanSchema,
  affectedSessionSchema,
  applySuspensionConflictsSchema,
  clearSuspensionSchema,
  conflictProposalResponseSchema,
  createSuspensionResponseSchema,
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
export class AffectedSessionDto extends createZodDto(affectedSessionSchema) {}
export class AffectedPlanDto extends createZodDto(affectedPlanSchema) {}
export class SuspensionResponseDto extends createZodDto(
  suspensionResponseSchema,
) {}
export class CreateSuspensionResponseDto extends createZodDto(
  createSuspensionResponseSchema,
) {}
export class SuspensionListResponseDto extends createZodDto(
  suspensionListResponseSchema,
) {}
export class ApplySuspensionConflictsDto extends createZodDto(
  applySuspensionConflictsSchema,
) {}
export class ConflictProposalResponseDto extends createZodDto(
  conflictProposalResponseSchema,
) {}
