import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, exists, ilike, isNull, lt, or, sql } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../database/database.module.js';
import {
  coachFighters,
  coaches,
  doctorFighters,
  fighters,
  sportsDoctors,
  videos,
} from '../database/schema.js';
import type { AuthenticatedUser } from '../shared/models/auth-context.model.js';
import type { ListVideosQuery } from './videos.model.js';
import type {
  DatabaseExecutor,
  Transaction,
} from '../shared/utils/audit-context.util.js';

export type VideoRecord = typeof videos.$inferSelect;
export type NewVideoRecord = typeof videos.$inferInsert;

@Injectable()
export class VideosRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  transaction<T>(work: (transaction: Transaction) => Promise<T>): Promise<T> {
    return this.db.transaction(work);
  }

  async canUploadForFighter(
    actor: AuthenticatedUser,
    fighterId: string,
  ): Promise<boolean> {
    if (actor.role === 'ADMIN') {
      const [row] = await this.db
        .select({ id: fighters.id })
        .from(fighters)
        .where(
          and(
            eq(fighters.id, fighterId),
            eq(fighters.isActive, true),
            isNull(fighters.deletedAt),
          ),
        )
        .limit(1);
      return !!row;
    }
    if (actor.role === 'FIGHTER') {
      const [row] = await this.db
        .select({ id: fighters.id })
        .from(fighters)
        .where(
          and(
            eq(fighters.id, fighterId),
            eq(fighters.userId, actor.id),
            eq(fighters.isActive, true),
            isNull(fighters.deletedAt),
          ),
        )
        .limit(1);
      return !!row;
    }
    if (actor.role !== 'COACH') return false;
    const [row] = await this.db
      .select({ id: coachFighters.id })
      .from(coachFighters)
      .innerJoin(coaches, eq(coaches.id, coachFighters.coachId))
      .where(
        and(
          eq(coaches.userId, actor.id),
          eq(coachFighters.fighterId, fighterId),
          isNull(coachFighters.endsAt),
        ),
      )
      .limit(1);
    return !!row;
  }

  create(
    input: NewVideoRecord,
    database: DatabaseExecutor,
  ): Promise<VideoRecord> {
    return database
      .insert(videos)
      .values(input)
      .returning()
      .then(([created]) => {
        if (!created) throw new Error('Không thể tạo bản ghi video.');
        return created;
      });
  }

  async findForActor(
    actor: AuthenticatedUser,
    id: string,
  ): Promise<VideoRecord | undefined> {
    const [row] = await this.db
      .select()
      .from(videos)
      .where(
        and(
          eq(videos.id, id),
          eq(videos.isActive, true),
          isNull(videos.deletedAt),
          this.actorScope(actor),
        ),
      )
      .limit(1);
    return row;
  }

  async listForActor(actor: AuthenticatedUser, query: ListVideosQuery) {
    const scope = this.actorScope(actor);
    const filters = [
      eq(videos.isActive, true),
      isNull(videos.deletedAt),
      scope,
      query.fighterId
        ? eq(videos.subjectFighterId, query.fighterId)
        : undefined,
      query.status ? eq(videos.status, query.status) : undefined,
      query.trainingType
        ? eq(videos.trainingType, query.trainingType)
        : undefined,
      query.search ? ilike(videos.title, `%${query.search}%`) : undefined,
    ].filter((condition) => condition !== undefined);
    const cursor = query.cursor
      ? await this.findForActor(actor, query.cursor)
      : undefined;
    if (query.cursor && !cursor) {
      return {
        items: [] as VideoRecord[],
        total: 0,
        pageInfo: { hasNextPage: false, endCursor: null as string | null },
      };
    }
    const pageFilters = cursor
      ? [
          ...filters,
          or(
            lt(videos.createdAt, cursor.createdAt),
            and(
              eq(videos.createdAt, cursor.createdAt),
              lt(videos.id, cursor.id),
            ),
          ),
        ]
      : filters;
    const [rows, [totalRow]] = await Promise.all([
      this.db
        .select()
        .from(videos)
        .where(and(...pageFilters))
        .orderBy(desc(videos.createdAt), desc(videos.id))
        .limit(query.limit + 1),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(videos)
        .where(and(...filters)),
    ]);
    const hasNextPage = rows.length > query.limit;
    const items = hasNextPage ? rows.slice(0, query.limit) : rows;
    return {
      items,
      total: totalRow?.count ?? 0,
      pageInfo: {
        hasNextPage,
        endCursor: hasNextPage ? (items.at(-1)?.id ?? null) : null,
      },
    };
  }

  async findActiveById(id: string): Promise<VideoRecord | undefined> {
    const [row] = await this.db
      .select()
      .from(videos)
      .where(
        and(
          eq(videos.id, id),
          eq(videos.isActive, true),
          isNull(videos.deletedAt),
        ),
      )
      .limit(1);
    return row;
  }

  private actorScope(actor: AuthenticatedUser) {
    if (actor.role === 'ADMIN') return undefined;
    const fighterAccess =
      actor.role === 'FIGHTER'
        ? exists(
            this.db
              .select({ value: fighters.id })
              .from(fighters)
              .where(
                and(
                  eq(fighters.id, videos.subjectFighterId),
                  eq(fighters.userId, actor.id),
                ),
              ),
          )
        : actor.role === 'COACH'
          ? exists(
              this.db
                .select({ value: coachFighters.id })
                .from(coachFighters)
                .innerJoin(coaches, eq(coaches.id, coachFighters.coachId))
                .where(
                  and(
                    eq(coaches.userId, actor.id),
                    eq(coachFighters.fighterId, videos.subjectFighterId),
                    isNull(coachFighters.endsAt),
                  ),
                ),
            )
          : exists(
              this.db
                .select({ value: doctorFighters.id })
                .from(doctorFighters)
                .innerJoin(
                  sportsDoctors,
                  eq(sportsDoctors.id, doctorFighters.doctorId),
                )
                .where(
                  and(
                    eq(sportsDoctors.userId, actor.id),
                    eq(doctorFighters.fighterId, videos.subjectFighterId),
                    isNull(doctorFighters.endsAt),
                  ),
                ),
            );
    return or(eq(videos.uploadedById, actor.id), fighterAccess);
  }

  async softDelete(
    id: string,
    database: DatabaseExecutor,
  ): Promise<VideoRecord | undefined> {
    const [deleted] = await database
      .update(videos)
      .set({
        isActive: false,
        deletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(videos.id, id),
          eq(videos.isActive, true),
          isNull(videos.deletedAt),
        ),
      )
      .returning();
    return deleted;
  }
}
