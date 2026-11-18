import { Pool, type PoolClient } from 'pg';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CONNECT_RETRY_DELAYS_MS,
  isTransientConnectError,
  RetryingPool,
} from './retrying-pool.js';

// No database: the parent Pool's connect() is replaced in every test.
const client = { release: vi.fn() } as unknown as PoolClient;
const full = () =>
  Object.assign(
    new Error(
      '(EMAXCONNSESSION) max clients reached in session mode - max clients are limited to pool_size: 15',
    ),
    { code: 'XX000' },
  );

function poolWith(...outcomes: (Error | PoolClient)[]) {
  const connect = vi.spyOn(Pool.prototype, 'connect');
  for (const outcome of outcomes)
    connect.mockImplementationOnce((() =>
      outcome instanceof Error
        ? Promise.reject(outcome)
        : Promise.resolve(outcome)) as never);
  return { pool: new RetryingPool({ max: 1 }), connect };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('isTransientConnectError', () => {
  it.each([
    full(),
    new Error('MaxClientsInSessionMode: max clients reached'),
    Object.assign(new Error('sorry, too many clients already'), { code: '53300' }),
    new Error('remaining connection slots are reserved for non-replication superuser connections'),
    Object.assign(new Error('the database system is starting up'), { code: '57P03' }),
    new Error('timeout exceeded when trying to connect'),
    new Error('Connection terminated unexpectedly'),
  ])('treats %s as transient', (error) => {
    expect(isTransientConnectError(error)).toBe(true);
  });

  it.each([
    Object.assign(new Error('password authentication failed for user "postgres"'), { code: '28P01' }),
    Object.assign(new Error('relation "videos" does not exist'), { code: '42P01' }),
    'max clients',
    null,
  ])('does not retry %s', (error) => {
    expect(isTransientConnectError(error)).toBe(false);
  });
});

describe('RetryingPool', () => {
  it('retries a refused connection and returns the client', async () => {
    vi.useFakeTimers();
    const { pool, connect } = poolWith(full(), full(), client);
    const result = pool.connect();
    await vi.runAllTimersAsync();
    await expect(result).resolves.toBe(client);
    expect(connect).toHaveBeenCalledTimes(3);
  });

  it('gives up after the last delay with the original error', async () => {
    vi.useFakeTimers();
    const outcomes = Array.from({ length: CONNECT_RETRY_DELAYS_MS.length + 1 }, full);
    const { pool, connect } = poolWith(...outcomes);
    const result = pool.connect();
    const assertion = expect(result).rejects.toThrow('max clients reached');
    await vi.runAllTimersAsync();
    await assertion;
    expect(connect).toHaveBeenCalledTimes(CONNECT_RETRY_DELAYS_MS.length + 1);
  });

  it('does not retry other errors', async () => {
    const auth = Object.assign(new Error('password authentication failed'), { code: '28P01' });
    const { pool, connect } = poolWith(auth);
    await expect(pool.connect()).rejects.toBe(auth);
    expect(connect).toHaveBeenCalledTimes(1);
  });

  it('serves the callback form that pool.query() uses', async () => {
    vi.useFakeTimers();
    const { pool } = poolWith(full(), client);
    const callback = vi.fn();
    pool.connect(callback);
    await vi.runAllTimersAsync();
    expect(callback).toHaveBeenCalledWith(undefined, client, expect.any(Function));
    callback.mock.calls[0][2]();
    expect(client.release).toHaveBeenCalled();
  });

  it('retries for pool.query(), which acquires its client through connect()', async () => {
    vi.useFakeTimers();
    const queryClient = {
      release: vi.fn(),
      once: vi.fn(),
      removeListener: vi.fn(),
      query: vi.fn((_text: string, _values: unknown, cb: (err: Error | null, res: unknown) => void) =>
        cb(null, { rows: [{ ok: 1 }] }),
      ),
    } as unknown as PoolClient;
    const { pool, connect } = poolWith(full(), queryClient);
    const result = pool.query('select 1 as ok');
    await vi.runAllTimersAsync();
    await expect(result).resolves.toMatchObject({ rows: [{ ok: 1 }] });
    expect(connect).toHaveBeenCalledTimes(2);
    expect(queryClient.release).toHaveBeenCalled();
  });

  it('reports a final failure to the callback', async () => {
    const auth = new Error('password authentication failed');
    const { pool } = poolWith(auth);
    const callback = vi.fn();
    pool.connect(callback);
    await vi.waitFor(() => expect(callback).toHaveBeenCalled());
    expect(callback).toHaveBeenCalledWith(auth, undefined, expect.any(Function));
  });
});
