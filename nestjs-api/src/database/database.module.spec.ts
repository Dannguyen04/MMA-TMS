import type { ConfigService } from '@nestjs/config';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createDatabasePool,
  databasePoolMax,
  DEFAULT_DATABASE_POOL_MAX,
  watchPoolWaits,
} from './database.module.js';

function config(values: Record<string, string | undefined>): ConfigService {
  return { get: (key: string) => values[key] } as unknown as ConfigService;
}

describe('databasePoolMax', () => {
  it('defaults to 20', () => {
    expect(DEFAULT_DATABASE_POOL_MAX).toBe(20);
    expect(databasePoolMax(undefined)).toBe(20);
    expect(databasePoolMax('  ')).toBe(20);
  });

  it.each(['10', '30'])('reads DATABASE_POOL_MAX=%s', (raw) => {
    expect(databasePoolMax(raw)).toBe(Number(raw));
  });

  it.each(['0', '-5', '2.5', 'many'])('rejects DATABASE_POOL_MAX=%s', (raw) => {
    expect(() => databasePoolMax(raw)).toThrow('DATABASE_POOL_MAX');
  });
});

describe('createDatabasePool', () => {
  const url = 'postgresql://user:pass@localhost:5432/db';

  it.each([
    [undefined, 20],
    ['10', 10],
    ['30', 30],
  ])('sizes the pool from DATABASE_POOL_MAX=%s', async (raw, expected) => {
    const pool = createDatabasePool(
      config({ DATABASE_URL: url, DATABASE_POOL_MAX: raw }),
    );
    try {
      expect(pool.options.max).toBe(expected);
    } finally {
      await pool.end();
    }
  });
});

describe('watchPoolWaits', () => {
  afterEach(() => vi.useRealTimers());

  it('warns once when queries wait longer than the threshold, and again after the queue drains', () => {
    vi.useFakeTimers();
    const pool = { waitingCount: 0, totalCount: 20, idleCount: 0, options: { max: 20 } };
    const logger = { warn: vi.fn() };
    const stop = watchPoolWaits(pool, logger, 1_000, 250);

    pool.waitingCount = 3;
    vi.advanceTimersByTime(750);
    expect(logger.warn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1_000);
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.warn.mock.calls[0]?.[0]).toContain('3 queries waiting');
    vi.advanceTimersByTime(5_000);
    expect(logger.warn).toHaveBeenCalledTimes(1);

    pool.waitingCount = 0;
    vi.advanceTimersByTime(250);
    pool.waitingCount = 1;
    vi.advanceTimersByTime(1_500);
    expect(logger.warn).toHaveBeenCalledTimes(2);

    stop();
  });

  it('stays quiet for short waits', () => {
    vi.useFakeTimers();
    const pool = { waitingCount: 0, totalCount: 10, idleCount: 0 };
    const logger = { warn: vi.fn() };
    const stop = watchPoolWaits(pool, logger, 1_000, 250);

    for (let i = 0; i < 10; i += 1) {
      pool.waitingCount = 2;
      vi.advanceTimersByTime(500);
      pool.waitingCount = 0;
      vi.advanceTimersByTime(250);
    }

    expect(logger.warn).not.toHaveBeenCalled();
    stop();
  });
});
