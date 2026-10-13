import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  type HttpException,
} from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import type { Mocked } from 'vitest';
import {
  NOTIFICATION_PUBLISHER,
  type NotificationPublisher,
  type NotifyInput,
} from '../shared/contracts/notification.contract.js';
import type { AuthenticatedUser } from '../shared/models/auth-context.model.js';
import { USER } from '../shared/types/user.role.js';
import { GoalsRepository, type GoalRow } from './goals.repo.js';
import { GoalsService } from './goals.service.js';

const fighterUserId = '516a01dc-f842-40e4-ae88-abca224921b7';
const coachUserId = '59d6ba46-32f2-4e67-b486-e966b2064328';
const adminUserId = 'e069ca8a-d0f1-44da-8bd5-48a60bf44b99';
const doctorUserId = '3a119889-e544-4c66-938a-4c511b184baa';
const fighterId = 'c61e6859-4a4e-4313-b762-9343270153f5';
const otherFighterId = 'a481035b-961c-4411-995d-2bd576fbb749';
const coachId = '88f97dd5-8f68-45bf-81db-4a778d30853a';
const otherCoachId = '1b0e7a35-60a4-4b55-9d0f-2f4cdb7d6a11';
const goalId = '07fe1247-ac7a-4832-9fff-77f6effa35cb';
const requestId = '6f1d1d5b-8b7e-4c1e-9b2f-8a1c1e2d3f40';

const actor = (id: string, role: AuthenticatedUser['role']): AuthenticatedUser => ({
  id,
  authSubject: `${role.toLowerCase()}-subject`,
  email: `${role.toLowerCase()}@example.com`,
  role,
});
const fighterActor = actor(fighterUserId, USER.FIGHTER);
const coachActor = actor(coachUserId, USER.COACH);
const doctorActor = actor(doctorUserId, USER.DOCTOR);
const adminActor = actor(adminUserId, USER.ADMIN);

/** 07:00 on academy day 2026-09-06, a little past the middle of the default goal. */
const NOW = new Date('2026-09-06T00:00:00.000Z');

function goalRow(overrides: Partial<GoalRow> = {}): GoalRow {
  return {
    id: goalId,
    fighterId,
    coachId,
    title: 'Jab speed',
    technique: 'JAB',
    metricLabel: 'Peak speed',
    unit: 'm/s',
    lowerIsBetter: false,
    baseline: 6,
    target: 8,
    current: 6,
    startDate: '2026-09-01',
    dueDate: '2026-09-10',
    status: 'ON_TRACK',
    history: [{ date: '2026-09-01T02:00:00.000Z', value: 6 }],
    createdAt: new Date('2026-09-01T02:00:00.000Z'),
    updatedAt: new Date('2026-09-01T02:00:00.000Z'),
    deletedAt: null,
    ...overrides,
  };
}

function repositoryMock() {
  const tx = { execute: vi.fn().mockResolvedValue(undefined) };
  return {
    tx,
    transaction: vi.fn((work: (transaction: unknown) => Promise<unknown>) => work(tx)),
    findActiveFighterIdByUserId: vi.fn(),
    findActiveCoachIdByUserId: vi.fn(),
    isFighterActive: vi.fn(),
    isCoachAssignedToFighter: vi.fn(),
    isCoachUserAssignedToFighter: vi.fn(),
    isDoctorUserAssignedToFighter: vi.fn(),
    findParticipantUserIds: vi.fn(),
    findGoals: vi.fn(),
    findGoalById: vi.fn(),
    lockGoalById: vi.fn(),
    insertGoal: vi.fn(),
    updateGoal: vi.fn(),
    deleteGoal: vi.fn(),
  };
}

/** Applies defined changes to a stored row, as the database update would. */
function applied(row: GoalRow, changes: Partial<GoalRow>): GoalRow {
  return {
    ...row,
    ...Object.fromEntries(Object.entries(changes).filter(([, value]) => value !== undefined)),
  };
}

function codeOf(error: unknown): unknown {
  return ((error as HttpException).getResponse() as Record<string, unknown>).code;
}

describe('GoalsService', () => {
  let service: GoalsService;
  let repo: Mocked<GoalsRepository> & { tx: { execute: ReturnType<typeof vi.fn> } };
  let notifications: Mocked<NotificationPublisher>;

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GoalsService,
        { provide: GoalsRepository, useValue: repositoryMock() },
        {
          provide: NOTIFICATION_PUBLISHER,
          useValue: {
            notify: vi.fn().mockResolvedValue({ status: 'queued' }),
            notifyResolved: vi.fn().mockResolvedValue([{ status: 'queued' }]),
          },
        },
      ],
    }).compile();

    service = module.get(GoalsService);
    repo = module.get(GoalsRepository) as typeof repo;
    notifications = module.get(NOTIFICATION_PUBLISHER);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /** Runs the resolver passed to the n-th notifyResolved call. */
  async function resolvedNotifications(call = 0): Promise<readonly NotifyInput[]> {
    return notifications.notifyResolved.mock.calls[call][0]();
  }

  describe('listGoals', () => {
    const baseQuery = { limit: 100 };

    it('forces a fighter to their own goals', async () => {
      repo.findActiveFighterIdByUserId.mockResolvedValue(fighterId);
      repo.findGoals.mockResolvedValue([]);

      await service.listGoals(fighterActor, baseQuery);

      expect(repo.findGoals).toHaveBeenCalledWith(
        { fighterIds: [fighterId] },
        { coachId: undefined, technique: undefined },
        2001,
      );
    });

    it('returns nothing when a fighter only asks for other fighters', async () => {
      repo.findActiveFighterIdByUserId.mockResolvedValue(fighterId);

      await expect(
        service.listGoals(fighterActor, { ...baseQuery, fighterId: [otherFighterId] }),
      ).resolves.toEqual({
        items: [],
        pageInfo: { hasNextPage: false, endCursor: null },
        total: 0,
      });
      expect(repo.findGoals).not.toHaveBeenCalled();
    });

    it('denies a fighter account without an active profile', async () => {
      repo.findActiveFighterIdByUserId.mockResolvedValue(undefined);
      await expect(service.listGoals(fighterActor, baseQuery)).rejects.toThrow(ForbiddenException);
    });

    it('scopes coaches and doctors by their current assignments, keeping requested fighters', async () => {
      repo.findGoals.mockResolvedValue([]);

      await service.listGoals(coachActor, { ...baseQuery, fighterId: [fighterId] });
      await service.listGoals(doctorActor, baseQuery);
      await service.listGoals(adminActor, { ...baseQuery, coachId, technique: 'JAB' });

      expect(repo.findGoals.mock.calls.map((call) => call.slice(0, 2))).toEqual([
        [{ fighterIds: [fighterId], assignedCoachUserId: coachUserId }, { coachId: undefined, technique: undefined }],
        [{ fighterIds: undefined, assignedDoctorUserId: doctorUserId }, { coachId: undefined, technique: undefined }],
        [{ fighterIds: undefined }, { coachId, technique: 'JAB' }],
      ]);
    });

    it('refuses an oversized scope instead of truncating it', async () => {
      repo.findGoals.mockResolvedValue(Array.from({ length: 2001 }, () => goalRow()));
      await expect(service.listGoals(adminActor, baseQuery)).rejects.toSatisfy(
        (error) => codeOf(error) === 'GOAL_SCOPE_TOO_LARGE',
      );
    });

    it('orders by urgency then due date, filters by derived status and pages with a cursor', async () => {
      const id = (n: number) => `00000000-0000-4000-8000-00000000000${n}`;
      repo.findGoals.mockResolvedValue([
        // The stored status is a stale snapshot; the derived one wins.
        goalRow({ id: id(1), current: 8, status: 'AT_RISK' }), // achieved
        goalRow({ id: id(2), current: 6.2 }), // expected ≈ +1.06 by now → at risk
        goalRow({ id: id(3), current: 7.5, dueDate: '2026-09-20' }), // on track
        goalRow({ id: id(4), dueDate: '2026-09-05' }), // missed
        goalRow({ id: id(5), current: 7.5 }), // on track, due before id(3)
      ]);

      const first = await service.listGoals(adminActor, { limit: 2 });
      expect(first.items.map((goal) => [goal.id, goal.status])).toEqual([
        [id(2), 'AT_RISK'],
        [id(5), 'ON_TRACK'],
      ]);
      expect(first).toMatchObject({ total: 5, pageInfo: { hasNextPage: true } });
      expect(first.items[0]).toMatchObject({
        startDate: '2026-08-31T17:00:00.000Z',
        dueDate: '2026-09-10T16:59:59.999Z',
        history: [{ date: '2026-09-01T02:00:00.000Z', value: 6 }],
      });

      const second = await service.listGoals(adminActor, { limit: 2, cursor: first.pageInfo.endCursor! });
      expect(second.items.map((goal) => goal.id)).toEqual([id(3), id(1)]);

      const last = await service.listGoals(adminActor, { limit: 2, cursor: second.pageInfo.endCursor! });
      expect(last.items.map((goal) => goal.id)).toEqual([id(4)]);
      expect(last.pageInfo).toEqual({ hasNextPage: false, endCursor: null });

      const urgent = await service.listGoals(adminActor, { limit: 100, status: ['AT_RISK', 'MISSED'] });
      expect(urgent.items.map((goal) => goal.id)).toEqual([id(2), id(4)]);
      expect(urgent.total).toBe(2);
    });

    it('rejects a cursor it did not issue', async () => {
      repo.findGoals.mockResolvedValue([goalRow()]);
      await expect(
        service.listGoals(adminActor, { limit: 10, cursor: 'not-a-cursor' }),
      ).rejects.toSatisfy((error) => codeOf(error) === 'INVALID_GOAL_CURSOR');
    });
  });

  describe('getGoal', () => {
    it('hides a goal outside the scope as not found', async () => {
      repo.findGoalById.mockResolvedValue(goalRow());
      repo.isCoachUserAssignedToFighter.mockResolvedValue(false);
      await expect(service.getGoal(coachActor, goalId)).rejects.toThrow(NotFoundException);

      repo.findActiveFighterIdByUserId.mockResolvedValue(otherFighterId);
      await expect(service.getGoal(fighterActor, goalId)).rejects.toThrow(NotFoundException);
    });

    it('returns the goal with its derived status to an assigned doctor', async () => {
      repo.findGoalById.mockResolvedValue(goalRow({ current: 7 }));
      repo.isDoctorUserAssignedToFighter.mockResolvedValue(true);

      await expect(service.getGoal(doctorActor, goalId)).resolves.toMatchObject({
        id: goalId,
        baseline: 6,
        target: 8,
        current: 7,
        status: 'ON_TRACK',
      });
    });
  });

  describe('createGoal', () => {
    const input = {
      fighterId,
      coachId,
      title: 'Jab speed',
      technique: 'JAB' as const,
      metricLabel: 'Peak speed',
      unit: 'm/s',
      lowerIsBetter: false,
      baseline: 6,
      target: 8,
      startDate: '2026-09-01',
      dueDate: '2026-09-10',
    };

    beforeEach(() => {
      repo.isFighterActive.mockResolvedValue(true);
      repo.isCoachUserAssignedToFighter.mockResolvedValue(true);
      repo.findActiveCoachIdByUserId.mockResolvedValue(coachId);
      repo.isCoachAssignedToFighter.mockResolvedValue(true);
      repo.insertGoal.mockImplementation(async (values) => goalRow(values));
      repo.findParticipantUserIds.mockResolvedValue([fighterUserId]);
    });

    it('stores the starting value as the first checkpoint, audits and notifies the fighter', async () => {
      const goal = await service.createGoal(coachActor, input, requestId);

      expect(repo.tx.execute).toHaveBeenCalledOnce();
      expect(repo.insertGoal).toHaveBeenCalledWith(
        expect.objectContaining({
          current: 6,
          startDate: '2026-09-01',
          dueDate: '2026-09-10',
          status: 'AT_RISK',
          history: [{ date: NOW.toISOString(), value: 6 }],
        }),
        repo.tx,
      );
      expect(goal).toMatchObject({ status: 'AT_RISK', history: [{ value: 6 }] });

      await expect(resolvedNotifications()).resolves.toEqual([
        expect.objectContaining({
          recipientUserIds: [fighterUserId],
          actorUserId: coachUserId,
          type: 'GOAL_SET',
          target: { type: 'GOAL', id: goalId },
          dedupeKey: `goal:${goalId}:set`,
        }),
      ]);
      expect(repo.findParticipantUserIds).toHaveBeenCalledWith(fighterId, null);
    });

    it('uses the measured value when one is given', async () => {
      await service.createGoal(adminActor, { ...input, current: 7 }, requestId);
      expect(repo.insertGoal).toHaveBeenCalledWith(
        expect.objectContaining({ current: 7, history: [{ date: NOW.toISOString(), value: 7 }] }),
        repo.tx,
      );
    });

    it('rejects fighters and doctors even with the permission granted', async () => {
      await expect(service.createGoal(fighterActor, input, requestId)).rejects.toThrow(ForbiddenException);
      await expect(service.createGoal(doctorActor, input, requestId)).rejects.toThrow(ForbiddenException);
      expect(repo.transaction).not.toHaveBeenCalled();
    });

    it('accepts a goal due today and rejects one due yesterday', async () => {
      await expect(
        service.createGoal(coachActor, { ...input, startDate: '2026-09-05', dueDate: '2026-09-06' }, requestId),
      ).resolves.toBeDefined();
      await expect(
        service.createGoal(coachActor, { ...input, dueDate: '2026-09-05' }, requestId),
      ).rejects.toSatisfy((error) => codeOf(error) === 'GOAL_DUE_DATE_IN_PAST');
    });

    it('rejects an inactive fighter', async () => {
      repo.isFighterActive.mockResolvedValue(false);
      await expect(service.createGoal(coachActor, input, requestId)).rejects.toSatisfy(
        (error) => codeOf(error) === 'GOAL_FIGHTER_NOT_FOUND',
      );
    });

    it('rejects a coach who does not coach the fighter', async () => {
      repo.isCoachUserAssignedToFighter.mockResolvedValue(false);
      await expect(service.createGoal(coachActor, input, requestId)).rejects.toThrow(ForbiddenException);
      expect(repo.insertGoal).not.toHaveBeenCalled();
    });

    it('lets a coach set goals only in their own name', async () => {
      await expect(
        service.createGoal(coachActor, { ...input, coachId: otherCoachId }, requestId),
      ).rejects.toThrow(ForbiddenException);
    });

    it('requires the named coach to be assigned to the fighter', async () => {
      repo.isCoachAssignedToFighter.mockResolvedValue(false);
      await expect(service.createGoal(adminActor, input, requestId)).rejects.toSatisfy(
        (error) => codeOf(error) === 'GOAL_COACH_NOT_ASSIGNED',
      );
    });
  });

  describe('updateGoal', () => {
    beforeEach(() => {
      repo.lockGoalById.mockResolvedValue(goalRow());
      repo.isCoachUserAssignedToFighter.mockResolvedValue(true);
      repo.updateGoal.mockImplementation(async (_id, changes) => applied(goalRow(), changes));
    });

    it('checks cross-field rules against the stored goal', async () => {
      await expect(
        service.updateGoal(coachActor, goalId, { target: 5 }, requestId),
      ).rejects.toSatisfy((error) => codeOf(error) === 'INVALID_GOAL_TARGET');
      await expect(
        service.updateGoal(coachActor, goalId, { dueDate: '2026-09-01' }, requestId),
      ).rejects.toSatisfy((error) => codeOf(error) === 'INVALID_GOAL_DATE_RANGE');
      expect(repo.updateGoal).not.toHaveBeenCalled();
    });

    it('accepts a direction flip consistent with the new target and refreshes the status snapshot', async () => {
      await service.updateGoal(adminActor, goalId, { lowerIsBetter: true, target: 4 }, requestId);
      expect(repo.updateGoal).toHaveBeenCalledWith(
        goalId,
        expect.objectContaining({ lowerIsBetter: true, target: 4, status: 'AT_RISK' }),
        repo.tx,
      );
    });

    it('hides goals of fighters the coach does not coach', async () => {
      repo.isCoachUserAssignedToFighter.mockResolvedValue(false);
      await expect(
        service.updateGoal(coachActor, goalId, { title: 'New title' }, requestId),
      ).rejects.toThrow(NotFoundException);
    });

    it('validates a change of coach', async () => {
      repo.findActiveCoachIdByUserId.mockResolvedValue(coachId);
      await expect(
        service.updateGoal(coachActor, goalId, { coachId: otherCoachId }, requestId),
      ).rejects.toThrow(ForbiddenException);

      repo.isCoachAssignedToFighter.mockResolvedValue(true);
      await service.updateGoal(adminActor, goalId, { coachId: otherCoachId }, requestId);
      expect(repo.isCoachAssignedToFighter).toHaveBeenCalledWith(otherCoachId, fighterId, repo.tx);
    });
  });

  describe('logProgress', () => {
    beforeEach(() => {
      repo.isCoachUserAssignedToFighter.mockResolvedValue(true);
      repo.updateGoal.mockImplementation(async (_id, changes) => applied(goalRow(), changes));
      repo.findParticipantUserIds.mockResolvedValue([fighterUserId, coachUserId]);
    });

    it('appends a checkpoint, and notifies fighter and coach when the target is first reached', async () => {
      repo.lockGoalById.mockResolvedValue(goalRow({ current: 7 }));

      const goal = await service.logProgress(coachActor, goalId, 8.1, requestId);

      expect(goal.status).toBe('ACHIEVED');
      expect(repo.updateGoal).toHaveBeenCalledWith(
        goalId,
        {
          current: 8.1,
          status: 'ACHIEVED',
          history: [
            { date: '2026-09-01T02:00:00.000Z', value: 6 },
            { date: NOW.toISOString(), value: 8.1 },
          ],
        },
        repo.tx,
      );
      await expect(resolvedNotifications()).resolves.toEqual([
        expect.objectContaining({
          type: 'GOAL_ACHIEVED',
          dedupeKey: `goal:${goalId}:achieved:${NOW.toISOString()}`,
        }),
      ]);
      expect(repo.findParticipantUserIds).toHaveBeenCalledWith(fighterId, coachId);
    });

    it('replaces a checkpoint taken earlier the same academy day', async () => {
      // 2026-09-05T18:00Z is 01:00 on academy day 2026-09-06, the same day as NOW.
      repo.lockGoalById.mockResolvedValue(
        goalRow({ history: [{ date: '2026-09-05T18:00:00.000Z', value: 6.5 }] }),
      );
      await service.logProgress(coachActor, goalId, 7, requestId);
      expect(repo.updateGoal).toHaveBeenCalledWith(
        goalId,
        expect.objectContaining({ history: [{ date: NOW.toISOString(), value: 7 }] }),
        repo.tx,
      );
    });

    it('does not notify again when the goal was already achieved', async () => {
      repo.lockGoalById.mockResolvedValue(goalRow({ current: 8 }));
      await service.logProgress(coachActor, goalId, 8.5, requestId);
      expect(notifications.notifyResolved).not.toHaveBeenCalled();
    });

    it('reports a missing goal as not found', async () => {
      repo.lockGoalById.mockResolvedValue(undefined);
      await expect(service.logProgress(adminActor, goalId, 7, requestId)).rejects.toThrow(NotFoundException);
      expect(repo.updateGoal).not.toHaveBeenCalled();
    });
  });

  describe('deleteGoal', () => {
    it('soft-deletes a managed goal and returns null', async () => {
      repo.lockGoalById.mockResolvedValue(goalRow());
      repo.isCoachUserAssignedToFighter.mockResolvedValue(true);
      repo.deleteGoal.mockResolvedValue(goalId);

      await expect(service.deleteGoal(coachActor, goalId, requestId)).resolves.toBeNull();
      expect(repo.deleteGoal).toHaveBeenCalledWith(goalId, repo.tx);
      expect(repo.tx.execute).toHaveBeenCalledOnce();
    });

    it('rejects fighters before touching the database', async () => {
      await expect(service.deleteGoal(fighterActor, goalId, requestId)).rejects.toThrow(ForbiddenException);
      expect(repo.transaction).not.toHaveBeenCalled();
    });
  });

  it('maps a database check violation to a stable error', async () => {
    repo.findGoalById.mockRejectedValue(Object.assign(new Error('boom'), { code: '23514' }));
    await expect(service.getGoal(adminActor, goalId)).rejects.toThrow(BadRequestException);
  });
});
