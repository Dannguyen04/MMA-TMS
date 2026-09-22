import { Inject, Injectable } from '@nestjs/common';
import {
  and,
  asc,
  eq,
  gt,
  ilike,
  inArray,
  isNull,
  lte,
  or,
  sql,
} from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../database/database.module.js';
import {
  coachFighters,
  coaches,
  doctorFighters,
  sportsDoctors,
} from '../database/schema.js';
import type {
  CoachDirectoryEntry,
  DoctorDirectoryEntry,
  ListStaffQuery,
} from './staff.model.js';

type CoachRow = typeof coaches.$inferSelect;
type DoctorRow = typeof sportsDoctors.$inferSelect;

function groupFighterIds<K extends string>(
  rows: Array<Record<K, string> & { fighterId: string }>,
  key: K,
) {
  const result = new Map<string, string[]>();
  for (const row of rows) {
    const fighterIds = result.get(row[key]);
    if (fighterIds) fighterIds.push(row.fighterId);
    else result.set(row[key], [row.fighterId]);
  }
  return result;
}

function toCoachEntry(
  row: CoachRow,
  fighterIds: string[] = [],
): CoachDirectoryEntry {
  return {
    id: row.id,
    userId: row.userId,
    firstName: row.firstName,
    lastName: row.lastName,
    specialization: row.specialization,
    certifications: row.certifications,
    yearsExperience: row.yearsExperience,
    fighterIds,
  };
}

function toDoctorEntry(
  row: DoctorRow,
  fighterIds: string[] = [],
): DoctorDirectoryEntry {
  return {
    id: row.id,
    userId: row.userId,
    firstName: row.firstName,
    lastName: row.lastName,
    specialization: row.specialization,
    licenseNumber: row.licenseNumber,
    fighterIds,
  };
}

@Injectable()
export class StaffRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  private async coachAssignments(ids: string[]) {
    if (ids.length === 0) return new Map<string, string[]>();
    const now = new Date();
    const rows = await this.db
      .select({
        coachId: coachFighters.coachId,
        fighterId: coachFighters.fighterId,
      })
      .from(coachFighters)
      .where(
        and(
          inArray(coachFighters.coachId, ids),
          lte(coachFighters.startsAt, now),
          or(isNull(coachFighters.endsAt), gt(coachFighters.endsAt, now)),
        ),
      );
    return groupFighterIds(rows, 'coachId');
  }

  private async doctorAssignments(ids: string[]) {
    if (ids.length === 0) return new Map<string, string[]>();
    const now = new Date();
    const rows = await this.db
      .select({
        doctorId: doctorFighters.doctorId,
        fighterId: doctorFighters.fighterId,
      })
      .from(doctorFighters)
      .where(
        and(
          inArray(doctorFighters.doctorId, ids),
          lte(doctorFighters.startsAt, now),
          or(isNull(doctorFighters.endsAt), gt(doctorFighters.endsAt, now)),
        ),
      );
    return groupFighterIds(rows, 'doctorId');
  }

  async findCoaches(
    query: ListStaffQuery,
  ): Promise<{ data: CoachDirectoryEntry[]; total: number }> {
    const conditions = [eq(coaches.isActive, true), isNull(coaches.deletedAt)];
    if (query.search) {
      conditions.push(
        ilike(
          sql`concat_ws(' ', ${coaches.firstName}, ${coaches.lastName}, ${coaches.specialization})`,
          `%${query.search}%`,
        ),
      );
    }
    const whereClause = and(...conditions);
    const [rows, countRows] = await Promise.all([
      this.db
        .select()
        .from(coaches)
        .where(whereClause)
        .orderBy(asc(coaches.firstName), asc(coaches.lastName))
        .limit(query.limit)
        .offset((query.page - 1) * query.limit),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(coaches)
        .where(whereClause),
    ]);
    const assignments = await this.coachAssignments(rows.map((row) => row.id));
    return {
      data: rows.map((row) => toCoachEntry(row, assignments.get(row.id))),
      total: countRows[0]?.count ?? 0,
    };
  }

  async findDoctors(
    query: ListStaffQuery,
  ): Promise<{ data: DoctorDirectoryEntry[]; total: number }> {
    const conditions = [
      eq(sportsDoctors.isActive, true),
      isNull(sportsDoctors.deletedAt),
    ];
    if (query.search) {
      conditions.push(
        ilike(
          sql`concat_ws(' ', ${sportsDoctors.firstName}, ${sportsDoctors.lastName}, ${sportsDoctors.specialization})`,
          `%${query.search}%`,
        ),
      );
    }
    const whereClause = and(...conditions);
    const [rows, countRows] = await Promise.all([
      this.db
        .select()
        .from(sportsDoctors)
        .where(whereClause)
        .orderBy(asc(sportsDoctors.firstName), asc(sportsDoctors.lastName))
        .limit(query.limit)
        .offset((query.page - 1) * query.limit),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(sportsDoctors)
        .where(whereClause),
    ]);
    const assignments = await this.doctorAssignments(rows.map((row) => row.id));
    return {
      data: rows.map((row) => toDoctorEntry(row, assignments.get(row.id))),
      total: countRows[0]?.count ?? 0,
    };
  }

  async findCoachById(id: string): Promise<CoachDirectoryEntry | undefined> {
    const [row] = await this.db
      .select()
      .from(coaches)
      .where(
        and(
          eq(coaches.id, id),
          eq(coaches.isActive, true),
          isNull(coaches.deletedAt),
        ),
      )
      .limit(1);
    if (!row) return undefined;
    const assignments = await this.coachAssignments([id]);
    return toCoachEntry(row, assignments.get(id));
  }

  async findDoctorById(id: string): Promise<DoctorDirectoryEntry | undefined> {
    const [row] = await this.db
      .select()
      .from(sportsDoctors)
      .where(
        and(
          eq(sportsDoctors.id, id),
          eq(sportsDoctors.isActive, true),
          isNull(sportsDoctors.deletedAt),
        ),
      )
      .limit(1);
    if (!row) return undefined;
    const assignments = await this.doctorAssignments([id]);
    return toDoctorEntry(row, assignments.get(id));
  }
}
