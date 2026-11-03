import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { NextRoundPlanDto, RoundAdviceDto, RoundInputDto, RoundResponseDto, RoundsResponseDto } from './bouts.dto.js';
import { appZodValidationPipe } from '../shared/pipes/zod-validation.pipe.js';
import { AiVideoInputDto, AiDecisionDto, AiSuggestionParamsDto, AiHistoryQueryDto, AiResponseDto, AiHistoryResponseDto } from './bouts.dto.js';

describe('T-038 Swagger and DTO contracts', () => {
  it('converts all new DTOs to JSON Schema for app startup', () => {
    for (const dto of [AiVideoInputDto, AiDecisionDto, AiSuggestionParamsDto, AiHistoryQueryDto, AiResponseDto, AiHistoryResponseDto])
      expect(() => z.toJSONSchema(dto.schema)).not.toThrow();
  });
  it('rejects malformed inputs through the API validation pipe', async () => {
    for (const [metatype, data] of [[AiVideoInputDto, { url: 'https://evil.test', who: 'góc đỏ' }], [AiDecisionDto, { decision: 'OTHER', acceptedItemIds: [] }], [AiHistoryQueryDto, { kind: 'OTHER' }]] as const)
      await expect(Promise.resolve().then(() => appZodValidationPipe.transform(data, { type: 'body', metatype }))).rejects.toMatchObject({ status: 422 });
  });
});

describe('T-037 Swagger and DTO contracts', () => {
  it('converts every changed DTO to JSON Schema with the new fields', () => {
    for (const dto of [NextRoundPlanDto, RoundAdviceDto, RoundInputDto, RoundResponseDto, RoundsResponseDto])
      expect(() => z.toJSONSchema(dto.schema)).not.toThrow();
    const input = z.toJSONSchema(RoundInputDto.schema);
    expect(input.properties).toHaveProperty('nextRoundPlan');
    const response = JSON.stringify(z.toJSONSchema(RoundsResponseDto.schema));
    for (const field of ['nextRoundPlan', 'nextRound', 'focus', 'addedRound', 'suggested'])
      expect(response).toContain('"' + field + '"');
  });
  it.each(['CUSTOM', 'USE_TACTIC', 'STOP_TACTIC', 'RECHECK_OPPONENT'])('returns 422 for %s missing its required content', async (code) => {
    await expect(Promise.resolve().then(() => appZodValidationPipe.transform(
      { nextRoundPlan: { instructions: [{ code }] } },
      { type: 'body', metatype: RoundInputDto },
    ))).rejects.toMatchObject({ status: 422 });
  });
});
