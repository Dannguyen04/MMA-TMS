import { z } from 'zod';
import {
  dateOnlySchema,
  isoDateTimeSchema,
  trimmedTextSchema,
} from '../shared/utils/zod-schema.util.js';

// ---------------------------------------------------------------------------
// Enumerations (mirror migration 024)
// ---------------------------------------------------------------------------

export const BOUT_STATUSES = [
  'SCHEDULED',
  'CAMP',
  'FIGHT_WEEK',
  'WEIGHED_IN',
  'COMPLETED',
  'CANCELLED',
] as const;
export type BoutStatus = (typeof BOUT_STATUSES)[number];

export const BOUT_SPORTS = ['BOXING', 'MUAY_THAI', 'KICKBOXING', 'MMA'] as const;
export type BoutSport = (typeof BOUT_SPORTS)[number];

export const BOUT_REQUIREMENT_STATUSES = [
  'MISSING',
  'PROVIDED',
  'CONFIRMED',
  'REJECTED',
] as const;
export type BoutRequirementStatus = (typeof BOUT_REQUIREMENT_STATUSES)[number];

/** Statuses a coach may set. `CONFIRMED` belongs to the doctor flow (out of scope). */
export const COACH_REQUIREMENT_STATUSES = ['MISSING', 'PROVIDED', 'REJECTED'] as const;

export const REQUIREMENT_SOURCES = ['PRESET', 'COACH'] as const;
export type RequirementSource = (typeof REQUIREMENT_SOURCES)[number];

export const WEIGHT_TRACK_STATUSES = ['GREEN', 'YELLOW', 'RED', 'GREY'] as const;
export type WeightTrackStatus = (typeof WEIGHT_TRACK_STATUSES)[number];

export const CUSTOM_WEIGHT_CLASS_CODE = 'CUSTOM';
export const WEIGHT_LIMIT_MIN_KG = 30;
export const WEIGHT_LIMIT_MAX_KG = 200;
export const WEIGHT_TOLERANCE_KG = 1.0;
/** No weight in this many academy days (today included) turns the track GREY. */
export const WEIGHT_STALE_DAYS = 3;
export const LONG_WEIGH_IN_TO_BOUT_HOURS = 12;

// ---------------------------------------------------------------------------
// Academy calendar (Asia/Ho_Chi_Minh is UTC+7 all year, no daylight saving)
// ---------------------------------------------------------------------------

const ACADEMY_UTC_OFFSET_MS = 7 * 3_600_000;
const DAY_MS = 86_400_000;

/** Academy calendar date (YYYY-MM-DD) of an instant. */
export function academyDateOf(instant: Date): string {
  return new Date(instant.getTime() + ACADEMY_UTC_OFFSET_MS)
    .toISOString()
    .slice(0, 10);
}

/** First instant of an academy calendar date. */
export function academyStartOfDay(date: string): Date {
  return new Date(Date.parse(`${date}T00:00:00.000Z`) - ACADEMY_UTC_OFFSET_MS);
}

export function addDaysToDate(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00.000Z`) + days * DAY_MS)
    .toISOString()
    .slice(0, 10);
}

/** Whole days from `from` to `to` (negative when `to` is earlier). */
export function daysBetweenDates(from: string, to: string): number {
  return Math.round(
    (Date.parse(`${to}T00:00:00.000Z`) - Date.parse(`${from}T00:00:00.000Z`)) /
      DAY_MS,
  );
}

// ---------------------------------------------------------------------------
// Acute weight-loss threshold snapshot (Tech spec 2.2, Research 4)
// ---------------------------------------------------------------------------

export function acuteLossLimitPctFor(
  weighInAt: Date,
  boutAt: Date,
  limits: { long: number; short: number },
): number {
  const hours = (boutAt.getTime() - weighInAt.getTime()) / 3_600_000;
  return hours >= LONG_WEIGH_IN_TO_BOUT_HOURS ? limits.long : limits.short;
}

// ---------------------------------------------------------------------------
// State machine (weigh-in and result opened in T-006)
// ---------------------------------------------------------------------------

export const BOUT_TRANSITIONS: Readonly<Record<BoutStatus, readonly BoutStatus[]>> = {
  SCHEDULED: ['CAMP', 'CANCELLED'],
  CAMP: ['FIGHT_WEEK', 'CANCELLED'],
  FIGHT_WEEK: ['WEIGHED_IN', 'CANCELLED'],
  WEIGHED_IN: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

export function canTransition(from: BoutStatus, to: BoutStatus): boolean {
  return BOUT_TRANSITIONS[from].includes(to);
}

export function isFinalStatus(status: BoutStatus): boolean {
  return status === 'COMPLETED' || status === 'CANCELLED';
}

/** Statuses in which the schedule, weight class and due days may still change (F8). */
export const SCHEDULE_EDITABLE_STATUSES: readonly BoutStatus[] = [
  'SCHEDULED',
  'CAMP',
  'FIGHT_WEEK',
];

// ---------------------------------------------------------------------------
// Gate 1 (F4)
// ---------------------------------------------------------------------------

export interface RequirementState {
  code: string;
  label: string;
  required: boolean;
  status: BoutRequirementStatus;
  validUntil: string | null;
}

export interface Gate1Item {
  code: string;
  label: string;
  status: BoutRequirementStatus;
  validUntil: string | null;
}

export interface Gate1Result {
  passed: boolean;
  /** Required items that are not `PROVIDED` or `CONFIRMED`. */
  missing: Gate1Item[];
  /** Required items on file whose `validUntil` is before the academy date of the bout. */
  expiring: Gate1Item[];
}

export function evaluateGate1(
  requirements: readonly RequirementState[],
  boutAt: Date,
): Gate1Result {
  const boutDate = academyDateOf(boutAt);
  const missing: Gate1Item[] = [];
  const expiring: Gate1Item[] = [];
  for (const item of requirements) {
    if (!item.required) continue;
    const entry: Gate1Item = {
      code: item.code,
      label: item.label,
      status: item.status,
      validUntil: item.validUntil,
    };
    if (item.status !== 'PROVIDED' && item.status !== 'CONFIRMED') {
      missing.push(entry);
    } else if (item.validUntil === null || item.validUntil < boutDate) {
      expiring.push(entry);
    }
  }
  return {
    passed: missing.length === 0 && expiring.length === 0,
    missing,
    expiring,
  };
}

export function daysToWeighIn(weighInAt: Date, now: Date): number {
  return daysBetweenDates(academyDateOf(now), academyDateOf(weighInAt));
}

export function requirementsDueOn(
  weighInAt: Date,
  requirementsDueDays: number,
): string {
  return addDaysToDate(academyDateOf(weighInAt), -requirementsDueDays);
}

/** Earliest academy date the bout may enter FIGHT_WEEK. */
export function fightWeekStartsOn(weighInAt: Date, fightWeekDays: number): string {
  return addDaysToDate(academyDateOf(weighInAt), -fightWeekDays);
}

export function canEnterFightWeek(input: {
  status: BoutStatus;
  weighInAt: Date;
  fightWeekDays: number;
  now: Date;
  gate1: Gate1Result;
}): boolean {
  return (
    input.status === 'CAMP' &&
    academyDateOf(input.now) >=
      fightWeekStartsOn(input.weighInAt, input.fightWeekDays) &&
    input.gate1.passed
  );
}

// ---------------------------------------------------------------------------
// Weight class resolution (F1)
// ---------------------------------------------------------------------------

export interface WeightClassOption {
  code: string;
  label: string;
  limitKg: number | null;
}

export type WeightClassResolution =
  | { ok: true; code: string; limitKg: number }
  | {
      ok: false;
      reason:
        | 'CLASS_CODE_REQUIRED'
        | 'CLASS_CODE_UNKNOWN'
        | 'LIMIT_REQUIRED'
        | 'LIMIT_OUT_OF_RANGE';
    };

export function resolveWeightClass(
  classes: readonly WeightClassOption[],
  input: { weightClassCode?: string | undefined; weightLimitKg?: number | undefined },
): WeightClassResolution {
  const limitInRange = (value: number) =>
    value >= WEIGHT_LIMIT_MIN_KG && value <= WEIGHT_LIMIT_MAX_KG;

  if (classes.length === 0) {
    if (input.weightLimitKg === undefined)
      return { ok: false, reason: 'LIMIT_REQUIRED' };
    if (!limitInRange(input.weightLimitKg))
      return { ok: false, reason: 'LIMIT_OUT_OF_RANGE' };
    return { ok: true, code: CUSTOM_WEIGHT_CLASS_CODE, limitKg: input.weightLimitKg };
  }

  if (!input.weightClassCode) return { ok: false, reason: 'CLASS_CODE_REQUIRED' };
  const match = classes.find((option) => option.code === input.weightClassCode);
  if (!match) return { ok: false, reason: 'CLASS_CODE_UNKNOWN' };
  if (match.limitKg !== null)
    return { ok: true, code: match.code, limitKg: match.limitKg };

  // Open class ("trên 120 kg"): the preset has no upper limit, so the coach supplies one.
  if (input.weightLimitKg === undefined)
    return { ok: false, reason: 'LIMIT_REQUIRED' };
  if (!limitInRange(input.weightLimitKg))
    return { ok: false, reason: 'LIMIT_OUT_OF_RANGE' };

  const otherLimits = classes
    .filter((c) => c.code !== match.code && c.limitKg !== null)
    .map((c) => c.limitKg as number);
  if (otherLimits.length > 0 && input.weightLimitKg <= Math.max(...otherLimits)) {
    return { ok: false, reason: 'LIMIT_OUT_OF_RANGE' };
  }

  return { ok: true, code: match.code, limitKg: input.weightLimitKg };
}

// ---------------------------------------------------------------------------
// Weight track (Tech spec 5)
// ---------------------------------------------------------------------------

export interface WeightMeasurementInput {
  measuredAt: Date;
  createdAt: Date;
  weightKg: number;
}

export interface WeightPoint {
  date: string;
  kg: number;
}

/**
 * One point per academy day (the latest measurement of that day wins), ascending
 * by date, limited to `[from, to]` academy dates inclusive.
 */
export function buildDailyWeightPoints(
  measurements: readonly WeightMeasurementInput[],
  range: { from: string; to: string },
): WeightPoint[] {
  const latestByDate = new Map<string, WeightMeasurementInput>();
  for (const row of measurements) {
    const date = academyDateOf(row.measuredAt);
    if (date < range.from || date > range.to) continue;
    const current = latestByDate.get(date);
    if (
      !current ||
      row.measuredAt.getTime() > current.measuredAt.getTime() ||
      (row.measuredAt.getTime() === current.measuredAt.getTime() &&
        row.createdAt.getTime() > current.createdAt.getTime())
    ) {
      latestByDate.set(date, row);
    }
  }
  return [...latestByDate.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([date, row]) => ({ date, kg: row.weightKg }));
}

/**
 * Reference path: straight from the first weight (W0) at camp start down to the
 * level that is exactly `L%` above the limit at (weigh-in - A days), then down to
 * the limit at weigh-in. Vertices only; use `referenceKgAt` to interpolate.
 */
export function buildReferencePath(input: {
  limitKg: number;
  acuteLossLimitPct: number;
  acuteWindowDays: number;
  weighInDate: string;
  campStart: string;
  firstKg: number;
}): WeightPoint[] {
  const { limitKg, weighInDate, campStart, firstKg } = input;
  if (daysBetweenDates(campStart, weighInDate) <= 0)
    return [{ date: weighInDate, kg: limitKg }];

  const targetAtWindow = limitKg / (1 - input.acuteLossLimitPct / 100);
  const windowDate = addDaysToDate(weighInDate, -input.acuteWindowDays);
  const path: WeightPoint[] = [{ date: campStart, kg: round2(firstKg) }];
  let previousKg = firstKg;
  if (daysBetweenDates(campStart, windowDate) > 0) {
    previousKg = Math.min(firstKg, targetAtWindow);
    path.push({ date: windowDate, kg: round2(previousKg) });
  }
  path.push({ date: weighInDate, kg: round2(Math.min(limitKg, previousKg)) });
  return path;
}

export function referenceKgAt(
  path: readonly WeightPoint[],
  date: string,
): number | null {
  const first = path[0];
  const last = path[path.length - 1];
  if (!first || !last) return null;
  if (date <= first.date) return first.kg;
  if (date >= last.date) return last.kg;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1]!;
    const b = path[i]!;
    if (date <= b.date) {
      const span = daysBetweenDates(a.date, b.date);
      const elapsed = daysBetweenDates(a.date, date);
      return a.kg + ((b.kg - a.kg) * elapsed) / span;
    }
  }
  return last.kg;
}

export interface WeightTrack {
  limitKg: number | null;
  points: WeightPoint[];
  latestKg: number | null;
  latestOn: string | null;
  remainingPct: number | null;
  status: WeightTrackStatus;
  referencePath: WeightPoint[];
}

export function computeWeightTrack(input: {
  limitKg: number;
  acuteLossLimitPct: number;
  acuteWindowDays: number;
  weighInDate: string;
  today: string;
  campStart: string;
  points: readonly WeightPoint[];
  toleranceKg?: number;
}): WeightTrack {
  const points = [...input.points];
  const first = points[0];
  const latest = points[points.length - 1];
  if (!first || !latest) {
    return {
      limitKg: input.limitKg,
      points: [],
      latestKg: null,
      latestOn: null,
      remainingPct: null,
      status: 'GREY',
      referencePath: [],
    };
  }

  const referencePath = buildReferencePath({
    limitKg: input.limitKg,
    acuteLossLimitPct: input.acuteLossLimitPct,
    acuteWindowDays: input.acuteWindowDays,
    weighInDate: input.weighInDate,
    campStart: input.campStart,
    firstKg: first.kg,
  });
  const rawRemainingPct = Math.max(
    0,
    ((latest.kg - input.limitKg) / latest.kg) * 100,
  );
  const daysLeft = daysBetweenDates(input.today, input.weighInDate);
  const tolerance = input.toleranceKg ?? WEIGHT_TOLERANCE_KG;

  let status: WeightTrackStatus;
  if (daysBetweenDates(latest.date, input.today) >= WEIGHT_STALE_DAYS) {
    status = 'GREY';
  } else if (
    daysLeft <= input.acuteWindowDays &&
    rawRemainingPct > input.acuteLossLimitPct
  ) {
    status = 'RED';
  } else if (daysLeft > input.acuteWindowDays) {
    const reference = referenceKgAt(referencePath, latest.date);
    status =
      reference !== null && latest.kg > reference + tolerance
        ? 'YELLOW'
        : 'GREEN';
  } else {
    status = 'GREEN';
  }

  return {
    limitKg: input.limitKg,
    points,
    latestKg: latest.kg,
    latestOn: latest.date,
    remainingPct: Math.round(rawRemainingPct * 10) / 10,
    status,
    referencePath,
  };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
// ---------------------------------------------------------------------------
// Acute weight loss calculation (Tech spec 2.3, R19)
// ---------------------------------------------------------------------------

export interface AcuteLossMeasurementInput {
  measuredAt: Date;
  createdAt?: Date;
  weightKg: number;
  measurementContext?: string;
}

export interface AcuteLossResult {
  status: 'EXCEEDED' | 'WITHIN' | 'NO_DATA';
  startKg: number | null;
  startOn: string | null;
  lossPct: number | null;
  limitPct: number;
}

export function computeAcuteLoss(input: {
  officialWeightKg: number;
  limitPct: number;
  acuteWindowDays: number;
  weighInDate: string;
  measurements: readonly AcuteLossMeasurementInput[];
}): AcuteLossResult {
  const windowStart = addDaysToDate(input.weighInDate, -input.acuteWindowDays);
  const windowEnd = input.weighInDate;

  const validMeasurements = input.measurements
    .filter((m) => {
      if (m.measurementContext === 'WEIGH_IN') return false;
      const date = academyDateOf(m.measuredAt);
      return date >= windowStart && date <= windowEnd;
    })
    .sort((a, b) => {
      const timeDiff = a.measuredAt.getTime() - b.measuredAt.getTime();
      if (timeDiff !== 0) return timeDiff;
      const aCreated = a.createdAt?.getTime() ?? a.measuredAt.getTime();
      const bCreated = b.createdAt?.getTime() ?? b.measuredAt.getTime();
      return aCreated - bCreated;
    });

  const first = validMeasurements[0];
  if (!first) {
    return {
      status: 'NO_DATA',
      startKg: null,
      startOn: null,
      lossPct: null,
      limitPct: input.limitPct,
    };
  }

  const startKg = round2(first.weightKg);
  const startOn = academyDateOf(first.measuredAt);
  const rawLossPct = ((startKg - input.officialWeightKg) / startKg) * 100;
  const lossPct = Math.round(rawLossPct * 10) / 10;
  const status = lossPct > input.limitPct ? 'EXCEEDED' : 'WITHIN';

  return {
    status,
    startKg,
    startOn,
    lossPct,
    limitPct: input.limitPct,
  };
}


// ---------------------------------------------------------------------------
// Cursor pagination for GET /bouts (ordered by weigh_in_at asc, id asc)
// ---------------------------------------------------------------------------

export interface BoutCursor {
  weighInAt: string;
  id: string;
}

export function encodeBoutCursor(cursor: BoutCursor): string {
  return Buffer.from(JSON.stringify([cursor.weighInAt, cursor.id])).toString(
    'base64url',
  );
}

export function decodeBoutCursor(value: string): BoutCursor | null {
  try {
    const parsed: unknown = JSON.parse(
      Buffer.from(value, 'base64url').toString('utf8'),
    );
    if (
      Array.isArray(parsed) &&
      parsed.length === 2 &&
      typeof parsed[0] === 'string' &&
      typeof parsed[1] === 'string' &&
      !Number.isNaN(Date.parse(parsed[0])) &&
      z.uuid().safeParse(parsed[1]).success
    ) {
      return { weighInAt: parsed[0], id: parsed[1] };
    }
  } catch {
    return null;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Request schemas
// ---------------------------------------------------------------------------

const offsetDateTimeSchema = z.iso.datetime({ offset: true });

export const boutIdParamsSchema = z.strictObject({ id: z.uuid() });

export const requirementCodeSchema = z
  .string()
  .trim()
  .regex(/^[A-Z][A-Z0-9_]{1,39}$/, 'Expected 2-40 characters: A-Z, 0-9, underscore');

export const requirementParamsSchema = z.strictObject({
  id: z.uuid(),
  code: z.string().min(1).max(64),
});

export const listBoutsQuerySchema = z.strictObject({
  fighterId: z.uuid().optional(),
  status: z
    .preprocess(
      (value) =>
        value === undefined ? undefined : Array.isArray(value) ? value : [value],
      z.array(z.enum(BOUT_STATUSES)).min(1).max(BOUT_STATUSES.length).optional(),
    ),
  cursor: z
    .string()
    .min(1)
    .max(300)
    .refine((value) => decodeBoutCursor(value) !== null, 'Invalid cursor')
    .optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type ListBoutsQuery = z.infer<typeof listBoutsQuerySchema>;

export const createBoutSchema = z.strictObject({
  fighterId: z.uuid(),
  rulesetId: z.uuid(),
  coachId: z.uuid().optional(),
  eventName: trimmedTextSchema(200),
  venue: trimmedTextSchema(200).nullable().optional(),
  opponentName: trimmedTextSchema(200).nullable().optional(),
  weightClassCode: trimmedTextSchema(20).optional(),
  weightLimitKg: z
    .number()
    .finite()
    .min(WEIGHT_LIMIT_MIN_KG)
    .max(WEIGHT_LIMIT_MAX_KG)
    .optional(),
  weighInAt: offsetDateTimeSchema,
  boutAt: offsetDateTimeSchema,
  requirementsDueDays: z.number().int().min(0).max(120).optional(),
  notes: trimmedTextSchema(2000).nullable().optional(),
});
export type CreateBoutInput = z.infer<typeof createBoutSchema>;

export const updateBoutSchema = z
  .strictObject({
    eventName: trimmedTextSchema(200).optional(),
    venue: trimmedTextSchema(200).nullable().optional(),
    opponentName: trimmedTextSchema(200).nullable().optional(),
    notes: trimmedTextSchema(2000).nullable().optional(),
    weighInAt: offsetDateTimeSchema.optional(),
    boutAt: offsetDateTimeSchema.optional(),
    weightClassCode: trimmedTextSchema(20).optional(),
    weightLimitKg: z
      .number()
      .finite()
      .min(WEIGHT_LIMIT_MIN_KG)
      .max(WEIGHT_LIMIT_MAX_KG)
      .optional(),
    requirementsDueDays: z.number().int().min(0).max(120).optional(),
    reason: trimmedTextSchema(500, 3).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required',
  });
export type UpdateBoutInput = z.infer<typeof updateBoutSchema>;

export const startCampSchema = z.strictObject({ trainingPlanId: z.uuid() });
export type StartCampInput = z.infer<typeof startCampSchema>;

export const cancelBoutSchema = z.strictObject({ reason: trimmedTextSchema(500, 3) });
export type CancelBoutInput = z.infer<typeof cancelBoutSchema>;

export const createRequirementSchema = z.strictObject({
  code: requirementCodeSchema,
  label: trimmedTextSchema(200),
  required: z.boolean(),
  validityDays: z.number().int().min(1).max(3650).optional(),
  unlockReason: trimmedTextSchema(500, 3).optional(),
});
export type CreateRequirementInput = z.infer<typeof createRequirementSchema>;

export const updateRequirementSchema = z
  .strictObject({
    status: z.enum(COACH_REQUIREMENT_STATUSES).optional(),
    issuedOn: dateOnlySchema.nullable().optional(),
    validUntil: dateOnlySchema.nullable().optional(),
    label: trimmedTextSchema(200).optional(),
    required: z.boolean().optional(),
    statusReason: trimmedTextSchema(500).nullable().optional(),
    unlockReason: trimmedTextSchema(500, 3).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required',
  });
export type UpdateRequirementInput = z.infer<typeof updateRequirementSchema>;

export const removeRequirementQuerySchema = z.strictObject({
  unlockReason: trimmedTextSchema(500, 3).optional(),
});
export type RemoveRequirementQuery = z.infer<typeof removeRequirementQuerySchema>;

export const weighInSchema = z.strictObject({
  weightKg: z
    .number()
    .finite()
    .min(WEIGHT_LIMIT_MIN_KG)
    .max(WEIGHT_LIMIT_MAX_KG),
  hydrationCheck: z.enum(['NOT_APPLICABLE', 'PASSED', 'FAILED']).optional(),
  notes: trimmedTextSchema(500).optional(),
});
export type WeighInInput = z.infer<typeof weighInSchema>;

export const catchweightSchema = z.strictObject({
  catchweightKg: z
    .number()
    .finite()
    .min(WEIGHT_LIMIT_MIN_KG)
    .max(WEIGHT_LIMIT_MAX_KG)
    .optional(),
  note: trimmedTextSchema(500).optional(),
});
export type CatchweightInput = z.infer<typeof catchweightSchema>;

export const BOUT_RESULTS = ['WIN', 'LOSS', 'DRAW', 'NO_CONTEST'] as const;
export type BoutResult = (typeof BOUT_RESULTS)[number];

export const BOUT_METHODS = [
  'KO',
  'TKO',
  'DECISION',
  'SUBMISSION',
  'DQ',
  'OTHER',
] as const;
export type BoutMethod = (typeof BOUT_METHODS)[number];

export const LOSS_OF_CONSCIOUSNESS_VALUES = [
  'NONE',
  'UNDER_1_MIN',
  'OVER_1_MIN',
  'UNKNOWN',
] as const;
export type LossOfConsciousness = (typeof LOSS_OF_CONSCIOUSNESS_VALUES)[number];

export const recordResultSchema = z.strictObject({
  result: z.enum(BOUT_RESULTS),
  method: z.enum(BOUT_METHODS),
  resultRound: z.number().int().min(1).max(12).optional(),
  knockedDown: z.boolean().default(false).optional(),
  lossOfConsciousness: z.enum(LOSS_OF_CONSCIOUSNESS_VALUES).optional(),
  stoppedByHeadStrike: z.boolean().optional(),
  injuryNote: trimmedTextSchema(1000).optional(),
  notes: trimmedTextSchema(2000).optional(),
});
export type RecordResultInput = z.infer<typeof recordResultSchema>;


// ---------------------------------------------------------------------------
// Response schemas (Swagger documentation; the service builds the plain objects)
// ---------------------------------------------------------------------------

export const rulesetResponseSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  sport: z.enum(BOUT_SPORTS),
  organizer: z.string().nullable(),
  verified: z.boolean(),
  sourceNote: z.string().nullable(),
  weightClasses: z.array(
    z.object({
      code: z.string(),
      label: z.string(),
      limitKg: z.number().nullable(),
    }),
  ),
  requirementTemplates: z.array(
    z.object({
      code: z.string(),
      label: z.string(),
      required: z.boolean(),
      validityDays: z.number().int().optional(),
    }),
  ),
  fightWeekDays: z.number().int(),
  requirementsDueDays: z.number().int(),
  acuteWindowDays: z.number().int(),
  acuteLossLimitPctLong: z.number(),
  acuteLossLimitPctShort: z.number(),
  suspensionRules: z.array(z.record(z.string(), z.unknown())),
  defaultBlockedSessionTypes: z.array(z.string()),
  restDaysAfterBout: z.number().int(),
});
export type RulesetResponse = z.infer<typeof rulesetResponseSchema>;

export const boutHistoryEntrySchema = z.object({
  at: isoDateTimeSchema,
  by: z.uuid(),
  from: z.string(),
  to: z.string(),
  reason: z.string().optional(),
  action: z.string().optional(),
  requirementCode: z.string().optional(),
  fromClass: z.string().optional(),
  toClass: z.string().optional(),
  fromLimitKg: z.number().optional(),
  toLimitKg: z.number().optional(),
  catchweightKg: z.number().optional(),
  lossOfConsciousness: z.string().optional(),
  stoppedByHeadStrike: z.boolean().optional(),
  injuryNote: z.string().optional(),
});
export type BoutHistoryEntry = z.infer<typeof boutHistoryEntrySchema>;

export const boutSummarySchema = z.object({
  id: z.uuid(),
  fighterId: z.uuid(),
  coachId: z.uuid(),
  rulesetId: z.uuid(),
  eventName: z.string(),
  venue: z.string().nullable(),
  opponentName: z.string().nullable(),
  weightClassCode: z.string(),
  weightLimitKg: z.number(),
  acuteLossLimitPct: z.number(),
  requirementsDueDays: z.number().int(),
  weighInAt: isoDateTimeSchema,
  boutAt: isoDateTimeSchema,
  status: z.enum(BOUT_STATUSES),
  trainingPlanId: z.uuid().nullable(),
  officialWeightKg: z.number().nullable(),
  madeWeight: z.boolean().nullable(),
  catchweightKg: z.number().nullable(),
  hydrationCheck: z.string().nullable(),
  result: z.string().nullable(),
  method: z.string().nullable(),
  resultRound: z.number().int().nullable(),
  knockedDown: z.boolean().nullable(),
  cancelReason: z.string().nullable(),
  notes: z.string().nullable(),
  history: z.array(boutHistoryEntrySchema),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});
export type BoutSummary = z.infer<typeof boutSummarySchema>;

export const boutListResponseSchema = z.object({
  data: z.array(boutSummarySchema),
  hasNextPage: z.boolean(),
  nextCursor: z.string().nullable(),
});
export type BoutListResponse = z.infer<typeof boutListResponseSchema>;

const gate1ItemSchema = z.object({
  code: z.string(),
  label: z.string(),
  status: z.enum(BOUT_REQUIREMENT_STATUSES),
  validUntil: z.string().nullable(),
});

export const gate1ResponseSchema = z.object({
  passed: z.boolean(),
  missing: z.array(gate1ItemSchema),
  expiring: z.array(gate1ItemSchema),
});

export const requirementResponseSchema = z.object({
  code: z.string(),
  label: z.string(),
  required: z.boolean(),
  status: z.enum(BOUT_REQUIREMENT_STATUSES),
  issuedOn: z.string().nullable(),
  validUntil: z.string().nullable(),
  validityDays: z.number().int().nullable(),
  source: z.enum(REQUIREMENT_SOURCES),
  statusReason: z.string().nullable(),
  confirmedAt: isoDateTimeSchema.nullable(),
});
export type RequirementResponse = z.infer<typeof requirementResponseSchema>;

const weightPointSchema = z.object({ date: z.string(), kg: z.number() });

export const weightTrackResponseSchema = z.object({
  limitKg: z.number().nullable(),
  points: z.array(weightPointSchema),
  latestKg: z.number().nullable(),
  latestOn: z.string().nullable(),
  remainingPct: z.number().nullable(),
  status: z.enum(WEIGHT_TRACK_STATUSES),
  referencePath: z.array(weightPointSchema),
});


export const acuteLossResponseSchema = z.object({
  status: z.enum(['EXCEEDED', 'WITHIN', 'NO_DATA']),
  startKg: z.number().nullable(),
  startOn: z.string().nullable(),
  lossPct: z.number().nullable(),
  limitPct: z.number(),
});
export type AcuteLossResponse = z.infer<typeof acuteLossResponseSchema>;

export const boutDetailResponseSchema = boutSummarySchema.extend({
  ruleset: z.object({
    id: z.uuid(),
    name: z.string(),
    sport: z.enum(BOUT_SPORTS),
    verified: z.boolean(),
    sourceNote: z.string().nullable(),
    fightWeekDays: z.number().int(),
    acuteWindowDays: z.number().int(),
  }),
  requirements: z.array(requirementResponseSchema),
  daysToWeighIn: z.number().int(),
  requirementsDueOn: z.string(),
  requirementsOverdue: z.boolean(),
  gate1: gate1ResponseSchema,
  canEnterFightWeek: z.boolean(),
  weight: weightTrackResponseSchema.pick({
    latestKg: true,
    latestOn: true,
    remainingPct: true,
    status: true,
    referencePath: true,
  }),
  acuteLoss: acuteLossResponseSchema.nullable(),
});
export type BoutDetailResponse = z.infer<typeof boutDetailResponseSchema>;

export const requirementMutationResponseSchema = z.object({
  requirement: requirementResponseSchema,
  gate1: gate1ResponseSchema,
});

export const requirementRemovalResponseSchema = z.object({
  code: z.string(),
  gate1: gate1ResponseSchema,
});

export const weighInBlockSchema = z.object({
  outcome: z.enum(['PASSED', 'FAILED']),
  reason: z.enum(['OVER_LIMIT', 'HYDRATION_FAILED']).nullable(),
  overByKg: z.number().nullable(),
  overByPct: z.number().nullable(),
  options: z.array(z.enum(['CATCHWEIGHT', 'CANCEL'])),
});
export type WeighInBlock = z.infer<typeof weighInBlockSchema>;

export const weighInResponseSchema = boutDetailResponseSchema.extend({
  weighIn: weighInBlockSchema,
});
export type WeighInResponse = z.infer<typeof weighInResponseSchema>;
