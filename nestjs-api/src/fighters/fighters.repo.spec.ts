import type { DatabaseExecutor } from '../shared/utils/audit-context.util.js';
import { FightersRepository } from './fighters.repo.js';

function makeMockDb(selectRows: unknown[] = []) {
  const limit = vi.fn().mockResolvedValue(selectRows);
  const where = vi.fn().mockReturnValue({ limit });
  const from = vi.fn().mockReturnValue({ where });
  const select = vi.fn().mockReturnValue({ from });

  return {
    select,
    from,
    where,
    limit,
  };
}

describe('FightersRepository unit tests', () => {
  const repo = new FightersRepository(null as never);
  const userId = '516a01dc-f842-40e4-ae88-abca224921b7';
  const fighterId = '59d6ba46-32f2-4e67-b486-e966b2064328';
  const coachId = 'c0ac4000-0000-4000-8000-000000000001';

  describe('findActiveCoachIdByUserId', () => {
    it('returns undefined when 0 rows match', async () => {
      const mockDb = makeMockDb([]);
      const result = await repo.findActiveCoachIdByUserId(
        userId,
        mockDb as unknown as DatabaseExecutor,
      );

      expect(mockDb.limit).toHaveBeenCalledWith(2);
      expect(result).toBeUndefined();
    });

    it('returns coach id when exactly 1 unambiguous active row matches', async () => {
      const mockDb = makeMockDb([{ id: coachId }]);
      const result = await repo.findActiveCoachIdByUserId(
        userId,
        mockDb as unknown as DatabaseExecutor,
      );

      expect(result).toBe(coachId);
    });

    it('returns undefined (fails closed) when multiple (2) rows match', async () => {
      const mockDb = makeMockDb([
        { id: coachId },
        { id: 'c0ac4000-0000-4000-8000-000000000002' },
      ]);
      const result = await repo.findActiveCoachIdByUserId(
        userId,
        mockDb as unknown as DatabaseExecutor,
      );

      expect(result).toBeUndefined();
    });
  });

  describe('isFighterAssignedToCoach', () => {
    it('returns true when an active assignment row exists', async () => {
      const mockDb = makeMockDb([{ id: 'assignment-id' }]);
      const result = await repo.isFighterAssignedToCoach(
        coachId,
        fighterId,
        mockDb as unknown as DatabaseExecutor,
      );

      expect(result).toBe(true);
    });

    it('returns false when no active assignment row exists', async () => {
      const mockDb = makeMockDb([]);
      const result = await repo.isFighterAssignedToCoach(
        coachId,
        fighterId,
        mockDb as unknown as DatabaseExecutor,
      );

      expect(result).toBe(false);
    });
  });
});
