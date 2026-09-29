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
    private readonly producer: NotificationProducer,
    private readonly repository: NotificationsRepository,
    private readonly distribution: NotificationDistributionService,
    @Inject(NOTIFICATIONS_CONFIG)
    private readonly settings: NotificationsConfig,
  ) {}

  // ── Publisher (shared contract) ───────────────────────────────────────────

  /**
   * Never throws: normalization, validation and enqueue all sit inside one
   * error boundary, so a notification problem cannot reach the committed
   * business response.
   */
  async notify(
    input: NotifyInput,
    context: NotifyContext = {},
  ): Promise<NotifyResult> {
    let timer: NodeJS.Timeout | undefined;
    try {
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
      // The producer fails fast while Redis is down and bounds each command,
      // so no pending work outlives this call for long. The race only bounds
      // the caller's wait on top of that.
      const outcome = await Promise.race([
        this.producer.add(job, this.jobId(job)),
        timeout,
      ]);
      if (outcome === ENQUEUE_TIMED_OUT) {
        // Unknown state: Redis may still have stored the job. A later enqueue
        // of the same event and recipients maps to the same jobId, and the DB
        // dedupe index keeps any overlap harmless.
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

  /**
   * Deterministic queue identity of one event for one recipient set: the same
   * event re-sent to the same recipients (in any order, with duplicates) maps
   * to the same job, while the same event for another set is a new job, so no
   * recipient is silently dropped. Content is not part of the identity: an
   * event key stands for immutable content. The structured (JSON array)
   * serialization avoids delimiter ambiguity; the hex digest keeps the ID
   * free of ':' and bounded, as BullMQ requires. Re-enqueueing an ID that is
   * still retained (completed or failed) is ignored by BullMQ and does not
   * retry a failed job.
   */
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

  /** Logs identifiers only; must not throw even for a malformed input. */
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
      payload: (row.payload ?? {}) as Record<string, unknown>,
      isRead: row.isRead,
      readAt: row.readAt ? row.readAt.toISOString() : null,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
