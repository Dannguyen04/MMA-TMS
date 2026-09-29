import type { ConfigService } from '@nestjs/config';
import { Redis, type RedisOptions } from 'ioredis';

/**
 * Redis connection settings resolved once from configuration. Shared by the
 * root BullMQ configuration and by modules that need a plain Redis client
 * (for example Pub/Sub), so host, port, password, URL and TLS are never
 * re-derived or hard-coded elsewhere.
 */
export type RedisConnectionSettings =
  | {
      url: string;
      tls?: { rejectUnauthorized: boolean };
    }
  | {
      host: string;
      port: number;
      password?: string;
    };

export function resolveRedisConnection(
  config: ConfigService,
): RedisConnectionSettings {
  const redisUrl = config.get<string>('REDIS_URL');
  if (redisUrl) {
    const isTls = redisUrl.startsWith('rediss://');
    return {
      url: redisUrl,
      tls: isTls ? { rejectUnauthorized: false } : undefined,
    };
  }

  return {
    host: config.get('REDIS_HOST', 'localhost'),
    port: Number(config.get('REDIS_PORT', 6379)),
    password: config.get('REDIS_PASSWORD') || undefined,
  };
}

/**
 * Creates a dedicated ioredis client for the shared endpoint/auth/TLS with a
 * caller-specific behaviour policy (retries, offline queue, timeouts). The
 * caller owns the client and must close it.
 */
export function createRedisClient(
  settings: RedisConnectionSettings,
  policy: RedisOptions,
): Redis {
  if ('url' in settings) {
    return new Redis(settings.url, { tls: settings.tls, ...policy });
  }
  return new Redis({ ...settings, ...policy });
}

/**
 * Closes an owned client: QUIT when possible, forced disconnect when Redis is
 * unreachable or QUIT does not finish within `timeoutMs`.
 */
export async function closeRedisClient(
  client: Redis,
  timeoutMs: number,
): Promise<void> {
  let timer: NodeJS.Timeout | undefined;
  try {
    await Promise.race([
      client.quit(),
      new Promise((resolve) => {
        timer = setTimeout(resolve, timeoutMs);
        timer.unref();
      }),
    ]);
  } catch {
    // Unreachable Redis: fall through to the forced disconnect.
  } finally {
    clearTimeout(timer);
    if (client.status !== 'end') client.disconnect();
  }
}
