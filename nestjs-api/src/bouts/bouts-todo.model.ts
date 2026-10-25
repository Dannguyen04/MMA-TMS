import { z } from 'zod';
import {
  planConflicts,
  suspensionStatusOn,
  type ConflictSessionInput,
  type ConflictSuspensionInput,
} from '../suspensions/suspensions.model.js';
import {
  academyDateOf,
  daysBetweenDates,
  isFinalStatus,
  type BoutStatus,
  type WeighInReminderLevel,
  type WeightTrackStatus,
} from './bouts.model.js';

// ---------------------------------------------------------------------------
// Coach to-do card (T-029): computed on read, no background job, no notification.
// Each source is an independent pure provider over one bout; a source with no
// data returns [] and never breaks the others.
// ---------------------------------------------------------------------------

export const TODO_PHASES = ['BEFORE', 'DURING', 'AFTER'] as const;
export type TodoPhase = (typeof TODO_PHASES)[number];

export const TODO_SOURCES = [
  'REQUIREMENTS_DUE',
  'REQUIREMENTS_OVERDUE',
  'WEIGHT_OVER_LIMIT',
  'WEIGHT_ABOVE_TARGET',
  'WEIGHT_NOT_WEIGHED',
  'TACTICS_WITHOUT_SESSIONS',
  'CAN_ENTER_FIGHT_WEEK',
  'WEIGH_IN_TODAY',
  'RESULT_OVERDUE',
  'WEIGHT_NOT_LOGGED',
  'SUSPENSION_AWAITING_CLEARANCE',
  'TRAINING_CONFLICTS_WITH_SUSPENSION',
] as const;
export type TodoSource = (typeof TODO_SOURCES)[number];

export const todoItemSchema = z.object({
  source: z.enum(TODO_SOURCES),
  phase: z.enum(TODO_PHASES),
  fighterId: z.uuid(),
  boutId: z.uuid(),
  eventName: z.string(),
  /** The date the item is about (paperwork due date, bout date), when it has one. */
  dueOn: z.string().nullable(),
  /** How many things the item is about (missing documents, tactics), when it counts. */
  count: z.number().int().nullable(),
});
export type TodoItem = z.infer<typeof todoItemSchema>;

export const coachTodoResponseSchema = z.object({
  items: z.array(todoItemSchema),
  /** True when the coach has more running bouts than the card reads. */
  truncated: z.boolean(),
});
export type CoachTodoResponse = z.infer<typeof coachTodoResponseSchema>;

/** Everything a provider may read about one bout. */
export interface TodoBoutContext {
  boutId: string;
  fighterId: string;
  eventName: string;
  status: BoutStatus;
  boutAt: Date;
  weighInAt: Date;
  /** Academy date of today. */
  today: string;
  /** Required documents that are missing or will have expired by the bout date. */
  requirementsOpen: number;
  requirementsDueOn: string;
  canEnterFightWeek: boolean;
  weightStatus: WeightTrackStatus;
  weightReminderLevel: WeighInReminderLevel | null;
  tacticsWithoutSessions: number;
  /** Fighter's suspensions (for S3 / R28 AFTER-phase providers). */
  suspensions?: readonly ConflictSuspensionInput[];
  /** Fighter's SCHEDULED sessions from today on (for R28 AFTER-phase provider). */
  scheduledSessions?: readonly ConflictSessionInput[];
}

/** R11: paperwork still open within 14 days of its due date, or past it. */
export const REQUIREMENTS_WARNING_DAYS = 14;

type Provider = (ctx: TodoBoutContext) => TodoItem[];

function item(
  ctx: TodoBoutContext,
  source: TodoSource,
  phase: TodoPhase,
  extra: { dueOn?: string | null; count?: number | null } = {},
): TodoItem {
  return {
    source,
    phase,
    fighterId: ctx.fighterId,
    boutId: ctx.boutId,
    eventName: ctx.eventName,
    dueOn: extra.dueOn ?? null,
    count: extra.count ?? null,
  };
}

const BEFORE_FIGHT_WEEK_ENDS: readonly BoutStatus[] = ['SCHEDULED', 'CAMP', 'FIGHT_WEEK'];

/** R11. */
export const requirementsProvider: Provider = (ctx) => {
  if (isFinalStatus(ctx.status) || ctx.requirementsOpen === 0) return [];
  if (ctx.today > ctx.requirementsDueOn) {
    return [
      item(ctx, 'REQUIREMENTS_OVERDUE', 'BEFORE', {
        dueOn: ctx.requirementsDueOn,
        count: ctx.requirementsOpen,
      }),
    ];
  }
  if (daysBetweenDates(ctx.today, ctx.requirementsDueOn) <= REQUIREMENTS_WARNING_DAYS) {
    return [
      item(ctx, 'REQUIREMENTS_DUE', 'BEFORE', {
        dueOn: ctx.requirementsDueOn,
        count: ctx.requirementsOpen,
      }),
    ];
  }
  return [];
};

/** R7: red, yellow or grey. NEUTRAL (after the official weigh-in) and green are not tasks. */
export const weightProvider: Provider = (ctx) => {
  if (!BEFORE_FIGHT_WEEK_ENDS.includes(ctx.status)) return [];
  const source: Partial<Record<WeightTrackStatus, TodoSource>> = {
    OVER_LIMIT: 'WEIGHT_OVER_LIMIT',
    ABOVE_TARGET: 'WEIGHT_ABOVE_TARGET',
    NOT_WEIGHED: 'WEIGHT_NOT_WEIGHED',
  };
  const found = source[ctx.weightStatus];
  return found ? [item(ctx, found, 'BEFORE')] : [];
};

/** R14. */
export const tacticsProvider: Provider = (ctx) =>
  BEFORE_FIGHT_WEEK_ENDS.includes(ctx.status) && ctx.tacticsWithoutSessions > 0
    ? [item(ctx, 'TACTICS_WITHOUT_SESSIONS', 'BEFORE', { count: ctx.tacticsWithoutSessions })]
    : [];

/** R16. */
export const fightWeekProvider: Provider = (ctx) =>
  !isFinalStatus(ctx.status) && ctx.canEnterFightWeek
    ? [item(ctx, 'CAN_ENTER_FIGHT_WEEK', 'BEFORE')]
    : [];

/** R17: the official weigh-in is today. */
export const weighInTodayProvider: Provider = (ctx) =>
  ctx.status === 'FIGHT_WEEK' && academyDateOf(ctx.weighInAt) === ctx.today
    ? [item(ctx, 'WEIGH_IN_TODAY', 'DURING', { dueOn: ctx.today })]
    : [];

/** R26: the bout date has passed and there is still no result. */
export const resultOverdueProvider: Provider = (ctx) => {
  if (isFinalStatus(ctx.status)) return [];
  const boutOn = academyDateOf(ctx.boutAt);
  return ctx.today > boutOn ? [item(ctx, 'RESULT_OVERDUE', 'DURING', { dueOn: boutOn })] : [];
};

/** T0: only the escalated reminder; the daily nudge belongs to the fighter app. */
export const weightNotLoggedProvider: Provider = (ctx) =>
  ctx.weightReminderLevel === 'YESTERDAY_MISSING'
    ? [item(ctx, 'WEIGHT_NOT_LOGGED', 'DURING')]
    : [];

/** S3: the fighter has a suspension whose status is AWAITING_CLEARANCE (appears on ends_on + 1, not ends_on). */
export const suspensionAwaitingClearanceProvider: Provider = (ctx) => {
  const suspensions = ctx.suspensions ?? [];
  const awaiting = suspensions.some(
    (s) =>
      (s.deletedAt === null || s.deletedAt === undefined) &&
      suspensionStatusOn(s, ctx.today) === 'AWAITING_CLEARANCE',
  );
  return awaiting ? [item(ctx, 'SUSPENSION_AWAITING_CLEARANCE', 'AFTER')] : [];
};

/** R28: unresolved R28 proposals over the fighter's SCHEDULED sessions (from today on) and suspensions. */
export const trainingConflictsProvider: Provider = (ctx) => {
  const suspensions = ctx.suspensions ?? [];
  const sessions = (ctx.scheduledSessions ?? []).filter((session) => {
    const scheduledAt =
      session.scheduledAt instanceof Date
        ? session.scheduledAt
        : new Date(session.scheduledAt);
    return academyDateOf(scheduledAt) >= ctx.today;
  });
  if (suspensions.length === 0 || sessions.length === 0) return [];
  const proposals = planConflicts(sessions, suspensions);
  return proposals.length > 0
    ? [
        item(ctx, 'TRAINING_CONFLICTS_WITH_SUSPENSION', 'AFTER', {
          count: proposals.length,
        }),
      ]
    : [];
};
export const trainingConflictsWithSuspensionProvider =
  trainingConflictsProvider;

export const TODO_PROVIDERS: readonly Provider[] = [
  requirementsProvider,
  weightProvider,
  tacticsProvider,
  fightWeekProvider,
  weighInTodayProvider,
  resultOverdueProvider,
  weightNotLoggedProvider,
  suspensionAwaitingClearanceProvider,
  trainingConflictsProvider,
];

const FIGHTER_SCOPED_SOURCES: ReadonlySet<TodoSource> = new Set([
  'SUSPENSION_AWAITING_CLEARANCE',
  'TRAINING_CONFLICTS_WITH_SUSPENSION',
]);

function isMoreRecentFighterBout(
  candidate: TodoBoutContext,
  current: TodoBoutContext,
): boolean {
  const candidateRunning = !isFinalStatus(candidate.status);
  const currentRunning = !isFinalStatus(current.status);
  if (candidateRunning !== currentRunning) {
    return candidateRunning;
  }
  const candidateTime = candidate.boutAt.getTime();
  const currentTime = current.boutAt.getTime();
  if (candidateTime !== currentTime) {
    return candidateTime > currentTime;
  }
  return candidate.boutId > current.boutId;
}

export function collectTodoItems(
  contexts: readonly TodoBoutContext[],
  providers: readonly Provider[] = TODO_PROVIDERS,
): TodoItem[] {
  const primaryBoutByFighter = new Map<string, TodoBoutContext>();
  for (const ctx of contexts) {
    const existing = primaryBoutByFighter.get(ctx.fighterId);
    if (!existing || isMoreRecentFighterBout(ctx, existing)) {
      primaryBoutByFighter.set(ctx.fighterId, ctx);
    }
  }

  return contexts.flatMap((ctx) => {
    const isPrimaryForFighter =
      primaryBoutByFighter.get(ctx.fighterId) === ctx;
    return providers.flatMap((provider) =>
      provider(ctx).filter(
        (todo) =>
          !FIGHTER_SCOPED_SOURCES.has(todo.source) || isPrimaryForFighter,
      ),
    );
  });
}
