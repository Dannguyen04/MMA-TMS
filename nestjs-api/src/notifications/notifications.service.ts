import { Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '../shared/models/auth-context.model.js';
import { setAuditContext } from '../shared/utils/audit-context.util.js';
import { notificationNotFound } from './notifications.error.js';
import type {
  ListNotificationsQuery,
  NotificationCategory,
  NotificationPage,
  NotificationSeverity,
  NotificationSummary,
  PublicNotification,
} from './notifications.model.js';
import {
  type NotificationRecord,
  NotificationsRepository,
  type NotificationType,
} from './notifications.repo.js';

const notificationPresentation: Record<
  NotificationType,
  { category: NotificationCategory; severity: NotificationSeverity }
> = {
  ANOMALY_HIGH: { category: 'AI_ANALYSIS', severity: 'DANGER' },
  ANOMALY_MEDIUM: { category: 'AI_ANALYSIS', severity: 'WARNING' },
  SESSION_REMINDER: { category: 'TRAINING', severity: 'INFO' },
  MEDICAL_CLEARANCE_EXPIRY: {
    category: 'CLEARANCE',
    severity: 'WARNING',
  },
  VIDEO_PROCESSED: { category: 'AI_ANALYSIS', severity: 'SUCCESS' },
  SYSTEM: { category: 'SYSTEM', severity: 'INFO' },
  JOINT_IMPAIRMENT_CONFIRMED: { category: 'AI_ALERT', severity: 'DANGER' },
};

/** Stored notification types presented under a frontend category. */
function typesForCategory(category: NotificationCategory): NotificationType[] {
  return (Object.keys(notificationPresentation) as NotificationType[]).filter(
    (type) => notificationPresentation[type].category === category,
  );
}

@Injectable()
export class NotificationsService {
  constructor(private readonly repository: NotificationsRepository) {}

  async list(
    actor: AuthenticatedUser,
    query: ListNotificationsQuery,
  ): Promise<NotificationPage> {
    const { category, ...filter } = query;
    const page = await this.repository.findPage(actor.id, {
      ...filter,
      types: category ? typesForCategory(category) : undefined,
    });
    return { ...page, items: page.items.map((item) => this.toPublic(item)) };
  }

  async summary(
    actor: AuthenticatedUser,
    limit: number,
  ): Promise<NotificationSummary> {
    const summary = await this.repository.findSummary(actor.id, limit);
    return {
      unread: summary.unread,
      latest: summary.latest.map((item) => this.toPublic(item)),
    };
  }

  async markRead(
    actor: AuthenticatedUser,
    notificationId: string,
    requestId: string,
  ): Promise<void> {
    await this.repository.transaction(async (transaction) => {
      await setAuditContext(actor.authSubject, requestId, transaction);
      const changed = await this.repository.markRead(
        actor.id,
        notificationId,
        transaction,
      );
      if (!changed) throw notificationNotFound();
    });
  }

  async markAllRead(
    actor: AuthenticatedUser,
    requestId: string,
  ): Promise<{ count: number }> {
    return this.repository.transaction(async (transaction) => {
      await setAuditContext(actor.authSubject, requestId, transaction);
      return {
        count: await this.repository.markAllRead(actor.id, transaction),
      };
    });
  }

  private toPublic(record: NotificationRecord): PublicNotification {
    const presentation = notificationPresentation[record.type];
    const payload =
      record.payload && typeof record.payload === 'object'
        ? (record.payload as Record<string, unknown>)
        : {};
    const href =
      typeof payload.href === 'string' && payload.href.startsWith('/')
        ? payload.href
        : null;
    return {
      id: record.id,
      userId: record.userId,
      category: presentation.category,
      severity: presentation.severity,
      title: record.title,
      body: record.message,
      href,
      createdAt: record.createdAt.toISOString(),
      readAt: record.readAt?.toISOString() ?? null,
    };
  }
}
