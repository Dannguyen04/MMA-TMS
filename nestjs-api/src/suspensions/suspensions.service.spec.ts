import { HttpException } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mocked } from 'vitest';
import type { SuspensionRow } from '../database/schema.js';
import type { AuthenticatedUser } from '../shared/models/auth-context.model.js';
import { USER } from '../shared/types/user.role.js';
import type { Transaction } from '../shared/utils/audit-context.util.js';
import type { CreateSuspensionInput } from './suspensions.model.js';
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
          values: {
            clearedAt: Date;
            clearedById: string;
            clearanceNote: string;
          },
        ) => {
          const current = await repo.lockSuspensionById(id, tx);
          return makeSuspension({
            ...current,
            clearedAt: values.clearedAt,
            clearedById: values.clearedById,
            clearanceNote: values.clearanceNote,
          });
        },
      ),
    } as unknown as Mocked<SuspensionsRepository>;

    service = new SuspensionsService(repo);
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
    it('creates a manual suspension with defaults (startsOn = today, blockedSessionTypes = [SPARRING], boutId = null) and sets audit context', async () => {
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
          blockedSessionTypes: ['SPARRING'],
          requiresClearance: true,
          clearedAt: null,
          clearedById: null,
          clearanceNote: null,
          createdById: coachActor.id,
        },
        expect.anything(),
      );
      expect(res.status).toBe('ACTIVE');
      expect(res.startsOn).toBe('2026-10-20');
      expect(res.endsOn).toBe('2026-11-18');
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
    });
  });

  describe('clearSuspension', () => {
    it('allows early clear before ends_on without changing ends_on, and sets audit context', async () => {
      const activeSuspension = makeSuspension({
        startsOn: '2026-10-15',
        endsOn: '2026-11-15',
        requiresClearance: true,
        clearedAt: null,
      });
      repo.findSuspensionById.mockResolvedValue(activeSuspension);
      repo.lockSuspensionById.mockResolvedValue(activeSuspension);

      const res = await service.clearSuspension(
        doctorActor,
        SUSPENSION_ID,
        { clearanceNote: '  Cleared early after full neurological exam  ' },
        REQUEST_ID,
      );

      expect(txExecute).toHaveBeenCalled();
      expect(repo.lockSuspensionById).toHaveBeenCalledWith(
        SUSPENSION_ID,
        expect.anything(),
      );
      expect(repo.clearSuspension).toHaveBeenCalledWith(
        SUSPENSION_ID,
        {
          clearedAt: NOW,
          clearedById: doctorActor.id,
          clearanceNote: 'Cleared early after full neurological exam',
        },
        expect.anything(),
      );
      expect(res.endsOn).toBe('2026-11-15');
      expect(res.clearedAt).toBe(NOW.toISOString());
      expect(res.clearedById).toBe(doctorActor.id);
      expect(res.clearanceNote).toBe(
        'Cleared early after full neurological exam',
      );
      expect(res.status).toBe('ENDED');
    });

    it('allows clearing when in AWAITING_CLEARANCE and when requires_clearance = false', async () => {
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

      const noClearanceRequired = makeSuspension({
        startsOn: '2026-10-18',
        endsOn: '2026-10-25',
        reason: 'MANDATORY_REST',
        requiresClearance: false,
        clearedAt: null,
      });
      repo.findSuspensionById.mockResolvedValue(noClearanceRequired);
      repo.lockSuspensionById.mockResolvedValue(noClearanceRequired);

      const res2 = await service.clearSuspension(
        coachActor,
        SUSPENSION_ID,
        { clearanceNote: 'Ended mandatory rest early' },
        REQUEST_ID,
      );
      expect(res2.status).toBe('ENDED');
      expect(res2.endsOn).toBe('2026-10-25');
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
});
