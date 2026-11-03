import { ConfigService } from '@nestjs/config';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  BoutAiClient,
  BOUT_AI_TIMEOUTS,
  anonymizeAiInput,
} from './bout-ai.client.js';
import { isSupportedVideoUrl } from './bout-analysis.model.js';

const valid = {
  instructions: [{ text: 'Giữ tay cao và bước ra ngoài sau jab.' }],
};
const response = (data: unknown = valid) =>
  new Response(
    JSON.stringify({
      candidates: [{ content: { parts: [{ text: JSON.stringify(data) }] } }],
    }),
  );
function setup(key = 'fake-test-key') {
  const config = new ConfigService({ GEMINI_API_KEY: key });
  const fetch = vi.fn().mockResolvedValue(response());
  vi.stubGlobal('fetch', fetch);
  return { client: new BoutAiClient(config), fetch };
}
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
describe('BoutAiClient (mock fetch only)', () => {
  it('uses structured JSON, the configured model, and no external SDK', async () => {
    const { client, fetch } = setup();
    expect(client.model).toBe('gemini-3.8-flash');
    expect(
      await client.generate('BETWEEN_ROUNDS', { safety: { level: 'RED' } }),
    ).toEqual({ ok: true, items: valid.instructions });
    const body = JSON.parse(fetch.mock.calls[0][1].body);
    expect(body.generationConfig.responseMimeType).toBe('application/json');
    expect(
      body.generationConfig.responseSchema.properties.instructions,
    ).toBeDefined();
    expect(body.contents[0].parts[0].text).toContain(
      'không đưa lời dặn tăng cường độ tấn công',
    );
    expect(body.contents[0].parts[0].text).toContain('Không nhận định y tế');
    expect(
      new BoutAiClient(new ConfigService({ GEMINI_BOUT_MODEL: 'gemini-test' }))
        .model,
    ).toBe('gemini-test');
  });
  it('does not fetch when the key is missing', async () => {
    const { client, fetch } = setup('');
    for (const kind of Object.keys(
      BOUT_AI_TIMEOUTS,
    ) as (keyof typeof BOUT_AI_TIMEOUTS)[])
      expect(await client.generate(kind, {})).toEqual({
        ok: false,
        error: 'NOT_CONFIGURED',
      });
    expect(fetch).not.toHaveBeenCalled();
  });
  it('retries 503 exactly once inside the same deadline', async () => {
    const { client, fetch } = setup();
    fetch
      .mockResolvedValueOnce(new Response('', { status: 503 }))
      .mockResolvedValueOnce(response());
    expect((await client.generate('BETWEEN_ROUNDS', {})).ok).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch.mock.calls[0][1].signal).toBe(fetch.mock.calls[1][1].signal);
  });
  it('maps two 503s to UPSTREAM', async () => {
    const { client, fetch } = setup();
    fetch.mockImplementation(() =>
      Promise.resolve(new Response('', { status: 503 })),
    );
    expect(await client.generate('PRE_BOUT_TACTICS', {})).toEqual({
      ok: false,
      error: 'UPSTREAM',
    });
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it('maps 429 to QUOTA without retry', async () => {
    const { client, fetch } = setup();
    fetch.mockResolvedValue(new Response('', { status: 429 }));
    expect(await client.generate('BETWEEN_ROUNDS', {})).toEqual({
      ok: false,
      error: 'QUOTA',
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it.each(Object.entries(BOUT_AI_TIMEOUTS))(
    'bounds %s at %i ms',
    async (kind, ms) => {
      vi.useFakeTimers();
      const { client, fetch } = setup();
      fetch.mockImplementation(() => new Promise(() => {}));
      const pending = client.generate(
        kind as keyof typeof BOUT_AI_TIMEOUTS,
        {},
      );
      await vi.advanceTimersByTimeAsync(ms - 1);
      expect(fetch.mock.calls[0][1].signal.aborted).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      expect(await pending).toEqual({ ok: false, error: 'TIMEOUT' });
    },
  );
  it('times out even while reading the response body', async () => {
    vi.useFakeTimers();
    const { client, fetch } = setup();
    fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => new Promise(() => {}),
    });
    const pending = client.generate('BETWEEN_ROUNDS', {});
    await vi.advanceTimersByTimeAsync(12_000);
    expect(await pending).toEqual({ ok: false, error: 'TIMEOUT' });
  });
  it.each([null, {}, { instructions: [] }, { instructions: [{ text: '' }] }])(
    'maps empty/malformed output to EMPTY: %j',
    async (data) => {
      const { client, fetch } = setup();
      fetch.mockResolvedValue(response(data));
      expect(await client.generate('BETWEEN_ROUNDS', {})).toEqual({
        ok: false,
        error: 'EMPTY',
      });
    },
  );
  it('maps invalid upstream JSON to EMPTY', async () => {
    const { client, fetch } = setup();
    fetch.mockResolvedValue(new Response('{bad'));
    expect(await client.generate('BETWEEN_ROUNDS', {})).toEqual({
      ok: false,
      error: 'EMPTY',
    });
  });
  it('maps malformed candidate JSON to EMPTY', async () => {
    const { client, fetch } = setup();
    fetch.mockResolvedValue(
      new Response(
        JSON.stringify({
          candidates: [{ content: { parts: [{ text: '{bad' }] } }],
        }),
      ),
    );
    expect(await client.generate('BETWEEN_ROUNDS', {})).toEqual({
      ok: false,
      error: 'EMPTY',
    });
  });
  it('maps network rejection to UPSTREAM', async () => {
    const { client, fetch } = setup();
    fetch.mockRejectedValue(new Error('network'));
    expect(await client.generate('BETWEEN_ROUNDS', {})).toEqual({
      ok: false,
      error: 'UPSTREAM',
    });
  });
  it('redacts participant names and UUIDs in text, keys and nested notes', () => {
    const raw = {
      note: 'Nguyễn An gặp Trần Bình; thầy Lê Huấn',
      nested: [{ id: '10000000-0000-4000-8000-000000000001' }],
    };
    const value = JSON.stringify(
      anonymizeAiInput(raw, ['Nguyễn An', 'Trần Bình', 'Lê Huấn']),
    );
    for (const name of [
      'Nguyễn An',
      'Trần Bình',
      'Lê Huấn',
      '10000000-0000-4000-8000-000000000001',
    ])
      expect(value).not.toContain(name);
  });
  it('keeps technical words intact when a name overlaps them', () => {
    expect(
      anonymizeAiInput(
        { stance: 'ORTHODOX', standing: 'AHEAD', note: 'An giữ tay cao' },
        ['An'],
      ),
    ).toEqual({
      note: 'người tham gia giữ tay cao',
      stance: 'ORTHODOX',
      standing: 'AHEAD',
    });
  });
  it('uses a video file part and preserves the T-033 observation shape', async () => {
    const { client, fetch } = setup();
    fetch.mockResolvedValue(
      response({
        observations: [
          {
            kind: 'HABIT',
            text: 'Hạ tay phải sau jab',
            time: '01:20',
            confidence: 'ONCE',
          },
        ],
      }),
    );
    const result = await client.generate(
      'VIDEO_OBSERVATIONS',
      { who: 'góc đỏ' },
      'https://youtu.be/abcdef123',
    );
    expect(result.ok).toBe(true);
    expect(
      JSON.parse(fetch.mock.calls[0][1].body).contents[0].parts[0].file_data
        .file_uri,
    ).toBe('https://youtu.be/abcdef123');
  });
});
describe('T-033 supported URL parity', () => {
  it.each([
    'https://www.youtube.com/watch?v=abcdef123&t=1',
    ' https://youtu.be/abcdef123 ',
    'https://m.youtube.com/shorts/abcdef123',
  ])('accepts %s', (url) => expect(isSupportedVideoUrl(url)).toBe(true));
  it.each([
    'http://youtube.com/watch?v=abcdef123',
    'https://evil.test/a.mp4',
    'https://youtube.com.evil.test/watch?v=abcdef123',
    'https://youtube.com/watch?v=abc',
  ])('rejects %s', (url) => expect(isSupportedVideoUrl(url)).toBe(false));
});
