import { describe, expect, it, vi, beforeEach } from 'vitest';
import { CoachingService } from './coaching.service.js';
import { type CreateAssignmentInput } from './coaching.model.js';

const coachId = '59d6ba46-32f2-4e67-b486-e966b2064328';
const fighterId = '516a01dc-f842-40e4-ae88-abca224921b7';
const planId = 'c13d7792-fbf9-4421-a4a4-e2ed8466b4a8';
const sessionId = 'f13d7792-fbf9-4421-a4a4-e2ed8466b4b1';

describe('CoachingService - createAssignment (contract unit test with mocked tx)', () => {
  let service: CoachingService;
  let mockDb: any;
  let mockTx: any;
  let insertedPlanValues: any;
  let insertedSessionValues: any;

  beforeEach(() => {
    insertedPlanValues = null;
    insertedSessionValues = null;

    mockTx = {
      select: vi.fn(),
      insert: vi.fn((_table: any) => ({
        values: vi.fn((vals: any) => {
          if (!insertedPlanValues) {
            insertedPlanValues = vals;
            return {
              returning: vi.fn().mockResolvedValue([
                {
                  id: planId,
                  ...vals,
                },
              ]),
            };
          } else {
            insertedSessionValues = vals;
            return {
              returning: vi.fn().mockResolvedValue([
                {
                  id: sessionId,
                  ...vals,
                },
              ]),
            };
          }
        }),
      })),
    };

    mockDb = {
      transaction: vi.fn(async (cb: (tx: any) => Promise<any>) => {
        return cb(mockTx);
      }),
      select: vi.fn(),
      insert: vi.fn(),
    };

    service = new CoachingService(mockDb);
    // Mock verifyCoachAuthorization and logAudit to focus on createAssignment persistence contract
    vi.spyOn(service, 'verifyCoachAuthorization').mockResolvedValue(undefined as any);
    vi.spyOn(service, 'logAudit').mockResolvedValue(undefined as any);
  });

  it.each(['base', 'build', 'fight_camp', 'taper', 'rehab', 'maintenance'] as const)(
    'inserts plan with phase %s and returns assignment details',
    async (phase) => {
      const dto: CreateAssignmentInput = {
        coachId,
        fighterId,
        title: 'Technique Mastery',
        phase,
      };

      const result = await service.createAssignment(dto as any);

      expect(service.verifyCoachAuthorization).toHaveBeenCalledWith(coachId, fighterId, mockTx);
      expect(insertedPlanValues).toMatchObject({
        fighterId,
        coachId,
        title: 'Plan for Technique Mastery',
        phase,
        status: 'ACTIVE',
      });
      expect(insertedSessionValues).toMatchObject({
        fighterId,
        planId,
        title: 'Technique Mastery',
        sessionType: 'SHADOW_BOXING',
        status: 'SCHEDULED',
      });
      expect(service.logAudit).toHaveBeenCalledWith(
        'CREATE_ASSIGNMENT',
        'training_sessions',
        sessionId,
        coachId,
        { planId, fighterId },
        mockTx,
      );
      expect(result).toEqual({
        planId,
        sessionId,
        title: 'Technique Mastery',
        status: 'SCHEDULED',
        scheduledAt: expect.any(Date),
      });
    },
  );

  it('honors custom sessionType when provided', async () => {
    const dto: CreateAssignmentInput = {
      coachId,
      fighterId,
      title: 'Heavy Bag Drills',
      phase: 'build',
      sessionType: 'BAG_WORK',
    };

    await service.createAssignment(dto as any);

    expect(insertedSessionValues.sessionType).toBe('BAG_WORK');
    expect(insertedPlanValues.phase).toBe('build');
  });
});
