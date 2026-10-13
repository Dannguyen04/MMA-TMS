import {
  academyDay,
  academyDayEnd,
  academyDayStart,
  createGoalSchema,
  deriveGoalStatus,
  goalDefinitionIssues,
  listGoalsQuerySchema,
  updateGoalSchema,
  type GoalStatusInput,
} from './goals.model.js';

const higherIsBetter: GoalStatusInput = {
  baseline: 60,
  target: 80,
  current: 60,
  lowerIsBetter: false,
  startDate: '2026-09-01',
  dueDate: '2026-09-10',
};
const lowerIsBetter: GoalStatusInput = {
  ...higherIsBetter,
  baseline: 480,
  target: 320,
  current: 480,
  lowerIsBetter: true,
};
const start = academyDayStart(higherIsBetter.startDate).getTime();
const due = academyDayEnd(higherIsBetter.dueDate).getTime();
/** An instant at `fraction` of the goal period (start of start day → end of due day). */
const at = (fraction: number) => new Date(start + Math.round((due - start) * fraction));

describe('academy calendar (Asia/Ho_Chi_Minh, UTC+7)', () => {
  it('maps instants to the academy day they fall on', () => {
    expect(academyDay(new Date('2026-09-05T16:59:59.999Z'))).toBe('2026-09-05');
    expect(academyDay(new Date('2026-09-05T17:00:00.000Z'))).toBe('2026-09-06');
  });

  it('spans a day from its local midnight to its last millisecond', () => {
    expect(academyDayStart('2026-09-06').toISOString()).toBe('2026-09-05T17:00:00.000Z');
    expect(academyDayEnd('2026-09-06').toISOString()).toBe('2026-09-06T16:59:59.999Z');
  });
});

describe('deriveGoalStatus (Business Flows, Flow 7)', () => {
  it('is achieved once the target is reached, even after the due date', () => {
    expect(deriveGoalStatus({ ...higherIsBetter, current: 80 }, at(0.1))).toBe('ACHIEVED');
    expect(deriveGoalStatus({ ...higherIsBetter, current: 85 }, at(2))).toBe('ACHIEVED');
    expect(deriveGoalStatus({ ...lowerIsBetter, current: 300 }, at(0.5))).toBe('ACHIEVED');
  });

  it('is missed only after the due day has ended', () => {
    expect(deriveGoalStatus({ ...higherIsBetter, current: 78 }, new Date(due))).toBe('ON_TRACK');
    expect(deriveGoalStatus({ ...higherIsBetter, current: 79 }, new Date(due + 1))).toBe('MISSED');
  });

  it('is on track at 90% of the expected linear progress and at risk below it', () => {
    // Halfway the line expects +10; 90% of that is +9.
    expect(deriveGoalStatus({ ...higherIsBetter, current: 69.01 }, at(0.5))).toBe('ON_TRACK');
    expect(deriveGoalStatus({ ...higherIsBetter, current: 68.9 }, at(0.5))).toBe('AT_RISK');
  });

  it('applies the same rule to lower-is-better goals', () => {
    // Halfway the line expects −80 from 480; 90% of that is −72 → 408.
    expect(deriveGoalStatus({ ...lowerIsBetter, current: 407.9 }, at(0.5))).toBe('ON_TRACK');
    expect(deriveGoalStatus({ ...lowerIsBetter, current: 409 }, at(0.5))).toBe('AT_RISK');
  });

  it('is on track before the start unless the value regressed', () => {
    expect(deriveGoalStatus(higherIsBetter, at(-0.5))).toBe('ON_TRACK');
    expect(deriveGoalStatus({ ...higherIsBetter, current: 59 }, at(-0.5))).toBe('AT_RISK');
  });
});

describe('goalDefinitionIssues', () => {
  const base = {
    lowerIsBetter: false,
    baseline: 60,
    target: 80,
    startDate: '2026-09-01',
    dueDate: '2026-09-10',
  };

  it('accepts a real change in the declared direction over at least one day', () => {
    expect(goalDefinitionIssues(base)).toEqual([]);
    expect(goalDefinitionIssues({ ...base, lowerIsBetter: true, target: 40 })).toEqual([]);
    expect(goalDefinitionIssues({ ...base, dueDate: '2026-09-02' })).toEqual([]);
  });

  it('rejects an equal or wrong-direction target', () => {
    expect(goalDefinitionIssues({ ...base, target: 60 })).toEqual(['TARGET']);
    expect(goalDefinitionIssues({ ...base, target: 50 })).toEqual(['TARGET']);
    expect(goalDefinitionIssues({ ...base, lowerIsBetter: true })).toEqual(['TARGET']);
  });

  it('rejects a due day not after the start day', () => {
    expect(goalDefinitionIssues({ ...base, dueDate: base.startDate })).toEqual(['DATE_RANGE']);
  });
});

describe('request schemas', () => {
  const fighterId = 'c61e6859-4a4e-4313-b762-9343270153f5';
  const coachId = '88f97dd5-8f68-45bf-81db-4a778d30853a';
  // What the web app sends: academy-day start and end instants.
  const validCreate = {
    fighterId,
    coachId,
    title: '  Guard recovery  ',
    technique: 'HEAD_MOVEMENT',
    metricLabel: 'Recovery time',
    unit: 'ms',
    lowerIsBetter: true,
    baseline: 480,
    target: 320,
    startDate: '2026-08-31T17:00:00.000Z',
    dueDate: '2026-10-01T16:59:59.999Z',
  };

  it('parses a create body, trims text and converts dates to academy days', () => {
    const parsed = createGoalSchema.parse(validCreate);
    expect(parsed).toMatchObject({
      title: 'Guard recovery',
      startDate: '2026-09-01',
      dueDate: '2026-10-01',
    });
    expect(parsed.current).toBeUndefined();
  });

  it('reports cross-field rules on the offending path', () => {
    const result = createGoalSchema.safeParse({ ...validCreate, target: 500 });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path)).toEqual([['target']]);
  });

  it('rejects unknown fields, negative or non-finite values and a short title', () => {
    expect(createGoalSchema.safeParse({ ...validCreate, status: 'ACHIEVED' }).success).toBe(false);
    expect(createGoalSchema.safeParse({ ...validCreate, baseline: Infinity }).success).toBe(false);
    expect(createGoalSchema.safeParse({ ...validCreate, current: -1 }).success).toBe(false);
    expect(createGoalSchema.safeParse({ ...validCreate, title: 'ab' }).success).toBe(false);
  });

  it('requires at least one field on update and never accepts the fighter or value', () => {
    expect(updateGoalSchema.safeParse({}).success).toBe(false);
    expect(updateGoalSchema.safeParse({ title: 'Faster jab' }).success).toBe(true);
    expect(updateGoalSchema.safeParse({ fighterId }).success).toBe(false);
    expect(updateGoalSchema.safeParse({ current: 1 }).success).toBe(false);
  });

  it('accepts single or repeated fighterId and status query values', () => {
    expect(listGoalsQuerySchema.parse({ fighterId, status: 'AT_RISK' })).toEqual({
      fighterId: [fighterId],
      status: ['AT_RISK'],
      limit: 100,
    });
    expect(
      listGoalsQuerySchema.parse({ fighterId: [fighterId, coachId], limit: '20' }),
    ).toMatchObject({ fighterId: [fighterId, coachId], limit: 20 });
    expect(listGoalsQuerySchema.safeParse({ status: 'ACTIVE' }).success).toBe(false);
  });
});
