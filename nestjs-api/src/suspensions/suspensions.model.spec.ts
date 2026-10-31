import { describe, expect, it, vi, afterEach } from 'vitest';
import {
  clearSuspensionSchema,
  createSuspensionSchema,
  decodeSuspensionCursor,
  deriveRequiresClearance,
  encodeSuspensionCursor,
  endsOnFor,
  isInForceOn,
  listSuspensionsQuerySchema,
  planConflicts,
  SESSION_TYPES,
  suggestSuspensions,
  SUSPENSION_REASONS,
  suspensionStatusOn,
  type ConflictSessionInput,
  type ConflictSuspensionInput,
  type SuspensionStateInput,
} from './suspensions.model.js';

describe('suspensionStatusOn and isInForceOn (boundary dates and 4 states)', () => {
  const base = (
    over: Partial<SuspensionStateInput> = {},
  ): SuspensionStateInput => ({
    startsOn: '2026-10-10',
    endsOn: '2026-10-20',
    requiresClearance: true,
    clearedAt: null,
    ...over,
  });

  it('evaluates starts_on - 1 as UPCOMING and not in force (with or without requires_clearance)', () => {
    const withClearance = base({ requiresClearance: true });
    const withoutClearance = base({ requiresClearance: false });

    expect(suspensionStatusOn(withClearance, '2026-10-09')).toBe('UPCOMING');
    expect(isInForceOn(withClearance, '2026-10-09')).toBe(false);

    expect(suspensionStatusOn(withoutClearance, '2026-10-09')).toBe('UPCOMING');
    expect(isInForceOn(withoutClearance, '2026-10-09')).toBe(false);
  });

  it('evaluates starts_on and ends_on as ACTIVE and in force (not AWAITING_CLEARANCE on ends_on)', () => {
    for (const requiresClearance of [true, false]) {
      const susp = base({ requiresClearance });
      expect(suspensionStatusOn(susp, '2026-10-10')).toBe('ACTIVE');
      expect(isInForceOn(susp, '2026-10-10')).toBe(true);

      expect(suspensionStatusOn(susp, '2026-10-15')).toBe('ACTIVE');
      expect(isInForceOn(susp, '2026-10-15')).toBe(true);

      // ends_on is still ACTIVE; AWAITING_CLEARANCE begins on ends_on + 1
      expect(suspensionStatusOn(susp, '2026-10-20')).toBe('ACTIVE');
      expect(isInForceOn(susp, '2026-10-20')).toBe(true);
    }
  });

  it('evaluates ends_on + 1 as AWAITING_CLEARANCE (in force) when requires_clearance = true and not cleared', () => {
    const susp = base({ requiresClearance: true, clearedAt: null });
    expect(suspensionStatusOn(susp, '2026-10-21')).toBe('AWAITING_CLEARANCE');
    expect(isInForceOn(susp, '2026-10-21')).toBe(true);

    expect(suspensionStatusOn(susp, '2026-12-31')).toBe('AWAITING_CLEARANCE');
    expect(isInForceOn(susp, '2026-12-31')).toBe(true);
  });

  it('evaluates ends_on + 1 as ENDED (not in force) when requires_clearance = false', () => {
    const susp = base({ requiresClearance: false, clearedAt: null });
    expect(suspensionStatusOn(susp, '2026-10-21')).toBe('ENDED');
    expect(isInForceOn(susp, '2026-10-21')).toBe(false);
  });

  it('evaluates any date (starts_on - 1, starts_on, ends_on, ends_on + 1) as ENDED and not in force when cleared_at is set', () => {
    for (const requiresClearance of [true, false]) {
      const cleared = base({
        requiresClearance,
        clearedAt: new Date('2026-10-12T03:00:00Z'),
      });
      for (const d of [
        '2026-10-09',
        '2026-10-10',
        '2026-10-20',
        '2026-10-21',
      ]) {
        expect(suspensionStatusOn(cleared, d)).toBe('ENDED');
        expect(isInForceOn(cleared, d)).toBe(false);
      }
    }
  });
});

describe('endsOnFor', () => {
  it('returns startsOn when days = 1 (day 1 is the start date)', () => {
    expect(endsOnFor('2026-10-20', 1)).toBe('2026-10-20');
  });

  it('returns startsOn + 29 when days = 30', () => {
    expect(endsOnFor('2026-10-20', 30)).toBe('2026-11-18');
    expect(endsOnFor('2026-11-01', 30)).toBe('2026-11-30');
  });
});

describe('deriveRequiresClearance across all 6 reasons with undefined, true, false', () => {
  it.each(['KO', 'TKO'] as const)(
    '%s is always true and rejects false',
    (reason) => {
      expect(deriveRequiresClearance(reason, undefined)).toEqual({
        ok: true,
        requiresClearance: true,
      });
      expect(deriveRequiresClearance(reason, true)).toEqual({
        ok: true,
        requiresClearance: true,
      });
      expect(deriveRequiresClearance(reason, false)).toEqual({
        ok: false,
        reason: 'REQUIRES_CLEARANCE_MANDATORY',
      });
    },
  );

  it.each(['DQ', 'MANDATORY_REST'] as const)(
    '%s is always false and rejects true',
    (reason) => {
      expect(deriveRequiresClearance(reason, undefined)).toEqual({
        ok: true,
        requiresClearance: false,
      });
      expect(deriveRequiresClearance(reason, false)).toEqual({
        ok: true,
        requiresClearance: false,
      });
      expect(deriveRequiresClearance(reason, true)).toEqual({
        ok: false,
        reason: 'REQUIRES_CLEARANCE_FORBIDDEN',
      });
    },
  );

  it('MEDICAL defaults to true and allows caller override to true or false', () => {
    expect(deriveRequiresClearance('MEDICAL', undefined)).toEqual({
      ok: true,
      requiresClearance: true,
    });
    expect(deriveRequiresClearance('MEDICAL', true)).toEqual({
      ok: true,
      requiresClearance: true,
    });
    expect(deriveRequiresClearance('MEDICAL', false)).toEqual({
      ok: true,
      requiresClearance: false,
    });
  });

  it('OTHER defaults to false and follows caller request for true or false', () => {
    expect(deriveRequiresClearance('OTHER', undefined)).toEqual({
      ok: true,
      requiresClearance: false,
    });
    expect(deriveRequiresClearance('OTHER', true)).toEqual({
      ok: true,
      requiresClearance: true,
    });
    expect(deriveRequiresClearance('OTHER', false)).toEqual({
      ok: true,
      requiresClearance: false,
    });
  });

  it('covers all 6 SUSPENSION_REASONS', () => {
    expect(SUSPENSION_REASONS).toEqual([
      'KO',
      'TKO',
      'DQ',
      'MANDATORY_REST',
      'MEDICAL',
      'OTHER',
    ]);
  });
});

describe('cursor and request schemas', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('round-trips a suspension cursor and rejects invalid cursors', () => {
    const cursor = {
      startsOn: '2026-10-20',
      id: '11111111-1111-4111-8111-111111111111',
    };
    expect(decodeSuspensionCursor(encodeSuspensionCursor(cursor))).toEqual(
      cursor,
    );
    expect(decodeSuspensionCursor('not-valid')).toBeNull();
    expect(
      decodeSuspensionCursor(
        Buffer.from('["not-a-date","11111111-1111-4111-8111-111111111111"]').toString(
          'base64url',
        ),
      ),
    ).toBeNull();
  });

  it('parses listSuspensionsQuerySchema with active boolean coercion and default limit 20', () => {
    expect(listSuspensionsQuerySchema.parse({})).toEqual({ limit: 20 });
    expect(listSuspensionsQuerySchema.parse({ active: 'true' }).active).toBe(
      true,
    );
    expect(listSuspensionsQuerySchema.parse({ active: 'false' }).active).toBe(
      false,
    );
    expect(listSuspensionsQuerySchema.parse({ active: true }).active).toBe(
      true,
    );
    expect(
      listSuspensionsQuerySchema.safeParse({ active: 'invalid' }).success,
    ).toBe(false);
    expect(listSuspensionsQuerySchema.safeParse({ limit: 101 }).success).toBe(
      false,
    );
  });

  it('validates createSuspensionSchema and clearSuspensionSchema', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-20T03:00:00.000Z')); // 2026-10-20 in Vietnam

    const fighterId = '11111111-1111-4111-8111-111111111111';
    expect(
      createSuspensionSchema.safeParse({
        fighterId,
        reason: 'KO',
        days: 30,
      }).success,
    ).toBe(true);
    expect(
      createSuspensionSchema.safeParse({
        fighterId,
        reason: 'KO',
        days: 30,
        requiresClearance: false,
      }).success,
    ).toBe(false);
    expect(
      createSuspensionSchema.safeParse({
        fighterId,
        reason: 'DQ',
        days: 10,
        requiresClearance: true,
      }).success,
    ).toBe(false);
    expect(
      createSuspensionSchema.safeParse({
        fighterId,
        reason: 'MEDICAL',
        days: 14,
        startsOn: '2026-10-19',
      }).success,
    ).toBe(false);
    expect(
      createSuspensionSchema.safeParse({
        fighterId,
        reason: 'MEDICAL',
        days: 14,
        startsOn: '2026-10-25',
      }).success,
    ).toBe(true);

    expect(clearSuspensionSchema.safeParse({ clearanceNote: '  ok  ' }).success).toBe(
      false,
    );
    expect(
      clearSuspensionSchema.parse({ clearanceNote: '  Cleared after exam  ' }),
    ).toEqual({ clearanceNote: 'Cleared after exam' });
  });
});

describe('planConflicts (R28)', () => {
  const makeSuspension = (
    over: Partial<ConflictSuspensionInput> = {},
  ): ConflictSuspensionInput => ({
    id: 'susp-1',
    startsOn: '2026-10-01',
    endsOn: '2026-10-14',
    blockedSessionTypes: ['SPARRING'],
    requiresClearance: true,
    clearedAt: null,
    deletedAt: null,
    ...over,
  });

  const makeSession = (
    over: Partial<ConflictSessionInput> & { id?: string } = {},
  ): ConflictSessionInput => ({
    id: over.id ?? 'sess-1',
    sessionType: 'SPARRING',
    scheduledAt: new Date('2026-10-05T10:00:00.000Z'), // day 5 of 2026-10-01..2026-10-14
    status: 'SCHEDULED',
    deletedAt: null,
    ...over,
  });

  it('proposes CHANGE_TYPE to RECOVERY for a SPARRING session on day 5 of a suspension when RECOVERY is not blocked', () => {
    const proposals = planConflicts([makeSession()], [makeSuspension()]);
    expect(proposals).toEqual([
      {
        sessionId: 'sess-1',
        action: 'CHANGE_TYPE',
        toType: 'RECOVERY',
      },
    ]);
  });

  it('proposes RESCHEDULE to ends_on + 1 (same time of day) when RECOVERY is blocked and no blocking suspension requires clearance', () => {
    const susp = makeSuspension({
      startsOn: '2026-10-01',
      endsOn: '2026-10-10',
      blockedSessionTypes: [...SESSION_TYPES], // all types blocked, including RECOVERY
      requiresClearance: false,
    });
    const sess = makeSession({
      id: 'sess-reschedule',
      sessionType: 'SPARRING',
      scheduledAt: new Date('2026-10-05T09:30:00.000Z'),
    });

    const proposals = planConflicts([sess], [susp]);
    expect(proposals).toEqual([
      {
        sessionId: 'sess-reschedule',
        action: 'RESCHEDULE',
        toScheduledAt: new Date('2026-10-11T09:30:00.000Z'),
      },
    ]);
  });

  it('proposes CANCEL when RECOVERY is blocked and a blocking suspension requires clearance (both during ACTIVE and when AWAITING_CLEARANCE)', () => {
    const susp = makeSuspension({
      startsOn: '2026-10-01',
      endsOn: '2026-10-10',
      blockedSessionTypes: [...SESSION_TYPES],
      requiresClearance: true,
      clearedAt: null,
    });

    const duringActive = makeSession({
      id: 'sess-active',
      sessionType: 'SPARRING',
      scheduledAt: new Date('2026-10-05T10:00:00.000Z'),
    });
    const awaitingClearance = makeSession({
      id: 'sess-awaiting',
      sessionType: 'RECOVERY',
      scheduledAt: new Date('2026-10-15T10:00:00.000Z'),
    });

    expect(planConflicts([duringActive, awaitingClearance], [susp])).toEqual([
      { sessionId: 'sess-active', action: 'CANCEL' },
      { sessionId: 'sess-awaiting', action: 'CANCEL' },
    ]);
  });

  it('uses the latest ends_on among overlapping in-force suspensions that block the session type', () => {
    const susp1 = makeSuspension({
      id: 'susp-1',
      startsOn: '2026-10-01',
      endsOn: '2026-10-10',
      blockedSessionTypes: [...SESSION_TYPES],
      requiresClearance: false,
    });
    const susp2 = makeSuspension({
      id: 'susp-2',
      startsOn: '2026-10-03',
      endsOn: '2026-10-20',
      blockedSessionTypes: ['SPARRING'],
      requiresClearance: false,
    });
    // A third suspension with an even later end date that does NOT block SPARRING
    const suspOtherType = makeSuspension({
      id: 'susp-3',
      startsOn: '2026-10-01',
      endsOn: '2026-10-30',
      blockedSessionTypes: ['GRAPPLING'],
      requiresClearance: false,
    });

    const sess = makeSession({
      id: 'sess-overlap',
      sessionType: 'SPARRING',
      scheduledAt: new Date('2026-10-05T14:15:00.000Z'),
    });

    const proposals = planConflicts(
      [sess],
      [susp1, susp2, suspOtherType],
    );
    expect(proposals).toEqual([
      {
        sessionId: 'sess-overlap',
        action: 'RESCHEDULE',
        toScheduledAt: new Date('2026-10-21T14:15:00.000Z'),
      },
    ]);
  });

  it('produces nothing for an unblocked session type, a session outside the period, or a non-SCHEDULED session, and ignores soft-deleted or cleared records', () => {
    const fixedSusp = makeSuspension({
      startsOn: '2026-10-01',
      endsOn: '2026-10-10',
      blockedSessionTypes: ['SPARRING'],
      requiresClearance: false,
    });
    const deletedSusp = makeSuspension({
      id: 'susp-deleted',
      startsOn: '2026-10-01',
      endsOn: '2026-10-30',
      blockedSessionTypes: [...SESSION_TYPES],
      requiresClearance: true,
      deletedAt: new Date('2026-10-02T00:00:00.000Z'),
    });
    const clearedSusp = makeSuspension({
      id: 'susp-cleared',
      startsOn: '2026-10-01',
      endsOn: '2026-10-30',
      blockedSessionTypes: [...SESSION_TYPES],
      requiresClearance: true,
      clearedAt: new Date('2026-10-02T00:00:00.000Z'),
    });

    const unblockedType = makeSession({
      id: 'sess-pad',
      sessionType: 'PAD_WORK',
      scheduledAt: new Date('2026-10-05T10:00:00.000Z'),
    });
    const beforeStart = makeSession({
      id: 'sess-before',
      sessionType: 'SPARRING',
      scheduledAt: new Date('2026-09-30T10:00:00.000Z'),
    });
    const afterEnd = makeSession({
      id: 'sess-after',
      sessionType: 'SPARRING',
      scheduledAt: new Date('2026-10-11T10:00:00.000Z'),
    });
    const inProgress = makeSession({
      id: 'sess-in-progress',
      status: 'IN_PROGRESS',
    });
    const completed = makeSession({
      id: 'sess-completed',
      status: 'COMPLETED',
    });
    const cancelled = makeSession({
      id: 'sess-cancelled',
      status: 'CANCELLED',
    });
    const softDeletedSession = makeSession({
      id: 'sess-deleted',
      deletedAt: new Date('2026-10-02T00:00:00.000Z'),
    });

    expect(
      planConflicts(
        [
          unblockedType,
          beforeStart,
          afterEnd,
          inProgress,
          completed,
          cancelled,
          softDeletedSession,
        ],
        [fixedSusp, deletedSusp, clearedSusp],
      ),
    ).toEqual([]);
  });

  it('treats the ends_on day itself as inside the suspension period', () => {
    const susp = makeSuspension({
      startsOn: '2026-10-01',
      endsOn: '2026-10-10',
      blockedSessionTypes: ['SPARRING'],
      requiresClearance: false,
    });
    const onEndsOn = makeSession({
      id: 'sess-on-ends-on',
      type: 'SPARRING',
      scheduledAt: new Date('2026-10-10T10:00:00.000Z'),
    });

    expect(planConflicts([onEndsOn], [susp])).toEqual([
      {
        sessionId: 'sess-on-ends-on',
        action: 'CHANGE_TYPE',
        toType: 'RECOVERY',
      },
    ]);
  });
});

describe('suggestSuspensions (R27)', () => {
  const AIBA_RULES = [
    { reason: ['KO', 'TKO'], minDays: 30 },
    { reason: ['KO', 'TKO'], priorCount: 1, withinDays: 90, minDays: 90 },
    { reason: ['KO', 'TKO'], priorCount: 2, withinDays: 365, minDays: 365 },
    { loc: 'UNDER_1_MIN', minDays: 90 },
    { loc: 'OVER_1_MIN', minDays: 180 },
  ];

  const aibaRuleset = {
    name: 'Boxing nghiệp dư – AIBA (tham khảo)',
    suspensionRules: AIBA_RULES,
    restDaysAfterBout: 0,
    defaultBlockedSessionTypes: ['SPARRING'] as const,
  };

  const today = '2026-10-31';

  it('AIBA: first KO loss creates 30 days suspension with requiresClearance = true', () => {
    const res = suggestSuspensions({
      event: { result: 'LOSS', method: 'KO', lossOfConsciousness: 'NONE' },
      ruleset: aibaRuleset,
      today,
      priorKoTkoCount: 0,
    });

    expect(res).toEqual({
      ok: true,
      suspensions: [
        {
          reason: 'KO',
          startsOn: '2026-10-31',
          endsOn: '2026-11-29',
          days: 30,
          lossOfConsciousness: 'NONE',
          suggestedDays: 30,
          overrideReason: null,
          blockedSessionTypes: ['SPARRING'],
          requiresClearance: true,
          explanation: 'KO, AIBA preset: 30 days',
        },
      ],
    });
  });

  it('AIBA: manual 40-day-old KO suspension then a KO loss -> 90 days', () => {
    // 40 days prior to 2026-10-31 is 2026-09-21
    const res = suggestSuspensions({
      event: { result: 'LOSS', method: 'KO', lossOfConsciousness: 'NONE' },
      ruleset: aibaRuleset,
      today,
      boutDate: '2026-10-31',
      priorKoTkoCount: ['2026-09-21'],
    });

    expect(res).toEqual({
      ok: true,
      suspensions: [
        expect.objectContaining({
          reason: 'KO',
          days: 90,
          startsOn: '2026-10-31',
          endsOn: '2027-01-28',
          suggestedDays: 90,
          explanation: 'KO, second in 90 days, AIBA preset: 90 days',
        }),
      ],
    });
  });

  it('AIBA: third KO loss in 365 days -> 365 days', () => {
    const res = suggestSuspensions({
      event: { result: 'LOSS', method: 'KO', lossOfConsciousness: 'NONE' },
      ruleset: aibaRuleset,
      today,
      boutDate: '2026-10-31',
      priorKoTkoCount: ['2026-01-15', '2026-05-20'],
    });

    expect(res).toEqual({
      ok: true,
      suspensions: [
        expect.objectContaining({
          reason: 'KO',
          days: 365,
          suggestedDays: 365,
          explanation: 'KO, third in 365 days, AIBA preset: 365 days',
        }),
      ],
    });
  });

  it('AIBA: prior KO suspension older than 90 days (e.g. 100 days) falls back to Rule 1 (30 days)', () => {
    // 100 days prior to 2026-10-31 is 2026-07-23
    const res = suggestSuspensions({
      event: { result: 'LOSS', method: 'KO', lossOfConsciousness: 'NONE' },
      ruleset: aibaRuleset,
      today,
      boutDate: '2026-10-31',
      priorKoTkoCount: ['2026-07-23'],
    });

    expect(res).toEqual({
      ok: true,
      suspensions: [
        expect.objectContaining({
          reason: 'KO',
          days: 30,
          suggestedDays: 30,
        }),
      ],
    });
  });

  it('AIBA: TKO loss with stoppedByHeadStrike = true -> 30 days', () => {
    const res = suggestSuspensions({
      event: {
        result: 'LOSS',
        method: 'TKO',
        stoppedByHeadStrike: true,
        lossOfConsciousness: 'NONE',
      },
      ruleset: aibaRuleset,
      today,
      priorKoTkoCount: 0,
    });

    expect(res).toEqual({
      ok: true,
      suspensions: [
        expect.objectContaining({
          reason: 'TKO',
          days: 30,
          suggestedDays: 30,
          requiresClearance: true,
          explanation: 'TKO, AIBA preset: 30 days',
        }),
      ],
    });
  });

  it('AIBA: TKO loss with stoppedByHeadStrike = false -> NO TKO suspension', () => {
    const res = suggestSuspensions({
      event: {
        result: 'LOSS',
        method: 'TKO',
        stoppedByHeadStrike: false,
      },
      ruleset: aibaRuleset,
      today,
      priorKoTkoCount: 0,
    });

    expect(res).toEqual({
      ok: true,
      suspensions: [],
    });
  });

  it('AIBA: lossOfConsciousness rules UNDER_1_MIN (90 days) and OVER_1_MIN (180 days)', () => {
    const resUnder = suggestSuspensions({
      event: {
        result: 'LOSS',
        method: 'KO',
        lossOfConsciousness: 'UNDER_1_MIN',
      },
      ruleset: aibaRuleset,
      today,
      priorKoTkoCount: 0,
    });
    expect(resUnder).toEqual({
      ok: true,
      suspensions: [
        expect.objectContaining({
          reason: 'KO',
          days: 90,
          suggestedDays: 90,
          lossOfConsciousness: 'UNDER_1_MIN',
          explanation: 'KO, loss of consciousness under 1 min, AIBA preset: 90 days',
        }),
      ],
    });

    const resOver = suggestSuspensions({
      event: {
        result: 'LOSS',
        method: 'KO',
        lossOfConsciousness: 'OVER_1_MIN',
      },
      ruleset: aibaRuleset,
      today,
      priorKoTkoCount: 0,
    });
    expect(resOver).toEqual({
      ok: true,
      suspensions: [
        expect.objectContaining({
          reason: 'KO',
          days: 180,
          suggestedDays: 180,
          lossOfConsciousness: 'OVER_1_MIN',
          explanation: 'KO, loss of consciousness over 1 min, AIBA preset: 180 days',
        }),
      ],
    });
  });

  it('VMMAF (empty rules): KO loss without suspensionDays -> 422 SUSPENSION_DAYS_REQUIRED', () => {
    const vmmafRuleset = {
      name: 'MMA – VMMAF 2021',
      suspensionRules: [],
      restDaysAfterBout: 0,
    };

    const res = suggestSuspensions({
      event: { result: 'LOSS', method: 'KO', lossOfConsciousness: 'NONE' },
      ruleset: vmmafRuleset,
      today,
      priorKoTkoCount: 0,
    });

    expect(res).toEqual({
      ok: false,
      error: 'SUSPENSION_DAYS_REQUIRED',
      message: expect.stringContaining('suspensionDays is required'),
    });
  });

  it('VMMAF: KO loss with suspensionDays: 45 -> created with suggestedDays = null and overrideReason = null', () => {
    const vmmafRuleset = {
      name: 'MMA – VMMAF 2021',
      suspensionRules: [],
      restDaysAfterBout: 0,
      defaultBlockedSessionTypes: ['SPARRING', 'GRAPPLING'] as const,
    };

    const res = suggestSuspensions({
      event: { result: 'LOSS', method: 'KO', lossOfConsciousness: 'NONE' },
      ruleset: vmmafRuleset,
      today,
      priorKoTkoCount: 0,
      coachInput: { suspensionDays: 45 },
    });

    expect(res).toEqual({
      ok: true,
      suspensions: [
        {
          reason: 'KO',
          startsOn: '2026-10-31',
          endsOn: '2026-12-14',
          days: 45,
          lossOfConsciousness: 'NONE',
          suggestedDays: null,
          overrideReason: null,
          blockedSessionTypes: ['SPARRING', 'GRAPPLING'],
          requiresClearance: true,
          explanation: 'KO, coach specified: 45 days',
        },
      ],
    });
  });

  it('AIBA override: days different from suggestion without reason -> SUSPENSION_OVERRIDE_REASON_REQUIRED', () => {
    const res = suggestSuspensions({
      event: { result: 'LOSS', method: 'KO', lossOfConsciousness: 'NONE' },
      ruleset: aibaRuleset,
      today,
      priorKoTkoCount: 0,
      coachInput: { suspensionDays: 45 },
    });

    expect(res).toEqual({
      ok: false,
      error: 'SUSPENSION_OVERRIDE_REASON_REQUIRED',
      message: expect.stringContaining('suspensionOverrideReason is required'),
    });
  });

  it('AIBA override: days different from suggestion with reason -> stored in overrideReason', () => {
    const res = suggestSuspensions({
      event: { result: 'LOSS', method: 'KO', lossOfConsciousness: 'NONE' },
      ruleset: aibaRuleset,
      today,
      priorKoTkoCount: 0,
      coachInput: {
        suspensionDays: 45,
        suspensionOverrideReason: 'Severe concussion symptoms observed',
      },
    });

    expect(res).toEqual({
      ok: true,
      suspensions: [
        expect.objectContaining({
          reason: 'KO',
          days: 45,
          suggestedDays: 30,
          overrideReason: 'Severe concussion symptoms observed',
          explanation: 'KO, AIBA preset: 30 days (overridden to 45 days)',
        }),
      ],
    });
  });

  it('AIBA override: days equal to suggestion needs no overrideReason', () => {
    const res = suggestSuspensions({
      event: { result: 'LOSS', method: 'KO', lossOfConsciousness: 'NONE' },
      ruleset: aibaRuleset,
      today,
      priorKoTkoCount: 0,
      coachInput: { suspensionDays: 30 },
    });

    expect(res).toEqual({
      ok: true,
      suspensions: [
        expect.objectContaining({
          reason: 'KO',
          days: 30,
          suggestedDays: 30,
          overrideReason: null,
        }),
      ],
    });
  });

  it('DQ: creates DQ suspension ONLY if a rule lists DQ in its reason', () => {
    const rulesetWithDq = {
      name: 'Custom Ruleset',
      suspensionRules: [{ reason: 'DQ', minDays: 60 }],
      restDaysAfterBout: 0,
    };

    const resWithDq = suggestSuspensions({
      event: { result: 'LOSS', method: 'DQ' },
      ruleset: rulesetWithDq,
      today,
    });

    expect(resWithDq).toEqual({
      ok: true,
      suspensions: [
        expect.objectContaining({
          reason: 'DQ',
          days: 60,
          requiresClearance: false,
          suggestedDays: 60,
        }),
      ],
    });

    const resWithoutDq = suggestSuspensions({
      event: { result: 'LOSS', method: 'DQ' },
      ruleset: aibaRuleset, // AIBA rules only list KO, TKO
      today,
    });

    expect(resWithoutDq).toEqual({
      ok: true,
      suspensions: [],
    });
  });

  it('DQ: WIN + DQ with a DQ rule creates NO DQ suspension (only mandatory rest if restDays > 0)', () => {
    const rulesetWithDqAndRest = {
      name: 'Custom Ruleset with DQ and Rest',
      suspensionRules: [{ reason: 'DQ', minDays: 60 }],
      restDaysAfterBout: 7,
      defaultBlockedSessionTypes: ['SPARRING'] as const,
    };

    const resWinDq = suggestSuspensions({
      event: { result: 'WIN', method: 'DQ' },
      ruleset: rulesetWithDqAndRest,
      today,
    });

    expect(resWinDq).toEqual({
      ok: true,
      suspensions: [
        expect.objectContaining({
          reason: 'MANDATORY_REST',
          days: 7,
          requiresClearance: false,
        }),
      ],
    });

    const resDrawDq = suggestSuspensions({
      event: { result: 'DRAW', method: 'DQ' },
      ruleset: rulesetWithDqAndRest,
      today,
    });
    expect(resDrawDq).toEqual({
      ok: true,
      suspensions: [
        expect.objectContaining({
          reason: 'MANDATORY_REST',
          days: 7,
          requiresClearance: false,
        }),
      ],
    });

    const resNoContestDq = suggestSuspensions({
      event: { result: 'NO_CONTEST', method: 'DQ' },
      ruleset: rulesetWithDqAndRest,
      today,
    });
    expect(resNoContestDq).toEqual({
      ok: true,
      suspensions: [
        expect.objectContaining({
          reason: 'MANDATORY_REST',
          days: 7,
          requiresClearance: false,
        }),
      ],
    });
  });

  it('Mandatory rest: creates MANDATORY_REST suspension row when restDaysAfterBout > 0', () => {
    const rulesetWithRest = {
      name: 'Tournament Ruleset',
      suspensionRules: AIBA_RULES,
      restDaysAfterBout: 7,
      defaultBlockedSessionTypes: ['SPARRING', 'GRAPPLING'] as const,
    };

    const res = suggestSuspensions({
      event: { result: 'LOSS', method: 'KO', lossOfConsciousness: 'NONE' },
      ruleset: rulesetWithRest,
      today,
      priorKoTkoCount: 0,
    });

    expect(res).toEqual({
      ok: true,
      suspensions: [
        expect.objectContaining({
          reason: 'KO',
          days: 30,
          requiresClearance: true,
        }),
        {
          reason: 'MANDATORY_REST',
          startsOn: '2026-10-31',
          endsOn: '2026-11-06',
          days: 7,
          lossOfConsciousness: null,
          suggestedDays: 7,
          overrideReason: null,
          blockedSessionTypes: ['SPARRING', 'GRAPPLING'],
          requiresClearance: false,
          explanation: 'Mandatory rest after bout: 7 days',
        },
      ],
    });
  });

  it('A win with knockedDown creates NO KO/TKO suspension', () => {
    const res = suggestSuspensions({
      event: {
        result: 'WIN',
        method: 'KO',
        knockedDown: true,
      },
      ruleset: aibaRuleset,
      today,
      priorKoTkoCount: 0,
    });

    expect(res).toEqual({
      ok: true,
      suspensions: [],
    });
  });

  it('Passing suspensionDays or suspensionOverrideReason when no KO/TKO suspension is due returns validation error', () => {
    const resWin = suggestSuspensions({
      event: { result: 'WIN', method: 'DECISION' },
      ruleset: aibaRuleset,
      today,
      coachInput: { suspensionDays: 30 },
    });
    expect(resWin).toEqual({
      ok: false,
      error: 'SUSPENSION_DAYS_NOT_ALLOWED',
      message: expect.any(String),
    });

    const resTkoNoHead = suggestSuspensions({
      event: { result: 'LOSS', method: 'TKO', stoppedByHeadStrike: false },
      ruleset: aibaRuleset,
      today,
      coachInput: { suspensionOverrideReason: 'Some note' },
    });
    expect(resTkoNoHead).toEqual({
      ok: false,
      error: 'SUSPENSION_OVERRIDE_NOT_ALLOWED',
      message: expect.any(String),
    });
  });

  it('supports positional argument invocation matching the prompt description', () => {
    const res = suggestSuspensions(
      { result: 'LOSS', method: 'KO', lossOfConsciousness: 'NONE' },
      AIBA_RULES,
      0,
      0,
      undefined,
      today,
      { rulesetName: 'Boxing nghiệp dư – AIBA (tham khảo)' },
    );
    expect(res).toEqual({
      ok: true,
      suspensions: [
        expect.objectContaining({
          reason: 'KO',
          days: 30,
          explanation: 'KO, AIBA preset: 30 days',
        }),
      ],
    });
  });
});
