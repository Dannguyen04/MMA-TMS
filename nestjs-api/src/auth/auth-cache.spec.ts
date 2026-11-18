import { afterEach, describe, expect, it, vi } from 'vitest';
import { TtlCache, invalidateAuthCache, jwtExpiryMs } from './auth-cache.js';

describe('TtlCache', () => {
  afterEach(() => vi.useRealTimers());

  it('returns a value until the TTL passes', () => {
    vi.useFakeTimers();
    const cache = new TtlCache<string>(1_000);
    cache.set('a', 'x');
    expect(cache.get('a')).toBe('x');
    vi.advanceTimersByTime(1_001);
    expect(cache.get('a')).toBeUndefined();
  });

  it('never outlives notAfter', () => {
    vi.useFakeTimers();
    const cache = new TtlCache<string>(60_000);
    cache.set('a', 'x', Date.now() + 500);
    vi.advanceTimersByTime(501);
    expect(cache.get('a')).toBeUndefined();
  });

  it('is emptied by invalidateAuthCache', () => {
    const cache = new TtlCache<string>(60_000);
    cache.set('a', 'x');
    invalidateAuthCache();
    expect(cache.get('a')).toBeUndefined();
  });
});

describe('TtlCache.getOrLoad', () => {
  afterEach(() => vi.useRealTimers());

  it('shares one lookup between concurrent callers with the same key', async () => {
    const cache = new TtlCache<string>(60_000);
    let release!: (value: string) => void;
    const load = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          release = resolve;
        }),
    );

    const calls = Array.from({ length: 50 }, () => cache.getOrLoad('k', load));
    release('v');

    await expect(Promise.all(calls)).resolves.toEqual(Array(50).fill('v'));
    expect(load).toHaveBeenCalledTimes(1);
    expect(cache.get('k')).toBe('v');
  });

  it('drops a failed lookup so the next caller tries again', async () => {
    const cache = new TtlCache<string>(60_000);
    const load = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error('down'))
      .mockResolvedValueOnce('v');

    await expect(cache.getOrLoad('k', load)).rejects.toThrow('down');
    expect(cache.get('k')).toBeUndefined();
    await expect(cache.getOrLoad('k', load)).resolves.toBe('v');
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('caps the entry at notAfter', async () => {
    vi.useFakeTimers();
    const cache = new TtlCache<string>(60_000);
    await cache.getOrLoad('k', () => Promise.resolve('v'), Date.now() + 500);
    vi.advanceTimersByTime(501);
    expect(cache.get('k')).toBeUndefined();
  });

  it('does not cache a lookup that was running when invalidateAuthCache ran', async () => {
    const cache = new TtlCache<string>(60_000);
    let release!: (value: string) => void;
    const pending = cache.getOrLoad(
      'k',
      () =>
        new Promise<string>((resolve) => {
          release = resolve;
        }),
    );

    invalidateAuthCache();
    const fresh = vi.fn(() => Promise.resolve('new'));
    const afterInvalidation = cache.getOrLoad('k', fresh);
    release('old');

    await expect(pending).resolves.toBe('old');
    await expect(afterInvalidation).resolves.toBe('new');
    expect(fresh).toHaveBeenCalledTimes(1);
    expect(cache.get('k')).toBe('new');
  });
});

describe('jwtExpiryMs', () => {
  it('reads exp and ignores malformed tokens', () => {
    const payload = Buffer.from(JSON.stringify({ exp: 1_800_000_000 })).toString('base64url');
    expect(jwtExpiryMs(`h.${payload}.s`)).toBe(1_800_000_000_000);
    expect(jwtExpiryMs('not-a-jwt')).toBeNull();
  });
});
