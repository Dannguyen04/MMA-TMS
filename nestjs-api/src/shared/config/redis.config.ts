import type { ConfigService } from '@nestjs/config';
import { Redis, type RedisOptions } from 'ioredis';

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

/** The caller owns the client and must close it. */
export function createRedisClient(
  settings: RedisConnectionSettings,
  policy: RedisOptions,
): Redis {
  if ('url' in settings) {
    return new Redis(settings.url, { tls: settings.tls, ...policy });
  }
  return new Redis({ ...settings, ...policy });
}

/** Forces a disconnect when QUIT fails or exceeds `timeoutMs`. */
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
