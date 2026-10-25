import { Inject, Injectable } from '@nestjs/common';
import {
  and,
  asc,
  eq,
  exists,
  gt,
  gte,
  isNotNull,
  isNull,
  lt,
  lte,
  or,
  sql,
  type SQL,
} from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../database/database.module.js';
import {
  coachFighters,
  coaches,
  doctorFighters,
  fighters,
  sportsDoctors,
  suspensions,
  type InsertSuspension,
  type SuspensionRow,
} from '../database/schema.js';
import type {
  DatabaseExecutor,
  Transaction,
} from '../shared/utils/audit-context.util.js';
import { decodeSuspensionCursor } from './suspensions.model.js';

export type SuspensionScope =
  | { kind: 'ALL' }
  | { kind: 'FIGHTER'; fighterId: string }
  | { kind: 'COACH'; userId: string }
  | { kind: 'DOCTOR'; userId: string };

export interface ListSuspensionsParams {
  scope: SuspensionScope;
  fighterId?: string | undefined;
  active?: boolean | undefined;
  today: string;
  cursor?: string | undefined;
  limit: number;
}

@Injectable()
export class SuspensionsRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  transaction<T>(work: (transaction: Transaction) => Promise<T>): Promise<T> {
    return this.db.transaction(work);
  }

  // --- Access scope (mirrored from BoutsRepository to avoid module cycles) --

  async findActiveFighterIdByUserId(
    userId: string,
    database: DatabaseExecutor = this.db,
  ): Promise<string | undefined> {
    const [row] = await database
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

  async isActiveFighter(
    fighterId: string,
    database: DatabaseExecutor = this.db,
  ): Promise<boolean> {
    const [row] = await database
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
    return row !== undefined;
  }

  async isCoachAssignedToFighter(
    coachUserId: string,
    fighterId: string,
    database: DatabaseExecutor = this.db,
  ): Promise<boolean> {
    const now = new Date();
    const rows = await database
      .select({ id: coachFighters.id })
      .from(coachFighters)
      .innerJoin(coaches, eq(coachFighters.coachId, coaches.id))
      .innerJoin(fighters, eq(coachFighters.fighterId, fighters.id))
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
    return rows.length > 0;
  }

  async isDoctorAssignedToFighter(
    doctorUserId: string,
    fighterId: string,
    database: DatabaseExecutor = this.db,
  ): Promise<boolean> {
    const now = new Date();
    const rows = await database
      .select({ id: doctorFighters.id })
      .from(doctorFighters)
      .innerJoin(sportsDoctors, eq(doctorFighters.doctorId, sportsDoctors.id))
      .innerJoin(fighters, eq(doctorFighters.fighterId, fighters.id))
      .where(
        and(
          eq(sportsDoctors.userId, doctorUserId),
          eq(sportsDoctors.isActive, true),
          isNull(sportsDoctors.deletedAt),
          eq(doctorFighters.fighterId, fighterId),
          lte(doctorFighters.startsAt, now),
          or(isNull(doctorFighters.endsAt), gt(doctorFighters.endsAt, now)),
          eq(fighters.isActive, true),
          isNull(fighters.deletedAt),
        ),
      )
      .limit(1);
    return rows.length > 0;
  }

  // --- Suspensions ---------------------------------------------------------

  async findSuspensionById(
    id: string,
    database: DatabaseExecutor = this.db,
  ): Promise<SuspensionRow | undefined> {
    const [row] = await database
      .select()
      .from(suspensions)
      .where(and(eq(suspensions.id, id), isNull(suspensions.deletedAt)))
      .limit(1);
    return row;
  }

  async findSuspensionsByFighterId(
    fighterId: string,
    database: DatabaseExecutor = this.db,
  ): Promise<SuspensionRow[]> {
    return database
      .select()
      .from(suspensions)
      .where(
        and(
          eq(suspensions.fighterId, fighterId),
          isNull(suspensions.deletedAt),
        ),
      )
      .orderBy(asc(suspensions.startsOn), asc(suspensions.id));
  }

  async lockSuspensionById(
    id: string,
    database: DatabaseExecutor,
  ): Promise<SuspensionRow | undefined> {
    const [row] = await database
      .select()
      .from(suspensions)
      .where(and(eq(suspensions.id, id), isNull(suspensions.deletedAt)))
      .for('update');
    return row;
  }

  /**
   * Keyset pagination ordered by (starts_on, id) ascending. Returns up to
   * `limit + 1` rows so the caller can tell whether another page exists.
   */
  async listSuspensions(
    params: ListSuspensionsParams,
    database: DatabaseExecutor = this.db,
  ): Promise<SuspensionRow[]> {
    const conditions: (SQL | undefined)[] = [isNull(suspensions.deletedAt)];

    const { scope } = params;
    if (scope.kind === 'FIGHTER') {
      conditions.push(eq(suspensions.fighterId, scope.fighterId));
    } else if (scope.kind === 'COACH') {
      const now = new Date();
      conditions.push(
        exists(
          database
            .select({ id: coachFighters.id })
            .from(coachFighters)
            .innerJoin(coaches, eq(coachFighters.coachId, coaches.id))
            .where(
              and(
                eq(coaches.userId, scope.userId),
                eq(coaches.isActive, true),
                isNull(coaches.deletedAt),
                eq(coachFighters.fighterId, suspensions.fighterId),
                lte(coachFighters.startsAt, now),
                or(isNull(coachFighters.endsAt), gt(coachFighters.endsAt, now)),
              ),
            ),
        ),
      );
    } else if (scope.kind === 'DOCTOR') {
      const now = new Date();
      conditions.push(
        exists(
          database
            .select({ id: doctorFighters.id })
            .from(doctorFighters)
            .innerJoin(
              sportsDoctors,
              eq(doctorFighters.doctorId, sportsDoctors.id),
            )
            .where(
              and(
                eq(sportsDoctors.userId, scope.userId),
                eq(sportsDoctors.isActive, true),
                isNull(sportsDoctors.deletedAt),
                eq(doctorFighters.fighterId, suspensions.fighterId),
                lte(doctorFighters.startsAt, now),
                or(
                  isNull(doctorFighters.endsAt),
                  gt(doctorFighters.endsAt, now),
                ),
              ),
            ),
        ),
      );
    }

    if (params.fighterId) {
      conditions.push(eq(suspensions.fighterId, params.fighterId));
    }

    if (params.active === true) {
      conditions.push(
        and(
          isNull(suspensions.clearedAt),
          lte(suspensions.startsOn, params.today),
          or(
            gte(suspensions.endsOn, params.today),
            eq(suspensions.requiresClearance, true),
          ),
        ),
      );
    } else if (params.active === false) {
      conditions.push(
        or(
          isNotNull(suspensions.clearedAt),
          gt(suspensions.startsOn, params.today),
          and(
            lt(suspensions.endsOn, params.today),
            eq(suspensions.requiresClearance, false),
          ),
        ),
      );
    }

    const cursor = params.cursor ? decodeSuspensionCursor(params.cursor) : null;
    if (cursor) {
      conditions.push(
        sql`(${suspensions.startsOn}, ${suspensions.id}) > (${cursor.startsOn}::date, ${cursor.id}::uuid)`,
      );
    }

    return database
      .select()
      .from(suspensions)
      .where(and(...conditions))
      .orderBy(asc(suspensions.startsOn), asc(suspensions.id))
      .limit(params.limit + 1);
  }

  async insertSuspension(
    values: Omit<
      InsertSuspension,
      'id' | 'createdAt' | 'updatedAt' | 'deletedAt'
    >,
    database: DatabaseExecutor = this.db,
  ): Promise<SuspensionRow> {
    const [row] = await database.insert(suspensions).values(values).returning();
    if (!row) throw new Error('Suspension insert returned no row');
    return row;
  }

  async clearSuspension(
    id: string,
    values: {
      clearedAt: Date;
      clearedById: string;
      clearanceNote: string;
    },
    database: DatabaseExecutor = this.db,
  ): Promise<SuspensionRow | undefined> {
    const [row] = await database
      .update(suspensions)
      .set({
        clearedAt: values.clearedAt,
        clearedById: values.clearedById,
        clearanceNote: values.clearanceNote,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(suspensions.id, id),
          isNull(suspensions.deletedAt),
          isNull(suspensions.clearedAt),
        ),
      )
      .returning();
    return row;
  }
}
