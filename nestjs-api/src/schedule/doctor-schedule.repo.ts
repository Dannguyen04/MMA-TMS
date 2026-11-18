import { Inject, Injectable } from '@nestjs/common';
import { and, eq, gt, gte, inArray, isNull, lte, notInArray, or, sql } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../database/database.module.js';
import {
  bouts,
  doctorFighters,
  fighters,
  medicalClearances,
  medicalExaminationDetails,
  medicalExaminations,
  sportsDoctors,
  suspensions,
} from '../database/schema.js';
import type { DoctorScheduleRows } from './doctor-schedule.model.js';
import type { DoctorReviewRow } from './doctor-reviews.model.js';
import { coaches, medicalReviewRequests } from '../database/schema.js';

/** Reads for the doctor's schedule. Every read is batched over the assigned fighters: no query per fighter. */
@Injectable()
export class DoctorScheduleRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  /** Fighters the doctor (by user id) is assigned to right now. */
  async findAssignedFighters(userId: string, now: Date): Promise<DoctorScheduleRows['fighters']> {
    return this.db
      .selectDistinct({ id: fighters.id, firstName: fighters.firstName, lastName: fighters.lastName })
      .from(doctorFighters)
      .innerJoin(sportsDoctors, eq(doctorFighters.doctorId, sportsDoctors.id))
      .innerJoin(fighters, eq(doctorFighters.fighterId, fighters.id))
      .where(and(
        eq(sportsDoctors.userId, userId),
        eq(sportsDoctors.isActive, true),
        isNull(sportsDoctors.deletedAt),
        isNull(fighters.deletedAt),
        lte(doctorFighters.startsAt, now),
        or(isNull(doctorFighters.endsAt), gt(doctorFighters.endsAt, now)),
      ));
  }

  /** OPEN review requests of these fighters, with the requester's coach or doctor name when there is one. */
  async findOpenReviewRequests(fighterIds: string[], limit: number): Promise<DoctorReviewRow[]> {
    if (fighterIds.length === 0) return [];
    return this.db
      .select({
        id: medicalReviewRequests.id,
        fighterId: medicalReviewRequests.fighterId,
        reason: medicalReviewRequests.reason,
        requestedAt: medicalReviewRequests.requestedAt,
        requesterRole: medicalReviewRequests.requesterRole,
        coachFirst: coaches.firstName,
        coachLast: coaches.lastName,
        doctorFirst: sportsDoctors.firstName,
        doctorLast: sportsDoctors.lastName,
      })
      .from(medicalReviewRequests)
      .leftJoin(coaches, eq(coaches.userId, medicalReviewRequests.requestedById))
      .leftJoin(sportsDoctors, eq(sportsDoctors.userId, medicalReviewRequests.requestedById))
      .where(and(inArray(medicalReviewRequests.fighterId, fighterIds), eq(medicalReviewRequests.status, 'OPEN')))
      .orderBy(medicalReviewRequests.requestedAt)
      // One more than the limit tells the model the list was cut.
      .limit(limit + 1);
  }

  /**
   * Rows that may land in [fromInstant, toInstant). Timestamps are read with that instant window; date-only columns
   * with the date window. The model keeps only items whose academy date is inside the window.
   */
  async findRows(fighterIds: string[], from: string, to: string, fromInstant: Date, toInstant: Date): Promise<Omit<DoctorScheduleRows, 'fighters'>> {
    if (fighterIds.length === 0) return { followUps: [], clearances: [], bouts: [], suspensions: [] };
    const [followUps, clearances, boutRows, suspensionRows] = await Promise.all([
      // Follow-ups of current examinations only: a corrected examination (one with a successor) no longer counts.
      this.db
        .select({ examinationId: medicalExaminationDetails.examinationId, fighterId: medicalExaminationDetails.fighterId, followUpDate: medicalExaminationDetails.followUpDate })
        .from(medicalExaminationDetails)
        .innerJoin(medicalExaminations, eq(medicalExaminationDetails.examinationId, medicalExaminations.id))
        .where(and(
          inArray(medicalExaminationDetails.fighterId, fighterIds),
          gte(medicalExaminationDetails.followUpDate, from),
          lte(medicalExaminationDetails.followUpDate, to),
          sql`NOT EXISTS (SELECT 1 FROM medical_examinations successor WHERE successor.supersedes_id = ${medicalExaminations.id})`,
        )),
      this.db
        .select({ id: medicalClearances.id, fighterId: medicalClearances.fighterId, clearanceType: medicalClearances.clearanceType, validUntil: medicalClearances.validUntil })
        .from(medicalClearances)
        .where(and(
          inArray(medicalClearances.fighterId, fighterIds),
          eq(medicalClearances.status, 'ACTIVE'),
          isNull(medicalClearances.revokedAt),
          isNull(medicalClearances.deletedAt),
          gte(medicalClearances.validUntil, fromInstant),
          lte(medicalClearances.validUntil, toInstant),
        )),
      this.db
        .select({ id: bouts.id, fighterId: bouts.fighterId, eventName: bouts.eventName, weighInAt: bouts.weighInAt, boutAt: bouts.boutAt })
        .from(bouts)
        .where(and(
          inArray(bouts.fighterId, fighterIds),
          notInArray(bouts.status, ['COMPLETED', 'CANCELLED']),
          or(
            and(gte(bouts.weighInAt, fromInstant), lte(bouts.weighInAt, toInstant)),
            and(gte(bouts.boutAt, fromInstant), lte(bouts.boutAt, toInstant)),
          ),
        )),
      // A suspension already cleared or ended early is not an upcoming end date.
      this.db
        .select({ id: suspensions.id, fighterId: suspensions.fighterId, reason: suspensions.reason, endsOn: suspensions.endsOn })
        .from(suspensions)
        .where(and(
          inArray(suspensions.fighterId, fighterIds),
          isNull(suspensions.deletedAt),
          isNull(suspensions.clearedAt),
          isNull(suspensions.earlyEndExaminationId),
          gte(suspensions.endsOn, from),
          lte(suspensions.endsOn, to),
        )),
    ]);
    return {
      followUps: followUps.filter((f): f is typeof f & { followUpDate: string } => f.followUpDate !== null),
      clearances: clearances.filter((c): c is typeof c & { validUntil: Date } => c.validUntil !== null),
      bouts: boutRows,
      suspensions: suspensionRows,
    };
  }
}
