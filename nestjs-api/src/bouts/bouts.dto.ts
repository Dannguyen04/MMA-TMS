import { createZodDto } from 'nestjs-zod';
import {
  boutDetailResponseSchema,
  boutIdParamsSchema,
  boutListResponseSchema,
  boutSummarySchema,
  cancelBoutSchema,
  createBoutResponseSchema,
  createBoutSchema,
  createRequirementSchema,
  feasibilityQuerySchema,
  feasibilityResponseSchema,
  listBoutsQuerySchema,
  requirementMutationResponseSchema,
  requirementParamsSchema,
  requirementRemovalResponseSchema,
  rulesetResponseSchema,
  startCampSchema,
  catchweightSchema,
  recordResultSchema,
  removeRequirementQuerySchema,
  updateBoutSchema,
  updateRequirementSchema,
  weighInResponseSchema,
  weighInSchema,
  weightTrackResponseSchema,
} from './bouts.model.js';

export class BoutIdParamsDto extends createZodDto(boutIdParamsSchema) {}
export class RequirementParamsDto extends createZodDto(requirementParamsSchema) {}
export class ListBoutsQueryDto extends createZodDto(listBoutsQuerySchema) {}
export class CreateBoutDto extends createZodDto(createBoutSchema) {}
export class CreateBoutResponseDto extends createZodDto(createBoutResponseSchema) {}
export class FeasibilityQueryDto extends createZodDto(feasibilityQuerySchema) {}
export class FeasibilityResponseDto extends createZodDto(feasibilityResponseSchema) {}
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

export class RemoveRequirementQueryDto extends createZodDto(removeRequirementQuerySchema) {}
export class WeighInDto extends createZodDto(weighInSchema) {}
export class CatchweightDto extends createZodDto(catchweightSchema) {}
export class RecordResultDto extends createZodDto(recordResultSchema) {}
export class WeighInResponseDto extends createZodDto(weighInResponseSchema) {}
import {
  opponentAnalysisInputSchema, opponentReviewInputSchema, roundInputSchema, roundParamsSchema,
  priorContextQuerySchema, cornerCardSchema, roundsResponseSchema, roundResponseSchema,
  priorContextResponseSchema, opponentAnalysisSchema,
} from './bout-analysis.model.js';
import { z } from 'zod';
export class OpponentAnalysisDto extends createZodDto(opponentAnalysisInputSchema) {}
export class OpponentReviewDto extends createZodDto(opponentReviewInputSchema) {}
export class RoundInputDto extends createZodDto(roundInputSchema) {}
export class RoundParamsDto extends createZodDto(roundParamsSchema) {}
export class PriorContextQueryDto extends createZodDto(priorContextQuerySchema) {}
export class CornerCardResponseDto extends createZodDto(cornerCardSchema) {}
export class RoundsResponseDto extends createZodDto(roundsResponseSchema) {}
export class RoundResponseDto extends createZodDto(roundResponseSchema) {}
export class PriorContextResponseDto extends createZodDto(priorContextResponseSchema) {}
export class AnalysisMutationResponseDto extends createZodDto(z.object({
  opponentAnalysis: opponentAnalysisSchema, tacticsWithoutSessions: z.array(z.string()),
})) {}
