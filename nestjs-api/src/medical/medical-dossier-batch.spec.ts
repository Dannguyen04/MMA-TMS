import { HttpStatus, type HttpException } from '@nestjs/common';
import type { Mocked } from 'vitest';
import type { AcademySettingsRepository } from '../academy-settings/academy-settings.repo.js';
import type { AuthenticatedUser } from '../shared/models/auth-context.model.js';
import { USER, type UserRole } from '../shared/types/user.role.js';
import { MedicalAccessService } from './medical-access.service.js';
import { MEDICAL_READ_VIEW } from './medical.constants.js';
import {
  listMedicalDossiersQuerySchema,
  type ClearanceType,
  type ExaminationDetails,
  type ExaminationScope,
} from './medical.model.js';
import type {
  ClearanceEligibilityRow,
  MedicalRepository,
} from './medical.repo.js';
import { MedicalService } from './medical.service.js';

/**
 * T-064: GET /medical/dossiers. An in-memory store backs both the per-Fighter
 * repository methods used by GET /fighters/:id/medical and the batch methods,
 * so the two endpoints can be compared on exactly the same data.
 */

type ExamRow = NonNullable<
  Awaited<ReturnType<MedicalRepository['findCurrentExamination']>>
>;
type StoredClearance = ClearanceEligibilityRow & {
  examinationId: string;
  clearanceType: ClearanceType;
  issueSequence: number;
};

const NOW = new Date('2026-11-12T08:00:00.000Z');
const COACH_USER = 'c0000000-0000-4000-8000-000000000001';
const DOCTOR_USER = 'd0000000-0000-4000-8000-000000000001';
const ADMIN_USER = 'a0000000-0000-4000-8000-000000000001';
const FIGHTER_COUNT = 20;

const fighterId = (index: number) =>
  `f0000000-0000-4000-8000-${String(index).padStart(12, '0')}`;
const fighterUserId = (index: number) =>
  `e0000000-0000-4000-8000-${String(index).padStart(12, '0')}`;
const uuid = (prefix: string, index: number) =>
  `${prefix}000000-0000-4000-8000-${String(index).padStart(12, '0')}`;
const day = (offset: number) => new Date(NOW.getTime() + offset * 86_400_000);

function actor(role: UserRole, id: string): AuthenticatedUser {
  return { id, role, authSubject: `${id}-sub`, email: `${role}@example.com` };
}
const adminActor = actor(USER.ADMIN, ADMIN_USER);
const coachActor = actor(USER.COACH, COACH_USER);
const doctorActor = actor(USER.DOCTOR, DOCTOR_USER);
const fighterActor = actor(USER.FIGHTER, fighterUserId(3));

/** Varied clinical data: injuries, plans, review requests, exams, clearances. */
function buildStore() {
  const fighters = Array.from({ length: FIGHTER_COUNT }, (_, index) => ({
    id: fighterId(index),
    userId: fighterUserId(index),
    deleted: index === FIGHTER_COUNT - 1,
  }));
  const coachAssigned = new Set(fighters.slice(0, 10).map((f) => f.id));
  const doctorAssigned = new Set(fighters.slice(0, 15).map((f) => f.id));

  const injuries: { id: string; fighterId: string; occurredAt: Date }[] = [];
  const plans: { id: string; fighterId: string; startDate: string }[] = [];
  const reviewRequests: { id: string; fighterId: string; status: string }[] = [];
  const clearances: (StoredClearance & { id: string; fighterId: string })[] = [];
  const exams: ExamRow[] = [];
  const details = new Map<string, ExaminationDetails>();
  const baseline = new Set<string>();
  const decisions = ['ELIGIBLE', 'ELIGIBLE_WITH_RESTRICTIONS', 'NOT_ELIGIBLE'] as const;
  let sequence = 0;
  let issue = 0;

  const exam = (fid: string, scope: ExaminationScope, decision: ExamRow['decision']) => {
    sequence += 1;
    const row = {
      id: uuid('b', sequence),
      sequenceNo: sequence,
      fighterId: fid,
      doctorId: uuid('9', 1),
      recordedById: DOCTOR_USER,
      scope,
      decision,
      examinedAt: day(-sequence),
      reason: `exam ${sequence}`,
      allowedSessionTypes:
        decision === 'ELIGIBLE_WITH_RESTRICTIONS' ? ['RECOVERY'] : null,
      allowedTechniqueTypes: null,
      excludedJoints: null,
      restrictionNotes: decision === 'ELIGIBLE_WITH_RESTRICTIONS' ? 'light' : null,
      validUntil: day(30),
      supersedesId: null,
      createdAt: day(-sequence),
    } as unknown as ExamRow;
    exams.push(row);
    return row;
  };
  const clearance = (
    fid: string,
    examinationId: string,
    clearanceType: ClearanceType,
    status: 'ACTIVE' | 'REVOKED',
    validUntil: Date | null,
  ) => {
    issue += 1;
    clearances.push({
      id: uuid('c1', issue),
      fighterId: fid,
      examinationId,
      clearanceType,
      issueSequence: issue,
      status,
      validFrom: day(-10 - issue),
      validUntil,
      allowedSessionTypes: null,
      allowedTechniqueTypes: null,
      excludedJoints: null,
      createdAt: day(-10 - issue),
    } as StoredClearance & { id: string; fighterId: string });
  };

  fighters.forEach(({ id }, index) => {
    for (let n = 0; n < index % 3; n += 1) {
      injuries.push({ id: uuid('11', index * 10 + n), fighterId: id, occurredAt: day(-n - index) });
    }
    if (index % 2 === 1) {
      plans.push({ id: uuid('22', index), fighterId: id, startDate: '2026-11-01' });
    }
    if (index % 4 === 0) {
      reviewRequests.push({ id: uuid('33', index), fighterId: id, status: 'OPEN' });
    }
    if (index % 2 === 0) baseline.add(id);
    if (index % 5 !== 0) {
      // An older exam first, so "current" really means the highest sequence.
      exam(id, 'TRAINING', 'ELIGIBLE');
      const current = exam(id, 'TRAINING', decisions[index % 3]);
      clearance(id, current.id, 'TRAINING', 'ACTIVE', index % 4 === 1 ? day(-1) : day(20));
      clearance(id, current.id, 'COMPETITION', 'ACTIVE', day(20));
      if (index % 7 === 0) {
        clearance(id, current.id, 'RETURN_FROM_INJURY', 'REVOKED', null);
      }
      if (index % 2 === 0) {
        details.set(current.id, { examinationType: 'BASELINE' } as unknown as ExaminationDetails);
      }
    }
    if (index % 3 === 0) {
      const current = exam(id, 'COMPETITION', index % 6 === 0 ? 'ELIGIBLE' : 'NOT_ELIGIBLE');
      clearance(id, current.id, 'COMPETITION', 'ACTIVE', day(5));
    }
  });

  // The SQL orders newest first; the fake keeps rows in that order.
  injuries.sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());
  clearances.sort((a, b) => b.issueSequence - a.issueSequence);

  return {
    fighters,
    coachAssigned,
    doctorAssigned,
    injuries,
    plans,
    reviewRequests,
    clearances,
    exams,
    details,
    baseline,
  };
}

function eligibilityRow(row: StoredClearance): ClearanceEligibilityRow {
  return {
    status: row.status,
    validFrom: row.validFrom,
    validUntil: row.validUntil,
    allowedSessionTypes: row.allowedSessionTypes,
    allowedTechniqueTypes: row.allowedTechniqueTypes,
    excludedJoints: row.excludedJoints,
    createdAt: row.createdAt,
  };
}

function fakeRepository(store: ReturnType<typeof buildStore>) {
  const live = (id: string) => store.fighters.find((f) => f.id === id && !f.deleted);
  const group = <T extends { fighterId: string }>(rows: T[], ids: readonly string[]) => {
    const map = new Map<string, T[]>();
    for (const row of rows) {
      if (!ids.includes(row.fighterId)) continue;
      map.set(row.fighterId, [...(map.get(row.fighterId) ?? []), row]);
    }
    return map;
  };
  const currentExam = (fid: string, scope: ExaminationScope) =>
    store.exams
      .filter((row) => row.fighterId === fid && row.scope === scope)
      .sort((a, b) => b.sequenceNo - a.sequenceNo)[0];
  const canRead = (role: UserRole, userId: string, fid: string) => {
    const fighter = live(fid);
    if (!fighter) return false;
    if (role === USER.ADMIN) return true;
    if (role === USER.FIGHTER) return fighter.userId === userId;
    if (role === USER.COACH) return userId === COACH_USER && store.coachAssigned.has(fid);
    if (role === USER.DOCTOR) return userId === DOCTOR_USER && store.doctorAssigned.has(fid);
    return false;
  };
  const activeClearances = store.clearances.filter((row) => row.status === 'ACTIVE');

  return {
    // Per-Fighter reads (GET /fighters/:id/medical)
    findFighter: vi.fn(async (id: string) => {
      const fighter = live(id);
      return fighter ? { id: fighter.id, userId: fighter.userId } : undefined;
    }),
    isCoachUserAssignedToFighter: vi.fn(async (userId: string, fid: string) =>
      canRead(USER.COACH, userId, fid),
    ),
    isDoctorUserAssignedToFighter: vi.fn(async (userId: string, fid: string) =>
      canRead(USER.DOCTOR, userId, fid),
    ),
    insertMedicalReadAudit: vi.fn(async () => undefined),
    listActiveInjuries: vi.fn(async (fid: string) => store.injuries.filter((r) => r.fighterId === fid)),
    listActiveRecoveryPlans: vi.fn(async (fid: string) => store.plans.filter((r) => r.fighterId === fid)),
    listActiveClearances: vi.fn(async (fid: string) => activeClearances.filter((r) => r.fighterId === fid)),
    listOpenReviewRequests: vi.fn(async (fid: string) => store.reviewRequests.filter((r) => r.fighterId === fid)),
    findCurrentExamination: vi.fn(async (fid: string, scope: ExaminationScope) => currentExam(fid, scope)),
    hasBaselineOnFile: vi.fn(async (fid: string) => store.baseline.has(fid)),
    listClearancesForExamination: vi.fn(
      async (examinationId: string, types: readonly ClearanceType[]) =>
        store.clearances
          .filter((r) => r.examinationId === examinationId && types.includes(r.clearanceType))
          .map(eligibilityRow),
    ),
    findExaminationDetails: vi.fn(async (ids: readonly string[]) => {
      const map = new Map<string, ExaminationDetails>();
      for (const id of ids) {
        const value = store.details.get(id);
        if (value) map.set(id, value);
      }
      return map;
    }),

    // Batch reads (GET /medical/dossiers)
    findFightersInMedicalReadScope: vi.fn(
      async (who: { id: string; role: UserRole }, ids: readonly string[] | undefined, limit: number) => {
        if (ids) {
          return ids
            .filter((id) => live(id))
            .map((id) => ({ id, inScope: canRead(who.role, who.id, id) }));
        }
        return store.fighters
          .filter((f) => canRead(who.role, who.id, f.id))
          .slice(0, limit)
          .map((f) => ({ id: f.id, inScope: true }));
      },
    ),
    insertMedicalReadAudits: vi.fn(async () => undefined),
    listActiveInjuriesForFighters: vi.fn(async (ids: readonly string[]) => group(store.injuries, ids)),
    listActiveRecoveryPlansForFighters: vi.fn(async (ids: readonly string[]) => group(store.plans, ids)),
    listActiveClearancesForFighters: vi.fn(async (ids: readonly string[]) => group(activeClearances, ids)),
    listOpenReviewRequestsForFighters: vi.fn(async (ids: readonly string[]) => group(store.reviewRequests, ids)),
    findCurrentExaminationsForFighters: vi.fn(async (ids: readonly string[]) => {
      const map = new Map<string, ExamRow>();
      for (const id of ids) {
        for (const scope of ['TRAINING', 'COMPETITION'] as const) {
          const row = currentExam(id, scope);
          if (row) map.set(`${id}:${scope}`, row);
        }
      }
      return map;
    }),
    findFightersWithBaselineOnFile: vi.fn(
      async (ids: readonly string[]) => new Set(ids.filter((id) => store.baseline.has(id))),
    ),
    listClearancesForExaminations: vi.fn(async (examinationIds: readonly string[]) => {
      const map = new Map<string, (ClearanceEligibilityRow & { clearanceType: ClearanceType })[]>();
      for (const row of store.clearances) {
        if (!examinationIds.includes(row.examinationId)) continue;
        map.set(row.examinationId, [
          ...(map.get(row.examinationId) ?? []),
          { ...eligibilityRow(row), clearanceType: row.clearanceType },
        ]);
      }
      return map;
    }),
  };
}

const BATCH_METHODS = [
  'findFightersInMedicalReadScope',
  'insertMedicalReadAudits',
  'listActiveInjuriesForFighters',
  'listActiveRecoveryPlansForFighters',
  'listActiveClearancesForFighters',
  'listOpenReviewRequestsForFighters',
  'findCurrentExaminationsForFighters',
  'findFightersWithBaselineOnFile',
  'listClearancesForExaminations',
  'findExaminationDetails',
] as const;

describe('GET /medical/dossiers (T-064)', () => {
  let store: ReturnType<typeof buildStore>;
  let repo: ReturnType<typeof fakeRepository>;
  let settings: Mocked<AcademySettingsRepository>;
  let service: MedicalService;

  const allIds = () => store.fighters.filter((f) => !f.deleted).map((f) => f.id);
  const totalQueries = () =>
    Object.values(repo).reduce((sum, fn) => sum + fn.mock.calls.length, 0) +
    settings.getMedicalSupervision.mock.calls.length;
  const resetCounts = () => {
    Object.values(repo).forEach((fn) => fn.mockClear());
    settings.getMedicalSupervision.mockClear();
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    store = buildStore();
    repo = fakeRepository(store);
    settings = {
      getMedicalSupervision: vi.fn().mockResolvedValue('DOCTOR'),
    } as unknown as Mocked<AcademySettingsRepository>;
    const typedRepo = repo as unknown as MedicalRepository;
    service = new MedicalService(
      typedRepo,
      new MedicalAccessService(typedRepo),
      settings,
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('criterion 1: same dossier as GET /fighters/:id/medical', () => {
    it.each(['DOCTOR', 'NONE'] as const)(
      'deep-equals the single endpoint for every Fighter (supervision %s)',
      async (supervision) => {
        settings.getMedicalSupervision.mockResolvedValue(supervision);
        const ids = allIds();

        const batch = await service.getDossiers(adminActor, { fighterIds: ids }, 'req-batch');

        expect(batch.map((dossier) => dossier.fighterId)).toEqual(ids);
        for (const [index, id] of ids.entries()) {
          const single = await service.getDossier(adminActor, id, `req-${id}`);
          expect(batch[index]).toEqual(single);
        }
      },
    );

    it('covers the interesting cases in the fixture (sanity)', async () => {
      const batch = await service.getDossiers(adminActor, {}, 'req-batch');
      const reasons = new Set(
        batch.flatMap((d) => [...d.eligibility.training.reasons, ...d.eligibility.competition.reasons]),
      );
      expect(batch.some((d) => d.eligibility.training.eligible)).toBe(true);
      expect(reasons.size).toBeGreaterThanOrEqual(3);
      expect(batch.some((d) => d.currentExaminations.training?.details)).toBe(true);
      expect(batch.some((d) => d.currentExaminations.competition === null)).toBe(true);
    });

    it('returns results in request order and ignores duplicate ids', async () => {
      const [a, b] = [fighterId(4), fighterId(1)];
      const batch = await service.getDossiers(adminActor, { fighterIds: [a, b, a] }, 'req');
      expect(batch.map((d) => d.fighterId)).toEqual([a, b]);
      expect(repo.insertMedicalReadAudits).toHaveBeenCalledWith(
        ADMIN_USER,
        [a, b],
        MEDICAL_READ_VIEW.DOSSIER,
        'req',
      );
    });
  });

  describe('criterion 2: query count does not depend on batch size', () => {
    it('reads a batch of 20 Fighters in at most 15 queries, one per batch method', async () => {
      const ids = Array.from({ length: 20 }, (_, i) => fighterId(i)).filter((id) =>
        allIds().includes(id),
      );
      const { fighters } = store;
      // Make all 20 readable: undelete the last one for this test.
      fighters[FIGHTER_COUNT - 1].deleted = false;
      ids.push(fighterId(FIGHTER_COUNT - 1));
      expect(ids).toHaveLength(20);

      await service.getDossiers(adminActor, { fighterIds: ids }, 'req');

      expect(totalQueries()).toBeLessThanOrEqual(15);
      for (const method of BATCH_METHODS) {
        expect(repo[method], method).toHaveBeenCalledTimes(1);
      }
      expect(settings.getMedicalSupervision).toHaveBeenCalledTimes(1);
      // No per-Fighter query is used by the batch path.
      expect(repo.findFighter).not.toHaveBeenCalled();
      expect(repo.listActiveInjuries).not.toHaveBeenCalled();
      expect(repo.findCurrentExamination).not.toHaveBeenCalled();
      expect(repo.listClearancesForExamination).not.toHaveBeenCalled();
    });

    it('uses the same number of queries for 2 and 19 Fighters', async () => {
      await service.getDossiers(adminActor, { fighterIds: [fighterId(1), fighterId(2)] }, 'req');
      const small = totalQueries();
      resetCounts();
      await service.getDossiers(adminActor, { fighterIds: allIds() }, 'req');
      expect(totalQueries()).toBe(small);
    });
  });

  describe('criterion 3: an id outside the scope fails the whole call with 403', () => {
    it.each([
      ['COACH', coachActor, [fighterId(1), fighterId(12)]],
      ['DOCTOR', doctorActor, [fighterId(1), fighterId(16)]],
      ['FIGHTER', fighterActor, [fighterId(3), fighterId(4)]],
    ] as const)('%s', async (_role, who, ids) => {
      const error = await service
        .getDossiers(who, { fighterIds: [...ids] }, 'req')
        .catch((caught: HttpException) => caught);

      expect((error as HttpException).getStatus()).toBe(HttpStatus.FORBIDDEN);
      expect((error as HttpException).getResponse()).toMatchObject({
        code: 'MEDICAL_ACCESS_DENIED',
      });
      expect(repo.findFightersInMedicalReadScope).toHaveBeenCalledTimes(1);
      expect(repo.insertMedicalReadAudits).not.toHaveBeenCalled();
      expect(repo.listActiveInjuriesForFighters).not.toHaveBeenCalled();
    });

    it.each([
      ['COACH', coachActor, [fighterId(0), fighterId(9)]],
      ['DOCTOR', doctorActor, [fighterId(0), fighterId(14)]],
      ['FIGHTER', fighterActor, [fighterId(3)]],
    ] as const)('%s reads ids inside the scope', async (_role, who, ids) => {
      const batch = await service.getDossiers(who, { fighterIds: [...ids] }, 'req');
      expect(batch.map((d) => d.fighterId)).toEqual(ids);
    });

    it('returns 404 FIGHTER_NOT_FOUND for an unknown or deleted id', async () => {
      const error = await service
        .getDossiers(adminActor, { fighterIds: [fighterId(1), fighterId(FIGHTER_COUNT - 1)] }, 'req')
        .catch((caught: HttpException) => caught);
      expect((error as HttpException).getStatus()).toBe(HttpStatus.NOT_FOUND);
      expect((error as HttpException).getResponse()).toMatchObject({ code: 'FIGHTER_NOT_FOUND' });
      expect(repo.insertMedicalReadAudits).not.toHaveBeenCalled();
    });
  });

  describe('criterion 4: one audit row per Fighter, in one insert', () => {
    it('without fighterIds, reads and audits exactly the caller scope', async () => {
      const batch = await service.getDossiers(coachActor, {}, 'req-coach');
      const expected = [...store.coachAssigned];

      expect(batch.map((d) => d.fighterId)).toEqual(expected);
      expect(repo.insertMedicalReadAudits).toHaveBeenCalledTimes(1);
      expect(repo.insertMedicalReadAudits).toHaveBeenCalledWith(
        COACH_USER,
        expected,
        MEDICAL_READ_VIEW.DOSSIER,
        'req-coach',
      );
      expect(repo.insertMedicalReadAudit).not.toHaveBeenCalled();
    });

    it('fails closed with 500 when the audit insert fails, before reading data', async () => {
      repo.insertMedicalReadAudits.mockRejectedValueOnce(new Error('db down'));
      const error = await service
        .getDossiers(adminActor, { fighterIds: [fighterId(1)] }, 'req')
        .catch((caught: HttpException) => caught);
      expect((error as HttpException).getStatus()).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(repo.listActiveInjuriesForFighters).not.toHaveBeenCalled();
    });

    it('returns an empty list without auditing when the scope is empty', async () => {
      const lonely = actor(USER.COACH, 'c0000000-0000-4000-8000-000000000999');
      await expect(service.getDossiers(lonely, {}, 'req')).resolves.toEqual([]);
      expect(repo.listActiveInjuriesForFighters).not.toHaveBeenCalled();
    });

    it('rejects a whole scope above the batch maximum with 400', async () => {
      repo.findFightersInMedicalReadScope.mockResolvedValueOnce(
        Array.from({ length: 101 }, (_, i) => ({ id: fighterId(i), inScope: true })),
      );
      const error = await service
        .getDossiers(adminActor, {}, 'req')
        .catch((caught: HttpException) => caught);
      expect((error as HttpException).getStatus()).toBe(HttpStatus.BAD_REQUEST);
      expect((error as HttpException).getResponse()).toMatchObject({
        code: 'MEDICAL_DOSSIER_SCOPE_TOO_LARGE',
      });
      expect(repo.findFightersInMedicalReadScope).toHaveBeenCalledWith(
        expect.objectContaining({ id: ADMIN_USER }),
        undefined,
        101,
      );
      expect(repo.insertMedicalReadAudits).not.toHaveBeenCalled();
    });
  });
});

describe('listMedicalDossiersQuerySchema', () => {
  const a = fighterId(1);
  const b = fighterId(2);

  it('accepts repeated and comma-separated fighterIds', () => {
    expect(listMedicalDossiersQuerySchema.parse({ fighterIds: [a, b] })).toEqual({ fighterIds: [a, b] });
    expect(listMedicalDossiersQuerySchema.parse({ fighterIds: `${a},${b}` })).toEqual({ fighterIds: [a, b] });
    expect(listMedicalDossiersQuerySchema.parse({ fighterIds: [`${a},${b}`, a] })).toEqual({
      fighterIds: [a, b, a],
    });
  });

  it('treats an absent or blank fighterIds as the whole scope', () => {
    expect(listMedicalDossiersQuerySchema.parse({})).toEqual({});
    expect(listMedicalDossiersQuerySchema.parse({ fighterIds: '' }).fighterIds).toBeUndefined();
  });

  it('rejects more than 100 ids, invalid uuids and unknown keys', () => {
    const many = Array.from({ length: 101 }, (_, i) => fighterId(i));
    expect(listMedicalDossiersQuerySchema.safeParse({ fighterIds: many }).success).toBe(false);
    expect(listMedicalDossiersQuerySchema.safeParse({ fighterIds: 'nope' }).success).toBe(false);
    expect(listMedicalDossiersQuerySchema.safeParse({ fighterId: a }).success).toBe(false);
  });
});
