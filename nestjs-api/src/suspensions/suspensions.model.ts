import { z } from 'zod';
import {
  academyDateOf,
  addDaysToDate,
  daysBetweenDates,
  LOSS_OF_CONSCIOUSNESS_VALUES,
  type LossOfConsciousness,
} from '../bouts/bouts.model.js';
import {
  dateOnlySchema,
  isoDateTimeSchema,
  trimmedTextSchema,
} from '../shared/utils/zod-schema.util.js';

export {
  academyDateOf,
  addDaysToDate,
  daysBetweenDates,
  LOSS_OF_CONSCIOUSNESS_VALUES,
  type LossOfConsciousness,
};

// ---------------------------------------------------------------------------
// Enumerations (mirror migration 025 and 003)
// ---------------------------------------------------------------------------

export const SUSPENSION_REASONS = [
  'KO',
  'TKO',
  'DQ',
  'MANDATORY_REST',
  'MEDICAL',
  'OTHER',
] as const;
export type SuspensionReason = (typeof SUSPENSION_REASONS)[number];

export const SUSPENSION_STATUSES = [
  'UPCOMING',
  'ACTIVE',
  'AWAITING_CLEARANCE',
  'ENDED',
] as const;
export type SuspensionStatus = (typeof SUSPENSION_STATUSES)[number];

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

export const DEFAULT_MANUAL_BLOCKED_SESSION_TYPES: readonly SessionType[] = [
  'SPARRING',
];

// ---------------------------------------------------------------------------
// Pure domain rules (Tech spec 2.5, Business flows F7, Rule S3)
// ---------------------------------------------------------------------------

export interface SuspensionStateInput {
  startsOn: string;
  endsOn: string;
  requiresClearance: boolean;
  clearedAt: Date | string | null;
}

export interface BlockingSuspension {
  suspensionId: string;
  reason: SuspensionReason;
  endsOn: string;
  requiresClearance: boolean;
}

/**
 * Computes the suspension status on academy date `d` (YYYY-MM-DD).
 * - ENDED: cleared, or `d > endsOn` without `requiresClearance`
 * - UPCOMING: `d < startsOn`, not cleared
 * - ACTIVE: `startsOn <= d <= endsOn`, not cleared
 * - AWAITING_CLEARANCE: `d > endsOn`, `requiresClearance`, not cleared (begins on `endsOn + 1`)
 */
export function suspensionStatusOn(
  suspension: SuspensionStateInput,
  d: string,
): SuspensionStatus {
  if (suspension.clearedAt !== null) return 'ENDED';
  if (d < suspension.startsOn) return 'UPCOMING';
  if (d <= suspension.endsOn) return 'ACTIVE';
  return suspension.requiresClearance ? 'AWAITING_CLEARANCE' : 'ENDED';
}

/**
 * Whether the suspension is in force on academy date `d` (YYYY-MM-DD):
 * `cleared_at IS NULL AND starts_on <= d AND (d <= ends_on OR requires_clearance)`
 */
export function isInForceOn(
  suspension: SuspensionStateInput,
  d: string,
): boolean {
  return (
    suspension.clearedAt === null &&
    suspension.startsOn <= d &&
    (d <= suspension.endsOn || suspension.requiresClearance)
  );
}

/**
 * Inclusive end date for a suspension of `days` starting on `startsOn` (day 1 = `startsOn`).
 */
export function endsOnFor(startsOn: string, days: number): string {
  return addDaysToDate(startsOn, days - 1);
}

export type RequiresClearanceResolution =
  | { ok: true; requiresClearance: boolean }
  | {
      ok: false;
      reason: 'REQUIRES_CLEARANCE_MANDATORY' | 'REQUIRES_CLEARANCE_FORBIDDEN';
    };

/**
 * Resolves `requiresClearance` from the suspension reason and an optional caller request:
 * - KO and TKO: ALWAYS true and cannot be turned off (requesting false is invalid)
 * - MEDICAL: defaults true (request may override)
 * - DQ and MANDATORY_REST: ALWAYS false (requesting true is invalid)
 * - OTHER: follows the request, default false
 */
export function deriveRequiresClearance(
  reason: SuspensionReason,
  requested?: boolean,
): RequiresClearanceResolution {
  switch (reason) {
    case 'KO':
    case 'TKO':
      if (requested === false) {
        return { ok: false, reason: 'REQUIRES_CLEARANCE_MANDATORY' };
      }
      return { ok: true, requiresClearance: true };
    case 'DQ':
    case 'MANDATORY_REST':
      if (requested === true) {
        return { ok: false, reason: 'REQUIRES_CLEARANCE_FORBIDDEN' };
      }
      return { ok: true, requiresClearance: false };
    case 'MEDICAL':
      return { ok: true, requiresClearance: requested ?? true };
    case 'OTHER':
      return { ok: true, requiresClearance: requested ?? false };
  }
}

// ---------------------------------------------------------------------------
// Cursor pagination for GET /suspensions (ordered by starts_on asc, id asc)
// ---------------------------------------------------------------------------

export interface SuspensionCursor {
  startsOn: string;
  id: string;
}

export function encodeSuspensionCursor(cursor: SuspensionCursor): string {
  return Buffer.from(JSON.stringify([cursor.startsOn, cursor.id])).toString(
    'base64url',
  );
}

export function decodeSuspensionCursor(value: string): SuspensionCursor | null {
  try {
    const parsed: unknown = JSON.parse(
      Buffer.from(value, 'base64url').toString('utf8'),
    );
    if (
      Array.isArray(parsed) &&
      parsed.length === 2 &&
      typeof parsed[0] === 'string' &&
      typeof parsed[1] === 'string' &&
      dateOnlySchema.safeParse(parsed[0]).success &&
      z.uuid().safeParse(parsed[1]).success
    ) {
      return { startsOn: parsed[0], id: parsed[1] };
    }
  } catch {
    return null;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Request schemas
// ---------------------------------------------------------------------------

export const suspensionIdParamsSchema = z.strictObject({
  id: z.uuid(),
});

export const listSuspensionsQuerySchema = z.strictObject({
  fighterId: z.uuid().optional(),
  active: z
    .preprocess(
      (value) => (value === 'true' ? true : value === 'false' ? false : value),
      z.boolean(),
    )
    .optional(),
  cursor: z
    .string()
    .min(1)
    .max(300)
    .refine((value) => decodeSuspensionCursor(value) !== null, 'Invalid cursor')
    .optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type ListSuspensionsQuery = z.infer<typeof listSuspensionsQuerySchema>;

export const createSuspensionSchema = z
  .strictObject({
    fighterId: z.uuid(),
    reason: z.enum(SUSPENSION_REASONS),
    days: z.number().int().min(1).max(365),
    startsOn: dateOnlySchema.optional(),
    blockedSessionTypes: z
      .array(z.enum(SESSION_TYPES))
      .min(1)
      .max(SESSION_TYPES.length)
      .refine(
        (items) => new Set(items).size === items.length,
        'Duplicate session types are not allowed',
      )
      .optional(),
    requiresClearance: z.boolean().optional(),
    lossOfConsciousness: z
      .enum(LOSS_OF_CONSCIOUSNESS_VALUES)
      .nullable()
      .optional(),
  })
  .superRefine((value, ctx) => {
    const clearance = deriveRequiresClearance(
      value.reason,
      value.requiresClearance,
    );
    if (!clearance.ok) {
      ctx.addIssue({
        code: 'custom',
        path: ['requiresClearance'],
        message:
          clearance.reason === 'REQUIRES_CLEARANCE_MANDATORY'
            ? 'requiresClearance cannot be false for KO or TKO'
            : 'requiresClearance cannot be true for DQ or MANDATORY_REST',
      });
    }
    if (value.startsOn !== undefined) {
      const today = academyDateOf(new Date());
      if (value.startsOn < today) {
        ctx.addIssue({
          code: 'custom',
          path: ['startsOn'],
          message: 'startsOn must not be before today',
        });
      }
    }
  });
export type CreateSuspensionInput = z.infer<typeof createSuspensionSchema>;

export const clearSuspensionSchema = z.strictObject({
  clearanceNote: trimmedTextSchema(500, 3),
});
export type ClearSuspensionInput = z.infer<typeof clearSuspensionSchema>;

// ---------------------------------------------------------------------------
// Response schemas
// ---------------------------------------------------------------------------

export const suspensionResponseSchema = z.object({
  id: z.uuid(),
  fighterId: z.uuid(),
  boutId: z.uuid().nullable(),
  reason: z.enum(SUSPENSION_REASONS),
  startsOn: dateOnlySchema,
  endsOn: dateOnlySchema,
  lossOfConsciousness: z.enum(LOSS_OF_CONSCIOUSNESS_VALUES).nullable(),
  suggestedDays: z.number().int().nullable(),
  overrideReason: z.string().nullable(),
  blockedSessionTypes: z.array(z.enum(SESSION_TYPES)),
  requiresClearance: z.boolean(),
  clearedAt: isoDateTimeSchema.nullable(),
  clearedById: z.uuid().nullable(),
  clearanceNote: z.string().nullable(),
  createdById: z.uuid(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
  status: z.enum(SUSPENSION_STATUSES),
});
export type SuspensionResponse = z.infer<typeof suspensionResponseSchema>;

export const suspensionListResponseSchema = z.object({
  data: z.array(suspensionResponseSchema),
  hasNextPage: z.boolean(),
  nextCursor: z.string().nullable(),
});
export type SuspensionListResponse = z.infer<
  typeof suspensionListResponseSchema
>;
