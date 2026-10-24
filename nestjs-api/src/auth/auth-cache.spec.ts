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

describe('jwtExpiryMs', () => {
  it('reads exp and ignores malformed tokens', () => {
    const payload = Buffer.from(JSON.stringify({ exp: 1_800_000_000 })).toString('base64url');
    expect(jwtExpiryMs(`h.${payload}.s`)).toBe(1_800_000_000_000);
    expect(jwtExpiryMs('not-a-jwt')).toBeNull();
  });
});
