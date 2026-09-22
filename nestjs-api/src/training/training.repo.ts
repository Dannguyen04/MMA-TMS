import { Inject, Injectable } from '@nestjs/common';
import {
  and,
  desc,
  eq,
  gte,
  ilike,
  isNull,
  lte,
  sql,
  arrayContains,
  exists,
  or,
  gt,
} from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../database/database.module.js';
import {
  exercises,
  trainingPlans,
  trainingSessions,
  trainingPlanExercises,
  coachFighters,
  fighters,
  coaches,
  sportsDoctors,
  doctorFighters,
  coachFeedback,
  videos,
} from '../database/schema.js';
import {
  type DatabaseExecutor,
  type Transaction,
} from '../shared/utils/audit-context.util.js';
import {
  type ExerciseEntity,
  type TrainingPlanEntity,
  type TrainingSessionEntity,
  type TrainingPlanExerciseEntity,
  type CreatePlanInput,
  type UpdatePlanInput,
  type CreateSessionInput,
  type UpdateSessionInput,
  type CreateExerciseInput,
  type UpdateExerciseInput,
  type CreatePlanExerciseRecordInput,
  type UpdatePlanExerciseInput,
  type ListPlansQuery,
  type ListSessionsQuery,
  type ListExercisesQuery,
  type SessionStatusType,
  type TrainingPlanStatusType,
  trainingPlanBaseSchema,
  trainingSessionBaseSchema,
  exerciseBaseSchema,
  trainingPlanExerciseBaseSchema,
  coachFeedbackBaseSchema,
  type CoachFeedbackEntity,
  type ListFeedbackQuery,
  type CreateFeedbackRecordInput,
} from './training.model.js';

export interface TrainingListScope {
  activeCoachId?: string;
}

// --- Mappers ---
function mapToPlan(row: typeof trainingPlans.$inferSelect): TrainingPlanEntity {
  return trainingPlanBaseSchema.parse(row);
}
function mapToSession(
  row: typeof trainingSessions.$inferSelect,
): TrainingSessionEntity {
  return trainingSessionBaseSchema.parse(row);
}
function mapToExercise(row: typeof exercises.$inferSelect): ExerciseEntity {
  return exerciseBaseSchema.parse(row);
}
function mapToPlanExercise(
  row: typeof trainingPlanExercises.$inferSelect,
): TrainingPlanExerciseEntity {
  return trainingPlanExerciseBaseSchema.parse(row);
}
function mapToFeedback(
  row: typeof coachFeedback.$inferSelect,
): CoachFeedbackEntity {
  return coachFeedbackBaseSchema.parse(row);
}

export interface ITrainingRepository {
  transaction<T>(work: (transaction: Transaction) => Promise<T>): Promise<T>;
  findActiveFighterIdByUserId(
    userId: string,
    database?: DatabaseExecutor,
  ): Promise<string | undefined>;
  findActiveCoachIdByUserId(
    userId: string,
    database?: DatabaseExecutor,
  ): Promise<string | undefined>;
  findActiveDoctorIdByUserId(
    userId: string,
    database?: DatabaseExecutor,
  ): Promise<string | undefined>;
  isCoachAssignedToFighter(
    coachId: string,
    fighterId: string,
    database?: DatabaseExecutor,
  ): Promise<boolean>;
  isDoctorAssignedToFighter(
    doctorUserId: string,
    fighterId: string,
    database?: DatabaseExecutor,
  ): Promise<boolean>;
  isCoachProfileOwnedByUser(
    userId: string,
    coachId: string,
    database?: DatabaseExecutor,
  ): Promise<boolean>;

  // Plans
  findPlans(
    query: ListPlansQuery,
    scope?: TrainingListScope,
    database?: DatabaseExecutor,
  ): Promise<{ data: TrainingPlanEntity[]; total: number }>;
  findPlanById(
    id: string,
    database?: DatabaseExecutor,
  ): Promise<TrainingPlanEntity | undefined>;
  createPlan(
    data: CreatePlanInput,
    database?: DatabaseExecutor,
  ): Promise<TrainingPlanEntity>;
  updatePlan(
    id: string,
    data: UpdatePlanInput,
    database?: DatabaseExecutor,
  ): Promise<TrainingPlanEntity | undefined>;
  updatePlanStatus(
    id: string,
    expectedStatus: TrainingPlanStatusType,
    newStatus: TrainingPlanStatusType,
    database?: DatabaseExecutor,
  ): Promise<TrainingPlanEntity | undefined>;
  getPlanProgress(
    planId: string,
    database?: DatabaseExecutor,
  ): Promise<{ totalSessions: number; completedSessions: number }>;

  // Sessions
  findSessions(
    query: ListSessionsQuery,
    scope?: TrainingListScope,
    database?: DatabaseExecutor,
  ): Promise<{ data: TrainingSessionEntity[]; total: number }>;
  findSessionById(
    id: string,
    database?: DatabaseExecutor,
  ): Promise<TrainingSessionEntity | undefined>;
  createSession(
    data: CreateSessionInput,
    database?: DatabaseExecutor,
  ): Promise<TrainingSessionEntity>;
  updateSession(
    id: string,
    data: UpdateSessionInput,
    database?: DatabaseExecutor,
  ): Promise<TrainingSessionEntity | undefined>;
  updateSessionStatus(
    id: string,
    expectedStatus: SessionStatusType,
    newStatus: SessionStatusType,
    time: Date,
    database?: DatabaseExecutor,
  ): Promise<TrainingSessionEntity | undefined>;

  // Exercises
  findExercises(
    query: ListExercisesQuery,
    database?: DatabaseExecutor,
  ): Promise<{ data: ExerciseEntity[]; total: number }>;
  findExerciseById(
    id: string,
    database?: DatabaseExecutor,
  ): Promise<ExerciseEntity | undefined>;
  createExercise(
    data: CreateExerciseInput,
    database?: DatabaseExecutor,
  ): Promise<ExerciseEntity>;
  updateExercise(
    id: string,
    data: UpdateExerciseInput,
    database?: DatabaseExecutor,
  ): Promise<ExerciseEntity | undefined>;

  // Plan Exercises
  findPlanExercises(
    planId: string,
    database?: DatabaseExecutor,
  ): Promise<TrainingPlanExerciseEntity[]>;
  findPlanExerciseById(
    id: string,
    database?: DatabaseExecutor,
  ): Promise<TrainingPlanExerciseEntity | undefined>;
  addPlanExercise(
    data: CreatePlanExerciseRecordInput,
    database?: DatabaseExecutor,
  ): Promise<TrainingPlanExerciseEntity>;
  updatePlanExercise(
    id: string,
    data: UpdatePlanExerciseInput,
    database?: DatabaseExecutor,
  ): Promise<TrainingPlanExerciseEntity | undefined>;
  removePlanExercise(
    id: string,
    database?: DatabaseExecutor,
  ): Promise<string | undefined>;

  findFeedback(
    query: ListFeedbackQuery,
    scope?: TrainingListScope,
    database?: DatabaseExecutor,
  ): Promise<{ data: CoachFeedbackEntity[]; total: number }>;
  createFeedback(
    data: CreateFeedbackRecordInput,
    database?: DatabaseExecutor,
  ): Promise<CoachFeedbackEntity>;
  findVideoContext(
    id: string,
    database?: DatabaseExecutor,
  ): Promise<{ fighterId: string } | undefined>;
}

@Injectable()
export class TrainingRepository implements ITrainingRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  transaction<T>(work: (transaction: Transaction) => Promise<T>): Promise<T> {
    return this.db.transaction(work);
  }

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

  async findActiveDoctorIdByUserId(
    userId: string,
    database: DatabaseExecutor = this.db,
  ): Promise<string | undefined> {
    const [row] = await database
      .select({ id: sportsDoctors.id })
      .from(sportsDoctors)
      .where(
        and(
          eq(sportsDoctors.userId, userId),
          eq(sportsDoctors.isActive, true),
          isNull(sportsDoctors.deletedAt),
        ),
      )
      .limit(1);
    return row?.id;
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

  async isCoachProfileOwnedByUser(
    userId: string,
    coachId: string,
    database: DatabaseExecutor = this.db,
  ): Promise<boolean> {
    const [row] = await database
      .select({ id: coaches.id })
      .from(coaches)
      .where(
        and(
          eq(coaches.id, coachId),
          eq(coaches.userId, userId),
          eq(coaches.isActive, true),
          isNull(coaches.deletedAt),
        ),
      )
      .limit(1);
    return row !== undefined;
  }

  // --- Training Plans ---

  async findPlans(
    query: ListPlansQuery,
    scope: TrainingListScope = {},
    database: DatabaseExecutor = this.db,
  ) {
    const conditions = [isNull(trainingPlans.deletedAt)];
    if (query.fighterId)
      conditions.push(eq(trainingPlans.fighterId, query.fighterId));
    if (query.coachId)
      conditions.push(eq(trainingPlans.coachId, query.coachId));
    if (query.status) conditions.push(eq(trainingPlans.status, query.status));
    if (query.isActive !== undefined)
      conditions.push(eq(trainingPlans.isActive, query.isActive));
    if (scope.activeCoachId) {
      const now = new Date();
      conditions.push(
        exists(
          database
            .select({ id: coachFighters.id })
            .from(coachFighters)
            .innerJoin(coaches, eq(coachFighters.coachId, coaches.id))
            .innerJoin(fighters, eq(coachFighters.fighterId, fighters.id))
            .where(
              and(
                eq(coachFighters.coachId, scope.activeCoachId),
                eq(coachFighters.fighterId, trainingPlans.fighterId),
                eq(coaches.isActive, true),
                isNull(coaches.deletedAt),
                lte(coachFighters.startsAt, now),
                or(isNull(coachFighters.endsAt), gt(coachFighters.endsAt, now)),
                eq(fighters.isActive, true),
                isNull(fighters.deletedAt),
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
        .from(trainingPlans)
        .where(whereClause)
        .orderBy(desc(trainingPlans.createdAt))
        .limit(query.limit)
        .offset(offset),
      database
        .select({ count: sql<number>`count(*)::int` })
        .from(trainingPlans)
        .where(whereClause),
    ]);
    return { data: rows.map(mapToPlan), total: countResult[0]?.count ?? 0 };
  }

  async findPlanById(id: string, database: DatabaseExecutor = this.db) {
    const rows = await database
      .select()
      .from(trainingPlans)
      .where(and(eq(trainingPlans.id, id), isNull(trainingPlans.deletedAt)))
      .limit(1);
    return rows.length > 0 ? mapToPlan(rows[0]) : undefined;
  }

  async createPlan(
    data: CreatePlanInput,
    database: DatabaseExecutor = this.db,
  ) {
    const rows = await database
      .insert(trainingPlans)
      .values({
        fighterId: data.fighterId,
        coachId: data.coachId,
        title: data.title,
        description: data.description ?? null,
        startDate: data.startDate,
        endDate: data.endDate ?? null,
        goals: data.goals ?? null,
        milestones: data.milestones ?? [],
      })
      .returning();
    return mapToPlan(rows[0]);
  }

  async updatePlan(
    id: string,
    data: UpdatePlanInput,
    database: DatabaseExecutor = this.db,
  ) {
    if (Object.keys(data).length === 0) return this.findPlanById(id, database);
    const updateData: Partial<typeof trainingPlans.$inferInsert> = {
      ...data,
      updatedAt: new Date(),
    };

    const rows = await database
      .update(trainingPlans)
      .set(updateData)
      .where(and(eq(trainingPlans.id, id), isNull(trainingPlans.deletedAt)))
      .returning();
    return rows.length > 0 ? mapToPlan(rows[0]) : undefined;
  }

  async updatePlanStatus(
    id: string,
    expectedStatus: TrainingPlanStatusType,
    newStatus: TrainingPlanStatusType,
    database: DatabaseExecutor = this.db,
  ) {
    const updateData: Partial<typeof trainingPlans.$inferInsert> = {
      status: newStatus,
      updatedAt: new Date(),
    };
    const rows = await database
      .update(trainingPlans)
      .set(updateData)
      .where(
        and(
          eq(trainingPlans.id, id),
          eq(trainingPlans.status, expectedStatus),
          isNull(trainingPlans.deletedAt),
        ),
      )
      .returning();
    return rows.length > 0 ? mapToPlan(rows[0]) : undefined;
  }

  async getPlanProgress(planId: string, database: DatabaseExecutor = this.db) {
    const rows = await database
      .select({
        total: sql<number>`count(*)::int`,
        completed: sql<number>`sum(case when status = 'COMPLETED' then 1 else 0 end)::int`,
      })
      .from(trainingSessions)
      .where(
        and(
          eq(trainingSessions.planId, planId),
          isNull(trainingSessions.deletedAt),
        ),
      );

    return {
      totalSessions: rows[0]?.total ?? 0,
      completedSessions: rows[0]?.completed ?? 0,
    };
  }

  // --- Training Sessions ---

  async findSessions(
    query: ListSessionsQuery,
    scope: TrainingListScope = {},
    database: DatabaseExecutor = this.db,
  ) {
    const conditions = [isNull(trainingSessions.deletedAt)];
    if (query.fighterId)
      conditions.push(eq(trainingSessions.fighterId, query.fighterId));
    if (query.coachId)
      conditions.push(eq(trainingSessions.coachId, query.coachId));
    if (query.planId)
      conditions.push(eq(trainingSessions.planId, query.planId));
    if (query.status)
      conditions.push(eq(trainingSessions.status, query.status));
    if (query.sessionType)
      conditions.push(eq(trainingSessions.sessionType, query.sessionType));
    if (query.fromDate)
      conditions.push(
        gte(trainingSessions.scheduledAt, new Date(query.fromDate)),
      );
    if (query.toDate)
      conditions.push(
        lte(trainingSessions.scheduledAt, new Date(query.toDate)),
      );
    if (scope.activeCoachId) {
      const now = new Date();
      conditions.push(
        exists(
          database
            .select({ id: coachFighters.id })
            .from(coachFighters)
            .innerJoin(coaches, eq(coachFighters.coachId, coaches.id))
            .innerJoin(fighters, eq(coachFighters.fighterId, fighters.id))
            .where(
              and(
                eq(coachFighters.coachId, scope.activeCoachId),
                eq(coachFighters.fighterId, trainingSessions.fighterId),
                eq(coaches.isActive, true),
                isNull(coaches.deletedAt),
                lte(coachFighters.startsAt, now),
                or(isNull(coachFighters.endsAt), gt(coachFighters.endsAt, now)),
                eq(fighters.isActive, true),
                isNull(fighters.deletedAt),
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
    return { data: rows.map(mapToSession), total: countResult[0]?.count ?? 0 };
  }

  async findSessionById(id: string, database: DatabaseExecutor = this.db) {
    const rows = await database
      .select()
      .from(trainingSessions)
      .where(
        and(eq(trainingSessions.id, id), isNull(trainingSessions.deletedAt)),
      )
      .limit(1);
    return rows.length > 0 ? mapToSession(rows[0]) : undefined;
  }

  async createSession(
    data: CreateSessionInput,
    database: DatabaseExecutor = this.db,
  ) {
    const rows = await database
      .insert(trainingSessions)
      .values({
        fighterId: data.fighterId,
        coachId: data.coachId ?? null,
        planId: data.planId ?? null,
        title: data.title,
        scheduledAt: new Date(data.scheduledAt),
        plannedDurationSec: data.plannedDurationSec ?? null,
        roundCount: data.roundCount ?? 0,
        location: data.location ?? null,
        sessionType: data.sessionType,
        coachNotes: data.coachNotes ?? null,
      })
      .returning();
    return mapToSession(rows[0]);
  }

  async updateSession(
    id: string,
    data: UpdateSessionInput,
    database: DatabaseExecutor = this.db,
  ) {
    if (Object.keys(data).length === 0)
      return this.findSessionById(id, database);

    const { scheduledAt, ...rest } = data;
    const updateData: Partial<typeof trainingSessions.$inferInsert> = {
      ...rest,
      updatedAt: new Date(),
    };
    if (scheduledAt !== undefined)
      updateData.scheduledAt = new Date(scheduledAt);

    const rows = await database
      .update(trainingSessions)
      .set(updateData)
      .where(
        and(eq(trainingSessions.id, id), isNull(trainingSessions.deletedAt)),
      )
      .returning();
    return rows.length > 0 ? mapToSession(rows[0]) : undefined;
  }

  async updateSessionStatus(
    id: string,
    expectedStatus: SessionStatusType,
    newStatus: SessionStatusType,
    time: Date,
    database: DatabaseExecutor = this.db,
  ) {
    const updateData: Partial<typeof trainingSessions.$inferInsert> = {
      status: newStatus,
      completedAt: null,
      cancelledAt: null,
      skippedAt: null,
      abandonedAt: null,
      updatedAt: new Date(),
    };

    if (newStatus === 'SCHEDULED') updateData.checkedInAt = null;
    if (newStatus === 'IN_PROGRESS') updateData.checkedInAt = time;
    if (newStatus === 'COMPLETED') updateData.completedAt = time;
    if (newStatus === 'CANCELLED') updateData.cancelledAt = time;
    if (newStatus === 'SKIPPED') updateData.skippedAt = time;
    if (newStatus === 'ABANDONED') updateData.abandonedAt = time;

    const rows = await database
      .update(trainingSessions)
      .set(updateData)
      .where(
        and(
          eq(trainingSessions.id, id),
          eq(trainingSessions.status, expectedStatus),
          isNull(trainingSessions.deletedAt),
        ),
      )
      .returning();

    return rows.length > 0 ? mapToSession(rows[0]) : undefined;
  }

  async findFeedback(
    query: ListFeedbackQuery,
    scope: TrainingListScope = {},
    database: DatabaseExecutor = this.db,
  ) {
    const conditions = [];
    if (query.fighterId)
      conditions.push(eq(coachFeedback.fighterId, query.fighterId));
    if (query.coachId)
      conditions.push(eq(coachFeedback.coachId, query.coachId));
    if (query.sessionId)
      conditions.push(eq(coachFeedback.sessionId, query.sessionId));
    if (query.videoId)
      conditions.push(eq(coachFeedback.videoId, query.videoId));
    if (query.kind) conditions.push(eq(coachFeedback.kind, query.kind));
    if (scope.activeCoachId) {
      const now = new Date();
      conditions.push(
        exists(
          database
            .select({ id: coachFighters.id })
            .from(coachFighters)
            .where(
              and(
                eq(coachFighters.coachId, scope.activeCoachId),
                eq(coachFighters.fighterId, coachFeedback.fighterId),
                lte(coachFighters.startsAt, now),
                or(isNull(coachFighters.endsAt), gt(coachFighters.endsAt, now)),
              ),
            ),
        ),
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    const offset = (query.page - 1) * query.limit;
    const [rows, countResult] = await Promise.all([
      database
        .select()
        .from(coachFeedback)
        .where(whereClause)
        .orderBy(desc(coachFeedback.createdAt))
        .limit(query.limit)
        .offset(offset),
      database
        .select({ count: sql<number>`count(*)::int` })
        .from(coachFeedback)
        .where(whereClause),
    ]);
    return {
      data: rows.map(mapToFeedback),
      total: countResult[0]?.count ?? 0,
    };
  }

  async createFeedback(
    data: CreateFeedbackRecordInput,
    database: DatabaseExecutor = this.db,
  ) {
    const [row] = await database.insert(coachFeedback).values(data).returning();
    return mapToFeedback(row);
  }

  async findVideoContext(
    id: string,
    database: DatabaseExecutor = this.db,
  ): Promise<{ fighterId: string } | undefined> {
    const [row] = await database
      .select({ fighterId: videos.subjectFighterId })
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

  // --- Exercises ---

  async findExercises(
    query: ListExercisesQuery,
    database: DatabaseExecutor = this.db,
  ) {
    const conditions = [isNull(exercises.deletedAt)];
    if (query.category) conditions.push(eq(exercises.category, query.category));
    if (query.targetMuscle)
      conditions.push(
        arrayContains(exercises.targetMuscleGroups, [query.targetMuscle]),
      );
    if (query.search)
      conditions.push(ilike(exercises.name, `%${query.search}%`));

    const whereClause = and(...conditions);
    const offset = (query.page - 1) * query.limit;

    const [rows, countResult] = await Promise.all([
      database
        .select()
        .from(exercises)
        .where(whereClause)
        .orderBy(desc(exercises.createdAt))
        .limit(query.limit)
        .offset(offset),
      database
        .select({ count: sql<number>`count(*)::int` })
        .from(exercises)
        .where(whereClause),
    ]);
    return { data: rows.map(mapToExercise), total: countResult[0]?.count ?? 0 };
  }

  async findExerciseById(id: string, database: DatabaseExecutor = this.db) {
    const rows = await database
      .select()
      .from(exercises)
      .where(and(eq(exercises.id, id), isNull(exercises.deletedAt)))
      .limit(1);
    return rows.length > 0 ? mapToExercise(rows[0]) : undefined;
  }

  async createExercise(
    data: CreateExerciseInput,
    database: DatabaseExecutor = this.db,
  ) {
    const rows = await database
      .insert(exercises)
      .values({
        name: data.name,
        description: data.description ?? null,
        category: data.category,
        targetMuscleGroups: data.targetMuscleGroups ?? [],
        videoUrl: data.videoUrl ?? null,
        thumbnailUrl: data.thumbnailUrl ?? null,
      })
      .returning();
    return mapToExercise(rows[0]);
  }

  async updateExercise(
    id: string,
    data: UpdateExerciseInput,
    database: DatabaseExecutor = this.db,
  ) {
    if (Object.keys(data).length === 0)
      return this.findExerciseById(id, database);
    const updateData: Partial<typeof exercises.$inferInsert> = {
      ...data,
      updatedAt: new Date(),
    };
    const rows = await database
      .update(exercises)
      .set(updateData)
      .where(and(eq(exercises.id, id), isNull(exercises.deletedAt)))
      .returning();
    return rows.length > 0 ? mapToExercise(rows[0]) : undefined;
  }

  // --- Plan Exercises ---

  async findPlanExercises(
    planId: string,
    database: DatabaseExecutor = this.db,
  ) {
    const rows = await database
      .select()
      .from(trainingPlanExercises)
      .where(eq(trainingPlanExercises.planId, planId))
      .orderBy(trainingPlanExercises.orderIndex);
    return rows.map(mapToPlanExercise);
  }

  async findPlanExerciseById(id: string, database: DatabaseExecutor = this.db) {
    const rows = await database
      .select()
      .from(trainingPlanExercises)
      .where(eq(trainingPlanExercises.id, id))
      .limit(1);
    return rows.length > 0 ? mapToPlanExercise(rows[0]) : undefined;
  }

  async addPlanExercise(
    data: CreatePlanExerciseRecordInput,
    database: DatabaseExecutor = this.db,
  ) {
    const rows = await database
      .insert(trainingPlanExercises)
      .values({
        planId: data.planId,
        exerciseId: data.exerciseId,
        orderIndex: data.orderIndex,
        sets: data.sets ?? null,
        reps: data.reps ?? null,
        durationSeconds: data.durationSeconds ?? null,
        targetRpe: data.targetRpe ?? null,
        coachNotes: data.coachNotes ?? null,
      })
      .returning();
    return mapToPlanExercise(rows[0]);
  }

  async updatePlanExercise(
    id: string,
    data: UpdatePlanExerciseInput,
    database: DatabaseExecutor = this.db,
  ) {
    if (Object.keys(data).length === 0) {
      const rows = await database
        .select()
        .from(trainingPlanExercises)
        .where(eq(trainingPlanExercises.id, id))
        .limit(1);
      return rows.length > 0 ? mapToPlanExercise(rows[0]) : undefined;
    }
    const updateData: Partial<typeof trainingPlanExercises.$inferInsert> = {
      ...data,
    };
    const rows = await database
      .update(trainingPlanExercises)
      .set(updateData)
      .where(eq(trainingPlanExercises.id, id))
      .returning();
    return rows.length > 0 ? mapToPlanExercise(rows[0]) : undefined;
  }

  async removePlanExercise(id: string, database: DatabaseExecutor = this.db) {
    const rows = await database
      .delete(trainingPlanExercises)
      .where(eq(trainingPlanExercises.id, id))
      .returning({ id: trainingPlanExercises.id });
    return rows[0]?.id;
  }
}
