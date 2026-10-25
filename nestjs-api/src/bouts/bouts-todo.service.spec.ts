import { HttpException } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mocked } from 'vitest';
import type {
  BoutRequirementRow,
  BoutRow,
  CompetitionRuleset,
  SuspensionRow,
} from '../database/schema.js';
import type { AuthenticatedUser } from '../shared/models/auth-context.model.js';
import { USER } from '../shared/types/user.role.js';
import { SuspensionsRepository } from '../suspensions/suspensions.repo.js';
import { BoutsTodoService } from './bouts-todo.service.js';
import { BoutsRepository } from './bouts.repo.js';

const NOW = new Date('2026-10-20T03:00:00.000Z'); // 2026-10-20 10:00 in Vietnam
const RULESET_ID = '30000000-0000-4000-8000-000000000001';
const FIGHTER_A = '10000000-0000-4000-8000-00000000000a';
const FIGHTER_B = '10000000-0000-4000-8000-00000000000b';

const coach: AuthenticatedUser = {
  id: 'coach-user-1',
  authSubject: 'coach-sub-1',
  email: 'coach@example.com',
  role: USER.COACH,
};
const admin: AuthenticatedUser = { ...coach, id: 'admin-1', role: USER.ADMIN };
const fighter: AuthenticatedUser = { ...coach, id: 'fighter-1', role: USER.FIGHTER };
const doctor: AuthenticatedUser = { ...coach, id: 'doctor-1', role: USER.DOCTOR };

function ruleset(): CompetitionRuleset {
  return {
    id: RULESET_ID,
    fightWeekDays: 7,
    acuteWindowDays: 7,
  } as CompetitionRuleset;
}

function bout(over: Partial<BoutRow> & { id: string; fighterId: string }): BoutRow {
  return {
    rulesetId: RULESET_ID,
    eventName: 'Demo Cup',
    weightLimitKg: '60.00',
    catchweightKg: null,
    acuteLossLimitPct: '8.0',
    requirementsDueDays: 7,
    weighInAt: new Date('2026-10-30T01:00:00Z'),
    boutAt: new Date('2026-10-31T03:00:00Z'),
    status: 'CAMP',
    trainingPlanId: null,
    opponentAnalysis: {},
    createdAt: new Date('2026-10-01T03:00:00Z'),
    ...over,
  } as BoutRow;
}

function requirement(over: Partial<BoutRequirementRow> & { boutId: string }): BoutRequirementRow {
  return {
    code: 'HEALTH_CERT',
    label: 'Health certificate',
    required: true,
    status: 'MISSING',
    validUntil: null,
    ...over,
  } as BoutRequirementRow;
}

describe('BoutsTodoService', () => {
  let service: BoutsTodoService;
  let repo: Mocked<BoutsRepository>;
  let suspensionsRepo: Mocked<SuspensionsRepository>;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    repo = {
      listBouts: vi.fn().mockResolvedValue([]),
      listRulesets: vi.fn().mockResolvedValue([ruleset()]),
      listRequirementsForBouts: vi.fn().mockResolvedValue([]),
      findPlansByIds: vi.fn().mockResolvedValue([]),
      findWeightMeasurementsForFighters: vi.fn().mockResolvedValue([]),
      findScheduledSessionsForFighters: vi.fn().mockResolvedValue([]),
      findLatestBoutsForFighters: vi.fn().mockResolvedValue([]),
    } as unknown as Mocked<BoutsRepository>;
    suspensionsRepo = {
      findUnresolvedSuspensionsInScope: vi.fn().mockResolvedValue([]),
    } as unknown as Mocked<SuspensionsRepository>;
    service = new BoutsTodoService(repo, suspensionsRepo);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('refuses FIGHTER and DOCTOR even if the route permission was granted', async () => {
    for (const actor of [fighter, doctor]) {
      const error = await service.getCoachTodo(actor).then(
        () => undefined,
        (caught: unknown) => caught,
      );
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(403);
    }
    expect(repo.listBouts).not.toHaveBeenCalled();
  });

  it('scopes a COACH to assigned fighters and lets ADMIN see the club', async () => {
    await service.getCoachTodo(coach);
    expect(repo.listBouts).toHaveBeenLastCalledWith(
      expect.objectContaining({ scope: { kind: 'COACH', userId: 'coach-user-1' } }),
    );
    await service.getCoachTodo(admin);
    expect(repo.listBouts).toHaveBeenLastCalledWith(
      expect.objectContaining({ scope: { kind: 'ALL' } }),
    );
  });

  it('returns an empty card without further reads when there is no running bout', async () => {
    await expect(service.getCoachTodo(coach)).resolves.toEqual({ items: [], truncated: false });
    expect(repo.listRulesets).not.toHaveBeenCalled();
  });

  it('builds items from batched reads: one query per kind, not per bout', async () => {
    const boutA = bout({ id: '40000000-0000-4000-8000-00000000000a', fighterId: FIGHTER_A });
    const boutB = bout({
      id: '40000000-0000-4000-8000-00000000000b',
      fighterId: FIGHTER_B,
      status: 'FIGHT_WEEK',
      weighInAt: new Date('2026-10-22T01:00:00Z'),
      boutAt: new Date('2026-10-23T03:00:00Z'),
    });
    repo.listBouts.mockResolvedValue([boutA, boutB]);
    repo.listRequirementsForBouts.mockResolvedValue([requirement({ boutId: boutA.id })]);
    repo.findWeightMeasurementsForFighters.mockResolvedValue([
      // Fighter B is 66 kg two days before a 60 kg weigh-in and has not weighed in since 2026-10-18.
      { fighterId: FIGHTER_B, measuredAt: new Date('2026-10-18T03:00:00Z'), createdAt: NOW, weightKg: 66 },
    ]);

    const { items, truncated } = await service.getCoachTodo(coach);

    expect(truncated).toBe(false);
    expect(repo.listRulesets).toHaveBeenCalledTimes(1);
    expect(repo.listRequirementsForBouts).toHaveBeenCalledTimes(1);
    expect(repo.listRequirementsForBouts).toHaveBeenCalledWith([boutA.id, boutB.id]);
    expect(repo.findWeightMeasurementsForFighters).toHaveBeenCalledTimes(1);
    const forA = items.filter((item) => item.boutId === boutA.id).map((item) => item.source);
    const forB = items.filter((item) => item.boutId === boutB.id).map((item) => item.source);
    // A: weigh-in 10 days away, checklist open and due 2026-10-23 (3 days), no weight at all.
    expect(forA).toEqual(['REQUIREMENTS_DUE', 'WEIGHT_NOT_WEIGHED']);
    // B: the 66 kg is 2 days old, so not grey; 9.1% > 8% two days before the weigh-in is red;
    // two days without a weight in the fight week escalates the reminder.
    expect(forB).toEqual(['WEIGHT_OVER_LIMIT', 'WEIGHT_NOT_LOGGED']);
  });

  it('does not judge the weight of a bout after the official weigh-in', async () => {
    const weighed = bout({
      id: '40000000-0000-4000-8000-00000000000c',
      fighterId: FIGHTER_A,
      status: 'WEIGHED_IN',
      weighInAt: new Date('2026-10-19T01:00:00Z'),
      boutAt: new Date('2026-10-20T11:00:00Z'),
    });
    repo.listBouts.mockResolvedValue([weighed]);
    repo.findWeightMeasurementsForFighters.mockResolvedValue([
      { fighterId: FIGHTER_A, measuredAt: new Date('2026-10-20T01:00:00Z'), createdAt: NOW, weightKg: 66 },
    ]);
    const { items } = await service.getCoachTodo(coach);
    expect(items).toEqual([]);
  });

  it('flags a card cut at the bout limit', async () => {
    const many = Array.from({ length: 101 }, (_, index) =>
      bout({ id: `40000000-0000-4000-8000-${String(index).padStart(12, '0')}`, fighterId: FIGHTER_A }),
    );
    repo.listBouts.mockResolvedValue(many);
    const result = await service.getCoachTodo(admin);
    expect(result.truncated).toBe(true);
    expect(repo.listRequirementsForBouts.mock.calls[0]?.[0]).toHaveLength(100);
  });

  it('batches SUSPENSION_AWAITING_CLEARANCE and TRAINING_CONFLICTS_WITH_SUSPENSION using running or last bout, and skips fighters without any bout', async () => {
    const FIGHTER_C = '10000000-0000-4000-8000-00000000000c';
    const runningBoutA = bout({
      id: '40000000-0000-4000-8000-00000000000a',
      fighterId: FIGHTER_A,
      eventName: 'Next Cup',
      status: 'SCHEDULED',
    });
    const completedBoutB = bout({
      id: '40000000-0000-4000-8000-00000000000b',
      fighterId: FIGHTER_B,
      eventName: 'Last Cup',
      status: 'COMPLETED',
    });

    repo.listBouts.mockResolvedValue([runningBoutA]);
    repo.findWeightMeasurementsForFighters.mockResolvedValue([
      { fighterId: FIGHTER_A, measuredAt: NOW, createdAt: NOW, weightKg: 60 },
    ]);
    suspensionsRepo.findUnresolvedSuspensionsInScope.mockResolvedValue([
      // Fighter A: active suspension blocking SPARRING
      {
        id: '80000000-0000-4000-8000-000000000001',
        fighterId: FIGHTER_A,
        startsOn: '2026-10-18',
        endsOn: '2026-10-25',
        requiresClearance: false,
        clearedAt: null,
        blockedSessionTypes: ['SPARRING'],
        deletedAt: null,
      } as unknown as SuspensionRow,
      // Fighter B: awaiting clearance on 2026-10-20 (endsOn was 2026-10-19)
      {
        id: '80000000-0000-4000-8000-000000000002',
        fighterId: FIGHTER_B,
        startsOn: '2026-09-20',
        endsOn: '2026-10-19',
        requiresClearance: true,
        clearedAt: null,
        blockedSessionTypes: ['SPARRING'],
        deletedAt: null,
      } as unknown as SuspensionRow,
      // Fighter C: awaiting clearance, but has no bout at all -> should be skipped
      {
        id: '80000000-0000-4000-8000-000000000003',
        fighterId: FIGHTER_C,
        startsOn: '2026-09-20',
        endsOn: '2026-10-19',
        requiresClearance: true,
        clearedAt: null,
        blockedSessionTypes: ['SPARRING'],
        deletedAt: null,
      } as unknown as SuspensionRow,
    ]);
    repo.findScheduledSessionsForFighters.mockResolvedValue([
      {
        id: '70000000-0000-4000-8000-000000000001',
        fighterId: FIGHTER_A,
        sessionType: 'SPARRING',
        status: 'SCHEDULED',
        scheduledAt: new Date('2026-10-21T03:00:00Z'),
      },
      {
        id: '70000000-0000-4000-8000-000000000002',
        fighterId: FIGHTER_A,
        sessionType: 'SPARRING',
        status: 'SCHEDULED',
        scheduledAt: new Date('2026-10-22T03:00:00Z'),
      },
    ]);
    repo.findLatestBoutsForFighters.mockResolvedValue([completedBoutB]);

    const { items } = await service.getCoachTodo(coach);

    expect(suspensionsRepo.findUnresolvedSuspensionsInScope).toHaveBeenCalledTimes(1);
    expect(repo.findScheduledSessionsForFighters).toHaveBeenCalledTimes(1);
    expect(repo.findLatestBoutsForFighters).toHaveBeenCalledWith([
      FIGHTER_B,
      FIGHTER_C,
    ]);

    expect(items).toContainEqual({
      source: 'TRAINING_CONFLICTS_WITH_SUSPENSION',
      phase: 'AFTER',
      fighterId: FIGHTER_A,
      boutId: runningBoutA.id,
      eventName: 'Next Cup',
      dueOn: null,
      count: 2,
    });
    expect(items).toContainEqual({
      source: 'SUSPENSION_AWAITING_CLEARANCE',
      phase: 'AFTER',
      fighterId: FIGHTER_B,
      boutId: completedBoutB.id,
      eventName: 'Last Cup',
      dueOn: null,
      count: null,
    });
    expect(items.some((item) => item.fighterId === FIGHTER_C)).toBe(false);
  });
});
