import { Test, type TestingModule } from '@nestjs/testing';
import type { Mocked } from 'vitest';
import type { AuthenticatedUser } from '../shared/models/auth-context.model.js';
import { USER } from '../shared/types/user.role.js';
import { GoalsRepository } from './goals.repo.js';
import { GoalsService } from './goals.service.js';

const fighterId = '33333333-3333-4333-8333-333333333333';
const coachId = '44444444-4444-4444-8444-444444444444';
const goalId = '55555555-5555-4555-8555-555555555555';
const coach: AuthenticatedUser = {
  id: '22222222-2222-4222-8222-222222222222',
  authSubject: 'local-coach',
  email: 'coach@example.test',
  role: USER.COACH,
};

const storedGoal = {
  id: goalId,
  fighterId,
  coachId,
  title: 'Improve guard uptime',
  technique: 'GUARD' as const,
  metricLabel: 'Guard uptime',
  unit: '%',
  lowerIsBetter: false,
  baseline: 60,
  target: 80,
  current: 60,
  startDate: new Date('2026-09-01T00:00:00.000Z'),
  dueDate: new Date('2026-10-31T23:59:59.999Z'),
  status: 'ON_TRACK' as const,
  createdAt: new Date('2026-09-01T00:00:00.000Z'),
  updatedAt: new Date('2026-09-01T00:00:00.000Z'),
  deletedAt: null,
};

function repositoryMock() {
  const transaction = vi.fn(async (work: (database: object) => unknown) =>
    work({ execute: vi.fn().mockResolvedValue(undefined) }),
  );
  return {
    transaction,
    findActiveFighterIdByUserId: vi.fn(),
    findActiveCoachIdByUserId: vi.fn(),
    isCoachAssignedToFighter: vi.fn(),
    findPage: vi.fn(),
    findById: vi.fn(),
    findHistory: vi.fn(),
    findHistoryByGoalIds: vi.fn(),
    create: vi.fn(),
    appendProgress: vi.fn(),
    update: vi.fn(),
    softDelete: vi.fn(),
  };
}

describe('GoalsService', () => {
  let service: GoalsService;
  let repository: Mocked<GoalsRepository>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GoalsService,
        { provide: GoalsRepository, useValue: repositoryMock() },
      ],
    }).compile();
    service = module.get(GoalsService);
    repository = module.get(GoalsRepository);
    repository.findActiveCoachIdByUserId.mockResolvedValue(coachId);
    repository.isCoachAssignedToFighter.mockResolvedValue(true);
    repository.findHistory.mockResolvedValue([
      { date: storedGoal.createdAt, value: storedGoal.current },
    ]);
    repository.findHistoryByGoalIds.mockResolvedValue(new Map());
  });

  it('derives the coach profile and creates the initial progress event atomically', async () => {
    repository.create.mockResolvedValue(storedGoal);

    await service.create(
      coach,
      {
        fighterId,
        coachId: '99999999-9999-4999-8999-999999999999',
        title: storedGoal.title,
        technique: 'GUARD',
        metricLabel: storedGoal.metricLabel,
        unit: storedGoal.unit,
        lowerIsBetter: false,
        baseline: 60,
        target: 80,
        current: 60,
        startDate: storedGoal.startDate.toISOString(),
        dueDate: storedGoal.dueDate.toISOString(),
      },
      'request-create',
    );

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({ coachId }),
      expect.anything(),
    );
    expect(repository.appendProgress).toHaveBeenCalledWith(
      expect.objectContaining({ goalId, value: 60, recordedById: coach.id }),
      expect.anything(),
    );
  });

  it('rejects a coach who is not actively assigned to the fighter', async () => {
    repository.isCoachAssignedToFighter.mockResolvedValue(false);

    await expect(
      service.create(
        coach,
        {
          fighterId,
          coachId,
          title: storedGoal.title,
          technique: null,
          metricLabel: storedGoal.metricLabel,
          unit: storedGoal.unit,
          lowerIsBetter: false,
          baseline: 60,
          target: 80,
          startDate: storedGoal.startDate.toISOString(),
          dueDate: storedGoal.dueDate.toISOString(),
        },
        'request-denied',
      ),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('marks a goal achieved and appends progress in the same transaction', async () => {
    repository.findById.mockResolvedValue(storedGoal);
    repository.update.mockResolvedValue({
      ...storedGoal,
      current: 82,
      status: 'ACHIEVED',
    });

    const result = await service.updateProgress(
      coach,
      goalId,
      { value: 82 },
      'request-progress',
    );

    expect(repository.update).toHaveBeenCalledWith(
      goalId,
      { current: 82, status: 'ACHIEVED' },
      expect.anything(),
    );
    expect(repository.appendProgress).toHaveBeenCalledWith(
      expect.objectContaining({ goalId, value: 82, recordedById: coach.id }),
      expect.anything(),
    );
    expect(result.status).toBe('ACHIEVED');
  });

  it('limits fighter reads to the fighter profile owned by the actor', async () => {
    const fighter: AuthenticatedUser = { ...coach, role: USER.FIGHTER };
    repository.findActiveFighterIdByUserId.mockResolvedValue(fighterId);
    repository.findPage.mockResolvedValue({
      items: [],
      pageInfo: { hasNextPage: false, endCursor: null },
      total: 0,
    });

    await service.list(fighter, {
      fighterId: [],
      status: [],
      limit: 50,
    });

    expect(repository.findPage).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ fighterIds: [fighterId] }),
    );
  });

  it('returns an empty scope for a coach without an active coach profile', async () => {
    repository.findActiveCoachIdByUserId.mockResolvedValue(undefined);
    repository.findPage.mockResolvedValue({
      items: [],
      pageInfo: { hasNextPage: false, endCursor: null },
      total: 0,
    });

    await service.list(coach, { fighterId: [], status: [], limit: 50 });

    expect(repository.findPage).toHaveBeenCalledWith(expect.anything(), {
      fighterIds: [],
    });
  });

  it('loads list history in one batched repository call', async () => {
    const otherGoal = { ...storedGoal, id: fighterId };
    repository.findActiveCoachIdByUserId.mockResolvedValue(coachId);
    repository.findPage.mockResolvedValue({
      items: [storedGoal, otherGoal],
      pageInfo: { hasNextPage: false, endCursor: null },
      total: 2,
    });
    repository.findHistoryByGoalIds.mockResolvedValue(
      new Map([[goalId, [{ date: storedGoal.createdAt, value: 60 }]]]),
    );

    const page = await service.list(coach, {
      fighterId: [],
      status: [],
      limit: 50,
    });

    expect(repository.findHistoryByGoalIds).toHaveBeenCalledTimes(1);
    expect(repository.findHistoryByGoalIds).toHaveBeenCalledWith([
      goalId,
      otherGoal.id,
    ]);
    expect(repository.findHistory).not.toHaveBeenCalled();
    expect(page.items.map((item) => item.history.length)).toEqual([1, 0]);
  });
});
