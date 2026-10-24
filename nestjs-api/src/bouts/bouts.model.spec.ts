import { describe, expect, it } from 'vitest';
import {
  academyDateOf,
  academyStartOfDay,
  acuteLossLimitPctFor,
  addDaysToDate,
  BOUT_STATUSES,
  BOUT_TRANSITIONS,
  buildDailyWeightPoints,
  buildReferencePath,
  canEnterFightWeek,
  canTransition,
  computeAcuteLoss,
  computeWeightTrack,
  createBoutSchema,
  daysBetweenDates,
  daysToWeighIn,
  decodeBoutCursor,
  encodeBoutCursor,
  evaluateGate1,
  fightWeekStartsOn,
  listBoutsQuerySchema,
  referenceKgAt,
  requirementsDueOn,
  resolveWeightClass,
  updateRequirementSchema,
  type BoutStatus,
  type RequirementState,
} from './bouts.model.js';

describe('weight track (criterion 1)', () => {
  const base = {
    limitKg: 60,
    acuteLossLimitPct: 8,
    acuteWindowDays: 7,
    today: '2026-10-20',
    weighInDate: '2026-10-22',
    campStart: '2026-10-10',
  };

  it('is OVER_LIMIT when 2 days remain and W = 66 kg (remaining 9.1% > 8%)', () => {
    const track = computeWeightTrack({
      ...base,
      points: [{ date: '2026-10-20', kg: 66 }],
    });
    expect(track.status).toBe('OVER_LIMIT');
    expect(track.remainingPct).toBe(9.1);
    expect(track.latestKg).toBe(66);
    expect(track.latestOn).toBe('2026-10-20');
    expect(track.limitKg).toBe(60);
  });

  it('is ON_TRACK when 2 days remain and W = 64.5 kg (remaining 7.0%)', () => {
    const track = computeWeightTrack({
      ...base,
      points: [{ date: '2026-10-20', kg: 64.5 }],
    });
    expect(track.status).toBe('ON_TRACK');
    expect(track.remainingPct).toBe(7);
  });

  it('is NOT_WEIGHED when there is no weight in the last 3 days', () => {
    const track = computeWeightTrack({
      ...base,
      points: [{ date: '2026-10-17', kg: 66 }],
    });
    expect(track.status).toBe('NOT_WEIGHED');
    // The 3-day window covers today, yesterday and the day before.
    expect(
      computeWeightTrack({ ...base, points: [{ date: '2026-10-18', kg: 64 }] })
        .status,
    ).toBe('ON_TRACK');
  });

  it('is NOT_WEIGHED with null numbers when no weight exists at all', () => {
    const track = computeWeightTrack({ ...base, points: [] });
    expect(track).toEqual({
      limitKg: 60,
      points: [],
      latestKg: null,
      latestOn: null,
      remainingPct: null,
      status: 'NOT_WEIGHED',
      referencePath: [],
    });
  });

  it('is ABOVE_TARGET with 20 days left when W is 1.5 kg above the reference path', () => {
    const far = {
      ...base,
      weighInDate: '2026-11-09',
      campStart: '2026-10-10',
    };
    const path = buildReferencePath({
      limitKg: far.limitKg,
      acuteLossLimitPct: far.acuteLossLimitPct,
      acuteWindowDays: far.acuteWindowDays,
      weighInDate: far.weighInDate,
      campStart: far.campStart,
      firstKg: 70,
    });
    const reference = referenceKgAt(path, far.today);
    expect(reference).not.toBeNull();
    const above = computeWeightTrack({
      ...far,
      points: [
        { date: '2026-10-10', kg: 70 },
        { date: '2026-10-20', kg: (reference as number) + 1.5 },
      ],
    });
    expect(above.status).toBe('ABOVE_TARGET');
    const within = computeWeightTrack({
      ...far,
      points: [
        { date: '2026-10-10', kg: 70 },
        { date: '2026-10-20', kg: (reference as number) + 0.5 },
      ],
    });
    expect(within.status).toBe('ON_TRACK');
  });

  it('is NEUTRAL from WEIGHED_IN on: a heavier weight after the weigh-in (rehydration) is not judged', () => {
    const afterWeighIn = {
      ...base,
      today: '2026-10-23',
      points: [
        { date: '2026-10-22', kg: 59.8 },
        { date: '2026-10-23', kg: 66 },
      ],
    };
    for (const boutStatus of ['WEIGHED_IN', 'COMPLETED', 'CANCELLED'] as const) {
      const track = computeWeightTrack({ ...afterWeighIn, boutStatus });
      expect(track.status).toBe('NEUTRAL');
      // The chart keeps every point; only the colour is dropped.
      expect(track.points).toHaveLength(2);
      expect(track.latestKg).toBe(66);
      expect(track.remainingPct).toBe(9.1);
    }
    expect(
      computeWeightTrack({ ...afterWeighIn, boutStatus: 'FIGHT_WEEK' }).status,
    ).toBe('OVER_LIMIT');
    expect(computeWeightTrack({ ...afterWeighIn }).status).toBe('OVER_LIMIT');
  });

  it('is NEUTRAL (not NOT_WEIGHED) from WEIGHED_IN on even with no weight at all', () => {
    const track = computeWeightTrack({
      ...base,
      boutStatus: 'COMPLETED',
      points: [],
    });
    expect(track.status).toBe('NEUTRAL');
    expect(track.points).toEqual([]);
  });

  it('builds the reference path: W0 at camp start, L% above the limit at weigh-in minus A, limit at weigh-in', () => {
    const path = buildReferencePath({
      limitKg: 60,
      acuteLossLimitPct: 8,
      acuteWindowDays: 7,
      weighInDate: '2026-11-09',
      campStart: '2026-10-10',
      firstKg: 70,
    });
    expect(path).toEqual([
      { date: '2026-10-10', kg: 70 },
      { date: '2026-11-02', kg: 65.22 },
      { date: '2026-11-09', kg: 60 },
    ]);
    expect(referenceKgAt(path, '2026-10-01')).toBe(70);
    expect(referenceKgAt(path, '2026-11-20')).toBe(60);
  });

  it('keeps the reference flat when the fighter starts below the target', () => {
    const path = buildReferencePath({
      limitKg: 60,
      acuteLossLimitPct: 8,
      acuteWindowDays: 7,
      weighInDate: '2026-11-09',
      campStart: '2026-10-10',
      firstKg: 62,
    });
    expect(path.map((p) => p.kg)).toEqual([62, 62, 60]);
  });

  it('handles a camp that starts inside the acute window', () => {
    const path = buildReferencePath({
      limitKg: 60,
      acuteLossLimitPct: 8,
      acuteWindowDays: 7,
      weighInDate: '2026-10-22',
      campStart: '2026-10-20',
      firstKg: 66,
    });
    expect(path).toEqual([
      { date: '2026-10-20', kg: 66 },
      { date: '2026-10-22', kg: 60 },
    ]);
  });

  it('uses the catchweight limit passed by the caller (remaining pct follows limitKg)', () => {
    const track = computeWeightTrack({
      ...base,
      limitKg: 63,
      points: [{ date: '2026-10-20', kg: 66 }],
    });
    expect(track.remainingPct).toBe(4.5);
    expect(track.status).toBe('ON_TRACK');
  });
});

describe('daily weight points', () => {
  const measurement = (iso: string, kg: number, created = iso) => ({
    measuredAt: new Date(iso),
    createdAt: new Date(created),
    weightKg: kg,
  });

  it('keeps the latest measurement of each academy day', () => {
    const points = buildDailyWeightPoints(
      [
        measurement('2026-10-19T00:00:00Z', 66.0),
        measurement('2026-10-19T02:00:00Z', 65.4),
        measurement('2026-10-20T00:30:00Z', 64.8),
      ],
      { from: '2026-10-06', to: '2026-10-20' },
    );
    expect(points).toEqual([
      { date: '2026-10-19', kg: 65.4 },
      { date: '2026-10-20', kg: 64.8 },
    ]);
  });

  it('breaks ties on measuredAt by createdAt', () => {
    const points = buildDailyWeightPoints(
      [
        measurement('2026-10-19T02:00:00Z', 65.0, '2026-10-19T02:05:00Z'),
        measurement('2026-10-19T02:00:00Z', 64.0, '2026-10-19T02:10:00Z'),
      ],
      { from: '2026-10-01', to: '2026-10-20' },
    );
    expect(points).toEqual([{ date: '2026-10-19', kg: 64 }]);
  });

  it('drops measurements outside the range and sorts ascending', () => {
    const points = buildDailyWeightPoints(
      [
        measurement('2026-10-12T01:00:00Z', 68),
        measurement('2026-10-05T01:00:00Z', 70),
        measurement('2026-10-21T01:00:00Z', 60),
        measurement('2026-10-08T01:00:00Z', 69),
      ],
      { from: '2026-10-06', to: '2026-10-20' },
    );
    expect(points.map((p) => p.date)).toEqual(['2026-10-08', '2026-10-12']);
  });

  it('assigns a late-evening UTC measurement to the next academy day', () => {
    const points = buildDailyWeightPoints(
      [measurement('2026-10-19T17:30:00Z', 65)],
      { from: '2026-10-01', to: '2026-10-31' },
    );
    expect(points).toEqual([{ date: '2026-10-20', kg: 65 }]);
  });
});

describe('acute loss threshold snapshot (criterion 2)', () => {
  const limits = { long: 8, short: 5 };
  const weighIn = new Date('2026-10-30T01:00:00Z');
  const hoursLater = (hours: number) =>
    new Date(weighIn.getTime() + hours * 3_600_000);

  it('uses 8% for 24 hours between weigh-in and bout', () => {
    expect(acuteLossLimitPctFor(weighIn, hoursLater(24), limits)).toBe(8);
  });
  it('uses 5% for 6 hours', () => {
    expect(acuteLossLimitPctFor(weighIn, hoursLater(6), limits)).toBe(5);
  });
  it('uses 8% at exactly 12 hours', () => {
    expect(acuteLossLimitPctFor(weighIn, hoursLater(12), limits)).toBe(8);
  });
  it('uses 5% just under 12 hours', () => {
    expect(
      acuteLossLimitPctFor(weighIn, new Date(hoursLater(12).getTime() - 1), limits),
    ).toBe(5);
  });
});

describe('academy calendar (criterion 3)', () => {
  it('maps 2026-10-20T17:30:00Z to 2026-10-21 in Vietnam', () => {
    expect(academyDateOf(new Date('2026-10-20T17:30:00Z'))).toBe('2026-10-21');
  });
  it('flips the date at 17:00:00Z', () => {
    expect(academyDateOf(new Date('2026-10-20T16:59:59.999Z'))).toBe('2026-10-20');
    expect(academyDateOf(new Date('2026-10-20T17:00:00.000Z'))).toBe('2026-10-21');
  });
  it('returns the first instant of an academy day', () => {
    expect(academyStartOfDay('2026-10-21').toISOString()).toBe(
      '2026-10-20T17:00:00.000Z',
    );
  });
  it('adds and subtracts days across month and year ends', () => {
    expect(addDaysToDate('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDaysToDate('2027-01-01', -1)).toBe('2026-12-31');
    expect(daysBetweenDates('2026-10-20', '2026-10-22')).toBe(2);
    expect(daysBetweenDates('2026-10-22', '2026-10-20')).toBe(-2);
  });
  it('computes daysToWeighIn, requirementsDueOn and the fight-week start in academy days', () => {
    const weighIn = new Date('2026-10-29T17:30:00Z'); // 2026-10-30 in Vietnam
    expect(daysToWeighIn(weighIn, new Date('2026-10-20T03:00:00Z'))).toBe(10);
    expect(requirementsDueOn(weighIn, 7)).toBe('2026-10-23');
    expect(fightWeekStartsOn(weighIn, 7)).toBe('2026-10-23');
  });
});

describe('Gate 1 (criterion 4)', () => {
  const boutAt = new Date('2026-10-31T03:00:00Z'); // 2026-10-31
  const item = (over: Partial<RequirementState> & { code: string }): RequirementState => ({
    label: over.code,
    required: true,
    status: 'PROVIDED',
    validUntil: '2027-01-01',
    ...over,
  });

  it('passes when every required item is PROVIDED or CONFIRMED and valid through the bout', () => {
    const result = evaluateGate1(
      [
        item({ code: 'A' }),
        item({ code: 'B', status: 'CONFIRMED', validUntil: '2026-10-31' }),
      ],
      boutAt,
    );
    expect(result).toEqual({ passed: true, missing: [], expiring: [] });
  });

  it('fails and lists exactly the missing required item', () => {
    const result = evaluateGate1(
      [item({ code: 'A' }), item({ code: 'B', status: 'MISSING', validUntil: null })],
      boutAt,
    );
    expect(result.passed).toBe(false);
    expect(result.missing.map((m) => m.code)).toEqual(['B']);
    expect(result.expiring).toEqual([]);
  });

  it('treats a REJECTED required item as missing', () => {
    const result = evaluateGate1(
      [item({ code: 'A', status: 'REJECTED', validUntil: null })],
      boutAt,
    );
    expect(result.passed).toBe(false);
    expect(result.missing.map((m) => m.code)).toEqual(['A']);
  });

  it('fails a PROVIDED item whose validUntil is before the bout date', () => {
    const result = evaluateGate1(
      [item({ code: 'A', validUntil: '2026-10-30' })],
      boutAt,
    );
    expect(result.passed).toBe(false);
    expect(result.expiring.map((m) => m.code)).toEqual(['A']);
    expect(result.missing).toEqual([]);
  });

  it('compares validUntil with the academy date of the bout, not the UTC date', () => {
    const lateBout = new Date('2026-10-30T18:00:00Z'); // 2026-10-31 in Vietnam
    expect(
      evaluateGate1([item({ code: 'A', validUntil: '2026-10-30' })], lateBout).passed,
    ).toBe(false);
    expect(
      evaluateGate1([item({ code: 'A', validUntil: '2026-10-31' })], lateBout).passed,
    ).toBe(true);
  });

  it('ignores a non-required item that is still MISSING', () => {
    const result = evaluateGate1(
      [
        item({ code: 'A' }),
        item({ code: 'OPTIONAL', required: false, status: 'MISSING', validUntil: null }),
      ],
      boutAt,
    );
    expect(result).toEqual({ passed: true, missing: [], expiring: [] });
  });

  it('passes with an empty checklist', () => {
    expect(evaluateGate1([], boutAt).passed).toBe(true);
  });
});

describe('state transitions (criterion 5)', () => {
  const valid: [BoutStatus, BoutStatus][] = [
    ['SCHEDULED', 'CAMP'],
    ['CAMP', 'FIGHT_WEEK'],
    ['FIGHT_WEEK', 'WEIGHED_IN'],
    ['WEIGHED_IN', 'COMPLETED'],
    ['SCHEDULED', 'CANCELLED'],
    ['CAMP', 'CANCELLED'],
    ['FIGHT_WEEK', 'CANCELLED'],
    ['WEIGHED_IN', 'CANCELLED'],
  ];

  it.each(valid)('allows %s -> %s', (from, to) => {
    expect(canTransition(from, to)).toBe(true);
  });

  it('rejects COMPLETED -> CANCELLED and CANCELLED -> CAMP', () => {
    expect(canTransition('COMPLETED', 'CANCELLED')).toBe(false);
    expect(canTransition('CANCELLED', 'CAMP')).toBe(false);
  });

  it('rejects every pair that is not in the valid list (no backwards moves, no skips)', () => {
    for (const from of BOUT_STATUSES) {
      for (const to of BOUT_STATUSES) {
        const expected = valid.some(([f, t]) => f === from && t === to);
        expect(canTransition(from, to), `${from} -> ${to}`).toBe(expected);
      }
    }
  });

  it('has no outgoing transition from final statuses', () => {
    expect(BOUT_TRANSITIONS.COMPLETED).toEqual([]);
    expect(BOUT_TRANSITIONS.CANCELLED).toEqual([]);
  });

  it('criterion 1: allows FIGHT_WEEK -> WEIGHED_IN and WEIGHED_IN -> COMPLETED', () => {
    expect(canTransition('FIGHT_WEEK', 'WEIGHED_IN')).toBe(true);
    expect(canTransition('WEIGHED_IN', 'COMPLETED')).toBe(true);
  });

  it('criterion 1: rejects COMPLETED -> CANCELLED, WEIGHED_IN -> CAMP, FIGHT_WEEK -> COMPLETED', () => {
    expect(canTransition('COMPLETED', 'CANCELLED')).toBe(false);
    expect(canTransition('WEIGHED_IN', 'CAMP')).toBe(false);
    expect(canTransition('FIGHT_WEEK', 'COMPLETED')).toBe(false);
  });
});

describe('canEnterFightWeek', () => {
  const gate1 = { passed: true, missing: [], expiring: [] };
  const weighInAt = new Date('2026-10-29T17:30:00Z'); // 2026-10-30
  const input = (over: Record<string, unknown> = {}) => ({
    status: 'CAMP' as BoutStatus,
    weighInAt,
    fightWeekDays: 7,
    now: new Date('2026-10-23T03:00:00Z'),
    gate1,
    ...over,
  });

  it('is true on the first day of the window with Gate 1 passed', () => {
    expect(canEnterFightWeek(input())).toBe(true);
  });
  it('is false the day before the window opens', () => {
    expect(canEnterFightWeek(input({ now: new Date('2026-10-22T03:00:00Z') }))).toBe(
      false,
    );
  });
  it('is false when Gate 1 fails or the bout is not in CAMP', () => {
    expect(
      canEnterFightWeek(
        input({ gate1: { passed: false, missing: [], expiring: [] } }),
      ),
    ).toBe(false);
    expect(canEnterFightWeek(input({ status: 'SCHEDULED' }))).toBe(false);
  });
});

describe('weight class resolution', () => {
  const classes = [
    { code: '60', label: '60 kg', limitKg: 60 },
    { code: '120+', label: 'Trên 120 kg', limitKg: null },
  ];

  it('uses the limit of a listed class', () => {
    expect(resolveWeightClass(classes, { weightClassCode: '60' })).toEqual({
      ok: true,
      code: '60',
      limitKg: 60,
    });
  });
  it('rejects a missing or unknown code when the ruleset has classes', () => {
    expect(resolveWeightClass(classes, {})).toEqual({
      ok: false,
      reason: 'CLASS_CODE_REQUIRED',
    });
    expect(resolveWeightClass(classes, { weightClassCode: '61' })).toEqual({
      ok: false,
      reason: 'CLASS_CODE_UNKNOWN',
    });
  });
  it('asks for an explicit limit on an open class', () => {
    expect(resolveWeightClass(classes, { weightClassCode: '120+' })).toEqual({
      ok: false,
      reason: 'LIMIT_REQUIRED',
    });
    expect(
      resolveWeightClass(classes, { weightClassCode: '120+', weightLimitKg: 130 }),
    ).toEqual({ ok: true, code: '120+', limitKg: 130 });
  });
  it('requires weightLimitKg between 30 and 200 for a free-form ruleset', () => {
    expect(resolveWeightClass([], {})).toEqual({ ok: false, reason: 'LIMIT_REQUIRED' });
    expect(resolveWeightClass([], { weightLimitKg: 29.9 })).toEqual({
      ok: false,
      reason: 'LIMIT_OUT_OF_RANGE',
    });
    expect(resolveWeightClass([], { weightLimitKg: 200.1 })).toEqual({
      ok: false,
      reason: 'LIMIT_OUT_OF_RANGE',
    });
    expect(resolveWeightClass([], { weightLimitKg: 72.5 })).toEqual({
      ok: true,
      code: 'CUSTOM',
      limitKg: 72.5,
    });
  });

  it('criterion 2: VMMAF 120+ with 100 -> LIMIT_OUT_OF_RANGE, with 121 -> ok', () => {
    const vmmaf = [
      { code: '56', label: '56 kg', limitKg: 56 },
      { code: '120', label: '120 kg', limitKg: 120 },
      { code: '120+', label: 'Trên 120 kg', limitKg: null },
    ];
    expect(
      resolveWeightClass(vmmaf, { weightClassCode: '120+', weightLimitKg: 100 }),
    ).toEqual({ ok: false, reason: 'LIMIT_OUT_OF_RANGE' });
    expect(
      resolveWeightClass(vmmaf, { weightClassCode: '120+', weightLimitKg: 121 }),
    ).toEqual({ ok: true, code: '120+', limitKg: 121 });
  });

  it('criterion 2: AIBA 91+ with 90 -> LIMIT_OUT_OF_RANGE, 92 -> ok', () => {
    const aiba = [
      { code: '52', label: '52 kg', limitKg: 52 },
      { code: '91', label: '91 kg', limitKg: 91 },
      { code: '91+', label: 'Trên 91 kg', limitKg: null },
    ];
    expect(
      resolveWeightClass(aiba, { weightClassCode: '91+', weightLimitKg: 90 }),
    ).toEqual({ ok: false, reason: 'LIMIT_OUT_OF_RANGE' });
    expect(
      resolveWeightClass(aiba, { weightClassCode: '91+', weightLimitKg: 92 }),
    ).toEqual({ ok: true, code: '91+', limitKg: 92 });
  });
});

describe('cursor and request schemas', () => {
  it('round-trips a cursor and rejects garbage', () => {
    const cursor = {
      weighInAt: '2026-10-30T01:00:00.000Z',
      id: '11111111-1111-4111-8111-111111111111',
    };
    expect(decodeBoutCursor(encodeBoutCursor(cursor))).toEqual(cursor);
    expect(decodeBoutCursor('not-a-cursor')).toBeNull();
    expect(
      decodeBoutCursor(Buffer.from('["x","y"]').toString('base64url')),
    ).toBeNull();
  });

  it('accepts a repeated status filter as a single value or an array', () => {
    expect(listBoutsQuerySchema.parse({ status: 'CAMP' }).status).toEqual(['CAMP']);
    expect(
      listBoutsQuerySchema.parse({ status: ['CAMP', 'FIGHT_WEEK'] }).status,
    ).toEqual(['CAMP', 'FIGHT_WEEK']);
    expect(listBoutsQuerySchema.safeParse({ status: 'NOPE' }).success).toBe(false);
    expect(listBoutsQuerySchema.parse({}).limit).toBe(20);
  });

  it('requires a limit within 30-200 kg when given on create', () => {
    const base = {
      fighterId: '11111111-1111-4111-8111-111111111111',
      rulesetId: '22222222-2222-4222-8222-222222222222',
      eventName: 'Cup',
      weighInAt: '2026-10-30T08:00:00+07:00',
      boutAt: '2026-10-31T10:00:00+07:00',
    };
    expect(createBoutSchema.safeParse({ ...base, weightLimitKg: 29 }).success).toBe(
      false,
    );
    expect(createBoutSchema.safeParse({ ...base, weightLimitKg: 70 }).success).toBe(
      true,
    );
    expect(createBoutSchema.safeParse({ ...base, extra: 1 }).success).toBe(false);
  });

  it('refuses the CONFIRMED status and an empty requirement patch', () => {
    expect(updateRequirementSchema.safeParse({ status: 'CONFIRMED' }).success).toBe(
      false,
    );
    expect(updateRequirementSchema.safeParse({}).success).toBe(false);
    expect(
      updateRequirementSchema.safeParse({ status: 'PROVIDED', validUntil: '2027-01-01' })
        .success,
    ).toBe(true);
  });
});

describe('computeAcuteLoss (criterion 3)', () => {
  const weighInDate = '2026-10-20';
  const acuteWindowDays = 7;

  it('calculates 7.9% WITHIN for startKg=66.0, official=60.8, limitPct=8', () => {
    const measurements = [
      {
        measuredAt: new Date('2026-10-14T02:00:00Z'),
        weightKg: 66.0,
      },
    ];
    const result = computeAcuteLoss({
      officialWeightKg: 60.8,
      limitPct: 8,
      acuteWindowDays,
      weighInDate,
      measurements,
    });
    expect(result).toEqual({
      status: 'WITHIN',
      startKg: 66,
      startOn: '2026-10-14',
      lossPct: 7.9,
      limitPct: 8,
    });
  });

  it('calculates 9.1% EXCEEDED for startKg=66.0, official=60.0, limitPct=8', () => {
    const measurements = [
      {
        measuredAt: new Date('2026-10-14T02:00:00Z'),
        weightKg: 66.0,
      },
    ];
    const result = computeAcuteLoss({
      officialWeightKg: 60.0,
      limitPct: 8,
      acuteWindowDays,
      weighInDate,
      measurements,
    });
    expect(result).toEqual({
      status: 'EXCEEDED',
      startKg: 66,
      startOn: '2026-10-14',
      lossPct: 9.1,
      limitPct: 8,
    });
  });

  it('returns NO_DATA when no weight measurements exist in the window', () => {
    const measurements = [
      {
        measuredAt: new Date('2026-10-10T02:00:00Z'),
        weightKg: 66.0,
      },
    ];
    const result = computeAcuteLoss({
      officialWeightKg: 60.8,
      limitPct: 8,
      acuteWindowDays,
      weighInDate,
      measurements,
    });
    expect(result).toEqual({
      status: 'NO_DATA',
      startKg: null,
      startOn: null,
      lossPct: null,
      limitPct: 8,
    });
  });

  it('ignores WEIGH_IN measurements when selecting startKg', () => {
    const measurements = [
      {
        measuredAt: new Date('2026-10-14T01:00:00Z'),
        weightKg: 70.0,
        measurementContext: 'WEIGH_IN',
      },
      {
        measuredAt: new Date('2026-10-14T02:00:00Z'),
        weightKg: 66.0,
        measurementContext: 'TRAINING',
      },
    ];
    const result = computeAcuteLoss({
      officialWeightKg: 60.8,
      limitPct: 8,
      acuteWindowDays,
      weighInDate,
      measurements,
    });
    expect(result.startKg).toBe(66);
    expect(result.lossPct).toBe(7.9);
  });

  it('picks the earliest measurement in the window when multiple exist', () => {
    const measurements = [
      {
        measuredAt: new Date('2026-10-16T02:00:00Z'),
        weightKg: 64.0,
      },
      {
        measuredAt: new Date('2026-10-14T02:00:00Z'),
        weightKg: 66.0,
      },
      {
        measuredAt: new Date('2026-10-18T02:00:00Z'),
        weightKg: 62.0,
      },
    ];
    const result = computeAcuteLoss({
      officialWeightKg: 60.8,
      limitPct: 8,
      acuteWindowDays,
      weighInDate,
      measurements,
    });
    expect(result.startKg).toBe(66);
    expect(result.startOn).toBe('2026-10-14');
  });
});
