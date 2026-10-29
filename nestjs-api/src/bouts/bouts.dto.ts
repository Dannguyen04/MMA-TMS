import { createZodDto } from 'nestjs-zod';
import { aiDecisionSchema, aiVideoInputSchema, aiSuggestionParamsSchema, aiHistoryQuerySchema, aiResponseSchema, aiHistoryResponseSchema } from './bout-analysis.model.js';
export class AiVideoInputDto extends createZodDto(aiVideoInputSchema) {}
export class AiDecisionDto extends createZodDto(aiDecisionSchema) {}
export class AiSuggestionParamsDto extends createZodDto(aiSuggestionParamsSchema) {}
export class AiHistoryQueryDto extends createZodDto(aiHistoryQuerySchema) {}
export class AiResponseDto extends createZodDto(aiResponseSchema) {}
export class AiHistoryResponseDto extends createZodDto(aiHistoryResponseSchema) {}
import { coachTodoResponseSchema } from './bouts-todo.model.js';
import {
  boutDetailResponseSchema,
  acuteLossResponseSchema,
  boutSummarySchema as resultSourceSchema,
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
  readinessQuerySchema,
  readinessRowSchema,
  readinessSuspensionSchema,
  requirementMutationResponseSchema,
  requirementParamsSchema,
  requirementRemovalResponseSchema,
  rulesetResponseSchema,
  startCampSchema,
  catchweightSchema,
  recordResultResponseSchema,
  recordResultSchema,
  recordResultSuspensionSchema,
  removeRequirementQuerySchema,
  updateBoutSchema,
  updateRequirementSchema,
  weighInResponseSchema,
  weighInSchema,
  weightTrackResponseSchema,
} from './bouts.model.js';

export class BoutIdParamsDto extends createZodDto(boutIdParamsSchema) {}
export class RequirementParamsDto extends createZodDto(
  requirementParamsSchema,
) {}
export class ListBoutsQueryDto extends createZodDto(listBoutsQuerySchema) {}
export class CoachTodoResponseDto extends createZodDto(coachTodoResponseSchema) {}
export class CreateBoutDto extends createZodDto(createBoutSchema) {}
export class CreateBoutResponseDto extends createZodDto(createBoutResponseSchema) {}
export class FeasibilityQueryDto extends createZodDto(feasibilityQuerySchema) {}
export class FeasibilityResponseDto extends createZodDto(feasibilityResponseSchema) {}
export class ReadinessQueryDto extends createZodDto(readinessQuerySchema) {}
export class ReadinessSuspensionDto extends createZodDto(
  readinessSuspensionSchema,
) {}
export class ReadinessRowDto extends createZodDto(readinessRowSchema) {}
export class UpdateBoutDto extends createZodDto(updateBoutSchema) {}
export class StartCampDto extends createZodDto(startCampSchema) {}
export class CancelBoutDto extends createZodDto(cancelBoutSchema) {}
export class CreateRequirementDto extends createZodDto(
  createRequirementSchema,
) {}
export class UpdateRequirementDto extends createZodDto(
  updateRequirementSchema,
) {}

export class RulesetResponseDto extends createZodDto(rulesetResponseSchema) {}
export class BoutSummaryDto extends createZodDto(boutSummarySchema) {}
export class BoutListResponseDto extends createZodDto(boutListResponseSchema) {}
export class BoutDetailResponseDto extends createZodDto(
  boutDetailResponseSchema,
) {}
export class WeightTrackResponseDto extends createZodDto(
  weightTrackResponseSchema,
) {}
export class RequirementMutationResponseDto extends createZodDto(
  requirementMutationResponseSchema,
) {}
export class RequirementRemovalResponseDto extends createZodDto(
  requirementRemovalResponseSchema,
) {}

export class RemoveRequirementQueryDto extends createZodDto(
  removeRequirementQuerySchema,
) {}
export class WeighInDto extends createZodDto(weighInSchema) {}
export class CatchweightDto extends createZodDto(catchweightSchema) {}
export class RecordResultDto extends createZodDto(recordResultSchema) {}
export class RecordResultSuspensionDto extends createZodDto(
  recordResultSuspensionSchema,
) {}
export class WeighInResponseDto extends createZodDto(weighInResponseSchema) {}
export class RecordResultResponseDto extends createZodDto(
  recordResultResponseSchema,
) {}
import {
  opponentAnalysisInputSchema,
  opponentReviewInputSchema,
  nextRoundPlanSchema,
  roundAdviceSchema,
  roundInputSchema,
  roundParamsSchema,
  priorContextQuerySchema,
  cornerCardSchema,
  roundsResponseSchema,
  roundResponseSchema,
  priorContextResponseSchema,
  opponentAnalysisSchema,
  improvementPointSchema,
  analysisIdSchema,
  tacticOutcomeSchema,
  tacticReviewSchema,
} from './bout-analysis.model.js';
import { z } from 'zod';
export class OpponentAnalysisDto extends createZodDto(
  opponentAnalysisInputSchema,
) {}
export class OpponentReviewDto extends createZodDto(
  opponentReviewInputSchema,
) {}
export class NextRoundPlanDto extends createZodDto(nextRoundPlanSchema) {}
export class RoundAdviceDto extends createZodDto(roundAdviceSchema) {}
export class RoundInputDto extends createZodDto(roundInputSchema) {}
export class RoundParamsDto extends createZodDto(roundParamsSchema) {}
export class PriorContextQueryDto extends createZodDto(
  priorContextQuerySchema,
) {}
export class CornerCardResponseDto extends createZodDto(cornerCardSchema) {}
export class RoundsResponseDto extends createZodDto(roundsResponseSchema) {}
export class RoundResponseDto extends createZodDto(roundResponseSchema) {}
export class PriorContextResponseDto extends createZodDto(
  priorContextResponseSchema,
) {}
export class AnalysisMutationResponseDto extends createZodDto(
  z.object({
    opponentAnalysis: opponentAnalysisSchema,
    tacticsWithoutSessions: z.array(z.string()),
  }),
) {}

export class BoutReportResponseDto extends createZodDto(
  z.object({
    result: resultSourceSchema.pick({
      result: true,
      method: true,
      resultRound: true,
      knockedDown: true,
    }),
    tactics: z.array(
      z.object({
        id: analysisIdSchema,
        text: z.string(),
        effectiveRounds: z.number().int().nonnegative(),
        ineffectiveRounds: z.number().int().nonnegative(),
        outcome: tacticOutcomeSchema.nullable(),
        review: tacticReviewSchema.nullable(),
      }),
    ),
    observations: z.array(
      z.object({
        id: analysisIdSchema,
        text: z.string(),
        notSeenInBout: z.boolean(),
      }),
    ),
    acuteLoss: acuteLossResponseSchema.nullable(),
    improvementPoints: z.array(improvementPointSchema),
    roundsRecorded: z.number().int().nonnegative(),
  }),
) {}
export class ResultPrefillResponseDto extends createZodDto(
  z.object({
    resultRound: z.number().int().min(1).max(12).nullable(),
    knockedDown: z.boolean().nullable(),
  }),
) {}
