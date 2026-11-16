import { z } from 'zod';

// ---------------------------------------------------------------------------
// Open medical review requests for the doctor's assigned fighters (mobile doctor "Hôm nay", 2026-11-11).
// Read-only: resolving still happens through an examination.
// ---------------------------------------------------------------------------

/** More open requests than this is far beyond one doctor's day; the list says it was cut. */
export const DOCTOR_REVIEWS_LIMIT = 50;

export const doctorReviewItemSchema = z.object({
  id: z.uuid(),
  fighterId: z.uuid(),
  fighterName: z.string(),
  reason: z.string(),
  requestedAt: z.string(),
  requesterRole: z.string(),
  /** Coach or doctor name when the requester has a profile; null otherwise. */
  requesterName: z.string().nullable(),
});
export type DoctorReviewItem = z.infer<typeof doctorReviewItemSchema>;

export const doctorReviewsResponseSchema = z.object({
  items: z.array(doctorReviewItemSchema),
  truncated: z.boolean(),
});
export type DoctorReviewsResponse = z.infer<typeof doctorReviewsResponseSchema>;

export interface DoctorReviewRow {
  id: string;
  fighterId: string;
  reason: string;
  requestedAt: Date | string;
  requesterRole: string;
  coachFirst: string | null;
  coachLast: string | null;
  doctorFirst: string | null;
  doctorLast: string | null;
}

/** Oldest first (waiting longest), named, cut at the limit. Rows of fighters not in `names` are dropped. */
export function buildDoctorReviews(rows: DoctorReviewRow[], names: Map<string, string>, limit = DOCTOR_REVIEWS_LIMIT): DoctorReviewsResponse {
  const join = (a: string | null, b: string | null) => (a || b ? `${a ?? ''} ${b ?? ''}`.trim() : null);
  const items = rows
    .filter((r) => names.has(r.fighterId))
    .map((r) => ({
      id: r.id,
      fighterId: r.fighterId,
      fighterName: names.get(r.fighterId) ?? '',
      reason: r.reason,
      requestedAt: (r.requestedAt instanceof Date ? r.requestedAt : new Date(r.requestedAt)).toISOString(),
      requesterRole: r.requesterRole,
      requesterName: join(r.coachFirst, r.coachLast) ?? join(r.doctorFirst, r.doctorLast),
    }))
    .sort((a, b) => a.requestedAt.localeCompare(b.requestedAt));
  return { items: items.slice(0, limit), truncated: items.length > limit };
}
