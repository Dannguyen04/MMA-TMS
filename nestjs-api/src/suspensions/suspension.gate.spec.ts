import { drizzle } from 'drizzle-orm/node-postgres';
import type { Pool } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import type { DrizzleDB } from '../database/database.module.js';
import type { SuspensionRow } from '../database/schema.js';
import type { Transaction } from '../shared/utils/audit-context.util.js';
import { SuspensionGate } from './suspension.gate.js';
import { endsOnFor } from './suspensions.model.js';
import { SuspensionsRepository } from './suspensions.repo.js';

const FIGHTER_ID = '10000000-0000-4000-8000-000000000001';
const SUSPENSION_ID = '50000000-0000-4000-8000-000000000001';

function makeSuspension(over: Partial<SuspensionRow> = {}): SuspensionRow {
  return {
    id: SUSPENSION_ID,
    fighterId: FIGHTER_ID,
    boutId: null,
    reason: 'KO',
    startsOn: '2026-10-01',
    endsOn: endsOnFor('2026-10-01', 45), // 2026-11-14
    lossOfConsciousness: 'UNDER_1_MIN',
    suggestedDays: 45,
    overrideReason: null,
    blockedSessionTypes: ['SPARRING'],
    requiresClearance: true,
    clearedAt: null,
    clearedById: null,
    clearanceNote: null,
    createdById: '20000000-0000-4000-8000-000000000001',
    createdAt: new Date('2026-10-01T03:00:00.000Z'),
    updatedAt: new Date('2026-10-01T03:00:00.000Z'),
    deletedAt: null,
    ...over,
  };
}

describe('SuspensionGate.blockingSuspensions', () => {
  it('blocks a blocked session type on day 10 and on ends_on day, and allows an unblocked type (PAD_WORK)', async () => {
    const koSuspension = makeSuspension({
      startsOn: '2026-10-01',
      endsOn: '2026-11-14', // 45-day KO suspension
      blockedSessionTypes: ['SPARRING'],
      requiresClearance: true,
    });
    const repo = {
      findSuspensionsByFighterId: vi.fn().mockResolvedValue([koSuspension]),
    } as unknown as SuspensionsRepository;
    const gate = new SuspensionGate(repo);

    // Day 10 of 45-day KO suspension (2026-10-10)
    const day10 = new Date('2026-10-10T03:00:00.000Z');
    await expect(
      gate.blockingSuspensions(FIGHTER_ID, 'SPARRING', day10),
    ).resolves.toEqual([
      {
        suspensionId: SUSPENSION_ID,
        reason: 'KO',
        endsOn: '2026-11-14',
        requiresClearance: true,
      },
    ]);

    // Unblocked type PAD_WORK on the same day passes
    await expect(
      gate.blockingSuspensions(FIGHTER_ID, 'PAD_WORK', day10),
    ).resolves.toEqual([]);

    // ends_on day (2026-11-14) still blocks
    const onEndsOn = new Date('2026-11-14T10:00:00.000Z');
    await expect(
      gate.blockingSuspensions(FIGHTER_ID, 'SPARRING', onEndsOn),
    ).resolves.toEqual([
      {
        suspensionId: SUSPENSION_ID,
        reason: 'KO',
        endsOn: '2026-11-14',
        requiresClearance: true,
      },
    ]);

    // Before starts_on (UPCOMING) does not block
    const beforeStartsOn = new Date('2026-09-30T10:00:00.000Z');
    await expect(
      gate.blockingSuspensions(FIGHTER_ID, 'SPARRING', beforeStartsOn),
    ).resolves.toEqual([]);
  });

  it('still blocks past ends_on when requiresClearance is true and not cleared, and stops blocking once cleared', async () => {
    const awaitingClearance = makeSuspension({
      startsOn: '2026-10-01',
      endsOn: '2026-11-14',
      requiresClearance: true,
      clearedAt: null,
    });
    const findSuspensionsByFighterId = vi
      .fn()
      .mockResolvedValue([awaitingClearance]);
    const gate = new SuspensionGate({
      findSuspensionsByFighterId,
    } as unknown as SuspensionsRepository);

    const pastEndsOn = new Date('2026-11-20T03:00:00.000Z');
    await expect(
      gate.blockingSuspensions(FIGHTER_ID, 'SPARRING', pastEndsOn),
    ).resolves.toEqual([
      {
        suspensionId: SUSPENSION_ID,
        reason: 'KO',
        endsOn: '2026-11-14',
        requiresClearance: true,
      },
    ]);

    // Once cleared on D = 2026-11-19, KO enters 2-day graded return (D and D+1) and stops blocking SPARRING from D+2 (2026-11-21)
    const cleared = makeSuspension({
      ...awaitingClearance,
      clearedAt: new Date('2026-11-19T08:00:00.000Z'),
      clearedById: '30000000-0000-4000-8000-000000000001',
      clearanceNote: 'Cleared by doctor',
    });
    findSuspensionsByFighterId.mockResolvedValueOnce([cleared]);
    await expect(
      gate.blockingSuspensions(
        FIGHTER_ID,
        'SPARRING',
        new Date('2026-11-21T03:00:00.000Z'),
      ),
    ).resolves.toEqual([]);

    findSuspensionsByFighterId.mockResolvedValueOnce([cleared]);
    await expect(
      gate.blockingSuspensions(
        FIGHTER_ID,
        'SPARRING',
        new Date('2026-10-10T03:00:00.000Z'),
      ),
    ).resolves.toEqual([]);
  });

  it('does not block past ends_on when requiresClearance is false (MANDATORY_REST / DQ)', async () => {
    const mandatoryRest = makeSuspension({
      reason: 'MANDATORY_REST',
      startsOn: '2026-10-01',
      endsOn: '2026-10-07',
      requiresClearance: false,
      clearedAt: null,
    });
    const gate = new SuspensionGate({
      findSuspensionsByFighterId: vi.fn().mockResolvedValue([mandatoryRest]),
    } as unknown as SuspensionsRepository);

    // On ends_on (2026-10-07) still blocks
    await expect(
      gate.blockingSuspensions(
        FIGHTER_ID,
        'SPARRING',
        new Date('2026-10-07T03:00:00.000Z'),
      ),
    ).resolves.toHaveLength(1);

    // On ends_on + 1 (2026-10-08) no longer blocks
    await expect(
      gate.blockingSuspensions(
        FIGHTER_ID,
        'SPARRING',
        new Date('2026-10-08T03:00:00.000Z'),
      ),
    ).resolves.toEqual([]);
  });

  it('ignores soft-deleted rows and forwards the transaction executor to the repository', async () => {
    const softDeleted = makeSuspension({
      id: '50000000-0000-4000-8000-000000000099',
      deletedAt: new Date('2026-10-05T00:00:00.000Z'),
    });
    const findSuspensionsByFighterId = vi
      .fn()
      .mockResolvedValue([softDeleted]);
    const gate = new SuspensionGate({
      findSuspensionsByFighterId,
    } as unknown as SuspensionsRepository);
    const tx = { execute: vi.fn() } as unknown as Transaction;

    const result = await gate.blockingSuspensions(
      FIGHTER_ID,
      'SPARRING',
      new Date('2026-10-10T03:00:00.000Z'),
      tx,
    );
    expect(result).toEqual([]);
    expect(findSuspensionsByFighterId).toHaveBeenCalledWith(FIGHTER_ID, tx);
  });

  it('uses the academy calendar date (Asia/Ho_Chi_Minh, UTC+7) of at', async () => {
    const startsOct21 = makeSuspension({
      startsOn: '2026-10-21',
      endsOn: '2026-10-25',
      requiresClearance: false,
    });
    const gate = new SuspensionGate({
      findSuspensionsByFighterId: vi.fn().mockResolvedValue([startsOct21]),
    } as unknown as SuspensionsRepository);

    // 2026-10-20T18:00:00.000Z is 2026-10-21 01:00 in Asia/Ho_Chi_Minh
    await expect(
      gate.blockingSuspensions(
        FIGHTER_ID,
        'SPARRING',
        new Date('2026-10-20T18:00:00.000Z'),
      ),
    ).resolves.toHaveLength(1);
  });

  it('Criteria 4, 5, 6: enforces graded return ceiling for cleared 60-day KO on D and D+1, allows SPARRING on D+2, has no graded return for MANDATORY_REST on E+1, and omits gradedReturn for uncleared KO', async () => {
    // Criterion 4: 60-day KO (2026-10-20..2026-12-18), cleared on D = 2026-12-19
    const clearedKo60 = makeSuspension({
      reason: 'KO',
      startsOn: '2026-10-20',
      endsOn: endsOnFor('2026-10-20', 60), // 2026-12-18
      requiresClearance: true,
      clearedAt: new Date('2026-12-19T02:00:00.000Z'), // D = 2026-12-19
      clearedById: '30000000-0000-4000-8000-000000000001',
      clearanceNote: 'Cleared by doctor',
    });
    const gate = new SuspensionGate({
      findSuspensionsByFighterId: vi.fn().mockResolvedValue([clearedKo60]),
    } as unknown as SuspensionsRepository);

    const dayD = new Date('2026-12-19T03:00:00.000Z');
    const dayDPlus1 = new Date('2026-12-20T03:00:00.000Z');
    const dayDPlus2 = new Date('2026-12-21T03:00:00.000Z');

    // Day D: PAD_WORK (tier 3 <= ceiling 3) allowed; GRAPPLING (tier 4 > 3) blocked with gradedReturn
    await expect(
      gate.blockingSuspensions(FIGHTER_ID, 'PAD_WORK', dayD),
    ).resolves.toEqual([]);
    await expect(
      gate.blockingSuspensions(FIGHTER_ID, 'GRAPPLING', dayD),
    ).resolves.toEqual([
      {
        suspensionId: SUSPENSION_ID,
        reason: 'KO',
        endsOn: '2026-12-18',
        requiresClearance: true,
        gradedReturn: {
          ceiling: 3,
          fullReturnOn: '2026-12-21',
        },
      },
    ]);

    // Day D+1: GRAPPLING (tier 4 <= ceiling 4) allowed; SPARRING (tier 5 > 4) blocked with gradedReturn
    await expect(
      gate.blockingSuspensions(FIGHTER_ID, 'GRAPPLING', dayDPlus1),
    ).resolves.toEqual([]);
    await expect(
      gate.blockingSuspensions(FIGHTER_ID, 'SPARRING', dayDPlus1),
    ).resolves.toEqual([
      {
        suspensionId: SUSPENSION_ID,
        reason: 'KO',
        endsOn: '2026-12-18',
        requiresClearance: true,
        gradedReturn: {
          ceiling: 4,
          fullReturnOn: '2026-12-21',
        },
      },
    ]);

    // Day D+2: SPARRING allowed
    await expect(
      gate.blockingSuspensions(FIGHTER_ID, 'SPARRING', dayDPlus2),
    ).resolves.toEqual([]);

    // Criterion 6: Uncleared KO blocks without gradedReturn property
    const unclearedKo = makeSuspension({
      reason: 'KO',
      startsOn: '2026-10-20',
      endsOn: '2026-12-18',
      requiresClearance: true,
      clearedAt: null,
    });
    const unclearedGate = new SuspensionGate({
      findSuspensionsByFighterId: vi.fn().mockResolvedValue([unclearedKo]),
    } as unknown as SuspensionsRepository);
    const unclearedBlocking = await unclearedGate.blockingSuspensions(
      FIGHTER_ID,
      'SPARRING',
      dayD,
    );
    expect(unclearedBlocking).toEqual([
      {
        suspensionId: SUSPENSION_ID,
        reason: 'KO',
        endsOn: '2026-12-18',
        requiresClearance: true,
      },
    ]);
    expect(unclearedBlocking[0]?.gradedReturn).toBeUndefined();
  });
});

describe('SuspensionsRepository.findSuspensionsByFighterId SQL boundary', () => {
  it('queries non-deleted suspensions for the fighter in a single query and accepts a custom executor', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [], rowCount: 0 });
    const db = drizzle({ client: { query } as unknown as Pool }) as DrizzleDB;
    const repo = new SuspensionsRepository(db);

    const txQuery = vi.fn().mockResolvedValue({ rows: [], rowCount: 0 });
    const txDb = drizzle({
      client: { query: txQuery } as unknown as Pool,
    }) as DrizzleDB;

    await repo.findSuspensionsByFighterId(FIGHTER_ID, txDb);
    expect(query).not.toHaveBeenCalled();
    expect(txQuery).toHaveBeenCalledTimes(1);
    const [config, params] = txQuery.mock.calls[0]!;
    expect(config.text).toContain('"suspensions"."fighter_id" =');
    expect(config.text).toContain('"suspensions"."deleted_at" is null');
    expect(config.text).toContain('order by "suspensions"."starts_on" asc');
    expect(params).toEqual([FIGHTER_ID]);
  });
});
