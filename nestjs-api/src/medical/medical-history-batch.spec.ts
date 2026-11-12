import { HttpStatus, type HttpException } from '@nestjs/common';
import type { AcademySettingsRepository } from '../academy-settings/academy-settings.repo.js';
import type { AuthenticatedUser } from '../shared/models/auth-context.model.js';
import { USER, type UserRole } from '../shared/types/user.role.js';
import { MedicalAccessService } from './medical-access.service.js';
import {
  MEDICAL_HISTORY_RECORD_TYPE,
  MEDICAL_READ_VIEW,
  type MedicalHistoryRecordType,
} from './medical.constants.js';
import {
  listMedicalHistoryBatchQuerySchema,
  MEDICAL_HISTORY_BATCH_MAX_ENTRIES,
  type ListMedicalHistoryQuery,
  type MedicalHistoryEntry,
} from './medical.model.js';
import type { MedicalRepository } from './medical.repo.js';
import { MedicalService } from './medical.service.js';

/**
 * GET /medical/history: batch form of GET /fighters/:id/medical/history. An
 * in-memory store backs both the paginated per-Fighter repository read and the
 * batch read, so the two endpoints can be compared on exactly the same data.
 */

const COACH_USER = 'c0000000-0000-4000-8000-000000000001';
const DOCTOR_USER = 'd0000000-0000-4000-8000-000000000001';
const ADMIN_USER = 'a0000000-0000-4000-8000-000000000001';
const FIGHTER_COUNT = 20;
const BASE = Date.parse('2026-11-12T08:00:00.000Z');

const fighterId = (index: number) =>
  `f0000000-0000-4000-8000-${String(index).padStart(12, '0')}`;
const fighterUserId = (index: number) =>
  `e0000000-0000-4000-8000-${String(index).padStart(12, '0')}`;
const recordId = (index: number) =>
  `70000000-0000-4000-8000-${String(index).padStart(12, '0')}`;

function actor(role: UserRole, id: string): AuthenticatedUser {
  return { id, role, authSubject: `${id}-sub`, email: `${role}@example.com` };
}
const adminActor = actor(USER.ADMIN, ADMIN_USER);
const coachActor = actor(USER.COACH, COACH_USER);
const doctorActor = actor(USER.DOCTOR, DOCTOR_USER);
const fighterActor = actor(USER.FIGHTER, fighterUserId(3));

const RECORD_TYPES = Object.values(MEDICAL_HISTORY_RECORD_TYPE);

type StoredEntry = MedicalHistoryEntry & { fighterId: string };

/** Varied history: every record type, several revisions, timestamp ties. */
function buildStore() {
  const fighters = Array.from({ length: FIGHTER_COUNT }, (_, index) => ({
    id: fighterId(index),
    userId: fighterUserId(index),
    deleted: index === FIGHTER_COUNT - 1,
  }));
  const coachAssigned = new Set(fighters.slice(0, 10).map((f) => f.id));
  const doctorAssigned = new Set(fighters.slice(0, 15).map((f) => f.id));
  const entries: StoredEntry[] = [];
  let record = 0;
  fighters.forEach(({ id }, index) => {
    // Fighter 0 has no history at all.
    for (let n = 0; n < index % 7; n += 1) {
      record += 1;
      const recordType = RECORD_TYPES[(index + n) % RECORD_TYPES.length];
      const revisions =
        recordType === 'TREATMENT' || recordType === 'MEDICAL_EXAMINATION'
          ? 1
          : 1 + (n % 3);
      for (let revision = 1; revision <= revisions; revision += 1) {
        entries.push({
          fighterId: id,
          recordType,
          recordId: recordId(record),
          revision,
          source: revisions === 1 ? null : 'APPLICATION',
          // Coarse timestamps so several entries share one recordedAt.
          recordedAt: new Date(BASE - ((record * 7 + revision) % 11) * 3_600_000),
          recordedByUserId: revisions === 1 ? null : DOCTOR_USER,
          snapshot: { id: recordId(record), revision },
        });
      }
    }
  });
  return { fighters, coachAssigned, doctorAssigned, entries };
}

/** Same ORDER BY as the SQL: recorded_at DESC, record_id, revision DESC. */
function newestFirst(a: StoredEntry, b: StoredEntry): number {
  return (
    new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime() ||
    a.recordId.localeCompare(b.recordId) ||
    b.revision - a.revision
  );
}

const withoutFighter = ({ fighterId: _id, ...entry }: StoredEntry) => entry;

function fakeRepository(store: ReturnType<typeof buildStore>) {
  const live = (id: string) => store.fighters.find((f) => f.id === id && !f.deleted);
  const canRead = (role: UserRole, userId: string, fid: string) => {
    const fighter = live(fid);
    if (!fighter) return false;
    if (role === USER.ADMIN) return true;
    if (role === USER.FIGHTER) return fighter.userId === userId;
    if (role === USER.COACH) return userId === COACH_USER && store.coachAssigned.has(fid);
    if (role === USER.DOCTOR) return userId === DOCTOR_USER && store.doctorAssigned.has(fid);
    return false;
  };
  const matching = (ids: readonly string[], recordType: MedicalHistoryRecordType | undefined) =>
    store.entries
      .filter((e) => ids.includes(e.fighterId) && (!recordType || e.recordType === recordType))
      .sort(newestFirst);

  return {
    // Per-Fighter read (GET /fighters/:id/medical/history)
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
    listHistory: vi.fn(async (fid: string, query: ListMedicalHistoryQuery) => {
      const all = matching([fid], query.recordType);
      const start = (query.page - 1) * query.limit;
      return {
        data: all.slice(start, start + query.limit).map(withoutFighter),
        total: all.length,
      };
    }),

    // Batch read (GET /medical/history)
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
    listHistoryForFighters: vi.fn(
      async (ids: readonly string[], recordType: MedicalHistoryRecordType | undefined, limit: number) =>
        matching(ids, recordType)
          .slice(0, limit)
          .map((e) => ({ fighterId: e.fighterId, entry: withoutFighter(e) })),
    ),
  };
}

describe('GET /medical/history (batch)', () => {
  let store: ReturnType<typeof buildStore>;
  let repo: ReturnType<typeof fakeRepository>;
  let service: MedicalService;

  const allIds = () => store.fighters.filter((f) => !f.deleted).map((f) => f.id);
  const totalQueries = () =>
    Object.values(repo).reduce((sum, fn) => sum + fn.mock.calls.length, 0);
  const resetCounts = () => Object.values(repo).forEach((fn) => fn.mockClear());

  /** Every page of the single endpoint for one Fighter. */
  async function drainSingle(
    id: string,
    recordType: MedicalHistoryRecordType | undefined,
  ): Promise<MedicalHistoryEntry[]> {
    const entries: MedicalHistoryEntry[] = [];
    for (let page = 1; ; page += 1) {
      const result = await service.listHistory(
        adminActor,
        id,
        { page, limit: 2, recordType },
        `req-${id}-${page}`,
      );
      entries.push(...result.data);
      if (!result.hasNextPage) return entries;
    }
  }

  beforeEach(() => {
    store = buildStore();
    repo = fakeRepository(store);
    const typedRepo = repo as unknown as MedicalRepository;
    service = new MedicalService(
      typedRepo,
      new MedicalAccessService(typedRepo),
      {} as AcademySettingsRepository,
    );
  });

  describe('same entries as GET /fighters/:id/medical/history', () => {
    it.each([undefined, ...RECORD_TYPES])(
      'deep-equals every page of the single endpoint for every Fighter (recordType %s)',
      async (recordType) => {
        const ids = allIds();
        const batch = await service.listHistoryBatch(
          adminActor,
          { fighterIds: ids, recordType },
          'req-batch',
        );

        expect(batch.map((item) => item.fighterId)).toEqual(ids);
        for (const [index, id] of ids.entries()) {
          expect(batch[index]).toEqual({
            fighterId: id,
            entries: await drainSingle(id, recordType),
          });
        }
      },
    );

    it('covers the interesting cases in the fixture (sanity)', async () => {
      const batch = await service.listHistoryBatch(adminActor, {}, 'req');
      const entries = batch.flatMap((item) => item.entries);
      expect(new Set(entries.map((e) => e.recordType)).size).toBe(RECORD_TYPES.length);
      expect(entries.some((e) => e.revision > 1)).toBe(true);
      expect(batch.some((item) => item.entries.length === 0)).toBe(true);
      expect(batch.filter((item) => item.entries.length > 2).length).toBeGreaterThan(5);
    });

    it('returns results in request order, ignores duplicates and passes recordType', async () => {
      const [a, b] = [fighterId(4), fighterId(1)];
      const batch = await service.listHistoryBatch(
        adminActor,
        { fighterIds: [a, b, a], recordType: 'INJURY' },
        'req',
      );
      expect(batch.map((item) => item.fighterId)).toEqual([a, b]);
      expect(repo.listHistoryForFighters).toHaveBeenCalledWith(
        [a, b],
        'INJURY',
        MEDICAL_HISTORY_BATCH_MAX_ENTRIES + 1,
      );
    });
  });

  describe('query count does not depend on batch size', () => {
    it('reads a batch in exactly three queries: scope, audit, history', async () => {
      await service.listHistoryBatch(adminActor, { fighterIds: allIds() }, 'req');

      expect(totalQueries()).toBe(3);
      expect(repo.findFightersInMedicalReadScope).toHaveBeenCalledTimes(1);
      expect(repo.insertMedicalReadAudits).toHaveBeenCalledTimes(1);
      expect(repo.listHistoryForFighters).toHaveBeenCalledTimes(1);
      expect(repo.findFighter).not.toHaveBeenCalled();
      expect(repo.listHistory).not.toHaveBeenCalled();
      expect(repo.insertMedicalReadAudit).not.toHaveBeenCalled();
    });

    it('uses the same number of queries for 2 and 19 Fighters', async () => {
      await service.listHistoryBatch(adminActor, { fighterIds: [fighterId(1), fighterId(2)] }, 'req');
      const small = totalQueries();
      resetCounts();
      await service.listHistoryBatch(adminActor, { fighterIds: allIds() }, 'req');
      expect(totalQueries()).toBe(small);
    });
  });

  describe('scope: all-or-nothing', () => {
    it.each([
      ['COACH', coachActor, [fighterId(1), fighterId(12)]],
      ['DOCTOR', doctorActor, [fighterId(1), fighterId(16)]],
      ['FIGHTER', fighterActor, [fighterId(3), fighterId(4)]],
    ] as const)('%s: an id outside the scope is 403 for the whole call', async (_role, who, ids) => {
      const error = await service
        .listHistoryBatch(who, { fighterIds: [...ids] }, 'req')
        .catch((caught: HttpException) => caught);

      expect((error as HttpException).getStatus()).toBe(HttpStatus.FORBIDDEN);
      expect((error as HttpException).getResponse()).toMatchObject({
        code: 'MEDICAL_ACCESS_DENIED',
      });
      expect(repo.insertMedicalReadAudits).not.toHaveBeenCalled();
      expect(repo.listHistoryForFighters).not.toHaveBeenCalled();
    });

    it.each([
      ['COACH', coachActor, [fighterId(1), fighterId(FIGHTER_COUNT - 1)]],
      ['DOCTOR', doctorActor, [fighterId(1), fighterId(FIGHTER_COUNT - 1)]],
      ['FIGHTER', fighterActor, [fighterId(3), fighterId(FIGHTER_COUNT - 1)]],
    ] as const)('%s: an unknown or deleted id is 404 FIGHTER_NOT_FOUND', async (_role, who, ids) => {
      const error = await service
        .listHistoryBatch(who, { fighterIds: [...ids] }, 'req')
        .catch((caught: HttpException) => caught);

      expect((error as HttpException).getStatus()).toBe(HttpStatus.NOT_FOUND);
      expect((error as HttpException).getResponse()).toMatchObject({ code: 'FIGHTER_NOT_FOUND' });
      expect(repo.insertMedicalReadAudits).not.toHaveBeenCalled();
      expect(repo.listHistoryForFighters).not.toHaveBeenCalled();
    });

    it.each([
      ['COACH', coachActor, [fighterId(0), fighterId(9)]],
      ['DOCTOR', doctorActor, [fighterId(0), fighterId(14)]],
      ['FIGHTER', fighterActor, [fighterId(3)]],
    ] as const)('%s reads ids inside the scope', async (_role, who, ids) => {
      const batch = await service.listHistoryBatch(who, { fighterIds: [...ids] }, 'req');
      expect(batch.map((item) => item.fighterId)).toEqual(ids);
    });

    it.each([
      ['COACH', coachActor, () => [...store.coachAssigned]],
      ['DOCTOR', doctorActor, () => [...store.doctorAssigned]],
      ['FIGHTER', fighterActor, () => [fighterId(3)]],
    ] as const)('%s without fighterIds reads exactly the caller scope', async (_role, who, expected) => {
      const batch = await service.listHistoryBatch(who, {}, 'req');
      expect(batch.map((item) => item.fighterId)).toEqual(expected());
    });
  });

  describe('audit: one row per Fighter, in one insert', () => {
    it('audits every returned Fighter with view HISTORY', async () => {
      const batch = await service.listHistoryBatch(coachActor, {}, 'req-coach');
      const expected = [...store.coachAssigned];

      expect(batch.map((item) => item.fighterId)).toEqual(expected);
      expect(repo.insertMedicalReadAudits).toHaveBeenCalledTimes(1);
      expect(repo.insertMedicalReadAudits).toHaveBeenCalledWith(
        COACH_USER,
        expected,
        MEDICAL_READ_VIEW.HISTORY,
        'req-coach',
      );
      expect(repo.insertMedicalReadAudit).not.toHaveBeenCalled();
    });

    it('fails closed with 500 when the audit insert fails, before reading data', async () => {
      repo.insertMedicalReadAudits.mockRejectedValueOnce(new Error('db down'));
      const error = await service
        .listHistoryBatch(adminActor, { fighterIds: [fighterId(1)] }, 'req')
        .catch((caught: HttpException) => caught);
      expect((error as HttpException).getStatus()).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(repo.listHistoryForFighters).not.toHaveBeenCalled();
    });

    it('returns an empty list without reading history when the scope is empty', async () => {
      const lonely = actor(USER.COACH, 'c0000000-0000-4000-8000-000000000999');
      await expect(service.listHistoryBatch(lonely, {}, 'req')).resolves.toEqual([]);
      expect(repo.listHistoryForFighters).not.toHaveBeenCalled();
    });
  });

  describe('size limits', () => {
    it('rejects more than 5000 entries with 400 instead of truncating', async () => {
      const entry = store.entries[0];
      repo.listHistoryForFighters.mockResolvedValueOnce(
        Array.from({ length: MEDICAL_HISTORY_BATCH_MAX_ENTRIES + 1 }, () => ({
          fighterId: entry.fighterId,
          entry: withoutFighter(entry),
        })),
      );
      const error = await service
        .listHistoryBatch(adminActor, { fighterIds: [entry.fighterId] }, 'req')
        .catch((caught: HttpException) => caught);
      expect((error as HttpException).getStatus()).toBe(HttpStatus.BAD_REQUEST);
      expect((error as HttpException).getResponse()).toMatchObject({
        code: 'MEDICAL_HISTORY_BATCH_TOO_LARGE',
      });
    });

    it('accepts exactly 5000 entries', async () => {
      const entry = store.entries[0];
      repo.listHistoryForFighters.mockResolvedValueOnce(
        Array.from({ length: MEDICAL_HISTORY_BATCH_MAX_ENTRIES }, () => ({
          fighterId: entry.fighterId,
          entry: withoutFighter(entry),
        })),
      );
      const [item] = await service.listHistoryBatch(
        adminActor,
        { fighterIds: [entry.fighterId] },
        'req',
      );
      expect(item.entries).toHaveLength(MEDICAL_HISTORY_BATCH_MAX_ENTRIES);
    });

    it('rejects a whole scope above 100 Fighters with 400', async () => {
      repo.findFightersInMedicalReadScope.mockResolvedValueOnce(
        Array.from({ length: 101 }, (_, i) => ({ id: fighterId(i), inScope: true })),
      );
      const error = await service
        .listHistoryBatch(adminActor, {}, 'req')
        .catch((caught: HttpException) => caught);
      expect((error as HttpException).getStatus()).toBe(HttpStatus.BAD_REQUEST);
      expect((error as HttpException).getResponse()).toMatchObject({
        code: 'MEDICAL_DOSSIER_SCOPE_TOO_LARGE',
      });
      expect(repo.insertMedicalReadAudits).not.toHaveBeenCalled();
    });
  });
});

describe('listMedicalHistoryBatchQuerySchema', () => {
  const a = fighterId(1);
  const b = fighterId(2);

  it('accepts repeated and comma-separated fighterIds with a recordType', () => {
    expect(
      listMedicalHistoryBatchQuerySchema.parse({ fighterIds: `${a},${b}`, recordType: 'TREATMENT' }),
    ).toEqual({ fighterIds: [a, b], recordType: 'TREATMENT' });
    expect(listMedicalHistoryBatchQuerySchema.parse({ fighterIds: [a, b] })).toEqual({
      fighterIds: [a, b],
    });
  });

  it('treats an absent fighterIds as the whole scope', () => {
    expect(listMedicalHistoryBatchQuerySchema.parse({})).toEqual({});
  });

  it('rejects more than 100 ids, unknown record types, pagination and unknown keys', () => {
    const many = Array.from({ length: 101 }, (_, i) => fighterId(i));
    expect(listMedicalHistoryBatchQuerySchema.safeParse({ fighterIds: many }).success).toBe(false);
    expect(listMedicalHistoryBatchQuerySchema.safeParse({ recordType: 'NOPE' }).success).toBe(false);
    expect(listMedicalHistoryBatchQuerySchema.safeParse({ page: '1' }).success).toBe(false);
    expect(listMedicalHistoryBatchQuerySchema.safeParse({ fighterId: a }).success).toBe(false);
  });
});
