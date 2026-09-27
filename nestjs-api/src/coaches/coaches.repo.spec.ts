import type { DatabaseExecutor } from '../shared/utils/audit-context.util.js';
import { CoachesRepository } from './coaches.repo.js';

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

describe('CoachesRepository unit tests', () => {
  const repo = new CoachesRepository(null as never);
  const coachId = 'c0ac4000-0000-4000-8000-000000000001';

  describe('isActiveCoach', () => {
    it('returns true when active, non-deleted coach profile exists', async () => {
      const mockDb = makeMockDb([{ id: coachId }]);
      const result = await repo.isActiveCoach(
        coachId,
        mockDb as unknown as DatabaseExecutor,
      );

      expect(mockDb.limit).toHaveBeenCalledWith(1);
      expect(result).toBe(true);
    });

    it('returns false when no active coach profile exists', async () => {
      const mockDb = makeMockDb([]);
      const result = await repo.isActiveCoach(
        coachId,
        mockDb as unknown as DatabaseExecutor,
      );

      expect(mockDb.limit).toHaveBeenCalledWith(1);
      expect(result).toBe(false);
    });
  });
});
