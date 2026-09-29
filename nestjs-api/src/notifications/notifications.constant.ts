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

/**
 * Stored `dedupe_key` bound (`<type>:<caller key>`); mirrors
 * `ck_notification_dedupe_key` of migration 014.
 */
export const NOTIFICATION_DELIVERY_DEDUPE_KEY_MAX = 300;
export const NOTIFICATION_CORRELATION_ID_MAX = 100;

export const NOTIFICATION_PAGE_SIZE_DEFAULT = 20;
export const NOTIFICATION_PAGE_SIZE_MAX = 100;

/**
 * Queue job identity: `<prefix>-v<version>-<sha256 of the structured identity>`.
 * The identity is the namespaced event key plus the canonical (sorted, unique)
 * recipient set, so the same event for a different recipient set is a new job.
 * v1 jobs (`notification-<hash>`, event key only) may still sit in the queue
 * after an upgrade; they keep being processed and never collide with v2 IDs.
 */
export const NOTIFICATION_JOB_ID = {
  PREFIX: 'notification',
  IDENTITY_VERSION: 2,
  HASH_ALGORITHM: 'sha256',
} as const;

/** setTimeout/setInterval store their delay as a signed 32-bit integer. */
export const MAX_TIMER_DELAY_MS = 2_147_483_647;

/**
 * Defaults of the operational settings read through ConfigService (see
 * `notifications.config.ts`). Every value can be overridden by the env key of
 * the same name prefixed with `NOTIFICATION_`.
 */
export const NOTIFICATION_CONFIG_DEFAULTS = {
  ENQUEUE_TIMEOUT_MS: 2_000,
  /** Producer connection attempt timeout; the producer never waits for Redis. */
  PRODUCER_CONNECT_TIMEOUT_MS: 5_000,
  JOB_ATTEMPTS: 5,
  JOB_BACKOFF_MS: 2_000,
  WORKER_CONCURRENCY: 5,
  /** Completed jobs are kept this long, which is also the jobId dedupe window. */
  JOB_KEEP_COMPLETED_SEC: 24 * 60 * 60,
  /** Failed jobs stay inspectable and re-runnable this long. */
  JOB_KEEP_FAILED_SEC: 7 * 24 * 60 * 60,
  PUBLISH_TIMEOUT_MS: 2_000,
  /** Wait for the SUBSCRIBE acknowledgement of one connection generation. */
  PUBSUB_SUBSCRIBE_TIMEOUT_MS: 5_000,
  /** Delay before re-trying a failed or timed-out SUBSCRIBE on a live connection. */
  PUBSUB_SUBSCRIBE_RETRY_MS: 5_000,
  /** Bound for closing owned Redis clients on shutdown before forcing them. */
  REDIS_SHUTDOWN_TIMEOUT_MS: 3_000,
  SSE_HEARTBEAT_MS: 25_000,
  SSE_REVALIDATE_MS: 5 * 60_000,
  SSE_MAX_LIFETIME_MS: 60 * 60_000,
  SSE_MAX_CONNECTIONS_PER_USER: 5,
  SSE_MAX_BUFFERED_BYTES: 64 * 1024,
  SSE_SUBSCRIBE_TIMEOUT_MS: 3_000,
  SSE_RETRY_MS: 5_000,
  /** A graceful stream close that has not finished flushing is destroyed after this. */
  SSE_CLOSE_GRACE_MS: 5_000,
} as const;

export type NotificationConfigKey = keyof typeof NOTIFICATION_CONFIG_DEFAULTS;

/** Upper bounds validated at startup (all values are positive integers). */
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

/**
 * Fail-fast policy of the request-path clients (queue producer, Pub/Sub
 * publisher): one retry per command and no offline queue, so a request never
 * waits for Redis to come back. Workers keep the root policy
 * (`maxRetriesPerRequest: null`) and reconnect in the background.
 */
export const NOTIFICATION_FAIL_FAST_MAX_RETRIES_PER_REQUEST = 1;

/** Internal (process-local) events of the distribution service. */
export const NOTIFICATION_DISTRIBUTION_EVENT = {
  SIGNAL: 'signal',
  RESYNC: 'resync',
  SUBSCRIBED: 'subscribed',
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
  /** Internal only: the transport failed, so nothing is sent to the client. */
  TRANSPORT_ERROR: 'TRANSPORT_ERROR',
} as const;

export type NotificationStreamCloseReason =
  (typeof NOTIFICATION_STREAM_CLOSE_REASON)[keyof typeof NOTIFICATION_STREAM_CLOSE_REASON];

export const NOTIFICATION_ERROR_CODE = {
  NOT_FOUND: 'NOTIFICATION_NOT_FOUND',
  STREAM_LIMIT: 'NOTIFICATION_STREAM_LIMIT',
  STREAM_UNAVAILABLE: 'NOTIFICATION_STREAM_UNAVAILABLE',
} as const;

export const NOTIFICATIONS_CONFIG = Symbol('NOTIFICATIONS_CONFIG');
