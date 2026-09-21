import type { DatabaseExecutor } from '../shared/utils/audit-context.util.js';
import { TrainingRepository } from './training.repo.js';
import type { SessionStatusType } from './training.model.js';

function makeMockDb(returnRows: unknown[] = []) {
  const returning = vi.fn().mockResolvedValue(returnRows);
  const where = vi.fn().mockReturnValue({ returning });
  const set = vi.fn().mockReturnValue({ where });
  const update = vi.fn().mockReturnValue({ set });

  return {
    update,
    set,
    where,
    returning,
  };
}

describe('TrainingRepository', () => {
  const sessionId = '51c38f60-0f4e-48aa-848b-20f5ef828f57';
  const now = new Date('2026-09-20T10:00:00.000Z');

  describe('updateSessionStatus lifecycle and timestamp management', () => {
    it.each([
      {
        newStatus: 'COMPLETED' as SessionStatusType,
        expectedTerminal: 'completedAt',
        clearedTerminals: ['cancelledAt', 'skippedAt', 'abandonedAt'],
      },
      {
        newStatus: 'CANCELLED' as SessionStatusType,
        expectedTerminal: 'cancelledAt',
        clearedTerminals: ['completedAt', 'skippedAt', 'abandonedAt'],
      },
      {
        newStatus: 'SKIPPED' as SessionStatusType,
        expectedTerminal: 'skippedAt',
        clearedTerminals: ['completedAt', 'cancelledAt', 'abandonedAt'],
      },
      {
        newStatus: 'ABANDONED' as SessionStatusType,
        expectedTerminal: 'abandonedAt',
        clearedTerminals: ['completedAt', 'cancelledAt', 'skippedAt'],
      },
    ])(
      'sets exactly $expectedTerminal and clears the other three for $newStatus',
      async ({ newStatus, expectedTerminal, clearedTerminals }) => {
        const mockDb = makeMockDb([
          {
            id: sessionId,
            fighterId: 'c61e6859-4a4e-4313-b762-9343270153f5',
            coachId: null,
            planId: null,
            title: 'Session',
            scheduledAt: now,
            plannedDurationSec: 3600,
            actualDurationSec: 1800,
            roundCount: 3,
            location: null,
            sessionType: 'PAD_WORK',
            status: newStatus,
            coachNotes: null,
            cancellationReason: newStatus === 'CANCELLED' ? 'Rain' : null,
            checkedInAt: now,
            completedAt: newStatus === 'COMPLETED' ? now : null,
            abandonedAt: newStatus === 'ABANDONED' ? now : null,
            skippedAt: newStatus === 'SKIPPED' ? now : null,
            cancelledAt: newStatus === 'CANCELLED' ? now : null,
            reportedRpe: null,
            isActive: true,
            createdAt: now,
            updatedAt: now,
            deletedAt: null,
          },
        ]);

        const repo = new TrainingRepository(mockDb as unknown as never);
        const outcome = {
          cancellationReason: newStatus === 'CANCELLED' ? 'Rain' : null,
          actualDurationSec: 1800,
        };

        await repo.updateSessionStatus(
          sessionId,
          'IN_PROGRESS',
          newStatus,
          now,
          outcome,
          mockDb as unknown as DatabaseExecutor,
        );

        expect(mockDb.set).toHaveBeenCalledTimes(1);
        const updatePayload = mockDb.set.mock.calls[0][0];

        expect(updatePayload.status).toBe(newStatus);
        expect(updatePayload[expectedTerminal]).toEqual(now);
        for (const cleared of clearedTerminals) {
          expect(updatePayload[cleared]).toBeNull();
        }
        expect(updatePayload.cancellationReason).toBe(outcome.cancellationReason);
        expect(updatePayload.actualDurationSec).toBe(1800);
      },
    );

    it('preserves checkedInAt on IN_PROGRESS -> CANCELLED (checkedInAt is not overwritten)', async () => {
      const mockDb = makeMockDb([
        {
          id: sessionId,
          fighterId: 'c61e6859-4a4e-4313-b762-9343270153f5',
          coachId: null,
          planId: null,
          title: 'Session',
          scheduledAt: now,
          plannedDurationSec: 3600,
          actualDurationSec: 600,
          roundCount: 3,
          location: null,
          sessionType: 'PAD_WORK',
          status: 'CANCELLED',
          coachNotes: null,
          cancellationReason: 'Injury',
          checkedInAt: now,
          completedAt: null,
          abandonedAt: null,
          skippedAt: null,
          cancelledAt: now,
          reportedRpe: null,
          isActive: true,
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
        },
      ]);

      const repo = new TrainingRepository(mockDb as unknown as never);
      const outcome = {
        cancellationReason: 'Injury',
        actualDurationSec: 600,
      };

      await repo.updateSessionStatus(
        sessionId,
        'IN_PROGRESS',
        'CANCELLED',
        now,
        outcome,
        mockDb as unknown as DatabaseExecutor,
      );

      const updatePayload = mockDb.set.mock.calls[0][0];
      // checkedInAt must NOT be set to null or modified when transitioning to CANCELLED
      expect(updatePayload).not.toHaveProperty('checkedInAt');
      expect(updatePayload.cancelledAt).toEqual(now);
    });

    it('sets checkedInAt to now on SCHEDULED -> IN_PROGRESS', async () => {
      const mockDb = makeMockDb([
        {
          id: sessionId,
          fighterId: 'c61e6859-4a4e-4313-b762-9343270153f5',
          coachId: null,
          planId: null,
          title: 'Session',
          scheduledAt: now,
          plannedDurationSec: 3600,
          actualDurationSec: null,
          roundCount: 3,
          location: null,
          sessionType: 'PAD_WORK',
          status: 'IN_PROGRESS',
          coachNotes: null,
          cancellationReason: null,
          checkedInAt: now,
          completedAt: null,
          abandonedAt: null,
          skippedAt: null,
          cancelledAt: null,
          reportedRpe: null,
          isActive: true,
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
        },
      ]);

      const repo = new TrainingRepository(mockDb as unknown as never);
      const outcome = { cancellationReason: null, actualDurationSec: null };

      await repo.updateSessionStatus(
        sessionId,
        'SCHEDULED',
        'IN_PROGRESS',
        now,
        outcome,
        mockDb as unknown as DatabaseExecutor,
      );

      const updatePayload = mockDb.set.mock.calls[0][0];
      expect(updatePayload.checkedInAt).toEqual(now);
    });

    it('clears checkedInAt when transitioning to SCHEDULED', async () => {
      const mockDb = makeMockDb([
        {
          id: sessionId,
          fighterId: 'c61e6859-4a4e-4313-b762-9343270153f5',
          coachId: null,
          planId: null,
          title: 'Session',
          scheduledAt: now,
          plannedDurationSec: 3600,
          actualDurationSec: null,
          roundCount: 3,
          location: null,
          sessionType: 'PAD_WORK',
          status: 'SCHEDULED',
          coachNotes: null,
          cancellationReason: null,
          checkedInAt: null,
          completedAt: null,
          abandonedAt: null,
          skippedAt: null,
          cancelledAt: null,
          reportedRpe: null,
          isActive: true,
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
        },
      ]);

      const repo = new TrainingRepository(mockDb as unknown as never);
      const outcome = { cancellationReason: null, actualDurationSec: null };

      await repo.updateSessionStatus(
        sessionId,
        'IN_PROGRESS',
        'SCHEDULED',
        now,
        outcome,
        mockDb as unknown as DatabaseExecutor,
      );

      const updatePayload = mockDb.set.mock.calls[0][0];
      expect(updatePayload.checkedInAt).toBeNull();
    });
  });
});
