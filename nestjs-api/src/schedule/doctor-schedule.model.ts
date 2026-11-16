import { z } from 'zod';
import { academyDateOf, daysBetweenDates } from '../suspensions/suspensions.constants.js';
import { dateOnlySchema } from '../shared/utils/zod-schema.util.js';

// ---------------------------------------------------------------------------
// Doctor schedule (mobile redesign 2026-11-11): one read for the doctor's week.
// Assigned fighters only. Computed on read, no job, no notification.
// ---------------------------------------------------------------------------

export const DOCTOR_SCHEDULE_KINDS = [
  'FOLLOW_UP',
  'CLEARANCE_EXPIRY',
  'WEIGH_IN',
  'BOUT',
  'SUSPENSION_END',
] as const;
export type DoctorScheduleKind = (typeof DOCTOR_SCHEDULE_KINDS)[number];

/** The widest window one read may ask for (a month view plus margins). */
export const DOCTOR_SCHEDULE_MAX_DAYS = 62;

export const doctorScheduleQuerySchema = z
  .strictObject({ from: dateOnlySchema, to: dateOnlySchema })
  .superRefine((q, ctx) => {
    const span = daysBetweenDates(q.from, q.to);
    if (span < 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['to'], message: 'to must not be before from.' });
    } else if (span > DOCTOR_SCHEDULE_MAX_DAYS) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['to'], message: `The window is at most ${DOCTOR_SCHEDULE_MAX_DAYS} days.` });
    }
  });
export type DoctorScheduleQuery = z.infer<typeof doctorScheduleQuerySchema>;

export const doctorScheduleItemSchema = z.object({
  kind: z.enum(DOCTOR_SCHEDULE_KINDS),
  /** Academy calendar date (YYYY-MM-DD) the item falls on. */
  date: dateOnlySchema,
  /** Exact instant for weigh-ins and bouts; null for whole-day items. */
  at: z.string().nullable(),
  fighterId: z.uuid(),
  fighterName: z.string(),
  /** The record the item comes from (examination, clearance, bout or suspension). */
  refId: z.uuid(),
  /** Event name for bouts; clearance type for expiries; suspension reason for suspension ends; null otherwise. */
  label: z.string().nullable(),
});
export type DoctorScheduleItem = z.infer<typeof doctorScheduleItemSchema>;

export const doctorScheduleResponseSchema = z.object({
  from: dateOnlySchema,
  to: dateOnlySchema,
  items: z.array(doctorScheduleItemSchema),
});
export type DoctorScheduleResponse = z.infer<typeof doctorScheduleResponseSchema>;

/** Raw rows the repository returns; dates may be Date or ISO/date strings from the driver. */
export interface DoctorScheduleRows {
  fighters: { id: string; firstName: string; lastName: string }[];
  followUps: { examinationId: string; fighterId: string; followUpDate: string }[];
  clearances: { id: string; fighterId: string; clearanceType: string; validUntil: Date | string }[];
  bouts: { id: string; fighterId: string; eventName: string; weighInAt: Date | string; boutAt: Date | string }[];
  suspensions: { id: string; fighterId: string; reason: string; endsOn: string }[];
}

const toDate = (v: Date | string) => (v instanceof Date ? v : new Date(v));
const iso = (v: Date | string) => toDate(v).toISOString();
const ORDER: Record<DoctorScheduleKind, number> = { BOUT: 0, WEIGH_IN: 1, SUSPENSION_END: 2, CLEARANCE_EXPIRY: 3, FOLLOW_UP: 4 };

/**
 * Turns the rows into the day items inside [from, to] (academy dates). Whole-day items come first on a day,
 * then timed ones by time. A clearance "expires" on the academy date of its validUntil instant.
 */
export function buildDoctorSchedule(rows: DoctorScheduleRows, from: string, to: string): DoctorScheduleItem[] {
  const names = new Map(rows.fighters.map((f) => [f.id, `${f.firstName} ${f.lastName}`.trim()]));
  const inWindow = (d: string) => d >= from && d <= to;
  const items: DoctorScheduleItem[] = [];
  // Several records that say the same thing on the same day (e.g. two KO suspensions ending together) are one item.
  const seen = new Set<string>();
  const MERGE: ReadonlySet<DoctorScheduleKind> = new Set(['SUSPENSION_END', 'FOLLOW_UP']);
  const push = (item: Omit<DoctorScheduleItem, 'fighterName'>) => {
    const fighterName = names.get(item.fighterId);
    if (fighterName === undefined || !inWindow(item.date)) return;
    const key = `${item.kind}|${item.fighterId}|${item.date}`;
    if (MERGE.has(item.kind)) {
      if (seen.has(key)) return;
      seen.add(key);
    }
    items.push({ ...item, fighterName });
  };
  for (const f of rows.followUps) {
    push({ kind: 'FOLLOW_UP', date: f.followUpDate.slice(0, 10), at: null, fighterId: f.fighterId, refId: f.examinationId, label: null });
  }
  for (const c of rows.clearances) {
    push({ kind: 'CLEARANCE_EXPIRY', date: academyDateOf(toDate(c.validUntil)), at: null, fighterId: c.fighterId, refId: c.id, label: c.clearanceType });
  }
  for (const b of rows.bouts) {
    push({ kind: 'WEIGH_IN', date: academyDateOf(toDate(b.weighInAt)), at: iso(b.weighInAt), fighterId: b.fighterId, refId: b.id, label: b.eventName });
    push({ kind: 'BOUT', date: academyDateOf(toDate(b.boutAt)), at: iso(b.boutAt), fighterId: b.fighterId, refId: b.id, label: b.eventName });
  }
  for (const s of rows.suspensions) {
    push({ kind: 'SUSPENSION_END', date: s.endsOn.slice(0, 10), at: null, fighterId: s.fighterId, refId: s.id, label: s.reason });
  }
  return items.sort((a, b) =>
    a.date.localeCompare(b.date)
    || Number(a.at !== null) - Number(b.at !== null)
    || (a.at ?? '').localeCompare(b.at ?? '')
    || ORDER[a.kind] - ORDER[b.kind]
    || a.fighterName.localeCompare(b.fighterName));
}
