export const NOTIFICATIONS_QUEUE = 'notifications';

export const NOTIFICATION_JOB = {
  DELIVER: 'deliver',
} as const;

/** Version of the stored `payload` envelope (`{ v, target?, data? }`). */
export const NOTIFICATION_PAYLOAD_VERSION = 1;

/** Input and payload bounds enforced by the facade and again by the worker. */
export const NOTIFICATION_LIMITS = {
  TITLE_MAX: 200,
  MESSAGE_MAX: 1000,
  DEDUPE_KEY_MAX: 200,
  RECIPIENTS_MAX: 500,
  DATA_MAX_KEYS: 20,
  DATA_KEY_MAX: 64,
  DATA_STRING_MAX: 300,
  PAYLOAD_MAX_BYTES: 4096,
} as const;

export const NOTIFICATION_PAGE_SIZE_DEFAULT = 20;
export const NOTIFICATION_PAGE_SIZE_MAX = 100;

/**
 * Defaults of the operational settings read through ConfigService (see
 * `notifications.config.ts`). Every value can be overridden by the env key of
 * the same name prefixed with `NOTIFICATION_`.
 */
export const NOTIFICATION_CONFIG_DEFAULTS = {
  ENQUEUE_TIMEOUT_MS: 2_000,
  JOB_ATTEMPTS: 5,
  JOB_BACKOFF_MS: 2_000,
  WORKER_CONCURRENCY: 5,
  /** Completed jobs are kept this long, which is also the jobId dedupe window. */
  JOB_KEEP_COMPLETED_SEC: 24 * 60 * 60,
  /** Failed jobs stay inspectable and re-runnable this long. */
  JOB_KEEP_FAILED_SEC: 7 * 24 * 60 * 60,
  PUBLISH_TIMEOUT_MS: 2_000,
  SSE_HEARTBEAT_MS: 25_000,
  SSE_REVALIDATE_MS: 5 * 60_000,
  SSE_MAX_LIFETIME_MS: 60 * 60_000,
  SSE_MAX_CONNECTIONS_PER_USER: 5,
  SSE_MAX_BUFFERED_BYTES: 64 * 1024,
  SSE_SUBSCRIBE_TIMEOUT_MS: 3_000,
  SSE_RETRY_MS: 5_000,
} as const;

/** Redis Pub/Sub channel carrying realtime signals to every API instance. */
export const NOTIFICATION_SIGNAL_CHANNEL = 'mma-tms:notifications:signals';

export const NOTIFICATION_SIGNAL_KIND = {
  CREATED: 'created',
  READ: 'read',
} as const;

/** SSE `event:` names. Part of the client contract; see the FE flow document. */
export const NOTIFICATION_STREAM_EVENT = {
  READY: 'ready',
  CREATED: 'notification.created',
  READ: 'notification.read',
  RESYNC: 'resync',
  HEARTBEAT: 'heartbeat',
  CLOSING: 'closing',
} as const;

export const NOTIFICATION_STREAM_CLOSE_REASON = {
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  AUTH_REVOKED: 'AUTH_REVOKED',
  LIFETIME_REACHED: 'LIFETIME_REACHED',
  SLOW_CONSUMER: 'SLOW_CONSUMER',
  SERVER_SHUTDOWN: 'SERVER_SHUTDOWN',
} as const;

export type NotificationStreamCloseReason =
  (typeof NOTIFICATION_STREAM_CLOSE_REASON)[keyof typeof NOTIFICATION_STREAM_CLOSE_REASON];

export const NOTIFICATION_ERROR_CODE = {
  NOT_FOUND: 'NOTIFICATION_NOT_FOUND',
  STREAM_LIMIT: 'NOTIFICATION_STREAM_LIMIT',
  STREAM_UNAVAILABLE: 'NOTIFICATION_STREAM_UNAVAILABLE',
} as const;

export const NOTIFICATIONS_CONFIG = Symbol('NOTIFICATIONS_CONFIG');
