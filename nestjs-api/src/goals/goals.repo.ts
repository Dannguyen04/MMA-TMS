import { Inject, Injectable } from '@nestjs/common';
import {
  and,
  desc,
  eq,
  exists,
  gt,
  inArray,
  isNull,
  lt,
  lte,
  or,
  sql,
} from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../database/database.module.js';
import {
  coachFighters,
  coaches,
  fighterGoals,
  fighters,
  goalProgressEvents,
} from '../database/schema.js';
import type {
  DatabaseExecutor,
  Transaction,
} from '../shared/utils/audit-context.util.js';
import type {
  CreateGoalInput,
  GoalStatusType,
  ListGoalsQuery,
  UpdateGoalInput,
} from './goals.model.js';

export type GoalRecord = typeof fighterGoals.$inferSelect;
export interface GoalHistoryRecord {
  date: Date;
  value: number;
}
export interface GoalListScope {
  fighterIds?: string[];
  activeCoachId?: string;
}

@Injectable()
export class GoalsRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  transaction<T>(work: (transaction: Transaction) => Promise<T>): Promise<T> {
    return this.db.transaction(work);
  }

  async findActiveFighterIdByUserId(
    userId: string,
  ): Promise<string | undefined> {
    const [row] = await this.db
      .select({ id: fighters.id })
      .from(fighters)
      .where(
        and(
          eq(fighters.userId, userId),
          eq(fighters.isActive, true),
          isNull(fighters.deletedAt),
        ),
      )
      .limit(1);
    return row?.id;
  }

  async findActiveCoachIdByUserId(
    userId: string,
    database: DatabaseExecutor = this.db,
  ): Promise<string | undefined> {
    const [row] = await database
      .select({ id: coaches.id })
      .from(coaches)
      .where(
        and(
          eq(coaches.userId, userId),
          eq(coaches.isActive, true),
          isNull(coaches.deletedAt),
        ),
      )
      .limit(1);
    return row?.id;
  }

  async isCoachAssignedToFighter(
    coachUserId: string,
    fighterId: string,
    database: DatabaseExecutor = this.db,
  ) {
    const now = new Date();
    const [row] = await database
      .select({ id: coachFighters.id })
      .from(coachFighters)
      .innerJoin(coaches, eq(coaches.id, coachFighters.coachId))
      .innerJoin(fighters, eq(fighters.id, coachFighters.fighterId))
      .where(
        and(
          eq(coaches.userId, coachUserId),
          eq(coaches.isActive, true),
          isNull(coaches.deletedAt),
          eq(coachFighters.fighterId, fighterId),
          lte(coachFighters.startsAt, now),
          or(isNull(coachFighters.endsAt), gt(coachFighters.endsAt, now)),
          eq(fighters.isActive, true),
          isNull(fighters.deletedAt),
        ),
      )
      .limit(1);
    return Boolean(row);
  }

  async findPage(query: ListGoalsQuery, scope: GoalListScope) {
    const filters = [isNull(fighterGoals.deletedAt)];
    const requested = query.fighterId;
    if (scope.fighterIds)
      filters.push(inArray(fighterGoals.fighterId, scope.fighterIds));
    else if (requested.length > 0)
      filters.push(inArray(fighterGoals.fighterId, requested));
    if (query.coachId) filters.push(eq(fighterGoals.coachId, query.coachId));
    if (query.status.length > 0)
      filters.push(inArray(fighterGoals.status, query.status));
    if (query.technique)
      filters.push(eq(fighterGoals.technique, query.technique));
    if (scope.activeCoachId) {
      const now = new Date();
      filters.push(
        exists(
          this.db
            .select({ id: coachFighters.id })
            .from(coachFighters)
            .innerJoin(fighters, eq(fighters.id, coachFighters.fighterId))
            .where(
              and(
                eq(coachFighters.coachId, scope.activeCoachId),
                eq(coachFighters.fighterId, fighterGoals.fighterId),
                lte(coachFighters.startsAt, now),
                or(isNull(coachFighters.endsAt), gt(coachFighters.endsAt, now)),
                eq(fighters.isActive, true),
                isNull(fighters.deletedAt),
              ),
            ),
        ),
      );
    }

    const countWhere = and(...filters);
    if (query.cursor) {
      const [cursor] = await this.db
        .select({ id: fighterGoals.id, createdAt: fighterGoals.createdAt })
        .from(fighterGoals)
        .where(eq(fighterGoals.id, query.cursor))
        .limit(1);
      if (cursor)
        filters.push(
          or(
            lt(fighterGoals.createdAt, cursor.createdAt),
            and(
              eq(fighterGoals.createdAt, cursor.createdAt),
              lt(fighterGoals.id, cursor.id),
            ),
          )!,
        );
    }
    const where = and(...filters);
    const [[total], rows] = await Promise.all([
      this.db
        .select({ value: sql<number>`count(*)::int` })
        .from(fighterGoals)
        .where(countWhere),
      this.db
        .select()
        .from(fighterGoals)
        .where(where)
        .orderBy(desc(fighterGoals.createdAt), desc(fighterGoals.id))
        .limit(query.limit + 1),
    ]);
    const hasNextPage = rows.length > query.limit;
    const items = rows.slice(0, query.limit);
    return {
      items,
      pageInfo: {
        hasNextPage,
        endCursor:
          hasNextPage && items.length ? items[items.length - 1].id : null,
      },
      total: total?.value ?? 0,
    };
  }

  async findById(id: string, database: DatabaseExecutor = this.db) {
    const [row] = await database
      .select()
      .from(fighterGoals)
      .where(and(eq(fighterGoals.id, id), isNull(fighterGoals.deletedAt)))
      .limit(1);
    return row;
  }

  async findHistory(
    id: string,
    database: DatabaseExecutor = this.db,
  ): Promise<GoalHistoryRecord[]> {
    return (await this.findHistoryByGoalIds([id], database)).get(id) ?? [];
  }

  /** Loads progress history for many goals in one query, grouped by goal id. */
  async findHistoryByGoalIds(
    ids: string[],
    database: DatabaseExecutor = this.db,
  ): Promise<Map<string, GoalHistoryRecord[]>> {
    const history = new Map<string, GoalHistoryRecord[]>();
    if (ids.length === 0) return history;
    const rows = await database
      .select({
        goalId: goalProgressEvents.goalId,
        date: goalProgressEvents.recordedAt,
        value: goalProgressEvents.value,
      })
      .from(goalProgressEvents)
      .where(inArray(goalProgressEvents.goalId, ids))
      .orderBy(goalProgressEvents.recordedAt, goalProgressEvents.createdAt);
    for (const { goalId, ...entry } of rows) {
      const entries = history.get(goalId);
      if (entries) entries.push(entry);
      else history.set(goalId, [entry]);
    }
    return history;
  }

  async create(
    input: CreateGoalInput & {
      coachId: string;
      current: number;
      status: GoalStatusType;
    },
    database: DatabaseExecutor = this.db,
  ) {
    const [row] = await database
      .insert(fighterGoals)
      .values({
        ...input,
        startDate: new Date(input.startDate),
        dueDate: new Date(input.dueDate),
      })
      .returning();
    return row;
  }

  async appendProgress(
    input: { goalId: string; value: number; recordedById: string },
    database: DatabaseExecutor = this.db,
  ) {
    const [row] = await database
      .insert(goalProgressEvents)
      .values(input)
      .returning();
    return row;
  }

  async update(
    id: string,
    input: UpdateGoalInput & { current?: number; status?: GoalStatusType },
    database: DatabaseExecutor = this.db,
  ) {
    const { startDate, dueDate, ...rest } = input;
    const values: Partial<typeof fighterGoals.$inferInsert> = {
      ...rest,
      updatedAt: new Date(),
    };
    if (startDate) values.startDate = new Date(startDate);
    if (dueDate) values.dueDate = new Date(dueDate);
    const [row] = await database
      .update(fighterGoals)
      .set(values)
      .where(and(eq(fighterGoals.id, id), isNull(fighterGoals.deletedAt)))
      .returning();
    return row;
  }

  async softDelete(id: string, database: DatabaseExecutor = this.db) {
    const [row] = await database
      .update(fighterGoals)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(fighterGoals.id, id), isNull(fighterGoals.deletedAt)))
      .returning({ id: fighterGoals.id });
    return row?.id;
  }
}
