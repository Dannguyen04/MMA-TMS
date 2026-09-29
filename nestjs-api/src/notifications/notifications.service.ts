import { createHash } from 'node:crypto';
import { InjectQueue } from '@nestjs/bullmq';
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Queue } from 'bullmq';
import type {
  NotificationPublisher,
  NotifyContext,
  NotifyInput,
  NotifyResult,
} from '../shared/contracts/notification.contract.js';
import type { AuthenticatedUser } from '../shared/models/auth-context.model.js';
import { NotificationDistributionService } from './notification-distribution.service.js';
import {
  NOTIFICATION_JOB,
  NOTIFICATION_PAYLOAD_VERSION,
  NOTIFICATION_SIGNAL_KIND,
  NOTIFICATIONS_CONFIG,
  NOTIFICATIONS_QUEUE,
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
} from './notifications.model.js';
import {
  NotificationsRepository,
  type NotificationRow,
} from './notifications.repo.js';

const ENQUEUE_TIMED_OUT = Symbol('ENQUEUE_TIMED_OUT');

/**
 * Notification facade (post-commit enqueue) and the caller's own inbox use
 * cases. Background storage and realtime publishing live in the processor.
 */
@Injectable()
export class NotificationsService implements NotificationPublisher {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectQueue(NOTIFICATIONS_QUEUE) private readonly queue: Queue,
    private readonly repository: NotificationsRepository,
    private readonly distribution: NotificationDistributionService,
    @Inject(NOTIFICATIONS_CONFIG)
    private readonly settings: NotificationsConfig,
  ) {}

  // ── Publisher (shared contract) ───────────────────────────────────────────

  async notify(
    input: NotifyInput,
    context: NotifyContext = {},
  ): Promise<NotifyResult> {
    const recipients = [...new Set(input.recipientUserIds)].filter(
      (userId) => userId !== input.actorUserId,
    );
    if (recipients.length === 0) {
      return { status: 'skipped', reason: 'NO_RECIPIENTS' };
    }

    const job = this.buildJob(input, recipients, context);
    if (!job) {
      this.logFailure(input, 'INVALID_INPUT', context);
      return { status: 'failed', reason: 'INVALID_INPUT' };
    }

    let timer: NodeJS.Timeout | undefined;
    try {
      const timeout = new Promise<typeof ENQUEUE_TIMED_OUT>((resolve) => {
        timer = setTimeout(
          () => resolve(ENQUEUE_TIMED_OUT),
          this.settings.ENQUEUE_TIMEOUT_MS,
        );
      });
      // The jobId is derived from the event identity, so a second enqueue of
      // the same event (for example after an ambiguous timeout) is ignored by
      // BullMQ while the first job is retained.
      const enqueue = this.queue.add(NOTIFICATION_JOB.DELIVER, job, {
        jobId: this.jobId(job.dedupeKey),
        attempts: this.settings.JOB_ATTEMPTS,
        backoff: { type: 'exponential', delay: this.settings.JOB_BACKOFF_MS },
        removeOnComplete: { age: this.settings.JOB_KEEP_COMPLETED_SEC },
        removeOnFail: { age: this.settings.JOB_KEEP_FAILED_SEC },
      });
      const outcome = await Promise.race([enqueue, timeout]);
      if (outcome === ENQUEUE_TIMED_OUT) {
        // Unknown state: Redis may still accept the job later. The dedupe key
        // keeps a later retry of the same event harmless.
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
    return Promise.all(inputs.map((input) => this.notify(input, context)));
  }

  // ── Inbox (self-scoped) ───────────────────────────────────────────────────

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

  async unreadCount(user: AuthenticatedUser): Promise<{ count: number }> {
    return { count: await this.repository.countUnread(user.id) };
  }

  /**
   * Idempotent: an already-read notification is returned unchanged with its
   * first `readAt`. Another user's notification is reported as not found.
   */
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

    // Keeps the user's other tabs/devices in sync. Best effort: the state is
    // already committed and clients reconcile from the REST API.
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

  // ── Internals ─────────────────────────────────────────────────────────────

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
      // Namespaced by type so two notifications of one event never collide on
      // (user_id, dedupe_key).
      dedupeKey: `${input.type}:${dedupeKey.data}`,
      ...(context.correlationId ? { correlationId: context.correlationId } : {}),
    });
    return parsed.success ? parsed.data : undefined;
  }

  /** BullMQ custom IDs must not contain ':'; a digest keeps them bounded too. */
  private jobId(dedupeKey: string): string {
    return `notification-${createHash('sha256').update(dedupeKey).digest('hex')}`;
  }

  private logFailure(
    input: NotifyInput,
    reason: string,
    context: NotifyContext,
    error?: unknown,
  ): void {
    this.logger.warn({
      event: 'notification.enqueue_failed',
      reason,
      type: input.type,
      dedupeKey: input.dedupeKey,
      recipientCount: input.recipientUserIds.length,
      errorType: error instanceof Error ? error.name : undefined,
      correlationId: context.correlationId,
    });
  }

  private toView(row: NotificationRow): NotificationView {
    return {
      id: row.id,
      type: row.type,
      title: row.title,
      message: row.message,
      payload: (row.payload ?? {}) as Record<string, unknown>,
      isRead: row.isRead,
      readAt: row.readAt ? row.readAt.toISOString() : null,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
