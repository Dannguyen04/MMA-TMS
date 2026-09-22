import { Test, type TestingModule } from '@nestjs/testing';
import type { Mocked } from 'vitest';
import type { AuthenticatedUser } from '../shared/models/auth-context.model.js';
import { USER } from '../shared/types/user.role.js';
import { PerformanceRepository } from './performance.repo.js';
import { PerformanceService } from './performance.service.js';

const fighterId = 'c61e6859-4a4e-4313-b762-9343270153f5';
const actor: AuthenticatedUser = {
  id: '516a01dc-f842-40e4-ae88-abca224921b7',
  authSubject: 'fighter-subject',
  email: 'fighter@example.test',
  role: USER.FIGHTER,
};

function repositoryMock() {
  return {
    findActiveFighterIdByUserId: vi.fn(),
    isCoachAssignedToFighter: vi.fn(),
    isDoctorAssignedToFighter: vi.fn(),
    findHistory: vi.fn(),
  };
}

describe('PerformanceService', () => {
  let service: PerformanceService;
  let repo: Mocked<PerformanceRepository>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PerformanceService,
        { provide: PerformanceRepository, useValue: repositoryMock() },
      ],
    }).compile();
    service = module.get(PerformanceService);
    repo = module.get(PerformanceRepository);
    repo.findActiveFighterIdByUserId.mockResolvedValue(fighterId);
  });

  it('returns null summary when normalized performance history is empty', async () => {
    repo.findHistory.mockResolvedValue([]);

    await expect(service.getSummary(actor, fighterId)).resolves.toBeNull();
  });

  it('computes the weighted summary from persisted weekly metrics', async () => {
    repo.findHistory.mockResolvedValue([
      {
        id: `${fighterId}:2026-09-07`,
        fighterId,
        weekStart: '2026-09-07T00:00:00.000Z',
        scores: {
          jab: 70,
          cross: 70,
          hook: 70,
          kick: 70,
          combination: 70,
          footwork: 70,
          guard: 70,
          head_movement: 70,
        },
        strikeCounts: { jab: 30, cross: 30, hook: 30, kick: 30 },
        combinations: 0,
        sessionsCompleted: 2,
        trainingMinutes: 120,
        avgRpe: 7,
        avgPunchSpeed: 1,
        avgKickSpeed: 1,
        guardUptimePct: 70,
        headMovementsPerMin: 0,
      },
    ]);

    await expect(service.getSummary(actor, fighterId)).resolves.toMatchObject({
      overall: 70,
      overallDelta: 0,
      strongest: 'jab',
      weakest: 'head_movement',
      trend: 'steady',
    });
  });

  it('measures technique change against the weeks before the latest complete week', async () => {
    const week = 7 * 86_400_000;
    const currentWeek = Date.now() - 86_400_000;
    const jabScores = [40, 50, 50, 50, 50, 70, 99];
    repo.findHistory.mockResolvedValue(
      jabScores.map((jab, index) => {
        const weekStart = new Date(
          currentWeek - (jabScores.length - 1 - index) * week,
        ).toISOString();
        return {
          id: `${fighterId}:${weekStart.slice(0, 10)}`,
          fighterId,
          weekStart,
          scores: {
            jab,
            cross: 0,
            hook: 0,
            kick: 0,
            combination: 0,
            footwork: 0,
            guard: 0,
            head_movement: 0,
          },
          strikeCounts: { jab: 1, cross: 0, hook: 0, kick: 0 },
          combinations: 0,
          sessionsCompleted: 1,
          trainingMinutes: 60,
          avgRpe: 6,
          avgPunchSpeed: 0,
          avgKickSpeed: 0,
          guardUptimePct: 0,
          headMovementsPerMin: 0,
        };
      }),
    );

    await expect(
      service.getTechnique(actor, fighterId, 'jab'),
    ).resolves.toMatchObject({ latestScore: 70, change4w: 20 });
  });
});
