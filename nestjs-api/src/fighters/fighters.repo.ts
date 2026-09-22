import { Inject, Injectable } from '@nestjs/common';
import {
  and,
  desc,
  eq,
  exists,
  gte,
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
  fighterJointStates,
  fighterMeasurements,
  fighters,
  injuryRecords,
  medicalClearances,
  sportsDoctors,
  trainingSessions,
} from '../database/schema.js';
import {
  type DatabaseExecutor,
  type Transaction,
} from '../shared/utils/audit-context.util.js';
import type {
  CoachAssignment,
  DoctorAssignment,
  CreateMeasurementInput,
  FighterMeasurement,
  FighterMedicalSummary,
  ListFighterSessionsQuery,
  ListFightersQuery,
  ListMeasurementsQuery,
  PublicFighter,
  TrainingSessionSummary,
  UpdateFighterProfileInput,
} from './fighters.model.js';

export interface FighterListScope {
  owningUserId?: string;
  assignedCoachUserId?: string;
  assignedDoctorUserId?: string;
}

/** An assignment is active once started and until its (possibly future) end. */
function activeCoachAssignment(now: Date) {
  return and(
    lte(coachFighters.startsAt, now),
    or(isNull(coachFighters.endsAt), gt(coachFighters.endsAt, now)),
  );
}

function activeDoctorAssignment(now: Date) {
  return and(
    lte(doctorFighters.startsAt, now),
    or(isNull(doctorFighters.endsAt), gt(doctorFighters.endsAt, now)),
  );
}

/** Raw `coach_fighters` row as selected by the assignment queries below. */
type CoachAssignmentRow = {
  id: string;
  coachId: string;
  fighterId: string;
  assignedById: string;
  startsAt: string | Date;
  endsAt: string | Date | null;
  endedById: string | null;
  endReason: string | null;
  createdAt: string | Date;
  coachName?: string;
  coachGym?: string | null;
};

const COACH_ASSIGNMENT_COLUMNS = sql.raw(`
  id, coach_id as "coachId", fighter_id as "fighterId",
  assigned_by_id as "assignedById", starts_at as "startsAt",
  ends_at as "endsAt", ended_by_id as "endedById",
  end_reason as "endReason", created_at as "createdAt"`);

function mapCoachAssignmentRow(row: CoachAssignmentRow): CoachAssignment {
  return {
    id: row.id,
    coachId: row.coachId,
    fighterId: row.fighterId,
    assignedById: row.assignedById,
    startsAt: new Date(row.startsAt),
    endsAt: row.endsAt ? new Date(row.endsAt) : null,
    endedById: row.endedById,
    endReason: row.endReason,
    createdAt: new Date(row.createdAt),
  };
}

@Injectable()
export class FightersRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  transaction<T>(work: (transaction: Transaction) => Promise<T>): Promise<T> {
    return this.db.transaction(work);
  }

  // --- Fighters CRUD ---

  async findAll(
    query: ListFightersQuery,
    scope: FighterListScope = {},
    database: DatabaseExecutor = this.db,
  ): Promise<{ data: PublicFighter[]; total: number }> {
    const conditions = [
      isNull(fighters.deletedAt),
      eq(fighters.isActive, true),
    ];

    if (query.weightClass) {
      conditions.push(eq(fighters.weightClass, query.weightClass));
    }
    if (query.dominantStance) {
      conditions.push(eq(fighters.dominantStance, query.dominantStance));
    }
    if (query.gym) {
      conditions.push(ilike(fighters.gym, `%${query.gym}%`));
    }
    if (query.medicalStatus) {
      conditions.push(eq(fighters.currentMedicalStatus, query.medicalStatus));
    }
    if (query.search) {
      const searchPattern = `%${query.search}%`;
      conditions.push(
        or(
          ilike(fighters.firstName, searchPattern),
          ilike(fighters.lastName, searchPattern),
        )!,
      );
    }

    if (scope.owningUserId) {
      conditions.push(eq(fighters.userId, scope.owningUserId));
    }
    const now = new Date();
    if (scope.assignedCoachUserId) {
      conditions.push(
        exists(
          database
            .select({ id: coachFighters.id })
            .from(coachFighters)
            .innerJoin(coaches, eq(coachFighters.coachId, coaches.id))
            .where(
              and(
                eq(coaches.userId, scope.assignedCoachUserId),
                eq(coaches.isActive, true),
                isNull(coaches.deletedAt),
                eq(coachFighters.fighterId, fighters.id),
                activeCoachAssignment(now),
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
            .where(
              and(
                eq(sportsDoctors.userId, scope.assignedDoctorUserId),
                eq(sportsDoctors.isActive, true),
                isNull(sportsDoctors.deletedAt),
                eq(doctorFighters.fighterId, fighters.id),
                activeDoctorAssignment(now),
              ),
            ),
        ),
      );
    }

    const whereClause = and(...conditions);
    const offset = (query.page - 1) * query.limit;

    const [rows, countResult] = await Promise.all([
      database
        .select()
        .from(fighters)
        .where(whereClause)
        .orderBy(desc(fighters.createdAt))
        .limit(query.limit)
        .offset(offset),
      database
        .select({ count: sql<number>`count(*)::int` })
        .from(fighters)
        .where(whereClause),
    ]);

    const total = countResult[0]?.count ?? 0;
    return {
      data: await Promise.all(
        rows.map((row) => this.mapFighterWithAssignments(row, database)),
      ),
      total,
    };
  }

  async findById(
    id: string,
    database: DatabaseExecutor = this.db,
  ): Promise<PublicFighter | undefined> {
    const [row] = await database
      .select()
      .from(fighters)
      .where(and(eq(fighters.id, id), isNull(fighters.deletedAt)));
    return row ? this.mapFighterWithAssignments(row, database) : undefined;
  }

  async findByUserId(
    userId: string,
    database: DatabaseExecutor = this.db,
  ): Promise<PublicFighter | undefined> {
    const [row] = await database
      .select()
      .from(fighters)
      .where(and(eq(fighters.userId, userId), isNull(fighters.deletedAt)));
    return row ? this.mapFighterWithAssignments(row, database) : undefined;
  }

  async isCoachAssignedToFighter(
    coachUserId: string,
    fighterId: string,
    database: DatabaseExecutor = this.db,
  ): Promise<boolean> {
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
          activeCoachAssignment(new Date()),
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
          activeDoctorAssignment(new Date()),
          eq(fighters.isActive, true),
          isNull(fighters.deletedAt),
        ),
      )
      .limit(1);
    return rows.length > 0;
  }

  async update(
    id: string,
    input: UpdateFighterProfileInput,
    database: DatabaseExecutor = this.db,
  ): Promise<PublicFighter | undefined> {
    const [row] = await database
      .update(fighters)
      .set({
        ...input,
        updatedAt: new Date(),
      })
      .where(and(eq(fighters.id, id), isNull(fighters.deletedAt)))
      .returning();
    return row ? this.findById(row.id, database) : undefined;
  }

  // --- Body Measurements (Append-Only) ---

  async findMeasurements(
    fighterId: string,
    query: ListMeasurementsQuery,
    database: DatabaseExecutor = this.db,
  ): Promise<{ data: FighterMeasurement[]; total: number }> {
    const conditions = [eq(fighterMeasurements.fighterId, fighterId)];

    if (!query.includeSuperseded) {
      // Exclude rows whose ID is referenced as supersedes_id by another record
      conditions.push(
        sql`not exists (
          select 1 from public.fighter_measurements succ
          where succ.supersedes_id = ${fighterMeasurements.id}
        )`,
      );
    }

    const whereClause = and(...conditions);
    const offset = (query.page - 1) * query.limit;

    const [rows, countResult] = await Promise.all([
      database
        .select({
          measurement: fighterMeasurements,
          hasSuccessor: sql<boolean>`exists (
            select 1 from public.fighter_measurements succ
            where succ.supersedes_id = ${fighterMeasurements.id}
          )`,
        })
        .from(fighterMeasurements)
        .where(whereClause)
        .orderBy(
          desc(fighterMeasurements.measuredAt),
          desc(fighterMeasurements.createdAt),
          desc(fighterMeasurements.id),
        )
        .limit(query.limit)
        .offset(offset),
      database
        .select({ count: sql<number>`count(*)::int` })
        .from(fighterMeasurements)
        .where(whereClause),
    ]);

    const total = countResult[0]?.count ?? 0;
    const data = rows.map(({ measurement, hasSuccessor }) => ({
      id: measurement.id,
      fighterId: measurement.fighterId,
      recordedById: measurement.recordedById,
      measuredAt: measurement.measuredAt,
      measurementContext:
        measurement.measurementContext as FighterMeasurement['measurementContext'],
      weightKg: Number(measurement.weightKg),
      heightCm:
        measurement.heightCm != null ? Number(measurement.heightCm) : null,
      reachCm: measurement.reachCm != null ? Number(measurement.reachCm) : null,
      notes: measurement.notes,
      supersedesId: measurement.supersedesId,
      isSuperseded: hasSuccessor,
      createdAt: measurement.createdAt,
    }));

    return { data, total };
  }

  async findMeasurementById(
    fighterId: string,
    measurementId: string,
    database: DatabaseExecutor = this.db,
  ): Promise<(FighterMeasurement & { isSuperseded: boolean }) | undefined> {
    const [result] = await database
      .select({
        measurement: fighterMeasurements,
        hasSuccessor: sql<boolean>`exists (
          select 1 from public.fighter_measurements succ
          where succ.supersedes_id = ${fighterMeasurements.id}
        )`,
      })
      .from(fighterMeasurements)
      .where(
        and(
          eq(fighterMeasurements.fighterId, fighterId),
          eq(fighterMeasurements.id, measurementId),
        ),
      );

    if (!result) return undefined;
    const { measurement, hasSuccessor } = result;

    return {
      id: measurement.id,
      fighterId: measurement.fighterId,
      recordedById: measurement.recordedById,
      measuredAt: measurement.measuredAt,
      measurementContext:
        measurement.measurementContext as FighterMeasurement['measurementContext'],
      weightKg: Number(measurement.weightKg),
      heightCm:
        measurement.heightCm != null ? Number(measurement.heightCm) : null,
      reachCm: measurement.reachCm != null ? Number(measurement.reachCm) : null,
      notes: measurement.notes,
      supersedesId: measurement.supersedesId,
      isSuperseded: hasSuccessor,
      createdAt: measurement.createdAt,
    };
  }

  async insertMeasurement(
    fighterId: string,
    recordedById: string,
    input: CreateMeasurementInput,
    supersedesId?: string,
    database: DatabaseExecutor = this.db,
  ): Promise<FighterMeasurement> {
    const [inserted] = await database
      .insert(fighterMeasurements)
      .values({
        fighterId,
        recordedById,
        measurementContext: input.measurementContext,
        weightKg: String(input.weightKg),
        heightCm: input.heightCm != null ? String(input.heightCm) : null,
        reachCm: input.reachCm != null ? String(input.reachCm) : null,
        notes: input.notes,
        measuredAt: input.measuredAt ? new Date(input.measuredAt) : new Date(),
        supersedesId: supersedesId ?? null,
      })
      .returning();

    return {
      id: inserted.id,
      fighterId: inserted.fighterId,
      recordedById: inserted.recordedById,
      measuredAt: inserted.measuredAt,
      measurementContext:
        inserted.measurementContext as FighterMeasurement['measurementContext'],
      weightKg: Number(inserted.weightKg),
      heightCm: inserted.heightCm != null ? Number(inserted.heightCm) : null,
      reachCm: inserted.reachCm != null ? Number(inserted.reachCm) : null,
      notes: inserted.notes,
      supersedesId: inserted.supersedesId,
      isSuperseded: false,
      createdAt: inserted.createdAt,
    };
  }

  // --- Coach Assignments (Temporal) ---

  async findActiveCoachAssignment(
    coachId: string,
    fighterId: string,
    database: DatabaseExecutor = this.db,
  ) {
    const [row] = await database
      .select()
      .from(sql`public.coach_fighters`)
      .where(
        sql`coach_id = ${coachId} AND fighter_id = ${fighterId} AND ends_at IS NULL`,
      );
    return row;
  }

  async findCoachAssignmentById(
    fighterId: string,
    assignmentId: string,
    database: DatabaseExecutor = this.db,
  ) {
    const [row] = await database
      .select()
      .from(sql`public.coach_fighters`)
      .where(sql`id = ${assignmentId} AND fighter_id = ${fighterId}`);
    return row as
      | {
          id: string;
          coach_id: string;
          fighter_id: string;
          assigned_by_id: string;
          starts_at: Date;
          ends_at: Date | null;
          ended_by_id: string | null;
          end_reason: string | null;
          created_at: Date;
        }
      | undefined;
  }

  async findCoachAssignments(
    fighterId: string,
    database: DatabaseExecutor = this.db,
  ): Promise<CoachAssignment[]> {
    const { rows } = await database.execute<CoachAssignmentRow>(sql`
      SELECT
        cf.id,
        cf.coach_id as "coachId",
        cf.fighter_id as "fighterId",
        cf.assigned_by_id as "assignedById",
        cf.starts_at as "startsAt",
        cf.ends_at as "endsAt",
        cf.ended_by_id as "endedById",
        cf.end_reason as "endReason",
        cf.created_at as "createdAt",
        concat(c.first_name, ' ', c.last_name) as "coachName",
        c.gym as "coachGym"
      FROM public.coach_fighters cf
      JOIN public.coaches c ON c.id = cf.coach_id
      WHERE cf.fighter_id = ${fighterId}
      ORDER BY cf.starts_at DESC, cf.created_at DESC
    `);

    return rows.map((row) => ({
      ...mapCoachAssignmentRow(row),
      coachName: row.coachName,
      coachGym: row.coachGym,
    }));
  }

  async insertCoachAssignment(
    coachId: string,
    fighterId: string,
    assignedById: string,
    startsAt: Date,
    database: DatabaseExecutor = this.db,
  ): Promise<CoachAssignment> {
    const { rows } = await database.execute<CoachAssignmentRow>(sql`
      INSERT INTO public.coach_fighters (coach_id, fighter_id, assigned_by_id, starts_at)
      VALUES (${coachId}, ${fighterId}, ${assignedById}, ${startsAt.toISOString()})
      RETURNING ${COACH_ASSIGNMENT_COLUMNS}
    `);
    return mapCoachAssignmentRow(rows[0]!);
  }

  async closeCoachAssignment(
    assignmentId: string,
    endedById: string,
    endReason: string,
    endsAt: Date,
    database: DatabaseExecutor = this.db,
  ): Promise<CoachAssignment> {
    const { rows } = await database.execute<CoachAssignmentRow>(sql`
      UPDATE public.coach_fighters
      SET
        ends_at = ${endsAt.toISOString()},
        ended_by_id = ${endedById},
        end_reason = ${endReason}
      WHERE id = ${assignmentId}
      RETURNING ${COACH_ASSIGNMENT_COLUMNS}
    `);
    return mapCoachAssignmentRow(rows[0]!);
  }

  async findCoachById(coachId: string, database: DatabaseExecutor = this.db) {
    const [row] = await database
      .select()
      .from(coaches)
      .where(and(eq(coaches.id, coachId), eq(coaches.isActive, true)));
    return row;
  }

  async findDoctorAssignmentById(
    fighterId: string,
    assignmentId: string,
    database: DatabaseExecutor = this.db,
  ) {
    const [row] = await database
      .select()
      .from(doctorFighters)
      .where(
        and(
          eq(doctorFighters.id, assignmentId),
          eq(doctorFighters.fighterId, fighterId),
        ),
      );
    return row;
  }

  async findDoctorAssignments(
    fighterId: string,
    database: DatabaseExecutor = this.db,
  ): Promise<DoctorAssignment[]> {
    const rows = await database
      .select({
        assignment: doctorFighters,
        firstName: sportsDoctors.firstName,
        lastName: sportsDoctors.lastName,
        userId: sportsDoctors.userId,
        specialization: sportsDoctors.specialization,
        licenseNumber: sportsDoctors.licenseNumber,
      })
      .from(doctorFighters)
      .innerJoin(sportsDoctors, eq(sportsDoctors.id, doctorFighters.doctorId))
      .where(eq(doctorFighters.fighterId, fighterId))
      .orderBy(desc(doctorFighters.startsAt), desc(doctorFighters.createdAt));

    return rows.map(({ assignment, ...doctor }) => ({
      ...assignment,
      doctorName: `${doctor.firstName} ${doctor.lastName}`.trim(),
      doctorUserId: doctor.userId,
      doctorSpecialization: doctor.specialization,
      doctorLicenseNumber: doctor.licenseNumber,
    }));
  }

  async findDoctorById(doctorId: string, database: DatabaseExecutor = this.db) {
    const [row] = await database
      .select()
      .from(sportsDoctors)
      .where(
        and(
          eq(sportsDoctors.id, doctorId),
          eq(sportsDoctors.isActive, true),
          isNull(sportsDoctors.deletedAt),
        ),
      );
    return row;
  }

  async findActiveDoctorAssignment(
    doctorId: string,
    fighterId: string,
    database: DatabaseExecutor = this.db,
  ) {
    const [row] = await database
      .select()
      .from(doctorFighters)
      .where(
        and(
          eq(doctorFighters.doctorId, doctorId),
          eq(doctorFighters.fighterId, fighterId),
          isNull(doctorFighters.endsAt),
        ),
      );
    return row;
  }

  async insertDoctorAssignment(
    doctorId: string,
    fighterId: string,
    assignedById: string,
    startsAt: Date,
    database: DatabaseExecutor = this.db,
  ): Promise<DoctorAssignment> {
    const [row] = await database
      .insert(doctorFighters)
      .values({ doctorId, fighterId, assignedById, startsAt })
      .returning();
    return row;
  }

  async closeDoctorAssignment(
    assignmentId: string,
    endedById: string,
    endReason: string,
    endsAt: Date,
    database: DatabaseExecutor = this.db,
  ): Promise<DoctorAssignment> {
    const [row] = await database
      .update(doctorFighters)
      .set({ endsAt, endedById, endReason })
      .where(eq(doctorFighters.id, assignmentId))
      .returning();
    return row;
  }

  // --- Training History ---

  async findTrainingSessions(
    fighterId: string,
    query: ListFighterSessionsQuery,
    database: DatabaseExecutor = this.db,
  ): Promise<{ data: TrainingSessionSummary[]; total: number }> {
    const conditions = [
      eq(trainingSessions.fighterId, fighterId),
      isNull(trainingSessions.deletedAt),
      eq(trainingSessions.isActive, true),
    ];

    if (query.status) {
      conditions.push(eq(trainingSessions.status, query.status));
    }
    if (query.sessionType) {
      conditions.push(eq(trainingSessions.sessionType, query.sessionType));
    }
    if (query.fromDate) {
      conditions.push(
        gte(trainingSessions.scheduledAt, new Date(query.fromDate)),
      );
    }
    if (query.toDate) {
      conditions.push(
        lte(trainingSessions.scheduledAt, new Date(query.toDate)),
      );
    }

    const whereClause = and(...conditions);
    const offset = (query.page - 1) * query.limit;

    const [rows, countResult] = await Promise.all([
      database
        .select()
        .from(trainingSessions)
        .where(whereClause)
        .orderBy(desc(trainingSessions.scheduledAt))
        .limit(query.limit)
        .offset(offset),
      database
        .select({ count: sql<number>`count(*)::int` })
        .from(trainingSessions)
        .where(whereClause),
    ]);

    const total = countResult[0]?.count ?? 0;
    const data: TrainingSessionSummary[] = rows.map((s) => ({
      id: s.id,
      fighterId: s.fighterId,
      coachId: s.coachId,
      planId: s.planId,
      title: s.title,
      scheduledAt: s.scheduledAt,
      plannedDurationSec: s.plannedDurationSec,
      actualDurationSec: s.actualDurationSec,
      roundCount: s.roundCount,
      location: s.location,
      sessionType: s.sessionType as TrainingSessionSummary['sessionType'],
      status: s.status as TrainingSessionSummary['status'],
      coachNotes: s.coachNotes,
      completedAt: s.completedAt,
      createdAt: s.createdAt,
    }));

    return { data, total };
  }

  // --- Medical Record Link ---

  async findMedicalSummary(
    fighterId: string,
    database: DatabaseExecutor = this.db,
  ): Promise<Omit<FighterMedicalSummary, 'disclaimer'> | undefined> {
    const fighter = await this.findById(fighterId, database);
    if (!fighter) return undefined;

    const [activeClearances, injuries, joints] = await Promise.all([
      database
        .select()
        .from(medicalClearances)
        .where(
          and(
            eq(medicalClearances.fighterId, fighterId),
            eq(medicalClearances.status, 'ACTIVE'),
          ),
        )
        .orderBy(desc(medicalClearances.createdAt))
        .limit(1),
      database
        .select()
        .from(injuryRecords)
        .where(
          and(
            eq(injuryRecords.fighterId, fighterId),
            inArray(injuryRecords.status, ['ACTIVE', 'RECOVERING']),
          ),
        )
        .orderBy(desc(injuryRecords.occurredAt)),
      database
        .select()
        .from(fighterJointStates)
        .where(eq(fighterJointStates.fighterId, fighterId))
        .orderBy(desc(fighterJointStates.stateUpdatedAt)),
    ]);

    const activeClearance = activeClearances[0]
      ? {
          id: activeClearances[0].id,
          clearanceType: activeClearances[0].clearanceType,
          status: activeClearances[0].status,
          validFrom: new Date(activeClearances[0].validFrom),
          validUntil: activeClearances[0].validUntil
            ? new Date(activeClearances[0].validUntil)
            : null,
          notes: activeClearances[0].notes,
        }
      : null;

    return {
      fighterId,
      currentMedicalStatus: fighter.currentMedicalStatus,
      activeClearance,
      activeInjuries: injuries.map((i) => ({
        id: i.id,
        affectedJoint: i.affectedJoint,
        injuryType: i.injuryType,
        severity: i.severity,
        status: i.status,
        occurredAt: new Date(i.occurredAt),
        description: i.description,
      })),
      jointStates: joints.map((j) => ({
        id: j.id,
        joint: j.joint,
        currentState: j.currentState,
        stateUpdatedAt: new Date(j.stateUpdatedAt),
        notes: j.notes,
      })),
    };
  }

  // --- Helper mapping ---

  private mapFighterRow(row: typeof fighters.$inferSelect): PublicFighter {
    return {
      id: row.id,
      userId: row.userId,
      firstName: row.firstName,
      lastName: row.lastName,
      nickname: row.nickname,
      sex: row.sex,
      dateOfBirth: row.dateOfBirth,
      nationality: row.nationality,
      weightClass: row.weightClass as PublicFighter['weightClass'],
      heightCm: row.heightCm,
      reachCm: row.reachCm,
      weightKg: row.weightKg,
      bodyFatPct: row.bodyFatPct,
      restingHeartRate: row.restingHeartRate,
      dominantStance: row.dominantStance as PublicFighter['dominantStance'],
      level: row.trainingLevel,
      primaryDiscipline: row.primaryDiscipline,
      record: {
        wins: row.recordWins,
        losses: row.recordLosses,
        draws: row.recordDraws,
      },
      coachIds: [],
      primaryCoachId: null,
      doctorIds: [],
      upcomingBout: row.upcomingBout
        ? {
            ...row.upcomingBout,
            weightClass: row.upcomingBout
              .weightClass as PublicFighter['weightClass'],
          }
        : null,
      leftArmCm: row.leftArmCm,
      rightArmCm: row.rightArmCm,
      leftLegCm: row.leftLegCm,
      rightLegCm: row.rightLegCm,
      gym: row.gym,
      currentMedicalStatus:
        row.currentMedicalStatus as PublicFighter['currentMedicalStatus'],
      bio: row.bio,
      profileImageUrl: row.profileImageUrl,
      isActive: row.isActive,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private async mapFighterWithAssignments(
    row: typeof fighters.$inferSelect,
    database: DatabaseExecutor,
  ): Promise<PublicFighter> {
    const now = new Date();
    const [coachRows, doctorRows] = await Promise.all([
      database
        .select({ id: coachFighters.coachId })
        .from(coachFighters)
        .where(
          and(eq(coachFighters.fighterId, row.id), activeCoachAssignment(now)),
        )
        .orderBy(coachFighters.startsAt),
      database
        .select({ id: doctorFighters.doctorId })
        .from(doctorFighters)
        .where(
          and(
            eq(doctorFighters.fighterId, row.id),
            activeDoctorAssignment(now),
          ),
        )
        .orderBy(doctorFighters.startsAt),
    ]);
    const fighter = this.mapFighterRow(row);
    fighter.coachIds = coachRows.map(({ id }) => id);
    fighter.primaryCoachId = fighter.coachIds[0] ?? null;
    fighter.doctorIds = doctorRows.map(({ id }) => id);
    return fighter;
  }
}
