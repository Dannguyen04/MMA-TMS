import { EventEmitter } from 'node:events';
import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Redis } from 'ioredis';
import {
  closeRedisClient,
  createRedisClient,
  resolveRedisConnection,
} from '../shared/config/redis.config.js';
import {
  NOTIFICATION_DISTRIBUTION_EVENT,
  NOTIFICATION_FAIL_FAST_MAX_RETRIES_PER_REQUEST,
  NOTIFICATION_SIGNAL_CHANNEL,
  NOTIFICATIONS_CONFIG,
} from './notifications.constant.js';
import type { NotificationsConfig } from './notifications.config.js';
import {
  notificationSignalSchema,
  type NotificationSignal,
} from './notifications.model.js';

const SUBSCRIBE_TIMED_OUT = Symbol('SUBSCRIBE_TIMED_OUT');

/**
 * Realtime fan-out between API instances. BullMQ consumers compete for jobs,
 * so the instance that stored a notification is usually not the one holding
 * the recipient's stream: every instance subscribes to one Redis channel and
 * routes each signal to its local connections. Pub/Sub is not durable; a
 * missed signal is recovered by the client re-reading PostgreSQL.
 *
 * Subscription lifecycle: ioredis emits `ready` before its automatic
 * re-subscribe is acknowledged, so auto-resubscribe is disabled and every
 * connection generation subscribes explicitly. The channel counts as live only
 * after the SUBSCRIBE acknowledgement of the current generation; a close or
 * reconnect starts a new generation, so a late acknowledgement or rejection of
 * an older one is ignored. A failed or timed-out SUBSCRIBE on a live
 * connection is retried after a fixed delay, one attempt at a time.
 */
@Injectable()
export class NotificationDistributionService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(NotificationDistributionService.name);
  private readonly events = new EventEmitter();
  private publisher?: Redis;
  private subscriber?: Redis;
  /** Bumped on every (re)connect and close of the subscriber connection. */
  private generation = 0;
  /** Generation whose SUBSCRIBE was acknowledged; undefined while not live. */
  private liveGeneration?: number;
  private everSubscribed = false;
  private retryTimer?: NodeJS.Timeout;
  private destroyed = false;

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
      maxRetriesPerRequest: NOTIFICATION_FAIL_FAST_MAX_RETRIES_PER_REQUEST,
      commandTimeout: this.settings.PUBLISH_TIMEOUT_MS,
    });
    // SUBSCRIBE is only sent on a ready connection, so nothing is buffered
    // while Redis is down; the connection itself keeps reconnecting.
    this.subscriber = createRedisClient(connection, {
      autoResubscribe: false,
      enableOfflineQueue: false,
    });

    this.publisher.on('error', (error: Error) =>
      this.logger.warn(`Notification publisher connection error (${error.name})`),
    );
    this.subscriber.on('error', (error: Error) =>
      this.logger.warn(`Notification subscriber connection error (${error.name})`),
    );
    this.subscriber.on('ready', () => {
      const generation = this.startGeneration();
      void this.subscribe(generation);
    });
    this.subscriber.on('close', () => this.startGeneration());
    this.subscriber.on('end', () => this.startGeneration());
    this.subscriber.on('message', (channel: string, raw: string) => {
      if (channel !== NOTIFICATION_SIGNAL_CHANNEL) return;
      this.handleMessage(raw);
    });
  }

  async onModuleDestroy(): Promise<void> {
    this.destroyed = true;
    this.startGeneration();
    this.events.removeAllListeners();
    const clients = [this.publisher, this.subscriber].filter(
      (client): client is Redis => client !== undefined,
    );
    await Promise.all(
      clients.map((client) =>
        closeRedisClient(client, this.settings.REDIS_SHUTDOWN_TIMEOUT_MS),
      ),
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

  /**
   * Resolves true once the channel subscription of the current connection is
   * acknowledged, false after the timeout or when `signal` aborts (the client
   * left), removing its listener in every case.
   */
  async waitUntilSubscribed(
    timeoutMs: number,
    signal?: AbortSignal,
  ): Promise<boolean> {
    if (this.isLive()) return true;
    if (signal?.aborted) return false;
    return new Promise<boolean>((resolve) => {
      const finish = (result: boolean) => {
        clearTimeout(timer);
        this.events.off(NOTIFICATION_DISTRIBUTION_EVENT.SUBSCRIBED, onSubscribed);
        signal?.removeEventListener('abort', onAbort);
        resolve(result);
      };
      const onSubscribed = () => finish(true);
      const onAbort = () => finish(false);
      const timer = setTimeout(() => finish(false), timeoutMs);
      timer.unref();
      this.events.on(NOTIFICATION_DISTRIBUTION_EVENT.SUBSCRIBED, onSubscribed);
      signal?.addEventListener('abort', onAbort, { once: true });
    });
  }

  onSignal(listener: (signal: NotificationSignal) => void): () => void {
    this.events.on(NOTIFICATION_DISTRIBUTION_EVENT.SIGNAL, listener);
    return () => this.events.off(NOTIFICATION_DISTRIBUTION_EVENT.SIGNAL, listener);
  }

  onResync(listener: () => void): () => void {
    this.events.on(NOTIFICATION_DISTRIBUTION_EVENT.RESYNC, listener);
    return () => this.events.off(NOTIFICATION_DISTRIBUTION_EVENT.RESYNC, listener);
  }

  private isLive(): boolean {
    return (
      this.liveGeneration !== undefined &&
      this.liveGeneration === this.generation &&
      this.subscriber?.status === 'ready'
    );
  }

  /** Invalidates the current subscription state and any pending retry. */
  private startGeneration(): number {
    this.generation += 1;
    this.liveGeneration = undefined;
    clearTimeout(this.retryTimer);
    this.retryTimer = undefined;
    return this.generation;
  }

  private isCurrent(generation: number): boolean {
    return (
      !this.destroyed &&
      generation === this.generation &&
      this.subscriber?.status === 'ready'
    );
  }

  private async subscribe(generation: number): Promise<void> {
    if (!this.subscriber || !this.isCurrent(generation)) return;
    let timer: NodeJS.Timeout | undefined;
    try {
      const outcome = await Promise.race([
        this.subscriber.subscribe(NOTIFICATION_SIGNAL_CHANNEL),
        new Promise<typeof SUBSCRIBE_TIMED_OUT>((resolve) => {
          timer = setTimeout(
            () => resolve(SUBSCRIBE_TIMED_OUT),
            this.settings.PUBSUB_SUBSCRIBE_TIMEOUT_MS,
          );
          timer.unref();
        }),
      ]);
      if (outcome === SUBSCRIBE_TIMED_OUT) {
        throw new Error('SUBSCRIBE acknowledgement timed out');
      }
    } catch (error) {
      if (!this.isCurrent(generation)) return;
      this.logger.error(
        `Notification signal subscription failed (${error instanceof Error ? error.name : 'Unknown'}); retrying`,
      );
      this.scheduleRetry(generation);
      return;
    } finally {
      clearTimeout(timer);
    }

    // A late acknowledgement of an older connection, or a second one for this
    // generation, must not mark the channel live or trigger another resync.
    if (!this.isCurrent(generation) || this.liveGeneration === generation) {
      return;
    }
    this.liveGeneration = generation;
    clearTimeout(this.retryTimer);
    this.retryTimer = undefined;
    const isResubscription = this.everSubscribed;
    this.everSubscribed = true;
    this.events.emit(NOTIFICATION_DISTRIBUTION_EVENT.SUBSCRIBED);
    // Signals published while the channel was not live are lost; local
    // clients re-read their inbox once per successful re-subscription.
    if (isResubscription) this.events.emit(NOTIFICATION_DISTRIBUTION_EVENT.RESYNC);
  }

  private scheduleRetry(generation: number): void {
    if (this.retryTimer) return;
    this.retryTimer = setTimeout(() => {
      this.retryTimer = undefined;
      void this.subscribe(generation);
    }, this.settings.PUBSUB_SUBSCRIBE_RETRY_MS);
    this.retryTimer.unref();
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
    try {
      this.events.emit(NOTIFICATION_DISTRIBUTION_EVENT.SIGNAL, parsed.data);
    } catch {
      this.logger.warn('A notification signal listener failed');
    }
  }
}
