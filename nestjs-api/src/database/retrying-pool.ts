import { Pool, type PoolClient } from 'pg';

/**
 * Supabase's pooler refuses a new connection once the project's session-mode
 * limit is reached ("max clients reached"), and Postgres does the same when it
 * runs out of slots. Every server sharing the database counts toward that
 * limit, so a busy moment elsewhere turned ordinary reads into HTTP 500. These
 * failures happen before any query runs, so trying to connect again is safe.
 */
const TRANSIENT_CONNECT_MESSAGE =
  /max ?clients|MaxClientsInSessionMode|too many clients|remaining connection slots|connection slots are reserved|timeout exceeded when trying to connect|Connection terminated unexpectedly|ECONNRESET/i;
/** too_many_connections, cannot_connect_now (server starting or in recovery). */
const TRANSIENT_CONNECT_CODES = new Set(['53300', '57P03']);

export const CONNECT_RETRY_DELAYS_MS = [150, 400, 1_000] as const;

export function isTransientConnectError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const { code, message } = error as { code?: unknown; message?: unknown };
  if (typeof code === 'string' && TRANSIENT_CONNECT_CODES.has(code))
    return true;
  return typeof message === 'string' && TRANSIENT_CONNECT_MESSAGE.test(message);
}

type ConnectCallback = (
  err: Error | undefined,
  client: PoolClient | undefined,
  done: (release?: unknown) => void,
) => void;

/**
 * A `pg` Pool whose `connect()` retries a refused connection a few times with
 * a short backoff. `pool.query()` and Drizzle transactions both acquire their
 * client through `connect()`, so every database call gets the retry.
 */
export class RetryingPool extends Pool {
  connect(): Promise<PoolClient>;
  connect(callback: ConnectCallback): void;
  connect(callback?: ConnectCallback): Promise<PoolClient> | void {
    const attempt = this.connectWithRetry();
    if (!callback) return attempt;
    attempt.then(
      (client) => callback(undefined, client, (release) => client.release(release as Error | boolean | undefined)),
      (error: Error) => callback(error, undefined, () => undefined),
    );
  }

  private async connectWithRetry(): Promise<PoolClient> {
    for (let attempt = 0; ; attempt++) {
      try {
        return await super.connect();
      } catch (error) {
        const delay = CONNECT_RETRY_DELAYS_MS[attempt];
        if (delay === undefined || !isTransientConnectError(error)) throw error;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
}
