import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, inArray, isNull, lt, or, sql } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../database/database.module.js';
import { notifications } from '../database/schema.js';
import type {
  DatabaseExecutor,
  Transaction,
} from '../shared/utils/audit-context.util.js';
import type { ListNotificationsQuery } from './notifications.model.js';

export type NotificationRecord = typeof notifications.$inferSelect;
export type NotificationType = NotificationRecord['type'];

export type NotificationPageFilter = Omit<
  ListNotificationsQuery,
  'category'
> & {
  /** Restricts the page to these types; an empty list matches nothing. */
  types?: NotificationType[];
};

export interface NotificationRecordPage {
  items: NotificationRecord[];
  pageInfo: { hasNextPage: boolean; endCursor: string | null };
  total: number;
}

@Injectable()
export class NotificationsRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  transaction<T>(work: (transaction: Transaction) => Promise<T>): Promise<T> {
    return this.db.transaction(work);
  }

  async findPage(
    userId: string,
    query: NotificationPageFilter,
  ): Promise<NotificationRecordPage> {
    const filters = [eq(notifications.userId, userId)];
    if (query.unreadOnly) filters.push(eq(notifications.isRead, false));
    if (query.types) {
      if (query.types.length === 0) {
        return {
          items: [],
          pageInfo: { hasNextPage: false, endCursor: null },
          total: 0,
        };
      }
      filters.push(inArray(notifications.type, query.types));
    }

    const [totalRow] = await this.db
      .select({ value: sql<number>`count(*)::int` })
      .from(notifications)
      .where(and(...filters));

    const pageFilters = [...filters];
    if (query.cursor) {
      const [cursor] = await this.db
        .select({
          id: notifications.id,
          createdAt: notifications.createdAt,
        })
        .from(notifications)
        .where(
          and(
            eq(notifications.userId, userId),
            eq(notifications.id, query.cursor),
          ),
        )
        .limit(1);
      if (!cursor) {
        return {
          items: [],
          pageInfo: { hasNextPage: false, endCursor: null },
          total: totalRow?.value ?? 0,
        };
      }
      pageFilters.push(
        or(
          lt(notifications.createdAt, cursor.createdAt),
          and(
            eq(notifications.createdAt, cursor.createdAt),
            lt(notifications.id, cursor.id),
          ),
        )!,
      );
    }

    const rows = await this.db
      .select()
      .from(notifications)
      .where(and(...pageFilters))
      .orderBy(desc(notifications.createdAt), desc(notifications.id))
      .limit(query.limit + 1);
    const hasNextPage = rows.length > query.limit;
    const items = rows.slice(0, query.limit);
    return {
      items,
      pageInfo: {
        hasNextPage,
        endCursor:
          hasNextPage && items.length > 0 ? items[items.length - 1].id : null,
      },
      total: totalRow?.value ?? 0,
    };
  }

  async findSummary(
    userId: string,
    limit: number,
  ): Promise<{ unread: number; latest: NotificationRecord[] }> {
    const [[unreadRow], latest] = await Promise.all([
      this.db
        .select({ value: sql<number>`count(*)::int` })
        .from(notifications)
        .where(
          and(
            eq(notifications.userId, userId),
            eq(notifications.isRead, false),
          ),
        ),
      this.db
        .select()
        .from(notifications)
        .where(eq(notifications.userId, userId))
        .orderBy(desc(notifications.createdAt), desc(notifications.id))
        .limit(limit),
    ]);
    return { unread: unreadRow?.value ?? 0, latest };
  }

  async markRead(
    userId: string,
    notificationId: string,
    database: DatabaseExecutor,
  ): Promise<boolean> {
    const changed = await database
      .update(notifications)
      .set({
        isRead: true,
        readAt: sql`coalesce(${notifications.readAt}, now())`,
      })
      .where(
        and(
          eq(notifications.id, notificationId),
          eq(notifications.userId, userId),
        ),
      )
      .returning({ id: notifications.id });
    return changed.length > 0;
  }

  async markAllRead(
    userId: string,
    database: DatabaseExecutor,
  ): Promise<number> {
    const changed = await database
      .update(notifications)
      .set({ isRead: true, readAt: sql`now()` })
      .where(
        and(
          eq(notifications.userId, userId),
          eq(notifications.isRead, false),
          isNull(notifications.readAt),
        ),
      )
      .returning({ id: notifications.id });
    return changed.length;
  }
}
