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

/** Selected columns of `notifications`; `dedupe_key` stays internal. */
export type NotificationRow = Pick<
  typeof notifications.$inferSelect,
  keyof typeof notificationProjection
>;

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

  // Undefined when nothing changed, so the caller re-reads; the DB clock keeps
  // `read_at >= created_at` true regardless of the API host clock.
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

  /** Deactivated or deleted accounts are skipped instead of failing the fan-out. */
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

  // A conflict keeps the existing row (read state and content untouched); the
  // re-read also returns rows a previous attempt already stored.
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
