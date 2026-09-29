import { Inject, Injectable } from '@nestjs/common';
import { and, count, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../database/database.module.js';
import { notifications, users } from '../database/schema.js';
import type { DeliveryJob } from './notifications.model.js';

const notificationProjection = {
  id: notifications.id,
  userId: notifications.userId,
  type: notifications.type,
  title: notifications.title,
  message: notifications.message,
  payload: notifications.payload,
  isRead: notifications.isRead,
  readAt: notifications.readAt,
  createdAt: notifications.createdAt,
};

export type NotificationRow = {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  payload: unknown;
  isRead: boolean;
  readAt: Date | null;
  createdAt: Date;
};

@Injectable()
export class NotificationsRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async listForUser(
    userId: string,
    options: { page: number; limit: number; unreadOnly?: boolean },
  ): Promise<{ items: NotificationRow[]; total: number }> {
    const where = options.unreadOnly
      ? and(eq(notifications.userId, userId), eq(notifications.isRead, false))
      : eq(notifications.userId, userId);
    const [items, [totals]] = await Promise.all([
      this.db
        .select(notificationProjection)
        .from(notifications)
        .where(where)
        .orderBy(desc(notifications.createdAt), desc(notifications.id))
        .limit(options.limit)
        .offset((options.page - 1) * options.limit),
      this.db.select({ total: count() }).from(notifications).where(where),
    ]);
    return { items, total: totals?.total ?? 0 };
  }

  async countUnread(userId: string): Promise<number> {
    const [row] = await this.db
      .select({ total: count() })
      .from(notifications)
      .where(
        and(eq(notifications.userId, userId), eq(notifications.isRead, false)),
      );
    return row?.total ?? 0;
  }

  /**
   * Marks one unread notification of the user as read. Returns undefined when
   * nothing changed (already read, another user's row or no row), so the
   * caller re-reads instead of assuming. `read_at` uses the database clock to
   * keep `read_at >= created_at` true regardless of the API host clock.
   */
  async markRead(
    id: string,
    userId: string,
  ): Promise<NotificationRow | undefined> {
    const [row] = await this.db
      .update(notifications)
      .set({ isRead: true, readAt: sql`now()` })
      .where(
        and(
          eq(notifications.id, id),
          eq(notifications.userId, userId),
          eq(notifications.isRead, false),
        ),
      )
      .returning(notificationProjection);
    return row;
  }

  async findForUser(
    id: string,
    userId: string,
  ): Promise<NotificationRow | undefined> {
    const [row] = await this.db
      .select(notificationProjection)
      .from(notifications)
      .where(and(eq(notifications.id, id), eq(notifications.userId, userId)))
      .limit(1);
    return row;
  }

  /**
   * Recipients that can still own an inbox row. A deleted or deactivated
   * account is skipped instead of failing the whole fan-out.
   */
  async findDeliverableUserIds(userIds: readonly string[]): Promise<string[]> {
    if (userIds.length === 0) return [];
    const rows = await this.db
      .select({ id: users.id })
      .from(users)
      .where(
        and(
          inArray(users.id, [...userIds]),
          eq(users.isActive, true),
          isNull(users.deletedAt),
        ),
      );
    return rows.map((row) => row.id);
  }

  /**
   * Inserts one row per recipient and returns every row of this event for
   * those recipients, including rows a previous attempt already stored. A
   * conflict on (user_id, dedupe_key) keeps the existing row untouched: read
   * state and content are never reset or overwritten.
   */
  async insertOrReuse(
    job: DeliveryJob,
    recipientUserIds: readonly string[],
  ): Promise<Array<{ id: string; userId: string }>> {
    if (recipientUserIds.length === 0) return [];
    return this.db.transaction(async (transaction) => {
      await transaction
        .insert(notifications)
        .values(
          recipientUserIds.map((userId) => ({
            userId,
            type: job.type,
            title: job.title,
            message: job.message,
            payload: job.payload,
            dedupeKey: job.dedupeKey,
          })),
        )
        .onConflictDoNothing({
          target: [notifications.userId, notifications.dedupeKey],
          where: sql`dedupe_key IS NOT NULL`,
        });
      return transaction
        .select({ id: notifications.id, userId: notifications.userId })
        .from(notifications)
        .where(
          and(
            eq(notifications.dedupeKey, job.dedupeKey),
            inArray(notifications.userId, [...recipientUserIds]),
          ),
        );
    });
  }
}
