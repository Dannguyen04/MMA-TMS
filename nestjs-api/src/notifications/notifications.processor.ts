import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { type Job, UnrecoverableError } from 'bullmq';
import { NotificationDistributionService } from './notification-distribution.service.js';
import {
  NOTIFICATION_JOB,
  NOTIFICATION_SIGNAL_KIND,
  NOTIFICATIONS_CONFIG,
  NOTIFICATIONS_QUEUE,
} from './notifications.constant.js';
import type { NotificationsConfig } from './notifications.config.js';
import { deliveryJobSchema } from './notifications.model.js';
import { NotificationsRepository } from './notifications.repo.js';

interface DeliveryResult {
  stored: number;
  skippedRecipients: number;
}

/**
 * validate job → create or reuse one row per recipient → commit → publish the
 * realtime signal. Storage always precedes publishing. A publish failure fails
 * the attempt so the retry re-publishes the already stored rows (the insert is
 * a no-op on the dedupe index). An offline user or a channel without
 * subscribers is not a failure: the inbox row is the delivery of record.
 */
@Processor(NOTIFICATIONS_QUEUE)
export class NotificationsProcessor
  extends WorkerHost
  implements OnApplicationBootstrap
{
  private readonly logger = new Logger(NotificationsProcessor.name);

  constructor(
    private readonly repository: NotificationsRepository,
    private readonly distribution: NotificationDistributionService,
    @Inject(NOTIFICATIONS_CONFIG)
    private readonly settings: NotificationsConfig,
  ) {
    super();
  }

  onApplicationBootstrap(): void {
    this.worker.concurrency = this.settings.WORKER_CONCURRENCY;
  }

  async process(job: Job<unknown, DeliveryResult>): Promise<DeliveryResult> {
    if (job.name !== NOTIFICATION_JOB.DELIVER) {
      throw new UnrecoverableError('Unknown notification job name');
    }
    // Re-validated here: the queue is a trust boundary and the payload may have
    // been written by another release.
    const parsed = deliveryJobSchema.safeParse(job.data);
    if (!parsed.success) {
      throw new UnrecoverableError('Invalid notification job payload');
    }
    const delivery = parsed.data;

    const deliverable = await this.repository.findDeliverableUserIds(
      delivery.recipientUserIds,
    );
    const skippedRecipients =
      delivery.recipientUserIds.length - deliverable.length;
    if (skippedRecipients > 0) {
      this.logger.warn({
        event: 'notification.recipients_skipped',
        jobId: job.id,
        type: delivery.type,
        skippedRecipients,
        correlationId: delivery.correlationId,
      });
    }

    const rows = await this.repository.insertOrReuse(delivery, deliverable);
    if (rows.length > 0) {
      await this.distribution.publish({
        kind: NOTIFICATION_SIGNAL_KIND.CREATED,
        deliveries: rows.map((row) => ({
          userId: row.userId,
          notificationId: row.id,
        })),
      });
    }
    return { stored: rows.length, skippedRecipients };
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job | undefined, error: Error): void {
    this.logger.error({
      event: 'notification.job_failed',
      jobId: job?.id,
      attemptsMade: job?.attemptsMade,
      maxAttempts: job?.opts.attempts,
      errorType: error.name,
      unrecoverable: error instanceof UnrecoverableError,
    });
  }
}
