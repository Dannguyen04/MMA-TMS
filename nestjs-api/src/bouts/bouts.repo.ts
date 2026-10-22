import { Inject, Injectable } from '@nestjs/common';
import {
  and,
  asc,
  eq,
  exists,
  gt,
  inArray,
  isNull,
  lte,
  ne,
  or,
  sql,
  type SQL,
} from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../database/database.module.js';
import {
  boutRequirements,
  bouts,
  coachFighters,
  coaches,
  competitionRulesets,
  doctorFighters,
  fighterMeasurements,
  fighters,
  sportsDoctors,
  trainingPlans,
  type BoutHistoryEntry,
  type BoutRequirementRow,
  type BoutRow,
  type CompetitionRuleset,
  type InsertBout,
  type InsertBoutRequirement,
} from '../database/schema.js';
import type {
  DatabaseExecutor,
  Transaction,
} from '../shared/utils/audit-context.util.js';
import {
  decodeBoutCursor,
  type BoutStatus,
  type WeightMeasurementInput,
} from './bouts.model.js';

export type BoutScope =
  | { kind: 'ALL' }
  | { kind: 'FIGHTER'; fighterId: string }
  | { kind: 'COACH'; userId: string }
  | { kind: 'DOCTOR'; userId: string };

export interface ListBoutsParams {
  scope: BoutScope;
  fighterId?: string | undefined;
  statuses?: readonly BoutStatus[] | undefined;
  cursor?: string | undefined;
  limit: number;
}

export interface PlanSummary {
  id: string;
  fighterId: string;
  phase: string;
  startDate: string;
  deletedAt: Date | null;
}

export type BoutUpdate = Partial<
  Omit<InsertBout, 'id' | 'fighterId' | 'createdById' | 'createdAt' | 'history'>
>;

@Injectable()
export class BoutsRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  transaction<T>(work: (transaction: Transaction) => Promise<T>): Promise<T> {
    return this.db.transaction(work);
  }

  // --- Access scope (equivalent of TrainingAccessService queries) ---------

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

  /** Same check as above, for a coach profile id (used when an admin names the coach). */
  async isCoachProfileAssignedToFighter(
    coachId: string,
    fighterId: string,
    database: DatabaseExecutor = this.db,
  ): Promise<boolean> {
    const now = new Date();
    const rows = await database
      .select({ id: coachFighters.id })
      .from(coachFighters)
      .innerJoin(coaches, eq(coachFighters.coachId, coaches.id))
      .where(
        and(
          eq(coaches.id, coachId),
          eq(coaches.isActive, true),
          isNull(coaches.deletedAt),
          eq(coachFighters.fighterId, fighterId),
          lte(coachFighters.startsAt, now),
          or(isNull(coachFighters.endsAt), gt(coachFighters.endsAt, now)),
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

  // --- Rulesets ------------------------------------------------------------

  async listRulesets(
    database: DatabaseExecutor = this.db,
  ): Promise<CompetitionRuleset[]> {
    return database
      .select()
      .from(competitionRulesets)
      .where(isNull(competitionRulesets.deletedAt))
      .orderBy(asc(competitionRulesets.createdAt), asc(competitionRulesets.name));
  }

  async findRulesetById(
    id: string,
    database: DatabaseExecutor = this.db,
  ): Promise<CompetitionRuleset | undefined> {
    const [row] = await database
      .select()
      .from(competitionRulesets)
      .where(and(eq(competitionRulesets.id, id), isNull(competitionRulesets.deletedAt)))
      .limit(1);
    return row;
  }

  // --- Bouts ---------------------------------------------------------------

  async findBoutById(
    id: string,
    database: DatabaseExecutor = this.db,
  ): Promise<BoutRow | undefined> {
    const [row] = await database
      .select()
      .from(bouts)
      .where(and(eq(bouts.id, id), isNull(bouts.deletedAt)))
      .limit(1);
    return row;
  }

  /**
   * Keyset pagination ordered by (weigh_in_at, id) ascending. Returns up to
   * `limit + 1` rows so the caller can tell whether another page exists.
   */
  async listBouts(
    params: ListBoutsParams,
    database: DatabaseExecutor = this.db,
  ): Promise<BoutRow[]> {
    const conditions: (SQL | undefined)[] = [isNull(bouts.deletedAt)];

    const { scope } = params;
    if (scope.kind === 'FIGHTER') {
      conditions.push(eq(bouts.fighterId, scope.fighterId));
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
                eq(coachFighters.fighterId, bouts.fighterId),
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
            .innerJoin(sportsDoctors, eq(doctorFighters.doctorId, sportsDoctors.id))
            .where(
              and(
                eq(sportsDoctors.userId, scope.userId),
                eq(sportsDoctors.isActive, true),
                isNull(sportsDoctors.deletedAt),
                eq(doctorFighters.fighterId, bouts.fighterId),
                lte(doctorFighters.startsAt, now),
                or(isNull(doctorFighters.endsAt), gt(doctorFighters.endsAt, now)),
              ),
            ),
        ),
      );
    }

    if (params.fighterId) conditions.push(eq(bouts.fighterId, params.fighterId));
    if (params.statuses && params.statuses.length > 0)
      conditions.push(inArray(bouts.status, [...params.statuses]));

    const cursor = params.cursor ? decodeBoutCursor(params.cursor) : null;
    if (cursor) {
      conditions.push(
        sql`(${bouts.weighInAt}, ${bouts.id}) > (${cursor.weighInAt}::timestamptz, ${cursor.id}::uuid)`,
      );
    }

    return database
      .select()
      .from(bouts)
      .where(and(...conditions))
      .orderBy(asc(bouts.weighInAt), asc(bouts.id))
      .limit(params.limit + 1);
  }

  async findActiveBoutIdForFighter(
    fighterId: string,
    excludeBoutId: string | undefined,
    database: DatabaseExecutor = this.db,
  ): Promise<string | undefined> {
    const [row] = await database
      .select({ id: bouts.id })
      .from(bouts)
      .where(
        and(
          eq(bouts.fighterId, fighterId),
          inArray(bouts.status, ['CAMP', 'FIGHT_WEEK', 'WEIGHED_IN']),
          isNull(bouts.deletedAt),
          excludeBoutId ? ne(bouts.id, excludeBoutId) : undefined,
        ),
      )
      .limit(1);
    return row?.id;
  }

  async insertBout(
    values: Omit<InsertBout, 'id' | 'createdAt' | 'updatedAt' | 'history'>,
    database: DatabaseExecutor = this.db,
  ): Promise<BoutRow> {
    const [row] = await database.insert(bouts).values(values).returning();
    if (!row) throw new Error('Bout insert returned no row');
    return row;
  }

  /**
   * Updates a bout. With `expectedStatus` the write only applies while the bout
   * is still in that status (optimistic concurrency); returns undefined otherwise.
   */
  async updateBout(
    id: string,
    changes: BoutUpdate,
    options: {
      expectedStatus?: BoutStatus;
      historyEntry?: BoutHistoryEntry;
    } = {},
    database: DatabaseExecutor = this.db,
  ): Promise<BoutRow | undefined> {
    const [row] = await database
      .update(bouts)
      .set({
        ...changes,
        ...(options.historyEntry
          ? {
              history: sql`${bouts.history} || ${JSON.stringify([options.historyEntry])}::jsonb`,
            }
          : {}),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(bouts.id, id),
          isNull(bouts.deletedAt),
          options.expectedStatus
            ? eq(bouts.status, options.expectedStatus)
            : undefined,
        ),
      )
      .returning();
    return row;
  }

  // --- Training plans --------------------------------------------------------

  async findPlanById(
    id: string,
    database: DatabaseExecutor = this.db,
  ): Promise<PlanSummary | undefined> {
    const [row] = await database
      .select({
        id: trainingPlans.id,
        fighterId: trainingPlans.fighterId,
        phase: trainingPlans.phase,
        startDate: trainingPlans.startDate,
        deletedAt: trainingPlans.deletedAt,
      })
      .from(trainingPlans)
      .where(eq(trainingPlans.id, id))
      .limit(1);
    return row;
  }

  // --- Requirements ----------------------------------------------------------

  async listRequirements(
    boutId: string,
    database: DatabaseExecutor = this.db,
  ): Promise<BoutRequirementRow[]> {
    return database
      .select()
      .from(boutRequirements)
      .where(eq(boutRequirements.boutId, boutId))
      .orderBy(asc(boutRequirements.createdAt), asc(boutRequirements.code));
  }

  async findRequirement(
    boutId: string,
    code: string,
    database: DatabaseExecutor = this.db,
  ): Promise<BoutRequirementRow | undefined> {
    const [row] = await database
      .select()
      .from(boutRequirements)
      .where(and(eq(boutRequirements.boutId, boutId), eq(boutRequirements.code, code)))
      .limit(1);
    return row;
  }

  async insertRequirements(
    rows: Omit<InsertBoutRequirement, 'id' | 'createdAt' | 'updatedAt'>[],
    database: DatabaseExecutor = this.db,
  ): Promise<BoutRequirementRow[]> {
    if (rows.length === 0) return [];
    return database.insert(boutRequirements).values(rows).returning();
  }

  async updateRequirement(
    boutId: string,
    code: string,
    changes: Partial<
      Pick<
        InsertBoutRequirement,
        | 'label'
        | 'required'
        | 'status'
        | 'issuedOn'
        | 'validUntil'
        | 'statusReason'
        | 'updatedById'
      >
    >,
    database: DatabaseExecutor = this.db,
  ): Promise<BoutRequirementRow | undefined> {
    const [row] = await database
      .update(boutRequirements)
      .set({ ...changes, updatedAt: new Date() })
      .where(and(eq(boutRequirements.boutId, boutId), eq(boutRequirements.code, code)))
      .returning();
    return row;
  }

  async deleteRequirement(
    boutId: string,
    code: string,
    database: DatabaseExecutor = this.db,
  ): Promise<boolean> {
    const rows = await database
      .delete(boutRequirements)
      .where(and(eq(boutRequirements.boutId, boutId), eq(boutRequirements.code, code)))
      .returning({ id: boutRequirements.id });
    return rows.length > 0;
  }

  // --- Weight measurements ---------------------------------------------------

  /** Non-superseded measurements of a fighter within `[from, to]`, oldest first. */
  async findWeightMeasurements(
    fighterId: string,
    from: Date,
    to: Date,
    database: DatabaseExecutor = this.db,
  ): Promise<WeightMeasurementInput[]> {
    const rows = await database
      .select({
        measuredAt: fighterMeasurements.measuredAt,
        createdAt: fighterMeasurements.createdAt,
        weightKg: fighterMeasurements.weightKg,
      })
      .from(fighterMeasurements)
      .where(
        and(
          eq(fighterMeasurements.fighterId, fighterId),
          sql`${fighterMeasurements.measuredAt} >= ${from.toISOString()}::timestamptz`,
          sql`${fighterMeasurements.measuredAt} <= ${to.toISOString()}::timestamptz`,
          sql`not exists (
            select 1 from public.fighter_measurements succ
            where succ.supersedes_id = ${fighterMeasurements.id}
          )`,
        ),
      )
      .orderBy(asc(fighterMeasurements.measuredAt), asc(fighterMeasurements.createdAt));
    return rows.map((row) => ({
      measuredAt: row.measuredAt,
      createdAt: row.createdAt,
      weightKg: Number(row.weightKg),
    }));
  }
}
