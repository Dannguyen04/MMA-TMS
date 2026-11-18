import { apiFetch } from "./client";
import { withQuery } from "./query";

/** GET /doctor/schedule (nestjs-api src/schedule, added 2026-11-11): DOCTOR only, assigned fighters, ≤ 62 days. */
export type DoctorScheduleKind = "FOLLOW_UP" | "CLEARANCE_EXPIRY" | "WEIGH_IN" | "BOUT" | "SUSPENSION_END";
export type DoctorScheduleItem = {
  kind: DoctorScheduleKind;
  /** Academy date YYYY-MM-DD. */
  date: string;
  /** ISO instant for weigh-ins and bouts, null for whole-day items. */
  at: string | null;
  fighterId: string;
  fighterName: string;
  refId: string;
  /** Event name (bouts), clearance type (expiry), suspension reason (end); null otherwise. */
  label: string | null;
};
export type DoctorSchedule = { from: string; to: string; items: DoctorScheduleItem[] };

/** GET /doctor/review-requests (added 2026-11-11): OPEN requests of assigned fighters, oldest first, ≤ 50. */
export type DoctorReview = { id: string; fighterId: string; fighterName: string; reason: string; requestedAt: string; requesterRole: string; requesterName: string | null };
export type DoctorReviews = { items: DoctorReview[]; truncated: boolean };

export const scheduleApi = {
  doctorReviews: () => apiFetch<DoctorReviews>("/doctor/review-requests"),
  doctor: (from: string, to: string) => apiFetch<DoctorSchedule>(withQuery("/doctor/schedule", { from, to })),
};
