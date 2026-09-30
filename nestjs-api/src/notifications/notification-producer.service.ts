import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue, type JobsOptions } from 'bullmq';
import type { Redis } from 'ioredis';
import {
  closeRedisClient,
  createRedisClient,
  resolveRedisConnection,
} from '../shared/config/redis.config.js';
import {
  NOTIFICATION_JOB,
  NOTIFICATION_FAIL_FAST_MAX_RETRIES_PER_REQUEST,
  NOTIFICATIONS_CONFIG,
  NOTIFICATIONS_QUEUE,
} from './notifications.constant.js';
import type { NotificationsConfig } from './notifications.config.js';
import type { DeliveryJob } from './notifications.model.js';

export class NotificationProducerUnavailableError extends Error {
  constructor() {
    super('Notification producer is not connected to Redis');
    this.name = 'NotificationProducerUnavailableError';
  }
}

// The root worker connection would let a request wait for Redis indefinitely;
// BullMQ is called only on a `ready` client because its readiness wait is unbounded.
@Injectable()
export class NotificationProducer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationProducer.name);
  private client?: Redis;
  private queue?: Queue;
  private queueFailed = false;

  constructor(
    private readonly config: ConfigService,
    @Inject(NOTIFICATIONS_CONFIG)
    private readonly settings: NotificationsConfig,
  ) {}

  onModuleInit(): void {
    this.client = createRedisClient(resolveRedisConnection(this.config), {
      maxRetriesPerRequest: NOTIFICATION_FAIL_FAST_MAX_RETRIES_PER_REQUEST,
      enableOfflineQueue: false,
      connectTimeout: this.settings.PRODUCER_CONNECT_TIMEOUT_MS,
      commandTimeout: this.settings.ENQUEUE_TIMEOUT_MS,
    });
    this.client.on('error', (error: Error) =>
      this.logger.warn(`Notification producer connection error (${error.name})`),
    );
    this.createQueue(this.client);
  }

  // A failed queue init stays rejected forever, so it is rebuilt on the next
  // enqueue. BullMQ never closes the shared client; this provider does.
  private createQueue(client: Redis): void {
    const queue = new Queue(NOTIFICATIONS_QUEUE, { connection: client });
    queue.on('error', (error: Error) =>
      this.logger.warn(`Notification producer queue error (${error.name})`),
    );
    this.queue = queue;
    this.queueFailed = false;
    queue.waitUntilReady().catch(() => {
      if (this.queue === queue) this.queueFailed = true;
    });
  }

  async onModuleDestroy(): Promise<void> {
    const timeoutMs = this.settings.REDIS_SHUTDOWN_TIMEOUT_MS;
    if (this.queue) {
      let timer: NodeJS.Timeout | undefined;
      await Promise.race([
        this.queue.close().catch(() => undefined),
        new Promise((resolve) => {
          timer = setTimeout(resolve, timeoutMs);
          timer.unref();
        }),
      ]);
      clearTimeout(timer);
    }
    if (this.client) await closeRedisClient(this.client, timeoutMs);
  }

  /** Rejects immediately while Redis is not connected, so no work accumulates. */
  async add(job: DeliveryJob, jobId: string): Promise<void> {
    if (!this.client || this.client.status !== 'ready') {
      throw new NotificationProducerUnavailableError();
    }
    if (!this.queue || this.queueFailed) {
      const previous = this.queue;
      this.createQueue(this.client);
      // Closing a queue on a shared connection leaves the client open.
      void previous?.close().catch(() => undefined);
    }
    if (!this.queue) throw new NotificationProducerUnavailableError();
    const options: JobsOptions = {
      jobId,
      attempts: this.settings.JOB_ATTEMPTS,
      backoff: { type: 'exponential', delay: this.settings.JOB_BACKOFF_MS },
      removeOnComplete: { age: this.settings.JOB_KEEP_COMPLETED_SEC },
      removeOnFail: { age: this.settings.JOB_KEEP_FAILED_SEC },
    };
    await this.queue.add(NOTIFICATION_JOB.DELIVER, job, options);
  }
}
