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

// ioredis emits `ready` before auto-resubscribe is acknowledged, so each connection
// generation subscribes itself and is live only after its own SUBSCRIBE ACK.
@Injectable()
export class NotificationDistributionService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(NotificationDistributionService.name);
  private readonly events = new EventEmitter();
  private publisher?: Redis;
  private subscriber?: Redis;
  private generation = 0;
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

    // Fail fast: the worker retries the job and a read-state sync is skipped.
    this.publisher = createRedisClient(connection, {
      enableOfflineQueue: false,
      maxRetriesPerRequest: NOTIFICATION_FAIL_FAST_MAX_RETRIES_PER_REQUEST,
      commandTimeout: this.settings.PUBLISH_TIMEOUT_MS,
    });
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

  /** Zero subscribers is not an error. */
  async publish(signal: NotificationSignal): Promise<void> {
    if (!this.publisher) throw new Error('Notification publisher not initialised');
    await this.publisher.publish(
      NOTIFICATION_SIGNAL_CHANNEL,
      JSON.stringify(signal),
    );
  }

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

    // A stale or repeated ACK must not mark the channel live or resync again.
    if (!this.isCurrent(generation) || this.liveGeneration === generation) {
      return;
    }
    this.liveGeneration = generation;
    clearTimeout(this.retryTimer);
    this.retryTimer = undefined;
    const isResubscription = this.everSubscribed;
    this.everSubscribed = true;
    this.events.emit(NOTIFICATION_DISTRIBUTION_EVENT.SUBSCRIBED);
    // Signals sent while not live are lost; clients re-read once per re-subscription.
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
