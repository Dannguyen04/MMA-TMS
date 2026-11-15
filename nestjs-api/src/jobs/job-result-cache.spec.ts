import { afterEach, describe, expect, it, vi } from 'vitest';
import { JobResultCache } from './job-result-cache.js';

describe('JobResultCache', () => {
  afterEach(() => vi.useRealTimers());

  it('returns a result for the same job and result URL', () => {
    const cache = new JobResultCache();
    cache.set('job', 'url-1', { a: 1 }, 10);
    expect(cache.get('job', 'url-1')).toEqual({ a: 1 });
    expect(cache.get('job', 'url-2')).toBeUndefined();
    expect(cache.get('job', 'url-1')).toBeUndefined();
  });

  it('expires entries after the TTL', () => {
    vi.useFakeTimers();
    const cache = new JobResultCache(50, 1_000, 10 * 60 * 1000);
    cache.set('job', 'url', 'x', 1);
    vi.advanceTimersByTime(10 * 60 * 1000 - 1);
    expect(cache.get('job', 'url')).toBe('x');
    vi.advanceTimersByTime(1);
    expect(cache.get('job', 'url')).toBeUndefined();
  });

  it('evicts the least recently used entry past the entry limit', () => {
    const cache = new JobResultCache(2, 1_000);
    cache.set('a', 'u', 'A', 1);
    cache.set('b', 'u', 'B', 1);
    cache.get('a', 'u');
    cache.set('c', 'u', 'C', 1);
    expect(cache.get('b', 'u')).toBeUndefined();
    expect(cache.get('a', 'u')).toBe('A');
    expect(cache.get('c', 'u')).toBe('C');
    expect(cache.size).toBe(2);
  });

  it('keeps the total size under the byte limit and skips an oversized result', () => {
    const cache = new JobResultCache(50, 100);
    cache.set('a', 'u', 'A', 60);
    cache.set('b', 'u', 'B', 60);
    expect(cache.get('a', 'u')).toBeUndefined();
    expect(cache.bytes).toBe(60);
    cache.set('huge', 'u', 'H', 101);
    expect(cache.get('huge', 'u')).toBeUndefined();
    expect(cache.get('b', 'u')).toBe('B');
  });

  it('forgets a deleted job', () => {
    const cache = new JobResultCache();
    cache.set('job', 'u', 'x', 5);
    cache.delete('job');
    expect(cache.get('job', 'u')).toBeUndefined();
    expect(cache.bytes).toBe(0);
  });
});
