import { z } from 'zod';
import {
  LOSS_OF_CONSCIOUSNESS_VALUES,
  type LossOfConsciousness,
} from '../bouts/bouts.constants.js';
import {
  academyDateOf,
  addDaysToDate,
  daysBetweenDates,
} from '../bouts/bouts.model.js';
import {
  dateOnlySchema,
  isoDateTimeSchema,
  trimmedTextSchema,
} from '../shared/utils/zod-schema.util.js';
import {
  SESSION_TYPES,
  SUSPENSION_REASONS,
  type SessionType,
  type SuspensionReason,
} from './suspensions.constants.js';

export {
  academyDateOf,
  addDaysToDate,
  daysBetweenDates,
  LOSS_OF_CONSCIOUSNESS_VALUES,
  SESSION_TYPES,
  SUSPENSION_REASONS,
  type LossOfConsciousness,
  type SessionType,
  type SuspensionReason,
};

// ---------------------------------------------------------------------------
// Enumerations (mirror migration 025 and 003)
// ---------------------------------------------------------------------------

export const SUSPENSION_STATUSES = [
  'UPCOMING',
  'ACTIVE',
  'AWAITING_CLEARANCE',
  'ENDED',
] as const;
export type SuspensionStatus = (typeof SUSPENSION_STATUSES)[number];

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

export const CONFLICT_ACTIONS = [
  'CHANGE_TYPE',
  'RESCHEDULE',
  'CANCEL',
] as const;
export type ConflictAction = (typeof CONFLICT_ACTIONS)[number];

export interface ConflictProposal {
  sessionId: string;
  action: ConflictAction;
  toType?: 'RECOVERY';
  toScheduledAt?: Date;
}

export type ConflictSessionInput = {
  id: string;
  scheduledAt: Date | string;
  status: string;
  deletedAt?: Date | string | null | undefined;
} & (
  | { sessionType: SessionType; type?: SessionType | undefined }
  | { type: SessionType; sessionType?: SessionType | undefined }
);

export interface ConflictSuspensionInput extends SuspensionStateInput {
  id?: string | undefined;
  blockedSessionTypes: readonly SessionType[];
  deletedAt?: Date | string | null | undefined;
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

const DAY_MS = 86_400_000;

/**
 * Rule R28: for every `SCHEDULED` session of the fighter that falls inside the
 * suspension period (in force on the session's academy date) and has a blocked type:
 * 1. Change its type to `RECOVERY` if `RECOVERY` is not blocked for that date.
 * 2. Otherwise, if no in-force suspension blocking the session needs clearance
 *    (all of them have a fixed end date): move it to the first day after the
 *    LATEST `ends_on` among the in-force suspensions that block that type
 *    (same time of day).
 * 3. Otherwise: cancel it.
 *
 * Soft-deleted suspensions and non-`SCHEDULED` (or soft-deleted) sessions are ignored.
 */
export function planConflicts(
  sessions: readonly ConflictSessionInput[],
  suspensions: readonly ConflictSuspensionInput[],
): ConflictProposal[] {
  const activeSuspensions = suspensions.filter(
    (s) => s.deletedAt === null || s.deletedAt === undefined,
  );
  const proposals: ConflictProposal[] = [];

  for (const session of sessions) {
    if (session.deletedAt !== null && session.deletedAt !== undefined) {
      continue;
    }
    if (session.status !== 'SCHEDULED') {
      continue;
    }
    const sessionType =
      'sessionType' in session && session.sessionType !== undefined
        ? session.sessionType
        : session.type;
    if (!sessionType) continue;

    const scheduledAtDate =
      session.scheduledAt instanceof Date
        ? session.scheduledAt
        : new Date(session.scheduledAt);
    const sessionDate = academyDateOf(scheduledAtDate);

    const blockingOnDate = activeSuspensions.filter(
      (s) =>
        isInForceOn(s, sessionDate) &&
        s.blockedSessionTypes.includes(sessionType),
    );
    if (blockingOnDate.length === 0) {
      continue;
    }

    const recoveryBlockedOnDate = activeSuspensions.some(
      (s) =>
        isInForceOn(s, sessionDate) &&
        s.blockedSessionTypes.includes('RECOVERY'),
    );
    if (!recoveryBlockedOnDate) {
      proposals.push({
        sessionId: session.id,
        action: 'CHANGE_TYPE',
        toType: 'RECOVERY',
      });
      continue;
    }

    if (blockingOnDate.some((s) => s.requiresClearance)) {
      proposals.push({
        sessionId: session.id,
        action: 'CANCEL',
      });
      continue;
    }

    let latestEndsOn = blockingOnDate[0]!.endsOn;
    for (const s of blockingOnDate) {
      if (s.endsOn > latestEndsOn) {
        latestEndsOn = s.endsOn;
      }
    }
    let targetDate = addDaysToDate(latestEndsOn, 1);

    let requiresCancel = false;
    while (true) {
      const blockingOnTarget = activeSuspensions.filter(
        (s) =>
          isInForceOn(s, targetDate) &&
          s.blockedSessionTypes.includes(sessionType),
      );
      if (blockingOnTarget.length === 0) break;
      if (blockingOnTarget.some((s) => s.requiresClearance)) {
        requiresCancel = true;
        break;
      }
      for (const s of blockingOnTarget) {
        if (s.endsOn > latestEndsOn) {
          latestEndsOn = s.endsOn;
        }
      }
      targetDate = addDaysToDate(latestEndsOn, 1);
    }

    if (requiresCancel) {
      proposals.push({
        sessionId: session.id,
        action: 'CANCEL',
      });
      continue;
    }

    const deltaDays = daysBetweenDates(sessionDate, targetDate);
    const toScheduledAt = new Date(
      scheduledAtDate.getTime() + deltaDays * DAY_MS,
    );
    proposals.push({
      sessionId: session.id,
      action: 'RESCHEDULE',
      toScheduledAt,
    });
  }

  return proposals;
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

export const applySuspensionConflictsSchema = z.strictObject({
  sessionIds: z
    .array(z.uuid())
    .refine(
      (ids) => new Set(ids).size === ids.length,
      'Duplicate sessionIds are not allowed',
    ),
});
export type ApplySuspensionConflictsInput = z.infer<
  typeof applySuspensionConflictsSchema
>;

export const conflictProposalResponseSchema = z.object({
  sessionId: z.uuid(),
  action: z.enum(CONFLICT_ACTIONS),
  toType: z.literal('RECOVERY').optional(),
  toScheduledAt: z.union([z.date(), isoDateTimeSchema]).optional(),
});
export type ConflictProposalResponse = z.infer<
  typeof conflictProposalResponseSchema
>;

// ---------------------------------------------------------------------------
// Response schemas
// ---------------------------------------------------------------------------

export const suspensionRuleSchema = z.object({
  reason: z.union([z.string(), z.array(z.string())]).optional(),
  minDays: z.number().int().min(1),
  priorCount: z.number().int().min(1).optional(),
  withinDays: z.number().int().min(1).optional(),
  loc: z.enum(LOSS_OF_CONSCIOUSNESS_VALUES).optional(),
});
export type SuspensionRule = z.infer<typeof suspensionRuleSchema>;

export interface SuggestSuspensionEvent {
  result: string;
  method: string;
  lossOfConsciousness?: LossOfConsciousness | null | undefined;
  stoppedByHeadStrike?: boolean | null | undefined;
  knockedDown?: boolean | null | undefined;
}

export interface SuggestSuspensionRuleset {
  name?: string | null | undefined;
  suspensionRules?: readonly Record<string, unknown>[] | undefined;
  restDaysAfterBout?: number | null | undefined;
  defaultBlockedSessionTypes?: readonly SessionType[] | undefined;
}

export interface SuggestSuspensionCoachInput {
  suspensionDays?: number | null | undefined;
  suspensionOverrideReason?: string | null | undefined;
}

export interface SuggestSuspensionsParams {
  event: SuggestSuspensionEvent;
  ruleset?: SuggestSuspensionRuleset | undefined;
  today: string;
  boutDate?: string | undefined;
  priorKoTkoCount?:
    | number
    | ((withinDays?: number) => number)
    | readonly string[]
    | readonly { startsOn: string; boutId?: string | null }[]
    | undefined;
  coachInput?: SuggestSuspensionCoachInput | undefined;
}

export interface SuggestedSuspension {
  reason: SuspensionReason;
  startsOn: string;
  endsOn: string;
  days: number;
  lossOfConsciousness: LossOfConsciousness | null;
  suggestedDays: number | null;
  overrideReason: string | null;
  blockedSessionTypes: readonly SessionType[];
  requiresClearance: boolean;
  explanation: string;
}

export type SuggestSuspensionsResult =
  | {
      ok: true;
      suspensions: SuggestedSuspension[];
    }
  | {
      ok: false;
      error:
        | 'SUSPENSION_DAYS_REQUIRED'
        | 'SUSPENSION_OVERRIDE_REASON_REQUIRED'
        | 'SUSPENSION_DAYS_NOT_ALLOWED'
        | 'SUSPENSION_OVERRIDE_NOT_ALLOWED';
      message: string;
    };

function buildExplanation(params: {
  reason: string;
  matchedRule?: SuspensionRule | null | undefined;
  rulesetName?: string | null | undefined;
  days: number;
  overrideDays?: number | null | undefined;
  isRest?: boolean | undefined;
}): string {
  if (params.isRest) {
    return `Mandatory rest after bout: ${params.days} days`;
  }
  const { reason, matchedRule, rulesetName, days, overrideDays } = params;
  const isAiba =
    rulesetName !== undefined &&
    rulesetName !== null &&
    rulesetName.toLowerCase().includes('aiba');
  const presetLabel = isAiba
    ? 'AIBA preset'
    : rulesetName
      ? `${rulesetName} preset`
      : 'preset';

  if (!matchedRule) {
    return `${reason}, coach specified: ${days} days`;
  }

  let detail = '';
  if (
    matchedRule.priorCount !== undefined &&
    matchedRule.withinDays !== undefined
  ) {
    const countName =
      matchedRule.priorCount === 1
        ? 'second'
        : matchedRule.priorCount === 2
          ? 'third'
          : `${matchedRule.priorCount + 1}th`;
    detail = `${countName} in ${matchedRule.withinDays} days, `;
  } else if (matchedRule.loc) {
    const locStr =
      matchedRule.loc === 'UNDER_1_MIN'
        ? 'under 1 min'
        : matchedRule.loc === 'OVER_1_MIN'
          ? 'over 1 min'
          : matchedRule.loc.toLowerCase().replace(/_/g, ' ');
    detail = `loss of consciousness ${locStr}, `;
  }

  let text = `${reason}, ${detail}${presetLabel}: ${matchedRule.minDays} days`;
  if (
    overrideDays !== undefined &&
    overrideDays !== null &&
    overrideDays !== matchedRule.minDays
  ) {
    text += ` (overridden to ${overrideDays} days)`;
  }
  return text;
}

function countPriorKoTkoFromDates(
  priorDates:
    | readonly string[]
    | readonly { startsOn: string; boutId?: string | null }[],
  withinDays: number | undefined,
  boutDate: string,
  excludeBoutId?: string | undefined,
): number {
  let count = 0;
  for (const item of priorDates) {
    if (
      typeof item !== 'string' &&
      excludeBoutId &&
      item.boutId === excludeBoutId
    ) {
      continue;
    }
    const startsOn = typeof item === 'string' ? item : item.startsOn;
    const diff = daysBetweenDates(startsOn, boutDate);
    if (diff >= 0 && (withinDays === undefined || diff <= withinDays)) {
      count++;
    }
  }
  return count;
}

/**
 * Pure function to determine automatic suspensions on recording bout result (Rule R27).
 * Evaluates ruleset suspension_rules, mandatory rest, and coach input overrides.
 */
export function suggestSuspensions(
  paramsOrEvent: SuggestSuspensionsParams | SuggestSuspensionEvent,
  rulesArg?: readonly Record<string, unknown>[],
  restDaysArg?: number,
  priorCountArg?:
    | number
    | ((withinDays?: number) => number)
    | readonly string[]
    | readonly { startsOn: string; boutId?: string | null }[],
  coachInputArg?: SuggestSuspensionCoachInput,
  todayArg?: string,
  extraArg?: {
    rulesetName?: string | null;
    boutDate?: string;
    defaultBlockedSessionTypes?: readonly SessionType[];
    excludeBoutId?: string;
  },
): SuggestSuspensionsResult {
  let event: SuggestSuspensionEvent;
  let rules: readonly Record<string, unknown>[];
  let restDays: number;
  let priorCount:
    | number
    | ((withinDays?: number) => number)
    | readonly string[]
    | readonly { startsOn: string; boutId?: string | null }[]
    | undefined;
  let coachInput: SuggestSuspensionCoachInput | undefined;
  let today: string;
  let rulesetName: string | null | undefined;
  let boutDate: string;
  let defaultBlockedSessionTypes: readonly SessionType[];
  let excludeBoutId: string | undefined;

  if ('event' in paramsOrEvent && paramsOrEvent.event) {
    const p = paramsOrEvent as SuggestSuspensionsParams;
    event = p.event;
    rules = p.ruleset?.suspensionRules ?? [];
    restDays = p.ruleset?.restDaysAfterBout ?? 0;
    priorCount = p.priorKoTkoCount;
    coachInput = p.coachInput;
    today = p.today;
    rulesetName = p.ruleset?.name;
    boutDate = p.boutDate ?? p.today;
    defaultBlockedSessionTypes =
      p.ruleset?.defaultBlockedSessionTypes ??
      DEFAULT_MANUAL_BLOCKED_SESSION_TYPES;
    excludeBoutId = undefined;
  } else {
    event = paramsOrEvent as SuggestSuspensionEvent;
    rules = rulesArg ?? [];
    restDays = restDaysArg ?? 0;
    priorCount = priorCountArg;
    coachInput = coachInputArg;
    today = todayArg ?? academyDateOf(new Date());
    rulesetName = extraArg?.rulesetName;
    boutDate = extraArg?.boutDate ?? today;
    defaultBlockedSessionTypes =
      extraArg?.defaultBlockedSessionTypes ??
      DEFAULT_MANUAL_BLOCKED_SESSION_TYPES;
    excludeBoutId = extraArg?.excludeBoutId;
  }

  const isKoLoss = event.result === 'LOSS' && event.method === 'KO';
  const isTkoLoss =
    event.result === 'LOSS' &&
    event.method === 'TKO' &&
    event.stoppedByHeadStrike === true;
  const isKoOrTkoDue = isKoLoss || isTkoLoss;

  if (!isKoOrTkoDue) {
    if (
      coachInput?.suspensionDays !== undefined &&
      coachInput?.suspensionDays !== null
    ) {
      return {
        ok: false,
        error: 'SUSPENSION_DAYS_NOT_ALLOWED',
        message:
          'suspensionDays is only allowed for KO or head-strike TKO losses',
      };
    }
    if (
      coachInput?.suspensionOverrideReason !== undefined &&
      coachInput?.suspensionOverrideReason !== null &&
      coachInput.suspensionOverrideReason.trim().length > 0
    ) {
      return {
        ok: false,
        error: 'SUSPENSION_OVERRIDE_NOT_ALLOWED',
        message:
          'suspensionOverrideReason is only allowed for KO or head-strike TKO losses',
      };
    }
  }

  const blockedTypes =
    defaultBlockedSessionTypes.length > 0
      ? defaultBlockedSessionTypes
      : DEFAULT_MANUAL_BLOCKED_SESSION_TYPES;

  const parsedRules: SuspensionRule[] = [];
  for (const raw of rules) {
    const parsed = suspensionRuleSchema.safeParse(raw);
    if (parsed.success) {
      parsedRules.push(parsed.data);
    }
  }

  const proposals: SuggestedSuspension[] = [];

  if (isKoOrTkoDue) {
    const eventReason: 'KO' | 'TKO' = isKoLoss ? 'KO' : 'TKO';

    const matchingRules = parsedRules.filter((rule) => {
      // Reason check:
      if (rule.reason !== undefined && rule.reason !== null) {
        if (Array.isArray(rule.reason)) {
          if (!rule.reason.includes(eventReason)) return false;
        } else if (rule.reason !== eventReason) {
          return false;
        }
      }

      // Prior count check:
      if (rule.priorCount !== undefined && rule.priorCount !== null) {
        let count = 0;
        if (typeof priorCount === 'number') {
          count = priorCount;
        } else if (typeof priorCount === 'function') {
          count = priorCount(rule.withinDays);
        } else if (Array.isArray(priorCount)) {
          count = countPriorKoTkoFromDates(
            priorCount,
            rule.withinDays,
            boutDate,
            excludeBoutId,
          );
        }
        if (count < rule.priorCount) return false;
      }

      // LOC check:
      if (rule.loc !== undefined && rule.loc !== null) {
        if (event.lossOfConsciousness !== rule.loc) return false;
      }

      return true;
    });

    let matchedRule: SuspensionRule | null = null;
    let suggestedDays: number | null = null;
    if (matchingRules.length > 0) {
      matchedRule = matchingRules.reduce((prev, curr) =>
        curr.minDays > prev.minDays ? curr : prev,
      );
      suggestedDays = matchedRule.minDays;
    }

    let finalDays: number;
    let overrideReason: string | null = null;

    if (suggestedDays !== null) {
      if (
        coachInput?.suspensionDays !== undefined &&
        coachInput.suspensionDays !== null
      ) {
        finalDays = coachInput.suspensionDays;
        if (finalDays !== suggestedDays) {
          if (
            !coachInput.suspensionOverrideReason ||
            coachInput.suspensionOverrideReason.trim().length === 0
          ) {
            return {
              ok: false,
              error: 'SUSPENSION_OVERRIDE_REASON_REQUIRED',
              message:
                'suspensionOverrideReason is required when suspensionDays differs from the suggested days.',
            };
          }
          overrideReason = coachInput.suspensionOverrideReason.trim();
        }
      } else {
        finalDays = suggestedDays;
      }
    } else {
      if (
        coachInput?.suspensionDays === undefined ||
        coachInput?.suspensionDays === null
      ) {
        return {
          ok: false,
          error: 'SUSPENSION_DAYS_REQUIRED',
          message:
            'suspensionDays is required when the ruleset does not suggest suspension days.',
        };
      }
      finalDays = coachInput.suspensionDays;
    }

    const endsOn = addDaysToDate(today, finalDays - 1);
    const explanation = buildExplanation({
      reason: eventReason,
      matchedRule,
      rulesetName,
      days: finalDays,
      overrideDays: coachInput?.suspensionDays,
    });

    proposals.push({
      reason: eventReason,
      startsOn: today,
      endsOn,
      days: finalDays,
      lossOfConsciousness: event.lossOfConsciousness ?? null,
      suggestedDays,
      overrideReason,
      blockedSessionTypes: blockedTypes,
      requiresClearance: true,
      explanation,
    });
  }

  // DQ rule matching
  if (event.method === 'DQ') {
    const dqRules = parsedRules.filter((rule) => {
      if (rule.reason === undefined || rule.reason === null) return false;
      if (Array.isArray(rule.reason)) {
        return rule.reason.includes('DQ');
      }
      return rule.reason === 'DQ';
    });

    if (dqRules.length > 0) {
      const matchedDqRule = dqRules.reduce((prev, curr) =>
        curr.minDays > prev.minDays ? curr : prev,
      );
      const days = matchedDqRule.minDays;
      const endsOn = addDaysToDate(today, days - 1);
      const explanation = buildExplanation({
        reason: 'DQ',
        matchedRule: matchedDqRule,
        rulesetName,
        days,
      });

      proposals.push({
        reason: 'DQ',
        startsOn: today,
        endsOn,
        days,
        lossOfConsciousness: null,
        suggestedDays: days,
        overrideReason: null,
        blockedSessionTypes: blockedTypes,
        requiresClearance: false,
        explanation,
      });
    }
  }

  // Mandatory rest
  if (restDays > 0) {
    const endsOn = addDaysToDate(today, restDays - 1);
    const explanation = buildExplanation({
      reason: 'MANDATORY_REST',
      days: restDays,
      isRest: true,
    });

    proposals.push({
      reason: 'MANDATORY_REST',
      startsOn: today,
      endsOn,
      days: restDays,
      lossOfConsciousness: null,
      suggestedDays: restDays,
      overrideReason: null,
      blockedSessionTypes: blockedTypes,
      requiresClearance: false,
      explanation,
    });
  }

  return { ok: true, suspensions: proposals };
}

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
