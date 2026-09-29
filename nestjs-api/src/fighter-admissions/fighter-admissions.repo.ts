import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, inArray, isNull, lt, ne, or, sql } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../database/database.module.js';
import {
  coaches,
  fighterApplicationActivations,
  fighterApplicationAssessments,
  fighterApplicationCoachAssignments,
  fighterApplicationDecisions,
  fighterApplications,
  users,
} from '../database/schema.js';
import {
  type DatabaseExecutor,
  type Transaction,
} from '../shared/utils/audit-context.util.js';
import {
  ACTIVATION_STATUS,
  OPEN_APPLICATION_STATUSES,
  type ActivationStatus,
  type ApplicationStatus,
} from './fighter-admissions.constants.js';
import type {
  AssessmentCriterion,
  SubmitApplicationInput,
} from './fighter-admissions.model.js';

const applicationProjection = {
  id: fighterApplications.id,
  guestUserId: fighterApplications.guestUserId,
  email: fighterApplications.email,
  firstName: fighterApplications.firstName,
  lastName: fighterApplications.lastName,
  dateOfBirth: fighterApplications.dateOfBirth,
  weightClass: fighterApplications.weightClass,
  nationality: fighterApplications.nationality,
  contactPhone: fighterApplications.contactPhone,
  trainingBackground: fighterApplications.trainingBackground,
  competitionBackground: fighterApplications.competitionBackground,
  motivation: fighterApplications.motivation,
  status: fighterApplications.status,
  submittedAt: fighterApplications.submittedAt,
};

const assignmentProjection = {
  id: fighterApplicationCoachAssignments.id,
  applicationId: fighterApplicationCoachAssignments.applicationId,
  coachId: fighterApplicationCoachAssignments.coachId,
  assignedById: fighterApplicationCoachAssignments.assignedById,
  startsAt: fighterApplicationCoachAssignments.startsAt,
  endsAt: fighterApplicationCoachAssignments.endsAt,
  endedById: fighterApplicationCoachAssignments.endedById,
  endReason: fighterApplicationCoachAssignments.endReason,
};

const assessmentProjection = {
  id: fighterApplicationAssessments.id,
  applicationId: fighterApplicationAssessments.applicationId,
  assignmentId: fighterApplicationAssessments.assignmentId,
  coachId: fighterApplicationAssessments.coachId,
  conclusion: fighterApplicationAssessments.conclusion,
  summary: fighterApplicationAssessments.summary,
  criteria: fighterApplicationAssessments.criteria,
  assessedAt: fighterApplicationAssessments.assessedAt,
};

const decisionProjection = {
  id: fighterApplicationDecisions.id,
  applicationId: fighterApplicationDecisions.applicationId,
  assessmentId: fighterApplicationDecisions.assessmentId,
  adminId: fighterApplicationDecisions.adminId,
  decision: fighterApplicationDecisions.decision,
  reason: fighterApplicationDecisions.reason,
  decidedAt: fighterApplicationDecisions.decidedAt,
};

const activationProjection = {
  id: fighterApplicationActivations.id,
  applicationId: fighterApplicationActivations.applicationId,
  decisionId: fighterApplicationActivations.decisionId,
  guestUserId: fighterApplicationActivations.guestUserId,
  status: fighterApplicationActivations.status,
  recoveryAttempts: fighterApplicationActivations.recoveryAttempts,
  attemptedAt: fighterApplicationActivations.attemptedAt,
  acceptedAt: fighterApplicationActivations.acceptedAt,
  passwordSetAt: fighterApplicationActivations.passwordSetAt,
  completedAt: fighterApplicationActivations.completedAt,
  updatedAt: fighterApplicationActivations.updatedAt,
};

@Injectable()
export class FighterAdmissionsRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  transaction<T>(work: (transaction: Transaction) => Promise<T>): Promise<T> {
    return this.db.transaction(work);
  }

  /**
   * Locks the attempt for the duration of the transaction. Every state-dependent
   * workflow step reads through this lock instead of relying on a conditional
   * UPDATE alone, so a concurrent reassignment and assessment cannot interleave.
   */
  async lockApplication(id: string, database: Transaction) {
    const [application] = await database
      .select(applicationProjection)
      .from(fighterApplications)
      .where(eq(fighterApplications.id, id))
      .limit(1)
      .for('update');
    return application;
  }

  async findApplicationById(id: string, database: DatabaseExecutor = this.db) {
    const [application] = await database
      .select(applicationProjection)
      .from(fighterApplications)
      .where(eq(fighterApplications.id, id))
      .limit(1);
    return application;
  }

  async hasOpenApplication(
    guestUserId: string,
    database: DatabaseExecutor = this.db,
  ): Promise<boolean> {
    const [row] = await database
      .select({ exists: sql<number>`1` })
      .from(fighterApplications)
      .where(
        and(
          eq(fighterApplications.guestUserId, guestUserId),
          inArray(fighterApplications.status, [...OPEN_APPLICATION_STATUSES]),
        ),
      )
      .limit(1);
    return Boolean(row);
  }

  async insertApplication(
    input: SubmitApplicationInput & { guestUserId: string; email: string },
    database: DatabaseExecutor,
  ) {
    const [application] = await database
      .insert(fighterApplications)
      .values({
        guestUserId: input.guestUserId,
        email: input.email,
        firstName: input.firstName,
        lastName: input.lastName,
        dateOfBirth: input.dateOfBirth,
        weightClass: input.weightClass,
        nationality: input.nationality ?? null,
        contactPhone: input.contactPhone ?? null,
        trainingBackground: input.trainingBackground ?? null,
        competitionBackground: input.competitionBackground ?? null,
        motivation: input.motivation ?? null,
      })
      .returning(applicationProjection);
    return application;
  }

  /**
   * Conditional status advance. The caller must verify the returned row instead
   * of assuming the write happened.
   */
  async advanceApplicationStatus(
    id: string,
    from: ApplicationStatus,
    to: ApplicationStatus,
    database: Transaction,
  ) {
    const [updated] = await database
      .update(fighterApplications)
      .set({ status: to })
      .where(
        and(eq(fighterApplications.id, id), eq(fighterApplications.status, from)),
      )
      .returning({ id: fighterApplications.id });
    return updated;
  }

  async listApplicationsByGuest(
    guestUserId: string,
    pagination: { page: number; limit: number },
    database: DatabaseExecutor = this.db,
  ) {
    const where = eq(fighterApplications.guestUserId, guestUserId);
    const [items, [totals]] = await Promise.all([
      database
        .select(applicationProjection)
        .from(fighterApplications)
        .where(where)
        .orderBy(desc(fighterApplications.submittedAt))
        .limit(pagination.limit)
        .offset((pagination.page - 1) * pagination.limit),
      database
        .select({ count: sql<number>`count(*)::int` })
        .from(fighterApplications)
        .where(where),
    ]);
    return { items, total: totals?.count ?? 0 };
  }

  async listApplications(
    filter: { status?: ApplicationStatus },
    pagination: { page: number; limit: number },
    database: DatabaseExecutor = this.db,
  ) {
    const where = filter.status
      ? eq(fighterApplications.status, filter.status)
      : undefined;
    const [items, [totals]] = await Promise.all([
      database
        .select(applicationProjection)
        .from(fighterApplications)
        .where(where)
        .orderBy(desc(fighterApplications.submittedAt))
        .limit(pagination.limit)
        .offset((pagination.page - 1) * pagination.limit),
      database
        .select({ count: sql<number>`count(*)::int` })
        .from(fighterApplications)
        .where(where),
    ]);
    return { items, total: totals?.count ?? 0 };
  }

  async listApplicationsForCoach(
    coachId: string,
    pagination: { page: number; limit: number },
    database: DatabaseExecutor = this.db,
  ) {
    const where = and(
      eq(fighterApplicationCoachAssignments.coachId, coachId),
      isNull(fighterApplicationCoachAssignments.endsAt),
    );
    const [items, [totals]] = await Promise.all([
      database
        .select(applicationProjection)
        .from(fighterApplications)
        .innerJoin(
          fighterApplicationCoachAssignments,
          eq(
            fighterApplicationCoachAssignments.applicationId,
            fighterApplications.id,
          ),
        )
        .where(where)
        .orderBy(desc(fighterApplications.submittedAt))
        .limit(pagination.limit)
        .offset((pagination.page - 1) * pagination.limit),
      database
        .select({ count: sql<number>`count(*)::int` })
        .from(fighterApplications)
        .innerJoin(
          fighterApplicationCoachAssignments,
          eq(
            fighterApplicationCoachAssignments.applicationId,
            fighterApplications.id,
          ),
        )
        .where(where),
    ]);
    return { items, total: totals?.count ?? 0 };
  }

  async findActiveCoachById(
    coachId: string,
    database: DatabaseExecutor = this.db,
  ) {
    const [coach] = await database
      .select({ id: coaches.id })
      .from(coaches)
      .where(
        and(
          eq(coaches.id, coachId),
          eq(coaches.isActive, true),
          isNull(coaches.deletedAt),
        ),
      )
      .limit(1);
    return coach;
  }

  async findActiveCoachByUserId(
    userId: string,
    database: DatabaseExecutor = this.db,
  ) {
    const [coach] = await database
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
    return coach;
  }

  async findOpenAssignment(
    applicationId: string,
    database: DatabaseExecutor = this.db,
  ) {
    const [assignment] = await database
      .select(assignmentProjection)
      .from(fighterApplicationCoachAssignments)
      .where(
        and(
          eq(fighterApplicationCoachAssignments.applicationId, applicationId),
          isNull(fighterApplicationCoachAssignments.endsAt),
        ),
      )
      .limit(1);
    return assignment;
  }

  async listAssignments(
    applicationId: string,
    database: DatabaseExecutor = this.db,
  ) {
    return database
      .select(assignmentProjection)
      .from(fighterApplicationCoachAssignments)
      .where(
        eq(fighterApplicationCoachAssignments.applicationId, applicationId),
      )
      .orderBy(desc(fighterApplicationCoachAssignments.startsAt));
  }

  /** Closes the open episode so the replacement becomes a new period, not an edit. */
  async closeOpenAssignment(
    applicationId: string,
    closure: { endedById: string; endReason: string },
    database: Transaction,
  ) {
    const [closed] = await database
      .update(fighterApplicationCoachAssignments)
      .set({
        endsAt: new Date(),
        endedById: closure.endedById,
        endReason: closure.endReason,
      })
      .where(
        and(
          eq(fighterApplicationCoachAssignments.applicationId, applicationId),
          isNull(fighterApplicationCoachAssignments.endsAt),
        ),
      )
      .returning({ id: fighterApplicationCoachAssignments.id });
    return closed;
  }

  async insertAssignment(
    input: { applicationId: string; coachId: string; assignedById: string },
    database: Transaction,
  ) {
    const [assignment] = await database
      .insert(fighterApplicationCoachAssignments)
      .values(input)
      .returning(assignmentProjection);
    return assignment;
  }

  async findAssessmentByApplication(
    applicationId: string,
    database: DatabaseExecutor = this.db,
  ) {
    const [assessment] = await database
      .select(assessmentProjection)
      .from(fighterApplicationAssessments)
      .where(eq(fighterApplicationAssessments.applicationId, applicationId))
      .limit(1);
    return assessment;
  }

  async insertAssessment(
    input: {
      applicationId: string;
      assignmentId: string;
      coachId: string;
      conclusion: 'PASS' | 'FAIL';
      summary: string;
      criteria: readonly AssessmentCriterion[];
    },
    database: Transaction,
  ) {
    const [assessment] = await database
      .insert(fighterApplicationAssessments)
      .values({
        applicationId: input.applicationId,
        assignmentId: input.assignmentId,
        coachId: input.coachId,
        conclusion: input.conclusion,
        summary: input.summary,
        criteria: [...input.criteria],
      })
      .returning(assessmentProjection);
    return assessment;
  }

  async findDecisionByApplication(
    applicationId: string,
    database: DatabaseExecutor = this.db,
  ) {
    const [decision] = await database
      .select(decisionProjection)
      .from(fighterApplicationDecisions)
      .where(eq(fighterApplicationDecisions.applicationId, applicationId))
      .limit(1);
    return decision;
  }

  async insertDecision(
    input: {
      applicationId: string;
      assessmentId: string;
      adminId: string;
      decision: 'APPROVED' | 'REJECTED';
      reason: string;
    },
    database: Transaction,
  ) {
    const [decision] = await database
      .insert(fighterApplicationDecisions)
      .values(input)
      .returning(decisionProjection);
    return decision;
  }

  async insertActivation(
    input: { applicationId: string; decisionId: string; guestUserId: string },
    database: Transaction,
  ) {
    const [activation] = await database
      .insert(fighterApplicationActivations)
      .values(input)
      .returning(activationProjection);
    return activation;
  }

  async findActivationByApplication(
    applicationId: string,
    database: DatabaseExecutor = this.db,
  ) {
    const [activation] = await database
      .select(activationProjection)
      .from(fighterApplicationActivations)
      .where(eq(fighterApplicationActivations.applicationId, applicationId))
      .limit(1);
    return activation;
  }

  async lockActivationByApplication(
    applicationId: string,
    database: Transaction,
  ) {
    const [activation] = await database
      .select(activationProjection)
      .from(fighterApplicationActivations)
      .where(eq(fighterApplicationActivations.applicationId, applicationId))
      .limit(1)
      .for('update');
    return activation;
  }

  /**
   * Resolves the activation of the approved application that belongs to the
   * verified Supabase subject, locking it for the caller's transaction.
   */
  async lockActivationByAuthSubject(authSubject: string, database: Transaction) {
    const [row] = await database
      .select({
        activation: activationProjection,
        application: applicationProjection,
        userRole: users.role,
      })
      .from(fighterApplicationActivations)
      .innerJoin(
        users,
        eq(users.id, fighterApplicationActivations.guestUserId),
      )
      .innerJoin(
        fighterApplications,
        eq(fighterApplications.id, fighterApplicationActivations.applicationId),
      )
      .where(
        and(
          eq(users.authUserId, authSubject),
          eq(users.isActive, true),
          isNull(users.deletedAt),
        ),
      )
      .orderBy(desc(fighterApplicationActivations.createdAt))
      .limit(1)
      .for('update', { of: fighterApplicationActivations });
    return row;
  }

  async lockActivationByGuestUserId(guestUserId: string, database: Transaction) {
    const [row] = await database
      .select({
        activation: activationProjection,
        application: applicationProjection,
      })
      .from(fighterApplicationActivations)
      .innerJoin(
        fighterApplications,
        eq(fighterApplications.id, fighterApplicationActivations.applicationId),
      )
      .where(eq(fighterApplicationActivations.guestUserId, guestUserId))
      .orderBy(desc(fighterApplicationActivations.createdAt))
      .limit(1)
      .for('update', { of: fighterApplicationActivations });
    return row;
  }

  /**
   * Conditional activation transition. Returns the updated row or undefined, so
   * the caller re-reads the real state instead of assuming an outcome.
   */
  async advanceActivationStatus(
    activationId: string,
    from: ActivationStatus,
    to: ActivationStatus,
    database: Transaction,
  ) {
    const now = new Date();
    const [updated] = await database
      .update(fighterApplicationActivations)
      .set({
        status: to,
        ...(to === ACTIVATION_STATUS.PASSWORD_SET
          ? { passwordSetAt: now }
          : {}),
        ...(to === ACTIVATION_STATUS.COMPLETED ? { completedAt: now } : {}),
      })
      .where(
        and(
          eq(fighterApplicationActivations.id, activationId),
          eq(fighterApplicationActivations.status, from),
        ),
      )
      .returning(activationProjection);
    return updated;
  }

  /**
   * Claims the next recovery-mail send *before* the provider is called. The
   * cooldown and the attempt counter move in one conditional UPDATE, so two
   * concurrent requests cannot both reach the provider. Returns undefined when
   * the activation is not PENDING or the cooldown has not expired; the caller
   * re-reads the real state to classify that.
   */
  async claimRecoverySend(
    activationId: string,
    cooldownMs: number,
    database: Transaction,
  ) {
    const attemptedAt = new Date();
    const cooldownStart = new Date(attemptedAt.getTime() - cooldownMs);
    const [claimed] = await database
      .update(fighterApplicationActivations)
      .set({
        attemptedAt,
        recoveryAttempts: sql`${fighterApplicationActivations.recoveryAttempts} + 1`,
      })
      .where(
        and(
          eq(fighterApplicationActivations.id, activationId),
          eq(fighterApplicationActivations.status, ACTIVATION_STATUS.PENDING),
          or(
            isNull(fighterApplicationActivations.attemptedAt),
            lt(fighterApplicationActivations.attemptedAt, cooldownStart),
          ),
        ),
      )
      .returning(activationProjection);
    return claimed;
  }

  /**
   * Records that the provider accepted the send request. Acceptance is not a
   * delivery confirmation, so nothing else may infer delivery from this column.
   */
  async markRecoveryAccepted(activationId: string, database: Transaction) {
    const [updated] = await database
      .update(fighterApplicationActivations)
      .set({ acceptedAt: new Date() })
      .where(
        and(
          eq(fighterApplicationActivations.id, activationId),
          // A completed activation is immutable; skip the bookkeeping rather
          // than letting the guard trigger turn it into a request error.
          ne(
            fighterApplicationActivations.status,
            ACTIVATION_STATUS.COMPLETED,
          ),
        ),
      )
      .returning(activationProjection);
    return updated;
  }

  /**
   * Releases an abandoned password-reset claim (IN_PROGRESS older than the
   * stale window) back to PENDING. It never sets PASSWORD_SET, which still
   * requires a confirmed provider password change.
   */
  async releaseStaleClaim(
    activationId: string,
    staleBefore: Date,
    database: Transaction,
  ) {
    const [released] = await database
      .update(fighterApplicationActivations)
      .set({ status: ACTIVATION_STATUS.PENDING })
      .where(
        and(
          eq(fighterApplicationActivations.id, activationId),
          eq(
            fighterApplicationActivations.status,
            ACTIVATION_STATUS.IN_PROGRESS,
          ),
          lt(fighterApplicationActivations.updatedAt, staleBefore),
        ),
      )
      .returning(activationProjection);
    return released;
  }

  /** Current account email, which may differ from the application snapshot. */
  async findAccountEmail(userId: string, database: DatabaseExecutor = this.db) {
    const [row] = await database
      .select({ email: users.email })
      .from(users)
      .where(
        and(
          eq(users.id, userId),
          eq(users.isActive, true),
          isNull(users.deletedAt),
        ),
      )
      .limit(1);
    return row?.email;
  }
}
