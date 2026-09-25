import { loadEnv } from './env.js';

const validSource = {
  WORKER_SECRET_TOKEN: 'secret-token',
};

describe('loadEnv', () => {
  it('applies defaults when optional vars are missing', () => {
    const result = loadEnv(validSource);
    expect(result).toEqual({
      NODE_ENV: 'development',
      PORT: 3001,
      FRONTEND_URL: 'http://localhost:3000',
      MOBILE_APP_URL: 'http://localhost:8081',
      APP_HEADER_LANGUAGE: 'x-custom-lang',
      WORKER_SECRET_TOKEN: 'secret-token',
    });
  });

  it('parses PORT as a number', () => {
    expect(loadEnv({ ...validSource, PORT: '4000' }).PORT).toBe(4000);
  });

  it('throws a clear error for a non-numeric PORT', () => {
    expect(() => loadEnv({ ...validSource, PORT: 'not-a-number' })).toThrow(
      /PORT/,
    );
  });

  it('validates NODE_ENV against the allowed enum', () => {
    expect(loadEnv({ ...validSource, NODE_ENV: 'production' }).NODE_ENV).toBe(
      'production',
    );
    expect(() => loadEnv({ ...validSource, NODE_ENV: 'staging' })).toThrow(
      /NODE_ENV/,
    );
  });

  it('validates URL-shaped vars', () => {
    expect(() =>
      loadEnv({ ...validSource, FRONTEND_URL: 'not-a-url' }),
    ).toThrow(/FRONTEND_URL/);
  });

  it('throws when a required var is missing', () => {
    expect(() => loadEnv({})).toThrow(/WORKER_SECRET_TOKEN/);
  });

  it('is immutable', () => {
    const result = loadEnv(validSource);
    expect(Object.isFrozen(result)).toBe(true);
  });
});
