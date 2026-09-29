import { describe, expect, it, vi } from 'vitest';
import { BadGatewayException } from '@nestjs/common';
import { JobsService } from './jobs.service.js';

function service() {
  return new JobsService(
    { add: vi.fn() } as never,
    {} as never,
    {} as never,
    {
      get: vi.fn((_key: string, fallback?: unknown) => fallback),
      getOrThrow: vi.fn(() => 'https://project.supabase.co'),
    } as never,
    {} as never,
    {} as never,
  );
}

describe('JobsService result trust boundary', () => {
  it('accepts only the configured Supabase result bucket', () => {
    const jobs = service() as unknown as {
      resultStorageKey(value: string): string;
    };
    expect(
      jobs.resultStorageKey(
        'https://project.supabase.co/storage/v1/object/public/analysis-results/results/job/result.json',
      ),
    ).toBe('results/job/result.json');
  });

  it.each([
    'https://evil.example/storage/v1/object/public/analysis-results/results/job/result.json',
    'https://project.supabase.co/storage/v1/object/public/videos/result.json',
    'https://project.supabase.co/storage/v1/object/public/analysis-results/../secrets.json',
    'local://result.json',
  ])('rejects an untrusted result location: %s', (url) => {
    const jobs = service() as unknown as {
      resultStorageKey(value: string): string;
    };
    expect(() => jobs.resultStorageKey(url)).toThrow(BadGatewayException);
  });
});
