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
  or,
  type SQL,
} from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../database/database.module.js';
import {
  coachFighters,
  coaches,
  doctorFighters,
  fighters,
  goals,
  sportsDoctors,
  type GoalCheckpoint,
} from '../database/schema.js';
import type {
  DatabaseExecutor,
  Transaction,
} from '../shared/utils/audit-context.util.js';
import type { GoalStatusType, GoalTechniqueType } from './goals.model.js';

export type GoalRow = typeof goals.$inferSelect;

/**
 * Who may see a goal. Undefined fields do not restrict; an ADMIN passes an
 * empty scope. Assignment scopes follow the fighter, not the goal's coach, so
 * a newly assigned coach sees goals set by a previous one.
 */
export interface GoalReadScope {
  fighterIds?: readonly string[];
  assignedCoachUserId?: string;
  assignedDoctorUserId?: string;
}

export interface GoalListFilter {
  coachId?: string;
  technique?: GoalTechniqueType;
}

export interface NewGoalValues {
  fighterId: string;
  coachId: string;
  title: string;
  technique: GoalTechniqueType | null;
  metricLabel: string;
  unit: string;
  lowerIsBetter: boolean;
  baseline: number;
  target: number;
  current: number;
  /** Academy days. */
  startDate: string;
  dueDate: string;
  /** Snapshot written with the change; reads derive the current status. */
  status: GoalStatusType;
  history: GoalCheckpoint[];
}

export type GoalChanges = Partial<Omit<NewGoalValues, 'fighterId'>>;

@Injectable()
export class GoalsRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  transaction<T>(work: (transaction: Transaction) => Promise<T>): Promise<T> {
    return this.db.transaction(work);
  }

  // --- Actor profiles and assignments ---

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

  async isFighterActive(
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

  /** The coach profile is active and currently assigned to the fighter. */
  async isCoachAssignedToFighter(
    coachId: string,
    fighterId: string,
    database: DatabaseExecutor = this.db,
  ): Promise<boolean> {
    const [row] = await database
      .select({ id: coachFighters.id })
      .from(coachFighters)
      .innerJoin(coaches, eq(coachFighters.coachId, coaches.id))
      .innerJoin(fighters, eq(coachFighters.fighterId, fighters.id))
      .where(
        and(
          eq(coachFighters.coachId, coachId),
          eq(coachFighters.fighterId, fighterId),
          this.currentCoachAssignment(),
        ),
      )
      .limit(1);
    return row !== undefined;
  }

  /** The user's coach profile is active and currently assigned to the fighter. */
  async isCoachUserAssignedToFighter(
    coachUserId: string,
    fighterId: string,
    database: DatabaseExecutor = this.db,
  ): Promise<boolean> {
    const [row] = await database
      .select({ id: coachFighters.id })
      .from(coachFighters)
      .innerJoin(coaches, eq(coachFighters.coachId, coaches.id))
      .innerJoin(fighters, eq(coachFighters.fighterId, fighters.id))
      .where(
        and(
          eq(coaches.userId, coachUserId),
          eq(coachFighters.fighterId, fighterId),
          this.currentCoachAssignment(),
        ),
      )
      .limit(1);
    return row !== undefined;
  }

  async isDoctorUserAssignedToFighter(
    doctorUserId: string,
    fighterId: string,
    database: DatabaseExecutor = this.db,
  ): Promise<boolean> {
    const [row] = await database
      .select({ id: doctorFighters.id })
      .from(doctorFighters)
      .innerJoin(sportsDoctors, eq(doctorFighters.doctorId, sportsDoctors.id))
      .innerJoin(fighters, eq(doctorFighters.fighterId, fighters.id))
      .where(
        and(
          eq(sportsDoctors.userId, doctorUserId),
          eq(doctorFighters.fighterId, fighterId),
          this.currentDoctorAssignment(),
        ),
      )
      .limit(1);
    return row !== undefined;
  }

  /** Account user IDs behind a fighter and a coach profile, for notifications after commit. */
  async findParticipantUserIds(
    fighterId: string,
    coachId: string | null,
    database: DatabaseExecutor = this.db,
  ): Promise<string[]> {
    const [fighterRows, coachRows] = await Promise.all([
      database
        .select({ userId: fighters.userId })
        .from(fighters)
        .where(eq(fighters.id, fighterId))
        .limit(1),
      coachId
        ? database
            .select({ userId: coaches.userId })
            .from(coaches)
            .where(eq(coaches.id, coachId))
            .limit(1)
        : Promise.resolve([]),
    ]);
    return [...fighterRows, ...coachRows].map((row) => row.userId);
  }

  // --- Goals ---

  /**
   * At most `limit` rows within the scope, oldest due first. Callers ask for
   * one more than they accept to detect an oversized scope.
   */
  async findGoals(
    scope: GoalReadScope,
    filter: GoalListFilter,
    limit: number,
    database: DatabaseExecutor = this.db,
  ): Promise<GoalRow[]> {
    const conditions: SQL[] = [isNull(goals.deletedAt)];
    if (scope.fighterIds) {
      conditions.push(inArray(goals.fighterId, [...scope.fighterIds]));
    }
    if (scope.assignedCoachUserId) {
      conditions.push(
        exists(
          database
            .select({ id: coachFighters.id })
            .from(coachFighters)
            .innerJoin(coaches, eq(coachFighters.coachId, coaches.id))
            .innerJoin(fighters, eq(coachFighters.fighterId, fighters.id))
            .where(
              and(
                eq(coaches.userId, scope.assignedCoachUserId),
                eq(coachFighters.fighterId, goals.fighterId),
                this.currentCoachAssignment(),
              ),
            ),
        ),
      );
    }
    if (scope.assignedDoctorUserId) {
      conditions.push(
        exists(
          database
            .select({ id: doctorFighters.id })
            .from(doctorFighters)
            .innerJoin(
              sportsDoctors,
              eq(doctorFighters.doctorId, sportsDoctors.id),
            )
            .innerJoin(fighters, eq(doctorFighters.fighterId, fighters.id))
            .where(
              and(
                eq(sportsDoctors.userId, scope.assignedDoctorUserId),
                eq(doctorFighters.fighterId, goals.fighterId),
                this.currentDoctorAssignment(),
              ),
            ),
        ),
      );
    }
    if (filter.coachId) conditions.push(eq(goals.coachId, filter.coachId));
    if (filter.technique) {
      conditions.push(eq(goals.technique, filter.technique));
    }

    return database
      .select()
      .from(goals)
      .where(and(...conditions))
      .orderBy(asc(goals.dueDate), asc(goals.id))
      .limit(limit);
  }

  async findGoalById(
    id: string,
    database: DatabaseExecutor = this.db,
  ): Promise<GoalRow | undefined> {
    const [row] = await database
      .select()
      .from(goals)
      .where(and(eq(goals.id, id), isNull(goals.deletedAt)))
      .limit(1);
    return row;
  }

  /** Serialises concurrent edits and measurements of one goal. */
  async lockGoalById(
    id: string,
    transaction: Transaction,
  ): Promise<GoalRow | undefined> {
    const [row] = await transaction
      .select()
      .from(goals)
      .where(and(eq(goals.id, id), isNull(goals.deletedAt)))
      .limit(1)
      .for('update');
    return row;
  }

  async insertGoal(
    values: NewGoalValues,
    database: DatabaseExecutor = this.db,
  ): Promise<GoalRow> {
    const [row] = await database.insert(goals).values(values).returning();
    return row;
  }

  async updateGoal(
    id: string,
    changes: GoalChanges,
    database: DatabaseExecutor = this.db,
  ): Promise<GoalRow | undefined> {
    const [row] = await database
      .update(goals)
      .set(changes)
      .where(and(eq(goals.id, id), isNull(goals.deletedAt)))
      .returning();
    return row;
  }

  /** Soft-deletes the goal; it disappears from every read. */
  async deleteGoal(
    id: string,
    database: DatabaseExecutor = this.db,
  ): Promise<string | undefined> {
    const [row] = await database
      .update(goals)
      .set({ deletedAt: new Date() })
      .where(and(eq(goals.id, id), isNull(goals.deletedAt)))
      .returning({ id: goals.id });
    return row?.id;
  }

  // --- Assignment predicates ---

  private currentCoachAssignment(): SQL {
    const now = new Date();
    return and(
      eq(coaches.isActive, true),
      isNull(coaches.deletedAt),
      eq(fighters.isActive, true),
      isNull(fighters.deletedAt),
      lte(coachFighters.startsAt, now),
      or(isNull(coachFighters.endsAt), gt(coachFighters.endsAt, now)),
    )!;
  }

  private currentDoctorAssignment(): SQL {
    const now = new Date();
    return and(
      eq(sportsDoctors.isActive, true),
      isNull(sportsDoctors.deletedAt),
      eq(fighters.isActive, true),
      isNull(fighters.deletedAt),
      lte(doctorFighters.startsAt, now),
      or(isNull(doctorFighters.endsAt), gt(doctorFighters.endsAt, now)),
    )!;
  }
}
