export const NOTIFICATIONS_QUEUE = 'notifications';

export const NOTIFICATION_JOB = {
  DELIVER: 'deliver',
} as const;

export const NOTIFICATION_PAYLOAD_VERSION = 1;

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

/** Mirrors `ck_notification_dedupe_key` (migration 014) for `<type>:<caller key>`. */
export const NOTIFICATION_DELIVERY_DEDUPE_KEY_MAX = 300;
export const NOTIFICATION_CORRELATION_ID_MAX = 100;

export const NOTIFICATION_PAGE_SIZE_DEFAULT = 20;
export const NOTIFICATION_PAGE_SIZE_MAX = 100;

// v2 hashes the event key and canonical recipient set; queued v1 IDs (event key
// only) keep being processed and never collide with v2.
export const NOTIFICATION_JOB_ID = {
  PREFIX: 'notification',
  IDENTITY_VERSION: 2,
  HASH_ALGORITHM: 'sha256',
} as const;

/** Timers store their delay as a signed 32-bit integer. */
export const MAX_TIMER_DELAY_MS = 2_147_483_647;

/** Each key is overridable through `NOTIFICATION_<KEY>` (see notifications.config.ts). */
export const NOTIFICATION_CONFIG_DEFAULTS = {
  ENQUEUE_TIMEOUT_MS: 2_000,
  PRODUCER_CONNECT_TIMEOUT_MS: 5_000,
  JOB_ATTEMPTS: 5,
  JOB_BACKOFF_MS: 2_000,
  WORKER_CONCURRENCY: 5,
  /** Also the jobId dedupe window. */
  JOB_KEEP_COMPLETED_SEC: 24 * 60 * 60,
  JOB_KEEP_FAILED_SEC: 7 * 24 * 60 * 60,
  PUBLISH_TIMEOUT_MS: 2_000,
  PUBSUB_SUBSCRIBE_TIMEOUT_MS: 5_000,
  PUBSUB_SUBSCRIBE_RETRY_MS: 5_000,
  REDIS_SHUTDOWN_TIMEOUT_MS: 3_000,
  SSE_HEARTBEAT_MS: 25_000,
  SSE_REVALIDATE_MS: 5 * 60_000,
  SSE_MAX_LIFETIME_MS: 60 * 60_000,
  SSE_MAX_CONNECTIONS_PER_USER: 5,
  SSE_MAX_BUFFERED_BYTES: 64 * 1024,
  SSE_SUBSCRIBE_TIMEOUT_MS: 3_000,
  SSE_RETRY_MS: 5_000,
  SSE_CLOSE_GRACE_MS: 5_000,
} as const;

export type NotificationConfigKey = keyof typeof NOTIFICATION_CONFIG_DEFAULTS;

export const NOTIFICATION_CONFIG_MAX: Readonly<
  Record<NotificationConfigKey, number>
> = {
  ENQUEUE_TIMEOUT_MS: 60_000,
  PRODUCER_CONNECT_TIMEOUT_MS: 60_000,
  JOB_ATTEMPTS: 100,
  JOB_BACKOFF_MS: 60 * 60_000,
  WORKER_CONCURRENCY: 100,
  JOB_KEEP_COMPLETED_SEC: 90 * 24 * 60 * 60,
  JOB_KEEP_FAILED_SEC: 90 * 24 * 60 * 60,
  PUBLISH_TIMEOUT_MS: 60_000,
  PUBSUB_SUBSCRIBE_TIMEOUT_MS: 60_000,
  PUBSUB_SUBSCRIBE_RETRY_MS: 10 * 60_000,
  REDIS_SHUTDOWN_TIMEOUT_MS: 60_000,
  SSE_HEARTBEAT_MS: 10 * 60_000,
  SSE_REVALIDATE_MS: 24 * 60 * 60_000,
  SSE_MAX_LIFETIME_MS: 7 * 24 * 60 * 60_000,
  SSE_MAX_CONNECTIONS_PER_USER: 100,
  SSE_MAX_BUFFERED_BYTES: 16 * 1024 * 1024,
  SSE_SUBSCRIBE_TIMEOUT_MS: 60_000,
  SSE_RETRY_MS: 10 * 60_000,
  SSE_CLOSE_GRACE_MS: 60_000,
};

// Request-path clients fail fast so a request never waits for Redis; workers
// keep the root policy (`maxRetriesPerRequest: null`).
export const NOTIFICATION_FAIL_FAST_MAX_RETRIES_PER_REQUEST = 1;

export const NOTIFICATION_DISTRIBUTION_EVENT = {
  SIGNAL: 'signal',
  RESYNC: 'resync',
  SUBSCRIBED: 'subscribed',
} as const;

export const NOTIFICATION_SIGNAL_CHANNEL = 'mma-tms:notifications:signals';

export const NOTIFICATION_SIGNAL_KIND = {
  CREATED: 'created',
  READ: 'read',
} as const;

/** SSE client contract (FE flows §12.2). */
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
  /** Internal only; never sent to the client. */
  TRANSPORT_ERROR: 'TRANSPORT_ERROR',
} as const;

export type NotificationStreamCloseReason =
  (typeof NOTIFICATION_STREAM_CLOSE_REASON)[keyof typeof NOTIFICATION_STREAM_CLOSE_REASON];

export const NOTIFICATION_RESPONSE_MESSAGE = {
  LIST: 'Get notifications successfully',
  UNREAD_COUNT: 'Get unread notification count successfully',
  MARK_READ: 'Mark notification as read successfully',
} as const;

export const NOTIFICATIONS_CONFIG = Symbol('NOTIFICATIONS_CONFIG');
