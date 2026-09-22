import { describe, expect, it } from 'vitest';
import { workerAnalysisResultSchema } from './jobs.model.js';

describe('workerAnalysisResultSchema', () => {
  it('accepts the versioned worker result envelope', () => {
    expect(
      workerAnalysisResultSchema.safeParse({
        schemaVersion: '1.0.0',
        meta: { durationMs: 1_000 },
        frames: [],
        summary: { bestScore: 82 },
      }).success,
    ).toBe(true);
  });

  it('rejects a result without frame data', () => {
    expect(
      workerAnalysisResultSchema.safeParse({
        schemaVersion: '1.0.0',
        meta: {},
        summary: {},
      }).success,
    ).toBe(false);
  });
});
