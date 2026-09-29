import type { ConfigService } from '@nestjs/config';

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
