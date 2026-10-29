export const SUSPENSION_PERMISSIONS = {
  READ: 'suspension:read',
  CREATE: 'suspension:create',
  CLEAR: 'suspension:clear',
} as const;

export const SUSPENSION_RESPONSE_MESSAGES = {
  LIST: 'Get suspensions successfully',
  CREATE: 'Create suspension successfully',
  CLEAR: 'Clear suspension successfully',
} as const;

export const SESSION_TYPES = [
  'SHADOW_BOXING',
  'PAD_WORK',
  'HEAVY_BAG',
  'SPARRING',
  'GRAPPLING',
  'STRENGTH_CONDITIONING',
  'RECOVERY',
  'PHYSICAL_THERAPY',
] as const;
export type SessionType = (typeof SESSION_TYPES)[number];

export const SUSPENSION_REASONS = [
  'KO',
  'TKO',
  'DQ',
  'MANDATORY_REST',
  'MEDICAL',
  'OTHER',
] as const;
export type SuspensionReason = (typeof SUSPENSION_REASONS)[number];

export const LOSS_OF_CONSCIOUSNESS_VALUES = [
  'NONE',
  'UNDER_1_MIN',
  'OVER_1_MIN',
  'UNKNOWN',
] as const;
export type LossOfConsciousness = (typeof LOSS_OF_CONSCIOUSNESS_VALUES)[number];

export const TRAINING_PLAN_PHASES = [
  'base',
  'build',
  'fight_camp',
  'taper',
  'rehab',
  'maintenance',
] as const;
export type TrainingPlanPhase = (typeof TRAINING_PLAN_PHASES)[number];

export const REHAB_TRIGGER_SUSPENSION_REASONS: readonly SuspensionReason[] = [
  'KO',
  'TKO',
  'MEDICAL',
];

const ACADEMY_UTC_OFFSET_MS = 7 * 3_600_000;
const DAY_MS = 86_400_000;

/** Academy calendar date (YYYY-MM-DD) of an instant. */
export function academyDateOf(instant: Date): string {
  return new Date(instant.getTime() + ACADEMY_UTC_OFFSET_MS)
    .toISOString()
    .slice(0, 10);
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
