import { createHash } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import type {
  NotificationPublisher,
  NotifyContext,
  NotifyInput,
  NotifyResult,
} from '../shared/contracts/notification.contract.js';
import type { AuthenticatedUser } from '../shared/models/auth-context.model.js';
import { NotificationDistributionService } from './notification-distribution.service.js';
import { NotificationProducer } from './notification-producer.service.js';
import {
  NOTIFICATION_JOB_ID,
  NOTIFICATION_PAYLOAD_VERSION,
  NOTIFICATION_SIGNAL_KIND,
  NOTIFICATIONS_CONFIG,
} from './notifications.constant.js';
import type { NotificationsConfig } from './notifications.config.js';
import { notificationNotFound } from './notifications.error.js';
import {
  callerDedupeKeySchema,
  deliveryJobSchema,
  type DeliveryJob,
  type ListNotificationsQuery,
  type NotificationPage,
  type NotificationView,
  type UnreadCount,
} from './notifications.model.js';
import {
  NotificationsRepository,
  type NotificationRow,
} from './notifications.repo.js';

const ENQUEUE_TIMED_OUT = Symbol('ENQUEUE_TIMED_OUT');

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

@Injectable()
export class NotificationsService implements NotificationPublisher {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly producer: NotificationProducer,
    private readonly repository: NotificationsRepository,
    private readonly distribution: NotificationDistributionService,
    @Inject(NOTIFICATIONS_CONFIG)
    private readonly settings: NotificationsConfig,
  ) {}

  /** Never throws, so a notification problem cannot reach the committed business response. */
  async notify(
    input: NotifyInput,
    context: NotifyContext = {},
  ): Promise<NotifyResult> {
    let timer: NodeJS.Timeout | undefined;
    try {
      // Checked before normalizing so malformed input is INVALID_INPUT, not an enqueue failure.
      const requested: unknown = input?.recipientUserIds;
      if (!Array.isArray(requested)) {
        this.logFailure(input, 'INVALID_INPUT', context);
        return { status: 'failed', reason: 'INVALID_INPUT' };
      }
      // Canonical recipient set: unique, actor removed, stably sorted.
      const recipients = [...new Set(input.recipientUserIds)]
        .filter((userId) => userId !== input.actorUserId)
        .sort();
      if (recipients.length === 0) {
        return { status: 'skipped', reason: 'NO_RECIPIENTS' };
      }

      const job = this.buildJob(input, recipients, context);
      if (!job) {
        this.logFailure(input, 'INVALID_INPUT', context);
        return { status: 'failed', reason: 'INVALID_INPUT' };
      }

      const timeout = new Promise<typeof ENQUEUE_TIMED_OUT>((resolve) => {
        timer = setTimeout(
          () => resolve(ENQUEUE_TIMED_OUT),
          this.settings.ENQUEUE_TIMEOUT_MS,
        );
      });
      // The producer already bounds each command; the race only bounds the caller's wait.
      const outcome = await Promise.race([
        this.producer.add(job, this.jobId(job)),
        timeout,
      ]);
      if (outcome === ENQUEUE_TIMED_OUT) {
        // Unknown outcome: Redis may still store the job; the same jobId and the DB
        // dedupe index keep a later retry harmless.
        this.logFailure(input, 'ENQUEUE_TIMEOUT', context);
        return { status: 'failed', reason: 'ENQUEUE_TIMEOUT' };
      }
      return { status: 'queued' };
    } catch (error) {
      this.logFailure(input, 'ENQUEUE_FAILED', context, error);
      return { status: 'failed', reason: 'ENQUEUE_FAILED' };
    } finally {
      clearTimeout(timer);
    }
  }

  async notifyResolved(
    resolve: () => Promise<readonly NotifyInput[]>,
    context: NotifyContext = {},
  ): Promise<readonly NotifyResult[]> {
    let inputs: readonly NotifyInput[];
    try {
      inputs = await resolve();
    } catch (error) {
      this.logger.warn({
        event: 'notification.recipient_resolution_failed',
        errorType: error instanceof Error ? error.name : 'Unknown',
        correlationId: context.correlationId,
      });
      return [{ status: 'failed', reason: 'RECIPIENT_RESOLUTION_FAILED' }];
    }
    try {
      return await Promise.all(
        inputs.map((input) => this.notify(input, context)),
      );
    } catch (error) {
      // notify() does not throw; this guards a malformed resolver result.
      this.logger.warn({
        event: 'notification.dispatch_failed',
        errorType: error instanceof Error ? error.name : 'Unknown',
        correlationId: context.correlationId,
      });
      return [{ status: 'failed', reason: 'INVALID_INPUT' }];
    }
  }

  async list(
    user: AuthenticatedUser,
    query: ListNotificationsQuery,
  ): Promise<NotificationPage> {
    const { items, total } = await this.repository.listForUser(user.id, query);
    return {
      data: items.map((row) => this.toView(row)),
      total,
      hasNextPage: query.page * query.limit < total,
    };
  }

  async unreadCount(user: AuthenticatedUser): Promise<UnreadCount> {
    return { count: await this.repository.countUnread(user.id) };
  }

  /** Idempotent (keeps the first `readAt`); another user's row is reported as not found. */
  async markRead(
    user: AuthenticatedUser,
    notificationId: string,
  ): Promise<NotificationView> {
    const updated = await this.repository.markRead(notificationId, user.id);
    if (!updated) {
      const existing = await this.repository.findForUser(
        notificationId,
        user.id,
      );
      if (!existing) throw notificationNotFound();
      return this.toView(existing);
    }

    // Best effort: the state is committed and other tabs reconcile from REST.
    try {
      await this.distribution.publish({
        kind: NOTIFICATION_SIGNAL_KIND.READ,
        userId: user.id,
        notificationId,
      });
    } catch (error) {
      this.logger.warn({
        event: 'notification.read_sync_failed',
        errorType: error instanceof Error ? error.name : 'Unknown',
      });
    }
    return this.toView(updated);
  }

  private buildJob(
    input: NotifyInput,
    recipients: readonly string[],
    context: NotifyContext,
  ): DeliveryJob | undefined {
    const dedupeKey = callerDedupeKeySchema.safeParse(input.dedupeKey);
    if (!dedupeKey.success) return undefined;
    const parsed = deliveryJobSchema.safeParse({
      recipientUserIds: recipients,
      type: input.type,
      title: input.title,
      message: input.message,
      payload: {
        v: NOTIFICATION_PAYLOAD_VERSION,
        ...(input.target ? { target: input.target } : {}),
        ...(input.data ? { data: input.data } : {}),
      },
      // Namespaced by type so two notifications of one event never collide.
      dedupeKey: `${input.type}:${dedupeKey.data}`,
      ...(context.correlationId ? { correlationId: context.correlationId } : {}),
    });
    return parsed.success ? parsed.data : undefined;
  }

  // Same event + same recipient set = same job, a new set is a new job, so no
  // recipient is dropped. BullMQ ignores a retained ID: it never retries a failed job.
  private jobId(job: DeliveryJob): string {
    const identity = JSON.stringify([
      NOTIFICATION_JOB_ID.IDENTITY_VERSION,
      job.dedupeKey,
      job.recipientUserIds,
    ]);
    const digest = createHash(NOTIFICATION_JOB_ID.HASH_ALGORITHM)
      .update(identity)
      .digest('hex');
    return `${NOTIFICATION_JOB_ID.PREFIX}-v${NOTIFICATION_JOB_ID.IDENTITY_VERSION}-${digest}`;
  }

  /** Identifiers only; must not throw even for a malformed input. */
  private logFailure(
    input: NotifyInput,
    reason: string,
    context: NotifyContext,
    error?: unknown,
  ): void {
    const recipients: unknown = input?.recipientUserIds;
    this.logger.warn({
      event: 'notification.enqueue_failed',
      reason,
      type: typeof input?.type === 'string' ? input.type : undefined,
      dedupeKey:
        typeof input?.dedupeKey === 'string' ? input.dedupeKey : undefined,
      recipientCount: Array.isArray(recipients) ? recipients.length : undefined,
      errorType: error instanceof Error ? error.name : undefined,
      correlationId: context?.correlationId,
    });
  }

  private toView(row: NotificationRow): NotificationView {
    return {
      id: row.id,
      type: row.type,
      title: row.title,
      message: row.message,
      // Legacy rows may hold any keys, so the delivery schema is not applied.
      payload: isJsonObject(row.payload) ? row.payload : {},
      isRead: row.isRead,
      readAt: row.readAt ? row.readAt.toISOString() : null,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
