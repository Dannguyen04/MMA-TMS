import {
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
  type HttpException,
} from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi, type Mocked } from 'vitest';
import type { SuspensionRow } from '../database/schema.js';
import { MedicalService } from '../medical/medical.service.js';
import {
  NOTIFICATION_PUBLISHER,
  NOTIFICATION_TYPE,
} from '../shared/contracts/notification.contract.js';
import type { AuthenticatedUser } from '../shared/models/auth-context.model.js';
import { USER } from '../shared/types/user.role.js';
import { SuspensionGate } from '../suspensions/suspension.gate.js';
import { SESSION_TYPES } from '../suspensions/suspensions.model.js';
import { SuspensionsRepository } from '../suspensions/suspensions.repo.js';
import { TrainingSessionService } from './sessions/training-session.service.js';
import { TrainingAccessService } from './training-access.service.js';
import { SUSPENSION_CONFLICT_CANCELLATION_REASON } from './training.constants.js';
import type { TrainingSessionEntity } from './training.model.js';
import { TrainingRepository } from './training.repo.js';
import { TrainingSuspensionConflictsService } from './training-suspension-conflicts.service.js';

const fighterUserId = '516a01dc-f842-40e4-ae88-abca224921b7';
const coachUserId = '59d6ba46-32f2-4e67-b486-e966b2064328';
const adminUserId = 'e069ca8a-d0f1-44da-8bd5-48a60bf44b99';
const doctorUserId = '3a119889-e544-4c66-938a-4c511b184baa';
const fighterId = 'c61e6859-4a4e-4313-b762-9343270153f5';
const coachId = '88f97dd5-8f68-45bf-81db-4a778d30853a';
const suspensionId = '70000000-0000-4000-8000-000000000001';
const session1Id = '51c38f60-0f4e-48aa-848b-20f5ef828f01';
const session2Id = '51c38f60-0f4e-48aa-848b-20f5ef828f02';
const session3Id = '51c38f60-0f4e-48aa-848b-20f5ef828f03';
const outsideSessionId = '51c38f60-0f4e-48aa-848b-20f5ef828f99';

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

function makeSuspensionRow(over: Partial<SuspensionRow> = {}): SuspensionRow {
  return {
    id: suspensionId,
    fighterId,
    boutId: null,
    reason: 'KO',
    startsOn: '2026-10-01',
    endsOn: '2026-10-14',
    lossOfConsciousness: 'NONE',
    suggestedDays: 14,
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

function makeSessionEntity(
  over: Partial<TrainingSessionEntity> = {},
): TrainingSessionEntity {
  return {
    id: session1Id,
    fighterId,
    coachId,
    planId: null,
    title: 'Scheduled session',
    scheduledAt: '2026-10-05T10:00:00.000Z',
    plannedDurationSec: 3600,
    actualDurationSec: null,
    roundCount: 5,
    location: 'Main gym',
    sessionType: 'SPARRING',
    status: 'SCHEDULED',
    coachNotes: null,
    cancellationReason: null,
    checkedInAt: null,
    completedAt: null,
    abandonedAt: null,
    skippedAt: null,
    reportedRpe: null,
    isActive: true,
    createdAt: '2026-09-25T10:00:00.000Z',
    updatedAt: '2026-09-25T10:00:00.000Z',
    deletedAt: null,
    cancelledAt: null,
    ...over,
  };
}

function repositoryMock() {
  const transaction = { execute: vi.fn() };
  return {
    transaction: vi.fn(async (work) => work(transaction)),
    findScheduledSessionsByFighterId: vi.fn().mockResolvedValue([]),
    findSessions: vi.fn().mockResolvedValue({ data: [], total: 0 }),
    findSessionById: vi.fn(),
    lockSessionById: vi.fn(),
    updateSession: vi.fn(),
    updateSessionStatus: vi.fn(),
    findParticipantUserIds: vi
      .fn()
      .mockResolvedValue([fighterUserId, coachUserId]),
    findActiveFighterIdByUserId: vi.fn(),
    findActiveCoachIdByUserId: vi.fn(),
    findActiveDoctorIdByUserId: vi.fn(),
    isCoachAssignedToFighter: vi.fn(),
    isDoctorAssignedToFighter: vi.fn(),
    isCoachProfileOwnedByUser: vi.fn(),
  };
}

function suspensionsRepositoryMock() {
  return {
    findSuspensionById: vi.fn(),
    findSuspensionsByFighterId: vi.fn().mockResolvedValue([]),
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

function responseOf(error: unknown): Record<string, unknown> {
  return (error as HttpException).getResponse() as Record<string, unknown>;
}

describe('TrainingSuspensionConflictsService (R28)', () => {
  let service: TrainingSuspensionConflictsService;
  let repo: Mocked<TrainingRepository>;
  let suspensionsRepo: Mocked<SuspensionsRepository>;
  let notifications: {
    notify: ReturnType<typeof vi.fn>;
    notifyResolved: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    notifications = {
      notify: vi.fn().mockResolvedValue({ status: 'queued' }),
      notifyResolved: vi.fn(async (resolve: () => Promise<unknown>) => {
        await resolve();
        return [{ status: 'queued' }];
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TrainingSuspensionConflictsService,
        TrainingSessionService,
        TrainingAccessService,
        SuspensionGate,
        { provide: TrainingRepository, useValue: repositoryMock() },
        {
          provide: SuspensionsRepository,
          useValue: suspensionsRepositoryMock(),
        },
        { provide: MedicalService, useValue: medicalServiceMock() },
        { provide: NOTIFICATION_PUBLISHER, useValue: notifications },
      ],
    }).compile();

    service = module.get(TrainingSuspensionConflictsService);
    repo = module.get<Mocked<TrainingRepository>>(TrainingRepository);
    suspensionsRepo = module.get<Mocked<SuspensionsRepository>>(
      SuspensionsRepository,
    );
  });

  describe('getConflicts (GET /suspensions/:id/conflicts)', () => {
    it('computes and returns R28 conflict proposals on read for an assigned coach', async () => {
      const susp = makeSuspensionRow({
        startsOn: '2026-10-01',
        endsOn: '2026-10-14',
        blockedSessionTypes: ['SPARRING'],
        requiresClearance: true,
      });
      const s1 = makeSessionEntity({
        id: session1Id,
        sessionType: 'SPARRING',
        scheduledAt: '2026-10-05T10:00:00.000Z',
      });
      const sPad = makeSessionEntity({
        id: session2Id,
        sessionType: 'PAD_WORK',
        scheduledAt: '2026-10-06T10:00:00.000Z',
      });

      suspensionsRepo.findSuspensionById.mockResolvedValue(susp);
      suspensionsRepo.findSuspensionsByFighterId.mockResolvedValue([susp]);
      repo.isCoachAssignedToFighter.mockResolvedValue(true);
      repo.findScheduledSessionsByFighterId.mockResolvedValue([s1, sPad]);

      const proposals = await service.getConflicts(coachActor, suspensionId);
      expect(proposals).toEqual([
        {
          sessionId: session1Id,
          action: 'CHANGE_TYPE',
          toType: 'RECOVERY',
        },
      ]);
      expect(repo.updateSession).not.toHaveBeenCalled();
      expect(repo.updateSessionStatus).not.toHaveBeenCalled();
    });

    it('returns 404 SUSPENSION_NOT_FOUND when the suspension does not exist', async () => {
      suspensionsRepo.findSuspensionById.mockResolvedValue(undefined);

      await expect(
        service.getConflicts(adminActor, suspensionId),
      ).rejects.toSatisfy(
        (err: unknown) =>
          err instanceof NotFoundException &&
          responseOf(err).code === 'SUSPENSION_NOT_FOUND',
      );
    });

    it('forbids a coach, doctor, or fighter without access to the suspension fighter', async () => {
      const susp = makeSuspensionRow();
      suspensionsRepo.findSuspensionById.mockResolvedValue(susp);
      repo.isCoachAssignedToFighter.mockResolvedValue(false);
      repo.isDoctorAssignedToFighter.mockResolvedValue(false);
      repo.findActiveFighterIdByUserId.mockResolvedValue('other-fighter-id');

      await expect(
        service.getConflicts(coachActor, suspensionId),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        service.getConflicts(doctorActor, suspensionId),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        service.getConflicts(fighterActor, suspensionId),
      ).rejects.toThrow(ForbiddenException);
      expect(repo.findScheduledSessionsByFighterId).not.toHaveBeenCalled();
    });
  });

  describe('applyConflicts (POST /suspensions/:id/conflicts/apply)', () => {
    it('applies only the listed sessionIds and leaves omitted sessions untouched', async () => {
      const susp = makeSuspensionRow({
        startsOn: '2026-10-01',
        endsOn: '2026-10-14',
        blockedSessionTypes: ['SPARRING'],
        requiresClearance: false,
      });
      const s1 = makeSessionEntity({
        id: session1Id,
        sessionType: 'SPARRING',
        scheduledAt: '2026-10-05T10:00:00.000Z',
      });
      const s2 = makeSessionEntity({
        id: session2Id,
        sessionType: 'SPARRING',
        scheduledAt: '2026-10-07T10:00:00.000Z',
      });

      suspensionsRepo.findSuspensionById.mockResolvedValue(susp);
      suspensionsRepo.findSuspensionsByFighterId.mockResolvedValue([susp]);
      repo.isCoachAssignedToFighter.mockResolvedValue(true);
      repo.findScheduledSessionsByFighterId.mockResolvedValue([s1, s2]);
      repo.lockSessionById.mockImplementation(async (id) =>
        [s1, s2].find((s) => s.id === id),
      );
      repo.updateSession.mockImplementation(async (id, data) => ({
        ...s1,
        id,
        ...data,
      }));

      // Leave session2Id out of the apply list
      const updated = await service.applyConflicts(coachActor, suspensionId, {
        sessionIds: [session1Id],
      });

      expect(updated).toHaveLength(1);
      expect(updated[0]?.id).toBe(session1Id);
      expect(updated[0]?.sessionType).toBe('RECOVERY');
      expect(repo.updateSession).toHaveBeenCalledTimes(1);
      expect(repo.updateSession).toHaveBeenCalledWith(
        session1Id,
        { sessionType: 'RECOVERY' },
        expect.anything(),
      );
      expect(repo.lockSessionById).toHaveBeenCalledTimes(1);
      expect(repo.lockSessionById).toHaveBeenCalledWith(
        session1Id,
        expect.anything(),
      );
      // CHANGE_TYPE does not send a reschedule or cancel notification
      expect(notifications.notifyResolved).not.toHaveBeenCalled();
    });

    it('rejects a sessionId that is not in the current proposal with 422 and applies nothing', async () => {
      const susp = makeSuspensionRow({
        startsOn: '2026-10-01',
        endsOn: '2026-10-14',
        blockedSessionTypes: ['SPARRING'],
        requiresClearance: false,
      });
      const s1 = makeSessionEntity({
        id: session1Id,
        sessionType: 'SPARRING',
        scheduledAt: '2026-10-05T10:00:00.000Z',
      });

      suspensionsRepo.findSuspensionById.mockResolvedValue(susp);
      suspensionsRepo.findSuspensionsByFighterId.mockResolvedValue([susp]);
      repo.isCoachAssignedToFighter.mockResolvedValue(true);
      repo.findScheduledSessionsByFighterId.mockResolvedValue([s1]);

      await expect(
        service.applyConflicts(coachActor, suspensionId, {
          sessionIds: [session1Id, outsideSessionId],
        }),
      ).rejects.toSatisfy(
        (err: unknown) =>
          err instanceof UnprocessableEntityException &&
          (err as HttpException).getStatus() === 422 &&
          responseOf(err).code === 'VALIDATION_ERROR',
      );

      expect(repo.lockSessionById).not.toHaveBeenCalled();
      expect(repo.updateSession).not.toHaveBeenCalled();
      expect(repo.updateSessionStatus).not.toHaveBeenCalled();
      expect(notifications.notifyResolved).not.toHaveBeenCalled();
    });

    it('is atomic: a failure on the second session rolls back the first and sends no notifications', async () => {
      const susp = makeSuspensionRow({
        startsOn: '2026-10-01',
        endsOn: '2026-10-10',
        blockedSessionTypes: [...SESSION_TYPES],
        requiresClearance: false,
      });
      const s1 = makeSessionEntity({
        id: session1Id,
        sessionType: 'SPARRING',
        scheduledAt: '2026-10-05T10:00:00.000Z',
      });
      const s2 = makeSessionEntity({
        id: session2Id,
        sessionType: 'GRAPPLING',
        scheduledAt: '2026-10-06T10:00:00.000Z',
      });

      // Stateful store that snapshots on transaction start and restores on rollback
      const store = new Map<string, TrainingSessionEntity>([
        [session1Id, { ...s1 }],
        [session2Id, { ...s2 }],
      ]);

      repo.transaction.mockImplementation(async (work) => {
        const snapshot = new Map(
          [...store.entries()].map(([k, v]) => [k, { ...v }]),
        );
        const tx = { execute: vi.fn() };
        try {
          return await work(tx as never);
        } catch (err) {
          store.clear();
          for (const [k, v] of snapshot) store.set(k, v);
          throw err;
        }
      });

      suspensionsRepo.findSuspensionById.mockResolvedValue(susp);
      suspensionsRepo.findSuspensionsByFighterId.mockResolvedValue([susp]);
      repo.isCoachAssignedToFighter.mockResolvedValue(true);
      repo.findScheduledSessionsByFighterId.mockImplementation(async () => [
        ...store.values(),
      ]);
      repo.lockSessionById.mockImplementation(async (id) => store.get(id));
      repo.updateSession.mockImplementation(async (id, data) => {
        if (id === session2Id) {
          throw new Error('database failure on second session');
        }
        const current = store.get(id)!;
        const next: TrainingSessionEntity = {
          ...current,
          ...(data.scheduledAt ? { scheduledAt: data.scheduledAt } : {}),
          ...(data.sessionType ? { sessionType: data.sessionType } : {}),
          updatedAt: '2026-10-01T12:00:00.000Z',
        };
        store.set(id, next);
        return next;
      });

      await expect(
        service.applyConflicts(coachActor, suspensionId, {
          sessionIds: [session1Id, session2Id],
        }),
      ).rejects.toMatchObject({ status: 500 });

      // Transaction ran once and rolled back session 1's scheduledAt to its original value
      expect(repo.transaction).toHaveBeenCalledTimes(1);
      expect(store.get(session1Id)?.scheduledAt).toBe(
        '2026-10-05T10:00:00.000Z',
      );
      expect(notifications.notifyResolved).not.toHaveBeenCalled();
    });

    it('sends TRAINING_SESSION_RESCHEDULED and TRAINING_SESSION_CANCELLED notifications only AFTER transaction commit', async () => {
      const callOrder: string[] = [];

      // S1 (all types blocked, fixed end date 2026-10-10) -> session1 on 2026-10-05 is RESCHEDULED to 2026-10-11
      const suspFixed = makeSuspensionRow({
        id: suspensionId,
        startsOn: '2026-10-01',
        endsOn: '2026-10-10',
        blockedSessionTypes: [...SESSION_TYPES],
        requiresClearance: false,
      });
      // S2 (all types blocked, requires clearance, starts 2026-10-20) -> session2 on 2026-10-22 is CANCELLED
      const suspOpen = makeSuspensionRow({
        id: '70000000-0000-4000-8000-000000000002',
        startsOn: '2026-10-20',
        endsOn: '2026-10-25',
        blockedSessionTypes: [...SESSION_TYPES],
        requiresClearance: true,
      });
      // S3 (only SPARRING blocked on 2026-09-10..2026-09-15) -> session3 on 2026-09-12 is CHANGE_TYPE to RECOVERY
      const suspSparringOnly = makeSuspensionRow({
        id: '70000000-0000-4000-8000-000000000003',
        startsOn: '2026-09-10',
        endsOn: '2026-09-15',
        blockedSessionTypes: ['SPARRING'],
        requiresClearance: false,
      });

      const sReschedule = makeSessionEntity({
        id: session1Id,
        sessionType: 'SPARRING',
        scheduledAt: '2026-10-05T10:00:00.000Z',
      });
      const sCancel = makeSessionEntity({
        id: session2Id,
        sessionType: 'SPARRING',
        scheduledAt: '2026-10-22T10:00:00.000Z',
      });
      const sChangeType = makeSessionEntity({
        id: session3Id,
        sessionType: 'SPARRING',
        scheduledAt: '2026-09-12T10:00:00.000Z',
      });

      suspensionsRepo.findSuspensionById.mockResolvedValue(suspFixed);
      suspensionsRepo.findSuspensionsByFighterId.mockResolvedValue([
        suspFixed,
        suspOpen,
        suspSparringOnly,
      ]);
      repo.isCoachAssignedToFighter.mockResolvedValue(true);
      repo.findScheduledSessionsByFighterId.mockResolvedValue([
        sReschedule,
        sCancel,
        sChangeType,
      ]);
      repo.lockSessionById.mockImplementation(async (id) =>
        [sReschedule, sCancel, sChangeType].find((s) => s.id === id),
      );

      repo.transaction.mockImplementation(async (work) => {
        callOrder.push('tx:begin');
        const result = await work({ execute: vi.fn() } as never);
        callOrder.push('tx:commit');
        return result;
      });

      repo.updateSession.mockImplementation(async (id, data) => {
        callOrder.push(`repo:updateSession:${id}`);
        const base = id === session1Id ? sReschedule : sChangeType;
        return {
          ...base,
          ...(data.scheduledAt ? { scheduledAt: data.scheduledAt } : {}),
          ...(data.sessionType ? { sessionType: data.sessionType } : {}),
          updatedAt: '2026-10-01T12:00:00.000Z',
        };
      });

      repo.updateSessionStatus.mockImplementation(
        async (id, _expected, newStatus, _time, outcome) => {
          callOrder.push(`repo:updateSessionStatus:${id}`);
          return {
            ...sCancel,
            id,
            status: newStatus,
            cancellationReason: outcome.cancellationReason,
            cancelledAt: '2026-10-01T12:00:00.000Z',
            updatedAt: '2026-10-01T12:00:00.000Z',
          };
        },
      );

      const publishedPayloads: unknown[] = [];
      notifications.notifyResolved.mockImplementation(
        async (resolve: () => Promise<unknown[]>) => {
          const items = await resolve();
          publishedPayloads.push(...items);
          for (const item of items as Array<{ type: string }>) {
            callOrder.push(`notify:${item.type}`);
          }
          return [{ status: 'queued' }];
        },
      );

      const result = await service.applyConflicts(coachActor, suspensionId, {
        sessionIds: [session1Id, session2Id, session3Id],
      });

      expect(result).toHaveLength(3);
      expect(result[0]?.scheduledAt).toBe('2026-10-11T10:00:00.000Z');
      expect(result[1]?.status).toBe('CANCELLED');
      expect(result[1]?.cancellationReason).toBe(
        SUSPENSION_CONFLICT_CANCELLATION_REASON,
      );
      expect(result[2]?.sessionType).toBe('RECOVERY');

      expect(callOrder).toEqual([
        'tx:begin',
        `repo:updateSession:${session1Id}`,
        `repo:updateSessionStatus:${session2Id}`,
        `repo:updateSession:${session3Id}`,
        'tx:commit',
        `notify:${NOTIFICATION_TYPE.TRAINING_SESSION_RESCHEDULED}`,
        `notify:${NOTIFICATION_TYPE.TRAINING_SESSION_CANCELLED}`,
      ]);
      expect(publishedPayloads).toHaveLength(2);
    });

    it('forbids an unassigned coach or a doctor from applying conflicts', async () => {
      const susp = makeSuspensionRow();
      suspensionsRepo.findSuspensionById.mockResolvedValue(susp);
      repo.isCoachAssignedToFighter.mockResolvedValue(false);

      await expect(
        service.applyConflicts(coachActor, suspensionId, {
          sessionIds: [session1Id],
        }),
      ).rejects.toThrow(ForbiddenException);

      await expect(
        service.applyConflicts(doctorActor, suspensionId, {
          sessionIds: [session1Id],
        }),
      ).rejects.toThrow(ForbiddenException);

      expect(repo.transaction).not.toHaveBeenCalled();
    });
  });
});
