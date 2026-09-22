import { Inject, Injectable } from '@nestjs/common';
import {
  and,
  count,
  countDistinct,
  eq,
  gt,
  isNull,
  lte,
  or,
} from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../database/database.module.js';
import {
  aiAnalyses,
  analysisJobs,
  coachFighters,
  coaches,
  coachReviews,
  doctorFighters,
  healthAlerts,
  notifications,
  sportsDoctors,
} from '../database/schema.js';

@Injectable()
export class NavigationRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async countUnreadNotifications(userId: string): Promise<number> {
    const [result] = await this.db
      .select({ value: count() })
      .from(notifications)
      .where(
        and(eq(notifications.userId, userId), eq(notifications.isRead, false)),
      );
    return result?.value ?? 0;
  }

  async countCoachReviewQueue(userId: string): Promise<number> {
    const now = new Date();
    const [result] = await this.db
      .select({ value: countDistinct(aiAnalyses.id) })
      .from(aiAnalyses)
      .innerJoin(
        coachFighters,
        and(
          eq(coachFighters.fighterId, aiAnalyses.fighterId),
          lte(coachFighters.startsAt, now),
          or(isNull(coachFighters.endsAt), gt(coachFighters.endsAt, now)),
        ),
      )
      .innerJoin(
        coaches,
        and(
          eq(coaches.id, coachFighters.coachId),
          eq(coaches.userId, userId),
          eq(coaches.isActive, true),
          isNull(coaches.deletedAt),
        ),
      )
      .leftJoin(
        coachReviews,
        and(
          eq(coachReviews.analysisId, aiAnalyses.id),
          eq(coachReviews.coachId, coaches.id),
        ),
      )
      .where(and(eq(aiAnalyses.status, 'COMPLETED'), isNull(coachReviews.id)));
    return result?.value ?? 0;
  }

  async countDoctorPendingAlerts(userId: string): Promise<number> {
    const now = new Date();
    const [result] = await this.db
      .select({ value: countDistinct(healthAlerts.id) })
      .from(healthAlerts)
      .innerJoin(
        doctorFighters,
        and(
          eq(doctorFighters.fighterId, healthAlerts.fighterId),
          lte(doctorFighters.startsAt, now),
          or(isNull(doctorFighters.endsAt), gt(doctorFighters.endsAt, now)),
        ),
      )
      .innerJoin(
        sportsDoctors,
        and(
          eq(sportsDoctors.id, doctorFighters.doctorId),
          eq(sportsDoctors.userId, userId),
          eq(sportsDoctors.isActive, true),
          isNull(sportsDoctors.deletedAt),
        ),
      )
      .where(eq(healthAlerts.reviewDecision, 'PENDING'));
    return result?.value ?? 0;
  }

  async countFailedJobs(): Promise<number> {
    const [result] = await this.db
      .select({ value: count() })
      .from(analysisJobs)
      .where(eq(analysisJobs.status, 'FAILED'));
    return result?.value ?? 0;
  }
}
