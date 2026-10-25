import { describe, expect, it } from 'vitest';
import {
  collectTodoItems,
  fightWeekProvider,
  requirementsProvider,
  resultOverdueProvider,
  suspensionAwaitingClearanceProvider,
  tacticsProvider,
  trainingConflictsProvider,
  weighInTodayProvider,
  weightNotLoggedProvider,
  weightProvider,
  type TodoBoutContext,
} from './bouts-todo.model.js';

const ctx = (over: Partial<TodoBoutContext> = {}): TodoBoutContext => ({
  boutId: '40000000-0000-4000-8000-000000000001',
  fighterId: '10000000-0000-4000-8000-000000000001',
  eventName: 'Demo Cup',
  status: 'CAMP',
  boutAt: new Date('2026-11-10T03:00:00Z'),
  weighInAt: new Date('2026-11-09T01:00:00Z'),
  today: '2026-10-20',
  requirementsOpen: 0,
  requirementsDueOn: '2026-11-02',
  canEnterFightWeek: false,
  weightStatus: 'ON_TRACK',
  weightReminderLevel: null,
  tacticsWithoutSessions: 0,
  ...over,
});

describe('requirementsProvider (R11)', () => {
  it('is silent when nothing is open or the due date is far away', () => {
    expect(requirementsProvider(ctx())).toEqual([]);
    expect(
      requirementsProvider(ctx({ requirementsOpen: 2, requirementsDueOn: '2026-11-30' })),
    ).toEqual([]);
  });

  it('warns from 14 days before the due date, not 15', () => {
    const open = { requirementsOpen: 2, requirementsDueOn: '2026-11-03' }; // 14 days from 2026-10-20
    expect(requirementsProvider(ctx(open))).toEqual([
      expect.objectContaining({ source: 'REQUIREMENTS_DUE', phase: 'BEFORE', dueOn: '2026-11-03', count: 2 }),
    ]);
    expect(requirementsProvider(ctx({ ...open, requirementsDueOn: '2026-11-04' }))).toEqual([]);
  });

  it('is overdue only after the due date, still due on the day itself', () => {
    const open = { requirementsOpen: 1, requirementsDueOn: '2026-10-20' };
    expect(requirementsProvider(ctx(open))[0]?.source).toBe('REQUIREMENTS_DUE');
    expect(requirementsProvider(ctx({ ...open, today: '2026-10-21' }))[0]?.source).toBe(
      'REQUIREMENTS_OVERDUE',
    );
  });
});

describe('weightProvider (R7)', () => {
  it.each([
    ['OVER_LIMIT', 'WEIGHT_OVER_LIMIT'],
    ['ABOVE_TARGET', 'WEIGHT_ABOVE_TARGET'],
    ['NOT_WEIGHED', 'WEIGHT_NOT_WEIGHED'],
  ] as const)('%s becomes %s', (weightStatus, source) => {
    expect(weightProvider(ctx({ weightStatus }))).toEqual([
      expect.objectContaining({ source, phase: 'BEFORE' }),
    ]);
  });

  it('has nothing for ON_TRACK or NEUTRAL, and nothing once the bout is weighed in', () => {
    expect(weightProvider(ctx({ weightStatus: 'ON_TRACK' }))).toEqual([]);
    expect(weightProvider(ctx({ weightStatus: 'NEUTRAL' }))).toEqual([]);
    expect(weightProvider(ctx({ status: 'WEIGHED_IN', weightStatus: 'OVER_LIMIT' }))).toEqual([]);
  });
});

describe('tacticsProvider (R14)', () => {
  it('counts the tactics that have no training session', () => {
    expect(tacticsProvider(ctx({ tacticsWithoutSessions: 2 }))).toEqual([
      expect.objectContaining({ source: 'TACTICS_WITHOUT_SESSIONS', count: 2 }),
    ]);
    expect(tacticsProvider(ctx())).toEqual([]);
    expect(tacticsProvider(ctx({ status: 'WEIGHED_IN', tacticsWithoutSessions: 2 }))).toEqual([]);
  });
});

describe('fightWeekProvider (R16)', () => {
  it('shows only when the bout can enter the fight week', () => {
    expect(fightWeekProvider(ctx({ canEnterFightWeek: true }))).toEqual([
      expect.objectContaining({ source: 'CAN_ENTER_FIGHT_WEEK', phase: 'BEFORE' }),
    ]);
    expect(fightWeekProvider(ctx())).toEqual([]);
  });
});

describe('weighInTodayProvider (R17)', () => {
  const weighInDay = { status: 'FIGHT_WEEK' as const, today: '2026-11-09' };

  it('shows on the academy day of the weigh-in, in the fight week', () => {
    expect(weighInTodayProvider(ctx(weighInDay))).toEqual([
      expect.objectContaining({ source: 'WEIGH_IN_TODAY', phase: 'DURING', dueOn: '2026-11-09' }),
    ]);
    expect(weighInTodayProvider(ctx({ ...weighInDay, today: '2026-11-08' }))).toEqual([]);
    expect(weighInTodayProvider(ctx({ ...weighInDay, status: 'CAMP' }))).toEqual([]);
  });

  it('reads the weigh-in day on the Asia/Ho_Chi_Minh calendar', () => {
    // 2026-11-08T17:30Z is 2026-11-09 00:30 in Vietnam.
    const late = ctx({
      ...weighInDay,
      weighInAt: new Date('2026-11-08T17:30:00Z'),
    });
    expect(weighInTodayProvider(late)).toHaveLength(1);
  });
});

describe('resultOverdueProvider (R26)', () => {
  it('shows from the day after the bout date until a result is recorded', () => {
    const base = { status: 'WEIGHED_IN' as const, boutAt: new Date('2026-11-10T03:00:00Z') };
    expect(resultOverdueProvider(ctx({ ...base, today: '2026-11-10' }))).toEqual([]);
    expect(resultOverdueProvider(ctx({ ...base, today: '2026-11-11' }))).toEqual([
      expect.objectContaining({ source: 'RESULT_OVERDUE', phase: 'DURING', dueOn: '2026-11-10' }),
    ]);
  });
});

describe('weightNotLoggedProvider (T0)', () => {
  it('shows only the escalated reminder, not the daily nudge', () => {
    expect(weightNotLoggedProvider(ctx({ weightReminderLevel: 'YESTERDAY_MISSING' }))).toEqual([
      expect.objectContaining({ source: 'WEIGHT_NOT_LOGGED', phase: 'DURING' }),
    ]);
    expect(weightNotLoggedProvider(ctx({ weightReminderLevel: 'ASK_TODAY' }))).toEqual([]);
    expect(weightNotLoggedProvider(ctx({ weightReminderLevel: null }))).toEqual([]);
  });
});

describe('suspensionAwaitingClearanceProvider (S3)', () => {
  const suspension = {
    startsOn: '2026-10-01',
    endsOn: '2026-10-20',
    requiresClearance: true,
    clearedAt: null,
    blockedSessionTypes: ['SPARRING'] as const,
  };

  it('appears on ends_on + 1 (phase AFTER), NOT on ends_on, and not once cleared or when requiresClearance is false', () => {
    expect(
      suspensionAwaitingClearanceProvider(
        ctx({ today: '2026-10-20', suspensions: [suspension] }),
      ),
    ).toEqual([]);

    expect(
      suspensionAwaitingClearanceProvider(
        ctx({ today: '2026-10-21', suspensions: [suspension] }),
      ),
    ).toEqual([
      expect.objectContaining({
        source: 'SUSPENSION_AWAITING_CLEARANCE',
        phase: 'AFTER',
        dueOn: null,
        count: null,
      }),
    ]);

    expect(
      suspensionAwaitingClearanceProvider(
        ctx({
          today: '2026-10-21',
          suspensions: [{ ...suspension, clearedAt: new Date('2026-10-21T03:00:00Z') }],
        }),
      ),
    ).toEqual([]);

    expect(
      suspensionAwaitingClearanceProvider(
        ctx({
          today: '2026-10-21',
          suspensions: [{ ...suspension, requiresClearance: false }],
        }),
      ),
    ).toEqual([]);
  });
});

describe('trainingConflictsProvider (R28)', () => {
  const suspension = {
    startsOn: '2026-10-15',
    endsOn: '2026-10-25',
    requiresClearance: false,
    clearedAt: null,
    blockedSessionTypes: ['SPARRING', 'GRAPPLING'] as const,
  };

  it('counts unresolved R28 proposals over SCHEDULED sessions from today on', () => {
    const sessions = [
      {
        id: '70000000-0000-4000-8000-000000000001',
        sessionType: 'SPARRING' as const,
        status: 'SCHEDULED',
        scheduledAt: new Date('2026-10-21T03:00:00Z'),
      },
      {
        id: '70000000-0000-4000-8000-000000000002',
        sessionType: 'GRAPPLING' as const,
        status: 'SCHEDULED',
        scheduledAt: new Date('2026-10-22T03:00:00Z'),
      },
      {
        id: '70000000-0000-4000-8000-000000000003',
        sessionType: 'PAD_WORK' as const,
        status: 'SCHEDULED',
        scheduledAt: new Date('2026-10-22T05:00:00Z'),
      },
    ];

    expect(
      trainingConflictsProvider(
        ctx({
          today: '2026-10-20',
          suspensions: [suspension],
          scheduledSessions: sessions,
        }),
      ),
    ).toEqual([
      expect.objectContaining({
        source: 'TRAINING_CONFLICTS_WITH_SUSPENSION',
        phase: 'AFTER',
        count: 2,
      }),
    ]);

    expect(trainingConflictsProvider(ctx({ today: '2026-10-20' }))).toEqual([]);
  });
});

describe('collectTodoItems', () => {
  it('gathers the items of every bout, and a provider with no data adds nothing', () => {
    const items = collectTodoItems([
      ctx({ weightStatus: 'OVER_LIMIT', tacticsWithoutSessions: 1 }),
      ctx({ boutId: '40000000-0000-4000-8000-000000000002', canEnterFightWeek: true }),
    ]);
    expect(items.map((item) => item.source)).toEqual([
      'WEIGHT_OVER_LIMIT',
      'TACTICS_WITHOUT_SESSIONS',
      'CAN_ENTER_FIGHT_WEEK',
    ]);
    // A source with no data (T-007's, until it merges) is just a provider returning [].
    expect(collectTodoItems([ctx(), ctx()], [() => []])).toEqual([]);
  });

  it('emits at most one SUSPENSION_AWAITING_CLEARANCE / TRAINING_CONFLICTS_WITH_SUSPENSION per fighter using their most recent running bout', () => {
    const suspensions = [
      {
        startsOn: '2026-10-01',
        endsOn: '2026-10-19',
        requiresClearance: true,
        clearedAt: null,
        blockedSessionTypes: ['SPARRING'] as const,
      },
    ];
    const items = collectTodoItems([
      ctx({
        boutId: '40000000-0000-4000-8000-000000000001',
        eventName: 'Earlier Running Bout',
        boutAt: new Date('2026-11-01T03:00:00Z'),
        today: '2026-10-20',
        suspensions,
      }),
      ctx({
        boutId: '40000000-0000-4000-8000-000000000002',
        eventName: 'Later Running Bout',
        boutAt: new Date('2026-11-15T03:00:00Z'),
        today: '2026-10-20',
        suspensions,
      }),
    ]);
    const awaitingItems = items.filter(
      (i) => i.source === 'SUSPENSION_AWAITING_CLEARANCE',
    );
    expect(awaitingItems).toHaveLength(1);
    expect(awaitingItems[0]).toMatchObject({
      boutId: '40000000-0000-4000-8000-000000000002',
      eventName: 'Later Running Bout',
    });
  });
});
