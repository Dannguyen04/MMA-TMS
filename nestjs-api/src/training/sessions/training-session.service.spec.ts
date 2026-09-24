import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  type HttpException,
} from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import type { Mocked } from 'vitest';
import type { AuthenticatedUser } from '../../shared/models/auth-context.model.js';
import { USER } from '../../shared/types/user.role.js';
import type {
  TrainingPlanEntity,
  TrainingSessionEntity,
} from '../training.model.js';
import { TrainingRepository } from '../training.repo.js';
import { TrainingAccessService } from '../training-access.service.js';
import { TrainingSessionService } from './training-session.service.js';

const fighterUserId = '516a01dc-f842-40e4-ae88-abca224921b7';
const coachUserId = '59d6ba46-32f2-4e67-b486-e966b2064328';
const adminUserId = 'e069ca8a-d0f1-44da-8bd5-48a60bf44b99';
const doctorUserId = '3a119889-e544-4c66-938a-4c511b184baa';
const fighterId = 'c61e6859-4a4e-4313-b762-9343270153f5';
const otherFighterId = 'a481035b-961c-4411-995d-2bd576fbb749';
const coachId = '88f97dd5-8f68-45bf-81db-4a778d30853a';
const planId = '07fe1247-ac7a-4832-9fff-77f6effa35cb';
const sessionId = '51c38f60-0f4e-48aa-848b-20f5ef828f57';
const now = '2026-09-17T10:00:00.000Z';

const fighterActor: AuthenticatedUser = {
  id: fighterUserId,
  authSubject: 'fighter-subject',
  email: 'fighter@example.com',
  role: USER.FIGHTER,
};
const coachActor: AuthenticatedUser = {
  id: coachUserId,
  authSubject: 'coach-subject',
  email: 'coach@example.com',
  role: USER.COACH,
};
const doctorActor: AuthenticatedUser = {
  id: doctorUserId,
  authSubject: 'doctor-subject',
  email: 'doctor@example.com',
  role: USER.DOCTOR,
};
const adminActor: AuthenticatedUser = {
  id: adminUserId,
  authSubject: 'admin-subject',
  email: 'admin@example.com',
  role: USER.ADMIN,
};

const plan: TrainingPlanEntity = {
  id: planId,
  fighterId,
  coachId,
  title: 'Fight camp',
  description: null,
  startDate: '2026-09-20',
  endDate: null,
  status: 'DRAFT',
  goals: null,
  milestones: [],
  isActive: true,
  createdAt: now,
  updatedAt: now,
  deletedAt: null,
};

const session: TrainingSessionEntity = {
  id: sessionId,
  fighterId,
  coachId,
  planId,
  title: 'Pad work',
  scheduledAt: now,
  plannedDurationSec: 3600,
  actualDurationSec: null,
  roundCount: 5,
  location: null,
  sessionType: 'PAD_WORK',
  status: 'SCHEDULED',
  coachNotes: null,
  cancellationReason: null,
  checkedInAt: null,
  completedAt: null,
  abandonedAt: null,
  skippedAt: null,
  reportedRpe: null,
  isActive: true,
  createdAt: now,
  updatedAt: now,
  deletedAt: null,
  cancelledAt: null,
};

function repositoryMock() {
  return {
    findActiveFighterIdByUserId: vi.fn(),
    findActiveCoachIdByUserId: vi.fn(),
    findActiveDoctorIdByUserId: vi.fn(),
    isCoachAssignedToFighter: vi.fn(),
    isDoctorAssignedToFighter: vi.fn(),
    isCoachProfileOwnedByUser: vi.fn(),
    findPlanById: vi.fn(),
    findSessions: vi.fn(),
    findSessionById: vi.fn(),
    createSession: vi.fn(),
    updateSession: vi.fn(),
    updateSessionStatus: vi.fn(),
  };
}

function responseOf(error: unknown): Record<string, unknown> {
  return (error as HttpException).getResponse() as Record<string, unknown>;
}

describe('TrainingSessionService', () => {
  let service: TrainingSessionService;
  let repo: Mocked<TrainingRepository>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TrainingSessionService,
        TrainingAccessService,
        { provide: TrainingRepository, useValue: repositoryMock() },
      ],
    }).compile();

    service = module.get(TrainingSessionService);
    repo = module.get<Mocked<TrainingRepository>>(TrainingRepository);
  });

  describe('listSessions scoping', () => {
    it('forces fighter list queries to the authenticated active profile', async () => {
      repo.findActiveFighterIdByUserId.mockResolvedValue(fighterId);
      repo.findSessions.mockResolvedValue({ data: [], total: 0 });

      await service.listSessions(fighterActor, {
        page: 1,
        limit: 20,
        fighterId: otherFighterId,
      });

      expect(repo.findSessions).toHaveBeenCalledWith(
        { page: 1, limit: 20, fighterId },
        { activeCoachId: undefined },
      );
    });

    it('denies fighter list query when fighter has no active profile', async () => {
      repo.findActiveFighterIdByUserId.mockResolvedValue(undefined);

      await expect(
        service.listSessions(fighterActor, { page: 1, limit: 20 }),
      ).rejects.toThrow(ForbiddenException);
      expect(repo.findSessions).not.toHaveBeenCalled();
    });

    it('scopes coach list queries by the active coach and assignment relation', async () => {
      repo.findActiveCoachIdByUserId.mockResolvedValue(coachId);
      repo.findSessions.mockResolvedValue({ data: [], total: 21 });

      await expect(
        service.listSessions(coachActor, { page: 2, limit: 10 }),
      ).resolves.toEqual({ data: [], total: 21, hasNextPage: true });
      expect(repo.findSessions).toHaveBeenCalledWith(
        { page: 2, limit: 10, coachId },
        { activeCoachId: coachId },
      );
    });

    it('denies coach list query when specified coachId is not owned', async () => {
      repo.isCoachProfileOwnedByUser.mockResolvedValue(false);

      await expect(
        service.listSessions(coachActor, { page: 1, limit: 20, coachId: 'unowned-id' }),
      ).rejects.toThrow(ForbiddenException);
      expect(repo.findSessions).not.toHaveBeenCalled();
    });

    it('requires doctors to provide an authorized fighter scope for lists', async () => {
      await expect(
        service.listSessions(doctorActor, { page: 1, limit: 20 }),
      ).rejects.toMatchObject({ status: 400 });
      expect(repo.findSessions).not.toHaveBeenCalled();
    });

    it('computes hasNextPage correctly when not on last page', async () => {
      repo.findActiveCoachIdByUserId.mockResolvedValue(coachId);
      repo.findSessions.mockResolvedValue({ data: [], total: 25 });

      const res = await service.listSessions(coachActor, { page: 2, limit: 10 });
      expect(res.hasNextPage).toBe(true);
    });
  });

  describe('getSessionById', () => {
    it('returns session for authorized fighter', async () => {
      repo.findSessionById.mockResolvedValue(session);
      repo.findActiveFighterIdByUserId.mockResolvedValue(fighterId);

      await expect(service.getSessionById(fighterActor, sessionId)).resolves.toEqual(
        session,
      );
    });

    it('denies a fighter attempting to access another fighter resource', async () => {
      repo.findSessionById.mockResolvedValue({
        ...session,
        fighterId: otherFighterId,
      });
      repo.findActiveFighterIdByUserId.mockResolvedValue(fighterId);

      await expect(service.getSessionById(fighterActor, sessionId)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it.each([
      [coachActor, 'isCoachAssignedToFighter'],
      [doctorActor, 'isDoctorAssignedToFighter'],
    ] as const)(
      'denies unassigned coach/doctor resource access',
      async (actor, assignmentMethod) => {
        repo.findSessionById.mockResolvedValue(session);
        repo[assignmentMethod].mockResolvedValue(false);

        await expect(service.getSessionById(actor, sessionId)).rejects.toThrow(
          ForbiddenException,
        );
      },
    );

    it('throws 404 when session does not exist', async () => {
      repo.findSessionById.mockResolvedValue(undefined);

      await expect(service.getSessionById(adminActor, sessionId)).rejects.toMatchObject({
        status: 404,
      });
    });
  });

  describe('createSession', () => {
    it.each([
      [{ ...plan, isActive: false }, 'INVALID_SESSION_PLAN'],
      [{ ...plan, fighterId: otherFighterId }, 'FIGHTER_PLAN_MISMATCH'],
    ] as const)(
      'rejects a session plan that violates plan availability',
      async (selectedPlan, expectedCode) => {
        repo.findPlanById.mockResolvedValue(selectedPlan);

        await expect(
          service.createSession(adminActor, {
            fighterId,
            planId,
            title: 'Pad work',
            scheduledAt: now,
            sessionType: 'PAD_WORK',
            roundCount: 0,
          }),
        ).rejects.toSatisfy(
          (error: unknown) => responseOf(error).code === expectedCode,
        );
        expect(repo.createSession).not.toHaveBeenCalled();
      },
    );

    it('validates coach ownership when coach creates session with coachId', async () => {
      repo.isCoachProfileOwnedByUser.mockResolvedValue(false);

      await expect(
        service.createSession(coachActor, {
          fighterId,
          coachId,
          title: 'Pad work',
          scheduledAt: now,
          sessionType: 'PAD_WORK',
          roundCount: 0,
        }),
      ).rejects.toThrow(ForbiddenException);
      expect(repo.createSession).not.toHaveBeenCalled();
    });

    it('maps a nested database cause without leaking persistence details', async () => {
      const databaseError = Object.assign(new Error('insert failed'), {
        cause: {
          code: '23503',
          constraint: 'fk_session_plan_fighter',
          detail: 'sensitive persistence detail',
        },
      });
      repo.findPlanById.mockResolvedValue(plan);
      repo.createSession.mockRejectedValue(databaseError);

      await expect(
        service.createSession(adminActor, {
          fighterId,
          planId,
          title: 'Pad work',
          scheduledAt: now,
          sessionType: 'PAD_WORK',
          roundCount: 0,
        }),
      ).rejects.toSatisfy((error: unknown) => {
        const response = responseOf(error);
        return (
          response.code === 'INVALID_SESSION_PLAN_REFERENCE' &&
          !('detail' in response) &&
          !('constraint' in response)
        );
      });
    });
  });

  describe('updateSession', () => {
    it('updates session successfully', async () => {
      const updated = { ...session, title: 'New Title' };
      repo.findSessionById.mockResolvedValue(session);
      repo.updateSession.mockResolvedValue(updated);

      await expect(
        service.updateSession(adminActor, sessionId, { title: 'New Title' }),
      ).resolves.toEqual(updated);
      expect(repo.updateSession).toHaveBeenCalledWith(sessionId, {
        title: 'New Title',
      });
    });

    it('throws 404 if session to update does not exist', async () => {
      repo.findSessionById.mockResolvedValue(undefined);

      await expect(
        service.updateSession(adminActor, sessionId, { title: 'New Title' }),
      ).rejects.toMatchObject({ status: 404 });
    });
  });

  describe('updateSessionStatus', () => {
    it('rejects an invalid session transition without issuing an update', async () => {
      repo.findSessionById.mockResolvedValue({ ...session, status: 'COMPLETED' });
      repo.findActiveFighterIdByUserId.mockResolvedValue(fighterId);

      await expect(
        service.updateSessionStatus(fighterActor, sessionId, 'IN_PROGRESS'),
      ).rejects.toThrow(BadRequestException);
      expect(repo.updateSessionStatus).not.toHaveBeenCalled();
    });

    it('performs valid session transitions with an atomic expected status', async () => {
      const completed = { ...session, status: 'COMPLETED' as const };
      repo.findSessionById.mockResolvedValue({
        ...session,
        status: 'IN_PROGRESS',
      });
      repo.findActiveFighterIdByUserId.mockResolvedValue(fighterId);
      repo.updateSessionStatus.mockResolvedValue(completed);

      await expect(
        service.updateSessionStatus(fighterActor, sessionId, 'COMPLETED'),
      ).resolves.toEqual(completed);
      expect(repo.updateSessionStatus).toHaveBeenCalledWith(
        sessionId,
        'IN_PROGRESS',
        'COMPLETED',
        expect.any(Date),
        {
          actualDurationSec: null,
          cancellationReason: null,
        },
      );
    });

    it('returns the existing session for an idempotent status request', async () => {
      repo.findSessionById.mockResolvedValue(session);
      repo.findActiveFighterIdByUserId.mockResolvedValue(fighterId);

      await expect(
        service.updateSessionStatus(fighterActor, sessionId, 'SCHEDULED'),
      ).resolves.toEqual(session);
      expect(repo.updateSessionStatus).not.toHaveBeenCalled();
    });

    it('returns the existing session as a silent no-op for CANCELLED -> CANCELLED request', async () => {
      const cancelledSession = {
        ...session,
        status: 'CANCELLED' as const,
        cancellationReason: 'Original reason',
      };
      repo.findSessionById.mockResolvedValue(cancelledSession);
      repo.findActiveFighterIdByUserId.mockResolvedValue(fighterId);

      const result = await service.updateSessionStatus(
        fighterActor,
        sessionId,
        'CANCELLED',
        'Different reason',
      );

      expect(result).toBe(cancelledSession);
      expect(repo.updateSessionStatus).not.toHaveBeenCalled();
    });

    it('reports a session state conflict when the conditional update loses a race', async () => {
      repo.findSessionById.mockResolvedValue({
        ...session,
        status: 'IN_PROGRESS',
      });
      repo.findActiveFighterIdByUserId.mockResolvedValue(fighterId);
      repo.updateSessionStatus.mockResolvedValue(undefined);

      await expect(
        service.updateSessionStatus(fighterActor, sessionId, 'COMPLETED'),
      ).rejects.toSatisfy(
        (error: unknown) =>
          error instanceof ConflictException &&
          responseOf(error).code === 'SESSION_STATE_CONFLICT',
      );
    });

    describe('session status transitions matrix', () => {
      it.each([
        ['SCHEDULED', 'IN_PROGRESS'],
        ['SCHEDULED', 'CANCELLED'],
        ['SCHEDULED', 'SKIPPED'],
        ['IN_PROGRESS', 'COMPLETED'],
        ['IN_PROGRESS', 'ABANDONED'],
        ['IN_PROGRESS', 'CANCELLED'],
      ] as const)(
        'allows valid session transition from %s to %s',
        async (fromStatus, toStatus) => {
          const fromSession = { ...session, status: fromStatus };
          const toSession = { ...session, status: toStatus };
          repo.findSessionById.mockResolvedValue(fromSession);
          repo.findActiveFighterIdByUserId.mockResolvedValue(fighterId);
          repo.updateSessionStatus.mockResolvedValue(toSession);

          await expect(
            service.updateSessionStatus(
              fighterActor,
              sessionId,
              toStatus,
              toStatus === 'CANCELLED' ? 'Valid reason' : undefined,
            ),
          ).resolves.toEqual(toSession);
          expect(repo.updateSessionStatus).toHaveBeenCalledWith(
            sessionId,
            fromStatus,
            toStatus,
            expect.any(Date),
            expect.objectContaining({
              cancellationReason: toStatus === 'CANCELLED' ? 'Valid reason' : null,
            }),
          );
        },
      );

      it.each([
        ['COMPLETED', 'SCHEDULED'],
        ['COMPLETED', 'IN_PROGRESS'],
        ['COMPLETED', 'CANCELLED'],
        ['CANCELLED', 'SCHEDULED'],
        ['CANCELLED', 'IN_PROGRESS'],
        ['SKIPPED', 'SCHEDULED'],
        ['SKIPPED', 'IN_PROGRESS'],
        ['ABANDONED', 'SCHEDULED'],
        ['ABANDONED', 'IN_PROGRESS'],
      ] as const)(
        'terminal status %s cannot transition to %s (throws 400 INVALID_SESSION_STATUS_TRANSITION)',
        async (terminalStatus, nextStatus) => {
          repo.findSessionById.mockResolvedValue({
            ...session,
            status: terminalStatus,
          });
          repo.findActiveFighterIdByUserId.mockResolvedValue(fighterId);

          await expect(
            service.updateSessionStatus(fighterActor, sessionId, nextStatus),
          ).rejects.toSatisfy((error: unknown) => {
            const resp = responseOf(error);
            return (
              (error as HttpException).getStatus() === 400 &&
              resp.code === 'INVALID_SESSION_STATUS_TRANSITION'
            );
          });
          expect(repo.updateSessionStatus).not.toHaveBeenCalled();
        },
      );
    });

    describe('actualDurationSec derivation and boundaries', () => {
      it.each([
        { elapsedMs: 0, expectedSec: 1 },
        { elapsedMs: 1, expectedSec: 1 },
        { elapsedMs: 999, expectedSec: 1 },
        { elapsedMs: 1000, expectedSec: 1 },
        { elapsedMs: 1001, expectedSec: 2 },
        { elapsedMs: 1500, expectedSec: 2 },
      ])(
        'computes duration $expectedSec sec for $elapsedMs ms elapsed',
        async ({ elapsedMs, expectedSec }) => {
          const baseTime = new Date('2026-09-20T10:00:00.000Z');
          const checkedInAt = baseTime.toISOString();
          const stoppedAt = new Date(baseTime.getTime() + elapsedMs);

          repo.findSessionById.mockResolvedValue({
            ...session,
            status: 'IN_PROGRESS',
            checkedInAt,
          });
          repo.findActiveFighterIdByUserId.mockResolvedValue(fighterId);
          repo.updateSessionStatus.mockResolvedValue({
            ...session,
            status: 'COMPLETED',
            actualDurationSec: expectedSec,
          });

          vi.useFakeTimers();
          vi.setSystemTime(stoppedAt);

          await service.updateSessionStatus(fighterActor, sessionId, 'COMPLETED');

          expect(repo.updateSessionStatus).toHaveBeenCalledWith(
            sessionId,
            'IN_PROGRESS',
            'COMPLETED',
            stoppedAt,
            {
              actualDurationSec: expectedSec,
              cancellationReason: null,
            },
          );

          vi.useRealTimers();
        },
      );

      it('sets actualDurationSec to null when transitioning without check-in (SCHEDULED -> CANCELLED)', async () => {
        repo.findSessionById.mockResolvedValue({
          ...session,
          status: 'SCHEDULED',
          checkedInAt: null,
          actualDurationSec: 120, // simulate old stale duration
        });
        repo.findActiveFighterIdByUserId.mockResolvedValue(fighterId);
        repo.updateSessionStatus.mockResolvedValue({
          ...session,
          status: 'CANCELLED',
        });

        await service.updateSessionStatus(
          fighterActor,
          sessionId,
          'CANCELLED',
          'Weather',
        );

        expect(repo.updateSessionStatus).toHaveBeenCalledWith(
          sessionId,
          'SCHEDULED',
          'CANCELLED',
          expect.any(Date),
          {
            actualDurationSec: null,
            cancellationReason: 'Weather',
          },
        );
      });
    });
  });

  describe('DOCTOR write prohibition', () => {
    it('rejects POST /training-sessions (createSession) for DOCTOR before repo read', async () => {
      await expect(
        service.createSession(doctorActor, {
          fighterId,
          title: 'Session',
          scheduledAt: now,
          sessionType: 'SPARRING',
          roundCount: 3,
        }),
      ).rejects.toThrow(ForbiddenException);
      expect(repo.findSessionById).not.toHaveBeenCalled();
      expect(repo.createSession).not.toHaveBeenCalled();
    });

    it('rejects PATCH /training-sessions/:id (updateSession) for DOCTOR before repo read', async () => {
      await expect(
        service.updateSession(doctorActor, 'non-existent-id', { title: 'Updated' }),
      ).rejects.toThrow(ForbiddenException);
      expect(repo.findSessionById).not.toHaveBeenCalled();
      expect(repo.updateSession).not.toHaveBeenCalled();
    });

    it('rejects PATCH /training-sessions/:id/status (updateSessionStatus) for DOCTOR before repo read', async () => {
      await expect(
        service.updateSessionStatus(doctorActor, 'non-existent-id', 'COMPLETED'),
      ).rejects.toThrow(ForbiddenException);
      expect(repo.findSessionById).not.toHaveBeenCalled();
      expect(repo.updateSessionStatus).not.toHaveBeenCalled();
    });

    it('allows DOCTOR to perform reads when scoped to an assigned fighter', async () => {
      repo.findSessionById.mockResolvedValue(session);
      repo.isDoctorAssignedToFighter.mockResolvedValue(true);

      await expect(service.getSessionById(doctorActor, sessionId)).resolves.toMatchObject({
        id: sessionId,
      });
    });
  });
});

