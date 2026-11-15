import { Module, Global, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from './schema.js';

export const DRIZZLE = Symbol('DRIZZLE');

export type DrizzleDB = ReturnType<typeof drizzle<typeof schema>>;

/** Pool size when `DATABASE_POOL_MAX` is unset. Mind the Supabase plan's pooler limit across every running server. */
export const DEFAULT_DATABASE_POOL_MAX = 20;
/** A query waiting this long for a free connection is logged when `DATABASE_POOL_WAIT_LOG=1`. */
export const POOL_WAIT_WARN_AFTER_MS = 1_000;
const POOL_WAIT_CHECK_EVERY_MS = 250;

/** `DATABASE_POOL_MAX` as a positive integer; a malformed value stops startup instead of silently using a default. */
export function databasePoolMax(raw: string | undefined): number {
  if (raw === undefined || raw.trim() === '') return DEFAULT_DATABASE_POOL_MAX;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(
      `Invalid environment configuration for "DATABASE_POOL_MAX": "${raw}" is not a positive integer`,
    );
  }
  return value;
}

export function createDatabasePool(config: ConfigService): Pool {
  const connectionString = config.get<string>('DATABASE_URL');
  const isRemote =
    !!connectionString &&
    !connectionString.includes('localhost') &&
    !connectionString.includes('127.0.0.1') &&
    !connectionString.includes('@postgres:');

  return new Pool({
    connectionString,
    ssl: isRemote ? { rejectUnauthorized: false } : undefined,
    // Reuse warm connections: a fresh TCP + TLS + auth handshake to the remote pooler costs several round trips.
    max: databasePoolMax(config.get<string>('DATABASE_POOL_MAX')),
    keepAlive: true,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });
}

type PoolCounts = Pick<Pool, 'waitingCount' | 'totalCount' | 'idleCount'>;

/**
 * Warns once per episode when queries have been queued for a connection longer than `warnAfterMs`, i.e. the
 * pool is the bottleneck. Returns a stop function. The timer is unref'd so it never keeps the process alive.
 */
export function watchPoolWaits(
  pool: PoolCounts & { options?: { max?: number } },
  logger: Pick<Logger, 'warn'>,
  warnAfterMs = POOL_WAIT_WARN_AFTER_MS,
  checkEveryMs = POOL_WAIT_CHECK_EVERY_MS,
): () => void {
  let waitingSince: number | null = null;
  let warned = false;
  const timer = setInterval(() => {
    if (pool.waitingCount === 0) {
      waitingSince = null;
      warned = false;
      return;
    }
    const now = Date.now();
    waitingSince ??= now;
    if (!warned && now - waitingSince >= warnAfterMs) {
      warned = true;
      logger.warn(
        `Database pool saturated for ${now - waitingSince} ms: ${pool.waitingCount} queries waiting, ` +
          `${pool.totalCount}/${pool.options?.max ?? '?'} connections open, ${pool.idleCount} idle`,
      );
    }
  }, checkEveryMs);
  timer.unref();
  return () => clearInterval(timer);
}

@Global()
@Module({
  providers: [
    {
      provide: DRIZZLE,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const pool = createDatabasePool(config);
        if (config.get<string>('DATABASE_POOL_WAIT_LOG') === '1') {
          watchPoolWaits(pool, new Logger('DatabasePool'));
        }
        return drizzle(pool, { schema });
      },
    },
  ],
  exports: [DRIZZLE],
})
export class DatabaseModule {}
