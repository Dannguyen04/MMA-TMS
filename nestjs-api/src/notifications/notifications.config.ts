import type { ConfigService } from '@nestjs/config';
import { z } from 'zod';
import { NOTIFICATION_CONFIG_DEFAULTS } from './notifications.constant.js';

type ConfigKey = keyof typeof NOTIFICATION_CONFIG_DEFAULTS;

const positiveInt = (fallback: number) =>
  z.coerce.number().int().positive().default(fallback);

const configSchema = z.strictObject(
  Object.fromEntries(
    Object.entries(NOTIFICATION_CONFIG_DEFAULTS).map(([key, fallback]) => [
      key,
      positiveInt(fallback),
    ]),
  ) as Record<ConfigKey, ReturnType<typeof positiveInt>>,
);

export type NotificationsConfig = Readonly<Record<ConfigKey, number>>;

/**
 * Reads `NOTIFICATION_<KEY>` values through ConfigService and validates them
 * once at startup; a malformed value fails the boot instead of silently
 * falling back.
 */
export function loadNotificationsConfig(
  config: ConfigService,
): NotificationsConfig {
  const raw = Object.fromEntries(
    (Object.keys(NOTIFICATION_CONFIG_DEFAULTS) as ConfigKey[]).map((key) => {
      const value = config.get<string>(`NOTIFICATION_${key}`);
      return [key, value === undefined || value === '' ? undefined : value];
    }),
  );
  const parsed = configSchema.safeParse(raw);
  if (!parsed.success) {
    const keys = parsed.error.issues
      .map((issue) => `NOTIFICATION_${String(issue.path[0])}`)
      .join(', ');
    throw new Error(`Invalid notification configuration: ${keys}`);
  }
  return Object.freeze(parsed.data);
}
