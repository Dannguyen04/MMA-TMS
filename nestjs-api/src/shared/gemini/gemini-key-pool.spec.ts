import { describe, expect, it, vi } from 'vitest';
import {
  GeminiKeyPool,
  GeminiKeysExhaustedError,
  classifyGeminiKeyFailure,
  parseGeminiKeys,
} from './gemini-key-pool.js';

// Fake keys only; the pool never talks to the network in these tests.
const KEYS = ['fake-key-a', 'fake-key-b', 'fake-key-c'];
const ok = () => new Response('{"candidates":[]}', { status: 200 });
const quota = () =>
  new Response(
    JSON.stringify({ error: { code: 429, status: 'RESOURCE_EXHAUSTED' } }),
    { status: 429 },
  );
const invalid = () =>
  new Response(
    JSON.stringify({
      error: {
        code: 400,
        status: 'INVALID_ARGUMENT',
        message: 'API key not valid. Please pass a valid API key.',
        details: [{ reason: 'API_KEY_INVALID' }],
      },
    }),
    { status: 400 },
  );

/** Answers per key from a script, recording which key each call used. */
function scripted(plan: Record<string, () => Response>) {
  return vi.fn((key: string) => Promise.resolve(plan[key]()));
}

describe('parseGeminiKeys', () => {
  it('splits, trims, unquotes and de-duplicates GEMINI_API_KEYS', () => {
    expect(
      parseGeminiKeys(' "fake-key-a", fake-key-b ,,fake-key-a\nfake-key-c ', 'x'),
    ).toEqual(KEYS);
  });
  it('falls back to GEMINI_API_KEY when the list is empty', () => {
    expect(parseGeminiKeys('', ' fake-key-a ')).toEqual(['fake-key-a']);
    expect(parseGeminiKeys(undefined, "'fake-key-a'")).toEqual(['fake-key-a']);
    expect(parseGeminiKeys(' , ', '')).toEqual([]);
    expect(parseGeminiKeys()).toEqual([]);
  });
});

describe('classifyGeminiKeyFailure', () => {
  it('treats 429 and RESOURCE_EXHAUSTED as quota', async () => {
    expect(await classifyGeminiKeyFailure(quota())).toBe('QUOTA');
    expect(
      await classifyGeminiKeyFailure(
        new Response(JSON.stringify({ error: { status: 'RESOURCE_EXHAUSTED' } }), {
          status: 403,
        }),
      ),
    ).toBe('QUOTA');
  });
  it('treats 401, 403 and 400 API_KEY_INVALID as a bad key', async () => {
    expect(await classifyGeminiKeyFailure(invalid())).toBe('INVALID_KEY');
    expect(await classifyGeminiKeyFailure(new Response('', { status: 401 }))).toBe(
      'INVALID_KEY',
    );
    expect(await classifyGeminiKeyFailure(new Response('', { status: 403 }))).toBe(
      'INVALID_KEY',
    );
    expect(
      await classifyGeminiKeyFailure(
        new Response(JSON.stringify({ error: { message: 'API key expired. Please renew the API key.' } }), {
          status: 400,
        }),
      ),
    ).toBe('INVALID_KEY');
  });
  it('does not blame the key for other errors and leaves the body readable', async () => {
    const badRequest = new Response(
      JSON.stringify({ error: { status: 'INVALID_ARGUMENT', message: 'Bad schema' } }),
      { status: 400 },
    );
    expect(await classifyGeminiKeyFailure(badRequest)).toBeNull();
    expect((await badRequest.json()).error.message).toBe('Bad schema');
    expect(await classifyGeminiKeyFailure(new Response('', { status: 503 }))).toBeNull();
    expect(await classifyGeminiKeyFailure(ok())).toBeNull();
  });
});

describe('GeminiKeyPool', () => {
  it('moves to the next key on quota and retries the same request', async () => {
    const pool = new GeminiKeyPool(KEYS);
    const request = scripted({ 'fake-key-a': quota, 'fake-key-b': ok, 'fake-key-c': ok });
    const failures: unknown[] = [];
    const response = await pool.run(request, (event) => failures.push(event));
    expect(response.status).toBe(200);
    expect(request.mock.calls.map(([key]) => key)).toEqual(['fake-key-a', 'fake-key-b']);
    expect(failures).toEqual([{ keyNumber: 1, keyCount: 3, reason: 'QUOTA', status: 429 }]);
  });

  it('skips an invalid or expired key', async () => {
    const pool = new GeminiKeyPool(KEYS);
    const request = scripted({ 'fake-key-a': invalid, 'fake-key-b': quota, 'fake-key-c': ok });
    expect((await pool.run(request)).status).toBe(200);
    expect(request).toHaveBeenCalledTimes(3);
  });

  it('remembers the last working key and wraps around the list', async () => {
    const pool = new GeminiKeyPool(KEYS);
    let plan: Record<string, () => Response> = {
      'fake-key-a': quota,
      'fake-key-b': quota,
      'fake-key-c': ok,
    };
    const request = vi.fn((key: string) => Promise.resolve(plan[key]()));
    await pool.run(request);
    expect(pool.currentIndex).toBe(2);

    request.mockClear();
    await pool.run(request);
    expect(request.mock.calls.map(([key]) => key)).toEqual(['fake-key-c']);

    plan = { 'fake-key-a': ok, 'fake-key-b': ok, 'fake-key-c': quota };
    request.mockClear();
    await pool.run(request);
    expect(request.mock.calls.map(([key]) => key)).toEqual(['fake-key-c', 'fake-key-a']);
    expect(pool.currentIndex).toBe(0);
  });

  it('throws a clear error once every key is exhausted, tries each key once and never exposes keys', async () => {
    const pool = new GeminiKeyPool(KEYS);
    const request = scripted({ 'fake-key-a': quota, 'fake-key-b': invalid, 'fake-key-c': quota });
    const error = await pool.run(request).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(GeminiKeysExhaustedError);
    const exhausted = error as GeminiKeysExhaustedError;
    expect(exhausted.message).toBe(
      'All 3 Gemini API key(s) failed (quota: 2, invalid or expired: 1)',
    );
    expect([exhausted.quota, exhausted.invalid, exhausted.keyCount]).toEqual([2, 1, 3]);
    expect(exhausted.message).not.toContain('fake-key');
    expect(request).toHaveBeenCalledTimes(3);
    // A failed round does not move the starting key.
    expect(pool.currentIndex).toBe(0);
  });

  it('returns non-key failures to the caller without rotating', async () => {
    const pool = new GeminiKeyPool(KEYS);
    const request = vi.fn(() => Promise.resolve(new Response('', { status: 503 })));
    expect((await pool.run(request)).status).toBe(503);
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('lets network errors and aborts propagate', async () => {
    const pool = new GeminiKeyPool(KEYS);
    const request = vi.fn(() => Promise.reject(new DOMException('aborted', 'AbortError')));
    await expect(pool.run(request)).rejects.toThrow('aborted');
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('refuses to run without keys', async () => {
    await expect(new GeminiKeyPool([]).run(vi.fn())).rejects.toThrow(
      'No Gemini API key configured',
    );
  });
});
