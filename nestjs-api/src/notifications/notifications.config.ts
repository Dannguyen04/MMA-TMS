import type { ConfigService } from '@nestjs/config';
import { z } from 'zod';
import {
  MAX_TIMER_DELAY_MS,
  NOTIFICATION_CONFIG_DEFAULTS,
  NOTIFICATION_CONFIG_MAX,
  type NotificationConfigKey,
} from './notifications.constant.js';

const keys = Object.keys(NOTIFICATION_CONFIG_DEFAULTS) as NotificationConfigKey[];

const boundedInt = (fallback: number, maximum: number) =>
  z.coerce
    .number()
    .int()
    .positive()
    // Timer values above the 32-bit limit would silently fire after 1 ms.
    .max(Math.min(maximum, MAX_TIMER_DELAY_MS))
    .default(fallback);

const configSchema = z.strictObject(
  Object.fromEntries(
    keys.map((key) => [
      key,
      boundedInt(NOTIFICATION_CONFIG_DEFAULTS[key], NOTIFICATION_CONFIG_MAX[key]),
    ]),
  ) as Record<NotificationConfigKey, ReturnType<typeof boundedInt>>,
);

export type NotificationsConfig = Readonly<Record<NotificationConfigKey, number>>;

/**
 * Reads `NOTIFICATION_<KEY>` values through ConfigService and validates them
 * once at startup (finite positive integers within `NOTIFICATION_CONFIG_MAX`);
 * a malformed value fails the boot instead of silently falling back.
 */
export function loadNotificationsConfig(
  config: ConfigService,
): NotificationsConfig {
  const raw = Object.fromEntries(
    keys.map((key) => {
      const value = config.get<string>(`NOTIFICATION_${key}`);
      return [key, value === undefined || value === '' ? undefined : value];
    }),
  );
  const parsed = configSchema.safeParse(raw);
  if (!parsed.success) {
    const invalid = parsed.error.issues
      .map((issue) => `NOTIFICATION_${String(issue.path[0])}`)
      .join(', ');
    throw new Error(`Invalid notification configuration: ${invalid}`);
  }
  return Object.freeze(parsed.data);
}
