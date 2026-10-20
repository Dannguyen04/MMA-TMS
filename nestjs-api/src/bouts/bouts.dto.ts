import { createZodDto } from 'nestjs-zod';
import {
  boutDetailResponseSchema,
  boutIdParamsSchema,
  boutListResponseSchema,
  boutSummarySchema,
  cancelBoutSchema,
  createBoutSchema,
  createRequirementSchema,
  listBoutsQuerySchema,
  requirementMutationResponseSchema,
  requirementParamsSchema,
  requirementRemovalResponseSchema,
  rulesetResponseSchema,
  startCampSchema,
  updateBoutSchema,
  updateRequirementSchema,
  weightTrackResponseSchema,
} from './bouts.model.js';

export class BoutIdParamsDto extends createZodDto(boutIdParamsSchema) {}
export class RequirementParamsDto extends createZodDto(requirementParamsSchema) {}
export class ListBoutsQueryDto extends createZodDto(listBoutsQuerySchema) {}
export class CreateBoutDto extends createZodDto(createBoutSchema) {}
export class UpdateBoutDto extends createZodDto(updateBoutSchema) {}
export class StartCampDto extends createZodDto(startCampSchema) {}
export class CancelBoutDto extends createZodDto(cancelBoutSchema) {}
export class CreateRequirementDto extends createZodDto(createRequirementSchema) {}
export class UpdateRequirementDto extends createZodDto(updateRequirementSchema) {}

export class RulesetResponseDto extends createZodDto(rulesetResponseSchema) {}
export class BoutSummaryDto extends createZodDto(boutSummarySchema) {}
export class BoutListResponseDto extends createZodDto(boutListResponseSchema) {}
export class BoutDetailResponseDto extends createZodDto(boutDetailResponseSchema) {}
export class WeightTrackResponseDto extends createZodDto(weightTrackResponseSchema) {}
export class RequirementMutationResponseDto extends createZodDto(
  requirementMutationResponseSchema,
) {}
export class RequirementRemovalResponseDto extends createZodDto(
  requirementRemovalResponseSchema,
) {}
