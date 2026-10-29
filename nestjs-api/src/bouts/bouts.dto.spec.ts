import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { NextRoundPlanDto, RoundAdviceDto, RoundInputDto, RoundResponseDto, RoundsResponseDto } from './bouts.dto.js';
import { appZodValidationPipe } from '../shared/pipes/zod-validation.pipe.js';

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
