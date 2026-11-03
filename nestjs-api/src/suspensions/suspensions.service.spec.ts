import { HttpException } from '@nestjs/common';
import type { SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mocked } from 'vitest';
import type { AcademySettingsRepository } from '../academy-settings/academy-settings.repo.js';
import type { SuspensionRow } from '../database/schema.js';
import type { AuthenticatedUser } from '../shared/models/auth-context.model.js';
import { USER } from '../shared/types/user.role.js';
import type { Transaction } from '../shared/utils/audit-context.util.js';
import { SuspensionEffects } from './suspension.effects.js';
import type {
  CreateSuspensionInput,
  SuspensionResponse,
} from './suspensions.model.js';
import { SuspensionsRepository } from './suspensions.repo.js';
import { SuspensionsService } from './suspensions.service.js';

const NOW = new Date('2026-10-20T03:00:00.000Z'); // 2026-10-20 10:00 in Vietnam
const FIGHTER_ID = '10000000-0000-4000-8000-000000000001';
const OTHER_FIGHTER_ID = '10000000-0000-4000-8000-000000000002';
const SUSPENSION_ID = '50000000-0000-4000-8000-000000000001';
const REQUEST_ID = 'req-susp-1';

const coachActor: AuthenticatedUser = {
  id: '20000000-0000-4000-8000-000000000001',
  authSubject: 'coach-sub-1',
  email: 'coach@example.com',
  role: USER.COACH,
};
const doctorActor: AuthenticatedUser = {
  id: '30000000-0000-4000-8000-000000000001',
  authSubject: 'doctor-sub-1',
  email: 'doctor@example.com',
  role: USER.DOCTOR,
};
const adminActor: AuthenticatedUser = {
  id: '40000000-0000-4000-8000-000000000001',
  authSubject: 'admin-sub-1',
  email: 'admin@example.com',
  role: USER.ADMIN,
};
const fighterActor: AuthenticatedUser = {
  id: '60000000-0000-4000-8000-000000000001',
  authSubject: 'fighter-sub-1',
  email: 'fighter@example.com',
  role: USER.FIGHTER,
};

function makeSuspension(over: Partial<SuspensionRow> = {}): SuspensionRow {
  return {
    id: SUSPENSION_ID,
    fighterId: FIGHTER_ID,
    boutId: null,
    reason: 'KO',
    startsOn: '2026-10-20',
    endsOn: '2026-11-18',
    lossOfConsciousness: 'UNDER_1_MIN',
    suggestedDays: null,
    overrideReason: null,
    blockedSessionTypes: ['SPARRING'],
    requiresClearance: true,
    clearedAt: null,
    clearedById: null,
    clearanceNote: null,
    createdById: coachActor.id,
    createdAt: new Date('2026-10-20T03:00:00.000Z'),
    updatedAt: new Date('2026-10-20T03:00:00.000Z'),
    deletedAt: null,
    issuedBy: 'CLUB',
    issuerReference: null,
    earlyEndExaminationId: null,
    liftReference: null,
    ...over,
  };
}

async function expectHttp(
  promise: Promise<unknown>,
  status: number,
  code?: string,
): Promise<void> {
  try {
    await promise;
    expect.unreachable(`Expected HTTP ${status}`);
  } catch (error) {
    expect(error).toBeInstanceOf(HttpException);
    const http = error as HttpException;
    expect(http.getStatus()).toBe(status);
    if (code) {
      expect(http.getResponse()).toMatchObject({ code });
    }
  }
}

describe('SuspensionsService', () => {
  let repo: Mocked<SuspensionsRepository>;
  let settings: { getMedicalSupervision: ReturnType<typeof vi.fn> };
  let txExecute: ReturnType<typeof vi.fn>;
  let service: SuspensionsService;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    txExecute = vi.fn().mockResolvedValue(undefined);
    const tx = { execute: txExecute } as unknown as Transaction;

    repo = {
      transaction: vi.fn((work: (t: Transaction) => Promise<unknown>) =>
        work(tx),
      ),
      findActiveFighterIdByUserId: vi.fn().mockResolvedValue(FIGHTER_ID),
      isActiveFighter: vi.fn().mockResolvedValue(true),
      isCoachAssignedToFighter: vi.fn().mockResolvedValue(true),
      isDoctorAssignedToFighter: vi.fn().mockResolvedValue(true),
      findSuspensionById: vi.fn().mockResolvedValue(makeSuspension()),
      lockSuspensionById: vi.fn().mockResolvedValue(makeSuspension()),
      listSuspensions: vi.fn().mockResolvedValue([]),
      insertSuspension: vi.fn(async (values: Partial<SuspensionRow>) =>
        makeSuspension(values),
      ),
      clearSuspension: vi.fn(
        async (
          id: string,
          values: Partial<SuspensionRow>,
        ) => {
          // Mirrors the UPDATE: every written column lands on the returned row.
          const current = await repo.lockSuspensionById(id, tx);
          return makeSuspension({ ...current, ...values });
        },
      ),
    } as unknown as Mocked<SuspensionsRepository>;

    settings = { getMedicalSupervision: vi.fn().mockResolvedValue('DOCTOR') };
    service = new SuspensionsService(
      repo,
      new SuspensionEffects(),
      settings as unknown as AcademySettingsRepository,
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('listSuspensions', () => {
    it('scopes per role (ADMIN, FIGHTER, COACH, DOCTOR) and forbids unauthorized fighterId', async () => {
      await service.listSuspensions(adminActor, { limit: 20 });
      expect(repo.listSuspensions).toHaveBeenLastCalledWith(
        expect.objectContaining({
          scope: { kind: 'ALL' },
          today: '2026-10-20',
          limit: 20,
        }),
      );

      await service.listSuspensions(fighterActor, { limit: 20 });
      expect(repo.listSuspensions).toHaveBeenLastCalledWith(
        expect.objectContaining({
          scope: { kind: 'FIGHTER', fighterId: FIGHTER_ID },
        }),
      );
      await expectHttp(
        service.listSuspensions(fighterActor, {
          limit: 20,
          fighterId: OTHER_FIGHTER_ID,
        }),
        403,
      );

      await service.listSuspensions(coachActor, {
        limit: 20,
        fighterId: FIGHTER_ID,
      });
      expect(repo.listSuspensions).toHaveBeenLastCalledWith(
        expect.objectContaining({
          scope: { kind: 'COACH', userId: coachActor.id },
          fighterId: FIGHTER_ID,
        }),
      );
      repo.isCoachAssignedToFighter.mockResolvedValueOnce(false);
      await expectHttp(
        service.listSuspensions(coachActor, {
          limit: 20,
          fighterId: OTHER_FIGHTER_ID,
        }),
        403,
      );

      await service.listSuspensions(doctorActor, {
        limit: 20,
        fighterId: FIGHTER_ID,
      });
      expect(repo.listSuspensions).toHaveBeenLastCalledWith(
        expect.objectContaining({
          scope: { kind: 'DOCTOR', userId: doctorActor.id },
          fighterId: FIGHTER_ID,
        }),
      );
      repo.isDoctorAssignedToFighter.mockResolvedValueOnce(false);
      await expectHttp(
        service.listSuspensions(doctorActor, {
          limit: 20,
          fighterId: OTHER_FIGHTER_ID,
        }),
        403,
      );
    });

    it('passes the active filter and today academy date, and computes status on each returned item', async () => {
      repo.listSuspensions.mockResolvedValue([
        makeSuspension({
          id: '50000000-0000-4000-8000-000000000011',
          startsOn: '2026-10-25',
          endsOn: '2026-10-30',
          requiresClearance: false,
        }),
        makeSuspension({
          id: '50000000-0000-4000-8000-000000000012',
          startsOn: '2026-10-15',
          endsOn: '2026-10-20',
          requiresClearance: false,
        }),
        makeSuspension({
          id: '50000000-0000-4000-8000-000000000013',
          startsOn: '2026-10-01',
          endsOn: '2026-10-19',
          requiresClearance: true,
        }),
        makeSuspension({
          id: '50000000-0000-4000-8000-000000000014',
          startsOn: '2026-10-01',
          endsOn: '2026-10-19',
          requiresClearance: false,
        }),
      ]);

      const res = await service.listSuspensions(adminActor, {
        active: true,
        limit: 3,
      });
      expect(repo.listSuspensions).toHaveBeenCalledWith(
        expect.objectContaining({
          active: true,
          today: '2026-10-20',
          limit: 3,
        }),
      );
      expect(res.hasNextPage).toBe(true);
      expect(res.nextCursor).toEqual(expect.any(String));
      expect(res.data.map((item) => item.status)).toEqual([
        'UPCOMING',
        'ACTIVE',
        'AWAITING_CLEARANCE',
      ]);
    });
  });

  describe('createSuspension', () => {
    it('creates a manual suspension with defaults (startsOn = today, default 6 blockedSessionTypes, boutId = null) and sets audit context', async () => {
      const res = await service.createSuspension(
        coachActor,
        {
          fighterId: FIGHTER_ID,
          reason: 'KO',
          days: 30,
          lossOfConsciousness: 'UNDER_1_MIN',
        },
        REQUEST_ID,
      );

      expect(txExecute).toHaveBeenCalled();
      expect(repo.insertSuspension).toHaveBeenCalledWith(
        {
          fighterId: FIGHTER_ID,
          boutId: null,
          reason: 'KO',
          startsOn: '2026-10-20',
          endsOn: '2026-11-18',
          lossOfConsciousness: 'UNDER_1_MIN',
          suggestedDays: null,
          overrideReason: null,
          blockedSessionTypes: [
            'SHADOW_BOXING',
            'PAD_WORK',
            'HEAVY_BAG',
            'SPARRING',
            'GRAPPLING',
            'STRENGTH_CONDITIONING',
          ],
          requiresClearance: true,
          clearedAt: null,
          clearedById: null,
          clearanceNote: null,
          createdById: coachActor.id,
          issuedBy: 'CLUB',
          issuerReference: null,
        },
        expect.anything(),
      );
      expect(res.status).toBe('ACTIVE');
      expect(res.startsOn).toBe('2026-10-20');
      expect(res.endsOn).toBe('2026-11-18');
    });

    it('creates a manual suspension with explicit blockedSessionTypes = [SPARRING] and stores only SPARRING', async () => {
      await service.createSuspension(
        coachActor,
        {
          fighterId: FIGHTER_ID,
          reason: 'KO',
          days: 30,
          lossOfConsciousness: 'UNDER_1_MIN',
          blockedSessionTypes: ['SPARRING'],
        },
        REQUEST_ID,
      );

      expect(repo.insertSuspension).toHaveBeenCalledWith(
        expect.objectContaining({
          blockedSessionTypes: ['SPARRING'],
        }),
        expect.anything(),
      );
    });

    it('Criterion 2 & 3: creates a manual suspension with maxTier = 3 (storing SPARRING and GRAPPLING in SESSION_TYPES order), computes maxAllowedTier and gradedReturn in responses, and rejects maxTier + blockedSessionTypes with 422', async () => {
      const createdWithMaxTier = await service.createSuspension(
        coachActor,
        {
          fighterId: FIGHTER_ID,
          reason: 'MEDICAL',
          days: 14,
          maxTier: 3,
        },
        REQUEST_ID,
      );

      expect(repo.insertSuspension).toHaveBeenCalledWith(
        expect.objectContaining({
          blockedSessionTypes: ['SPARRING', 'GRAPPLING'],
        }),
        expect.anything(),
      );
      expect(createdWithMaxTier.blockedSessionTypes).toEqual([
        'SPARRING',
        'GRAPPLING',
      ]);
      expect(createdWithMaxTier.maxAllowedTier).toBe(3);
      expect(createdWithMaxTier.gradedReturn).toBeNull();

      await expectHttp(
        service.createSuspension(
          coachActor,
          {
            fighterId: FIGHTER_ID,
            reason: 'MEDICAL',
            days: 14,
            maxTier: 3,
            blockedSessionTypes: ['SPARRING'],
          },
          REQUEST_ID,
        ),
        422,
        'VALIDATION_ERROR',
      );

      // Default T-035 -> maxAllowedTier = 1; only SPARRING -> maxAllowedTier = 4
      const defaultRes = await service.createSuspension(
        coachActor,
        {
          fighterId: FIGHTER_ID,
          reason: 'KO',
          days: 60,
        },
        REQUEST_ID,
      );
      expect(defaultRes.maxAllowedTier).toBe(1);

      const sparringOnlyRes = await service.createSuspension(
        coachActor,
        {
          fighterId: FIGHTER_ID,
          reason: 'KO',
          days: 60,
          blockedSessionTypes: ['SPARRING'],
        },
        REQUEST_ID,
      );
      expect(sparringOnlyRes.maxAllowedTier).toBe(4);

      // Cleared KO on today (2026-10-20) -> gradedReturn has ceiling 3, fullReturnOn 2026-10-22
      const clearedRow = makeSuspension({
        reason: 'KO',
        startsOn: '2026-08-20',
        endsOn: '2026-10-18',
        requiresClearance: true,
        clearedAt: NOW,
        clearedById: doctorActor.id,
        clearanceNote: 'Cleared by ringside doctor',
      });
      repo.findSuspensionById.mockResolvedValueOnce(
        makeSuspension({
          reason: 'KO',
          startsOn: '2026-08-20',
          endsOn: '2026-10-18',
          requiresClearance: true,
          clearedAt: null,
        }),
      );
      repo.lockSuspensionById.mockResolvedValueOnce(
        makeSuspension({
          reason: 'KO',
          startsOn: '2026-08-20',
          endsOn: '2026-10-18',
          requiresClearance: true,
          clearedAt: null,
        }),
      );
      repo.clearSuspension.mockResolvedValueOnce(clearedRow);

      const clearedResponse = await service.clearSuspension(
        doctorActor,
        SUSPENSION_ID,
        { clearanceNote: 'Cleared by ringside doctor' },
        REQUEST_ID,
      );
      expect(clearedResponse.status).toBe('ENDED');
      expect(clearedResponse.gradedReturn).toEqual({
        ceiling: 3,
        fullReturnOn: '2026-10-22',
      });
    });

    it('accepts a future startsOn (status = UPCOMING) and rejects a past startsOn with 422', async () => {
      const future = await service.createSuspension(
        doctorActor,
        {
          fighterId: FIGHTER_ID,
          reason: 'MEDICAL',
          days: 10,
          startsOn: '2026-10-25',
          blockedSessionTypes: ['SPARRING', 'GRAPPLING'],
        },
        REQUEST_ID,
      );
      expect(future.startsOn).toBe('2026-10-25');
      expect(future.endsOn).toBe('2026-11-03');
      expect(future.status).toBe('UPCOMING');
      expect(future.requiresClearance).toBe(true);

      await expectHttp(
        service.createSuspension(
          doctorActor,
          {
            fighterId: FIGHTER_ID,
            reason: 'MEDICAL',
            days: 10,
            startsOn: '2026-10-19',
          },
          REQUEST_ID,
        ),
        422,
        'VALIDATION_ERROR',
      );
    });

    it('enforces requiresClearance rules across reasons and rejects invalid combinations with 422', async () => {
      // KO and TKO cannot turn off requiresClearance
      for (const reason of ['KO', 'TKO'] as const) {
        await expectHttp(
          service.createSuspension(
            coachActor,
            {
              fighterId: FIGHTER_ID,
              reason,
              days: 14,
              requiresClearance: false,
            },
            REQUEST_ID,
          ),
          422,
          'VALIDATION_ERROR',
        );
      }

      // DQ and MANDATORY_REST cannot turn on requiresClearance
      for (const reason of ['DQ', 'MANDATORY_REST'] as const) {
        await expectHttp(
          service.createSuspension(
            coachActor,
            {
              fighterId: FIGHTER_ID,
              reason,
              days: 7,
              requiresClearance: true,
            },
            REQUEST_ID,
          ),
          422,
          'VALIDATION_ERROR',
        );
      }

      // MEDICAL allows override to false
      const medicalNoClearance = await service.createSuspension(
        doctorActor,
        {
          fighterId: FIGHTER_ID,
          reason: 'MEDICAL',
          days: 7,
          requiresClearance: false,
        },
        REQUEST_ID,
      );
      expect(medicalNoClearance.requiresClearance).toBe(false);

      // OTHER defaults to false and allows override to true
      const otherDefault = await service.createSuspension(
        coachActor,
        {
          fighterId: FIGHTER_ID,
          reason: 'OTHER',
          days: 5,
        },
        REQUEST_ID,
      );
      expect(otherDefault.requiresClearance).toBe(false);

      const otherWithClearance = await service.createSuspension(
        coachActor,
        {
          fighterId: FIGHTER_ID,
          reason: 'OTHER',
          days: 5,
          requiresClearance: true,
        },
        REQUEST_ID,
      );
      expect(otherWithClearance.requiresClearance).toBe(true);
    });

    it('enforces fighter access for COACH, DOCTOR, ADMIN and forbids FIGHTER', async () => {
      const payload: CreateSuspensionInput = {
        fighterId: FIGHTER_ID,
        reason: 'MANDATORY_REST',
        days: 7,
      };

      await expectHttp(
        service.createSuspension(fighterActor, payload, REQUEST_ID),
        403,
      );

      repo.isCoachAssignedToFighter.mockResolvedValueOnce(false);
      await expectHttp(
        service.createSuspension(coachActor, payload, REQUEST_ID),
        403,
      );

      repo.isDoctorAssignedToFighter.mockResolvedValueOnce(false);
      await expectHttp(
        service.createSuspension(doctorActor, payload, REQUEST_ID),
        403,
      );

      repo.isActiveFighter.mockResolvedValueOnce(false);
      await expectHttp(
        service.createSuspension(adminActor, payload, REQUEST_ID),
        404,
        'FIGHTER_NOT_FOUND',
      );

      const createdByAdmin = await service.createSuspension(
        adminActor,
        payload,
        REQUEST_ID,
      );
      expect(createdByAdmin.id).toBe(SUSPENSION_ID);
      expect(createdByAdmin.affectedSessions).toEqual([]);
      expect(createdByAdmin.affectedPlans).toEqual([]);
    });

    it('invokes SuspensionEffects.runOnCreated inside the create transaction, calls afterCommit only after transaction resolves, and omits afterCommit from response JSON (Criterion 3)', async () => {
      const effects = new SuspensionEffects();
      const sessionId = '51c38f60-0f4e-48aa-848b-20f5ef828f01';
      const callOrder: string[] = [];
      const afterCommit = vi.fn(async () => {
        callOrder.push('afterCommit');
      });
      const handler = vi.fn(async () => {
        callOrder.push('runOnCreated');
        return {
          affectedSessions: [{ sessionId, action: 'PENDING' as const }],
          affectedPlans: [],
          afterCommit,
        };
      });
      effects.register(handler);
      const testTx = { execute: txExecute } as unknown as Transaction;
      repo.transaction.mockImplementationOnce(async (work) => {
        callOrder.push('tx:begin');
        const out = await work(testTx);
        callOrder.push('tx:commit');
        return out;
      });
      const serviceWithEffects = new SuspensionsService(
        repo,
        effects,
        settings as unknown as AcademySettingsRepository,
      );

      const res = await serviceWithEffects.createSuspension(
        coachActor,
        {
          fighterId: FIGHTER_ID,
          reason: 'DQ',
          days: 14,
          blockedSessionTypes: ['SPARRING'],
        },
        REQUEST_ID,
      );

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(
        [
          expect.objectContaining({
            id: SUSPENSION_ID,
            fighterId: FIGHTER_ID,
            reason: 'DQ',
            requiresClearance: false,
          }),
        ],
        expect.anything(),
      );
      expect(callOrder).toEqual([
        'tx:begin',
        'runOnCreated',
        'tx:commit',
        'afterCommit',
      ]);
      expect(afterCommit).toHaveBeenCalledTimes(1);
      expect(res.affectedSessions).toEqual([{ sessionId, action: 'PENDING' }]);
      expect(res.affectedPlans).toEqual([]);
      expect('afterCommit' in res).toBe(false);

      // When transaction fails after runOnCreated, afterCommit must NOT be called
      afterCommit.mockClear();
      repo.transaction.mockImplementationOnce(async (work) => {
        await work(testTx);
        throw new Error('Transaction commit failure');
      });
      await expect(
        serviceWithEffects.createSuspension(
          coachActor,
          {
            fighterId: FIGHTER_ID,
            reason: 'DQ',
            days: 14,
            blockedSessionTypes: ['SPARRING'],
          },
          REQUEST_ID,
        ),
      ).rejects.toThrow();
      expect(afterCommit).not.toHaveBeenCalled();
    });
  });

  describe('SuspensionEffects (Criterion 7)', () => {
    it('returns empty affectedSessions, affectedPlans, and no-op afterCommit when no handler is registered, and throws when register is called a second time', async () => {
      const effects = new SuspensionEffects();
      const tx = { execute: vi.fn() } as unknown as Transaction;

      const noHandlerResult = await effects.runOnCreated([makeSuspension()], tx);
      expect(noHandlerResult).toEqual({
        affectedSessions: [],
        affectedPlans: [],
        afterCommit: expect.any(Function),
      });
      await expect(noHandlerResult.afterCommit()).resolves.toBeUndefined();

      const firstHandler = vi.fn().mockResolvedValue({
        affectedSessions: [],
        affectedPlans: [],
        afterCommit: async () => {},
      });
      effects.register(firstHandler);
      expect(() => effects.register(vi.fn())).toThrow(
        /already been registered/,
      );
    });
  });

  describe('clearSuspension', () => {
    it('allows clearing when in AWAITING_CLEARANCE', async () => {
      const awaiting = makeSuspension({
        startsOn: '2026-09-01',
        endsOn: '2026-10-10',
        requiresClearance: true,
        clearedAt: null,
      });
      repo.findSuspensionById.mockResolvedValue(awaiting);
      repo.lockSuspensionById.mockResolvedValue(awaiting);

      const res1 = await service.clearSuspension(
        coachActor,
        SUSPENSION_ID,
        { clearanceNote: 'Cleared after rest period' },
        REQUEST_ID,
      );
      expect(res1.status).toBe('ENDED');
      expect(res1.endsOn).toBe('2026-10-10');
    });

    it('rejects a second clear with 409 SUSPENSION_ALREADY_CLEARED and missing with 404 SUSPENSION_NOT_FOUND', async () => {
      const alreadyCleared = makeSuspension({
        clearedAt: new Date('2026-10-19T03:00:00Z'),
        clearedById: doctorActor.id,
        clearanceNote: 'Already cleared',
      });
      repo.findSuspensionById.mockResolvedValue(alreadyCleared);
      repo.lockSuspensionById.mockResolvedValue(alreadyCleared);

      await expectHttp(
        service.clearSuspension(
          doctorActor,
          SUSPENSION_ID,
          { clearanceNote: 'Second clear attempt' },
          REQUEST_ID,
        ),
        409,
        'SUSPENSION_ALREADY_CLEARED',
      );

      repo.findSuspensionById.mockResolvedValue(undefined);
      await expectHttp(
        service.clearSuspension(
          doctorActor,
          SUSPENSION_ID,
          { clearanceNote: 'Missing suspension' },
          REQUEST_ID,
        ),
        404,
        'SUSPENSION_NOT_FOUND',
      );
    });

    it('forbids unassigned coach, unassigned doctor, fighter, and admin with 403', async () => {
      const note = { clearanceNote: 'Attempted clearance' };

      await expectHttp(
        service.clearSuspension(adminActor, SUSPENSION_ID, note, REQUEST_ID),
        403,
      );
      await expectHttp(
        service.clearSuspension(fighterActor, SUSPENSION_ID, note, REQUEST_ID),
        403,
      );

      repo.isCoachAssignedToFighter.mockResolvedValueOnce(false);
      await expectHttp(
        service.clearSuspension(coachActor, SUSPENSION_ID, note, REQUEST_ID),
        403,
      );

      repo.isDoctorAssignedToFighter.mockResolvedValueOnce(false);
      await expectHttp(
        service.clearSuspension(doctorActor, SUSPENSION_ID, note, REQUEST_ID),
        403,
      );
    });
  });

  describe('clearSuspension only while AWAITING_CLEARANCE (T-049)', () => {
    const ko = makeSuspension({
      reason: 'KO',
      startsOn: '2026-11-01',
      endsOn: '2026-11-30',
      requiresClearance: true,
      clearedAt: null,
    });
    const mandatoryRest = makeSuspension({
      reason: 'MANDATORY_REST',
      startsOn: '2026-11-01',
      endsOn: '2026-11-07',
      lossOfConsciousness: null,
      requiresClearance: false,
      clearedAt: null,
    });

    // Fixes "today" (10:00 in Vietnam) and returns what clearSuspension resolves or throws.
    async function clearOn(row: SuspensionRow, today: string): Promise<unknown> {
      vi.setSystemTime(new Date(`${today}T03:00:00.000Z`));
      repo.findSuspensionById.mockResolvedValue(row);
      repo.lockSuspensionById.mockResolvedValue(row);
      return service
        .clearSuspension(
          coachActor,
          SUSPENSION_ID,
          { clearanceNote: 'Cleared by doctor' },
          REQUEST_ID,
        )
        .catch((error: unknown) => error);
    }

    function expectNotAwaiting(result: unknown, status: string): void {
      expect(result).toBeInstanceOf(HttpException);
      const http = result as HttpException;
      expect(http.getStatus()).toBe(409);
      expect(http.getResponse()).toMatchObject({
        code: 'SUSPENSION_NOT_AWAITING_CLEARANCE',
        details: { status },
      });
    }

    it('C1: KO day 2 of 30 (today 2026-11-02) -> 409 SUSPENSION_NOT_AWAITING_CLEARANCE, status ACTIVE, clearedAt stays null', async () => {
      expectNotAwaiting(await clearOn(ko, '2026-11-02'), 'ACTIVE');
      expect(repo.clearSuspension).not.toHaveBeenCalled();
      expect(ko.clearedAt).toBeNull();
    });

    it('C2: KO on its endsOn (today 2026-11-30) -> 409, status ACTIVE', async () => {
      expectNotAwaiting(await clearOn(ko, '2026-11-30'), 'ACTIVE');
    });

    it('C3: KO on endsOn + 1 (today 2026-12-01) -> 200, clearedAt set, status ENDED, gradedReturn.ceiling 3', async () => {
      const res = (await clearOn(ko, '2026-12-01')) as Awaited<
        ReturnType<SuspensionsService['clearSuspension']>
      >;
      expect(res.clearedAt).toBe('2026-12-01T03:00:00.000Z');
      expect(res.status).toBe('ENDED');
      expect(res.gradedReturn?.ceiling).toBe(3);
      // Kept from the deleted early-clear test: audit context, lock, write values, endsOn unchanged.
      // Audit context: actor authSubject + requestId, set inside the transaction before the lock.
      expect(txExecute).toHaveBeenCalledTimes(1);
      const audit = new PgDialect().sqlToQuery(txExecute.mock.calls[0]?.[0] as SQL);
      expect(audit.params).toEqual([
        JSON.stringify({ sub: coachActor.authSubject }),
        REQUEST_ID,
      ]);
      expect(txExecute.mock.invocationCallOrder[0]).toBeLessThan(
        repo.lockSuspensionById.mock.invocationCallOrder[0] as number,
      );
      expect(repo.lockSuspensionById).toHaveBeenCalledWith(
        SUSPENSION_ID,
        expect.anything(),
      );
      expect(repo.clearSuspension).toHaveBeenCalledWith(
        SUSPENSION_ID,
        {
          clearedAt: new Date('2026-12-01T03:00:00.000Z'),
          clearedById: coachActor.id,
          clearanceNote: 'Cleared by doctor',
        },
        expect.anything(),
      );
      expect(res.endsOn).toBe('2026-11-30');
    });

    it('C4: MEDICAL starting 2026-11-05 for 3 days (today 2026-11-02) -> 409, status UPCOMING', async () => {
      const medical = makeSuspension({
        reason: 'MEDICAL',
        startsOn: '2026-11-05',
        endsOn: '2026-11-07',
        lossOfConsciousness: null,
        requiresClearance: true,
        clearedAt: null,
      });
      expectNotAwaiting(await clearOn(medical, '2026-11-02'), 'UPCOMING');
    });

    it('C5: MANDATORY_REST 2026-11-01 for 7 days (today 2026-11-03) -> 409, status ACTIVE', async () => {
      expectNotAwaiting(await clearOn(mandatoryRest, '2026-11-03'), 'ACTIVE');
    });

    it('C6: MANDATORY_REST already over (today 2026-11-10) -> 409, status ENDED', async () => {
      expectNotAwaiting(await clearOn(mandatoryRest, '2026-11-10'), 'ENDED');
    });

    it('C7: already cleared KO -> 409 SUSPENSION_ALREADY_CLEARED (not the new code)', async () => {
      const cleared = makeSuspension({
        ...ko,
        clearedAt: new Date('2026-12-01T03:00:00.000Z'),
        clearedById: doctorActor.id,
        clearanceNote: 'Already cleared',
      });
      const result = await clearOn(cleared, '2026-12-02');
      expect(result).toBeInstanceOf(HttpException);
      expect((result as HttpException).getStatus()).toBe(409);
      expect((result as HttpException).getResponse()).toMatchObject({
        code: 'SUSPENSION_ALREADY_CLEARED',
      });
    });
  });

  describe('T-050 issuer and early end', () => {
    // Today = 2026-11-05 10:00 in Vietnam. F has coach C, assigned doctors D and D3; D2 is not assigned.
    const TODAY = new Date('2026-11-05T03:00:00.000Z');
    const D = doctorActor;
    const D2: AuthenticatedUser = {
      ...doctorActor,
      id: '30000000-0000-4000-8000-000000000002',
      authSubject: 'doctor-sub-2',
    };
    const D3_USER_ID = '30000000-0000-4000-8000-000000000003';
    const C = coachActor;
    const unassignedCoach: AuthenticatedUser = {
      ...coachActor,
      id: '20000000-0000-4000-8000-000000000009',
      authSubject: 'coach-sub-9',
    };
    const X1 = '70000000-0000-4000-8000-000000000001';
    const UNKNOWN_EXAM = '70000000-0000-4000-8000-0000000000ff';
    const SO_REFERENCE = 'Giải MMA Hà Nội 2026, QĐ 12/BTC ngày 31/10';
    const LIFT = 'CV 15/BTC ngày 04/11 gỡ đình chỉ';

    const sc = makeSuspension({
      reason: 'MEDICAL',
      startsOn: '2026-11-01',
      endsOn: '2026-11-14',
      lossOfConsciousness: null,
      blockedSessionTypes: ['SPARRING', 'GRAPPLING'],
      requiresClearance: false,
      clearedAt: null,
      issuedBy: 'CLUB',
      issuerReference: null,
    });
    const so = makeSuspension({
      ...sc,
      issuedBy: 'ORGANIZER',
      issuerReference: SO_REFERENCE,
    });

    // Raw examination row as the repo returns it; the service decides validity.
    type ExamRow = Awaited<
      ReturnType<SuspensionsRepository['findEarlyEndExamination']>
    >;
    const x1 = {
      fighterId: FIGHTER_ID,
      doctorUserId: D.id,
      scope: 'TRAINING',
      decision: 'ELIGIBLE',
      examinedAt: new Date('2026-11-05T02:00:00Z'),
      validUntil: null,
      superseded: false,
    } as NonNullable<ExamRow>;

    function given(
      row: SuspensionRow | undefined,
      exam: Partial<NonNullable<ExamRow>> | undefined = x1,
    ): void {
      repo.findSuspensionById.mockResolvedValue(row);
      repo.lockSuspensionById.mockResolvedValue(row);
      (
        repo as unknown as { findEarlyEndExamination: ReturnType<typeof vi.fn> }
      ).findEarlyEndExamination = vi.fn(async (id: string) =>
        id === X1 && exam ? { ...x1, ...exam } : undefined,
      );
    }

    async function errorOf(promise: Promise<unknown>): Promise<HttpException> {
      const error = await promise.then(
        () => undefined,
        (e: unknown) => e,
      );
      expect(error).toBeInstanceOf(HttpException);
      return error as HttpException;
    }

    const endEarly = (
      actor: AuthenticatedUser,
      body: Record<string, unknown>,
    ): Promise<unknown> =>
      service.endSuspensionEarly(
        actor,
        SUSPENSION_ID,
        body as never,
        REQUEST_ID,
      );
    const clubBody = { note: 'Khám ổn, hết đau đầu', examinationId: X1 };
    const organizerBody = { note: 'Đã nhận văn bản gỡ', liftReference: LIFT };

    beforeEach(() => {
      vi.setSystemTime(TODAY);
      repo.isDoctorAssignedToFighter.mockImplementation(
        async (userId: string) => userId === D.id || userId === D3_USER_ID,
      );
      repo.isCoachAssignedToFighter.mockImplementation(
        async (userId: string) => userId === C.id,
      );
      given(sc);
    });

    // --- Create ---------------------------------------------------------------

    const createBase = {
      fighterId: FIGHTER_ID,
      reason: 'MEDICAL',
      days: 14,
      requiresClearance: false,
    } as const;

    it('C1: MEDICAL issuedBy ORGANIZER with issuerReference -> 201, issuedBy ORGANIZER, issuerReference echoed', async () => {
      const res = await service.createSuspension(
        C,
        { ...createBase, issuedBy: 'ORGANIZER', issuerReference: SO_REFERENCE },
        REQUEST_ID,
      );
      expect(res.issuedBy).toBe('ORGANIZER');
      expect(res.issuerReference).toBe(SO_REFERENCE);
      expect(repo.insertSuspension).toHaveBeenCalledWith(
        expect.objectContaining({
          issuedBy: 'ORGANIZER',
          issuerReference: SO_REFERENCE,
        }),
        expect.anything(),
      );
    });

    it('C2: ORGANIZER without issuerReference -> 422 VALIDATION_ERROR', async () => {
      await expectHttp(
        service.createSuspension(
          C,
          { ...createBase, issuedBy: 'ORGANIZER' },
          REQUEST_ID,
        ),
        422,
        'VALIDATION_ERROR',
      );
      expect(repo.insertSuspension).not.toHaveBeenCalled();
    });

    it('C3: ORGANIZER with reason KO -> 422 VALIDATION_ERROR', async () => {
      await expectHttp(
        service.createSuspension(
          C,
          {
            fighterId: FIGHTER_ID,
            reason: 'KO',
            days: 30,
            issuedBy: 'ORGANIZER',
            issuerReference: SO_REFERENCE,
          },
          REQUEST_ID,
        ),
        422,
        'VALIDATION_ERROR',
      );
      expect(repo.insertSuspension).not.toHaveBeenCalled();
    });

    it('C4: no issuedBy -> 201, issuedBy CLUB, issuerReference null', async () => {
      const res = await service.createSuspension(C, createBase, REQUEST_ID);
      expect(res.issuedBy).toBe('CLUB');
      expect(res.issuerReference).toBeNull();
      expect(res.earlyEndExaminationId).toBeNull();
      expect(res.liftReference).toBeNull();
      expect(repo.insertSuspension).toHaveBeenCalledWith(
        expect.objectContaining({ issuedBy: 'CLUB', issuerReference: null }),
        expect.anything(),
      );
    });

    it('C5: CLUB with issuerReference -> 422 VALIDATION_ERROR', async () => {
      await expectHttp(
        service.createSuspension(
          C,
          { ...createBase, issuedBy: 'CLUB', issuerReference: SO_REFERENCE },
          REQUEST_ID,
        ),
        422,
        'VALIDATION_ERROR',
      );
      expect(repo.insertSuspension).not.toHaveBeenCalled();
    });

    // --- End early, club suspension -------------------------------------------

    it('E1: SC + X1, D ends early -> status ENDED; one write with clearedById D, note, earlyEndExaminationId X1, liftReference null, clearedAt Date', async () => {
      const res = (await endEarly(D, clubBody)) as SuspensionResponse;
      expect(res.status).toBe('ENDED');
      expect(res.earlyEndExaminationId).toBe(X1);
      expect(repo.clearSuspension).toHaveBeenCalledTimes(1);
      const [id, values] = repo.clearSuspension.mock.calls[0] ?? [];
      expect(id).toBe(SUSPENSION_ID);
      expect(values).toEqual({
        clearedAt: expect.any(Date),
        clearedById: D.id,
        clearanceNote: 'Khám ổn, hết đau đầu',
        earlyEndExaminationId: X1,
        liftReference: null,
      });
    });

    it('E2: SC with reason KO -> 409 SUSPENSION_EARLY_END_NOT_ELIGIBLE { reason KO, status ACTIVE }, no write', async () => {
      given(makeSuspension({ ...sc, reason: 'KO' }));
      const error = await errorOf(endEarly(D, clubBody));
      expect(error.getStatus()).toBe(409);
      expect(error.getResponse()).toMatchObject({
        code: 'SUSPENSION_EARLY_END_NOT_ELIGIBLE',
        details: { reason: 'KO', status: 'ACTIVE' },
      });
      expect(repo.clearSuspension).not.toHaveBeenCalled();
    });

    it('E3: SC with reason OTHER -> 409 SUSPENSION_EARLY_END_NOT_ELIGIBLE, details.reason OTHER', async () => {
      given(makeSuspension({ ...sc, reason: 'OTHER' }));
      const error = await errorOf(endEarly(D, clubBody));
      expect(error.getStatus()).toBe(409);
      expect(error.getResponse()).toMatchObject({
        code: 'SUSPENSION_EARLY_END_NOT_ELIGIBLE',
        details: { reason: 'OTHER' },
      });
      expect(repo.clearSuspension).not.toHaveBeenCalled();
    });

    it('E4: SC starting 2026-11-10 ending 2026-11-20 -> 409 SUSPENSION_EARLY_END_NOT_ELIGIBLE, details.status UPCOMING', async () => {
      given(makeSuspension({ ...sc, startsOn: '2026-11-10', endsOn: '2026-11-20' }));
      const error = await errorOf(endEarly(D, clubBody));
      expect(error.getStatus()).toBe(409);
      expect(error.getResponse()).toMatchObject({
        code: 'SUSPENSION_EARLY_END_NOT_ELIGIBLE',
        details: { status: 'UPCOMING' },
      });
      expect(repo.clearSuspension).not.toHaveBeenCalled();
    });

    it('E5: SC 2026-10-20..2026-10-26 with requiresClearance -> 409 SUSPENSION_EARLY_END_NOT_ELIGIBLE, details.status AWAITING_CLEARANCE', async () => {
      given(
        makeSuspension({
          ...sc,
          startsOn: '2026-10-20',
          endsOn: '2026-10-26',
          requiresClearance: true,
        }),
      );
      const error = await errorOf(endEarly(D, clubBody));
      expect(error.getStatus()).toBe(409);
      expect(error.getResponse()).toMatchObject({
        code: 'SUSPENSION_EARLY_END_NOT_ELIGIBLE',
        details: { status: 'AWAITING_CLEARANCE' },
      });
      expect(repo.clearSuspension).not.toHaveBeenCalled();
    });

    it('E6: SC already cleared at 2026-11-04T03:00:00Z -> 409 SUSPENSION_ALREADY_CLEARED', async () => {
      given(
        makeSuspension({
          ...sc,
          clearedAt: new Date('2026-11-04T03:00:00Z'),
          clearedById: D.id,
          clearanceNote: 'Đã xong',
        }),
      );
      await expectHttp(endEarly(D, clubBody), 409, 'SUSPENSION_ALREADY_CLEARED');
      expect(repo.clearSuspension).not.toHaveBeenCalled();
    });

    it('E7: SC, unassigned doctor D2 -> 403 and no transaction opened', async () => {
      await expectHttp(endEarly(D2, clubBody), 403);
      expect(repo.transaction).not.toHaveBeenCalled();
    });

    it('E8: SC, coach C with examinationId X1 -> 403', async () => {
      await expectHttp(endEarly(C, clubBody), 403);
      expect(repo.transaction).not.toHaveBeenCalled();
    });

    it('E9: SC in NONE mode, D -> 409 MEDICAL_SUPERVISION_DISABLED, no write', async () => {
      settings.getMedicalSupervision.mockResolvedValue('NONE');
      await expectHttp(
        endEarly(D, clubBody),
        409,
        'MEDICAL_SUPERVISION_DISABLED',
      );
      expect(repo.clearSuspension).not.toHaveBeenCalled();
    });

    it('E10: note "ok" and a 501-character note -> both 422 VALIDATION_ERROR', async () => {
      await expectHttp(
        endEarly(D, { ...clubBody, note: 'ok' }),
        422,
        'VALIDATION_ERROR',
      );
      await expectHttp(
        endEarly(D, { ...clubBody, note: 'a'.repeat(501) }),
        422,
        'VALIDATION_ERROR',
      );
      expect(repo.clearSuspension).not.toHaveBeenCalled();
    });

    it('E11: unknown suspension id -> 404 SUSPENSION_NOT_FOUND', async () => {
      given(undefined);
      await expectHttp(endEarly(D, clubBody), 404, 'SUSPENSION_NOT_FOUND');
    });

    it('E12: SC, D calls /clear -> still 409 SUSPENSION_NOT_AWAITING_CLEARANCE', async () => {
      await expectHttp(
        service.clearSuspension(
          D,
          SUSPENSION_ID,
          { clearanceNote: 'Khám ổn, hết đau đầu' },
          REQUEST_ID,
        ),
        409,
        'SUSPENSION_NOT_AWAITING_CLEARANCE',
      );
      expect(repo.clearSuspension).not.toHaveBeenCalled();
    });

    it('E13: SC, lockSuspensionById returns a row already cleared -> 409 SUSPENSION_ALREADY_CLEARED', async () => {
      given(sc);
      repo.lockSuspensionById.mockResolvedValue(
        makeSuspension({
          ...sc,
          clearedAt: new Date('2026-11-05T02:30:00Z'),
          clearedById: D3_USER_ID,
          clearanceNote: 'Đã kết thúc',
        }),
      );
      await expectHttp(endEarly(D, clubBody), 409, 'SUSPENSION_ALREADY_CLEARED');
      expect(repo.clearSuspension).not.toHaveBeenCalled();
    });

    it("E14: SC + X1, D -> setAuditContext with D's authSubject and requestId inside the transaction", async () => {
      await endEarly(D, clubBody);
      expect(txExecute).toHaveBeenCalledTimes(1);
      const audit = new PgDialect().sqlToQuery(
        txExecute.mock.calls[0]?.[0] as SQL,
      );
      expect(audit.params).toEqual([
        JSON.stringify({ sub: D.authSubject }),
        REQUEST_ID,
      ]);
      expect(repo.transaction.mock.invocationCallOrder[0]).toBeLessThan(
        txExecute.mock.invocationCallOrder[0] as number,
      );
      expect(txExecute.mock.invocationCallOrder[0]).toBeLessThan(
        repo.lockSuspensionById.mock.invocationCallOrder[0] as number,
      );
    });

    it('E15: SC, D without examinationId; then with both examinationId and liftReference -> both 422 VALIDATION_ERROR', async () => {
      await expectHttp(
        endEarly(D, { note: 'Khám ổn, hết đau đầu' }),
        422,
        'VALIDATION_ERROR',
      );
      await expectHttp(
        endEarly(D, { ...clubBody, liftReference: LIFT }),
        422,
        'VALIDATION_ERROR',
      );
      expect(repo.clearSuspension).not.toHaveBeenCalled();
    });

    it('E15b: SC, D with note and liftReference but no examinationId -> 422 VALIDATION_ERROR, no transaction, no write', async () => {
      await expectHttp(
        endEarly(D, { note: 'Khám ổn, hết đau đầu', liftReference: LIFT }),
        422,
        'VALIDATION_ERROR',
      );
      expect(repo.transaction).not.toHaveBeenCalled();
      expect(repo.clearSuspension).not.toHaveBeenCalled();
    });

    it('E8b: SC in NONE mode, coach C with examinationId X1 -> 403 (not 409 MEDICAL_SUPERVISION_DISABLED), no write', async () => {
      settings.getMedicalSupervision.mockResolvedValue('NONE');
      const error = await errorOf(endEarly(C, clubBody));
      expect(error.getStatus()).toBe(403);
      expect(error.getResponse()).not.toMatchObject({
        code: 'MEDICAL_SUPERVISION_DISABLED',
      });
      expect(repo.transaction).not.toHaveBeenCalled();
      expect(repo.clearSuspension).not.toHaveBeenCalled();
    });

    // --- Invalid examination (SC, D) ------------------------------------------

    async function expectExamInvalid(
      body: Record<string, unknown>,
      cause: string,
    ): Promise<void> {
      const error = await errorOf(endEarly(D, body));
      expect(error.getStatus()).toBe(409);
      expect(error.getResponse()).toMatchObject({
        code: 'SUSPENSION_EARLY_END_EXAM_INVALID',
        details: { cause },
      });
      expect(repo.clearSuspension).not.toHaveBeenCalled();
    }

    it('X2: unknown examination id -> cause NOT_FOUND', async () => {
      await expectExamInvalid(
        { ...clubBody, examinationId: UNKNOWN_EXAM },
        'NOT_FOUND',
      );
    });

    it("X3: another fighter's examination -> cause NOT_FOUND", async () => {
      given(sc, { fighterId: OTHER_FIGHTER_ID });
      await expectExamInvalid(clubBody, 'NOT_FOUND');
    });

    it('X4: examination recorded by D3 -> cause OTHER_DOCTOR', async () => {
      given(sc, { doctorUserId: D3_USER_ID });
      await expectExamInvalid(clubBody, 'OTHER_DOCTOR');
    });

    it('X5: X1 with scope COMPETITION -> cause NOT_TRAINING', async () => {
      given(sc, { scope: 'COMPETITION' });
      await expectExamInvalid(clubBody, 'NOT_TRAINING');
    });

    it('X6: X1 with decision NOT_ELIGIBLE -> cause NOT_ELIGIBLE', async () => {
      given(sc, { decision: 'NOT_ELIGIBLE' });
      await expectExamInvalid(clubBody, 'NOT_ELIGIBLE');
    });

    it('X7: X1 examined 2026-10-31T10:00:00Z (academy 10-31) -> cause BEFORE_SUSPENSION', async () => {
      given(sc, { examinedAt: new Date('2026-10-31T10:00:00Z') });
      await expectExamInvalid(clubBody, 'BEFORE_SUSPENSION');
    });

    it('X8: X1 superseded by another examination -> cause SUPERSEDED', async () => {
      given(sc, { superseded: true });
      await expectExamInvalid(clubBody, 'SUPERSEDED');
    });

    it('X9: X1 examined 2026-11-01T03:00:00Z, validUntil 2026-11-04T00:00:00Z -> cause EXPIRED', async () => {
      given(sc, {
        examinedAt: new Date('2026-11-01T03:00:00Z'),
        validUntil: new Date('2026-11-04T00:00:00Z'),
      });
      await expectExamInvalid(clubBody, 'EXPIRED');
    });

    it('X10: X1 with ELIGIBLE_WITH_RESTRICTIONS -> no error, status ENDED', async () => {
      given(sc, { decision: 'ELIGIBLE_WITH_RESTRICTIONS' });
      const res = (await endEarly(D, clubBody)) as SuspensionResponse;
      expect(res.status).toBe('ENDED');
    });

    it('X11: X1 examined 2026-10-31T18:00:00Z (01:00 on 11-01 academy time) -> no error (UTC+7 day boundary)', async () => {
      given(sc, { examinedAt: new Date('2026-10-31T18:00:00Z') });
      const res = (await endEarly(D, clubBody)) as SuspensionResponse;
      expect(res.status).toBe('ENDED');
    });

    // --- End early, organizer suspension --------------------------------------

    it('O1: SO, C with liftReference and note -> 200 ENDED; writes liftReference, earlyEndExaminationId null, clearedById C', async () => {
      given(so);
      const res = (await endEarly(C, organizerBody)) as SuspensionResponse;
      expect(res.status).toBe('ENDED');
      expect(res.liftReference).toBe(LIFT);
      expect(repo.clearSuspension).toHaveBeenCalledTimes(1);
      expect(repo.clearSuspension.mock.calls[0]?.[1]).toEqual({
        clearedAt: expect.any(Date),
        clearedById: C.id,
        clearanceNote: 'Đã nhận văn bản gỡ',
        earlyEndExaminationId: null,
        liftReference: LIFT,
      });
    });

    it('O2: SO, D like O1 -> 200', async () => {
      given(so);
      const res = (await endEarly(D, organizerBody)) as SuspensionResponse;
      expect(res.status).toBe('ENDED');
    });

    it('O3: SO in NONE mode, C like O1 -> 200 (mode not checked)', async () => {
      given(so);
      settings.getMedicalSupervision.mockResolvedValue('NONE');
      const res = (await endEarly(C, organizerBody)) as SuspensionResponse;
      expect(res.status).toBe('ENDED');
    });

    it('O4: SO, C without liftReference; then with examinationId X1 instead -> both 422 VALIDATION_ERROR', async () => {
      given(so);
      await expectHttp(
        endEarly(C, { note: 'Đã nhận văn bản gỡ' }),
        422,
        'VALIDATION_ERROR',
      );
      await expectHttp(
        endEarly(C, { note: 'Đã nhận văn bản gỡ', examinationId: X1 }),
        422,
        'VALIDATION_ERROR',
      );
      expect(repo.clearSuspension).not.toHaveBeenCalled();
    });

    it('O5: SO, D2 and an unassigned coach -> both 403', async () => {
      given(so);
      await expectHttp(endEarly(D2, organizerBody), 403);
      await expectHttp(endEarly(unassignedCoach, organizerBody), 403);
      expect(repo.transaction).not.toHaveBeenCalled();
    });
  });
});
