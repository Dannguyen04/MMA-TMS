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
  SUSPENSION_REASONS,
  suspensionStatusOn,
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
