import { ForbiddenException, type HttpException } from '@nestjs/common';
import { invalidateAuthCache } from '../auth/auth-cache.js';
import type { AuthenticatedUser } from '../shared/models/auth-context.model.js';
import { USER, type UserRole } from '../shared/types/user.role.js';
import {
  ACTOR_PROFILE_CACHE_TTL_MS,
  TrainingAccessService,
} from './training-access.service.js';
import {
  listPlansQuerySchema,
  listSessionsQuerySchema,
  type ListSessionsQuery,
  type SessionStatusType,
} from './training.model.js';
import type {
  TrainingListResult,
  TrainingListScope,
  TrainingRepository,
} from './training.repo.js';
import { TrainingSessionService } from './sessions/training-session.service.js';
import { TrainingPlanService } from './plans/training-plan.service.js';

/**
 * T-063 (fighterIds + multi-value status on GET /training-sessions and
 * GET /training-plans) and T-067 (cached actor profile, assignment folded into
 * the list query) at the service level, against an in-memory repository.
 */

const COACH_ID = 'c0000000-0000-4000-8000-0000000000c1';
const fighter = (n: number) => `f0000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const [A, B, C] = [fighter(1), fighter(2), fighter(3)];
const COACH_ASSIGNED = new Set([A, B]);
const DOCTOR_ASSIGNED = new Set([A, B]);

function actor(role: UserRole, id: string): AuthenticatedUser {
  return { id, role, authSubject: `${id}-sub`, email: `${role}@example.com` };
}
const coachActor = actor(USER.COACH, 'u-coach');
const doctorActor = actor(USER.DOCTOR, 'u-doctor');
const fighterActor = actor(USER.FIGHTER, 'u-fighter');
const adminActor = actor(USER.ADMIN, 'u-admin');

const STATUSES: SessionStatusType[] = ['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
interface Row {
  id: string;
  fighterId: string;
  coachId: string | null;
  status: string;
  scheduledAt: string;
}
const sessions: Row[] = [A, B, C].flatMap((fighterId, f) =>
  STATUSES.map((status, s) => ({
    id: `s-${f}-${s}`,
    fighterId,
    coachId: COACH_ID,
    status,
    scheduledAt: new Date(Date.UTC(2026, 10, 1 + f * 4 + s)).toISOString(),
  })),
);

/** Same filtering rules as the SQL in `TrainingRepository.findSessions`. */
function listRows(
  rows: Row[],
  query: { page: number; limit: number; fighterId?: string; fighterIds?: string[]; coachId?: string; status?: string[] },
  scope: TrainingListScope,
): TrainingListResult<Row> {
  const matching = rows
    .filter((row) => !query.fighterId || row.fighterId === query.fighterId)
    .filter((row) => !query.fighterIds?.length || query.fighterIds.includes(row.fighterId))
    .filter((row) => !query.coachId || row.coachId === query.coachId)
    .filter((row) => !query.status?.length || query.status.includes(row.status))
    .filter((row) => !scope.activeCoachId || COACH_ASSIGNED.has(row.fighterId))
    .sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt));
  const result: TrainingListResult<Row> = {
    data: matching.slice((query.page - 1) * query.limit, query.page * query.limit),
    total: matching.length,
  };
  if (scope.activeCoachId && scope.requiredFighterIds?.length) {
    result.requiredFightersAssigned = scope.requiredFighterIds.every((id) => COACH_ASSIGNED.has(id));
  }
  return result;
}

function repositoryMock() {
  return {
    findActiveCoachIdByUserId: vi.fn(async () => COACH_ID),
    findActiveFighterIdByUserId: vi.fn(async () => C),
    isCoachProfileOwnedByUser: vi.fn(async () => true),
    isCoachAssignedToFighter: vi.fn(async () => true),
    isDoctorAssignedToFighter: vi.fn(async () => true),
    findDoctorAssignedFighterIds: vi.fn(
      async (_userId: string, ids: readonly string[]) => new Set(ids.filter((id) => DOCTOR_ASSIGNED.has(id))),
    ),
    findSessions: vi.fn(async (query: ListSessionsQuery, scope: TrainingListScope = {}) =>
      listRows(sessions, query, scope),
    ),
    findPlans: vi.fn(async (query: Parameters<typeof listRows>[1], scope: TrainingListScope = {}) =>
      listRows(sessions, query, scope),
    ),
  };
}

const sessionsQuery = (raw: Record<string, unknown>) =>
  listSessionsQuerySchema.parse({ limit: '100', ...raw });

describe('training lists: fighterIds and multi-value status (T-063)', () => {
  let repo: ReturnType<typeof repositoryMock>;
  let access: TrainingAccessService;
  let service: TrainingSessionService;
  let plans: TrainingPlanService;

  const queryCount = () =>
    Object.values(repo).reduce((sum, fn) => sum + fn.mock.calls.length, 0);

  beforeEach(() => {
    repo = repositoryMock();
    access = new TrainingAccessService(repo as unknown as TrainingRepository);
    service = new TrainingSessionService(
      repo as unknown as TrainingRepository,
      access,
      ...([undefined, undefined, undefined] as unknown as [never, never, never]),
    );
    plans = new TrainingPlanService(
      repo as unknown as TrainingRepository,
      access,
      undefined as never,
    );
  });

  describe('criterion 1: one call returns the union of the single calls', () => {
    it.each([
      ['COACH', coachActor],
      ['DOCTOR', doctorActor],
      ['ADMIN', adminActor],
    ] as const)('%s: fighterIds=a,b & status=SCHEDULED&status=IN_PROGRESS', async (_role, who) => {
      const batch = await service.listSessions(
        who,
        sessionsQuery({ fighterIds: `${A},${B}`, status: ['SCHEDULED', 'IN_PROGRESS'] }),
      );

      const singles = [];
      for (const fighterId of [A, B]) {
        for (const status of ['SCHEDULED', 'IN_PROGRESS']) {
          singles.push(...(await service.listSessions(who, sessionsQuery({ fighterId, status }))).data);
        }
      }

      expect(batch.total).toBe(4);
      expect(new Set(batch.data.map((row) => (row as Row).id))).toEqual(
        new Set(singles.map((row) => (row as Row).id)),
      );
    });

    it('plans accept the same filters', async () => {
      const result = await plans.listPlans(
        doctorActor,
        listPlansQuerySchema.parse({ fighterIds: [A, B], status: 'ACTIVE,DRAFT' }),
      );
      expect(repo.findPlans).toHaveBeenCalledWith(
        expect.objectContaining({ fighterIds: [A, B], status: ['ACTIVE', 'DRAFT'] }),
        {},
      );
      expect(result.hasNextPage).toBe(false);
    });

    it('a FIGHTER is still forced to the own profile, fighterIds included', async () => {
      await service.listSessions(fighterActor, sessionsQuery({ fighterIds: [A, B] }));
      const [query] = repo.findSessions.mock.calls[0];
      expect(query.fighterId).toBe(C);
      expect(query.fighterIds).toBeUndefined();
    });
  });

  describe('criterion 2: DOCTOR with one unassigned id gets 403 and no data', () => {
    it.each([
      ['sessions', () => service.listSessions(doctorActor, sessionsQuery({ fighterIds: [A, C] }))],
      ['plans', () => plans.listPlans(doctorActor, listPlansQuerySchema.parse({ fighterIds: `${A},${C}` }))],
      ['sessions, legacy fighterId', () => service.listSessions(doctorActor, sessionsQuery({ fighterId: C }))],
    ] as const)('%s', async (_name, call) => {
      await expect(call()).rejects.toThrow(ForbiddenException);
      expect(repo.findSessions).not.toHaveBeenCalled();
      expect(repo.findPlans).not.toHaveBeenCalled();
    });

    it('still requires a fighter scope from a DOCTOR', async () => {
      const error = await service
        .listSessions(doctorActor, sessionsQuery({}))
        .catch((caught: HttpException) => caught);
      expect((error as HttpException).getResponse()).toMatchObject({ code: 'FIGHTER_SCOPE_REQUIRED' });
    });
  });

  describe('criterion 3: one assignment query for a DOCTOR whatever the number of ids', () => {
    it.each([1, 2, 50, 100])('%i ids', async (count) => {
      const ids = Array.from({ length: count }, (_, i) => fighter(i + 1));
      DOCTOR_ASSIGNED.clear();
      ids.forEach((id) => DOCTOR_ASSIGNED.add(id));
      try {
        await service.listSessions(doctorActor, sessionsQuery({ fighterIds: ids }));
      } finally {
        DOCTOR_ASSIGNED.clear();
        [A, B].forEach((id) => DOCTOR_ASSIGNED.add(id));
      }

      expect(repo.findDoctorAssignedFighterIds).toHaveBeenCalledTimes(1);
      expect(repo.findDoctorAssignedFighterIds).toHaveBeenCalledWith(doctorActor.id, ids);
      expect(repo.isDoctorAssignedToFighter).not.toHaveBeenCalled();
      expect(queryCount()).toBe(2); // assignment check + list
    });
  });

  describe('criterion 4: the old single-value filters keep working', () => {
    it('parses a single status and fighterId as before', () => {
      expect(sessionsQuery({ fighterId: A, status: 'SCHEDULED' })).toMatchObject({
        fighterId: A,
        status: ['SCHEDULED'],
      });
    });

    it('rejects unknown statuses, bad uuids and more than 100 fighterIds', () => {
      expect(listSessionsQuerySchema.safeParse({ status: 'NOPE' }).success).toBe(false);
      expect(listPlansQuerySchema.safeParse({ status: ['ACTIVE', 'SCHEDULED'] }).success).toBe(false);
      expect(listSessionsQuerySchema.safeParse({ fighterIds: 'x' }).success).toBe(false);
      const many = Array.from({ length: 101 }, (_, i) => fighter(i));
      expect(listSessionsQuerySchema.safeParse({ fighterIds: many }).success).toBe(false);
      expect(listSessionsQuerySchema.safeParse({ fighterIds: many.slice(0, 100) }).success).toBe(true);
    });
  });
});

describe('training list scope per request (T-067)', () => {
  let repo: ReturnType<typeof repositoryMock>;
  let service: TrainingSessionService;

  const queryCount = () =>
    Object.values(repo).reduce((sum, fn) => sum + fn.mock.calls.length, 0);
  const clearCounts = () => Object.values(repo).forEach((fn) => fn.mockClear());

  beforeEach(() => {
    repo = repositoryMock();
    service = new TrainingSessionService(
      repo as unknown as TrainingRepository,
      new TrainingAccessService(repo as unknown as TrainingRepository),
      ...([undefined, undefined, undefined] as unknown as [never, never, never]),
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('a COACH list with fighterId is one repository call (data + count in parallel) when the cache is warm', async () => {
    await service.listSessions(coachActor, sessionsQuery({ fighterId: A }));
    clearCounts();

    const result = await service.listSessions(coachActor, sessionsQuery({ fighterId: A }));

    expect(result.total).toBe(STATUSES.length);
    expect(queryCount()).toBe(1);
    expect(repo.findSessions).toHaveBeenCalledWith(
      expect.objectContaining({ fighterId: A, coachId: COACH_ID }),
      { activeCoachId: COACH_ID, requiredFighterIds: [A] },
    );
    expect(repo.findActiveCoachIdByUserId).not.toHaveBeenCalled();
    expect(repo.isCoachAssignedToFighter).not.toHaveBeenCalled();
  });

  it('a COACH still gets 403 for an unassigned fighter, without a separate assignment query', async () => {
    await expect(
      service.listSessions(coachActor, sessionsQuery({ fighterId: C })),
    ).rejects.toThrow(ForbiddenException);
    await expect(
      service.listSessions(coachActor, sessionsQuery({ fighterIds: [A, C] })),
    ).rejects.toThrow(ForbiddenException);
    expect(repo.isCoachAssignedToFighter).not.toHaveBeenCalled();
  });

  it('the response never carries the internal assignment flag', async () => {
    const result = await service.listSessions(coachActor, sessionsQuery({ fighterIds: [A, B] }));
    expect(result).not.toHaveProperty('requiredFightersAssigned');
    expect(Object.keys(result).sort()).toEqual(['data', 'hasNextPage', 'total']);
  });

  it('a COACH list without fighters is unchanged', async () => {
    await service.listSessions(coachActor, sessionsQuery({}));
    expect(repo.findSessions).toHaveBeenCalledWith(expect.anything(), { activeCoachId: COACH_ID });
  });

  it('caches the coach and fighter profile ids for 60 s', async () => {
    vi.useFakeTimers();
    await service.listSessions(coachActor, sessionsQuery({}));
    await service.listSessions(coachActor, sessionsQuery({}));
    await service.listSessions(fighterActor, sessionsQuery({}));
    await service.listSessions(fighterActor, sessionsQuery({}));
    expect(repo.findActiveCoachIdByUserId).toHaveBeenCalledTimes(1);
    expect(repo.findActiveFighterIdByUserId).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(ACTOR_PROFILE_CACHE_TTL_MS + 1);
    await service.listSessions(coachActor, sessionsQuery({}));
    expect(repo.findActiveCoachIdByUserId).toHaveBeenCalledTimes(2);
  });

  it('is cleared by invalidateAuthCache', async () => {
    await service.listSessions(coachActor, sessionsQuery({}));
    invalidateAuthCache();
    await service.listSessions(coachActor, sessionsQuery({}));
    expect(repo.findActiveCoachIdByUserId).toHaveBeenCalledTimes(2);
  });

  it('does not cache a missing profile', async () => {
    repo.findActiveCoachIdByUserId.mockResolvedValueOnce(undefined as never);
    await expect(service.listSessions(coachActor, sessionsQuery({}))).rejects.toThrow(ForbiddenException);
    await service.listSessions(coachActor, sessionsQuery({}));
    expect(repo.findActiveCoachIdByUserId).toHaveBeenCalledTimes(2);
  });

  it('an explicit own coachId is accepted from the cache without the ownership query', async () => {
    await service.listSessions(coachActor, sessionsQuery({}));
    await service.listSessions(coachActor, sessionsQuery({ coachId: COACH_ID }));
    expect(repo.isCoachProfileOwnedByUser).not.toHaveBeenCalled();

    await service.listSessions(coachActor, sessionsQuery({ coachId: 'c0000000-0000-4000-8000-0000000000c2' }));
    expect(repo.isCoachProfileOwnedByUser).toHaveBeenCalledTimes(1);
  });
});
