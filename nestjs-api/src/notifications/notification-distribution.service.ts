import { EventEmitter } from 'node:events';
import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis, type RedisOptions } from 'ioredis';
import {
  resolveRedisConnection,
  type RedisConnectionSettings,
} from '../shared/config/redis.config.js';
import {
  NOTIFICATION_SIGNAL_CHANNEL,
  NOTIFICATIONS_CONFIG,
} from './notifications.constant.js';
import type { NotificationsConfig } from './notifications.config.js';
import {
  notificationSignalSchema,
  type NotificationSignal,
} from './notifications.model.js';

const SIGNAL = 'signal';
const RESYNC = 'resync';
const SUBSCRIBED = 'subscribed';

function createRedisClient(
  settings: RedisConnectionSettings,
  overrides: RedisOptions,
): Redis {
  if ('url' in settings) {
    return new Redis(settings.url, { tls: settings.tls, ...overrides });
  }
  return new Redis({ ...settings, ...overrides });
}

/**
 * Realtime fan-out between API instances. BullMQ consumers compete for jobs,
 * so the instance that stored a notification is usually not the one holding
 * the recipient's stream: every instance subscribes to one Redis channel and
 * routes each signal to its local connections. Pub/Sub is not durable; a
 * missed signal is recovered by the client re-reading PostgreSQL.
 */
@Injectable()
export class NotificationDistributionService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(NotificationDistributionService.name);
  private readonly events = new EventEmitter();
  private publisher?: Redis;
  private subscriber?: Redis;
  private subscribed = false;
  private everSubscribed = false;

  constructor(
    private readonly config: ConfigService,
    @Inject(NOTIFICATIONS_CONFIG)
    private readonly settings: NotificationsConfig,
  ) {
    this.events.setMaxListeners(0);
  }

  onModuleInit(): void {
    const connection = resolveRedisConnection(this.config);

    // Publishing fails fast while Redis is unreachable: the worker then retries
    // the job, and a read-state sync is simply skipped.
    this.publisher = createRedisClient(connection, {
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
      commandTimeout: this.settings.PUBLISH_TIMEOUT_MS,
    });
    // The subscription command waits for Redis instead of giving up, so an
    // instance started while Redis is down subscribes once it comes back.
    this.subscriber = createRedisClient(connection, {
      maxRetriesPerRequest: null,
    });

    this.publisher.on('error', (error: Error) =>
      this.logger.warn(`Notification publisher connection error (${error.name})`),
    );
    this.subscriber.on('error', (error: Error) =>
      this.logger.warn(`Notification subscriber connection error (${error.name})`),
    );
    this.subscriber.on('close', () => {
      this.subscribed = false;
    });
    // ioredis re-subscribes on reconnect. Signals published during the gap are
    // lost, so local clients are told to re-read their inbox.
    this.subscriber.on('ready', () => {
      if (!this.everSubscribed) return;
      this.markSubscribed();
      this.events.emit(RESYNC);
    });
    this.subscriber.on('message', (channel: string, raw: string) => {
      if (channel !== NOTIFICATION_SIGNAL_CHANNEL) return;
      this.handleMessage(raw);
    });

    this.subscriber.subscribe(NOTIFICATION_SIGNAL_CHANNEL).then(
      () => {
        this.everSubscribed = true;
        this.markSubscribed();
      },
      (error: Error) =>
        this.logger.error(
          `Notification signal subscription failed (${error.name}); streams stay unavailable until Redis reconnects`,
        ),
    );
  }

  async onModuleDestroy(): Promise<void> {
    this.events.removeAllListeners();
    const clients = [this.publisher, this.subscriber].filter(
      (client): client is Redis => client !== undefined,
    );
    await Promise.all(
      clients.map((client) => client.quit().catch(() => client.disconnect())),
    );
  }

  /** Publishes a signal. Rejects when Redis is unreachable; zero subscribers is not an error. */
  async publish(signal: NotificationSignal): Promise<void> {
    if (!this.publisher) throw new Error('Notification publisher not initialised');
    await this.publisher.publish(
      NOTIFICATION_SIGNAL_CHANNEL,
      JSON.stringify(signal),
    );
  }

  /** Resolves once the channel subscription is live, or false after the timeout. */
  async waitUntilSubscribed(timeoutMs: number): Promise<boolean> {
    if (this.subscribed) return true;
    return new Promise<boolean>((resolve) => {
      const onSubscribed = () => {
        clearTimeout(timer);
        resolve(true);
      };
      const timer = setTimeout(() => {
        this.events.off(SUBSCRIBED, onSubscribed);
        resolve(false);
      }, timeoutMs);
      timer.unref();
      this.events.once(SUBSCRIBED, onSubscribed);
    });
  }

  onSignal(listener: (signal: NotificationSignal) => void): () => void {
    this.events.on(SIGNAL, listener);
    return () => this.events.off(SIGNAL, listener);
  }

  onResync(listener: () => void): () => void {
    this.events.on(RESYNC, listener);
    return () => this.events.off(RESYNC, listener);
  }

  private markSubscribed(): void {
    this.subscribed = true;
    this.events.emit(SUBSCRIBED);
  }

  private handleMessage(raw: string): void {
    let decoded: unknown;
    try {
      decoded = JSON.parse(raw);
    } catch {
      this.logger.warn('Ignored a notification signal that is not JSON');
      return;
    }
    const parsed = notificationSignalSchema.safeParse(decoded);
    if (!parsed.success) {
      this.logger.warn('Ignored a notification signal with an invalid shape');
      return;
    }
    this.events.emit(SIGNAL, parsed.data);
  }
}
