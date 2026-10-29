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
import { NOTIFICATION_PUBLISHER } from '../../shared/contracts/notification.contract.js';
import { MedicalService } from '../../medical/medical.service.js';
import type { SuspensionRow } from '../../database/schema.js';
import { SuspensionGate } from '../../suspensions/suspension.gate.js';
import {
  DEFAULT_MANUAL_BLOCKED_SESSION_TYPES,
  endsOnFor,
} from '../../suspensions/suspensions.model.js';
import { SuspensionsRepository } from '../../suspensions/suspensions.repo.js';
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
  const transaction = { execute: vi.fn() };
  return {
    transaction: vi.fn(async (work) => work(transaction)),
    lockSessionById: vi.fn(),
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

function medicalServiceMock() {
  return {
    evaluateTrainingEligibility: vi.fn().mockResolvedValue({
      eligible: true,
      reasons: [],
    }),
  };
}

function suspensionsRepositoryMock() {
  return {
    findSuspensionsByFighterId: vi.fn().mockResolvedValue([]),
  };
}

function responseOf(error: unknown): Record<string, unknown> {
  return (error as HttpException).getResponse() as Record<string, unknown>;
}

describe('TrainingSessionService', () => {
  let service: TrainingSessionService;
  let repo: Mocked<TrainingRepository>;
  let medical: Mocked<MedicalService>;
  let suspensionsRepo: Mocked<SuspensionsRepository>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TrainingSessionService,
        TrainingAccessService,
        SuspensionGate,
        { provide: TrainingRepository, useValue: repositoryMock() },
        { provide: MedicalService, useValue: medicalServiceMock() },
        {
          provide: SuspensionsRepository,
          useValue: suspensionsRepositoryMock(),
        },
        {
          provide: NOTIFICATION_PUBLISHER,
          useValue: {
            notify: vi.fn().mockResolvedValue({ status: 'queued' }),
            notifyResolved: vi.fn().mockResolvedValue([{ status: 'queued' }]),
          },
        },
      ],
    }).compile();

    service = module.get(TrainingSessionService);
    repo = module.get<Mocked<TrainingRepository>>(TrainingRepository);
    medical = module.get<Mocked<MedicalService>>(MedicalService);
    suspensionsRepo =
      module.get<Mocked<SuspensionsRepository>>(SuspensionsRepository);

    repo.lockSessionById.mockImplementation(async (id) =>
      repo.findSessionById(id),
    );
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
      expect(repo.updateSession).toHaveBeenCalledWith(
        sessionId,
        {
          title: 'New Title',
        },
        expect.anything(),
      );
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
        undefined,
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
              cancellationReason:
                toStatus === 'CANCELLED' ? 'Valid reason' : null,
            }),
            toStatus === 'IN_PROGRESS' ? expect.anything() : undefined,
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
            undefined,
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
          undefined,
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

  describe('Medical eligibility gate', () => {
    it('blocks start when fighter is not medically eligible (409 TRAINING_MEDICAL_ELIGIBILITY_REQUIRED)', async () => {
      repo.findSessionById.mockResolvedValue(session);
      repo.findActiveFighterIdByUserId.mockResolvedValue(fighterId);
      medical.evaluateTrainingEligibility.mockResolvedValueOnce({
        eligible: false,
        reasons: ['REVIEW_REQUEST_PENDING'],
      });

      await expect(
        service.updateSessionStatus(fighterActor, sessionId, 'IN_PROGRESS'),
      ).rejects.toSatisfy((error: unknown) => {
        const resp = responseOf(error);
        return (
          (error as HttpException).getStatus() === 409 &&
          resp.code === 'TRAINING_MEDICAL_ELIGIBILITY_REQUIRED' &&
          Array.isArray(resp.details?.reasons) &&
          resp.details.reasons.includes('REVIEW_REQUEST_PENDING')
        );
      });
      expect(repo.updateSessionStatus).not.toHaveBeenCalled();
    });

    it('blocks start when fighter has no baseline on file (409 EXAMINATION_REQUIRED)', async () => {
      repo.findSessionById.mockResolvedValue(session);
      repo.findActiveFighterIdByUserId.mockResolvedValue(fighterId);
      medical.evaluateTrainingEligibility.mockResolvedValueOnce({
        eligible: false,
        reasons: ['EXAMINATION_REQUIRED'],
      });

      await expect(
        service.updateSessionStatus(fighterActor, sessionId, 'IN_PROGRESS'),
      ).rejects.toSatisfy((error: unknown) => {
        const resp = responseOf(error);
        return (
          (error as HttpException).getStatus() === 409 &&
          resp.code === 'TRAINING_MEDICAL_ELIGIBILITY_REQUIRED' &&
          Array.isArray(resp.details?.reasons) &&
          resp.details.reasons.includes('EXAMINATION_REQUIRED')
        );
      });
      expect(repo.updateSessionStatus).not.toHaveBeenCalled();
    });

    it('re-evaluates gate on same-status IN_PROGRESS -> IN_PROGRESS request', async () => {
      const inProgressSession = { ...session, status: 'IN_PROGRESS' as const };
      repo.findSessionById.mockResolvedValue(inProgressSession);
      repo.findActiveFighterIdByUserId.mockResolvedValue(fighterId);
      medical.evaluateTrainingEligibility.mockResolvedValueOnce({
        eligible: false,
        reasons: ['CLEARANCE_EXPIRED'],
      });

      await expect(
        service.updateSessionStatus(fighterActor, sessionId, 'IN_PROGRESS'),
      ).rejects.toSatisfy((error: unknown) => {
        const resp = responseOf(error);
        return (
          (error as HttpException).getStatus() === 409 &&
          resp.code === 'TRAINING_MEDICAL_ELIGIBILITY_REQUIRED' &&
          resp.details?.reasons?.includes('CLEARANCE_EXPIRED')
        );
      });
    });

    it('evaluates gate when updating sessionType on an IN_PROGRESS session', async () => {
      const inProgressSession = {
        ...session,
        status: 'IN_PROGRESS' as const,
        sessionType: 'PAD_WORK' as const,
      };
      repo.findSessionById.mockResolvedValue(inProgressSession);
      medical.evaluateTrainingEligibility.mockResolvedValueOnce({
        eligible: false,
        reasons: ['SESSION_TYPE_RESTRICTED'],
      });

      await expect(
        service.updateSession(adminActor, sessionId, {
          sessionType: 'SPARRING',
        }),
      ).rejects.toSatisfy((error: unknown) => {
        const resp = responseOf(error);
        return (
          (error as HttpException).getStatus() === 409 &&
          resp.code === 'TRAINING_MEDICAL_ELIGIBILITY_REQUIRED' &&
          resp.details?.reasons?.includes('SESSION_TYPE_RESTRICTED')
        );
      });
    });

    it('allows updating sessionType on an IN_PROGRESS session when medically eligible', async () => {
      const inProgressSession = {
        ...session,
        status: 'IN_PROGRESS' as const,
        sessionType: 'PAD_WORK' as const,
      };
      const updatedSession = {
        ...inProgressSession,
        sessionType: 'SPARRING' as const,
      };
      repo.findSessionById.mockResolvedValue(inProgressSession);
      repo.updateSession.mockResolvedValue(updatedSession);
      medical.evaluateTrainingEligibility.mockResolvedValueOnce({
        eligible: true,
        reasons: [],
      });

      await expect(
        service.updateSession(adminActor, sessionId, {
          sessionType: 'SPARRING',
        }),
      ).resolves.toEqual(updatedSession);
    });
  });

  describe('Suspension gate (Gate 2)', () => {
    const suspensionId = '90000000-0000-4000-8000-000000000001';

    afterEach(() => {
      vi.useRealTimers();
    });

    function makeKoSuspension(
      over: Partial<SuspensionRow> = {},
    ): SuspensionRow {
      return {
        id: suspensionId,
        fighterId,
        boutId: '80000000-0000-4000-8000-000000000001',
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
        createdById: coachUserId,
        createdAt: new Date('2026-10-01T03:00:00.000Z'),
        updatedAt: new Date('2026-10-01T03:00:00.000Z'),
        deletedAt: null,
        ...over,
      };
    }

    it('rejects scheduling SPARRING on day 10 of a 45-day KO suspension with 409 TRAINING_SUSPENSION_ACTIVE, while PAD_WORK passes', async () => {
      suspensionsRepo.findSuspensionsByFighterId.mockResolvedValue([
        makeKoSuspension(),
      ]);
      const day10Iso = '2026-10-10T10:00:00.000Z';

      await expect(
        service.createSession(adminActor, {
          fighterId,
          title: 'Sparring session',
          scheduledAt: day10Iso,
          sessionType: 'SPARRING',
          roundCount: 3,
        }),
      ).rejects.toSatisfy((error: unknown) => {
        const resp = responseOf(error) as {
          code?: string;
          details?: { suspensions?: unknown[] };
        };
        return (
          (error as HttpException).getStatus() === 409 &&
          resp.code === 'TRAINING_SUSPENSION_ACTIVE' &&
          JSON.stringify(resp.details?.suspensions) ===
            JSON.stringify([
              {
                suspensionId,
                reason: 'KO',
                endsOn: '2026-11-14',
                requiresClearance: true,
              },
            ])
        );
      });
      expect(repo.createSession).not.toHaveBeenCalled();

      const createdPadWork: TrainingSessionEntity = {
        ...session,
        scheduledAt: day10Iso,
        sessionType: 'PAD_WORK',
      };
      repo.createSession.mockResolvedValueOnce(createdPadWork);

      await expect(
        service.createSession(adminActor, {
          fighterId,
          title: 'Pad work session',
          scheduledAt: day10Iso,
          sessionType: 'PAD_WORK',
          roundCount: 3,
        }),
      ).resolves.toEqual(createdPadWork);
      expect(repo.createSession).toHaveBeenCalledTimes(1);
    });

    it('rejects scheduling PAD_WORK when suspension blocks 6 default manual session types with 409 TRAINING_SUSPENSION_ACTIVE, while RECOVERY and PHYSICAL_THERAPY pass', async () => {
      suspensionsRepo.findSuspensionsByFighterId.mockResolvedValue([
        makeKoSuspension({
          blockedSessionTypes: [...DEFAULT_MANUAL_BLOCKED_SESSION_TYPES],
        }),
      ]);
      const day10Iso = '2026-10-10T10:00:00.000Z';

      await expect(
        service.createSession(adminActor, {
          fighterId,
          title: 'Pad work session',
          scheduledAt: day10Iso,
          sessionType: 'PAD_WORK',
          roundCount: 3,
        }),
      ).rejects.toSatisfy((error: unknown) => {
        const resp = responseOf(error) as {
          code?: string;
          details?: { suspensions?: unknown[] };
        };
        return (
          (error as HttpException).getStatus() === 409 &&
          resp.code === 'TRAINING_SUSPENSION_ACTIVE' &&
          JSON.stringify(resp.details?.suspensions) ===
            JSON.stringify([
              {
                suspensionId,
                reason: 'KO',
                endsOn: '2026-11-14',
                requiresClearance: true,
              },
            ])
        );
      });
      expect(repo.createSession).not.toHaveBeenCalled();

      const createdRecovery: TrainingSessionEntity = {
        ...session,
        scheduledAt: day10Iso,
        sessionType: 'RECOVERY',
      };
      repo.createSession.mockResolvedValueOnce(createdRecovery);

      await expect(
        service.createSession(adminActor, {
          fighterId,
          title: 'Recovery session',
          scheduledAt: day10Iso,
          sessionType: 'RECOVERY',
        }),
      ).resolves.toEqual(createdRecovery);

      const createdPt: TrainingSessionEntity = {
        ...session,
        scheduledAt: day10Iso,
        sessionType: 'PHYSICAL_THERAPY',
      };
      repo.createSession.mockResolvedValueOnce(createdPt);

      await expect(
        service.createSession(adminActor, {
          fighterId,
          title: 'Physical therapy session',
          scheduledAt: day10Iso,
          sessionType: 'PHYSICAL_THERAPY',
        }),
      ).resolves.toEqual(createdPt);

      expect(repo.createSession).toHaveBeenCalledTimes(2);
    });

    it('continues blocking SPARRING past ends_on while not cleared, and allows scheduling SPARRING once cleared', async () => {
      const pastEndsOnIso = '2026-11-20T10:00:00.000Z';
      suspensionsRepo.findSuspensionsByFighterId.mockResolvedValueOnce([
        makeKoSuspension({ clearedAt: null }),
      ]);

      await expect(
        service.createSession(adminActor, {
          fighterId,
          title: 'Sparring after ends_on without clearance',
          scheduledAt: pastEndsOnIso,
          sessionType: 'SPARRING',
          roundCount: 3,
        }),
      ).rejects.toSatisfy((error: unknown) => {
        const resp = responseOf(error);
        return (
          (error as HttpException).getStatus() === 409 &&
          resp.code === 'TRAINING_SUSPENSION_ACTIVE'
        );
      });
      expect(repo.createSession).not.toHaveBeenCalled();

      // After clearance on D = 2026-11-19, SPARRING can be scheduled from D+2 = 2026-11-21
      const fullReturnIso = '2026-11-21T10:00:00.000Z';
      suspensionsRepo.findSuspensionsByFighterId.mockResolvedValueOnce([
        makeKoSuspension({
          clearedAt: new Date('2026-11-19T08:00:00.000Z'),
          clearedById: doctorUserId,
          clearanceNote: 'Cleared by doctor after CT',
        }),
      ]);
      const createdSparring: TrainingSessionEntity = {
        ...session,
        scheduledAt: fullReturnIso,
        sessionType: 'SPARRING',
      };
      repo.createSession.mockResolvedValueOnce(createdSparring);

      await expect(
        service.createSession(adminActor, {
          fighterId,
          title: 'Sparring after clearance',
          scheduledAt: fullReturnIso,
          sessionType: 'SPARRING',
          roundCount: 3,
        }),
      ).resolves.toEqual(createdSparring);
      expect(repo.createSession).toHaveBeenCalledTimes(1);
    });

    it('allows scheduling SPARRING before an UPCOMING suspension startsOn and blocks from startsOn onward, and stops blocking after early clearance', async () => {
      const upcoming = makeKoSuspension({
        startsOn: '2026-10-05',
        endsOn: '2026-10-18',
      });
      suspensionsRepo.findSuspensionsByFighterId.mockResolvedValue([upcoming]);

      const beforeStartIso = '2026-10-04T10:00:00.000Z';
      const createdBefore: TrainingSessionEntity = {
        ...session,
        scheduledAt: beforeStartIso,
        sessionType: 'SPARRING',
      };
      repo.createSession.mockResolvedValueOnce(createdBefore);
      await expect(
        service.createSession(adminActor, {
          fighterId,
          title: 'Sparring before suspension starts',
          scheduledAt: beforeStartIso,
          sessionType: 'SPARRING',
          roundCount: 3,
        }),
      ).resolves.toEqual(createdBefore);

      const onStartIso = '2026-10-05T10:00:00.000Z';
      await expect(
        service.createSession(adminActor, {
          fighterId,
          title: 'Sparring on startsOn',
          scheduledAt: onStartIso,
          sessionType: 'SPARRING',
          roundCount: 3,
        }),
      ).rejects.toSatisfy(
        (error: unknown) =>
          (error as HttpException).getStatus() === 409 &&
          responseOf(error).code === 'TRAINING_SUSPENSION_ACTIVE',
      );

      // Early clearance on D = 2026-10-06 lifts Gate 2 for SPARRING from D+2 = 2026-10-08
      suspensionsRepo.findSuspensionsByFighterId.mockResolvedValueOnce([
        makeKoSuspension({
          startsOn: '2026-10-05',
          endsOn: '2026-10-18',
          clearedAt: new Date('2026-10-06T08:00:00.000Z'),
          clearedById: coachUserId,
          clearanceNote: 'Cleared early',
        }),
      ]);
      const createdAfterEarlyClear: TrainingSessionEntity = {
        ...session,
        scheduledAt: '2026-10-08T10:00:00.000Z',
        sessionType: 'SPARRING',
      };
      repo.createSession.mockResolvedValueOnce(createdAfterEarlyClear);
      await expect(
        service.createSession(adminActor, {
          fighterId,
          title: 'Sparring after early clear',
          scheduledAt: '2026-10-08T10:00:00.000Z',
          sessionType: 'SPARRING',
          roundCount: 3,
        }),
      ).resolves.toEqual(createdAfterEarlyClear);
    });

    it('Criteria 4, 5, 6 (T-045): 60-day KO cleared on D allows PAD_WORK and rejects GRAPPLING (409 ceiling 3, fullReturnOn D+2) on D, allows GRAPPLING and rejects SPARRING (409 ceiling 4, fullReturnOn D+2) on D+1, allows SPARRING on D+2; MANDATORY_REST ending E allows SPARRING on E+1; uncleared KO has no gradedReturn', async () => {
      const ko60Cleared = makeKoSuspension({
        reason: 'KO',
        startsOn: '2026-10-20',
        endsOn: '2026-12-18',
        requiresClearance: true,
        clearedAt: new Date('2026-12-19T02:00:00.000Z'), // D = 2026-12-19
        clearedById: doctorUserId,
        clearanceNote: 'Cleared by doctor',
      });
      suspensionsRepo.findSuspensionsByFighterId.mockResolvedValue([
        ko60Cleared,
      ]);

      const dayDIso = '2026-12-19T10:00:00.000Z';
      const dayDPlus1Iso = '2026-12-20T10:00:00.000Z';
      const dayDPlus2Iso = '2026-12-21T10:00:00.000Z';

      // Day D: PAD_WORK succeeds
      const createdPadWork: TrainingSessionEntity = {
        ...session,
        scheduledAt: dayDIso,
        sessionType: 'PAD_WORK',
      };
      repo.createSession.mockResolvedValueOnce(createdPadWork);
      await expect(
        service.createSession(adminActor, {
          fighterId,
          title: 'Pad work on D',
          scheduledAt: dayDIso,
          sessionType: 'PAD_WORK',
        }),
      ).resolves.toEqual(createdPadWork);

      // Day D: GRAPPLING -> 409 with gradedReturn { ceiling: 3, fullReturnOn: '2026-12-21' }
      await expect(
        service.createSession(adminActor, {
          fighterId,
          title: 'Grappling on D',
          scheduledAt: dayDIso,
          sessionType: 'GRAPPLING',
        }),
      ).rejects.toSatisfy((error: unknown) => {
        const resp = responseOf(error) as {
          code?: string;
          details?: { suspensions?: unknown[] };
        };
        return (
          (error as HttpException).getStatus() === 409 &&
          resp.code === 'TRAINING_SUSPENSION_ACTIVE' &&
          JSON.stringify(resp.details?.suspensions) ===
            JSON.stringify([
              {
                suspensionId,
                reason: 'KO',
                endsOn: '2026-12-18',
                requiresClearance: true,
                gradedReturn: {
                  ceiling: 3,
                  fullReturnOn: '2026-12-21',
                },
              },
            ])
        );
      });

      // Day D+1: GRAPPLING succeeds
      const createdGrappling: TrainingSessionEntity = {
        ...session,
        scheduledAt: dayDPlus1Iso,
        sessionType: 'GRAPPLING',
      };
      repo.createSession.mockResolvedValueOnce(createdGrappling);
      await expect(
        service.createSession(adminActor, {
          fighterId,
          title: 'Grappling on D+1',
          scheduledAt: dayDPlus1Iso,
          sessionType: 'GRAPPLING',
        }),
      ).resolves.toEqual(createdGrappling);

      // Day D+1: SPARRING -> 409 with gradedReturn { ceiling: 4, fullReturnOn: '2026-12-21' }
      await expect(
        service.createSession(adminActor, {
          fighterId,
          title: 'Sparring on D+1',
          scheduledAt: dayDPlus1Iso,
          sessionType: 'SPARRING',
          roundCount: 3,
        }),
      ).rejects.toSatisfy((error: unknown) => {
        const resp = responseOf(error) as {
          code?: string;
          details?: { suspensions?: unknown[] };
        };
        return (
          (error as HttpException).getStatus() === 409 &&
          resp.code === 'TRAINING_SUSPENSION_ACTIVE' &&
          JSON.stringify(resp.details?.suspensions) ===
            JSON.stringify([
              {
                suspensionId,
                reason: 'KO',
                endsOn: '2026-12-18',
                requiresClearance: true,
                gradedReturn: {
                  ceiling: 4,
                  fullReturnOn: '2026-12-21',
                },
              },
            ])
        );
      });

      // Day D+2: SPARRING succeeds
      const createdSparringDPlus2: TrainingSessionEntity = {
        ...session,
        scheduledAt: dayDPlus2Iso,
        sessionType: 'SPARRING',
      };
      repo.createSession.mockResolvedValueOnce(createdSparringDPlus2);
      await expect(
        service.createSession(adminActor, {
          fighterId,
          title: 'Sparring on D+2',
          scheduledAt: dayDPlus2Iso,
          sessionType: 'SPARRING',
          roundCount: 3,
        }),
      ).resolves.toEqual(createdSparringDPlus2);

      // Criterion 5: MANDATORY_REST ending E = 2026-10-26 -> E+1 = 2026-10-27 SPARRING succeeds
      suspensionsRepo.findSuspensionsByFighterId.mockResolvedValueOnce([
        makeKoSuspension({
          reason: 'MANDATORY_REST',
          startsOn: '2026-10-20',
          endsOn: '2026-10-26',
          requiresClearance: false,
          clearedAt: null,
        }),
      ]);
      const createdSparringAfterRest: TrainingSessionEntity = {
        ...session,
        scheduledAt: '2026-10-27T10:00:00.000Z',
        sessionType: 'SPARRING',
      };
      repo.createSession.mockResolvedValueOnce(createdSparringAfterRest);
      await expect(
        service.createSession(adminActor, {
          fighterId,
          title: 'Sparring on E+1 after mandatory rest',
          scheduledAt: '2026-10-27T10:00:00.000Z',
          sessionType: 'SPARRING',
          roundCount: 3,
        }),
      ).resolves.toEqual(createdSparringAfterRest);
    });

    it('blocks starting (IN_PROGRESS) a SPARRING session during an active suspension with 409 TRAINING_SUSPENSION_ACTIVE', async () => {
      const sparringSession: TrainingSessionEntity = {
        ...session,
        scheduledAt: '2026-10-10T10:00:00.000Z',
        sessionType: 'SPARRING',
        status: 'SCHEDULED',
      };
      repo.findSessionById.mockResolvedValue(sparringSession);
      repo.findActiveFighterIdByUserId.mockResolvedValue(fighterId);
      suspensionsRepo.findSuspensionsByFighterId.mockResolvedValue([
        makeKoSuspension(),
      ]);

      await expect(
        service.updateSessionStatus(fighterActor, sessionId, 'IN_PROGRESS'),
      ).rejects.toSatisfy((error: unknown) => {
        const resp = responseOf(error) as {
          code?: string;
          details?: { suspensions?: unknown[] };
        };
        return (
          (error as HttpException).getStatus() === 409 &&
          resp.code === 'TRAINING_SUSPENSION_ACTIVE' &&
          Array.isArray(resp.details?.suspensions) &&
          resp.details.suspensions.length === 1
        );
      });
      expect(repo.updateSessionStatus).not.toHaveBeenCalled();
      expect(suspensionsRepo.findSuspensionsByFighterId).toHaveBeenCalledWith(
        fighterId,
        expect.anything(),
      );
    });

    it('rejects starting a session whose scheduledAt is before suspension starts if started while suspension is in force (NOW)', async () => {
      vi.setSystemTime(new Date('2026-10-25T10:00:00.000Z'));
      const pastScheduledSession: TrainingSessionEntity = {
        ...session,
        scheduledAt: '2026-10-20T10:00:00.000Z',
        sessionType: 'SPARRING',
        status: 'SCHEDULED',
      };
      repo.findSessionById.mockResolvedValue(pastScheduledSession);
      repo.findActiveFighterIdByUserId.mockResolvedValue(fighterId);
      suspensionsRepo.findSuspensionsByFighterId.mockResolvedValue([
        makeKoSuspension({
          startsOn: '2026-10-22',
          endsOn: '2026-11-05',
        }),
      ]);

      await expect(
        service.updateSessionStatus(fighterActor, sessionId, 'IN_PROGRESS'),
      ).rejects.toSatisfy((error: unknown) => {
        const resp = responseOf(error) as { code?: string };
        return (
          (error as HttpException).getStatus() === 409 &&
          resp.code === 'TRAINING_SUSPENSION_ACTIVE'
        );
      });
      expect(repo.updateSessionStatus).not.toHaveBeenCalled();
    });

    it('allows starting a session whose scheduledAt is inside a future suspension if started when no suspension is in force (NOW)', async () => {
      vi.setSystemTime(new Date('2026-10-15T10:00:00.000Z'));
      const futureScheduledSession: TrainingSessionEntity = {
        ...session,
        scheduledAt: '2026-10-25T10:00:00.000Z',
        sessionType: 'SPARRING',
        status: 'SCHEDULED',
      };
      repo.findSessionById.mockResolvedValue(futureScheduledSession);
      repo.findActiveFighterIdByUserId.mockResolvedValue(fighterId);
      repo.updateSessionStatus.mockResolvedValue({
        ...futureScheduledSession,
        status: 'IN_PROGRESS',
      });
      suspensionsRepo.findSuspensionsByFighterId.mockResolvedValue([
        makeKoSuspension({
          startsOn: '2026-10-22',
          endsOn: '2026-11-05',
        }),
      ]);

      const result = await service.updateSessionStatus(
        fighterActor,
        sessionId,
        'IN_PROGRESS',
      );
      expect(result.status).toBe('IN_PROGRESS');
      expect(repo.updateSessionStatus).toHaveBeenCalled();
    });

    it('returns 409 TRAINING_MEDICAL_ELIGIBILITY_REQUIRED with both details.reasons and details.suspensions when blocked by both gates', async () => {
      const sparringSession: TrainingSessionEntity = {
        ...session,
        scheduledAt: '2026-10-10T10:00:00.000Z',
        sessionType: 'SPARRING',
        status: 'SCHEDULED',
      };
      repo.findSessionById.mockResolvedValue(sparringSession);
      repo.findActiveFighterIdByUserId.mockResolvedValue(fighterId);
      medical.evaluateTrainingEligibility.mockResolvedValueOnce({
        eligible: false,
        reasons: ['EXAMINATION_REQUIRED', 'REVIEW_REQUEST_PENDING'],
      });
      suspensionsRepo.findSuspensionsByFighterId.mockResolvedValue([
        makeKoSuspension(),
      ]);

      await expect(
        service.updateSessionStatus(fighterActor, sessionId, 'IN_PROGRESS'),
      ).rejects.toSatisfy((error: unknown) => {
        const resp = responseOf(error) as {
          code?: string;
          details?: {
            reasons?: string[];
            suspensions?: Array<{
              suspensionId: string;
              reason: string;
              endsOn: string;
              requiresClearance: boolean;
            }>;
          };
        };
        return (
          (error as HttpException).getStatus() === 409 &&
          resp.code === 'TRAINING_MEDICAL_ELIGIBILITY_REQUIRED' &&
          JSON.stringify(resp.details?.reasons) ===
            JSON.stringify(['EXAMINATION_REQUIRED', 'REVIEW_REQUEST_PENDING']) &&
          JSON.stringify(resp.details?.suspensions) ===
            JSON.stringify([
              {
                suspensionId,
                reason: 'KO',
                endsOn: '2026-11-14',
                requiresClearance: true,
              },
            ])
        );
      });
      expect(repo.updateSessionStatus).not.toHaveBeenCalled();
    });

    it('allows cancelling, skipping, completing, or abandoning a session of a suspended fighter', async () => {
      const scheduledSparring: TrainingSessionEntity = {
        ...session,
        scheduledAt: '2026-10-10T10:00:00.000Z',
        sessionType: 'SPARRING',
        status: 'SCHEDULED',
      };
      const cancelledSparring: TrainingSessionEntity = {
        ...scheduledSparring,
        status: 'CANCELLED',
        cancellationReason: 'Suspended after KO',
      };
      repo.findSessionById.mockResolvedValue(scheduledSparring);
      repo.findActiveFighterIdByUserId.mockResolvedValue(fighterId);
      repo.updateSessionStatus.mockResolvedValue(cancelledSparring);
      suspensionsRepo.findSuspensionsByFighterId.mockResolvedValue([
        makeKoSuspension(),
      ]);

      await expect(
        service.updateSessionStatus(
          fighterActor,
          sessionId,
          'CANCELLED',
          'Suspended after KO',
        ),
      ).resolves.toEqual(cancelledSparring);
      expect(
        suspensionsRepo.findSuspensionsByFighterId,
      ).not.toHaveBeenCalled();
    });

    it('reschedules a PENDING session past endsOn to SCHEDULED in the same UPDATE, rejects rescheduling into suspension with 409 keeping PENDING, rejects status transition to IN_PROGRESS or SCHEDULED with 400, and allows CANCELLED with notification (Criterion 5)', async () => {
      const mandatoryRestSuspension = makeKoSuspension({
        reason: 'MANDATORY_REST',
        requiresClearance: false,
        startsOn: '2026-10-01',
        endsOn: '2026-10-14',
        blockedSessionTypes: ['SPARRING'],
      });
      suspensionsRepo.findSuspensionsByFighterId.mockResolvedValue([
        mandatoryRestSuspension,
      ]);

      const pendingSparring: TrainingSessionEntity = {
        ...session,
        status: 'PENDING',
        sessionType: 'SPARRING',
        scheduledAt: '2026-10-10T10:00:00.000Z',
      };
      repo.findSessionById.mockResolvedValue(pendingSparring);

      // 1. PATCH with scheduledAt still inside suspension period -> 409 TRAINING_SUSPENSION_ACTIVE, keeps PENDING
      await expect(
        service.updateSession(adminActor, sessionId, {
          scheduledAt: '2026-10-12T10:00:00.000Z',
        }),
      ).rejects.toSatisfy(
        (error: unknown) =>
          (error as HttpException).getStatus() === 409 &&
          responseOf(error).code === 'TRAINING_SUSPENSION_ACTIVE',
      );
      expect(repo.updateSession).not.toHaveBeenCalled();

      // 2. PATCH with scheduledAt after endsOn -> transitions status to SCHEDULED in the same UPDATE
      const newScheduledAt = '2026-10-20T10:00:00.000Z';
      const rescheduledEntity: TrainingSessionEntity = {
        ...pendingSparring,
        scheduledAt: newScheduledAt,
        status: 'SCHEDULED',
      };
      repo.updateSession.mockResolvedValueOnce(rescheduledEntity);

      const updated = await service.updateSession(adminActor, sessionId, {
        scheduledAt: newScheduledAt,
      });
      expect(updated.status).toBe('SCHEDULED');
      expect(repo.updateSession).toHaveBeenCalledWith(
        sessionId,
        {
          scheduledAt: newScheduledAt,
          status: 'SCHEDULED',
        },
        expect.anything(),
      );

      // 3. PATCH /:id/status to IN_PROGRESS or SCHEDULED -> 400 INVALID_SESSION_STATUS_TRANSITION
      repo.findActiveFighterIdByUserId.mockResolvedValue(fighterId);
      await expect(
        service.updateSessionStatus(fighterActor, sessionId, 'IN_PROGRESS'),
      ).rejects.toSatisfy(
        (error: unknown) =>
          (error as HttpException).getStatus() === 400 &&
          responseOf(error).code === 'INVALID_SESSION_STATUS_TRANSITION',
      );
      await expect(
        service.updateSessionStatus(fighterActor, sessionId, 'SCHEDULED'),
      ).rejects.toSatisfy(
        (error: unknown) =>
          (error as HttpException).getStatus() === 400 &&
          responseOf(error).code === 'INVALID_SESSION_STATUS_TRANSITION',
      );
      expect(repo.updateSessionStatus).not.toHaveBeenCalled();

      // 4. PATCH /:id/status to CANCELLED with cancellationReason -> succeeds and sends TRAINING_SESSION_CANCELLED
      const cancelledFromPending: TrainingSessionEntity = {
        ...pendingSparring,
        status: 'CANCELLED',
        cancellationReason: 'Cannot reschedule before camp ends',
      };
      repo.updateSessionStatus.mockResolvedValueOnce(cancelledFromPending);
      (
        repo as unknown as { findParticipantUserIds: ReturnType<typeof vi.fn> }
      ).findParticipantUserIds = vi
        .fn()
        .mockResolvedValue([fighterUserId, coachUserId]);
      const notifications = (
        service as unknown as {
          notifications: { notifyResolved: ReturnType<typeof vi.fn> };
        }
      ).notifications;
      notifications.notifyResolved.mockClear();

      await expect(
        service.updateSessionStatus(
          fighterActor,
          sessionId,
          'CANCELLED',
          'Cannot reschedule before camp ends',
        ),
      ).resolves.toEqual(cancelledFromPending);
      expect(notifications.notifyResolved).toHaveBeenCalledTimes(1);
      const resolver = notifications.notifyResolved.mock.calls[0]?.[0] as () => Promise<
        Array<{ type: string }>
      >;
      await expect(resolver()).resolves.toEqual([
        expect.objectContaining({
          type: 'TRAINING_SESSION_CANCELLED',
        }),
      ]);
    });

    it('rejects updateSession when changing sessionType or scheduledAt into an active suspension with 409 TRAINING_SUSPENSION_ACTIVE', async () => {
      suspensionsRepo.findSuspensionsByFighterId.mockResolvedValue([
        makeKoSuspension(),
      ]);

      // 1. Changing sessionType from PAD_WORK to SPARRING on a date inside the suspension
      const padWorkDuringSuspension: TrainingSessionEntity = {
        ...session,
        scheduledAt: '2026-10-10T10:00:00.000Z',
        sessionType: 'PAD_WORK',
      };
      repo.findSessionById.mockResolvedValue(padWorkDuringSuspension);

      await expect(
        service.updateSession(adminActor, sessionId, {
          sessionType: 'SPARRING',
        }),
      ).rejects.toSatisfy(
        (error: unknown) =>
          (error as HttpException).getStatus() === 409 &&
          responseOf(error).code === 'TRAINING_SUSPENSION_ACTIVE',
      );
      expect(repo.updateSession).not.toHaveBeenCalled();

      // 2. Changing scheduledAt of a SPARRING session into the suspension window
      const sparringBeforeSuspension: TrainingSessionEntity = {
        ...session,
        scheduledAt: '2026-09-25T10:00:00.000Z',
        sessionType: 'SPARRING',
      };
      repo.findSessionById.mockResolvedValue(sparringBeforeSuspension);

      await expect(
        service.updateSession(adminActor, sessionId, {
          scheduledAt: '2026-10-10T10:00:00.000Z',
        }),
      ).rejects.toSatisfy(
        (error: unknown) =>
          (error as HttpException).getStatus() === 409 &&
          responseOf(error).code === 'TRAINING_SUSPENSION_ACTIVE',
      );
      expect(repo.updateSession).not.toHaveBeenCalled();

      // 3. Updating non-schedule/non-type fields (e.g. title) on a session during suspension is allowed
      const updatedTitle: TrainingSessionEntity = {
        ...padWorkDuringSuspension,
        sessionType: 'SPARRING',
        title: 'Updated title only',
      };
      repo.findSessionById.mockResolvedValue({
        ...padWorkDuringSuspension,
        sessionType: 'SPARRING',
      });
      repo.updateSession.mockResolvedValueOnce(updatedTitle);

      await expect(
        service.updateSession(adminActor, sessionId, {
          title: 'Updated title only',
        }),
      ).resolves.toEqual(updatedTitle);
      expect(repo.updateSession).toHaveBeenCalledTimes(1);
    });
  });
});

