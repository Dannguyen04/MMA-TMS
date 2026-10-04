import { Inject, Injectable } from '@nestjs/common';
import { z } from 'zod';
import {
  and,
  desc,
  eq,
  gt,
  inArray,
  isNull,
  lte,
  or,
  sql,
  type SQL,
} from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../database/database.module.js';
import {
  auditLogs,
  doctorFighters,
  fighters,
  injuryRecords,
  medicalClearances,
  medicalExaminationDetails,
  medicalExaminations,
  medicalReviewRequests,
  recoveryPlans,
  sportsDoctors,
  treatments,
  users,
} from '../database/schema.js';
import {
  buildFighterFilterConditions,
  mapFighterRow,
} from '../fighters/fighters.repo.js';
import type {
  ListFightersQuery,
  PublicFighter,
} from '../fighters/fighters.model.js';
import type {
  DatabaseExecutor,
  Transaction,
} from '../shared/utils/audit-context.util.js';
import type { UserRole } from '../shared/types/user.role.js';
import {
  ACTIVE_INJURY_STATUSES,
  MEDICAL_FIGHTER_LOCK_NAMESPACE,
  MEDICAL_HISTORY_SNAPSHOT_FIELDS,
  MEDICAL_READ_AUDIT,
  type MedicalHistoryRecordType,
  type MedicalReadView,
} from './medical.constants.js';
import type {
  Clearance,
  ClearanceType,
  CreateInjuryInput,
  CreateRecoveryPlanInput,
  CreateTreatmentInput,
  DoctorAssignment,
  Examination,
  ExaminationDecision,
  ExaminationDetails,
  ExaminationScope,
  ExaminationType,
  Injury,
  InjuryStatus,
  ListDoctorAssignmentsQuery,
  ListExaminationsQuery,
  ListMedicalHistoryQuery,
  ListReviewRequestsQuery,
  MedicalHistoryEntry,
  RecoveryMilestone,
  RecoveryPlan,
  RecoveryPlanStatus,
  ReviewRequest,
  SessionTypeValue,
  Treatment,
} from './medical.model.js';
import {
  examinationAssessmentSchema,
  hydrationLevels,
} from './medical.model.js';
import {
  scat6ScoresSchema,
  storedScat6ResponsesSchema,
  type Scat6Input,
  type Scat6Scores,
} from './scat6.model.js';

type InjuryRow = typeof injuryRecords.$inferSelect;
type TreatmentRow = typeof treatments.$inferSelect;
type RecoveryPlanRow = typeof recoveryPlans.$inferSelect;
type ExaminationRow = typeof medicalExaminations.$inferSelect;
type ClearanceRow = typeof medicalClearances.$inferSelect;
type ReviewRequestRow = typeof medicalReviewRequests.$inferSelect;
type AssignmentRow = typeof doctorFighters.$inferSelect;
type ExaminationDetailsRow = typeof medicalExaminationDetails.$inferSelect;

export interface ExaminationDetailsInsert {
  examinationType: ExaminationType;
  vitals: ExaminationDetails['vitals'];
  assessments: ExaminationDetails['assessments'];
  recommendations: string | null;
  followUpDate: string | null;
  scat6: {
    formVersion: string;
    responses: Scat6Input;
    scoringVersion: number | null;
    scores: Scat6Scores | null;
  } | null;
}

export interface ExaminationInsert {
  fighterId: string;
  doctorId: string;
  recordedById: string;
  scope: ExaminationScope;
  decision: ExaminationDecision;
  examinedAt: Date;
  reason: string;
  allowedSessionTypes: SessionTypeValue[] | null;
  allowedTechniqueTypes: ClearanceRow['allowedTechniqueTypes'];
  excludedJoints: ClearanceRow['excludedJoints'];
  restrictionNotes: string | null;
  validUntil: Date | null;
  supersedesId: string | null;
}

export interface ClearanceInsert {
  fighterId: string;
  examinationId: string;
  issuedById: string;
  clearanceType: ClearanceType;
  validFrom: Date;
  validUntil: Date | null;
  notes: string | null;
  allowedSessionTypes: SessionTypeValue[] | null;
  allowedTechniqueTypes: ClearanceRow['allowedTechniqueTypes'];
  excludedJoints: ClearanceRow['excludedJoints'];
}

export interface ClearanceEligibilityRow {
  status: ClearanceRow['status'];
  validFrom: Date;
  validUntil: Date | null;
  allowedSessionTypes: SessionTypeValue[] | null;
  allowedTechniqueTypes: ClearanceRow['allowedTechniqueTypes'];
  excludedJoints: ClearanceRow['excludedJoints'];
  createdAt: Date;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Stored milestones are returned exactly as persisted: standard or legacy,
 * every element and its order preserved. The 003 CHECK guarantees a JSON
 * array; anything else is a broken invariant and fails closed instead of
 * being coerced.
 */
function readStoredMilestones(value: unknown): unknown[] {
  if (!Array.isArray(value)) {
    throw new Error('recovery_plans.milestones is not a JSON array');
  }
  return value;
}

function toCamelCase(key: string): string {
  return key.replace(/_([a-z])/g, (_match, letter: string) =>
    letter.toUpperCase(),
  );
}

function projectSnapshot(
  recordType: MedicalHistoryRecordType,
  snapshot: unknown,
): Record<string, unknown> {
  const source = isRecord(snapshot) ? snapshot : {};
  const projected: Record<string, unknown> = {};
  for (const key of MEDICAL_HISTORY_SNAPSHOT_FIELDS[recordType]) {
    if (!(key in source)) continue;
    const value = source[key];
    // Nested detail rows (examination `details`) are camelCased one level.
    projected[toCamelCase(key)] = isRecord(value)
      ? Object.fromEntries(
          Object.entries(value).map(([inner, v]) => [toCamelCase(inner), v]),
        )
      : value;
  }
  return projected;
}

export function isClearanceCurrentlyValid(
  clearance: Pick<ClearanceRow, 'status' | 'validFrom' | 'validUntil'>,
  now: Date,
): boolean {
  return (
    clearance.status === 'ACTIVE' &&
    clearance.validFrom.getTime() <= now.getTime() &&
    (clearance.validUntil === null ||
      clearance.validUntil.getTime() > now.getTime())
  );
}

function toInjury(row: InjuryRow): Injury {
  return {
    id: row.id,
    fighterId: row.fighterId,
    reportedById: row.reportedById,
    affectedJoint: row.affectedJoint,
    injuryType: row.injuryType,
    severity: row.severity,
    occurredAt: row.occurredAt,
    description: row.description,
    status: row.status,
    resolvedAt: row.resolvedAt,
    sourceAlertId: row.sourceAlertId,
    triggerVideoId: row.triggerVideoId,
    revision: row.revision,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toTreatment(row: TreatmentRow): Treatment {
  return {
    id: row.id,
    injuryId: row.injuryId,
    doctorId: row.doctorId,
    treatmentDate: row.treatmentDate,
    treatmentType: row.treatmentType,
    description: row.description,
    outcomeNotes: row.outcomeNotes,
    nextReviewAt: row.nextReviewAt,
    createdAt: row.createdAt,
  };
}

function toRecoveryPlan(row: RecoveryPlanRow): RecoveryPlan {
  return {
    id: row.id,
    fighterId: row.fighterId,
    injuryId: row.injuryId,
    doctorId: row.doctorId,
    title: row.title,
    description: row.description,
    startDate: row.startDate,
    estimatedEndDate: row.estimatedEndDate,
    actualEndDate: row.actualEndDate,
    status: row.status,
    milestones: readStoredMilestones(row.milestones),
    revision: row.revision,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/**
 * Stored details are re-validated on read: a row that no longer matches its
 * contract fails closed instead of reaching a client half-parsed.
 */
function toExaminationDetails(row: ExaminationDetailsRow): ExaminationDetails {
  const vitals =
    row.weightKg === null ||
    row.restingHeartRate === null ||
    row.bloodPressureSystolic === null ||
    row.bloodPressureDiastolic === null ||
    row.temperatureC === null ||
    row.spo2Pct === null ||
    row.hydration === null
      ? null
      : {
          weightKg: Number(row.weightKg),
          restingHeartRate: row.restingHeartRate,
          bloodPressureSystolic: row.bloodPressureSystolic,
          bloodPressureDiastolic: row.bloodPressureDiastolic,
          temperatureC: Number(row.temperatureC),
          spo2Pct: row.spo2Pct,
          hydration: z.enum(hydrationLevels).parse(row.hydration),
        };
  return {
    examinationType: row.examinationType,
    vitals,
    assessments: z.array(examinationAssessmentSchema).parse(row.assessments),
    recommendations: row.recommendations,
    followUpDate: row.followUpDate,
    scat6:
      row.scat6FormVersion === null || row.scat6Responses === null
        ? null
        : {
            formVersion: row.scat6FormVersion,
            responses: storedScat6ResponsesSchema.parse(row.scat6Responses),
            scoringVersion: row.scat6ScoringVersion,
            scores:
              row.scat6Scores === null
                ? null
                : scat6ScoresSchema.parse(row.scat6Scores),
          },
  };
}

export function toExamination(
  row: ExaminationRow,
  details: ExaminationDetails | null = null,
): Examination {
  const restricted = row.decision === 'ELIGIBLE_WITH_RESTRICTIONS';
  return {
    id: row.id,
    sequenceNo: row.sequenceNo,
    fighterId: row.fighterId,
    doctorId: row.doctorId,
    recordedById: row.recordedById,
    scope: row.scope,
    decision: row.decision,
    examinedAt: row.examinedAt,
    reason: row.reason,
    restrictions: restricted
      ? {
          allowedSessionTypes: row.allowedSessionTypes,
          allowedTechniqueTypes: row.allowedTechniqueTypes,
          excludedJoints: row.excludedJoints,
          notes: row.restrictionNotes,
        }
      : null,
    validUntil: row.validUntil,
    supersedesId: row.supersedesId,
    createdAt: row.createdAt,
    details,
  };
}

function toClearance(
  row: ClearanceRow,
  examinationRestrictionNotes: string | null,
  now: Date,
): Clearance {
  return {
    id: row.id,
    fighterId: row.fighterId,
    examinationId: row.examinationId,
    issuedById: row.issuedById,
    clearanceType: row.clearanceType,
    status: row.status,
    validFrom: row.validFrom,
    validUntil: row.validUntil,
    notes: row.notes,
    restrictions: {
      allowedSessionTypes: row.allowedSessionTypes,
      allowedTechniqueTypes: row.allowedTechniqueTypes,
      excludedJoints: row.excludedJoints,
      notes: examinationRestrictionNotes,
    },
    revokedAt: row.revokedAt,
    revokedById: row.revokedById,
    revokedReason: row.revokedReason,
    revision: row.revision,
    createdAt: row.createdAt,
    isCurrentlyValid: isClearanceCurrentlyValid(row, now),
  };
}

function toReviewRequest(row: ReviewRequestRow): ReviewRequest {
  return {
    id: row.id,
    fighterId: row.fighterId,
    requestedById: row.requestedById,
    requesterRole: row.requesterRole,
    reason: row.reason,
    status: row.status,
    requestedAt: row.requestedAt,
    resolvedByExaminationId: row.resolvedByExaminationId,
    resolvedAt: row.resolvedAt,
    revision: row.revision,
  };
}

function toAssignment(row: AssignmentRow, doctorName?: string): DoctorAssignment {
  return {
    id: row.id,
    doctorId: row.doctorId,
    fighterId: row.fighterId,
    assignedById: row.assignedById,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    endedById: row.endedById,
    endReason: row.endReason,
    createdAt: row.createdAt,
    ...(doctorName !== undefined ? { doctorName } : {}),
  };
}

function offsetOf(query: { page: number; limit: number }): number {
  return (query.page - 1) * query.limit;
}

@Injectable()
export class MedicalRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  transaction<T>(work: (transaction: Transaction) => Promise<T>): Promise<T> {
    return this.db.transaction(work);
  }

  // --- Actor, profile and scope helpers ---

  async findFighter(
    fighterId: string,
    database: DatabaseExecutor = this.db,
  ): Promise<{ id: string; userId: string } | undefined> {
    const [row] = await database
      .select({ id: fighters.id, userId: fighters.userId })
      .from(fighters)
      .where(and(eq(fighters.id, fighterId), isNull(fighters.deletedAt)))
      .limit(1);
    return row;
  }

  /**
   * The Fighter profile of a user and whether it has an effective Doctor
   * assignment (period in force, active non-deleted Doctor profile).
   */
  async findFighterDoctorAssignmentState(
    fighterUserId: string,
    database: DatabaseExecutor = this.db,
  ): Promise<{ fighterId: string; hasEffectiveDoctor: boolean } | undefined> {
    const [row] = await database
      .select({
        fighterId: fighters.id,
        hasEffectiveDoctor: sql<boolean>`EXISTS (
          SELECT 1 FROM public.doctor_fighters df
          JOIN public.sports_doctors d ON d.id = df.doctor_id
          WHERE df.fighter_id = ${fighters.id}
            AND d.is_active AND d.deleted_at IS NULL
            AND df.starts_at <= now()
            AND (df.ends_at IS NULL OR df.ends_at > now())
        )`,
      })
      .from(fighters)
      .where(
        and(eq(fighters.userId, fighterUserId), isNull(fighters.deletedAt)),
      )
      .limit(1);
    return row;
  }

  async findFighterDateOfBirth(
    fighterId: string,
    database: DatabaseExecutor = this.db,
  ): Promise<string | undefined> {
    const [row] = await database
      .select({ dateOfBirth: fighters.dateOfBirth })
      .from(fighters)
      .where(eq(fighters.id, fighterId))
      .limit(1);
    return row?.dateOfBirth;
  }

  // Resolves only an unambiguous active profile (user_id is unique today).
  async findActiveDoctorIdByUserId(
    userId: string,
    database: DatabaseExecutor = this.db,
  ): Promise<string | undefined> {
    const rows = await database
      .select({ id: sportsDoctors.id })
      .from(sportsDoctors)
      .where(
        and(
          eq(sportsDoctors.userId, userId),
          eq(sportsDoctors.isActive, true),
          isNull(sportsDoctors.deletedAt),
        ),
      )
      .limit(2);
    return rows.length === 1 ? rows[0].id : undefined;
  }

  async isAssignableDoctor(
    doctorId: string,
    database: DatabaseExecutor = this.db,
  ): Promise<boolean> {
    const [row] = await database
      .select({ id: sportsDoctors.id })
      .from(sportsDoctors)
      .innerJoin(users, eq(users.id, sportsDoctors.userId))
      .where(
        and(
          eq(sportsDoctors.id, doctorId),
          eq(sportsDoctors.isActive, true),
          isNull(sportsDoctors.deletedAt),
          eq(users.isActive, true),
          isNull(users.deletedAt),
        ),
      )
      .limit(1);
    return row !== undefined;
  }

  async isCoachUserAssignedToFighter(
    userId: string,
    fighterId: string,
    database: DatabaseExecutor = this.db,
  ): Promise<boolean> {
    const result = await database.execute(sql`
      SELECT 1 FROM public.coaches c
      JOIN public.coach_fighters cf ON cf.coach_id = c.id
      WHERE c.user_id = ${userId} AND c.is_active AND c.deleted_at IS NULL
        AND cf.fighter_id = ${fighterId}
        AND cf.starts_at <= now() AND (cf.ends_at IS NULL OR cf.ends_at > now())
      LIMIT 1
    `);
    return result.rows.length > 0;
  }

  async isDoctorUserAssignedToFighter(
    userId: string,
    fighterId: string,
    database: DatabaseExecutor = this.db,
  ): Promise<boolean> {
    const result = await database.execute(sql`
      SELECT 1 FROM public.sports_doctors d
      JOIN public.doctor_fighters df ON df.doctor_id = d.id
      WHERE d.user_id = ${userId} AND d.is_active AND d.deleted_at IS NULL
        AND df.fighter_id = ${fighterId}
        AND df.starts_at <= now() AND (df.ends_at IS NULL OR df.ends_at > now())
      LIMIT 1
    `);
    return result.rows.length > 0;
  }

  /**
   * Share-locks the effective assignment row so a concurrent end command waits
   * for this write transaction instead of racing it.
   */
  async lockEffectiveDoctorAssignment(
    doctorId: string,
    fighterId: string,
    transaction: Transaction,
  ): Promise<boolean> {
    const rows = await transaction
      .select({ id: doctorFighters.id })
      .from(doctorFighters)
      .where(
        and(
          eq(doctorFighters.doctorId, doctorId),
          eq(doctorFighters.fighterId, fighterId),
          lte(doctorFighters.startsAt, sql`now()`),
          or(isNull(doctorFighters.endsAt), gt(doctorFighters.endsAt, sql`now()`)),
        ),
      )
      .limit(1)
      .for('share');
    return rows.length > 0;
  }

  async lockFighterMedicalState(
    fighterId: string,
    transaction: Transaction,
  ): Promise<void> {
    await transaction.execute(
      sql`SELECT pg_catalog.pg_advisory_xact_lock(${MEDICAL_FIGHTER_LOCK_NAMESPACE}::int4, pg_catalog.hashtext(${fighterId}))`,
    );
  }

  /** Access metadata only; clinical content never enters audit_logs. */
  async insertMedicalReadAudit(
    actorUserId: string,
    fighterId: string,
    view: MedicalReadView,
    requestId: string,
    database: DatabaseExecutor = this.db,
  ): Promise<void> {
    await database.insert(auditLogs).values({
      actorUserId,
      actorType: 'USER',
      action: MEDICAL_READ_AUDIT.ACTION,
      resourceType: MEDICAL_READ_AUDIT.RESOURCE_TYPE,
      resourceId: fighterId,
      requestId,
      details: { view },
    });
  }

  // --- Doctor assignments ---

  async insertDoctorAssignment(
    doctorId: string,
    fighterId: string,
    assignedById: string,
    transaction: Transaction,
  ): Promise<DoctorAssignment> {
    const [row] = await transaction
      .insert(doctorFighters)
      .values({ doctorId, fighterId, assignedById })
      .returning();
    return toAssignment(row);
  }

  async findDoctorAssignment(
    fighterId: string,
    assignmentId: string,
    database: DatabaseExecutor = this.db,
  ): Promise<DoctorAssignment | undefined> {
    const [row] = await database
      .select()
      .from(doctorFighters)
      .where(
        and(
          eq(doctorFighters.id, assignmentId),
          eq(doctorFighters.fighterId, fighterId),
        ),
      )
      .limit(1);
    return row ? toAssignment(row) : undefined;
  }

  /** Conditional close: returns undefined when the episode is already closed. */
  async closeDoctorAssignment(
    assignmentId: string,
    endedById: string,
    endReason: string,
    transaction: Transaction,
  ): Promise<DoctorAssignment | undefined> {
    const [row] = await transaction
      .update(doctorFighters)
      .set({ endsAt: sql`clock_timestamp()`, endedById, endReason })
      .where(
        and(eq(doctorFighters.id, assignmentId), isNull(doctorFighters.endsAt)),
      )
      .returning();
    return row ? toAssignment(row) : undefined;
  }

  async listDoctorAssignments(
    fighterId: string,
    query: ListDoctorAssignmentsQuery,
    database: DatabaseExecutor = this.db,
  ): Promise<{ data: DoctorAssignment[]; total: number }> {
    const where = eq(doctorFighters.fighterId, fighterId);
    const [rows, [counted]] = await Promise.all([
      database
        .select({
          assignment: doctorFighters,
          firstName: sportsDoctors.firstName,
          lastName: sportsDoctors.lastName,
        })
        .from(doctorFighters)
        .innerJoin(sportsDoctors, eq(sportsDoctors.id, doctorFighters.doctorId))
        .where(where)
        .orderBy(desc(doctorFighters.startsAt), desc(doctorFighters.createdAt))
        .limit(query.limit)
        .offset(offsetOf(query)),
      database
        .select({ count: sql<number>`count(*)::int` })
        .from(doctorFighters)
        .where(where),
    ]);
    return {
      data: rows.map((r) =>
        toAssignment(r.assignment, `${r.firstName} ${r.lastName}`),
      ),
      total: counted?.count ?? 0,
    };
  }

  async findFightersForDoctor(
    doctorId: string,
    query: ListFightersQuery,
    database: DatabaseExecutor = this.db,
  ): Promise<{ data: PublicFighter[]; total: number }> {
    const where = and(
      ...buildFighterFilterConditions(query),
      sql`EXISTS (
        SELECT 1 FROM public.doctor_fighters df
        WHERE df.doctor_id = ${doctorId}
          AND df.fighter_id = ${fighters.id}
          AND df.starts_at <= now()
          AND (df.ends_at IS NULL OR df.ends_at > now())
      )`,
    );
    const [rows, [counted]] = await Promise.all([
      database
        .select()
        .from(fighters)
        .where(where)
        .orderBy(desc(fighters.createdAt))
        .limit(query.limit)
        .offset(offsetOf(query)),
      database
        .select({ count: sql<number>`count(*)::int` })
        .from(fighters)
        .where(where),
    ]);
    return { data: rows.map(mapFighterRow), total: counted?.count ?? 0 };
  }

  // --- Review requests ---

  async insertReviewRequest(
    fighterId: string,
    requestedById: string,
    requesterRole: UserRole,
    reason: string,
    transaction: Transaction,
  ): Promise<ReviewRequest> {
    const [row] = await transaction
      .insert(medicalReviewRequests)
      .values({ fighterId, requestedById, requesterRole, reason })
      .returning();
    return toReviewRequest(row);
  }

  async listReviewRequests(
    fighterId: string,
    query: ListReviewRequestsQuery,
    database: DatabaseExecutor = this.db,
  ): Promise<{ data: ReviewRequest[]; total: number }> {
    const conditions: SQL[] = [eq(medicalReviewRequests.fighterId, fighterId)];
    if (query.status) {
      conditions.push(eq(medicalReviewRequests.status, query.status));
    }
    const where = and(...conditions);
    const [rows, [counted]] = await Promise.all([
      database
        .select()
        .from(medicalReviewRequests)
        .where(where)
        .orderBy(
          desc(medicalReviewRequests.requestedAt),
          desc(medicalReviewRequests.id),
        )
        .limit(query.limit)
        .offset(offsetOf(query)),
      database
        .select({ count: sql<number>`count(*)::int` })
        .from(medicalReviewRequests)
        .where(where),
    ]);
    return { data: rows.map(toReviewRequest), total: counted?.count ?? 0 };
  }

  async listOpenReviewRequests(
    fighterId: string,
    database: DatabaseExecutor = this.db,
  ): Promise<ReviewRequest[]> {
    const rows = await database
      .select()
      .from(medicalReviewRequests)
      .where(
        and(
          eq(medicalReviewRequests.fighterId, fighterId),
          eq(medicalReviewRequests.status, 'OPEN'),
        ),
      )
      .orderBy(desc(medicalReviewRequests.requestedAt));
    return rows.map(toReviewRequest);
  }

  async countOpenReviewRequests(
    fighterId: string,
    database: DatabaseExecutor = this.db,
  ): Promise<number> {
    const [counted] = await database
      .select({ count: sql<number>`count(*)::int` })
      .from(medicalReviewRequests)
      .where(
        and(
          eq(medicalReviewRequests.fighterId, fighterId),
          eq(medicalReviewRequests.status, 'OPEN'),
        ),
      );
    return counted?.count ?? 0;
  }

  async lockReviewRequests(
    fighterId: string,
    ids: readonly string[],
    transaction: Transaction,
  ): Promise<ReviewRequest[]> {
    const rows = await transaction
      .select()
      .from(medicalReviewRequests)
      .where(
        and(
          eq(medicalReviewRequests.fighterId, fighterId),
          inArray(medicalReviewRequests.id, [...ids]),
        ),
      )
      .for('update');
    return rows.map(toReviewRequest);
  }

  async resolveReviewRequests(
    ids: readonly string[],
    examinationId: string,
    transaction: Transaction,
  ): Promise<number> {
    const rows = await transaction
      .update(medicalReviewRequests)
      .set({
        status: 'RESOLVED',
        resolvedByExaminationId: examinationId,
        resolvedAt: sql`clock_timestamp()`,
      })
      .where(
        and(
          inArray(medicalReviewRequests.id, [...ids]),
          eq(medicalReviewRequests.status, 'OPEN'),
        ),
      )
      .returning({ id: medicalReviewRequests.id });
    return rows.length;
  }

  // --- Injuries and treatments ---

  async insertInjury(
    fighterId: string,
    reportedById: string,
    input: CreateInjuryInput,
    transaction: Transaction,
  ): Promise<Injury> {
    const [row] = await transaction
      .insert(injuryRecords)
      .values({
        fighterId,
        reportedById,
        affectedJoint: input.affectedJoint,
        injuryType: input.injuryType,
        severity: input.severity,
        occurredAt: new Date(input.occurredAt),
        description: input.description ?? null,
      })
      .returning();
    return toInjury(row);
  }

  async findInjury(
    injuryId: string,
    database: DatabaseExecutor = this.db,
  ): Promise<Injury | undefined> {
    const [row] = await database
      .select()
      .from(injuryRecords)
      .where(and(eq(injuryRecords.id, injuryId), isNull(injuryRecords.deletedAt)))
      .limit(1);
    return row ? toInjury(row) : undefined;
  }

  async lockInjury(
    injuryId: string,
    transaction: Transaction,
  ): Promise<Injury | undefined> {
    const [row] = await transaction
      .select()
      .from(injuryRecords)
      .where(and(eq(injuryRecords.id, injuryId), isNull(injuryRecords.deletedAt)))
      .limit(1)
      .for('update');
    return row ? toInjury(row) : undefined;
  }

  async updateInjury(
    injuryId: string,
    patch: {
      severity?: Injury['severity'];
      description?: string | null;
      status?: InjuryStatus;
      resolve: boolean;
    },
    transaction: Transaction,
  ): Promise<Injury | undefined> {
    const [row] = await transaction
      .update(injuryRecords)
      .set({
        ...(patch.severity !== undefined ? { severity: patch.severity } : {}),
        ...(patch.description !== undefined
          ? { description: patch.description }
          : {}),
        ...(patch.status !== undefined ? { status: patch.status } : {}),
        ...(patch.resolve ? { resolvedAt: sql`clock_timestamp()` } : {}),
        updatedAt: new Date(),
      })
      .where(eq(injuryRecords.id, injuryId))
      .returning();
    return row ? toInjury(row) : undefined;
  }

  async listActiveInjuries(
    fighterId: string,
    database: DatabaseExecutor = this.db,
  ): Promise<Injury[]> {
    const rows = await database
      .select()
      .from(injuryRecords)
      .where(
        and(
          eq(injuryRecords.fighterId, fighterId),
          inArray(injuryRecords.status, [...ACTIVE_INJURY_STATUSES]),
          isNull(injuryRecords.deletedAt),
        ),
      )
      .orderBy(desc(injuryRecords.occurredAt));
    return rows.map(toInjury);
  }

  async insertTreatment(
    injuryId: string,
    doctorId: string,
    input: CreateTreatmentInput,
    transaction: Transaction,
  ): Promise<Treatment> {
    const [row] = await transaction
      .insert(treatments)
      .values({
        injuryId,
        doctorId,
        treatmentType: input.treatmentType,
        treatmentDate: new Date(input.treatmentDate),
        description: input.description ?? null,
        outcomeNotes: input.outcomeNotes ?? null,
        nextReviewAt: input.nextReviewAt ? new Date(input.nextReviewAt) : null,
      })
      .returning();
    return toTreatment(row);
  }

  // --- Recovery plans ---

  async insertRecoveryPlan(
    fighterId: string,
    doctorId: string,
    input: CreateRecoveryPlanInput,
    milestones: RecoveryMilestone[],
    transaction: Transaction,
  ): Promise<RecoveryPlan> {
    const [row] = await transaction
      .insert(recoveryPlans)
      .values({
        fighterId,
        injuryId: input.injuryId,
        doctorId,
        title: input.title,
        description: input.description ?? null,
        startDate: input.startDate,
        estimatedEndDate: input.estimatedEndDate ?? null,
        milestones,
      })
      .returning();
    return toRecoveryPlan(row);
  }

  async findRecoveryPlan(
    planId: string,
    database: DatabaseExecutor = this.db,
  ): Promise<RecoveryPlan | undefined> {
    const [row] = await database
      .select()
      .from(recoveryPlans)
      .where(and(eq(recoveryPlans.id, planId), isNull(recoveryPlans.deletedAt)))
      .limit(1);
    return row ? toRecoveryPlan(row) : undefined;
  }

  async lockRecoveryPlan(
    planId: string,
    transaction: Transaction,
  ): Promise<RecoveryPlan | undefined> {
    const [row] = await transaction
      .select()
      .from(recoveryPlans)
      .where(and(eq(recoveryPlans.id, planId), isNull(recoveryPlans.deletedAt)))
      .limit(1)
      .for('update');
    return row ? toRecoveryPlan(row) : undefined;
  }

  async updateRecoveryPlan(
    planId: string,
    patch: {
      description?: string | null;
      estimatedEndDate?: string | null;
      milestones?: RecoveryMilestone[];
      status?: RecoveryPlanStatus;
      actualEndDate?: string;
    },
    transaction: Transaction,
  ): Promise<RecoveryPlan | undefined> {
    const [row] = await transaction
      .update(recoveryPlans)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(recoveryPlans.id, planId))
      .returning();
    return row ? toRecoveryPlan(row) : undefined;
  }

  async listActiveRecoveryPlans(
    fighterId: string,
    database: DatabaseExecutor = this.db,
  ): Promise<RecoveryPlan[]> {
    const rows = await database
      .select()
      .from(recoveryPlans)
      .where(
        and(
          eq(recoveryPlans.fighterId, fighterId),
          eq(recoveryPlans.status, 'ACTIVE'),
          isNull(recoveryPlans.deletedAt),
        ),
      )
      .orderBy(desc(recoveryPlans.startDate));
    return rows.map(toRecoveryPlan);
  }

  // --- Examinations ---

  async insertExamination(
    values: ExaminationInsert,
    transaction: Transaction,
  ): Promise<ExaminationRow> {
    const [row] = await transaction
      .insert(medicalExaminations)
      .values(values)
      .returning();
    return row;
  }

  async insertExaminationDetails(
    examination: Pick<ExaminationRow, 'id' | 'fighterId'>,
    values: ExaminationDetailsInsert,
    transaction: Transaction,
  ): Promise<ExaminationDetails> {
    const { vitals, scat6 } = values;
    const [row] = await transaction
      .insert(medicalExaminationDetails)
      .values({
        examinationId: examination.id,
        fighterId: examination.fighterId,
        examinationType: values.examinationType,
        weightKg: vitals ? String(vitals.weightKg) : null,
        restingHeartRate: vitals?.restingHeartRate ?? null,
        bloodPressureSystolic: vitals?.bloodPressureSystolic ?? null,
        bloodPressureDiastolic: vitals?.bloodPressureDiastolic ?? null,
        temperatureC: vitals ? String(vitals.temperatureC) : null,
        spo2Pct: vitals?.spo2Pct ?? null,
        hydration: vitals?.hydration ?? null,
        assessments: values.assessments,
        recommendations: values.recommendations,
        followUpDate: values.followUpDate,
        scat6FormVersion: scat6?.formVersion ?? null,
        scat6Responses: scat6?.responses ?? null,
        scat6ScoringVersion: scat6?.scoringVersion ?? null,
        scat6Scores: scat6?.scores ?? null,
      })
      .returning();
    return toExaminationDetails(row);
  }

  /**
   * Before-training requirement: a BASELINE examination on file, or the
   * one-time 016 exemption for Fighters examined for TRAINING before it.
   */
  async hasBaselineOnFile(
    fighterId: string,
    database: DatabaseExecutor = this.db,
  ): Promise<boolean> {
    const result = await database.execute<{ on_file: boolean }>(sql`
      SELECT EXISTS (
               SELECT 1 FROM public.medical_examination_details d
                WHERE d.fighter_id = ${fighterId} AND d.examination_type = 'BASELINE')
          OR EXISTS (
               SELECT 1 FROM public.medical_baseline_exemptions x
                WHERE x.fighter_id = ${fighterId}) AS on_file
    `);
    return result.rows[0]?.on_file === true;
  }

  /** Details of several examinations in one query, keyed by examination id. */
  async findExaminationDetails(
    examinationIds: readonly string[],
    database: DatabaseExecutor = this.db,
  ): Promise<Map<string, ExaminationDetails>> {
    if (examinationIds.length === 0) return new Map();
    const rows = await database
      .select()
      .from(medicalExaminationDetails)
      .where(inArray(medicalExaminationDetails.examinationId, [...examinationIds]));
    return new Map(
      rows.map((row) => [row.examinationId, toExaminationDetails(row)] as const),
    );
  }

  async findExamination(
    fighterId: string,
    examinationId: string,
    database: DatabaseExecutor = this.db,
  ): Promise<ExaminationRow | undefined> {
    const [row] = await database
      .select()
      .from(medicalExaminations)
      .where(
        and(
          eq(medicalExaminations.id, examinationId),
          eq(medicalExaminations.fighterId, fighterId),
        ),
      )
      .limit(1);
    return row;
  }

  /** The current decision: highest server-owned issuance order in the scope. */
  async findCurrentExamination(
    fighterId: string,
    scope: ExaminationScope,
    database: DatabaseExecutor = this.db,
  ): Promise<ExaminationRow | undefined> {
    const [row] = await database
      .select()
      .from(medicalExaminations)
      .where(
        and(
          eq(medicalExaminations.fighterId, fighterId),
          eq(medicalExaminations.scope, scope),
        ),
      )
      .orderBy(desc(medicalExaminations.sequenceNo))
      .limit(1);
    return row;
  }

  async listExaminations(
    fighterId: string,
    query: ListExaminationsQuery,
    database: DatabaseExecutor = this.db,
  ): Promise<{ data: Examination[]; total: number }> {
    const conditions: SQL[] = [eq(medicalExaminations.fighterId, fighterId)];
    if (query.scope) conditions.push(eq(medicalExaminations.scope, query.scope));
    const where = and(...conditions);
    const [rows, [counted]] = await Promise.all([
      database
        .select()
        .from(medicalExaminations)
        .where(where)
        .orderBy(desc(medicalExaminations.sequenceNo))
        .limit(query.limit)
        .offset(offsetOf(query)),
      database
        .select({ count: sql<number>`count(*)::int` })
        .from(medicalExaminations)
        .where(where),
    ]);
    const details = await this.findExaminationDetails(
      rows.map((row) => row.id),
      database,
    );
    return {
      data: rows.map((row) => toExamination(row, details.get(row.id) ?? null)),
      total: counted?.count ?? 0,
    };
  }

  // --- Clearances ---

  /** Clearances with the restriction text of their source examination. */
  private async selectClearances(
    where: SQL | undefined,
    database: DatabaseExecutor,
  ): Promise<Clearance[]> {
    const rows = await database
      .select({
        clearance: medicalClearances,
        restrictionNotes: medicalExaminations.restrictionNotes,
      })
      .from(medicalClearances)
      .leftJoin(
        medicalExaminations,
        eq(medicalExaminations.id, medicalClearances.examinationId),
      )
      .where(where)
      .orderBy(desc(medicalClearances.validFrom));
    const now = new Date();
    return rows.map((row) =>
      toClearance(row.clearance, row.restrictionNotes ?? null, now),
    );
  }

  async insertClearance(
    values: ClearanceInsert,
    transaction: Transaction,
  ): Promise<Clearance> {
    const [row] = await transaction
      .insert(medicalClearances)
      .values(values)
      .returning({ id: medicalClearances.id });
    const [inserted] = await this.selectClearances(
      eq(medicalClearances.id, row.id),
      transaction,
    );
    return inserted;
  }

  async findClearance(
    clearanceId: string,
    database: DatabaseExecutor = this.db,
  ): Promise<Clearance | undefined> {
    const [clearance] = await this.selectClearances(
      and(
        eq(medicalClearances.id, clearanceId),
        isNull(medicalClearances.deletedAt),
      ),
      database,
    );
    return clearance;
  }

  /** Conditional revoke: returns undefined when the clearance is not ACTIVE. */
  async revokeClearance(
    clearanceId: string,
    revokedById: string,
    revokedReason: string,
    transaction: Transaction,
  ): Promise<Clearance | undefined> {
    const [row] = await transaction
      .update(medicalClearances)
      .set({
        status: 'REVOKED',
        revokedAt: sql`clock_timestamp()`,
        revokedById,
        revokedReason,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(medicalClearances.id, clearanceId),
          eq(medicalClearances.status, 'ACTIVE'),
        ),
      )
      .returning({ id: medicalClearances.id });
    if (!row) return undefined;
    const [revoked] = await this.selectClearances(
      eq(medicalClearances.id, row.id),
      transaction,
    );
    return revoked;
  }

  async hasActiveClearanceForExamination(
    examinationId: string,
    clearanceType: ClearanceType,
    database: DatabaseExecutor = this.db,
  ): Promise<boolean> {
    const [row] = await database
      .select({ id: medicalClearances.id })
      .from(medicalClearances)
      .where(
        and(
          eq(medicalClearances.examinationId, examinationId),
          eq(medicalClearances.clearanceType, clearanceType),
          eq(medicalClearances.status, 'ACTIVE'),
        ),
      )
      .limit(1);
    return row !== undefined;
  }

  async listClearancesForExamination(
    examinationId: string,
    clearanceTypes: readonly ClearanceType[],
    database: DatabaseExecutor = this.db,
  ): Promise<ClearanceEligibilityRow[]> {
    return await database
      .select({
        status: medicalClearances.status,
        validFrom: medicalClearances.validFrom,
        validUntil: medicalClearances.validUntil,
        allowedSessionTypes: medicalClearances.allowedSessionTypes,
        allowedTechniqueTypes: medicalClearances.allowedTechniqueTypes,
        excludedJoints: medicalClearances.excludedJoints,
        createdAt: medicalClearances.createdAt,
      })
      .from(medicalClearances)
      .where(
        and(
          eq(medicalClearances.examinationId, examinationId),
          inArray(medicalClearances.clearanceType, [...clearanceTypes]),
          isNull(medicalClearances.deletedAt),
        ),
      )
      // Server-owned issuance order (migration 012), newest first, every
      // status included: the caller picks the governing clearance first.
      .orderBy(desc(medicalClearances.issueSequence));
  }

  async listActiveClearances(
    fighterId: string,
    database: DatabaseExecutor = this.db,
  ): Promise<Clearance[]> {
    return this.selectClearances(
      and(
        eq(medicalClearances.fighterId, fighterId),
        eq(medicalClearances.status, 'ACTIVE'),
        isNull(medicalClearances.deletedAt),
      ),
      database,
    );
  }

  // --- History report ---

  async listHistory(
    fighterId: string,
    query: ListMedicalHistoryQuery,
    database: DatabaseExecutor = this.db,
  ): Promise<{ data: MedicalHistoryEntry[]; total: number }> {
    const recordType = query.recordType ?? null;
    const history = sql`(
      SELECT 'INJURY' AS record_type, r.injury_id AS record_id, r.revision,
             r.source::text AS source, r.recorded_at, r.recorded_by_user_id, r.snapshot
        FROM public.injury_record_revisions r WHERE r.fighter_id = ${fighterId}
      UNION ALL
      SELECT 'RECOVERY_PLAN', r.recovery_plan_id, r.revision, r.source::text,
             r.recorded_at, r.recorded_by_user_id, r.snapshot
        FROM public.recovery_plan_revisions r WHERE r.fighter_id = ${fighterId}
      UNION ALL
      SELECT 'MEDICAL_CLEARANCE', r.clearance_id, r.revision, r.source::text,
             r.recorded_at, r.recorded_by_user_id, r.snapshot
        FROM public.medical_clearance_revisions r WHERE r.fighter_id = ${fighterId}
      UNION ALL
      SELECT 'MEDICAL_REVIEW_REQUEST', r.review_request_id, r.revision, r.source::text,
             r.recorded_at, r.recorded_by_user_id, r.snapshot
        FROM public.medical_review_request_revisions r WHERE r.fighter_id = ${fighterId}
      UNION ALL
      SELECT 'TREATMENT', t.id, 1, NULL, t.created_at, NULL::uuid, to_jsonb(t)
        FROM public.treatments t
        JOIN public.injury_records i ON i.id = t.injury_id
       WHERE i.fighter_id = ${fighterId}
      UNION ALL
      SELECT 'MEDICAL_EXAMINATION', e.id, 1, NULL, e.created_at, e.recorded_by_id,
             to_jsonb(e) || jsonb_build_object('details', to_jsonb(d) - 'examination_id' - 'fighter_id')
        FROM public.medical_examinations e
        LEFT JOIN public.medical_examination_details d ON d.examination_id = e.id
       WHERE e.fighter_id = ${fighterId}
    ) AS h`;
    const filter = sql`(${recordType}::text IS NULL OR h.record_type = ${recordType}::text)`;

    const [rowsResult, countResult] = await Promise.all([
      database.execute<{
        record_type: MedicalHistoryRecordType;
        record_id: string;
        revision: number;
        source: 'APPLICATION' | 'MIGRATION_BASELINE' | null;
        recorded_at: string | Date;
        recorded_by_user_id: string | null;
        snapshot: unknown;
      }>(sql`
        SELECT h.* FROM ${history} WHERE ${filter}
        ORDER BY h.recorded_at DESC, h.record_id, h.revision DESC
        LIMIT ${query.limit} OFFSET ${offsetOf(query)}
      `),
      database.execute<{ count: number }>(
        sql`SELECT count(*)::int AS count FROM ${history} WHERE ${filter}`,
      ),
    ]);

    return {
      data: rowsResult.rows.map((row) => ({
        recordType: row.record_type,
        recordId: row.record_id,
        revision: row.revision,
        source: row.source,
        recordedAt: new Date(row.recorded_at),
        recordedByUserId: row.recorded_by_user_id,
        snapshot: projectSnapshot(row.record_type, row.snapshot),
      })),
      total: countResult.rows[0]?.count ?? 0,
    };
  }
}
