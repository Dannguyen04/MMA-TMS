import {
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
  type HttpException,
} from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { afterEach, beforeEach, describe, expect, it, vi, type Mocked } from 'vitest';
import type { SuspensionRow } from '../database/schema.js';
import { MedicalService } from '../medical/medical.service.js';
import {
  NOTIFICATION_PUBLISHER,
  NOTIFICATION_TYPE,
} from '../shared/contracts/notification.contract.js';
import type { AuthenticatedUser } from '../shared/models/auth-context.model.js';
import { USER } from '../shared/types/user.role.js';
import { SuspensionEffects } from '../suspensions/suspension.effects.js';
import { SuspensionGate } from '../suspensions/suspension.gate.js';
import { SESSION_TYPES } from '../suspensions/suspensions.model.js';
import { SuspensionsRepository } from '../suspensions/suspensions.repo.js';
import { SuspensionsService } from '../suspensions/suspensions.service.js';
import { TrainingSessionService } from './sessions/training-session.service.js';
import { TrainingAccessService } from './training-access.service.js';
import { SUSPENSION_CONFLICT_CANCELLATION_REASON } from './training.constants.js';
import type {
  TrainingPlanEntity,
  TrainingSessionEntity,
} from './training.model.js';
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
const outsideSessionId = '51c38f60-0f4e-48aa-848b-20f5ef828f99';
const plan1Id = '80000000-0000-4000-8000-000000000001';
const plan2Id = '80000000-0000-4000-8000-000000000002';

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

function makePlanEntity(
  over: Partial<TrainingPlanEntity> = {},
): TrainingPlanEntity {
  return {
    id: plan1Id,
    fighterId,
    coachId,
    title: 'Active Fight Camp Plan',
    description: null,
    startDate: '2026-09-01',
    endDate: '2026-11-01',
    status: 'ACTIVE',
    phase: 'fight_camp',
    goals: null,
    milestones: [],
    isActive: true,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    deletedAt: null,
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
    lockActiveCampPlansByFighterId: vi.fn().mockResolvedValue([]),
    updatePlan: vi.fn(),
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
  const transaction = { execute: vi.fn() };
  return {
    transaction: vi.fn(async (work) => work(transaction)),
    findSuspensionById: vi.fn(),
    findSuspensionsByFighterId: vi.fn().mockResolvedValue([]),
    isActiveFighter: vi.fn().mockResolvedValue(true),
    isCoachAssignedToFighter: vi.fn().mockResolvedValue(true),
    isDoctorAssignedToFighter: vi.fn().mockResolvedValue(true),
    insertSuspension: vi.fn(async (values: Partial<SuspensionRow>) =>
      makeSuspensionRow(values),
    ),
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

describe('TrainingSuspensionConflictsService (R28 / T-036)', () => {
  let service: TrainingSuspensionConflictsService;
  let suspensionEffects: SuspensionEffects;
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
        SuspensionEffects,
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
    suspensionEffects = module.get(SuspensionEffects);
    repo = module.get<Mocked<TrainingRepository>>(TrainingRepository);
    suspensionsRepo = module.get<Mocked<SuspensionsRepository>>(
      SuspensionsRepository,
    );
    service.onModuleInit();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-05T10:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('getConflicts (GET /suspensions/:id/conflicts)', () => {
    it('computes and returns CANCEL or PENDING conflict proposals on read for an assigned coach', async () => {
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
          action: 'CANCEL',
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

    it('F4: filters proposals to suspension :id period and blocked type, and returns [] when not in force', async () => {
      const otherSuspensionId = '70000000-0000-4000-8000-000000000002';
      vi.setSystemTime(new Date('2026-10-05T10:00:00.000Z'));

      const suspA = makeSuspensionRow({
        id: suspensionId,
        startsOn: '2026-10-01',
        endsOn: '2026-10-14',
        blockedSessionTypes: ['SPARRING'],
        requiresClearance: false,
      });
      const suspB = makeSuspensionRow({
        id: otherSuspensionId,
        startsOn: '2026-10-20',
        endsOn: '2026-10-30',
        blockedSessionTypes: ['GRAPPLING'],
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
        scheduledAt: '2026-10-25T10:00:00.000Z',
      });

      repo.isCoachAssignedToFighter.mockResolvedValue(true);
      suspensionsRepo.findSuspensionsByFighterId.mockResolvedValue([
        suspA,
        suspB,
      ]);
      repo.findScheduledSessionsByFighterId.mockResolvedValue([s1, s2]);

      suspensionsRepo.findSuspensionById.mockResolvedValue(suspA);
      const proposalsA = await service.getConflicts(coachActor, suspensionId);
      expect(proposalsA).toEqual([
        {
          sessionId: session1Id,
          action: 'PENDING',
        },
      ]);

      suspensionsRepo.findSuspensionById.mockResolvedValue(suspB);
      const proposalsBBefore = await service.getConflicts(
        coachActor,
        otherSuspensionId,
      );
      expect(proposalsBBefore).toEqual([]);

      vi.setSystemTime(new Date('2026-10-22T10:00:00.000Z'));
      const proposalsBInForce = await service.getConflicts(
        coachActor,
        otherSuspensionId,
      );
      expect(proposalsBInForce).toEqual([
        {
          sessionId: session2Id,
          action: 'PENDING',
        },
      ]);
    });

    it('F5: loads all scheduled sessions without a 100-row cap and plans them all', async () => {
      const susp = makeSuspensionRow({
        startsOn: '2026-10-01',
        endsOn: '2026-10-14',
        blockedSessionTypes: ['SPARRING'],
        requiresClearance: false,
      });

      const manySessions: TrainingSessionEntity[] = Array.from(
        { length: 105 },
        (_, i) =>
          makeSessionEntity({
            id: `51c38f60-0f4e-48aa-848b-${String(i).padStart(12, '0')}`,
            sessionType: 'SPARRING',
            scheduledAt: '2026-10-05T10:00:00.000Z',
          }),
      );

      suspensionsRepo.findSuspensionById.mockResolvedValue(susp);
      suspensionsRepo.findSuspensionsByFighterId.mockResolvedValue([susp]);
      repo.isCoachAssignedToFighter.mockResolvedValue(true);
      repo.findScheduledSessionsByFighterId.mockResolvedValue(manySessions);

      const proposals = await service.getConflicts(coachActor, suspensionId);
      expect(proposals).toHaveLength(105);
      expect(repo.findScheduledSessionsByFighterId).toHaveBeenCalledWith(
        fighterId,
        undefined,
      );
    });
  });

  describe('applyConflicts (POST /suspensions/:id/conflicts/apply)', () => {
    it('applies PENDING to the listed sessionIds and leaves omitted sessions untouched without sending notifications', async () => {
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
      repo.updateSessionStatus.mockImplementation(
        async (id, _expected, newStatus) => ({
          ...s1,
          id,
          status: newStatus,
        }),
      );

      const updated = await service.applyConflicts(coachActor, suspensionId, {
        sessionIds: [session1Id],
      });

      expect(updated).toHaveLength(1);
      expect(updated[0]?.id).toBe(session1Id);
      expect(updated[0]?.status).toBe('PENDING');
      expect(repo.updateSessionStatus).toHaveBeenCalledTimes(1);
      expect(repo.updateSessionStatus).toHaveBeenCalledWith(
        session1Id,
        'SCHEDULED',
        'PENDING',
        expect.any(Date),
        { cancellationReason: null, actualDurationSec: null },
        expect.anything(),
      );
      expect(repo.lockSessionById).toHaveBeenCalledTimes(1);
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

    it('rejects POST apply payload containing legacy action CHANGE_TYPE with 422 VALIDATION_ERROR', async () => {
      await expect(
        service.applyConflicts(
          coachActor,
          suspensionId,
          {
            sessionIds: [session1Id],
            action: 'CHANGE_TYPE',
          } as never,
        ),
      ).rejects.toSatisfy(
        (err: unknown) =>
          err instanceof UnprocessableEntityException &&
          (err as HttpException).getStatus() === 422 &&
          responseOf(err).code === 'VALIDATION_ERROR',
      );

      expect(repo.lockSessionById).not.toHaveBeenCalled();
      expect(repo.updateSessionStatus).not.toHaveBeenCalled();
    });

    it('F3: rejects apply if session transitions to IN_PROGRESS between proposal and lock, modifying nothing', async () => {
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
        status: 'SCHEDULED',
      });

      suspensionsRepo.findSuspensionById.mockResolvedValue(susp);
      suspensionsRepo.findSuspensionsByFighterId.mockResolvedValue([susp]);
      repo.isCoachAssignedToFighter.mockResolvedValue(true);
      repo.findScheduledSessionsByFighterId.mockResolvedValue([s1]);
      repo.lockSessionById.mockResolvedValue({
        ...s1,
        status: 'IN_PROGRESS',
      });

      await expect(
        service.applyConflicts(coachActor, suspensionId, {
          sessionIds: [session1Id],
        }),
      ).rejects.toSatisfy((err: unknown) => {
        const resp = responseOf(err);
        return (
          err instanceof UnprocessableEntityException &&
          (err as HttpException).getStatus() === 422 &&
          resp.code === 'VALIDATION_ERROR' &&
          resp.message === `Session ${session1Id} is not in the current conflict proposal`
        );
      });

      expect(repo.updateSession).not.toHaveBeenCalled();
      expect(repo.updateSessionStatus).not.toHaveBeenCalled();
      expect(notifications.notifyResolved).not.toHaveBeenCalled();
    });

    it('sends TRAINING_SESSION_CANCELLED notification only AFTER transaction commit for CANCEL and none for PENDING', async () => {
      const callOrder: string[] = [];

      const suspFixed = makeSuspensionRow({
        id: suspensionId,
        startsOn: '2026-10-01',
        endsOn: '2026-10-10',
        blockedSessionTypes: [...SESSION_TYPES],
        requiresClearance: false,
      });
      const suspOpen = makeSuspensionRow({
        id: '70000000-0000-4000-8000-000000000002',
        startsOn: '2026-10-20',
        endsOn: '2026-10-25',
        blockedSessionTypes: [...SESSION_TYPES],
        requiresClearance: true,
      });

      const sPending = makeSessionEntity({
        id: session1Id,
        sessionType: 'SPARRING',
        scheduledAt: '2026-10-05T10:00:00.000Z',
      });
      const sCancel = makeSessionEntity({
        id: session2Id,
        sessionType: 'SPARRING',
        scheduledAt: '2026-10-22T10:00:00.000Z',
      });

      suspensionsRepo.findSuspensionById.mockResolvedValue(suspFixed);
      suspensionsRepo.findSuspensionsByFighterId.mockResolvedValue([
        suspFixed,
        suspOpen,
      ]);
      repo.isCoachAssignedToFighter.mockResolvedValue(true);
      repo.findScheduledSessionsByFighterId.mockResolvedValue([
        sPending,
        sCancel,
      ]);
      repo.lockSessionById.mockImplementation(async (id) =>
        [sPending, sCancel].find((s) => s.id === id),
      );

      repo.transaction.mockImplementation(async (work) => {
        callOrder.push('tx:begin');
        const result = await work({ execute: vi.fn() } as never);
        callOrder.push('tx:commit');
        return result;
      });

      repo.updateSessionStatus.mockImplementation(
        async (id, _expected, newStatus, _time, outcome) => {
          callOrder.push(`repo:updateSessionStatus:${id}:${newStatus}`);
          return {
            ...(id === session1Id ? sPending : sCancel),
            id,
            status: newStatus,
            cancellationReason: outcome.cancellationReason,
            cancelledAt:
              newStatus === 'CANCELLED' ? '2026-10-01T12:00:00.000Z' : null,
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

      vi.setSystemTime(new Date('2026-10-05T10:00:00.000Z'));
      const result1 = await service.applyConflicts(coachActor, suspFixed.id, {
        sessionIds: [session1Id],
      });
      expect(result1[0]?.status).toBe('PENDING');

      suspensionsRepo.findSuspensionById.mockResolvedValue(suspOpen);
      vi.setSystemTime(new Date('2026-10-22T10:00:00.000Z'));
      const result2 = await service.applyConflicts(coachActor, suspOpen.id, {
        sessionIds: [session2Id],
      });
      expect(result2[0]?.status).toBe('CANCELLED');
      expect(result2[0]?.cancellationReason).toBe(
        SUSPENSION_CONFLICT_CANCELLATION_REASON,
      );

      expect(callOrder).toEqual([
        'tx:begin',
        `repo:updateSessionStatus:${session1Id}:PENDING`,
        'tx:commit',
        'tx:begin',
        `repo:updateSessionStatus:${session2Id}:CANCELLED`,
        'tx:commit',
        `notify:${NOTIFICATION_TYPE.TRAINING_SESSION_CANCELLED}`,
      ]);
      expect(publishedPayloads).toHaveLength(1);
    });
  });

  describe('Automatic conflict application & plan phase transition on suspension creation (Criteria 3, 4, 6)', () => {
    it('Criterion 3: POST /suspensions creating a DQ suspension (requiresClearance = false) moves a SCHEDULED SPARRING session to PENDING in the same transaction, returns affectedSessions and affectedPlans: [], and sends no cancel notification', async () => {
      const s1 = makeSessionEntity({
        id: session1Id,
        sessionType: 'SPARRING',
        scheduledAt: '2026-10-05T10:00:00.000Z',
        status: 'SCHEDULED',
      });

      const dqRow = makeSuspensionRow({
        id: suspensionId,
        reason: 'DQ',
        startsOn: '2026-10-05',
        endsOn: '2026-10-14',
        blockedSessionTypes: ['SPARRING'],
        requiresClearance: false,
      });

      suspensionsRepo.insertSuspension.mockResolvedValue(dqRow);
      suspensionsRepo.findSuspensionsByFighterId.mockResolvedValue([dqRow]);
      repo.findScheduledSessionsByFighterId.mockResolvedValue([s1]);
      repo.lockSessionById.mockResolvedValue(s1);
      repo.updateSessionStatus.mockImplementation(
        async (id, _expected, newStatus) => ({
          ...s1,
          id,
          status: newStatus,
        }),
      );

      const suspensionsService = new SuspensionsService(
        suspensionsRepo,
        suspensionEffects,
      );
      const res = await suspensionsService.createSuspension(
        coachActor,
        {
          fighterId,
          reason: 'DQ',
          days: 10,
          blockedSessionTypes: ['SPARRING'],
        },
        'req-dq-1',
      );

      expect(repo.updateSessionStatus).toHaveBeenCalledWith(
        session1Id,
        'SCHEDULED',
        'PENDING',
        expect.any(Date),
        { cancellationReason: null, actualDurationSec: null },
        expect.anything(),
      );
      expect(repo.lockActiveCampPlansByFighterId).not.toHaveBeenCalled();
      expect(res.affectedSessions).toEqual([
        { sessionId: session1Id, action: 'PENDING' },
      ]);
      expect(res.affectedPlans).toEqual([]);
      expect(notifications.notifyResolved).not.toHaveBeenCalled();
    });

    it('only applies proposals for sessions blocked by the newly created suspension(s), leaving a SCHEDULED session under an older non-overlapping OTHER suspension untouched', async () => {
      const novSession = makeSessionEntity({
        id: session1Id,
        sessionType: 'SPARRING',
        scheduledAt: '2026-11-03T10:00:00.000Z',
        status: 'SCHEDULED',
      });
      const decSession = makeSessionEntity({
        id: session2Id,
        sessionType: 'SPARRING',
        scheduledAt: '2026-12-02T10:00:00.000Z',
        status: 'SCHEDULED',
      });

      const oldOtherSuspension = makeSuspensionRow({
        id: '70000000-0000-4000-8000-000000000010',
        reason: 'OTHER',
        startsOn: '2026-11-01',
        endsOn: '2026-11-07',
        blockedSessionTypes: ['SPARRING'],
        requiresClearance: false,
      });
      const newMandatoryRestSuspension = makeSuspensionRow({
        id: '70000000-0000-4000-8000-000000000011',
        reason: 'MANDATORY_REST',
        startsOn: '2026-12-01',
        endsOn: '2026-12-03',
        blockedSessionTypes: ['SPARRING'],
        requiresClearance: false,
      });

      suspensionsRepo.insertSuspension.mockResolvedValueOnce(
        newMandatoryRestSuspension,
      );
      suspensionsRepo.findSuspensionsByFighterId.mockResolvedValueOnce([
        oldOtherSuspension,
        newMandatoryRestSuspension,
      ]);
      repo.findScheduledSessionsByFighterId.mockResolvedValueOnce([novSession]);

      const suspensionsService = new SuspensionsService(
        suspensionsRepo,
        suspensionEffects,
      );
      const resNoDecSession = await suspensionsService.createSuspension(
        coachActor,
        {
          fighterId,
          reason: 'MANDATORY_REST',
          startsOn: '2026-12-01',
          days: 3,
          blockedSessionTypes: ['SPARRING'],
        },
        'req-rest-only-nov-session',
      );

      // The Nov 3 session belongs only to the older Nov 1-7 OTHER suspension and must NOT be touched
      expect(resNoDecSession.affectedSessions).toEqual([]);
      expect(repo.lockSessionById).not.toHaveBeenCalled();
      expect(repo.updateSessionStatus).not.toHaveBeenCalled();

      // When a Dec 2 session also exists and an open-ended suspension requiring clearance is in force,
      // only the Dec 2 session is affected and its action (CANCEL) is still computed across all in-force suspensions
      const existingOpenMedical = makeSuspensionRow({
        id: '70000000-0000-4000-8000-000000000012',
        reason: 'MEDICAL',
        startsOn: '2026-11-20',
        endsOn: '2026-11-25',
        blockedSessionTypes: ['SPARRING'],
        requiresClearance: true,
        clearedAt: null,
      });
      suspensionsRepo.insertSuspension.mockResolvedValueOnce(
        newMandatoryRestSuspension,
      );
      suspensionsRepo.findSuspensionsByFighterId.mockResolvedValueOnce([
        oldOtherSuspension,
        existingOpenMedical,
        newMandatoryRestSuspension,
      ]);
      repo.findScheduledSessionsByFighterId.mockResolvedValueOnce([
        novSession,
        decSession,
      ]);
      repo.lockSessionById.mockResolvedValueOnce(decSession);
      repo.updateSessionStatus.mockImplementationOnce(
        async (id, _expected, newStatus) => ({
          ...decSession,
          id,
          status: newStatus,
        }),
      );

      const resWithDecSession = await suspensionsService.createSuspension(
        coachActor,
        {
          fighterId,
          reason: 'MANDATORY_REST',
          startsOn: '2026-12-01',
          days: 3,
          blockedSessionTypes: ['SPARRING'],
        },
        'req-rest-with-dec-session',
      );

      expect(resWithDecSession.affectedSessions).toEqual([
        { sessionId: session2Id, action: 'CANCEL' },
      ]);
      expect(repo.lockSessionById).toHaveBeenCalledTimes(1);
      expect(repo.lockSessionById).toHaveBeenCalledWith(
        session2Id,
        expect.anything(),
      );
    });

    it('skips sessions that are no longer SCHEDULED after row locking without modifying them, throwing, or adding them to affectedSessions: (a) coach starts session to IN_PROGRESS concurrently during CANCEL; (b) concurrent suspension already moved session to CANCELLED before PENDING', async () => {
      const s1 = makeSessionEntity({
        id: session1Id,
        sessionType: 'SPARRING',
        scheduledAt: '2026-10-05T10:00:00.000Z',
        status: 'SCHEDULED',
      });
      const s2 = makeSessionEntity({
        id: session2Id,
        sessionType: 'SPARRING',
        scheduledAt: '2026-10-07T10:00:00.000Z',
        status: 'SCHEDULED',
      });

      const suspensionsService = new SuspensionsService(
        suspensionsRepo,
        suspensionEffects,
      );

      // (a) Session 1 becomes IN_PROGRESS before lockSessionById resolves during a KO/MEDICAL (CANCEL) suspension creation
      const medicalRow = makeSuspensionRow({
        id: suspensionId,
        reason: 'MEDICAL',
        startsOn: '2026-10-05',
        endsOn: '2026-10-14',
        blockedSessionTypes: ['SPARRING'],
        requiresClearance: true,
        createdById: doctorActor.id,
      });
      suspensionsRepo.insertSuspension.mockResolvedValueOnce(medicalRow);
      suspensionsRepo.findSuspensionsByFighterId.mockResolvedValueOnce([
        medicalRow,
      ]);
      repo.findScheduledSessionsByFighterId.mockResolvedValueOnce([s1, s2]);
      repo.lockSessionById.mockImplementation(async (id) =>
        id === session1Id ? { ...s1, status: 'IN_PROGRESS' } : s2,
      );
      repo.lockActiveCampPlansByFighterId.mockResolvedValueOnce([]);
      repo.updateSessionStatus.mockImplementation(
        async (id, _expected, newStatus) => ({
          ...s2,
          id,
          status: newStatus,
        }),
      );
      notifications.notifyResolved.mockClear();

      const resA = await suspensionsService.createSuspension(
        doctorActor,
        {
          fighterId,
          reason: 'MEDICAL',
          days: 10,
          blockedSessionTypes: ['SPARRING'],
        },
        'req-concurrent-in-progress',
      );

      // Session 1 (IN_PROGRESS) was skipped; only Session 2 (still SCHEDULED) was cancelled
      expect(resA.affectedSessions).toEqual([
        { sessionId: session2Id, action: 'CANCEL' },
      ]);
      expect(repo.updateSessionStatus).toHaveBeenCalledTimes(1);
      expect(repo.updateSessionStatus).toHaveBeenCalledWith(
        session2Id,
        'SCHEDULED',
        'CANCELLED',
        expect.any(Date),
        expect.anything(),
        expect.anything(),
      );
      expect(notifications.notifyResolved).toHaveBeenCalledTimes(1);

      // (b) Session 1 is already CANCELLED when locked during a DQ (PENDING) suspension creation
      repo.updateSessionStatus.mockClear();
      notifications.notifyResolved.mockClear();
      const dqRow = makeSuspensionRow({
        id: '70000000-0000-4000-8000-000000000022',
        reason: 'DQ',
        startsOn: '2026-10-05',
        endsOn: '2026-10-14',
        blockedSessionTypes: ['SPARRING'],
        requiresClearance: false,
      });
      suspensionsRepo.insertSuspension.mockResolvedValueOnce(dqRow);
      suspensionsRepo.findSuspensionsByFighterId.mockResolvedValueOnce([dqRow]);
      repo.findScheduledSessionsByFighterId.mockResolvedValueOnce([s1, s2]);
      repo.lockSessionById.mockImplementation(async (id) =>
        id === session1Id ? { ...s1, status: 'CANCELLED' } : s2,
      );
      repo.updateSessionStatus.mockImplementation(
        async (id, _expected, newStatus) => ({
          ...s2,
          id,
          status: newStatus,
        }),
      );

      const resB = await suspensionsService.createSuspension(
        coachActor,
        {
          fighterId,
          reason: 'DQ',
          days: 10,
          blockedSessionTypes: ['SPARRING'],
        },
        'req-concurrent-cancelled',
      );

      // Does not throw invalidSessionStatusTransition; skips session1Id and moves session2Id to PENDING
      expect(resB.affectedSessions).toEqual([
        { sessionId: session2Id, action: 'PENDING' },
      ]);
      expect(repo.updateSessionStatus).toHaveBeenCalledTimes(1);
      expect(repo.updateSessionStatus).toHaveBeenCalledWith(
        session2Id,
        'SCHEDULED',
        'PENDING',
        expect.any(Date),
        { cancellationReason: null, actualDurationSec: null },
        expect.anything(),
      );
      expect(notifications.notifyResolved).not.toHaveBeenCalled();
    });

    it('afterCommit notification hook: (a) does not call notifySessionCancelled if transaction throws after runOnCreated; (b) calls notifySessionCancelled once per CANCEL session after transaction commit; (c) sends no notification for PENDING sessions', async () => {
      const sessionService =
        (service as unknown as { sessionService: TrainingSessionService })
          .sessionService;
      const notifyCancelledSpy = vi.spyOn(
        sessionService,
        'notifySessionCancelled',
      );

      const s1 = makeSessionEntity({
        id: session1Id,
        sessionType: 'SPARRING',
        scheduledAt: '2026-10-05T10:00:00.000Z',
        status: 'SCHEDULED',
      });
      const s2 = makeSessionEntity({
        id: session2Id,
        sessionType: 'SPARRING',
        scheduledAt: '2026-10-07T10:00:00.000Z',
        status: 'SCHEDULED',
      });

      const medicalRow = makeSuspensionRow({
        id: suspensionId,
        reason: 'MEDICAL',
        startsOn: '2026-10-05',
        endsOn: '2026-10-14',
        blockedSessionTypes: ['SPARRING'],
        requiresClearance: true,
        createdById: doctorActor.id,
      });

      suspensionsRepo.insertSuspension.mockResolvedValue(medicalRow);
      suspensionsRepo.findSuspensionsByFighterId.mockResolvedValue([medicalRow]);
      repo.findScheduledSessionsByFighterId.mockResolvedValue([s1, s2]);
      repo.lockSessionById.mockImplementation(async (id) =>
        [s1, s2].find((s) => s.id === id),
      );
      repo.lockActiveCampPlansByFighterId.mockResolvedValue([]);

      const callOrder: string[] = [];
      repo.updateSessionStatus.mockImplementation(
        async (id, _expected, newStatus, _time, outcome) => {
          callOrder.push(`db:updateSessionStatus:${id}:${newStatus}`);
          return {
            ...(id === session1Id ? s1 : s2),
            id,
            status: newStatus,
            cancellationReason: outcome.cancellationReason,
          };
        },
      );
      notifyCancelledSpy.mockImplementation(async (actor, session) => {
        callOrder.push(`notify:${session.id}`);
        return [{ status: 'queued' }] as never;
      });

      const suspensionsService = new SuspensionsService(
        suspensionsRepo,
        suspensionEffects,
      );

      // (a) Transaction throws after runOnCreated -> notifySessionCancelled is NOT called
      suspensionsRepo.transaction.mockImplementationOnce(async (work) => {
        callOrder.push('tx:begin');
        await work({ execute: vi.fn() } as never);
        callOrder.push('tx:rollback');
        throw new Error('Transaction failed after runOnCreated');
      });

      await expect(
        suspensionsService.createSuspension(
          doctorActor,
          {
            fighterId,
            reason: 'MEDICAL',
            days: 10,
            blockedSessionTypes: ['SPARRING'],
          },
          'req-med-rollback',
        ),
      ).rejects.toThrow();

      expect(notifyCancelledSpy).not.toHaveBeenCalled();
      expect(callOrder).toEqual([
        'tx:begin',
        `db:updateSessionStatus:${session1Id}:CANCELLED`,
        `db:updateSessionStatus:${session2Id}:CANCELLED`,
        'tx:rollback',
      ]);

      // (b) Transaction commits -> notifySessionCancelled called once per CANCEL session AFTER commit
      callOrder.length = 0;
      notifyCancelledSpy.mockClear();
      suspensionsRepo.transaction.mockImplementationOnce(async (work) => {
        callOrder.push('tx:begin');
        const out = await work({ execute: vi.fn() } as never);
        callOrder.push('tx:commit');
        return out;
      });

      const created = await suspensionsService.createSuspension(
        doctorActor,
        {
          fighterId,
          reason: 'MEDICAL',
          days: 10,
          blockedSessionTypes: ['SPARRING'],
        },
        'req-med-commit',
      );

      expect(notifyCancelledSpy).toHaveBeenCalledTimes(2);
      expect(notifyCancelledSpy).toHaveBeenNthCalledWith(
        1,
        { id: doctorActor.id },
        expect.objectContaining({ id: session1Id, status: 'CANCELLED' }),
      );
      expect(notifyCancelledSpy).toHaveBeenNthCalledWith(
        2,
        { id: doctorActor.id },
        expect.objectContaining({ id: session2Id, status: 'CANCELLED' }),
      );
      expect(callOrder).toEqual([
        'tx:begin',
        `db:updateSessionStatus:${session1Id}:CANCELLED`,
        `db:updateSessionStatus:${session2Id}:CANCELLED`,
        'tx:commit',
        `notify:${session1Id}`,
        `notify:${session2Id}`,
      ]);
      expect('afterCommit' in created).toBe(false);

      // (c) PENDING sessions do not trigger notifySessionCancelled
      notifyCancelledSpy.mockClear();
      const dqRow = makeSuspensionRow({
        id: suspensionId,
        reason: 'DQ',
        startsOn: '2026-10-05',
        endsOn: '2026-10-14',
        blockedSessionTypes: ['SPARRING'],
        requiresClearance: false,
      });
      suspensionsRepo.insertSuspension.mockResolvedValueOnce(dqRow);
      suspensionsRepo.findSuspensionsByFighterId.mockResolvedValueOnce([dqRow]);

      const createdDq = await suspensionsService.createSuspension(
        coachActor,
        {
          fighterId,
          reason: 'DQ',
          days: 10,
          blockedSessionTypes: ['SPARRING'],
        },
        'req-dq-pending',
      );
      expect(createdDq.affectedSessions).toEqual([
        { sessionId: session1Id, action: 'PENDING' },
        { sessionId: session2Id, action: 'PENDING' },
      ]);
      expect(notifyCancelledSpy).not.toHaveBeenCalled();
    });

    it('Criterion 6: KO, TKO, and MEDICAL suspensions transition ACTIVE fight_camp and taper plans to rehab, while ignoring base/build/rehab/maintenance/non-ACTIVE/soft-deleted plans and ignoring DQ/MANDATORY_REST/OTHER reasons', async () => {
      const fightCampPlan = makePlanEntity({
        id: plan2Id,
        phase: 'fight_camp',
        status: 'ACTIVE',
        isActive: true,
        deletedAt: null,
      });
      const taperPlan = makePlanEntity({
        id: plan1Id,
        phase: 'taper',
        status: 'ACTIVE',
        isActive: true,
        deletedAt: null,
      });
      const basePlan = makePlanEntity({
        id: '80000000-0000-4000-8000-000000000003',
        phase: 'base',
        status: 'ACTIVE',
      });
      const buildPlan = makePlanEntity({
        id: '80000000-0000-4000-8000-000000000004',
        phase: 'build',
        status: 'ACTIVE',
      });
      const rehabPlan = makePlanEntity({
        id: '80000000-0000-4000-8000-000000000005',
        phase: 'rehab',
        status: 'ACTIVE',
      });
      const maintenancePlan = makePlanEntity({
        id: '80000000-0000-4000-8000-000000000006',
        phase: 'maintenance',
        status: 'ACTIVE',
      });
      const draftCampPlan = makePlanEntity({
        id: '80000000-0000-4000-8000-000000000007',
        phase: 'fight_camp',
        status: 'DRAFT',
      });
      const completedCampPlan = makePlanEntity({
        id: '80000000-0000-4000-8000-000000000008',
        phase: 'fight_camp',
        status: 'COMPLETED',
      });
      const cancelledCampPlan = makePlanEntity({
        id: '80000000-0000-4000-8000-000000000009',
        phase: 'taper',
        status: 'CANCELLED',
      });
      const deletedCampPlan = makePlanEntity({
        id: '80000000-0000-4000-8000-000000000010',
        phase: 'fight_camp',
        status: 'ACTIVE',
        deletedAt: '2026-10-01T00:00:00.000Z',
      });

      const tx = { execute: vi.fn() };
      repo.findScheduledSessionsByFighterId.mockResolvedValue([]);
      repo.lockActiveCampPlansByFighterId.mockResolvedValue([
        fightCampPlan,
        taperPlan,
        basePlan,
        buildPlan,
        rehabPlan,
        maintenancePlan,
        draftCampPlan,
        completedCampPlan,
        cancelledCampPlan,
        deletedCampPlan,
      ]);
      repo.updatePlan.mockImplementation(async (id, data) => ({
        ...fightCampPlan,
        id,
        ...data,
      }));

      for (const reason of ['KO', 'TKO', 'MEDICAL'] as const) {
        repo.updatePlan.mockClear();
        const susp = makeSuspensionRow({
          reason,
          requiresClearance: true,
        });
        suspensionsRepo.findSuspensionsByFighterId.mockResolvedValue([susp]);

        const effect = await suspensionEffects.runOnCreated(
          [susp],
          tx as never,
        );

        // Ordered by planId ascending: plan1Id (taper), then plan2Id (fight_camp)
        expect(effect.affectedPlans).toEqual([
          { planId: plan1Id, fromPhase: 'taper', toPhase: 'rehab' },
          { planId: plan2Id, fromPhase: 'fight_camp', toPhase: 'rehab' },
        ]);
        expect(repo.updatePlan).toHaveBeenCalledTimes(2);
        expect(repo.updatePlan).toHaveBeenNthCalledWith(
          1,
          plan1Id,
          { phase: 'rehab' },
          tx,
        );
        expect(repo.updatePlan).toHaveBeenNthCalledWith(
          2,
          plan2Id,
          { phase: 'rehab' },
          tx,
        );
      }

      for (const reason of ['DQ', 'MANDATORY_REST', 'OTHER'] as const) {
        repo.lockActiveCampPlansByFighterId.mockClear();
        repo.updatePlan.mockClear();
        const susp = makeSuspensionRow({
          reason,
          requiresClearance: false,
        });
        suspensionsRepo.findSuspensionsByFighterId.mockResolvedValue([susp]);

        const effect = await suspensionEffects.runOnCreated(
          [susp],
          tx as never,
        );

        expect(effect.affectedPlans).toEqual([]);
        expect(repo.lockActiveCampPlansByFighterId).not.toHaveBeenCalled();
        expect(repo.updatePlan).not.toHaveBeenCalled();
      }
    });
  });
});
