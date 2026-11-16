import { Injectable } from '@nestjs/common';
import { forbidden } from '../shared/errors/access.error.js';
import type { AuthenticatedUser } from '../shared/models/auth-context.model.js';
import { USER } from '../shared/types/user.role.js';
import { ACADEMY_UTC_OFFSET_MS, addDaysToDate } from '../suspensions/suspensions.constants.js';
import { buildDoctorSchedule, type DoctorScheduleQuery, type DoctorScheduleResponse } from './doctor-schedule.model.js';
import { DoctorScheduleRepository } from './doctor-schedule.repo.js';
import { buildDoctorReviews, DOCTOR_REVIEWS_LIMIT, type DoctorReviewsResponse } from './doctor-reviews.model.js';

const startOf = (date: string) => new Date(Date.parse(`${date}T00:00:00.000Z`) - ACADEMY_UTC_OFFSET_MS);

@Injectable()
export class DoctorScheduleService {
  constructor(private readonly repo: DoctorScheduleRepository) {}

  /**
   * Follow-up exams, clearance expiries, weigh-ins, bouts and suspension ends of the doctor's assigned fighters in
   * [from, to] (academy dates, inclusive). DOCTOR only, even when another role holds the route permissions.
   */
  async getSchedule(actor: AuthenticatedUser, query: DoctorScheduleQuery): Promise<DoctorScheduleResponse> {
    if (actor.role !== USER.DOCTOR) throw forbidden();
    const fighters = await this.repo.findAssignedFighters(actor.id, new Date());
    const fromInstant = startOf(query.from);
    const toInstant = new Date(startOf(addDaysToDate(query.to, 1)).getTime() - 1);
    const rows = await this.repo.findRows(fighters.map((f) => f.id), query.from, query.to, fromInstant, toInstant);
    return { from: query.from, to: query.to, items: buildDoctorSchedule({ fighters, ...rows }, query.from, query.to) };
  }

  /** Open review requests (coach asked for an exam) of the doctor's assigned fighters, oldest first. DOCTOR only. */
  async getOpenReviews(actor: AuthenticatedUser): Promise<DoctorReviewsResponse> {
    if (actor.role !== USER.DOCTOR) throw forbidden();
    const fighters = await this.repo.findAssignedFighters(actor.id, new Date());
    const names = new Map(fighters.map((f) => [f.id, `${f.firstName} ${f.lastName}`.trim()]));
    const rows = await this.repo.findOpenReviewRequests([...names.keys()], DOCTOR_REVIEWS_LIMIT);
    return buildDoctorReviews(rows, names);
  }
}
