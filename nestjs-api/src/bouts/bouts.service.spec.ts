import { HttpException } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mocked } from 'vitest';
import type {
  BoutRequirementRow,
  BoutRow,
  CompetitionRuleset,
} from '../database/schema.js';
import type { AuthenticatedUser } from '../shared/models/auth-context.model.js';
import { USER } from '../shared/types/user.role.js';
import type { Transaction } from '../shared/utils/audit-context.util.js';
import { academyStartOfDay, type CreateBoutInput } from './bouts.model.js';
import {
  buildRoundAdvice,
  type OpponentAnalysisInput,
  type RoundInput,
} from './bout-analysis.model.js';
import { BoutsRepository } from './bouts.repo.js';
import { BoutsService } from './bouts.service.js';

const NOW = new Date('2026-10-20T03:00:00.000Z'); // 2026-10-20 10:00 in Vietnam
const FIGHTER_ID = '10000000-0000-4000-8000-000000000001';
const OTHER_FIGHTER_ID = '10000000-0000-4000-8000-000000000002';
const COACH_ID = '20000000-0000-4000-8000-000000000001';
const RULESET_ID = '30000000-0000-4000-8000-000000000001';
const BOUT_ID = '40000000-0000-4000-8000-000000000001';
const PLAN_ID = '50000000-0000-4000-8000-000000000001';
const REQUEST_ID = 'req-bouts-1';

const coachActor: AuthenticatedUser = {
  id: 'coach-user-1',
  authSubject: 'coach-sub-1',
  email: 'coach@example.com',
  role: USER.COACH,
};
const adminActor: AuthenticatedUser = {
  id: 'admin-user-1',
  authSubject: 'admin-sub-1',
  email: 'admin@example.com',
  role: USER.ADMIN,
};
const fighterActor: AuthenticatedUser = {
  id: 'fighter-user-1',
  authSubject: 'fighter-sub-1',
  email: 'fighter@example.com',
  role: USER.FIGHTER,
};
const doctorActor: AuthenticatedUser = {
  id: 'doctor-user-1',
  authSubject: 'doctor-sub-1',
  email: 'doctor@example.com',
  role: USER.DOCTOR,
};

function makeRuleset(
  over: Partial<CompetitionRuleset> = {},
): CompetitionRuleset {
  return {
    id: RULESET_ID,
    name: 'Boxing test',
    sport: 'BOXING',
    organizer: null,
    verified: false,
    sourceNote: null,
    weightClasses: [
      { code: '60', label: '60 kg', limitKg: 60 },
      { code: '91+', label: 'Trên 91 kg', limitKg: null },
    ],
    requirementTemplates: [],
    fightWeekDays: 7,
    requirementsDueDays: 7,
    acuteWindowDays: 7,
    acuteLossLimitPctLong: '8.0',
    acuteLossLimitPctShort: '5.0',
    suspensionRules: [],
    defaultBlockedSessionTypes: [],
    restDaysAfterBout: 0,
    createdById: null,
    createdAt: new Date('2026-10-01T00:00:00Z'),
    updatedAt: new Date('2026-10-01T00:00:00Z'),
    deletedAt: null,
    ...over,
  };
}

function makeBout(over: Partial<BoutRow> = {}): BoutRow {
  return {
    id: BOUT_ID,
    fighterId: FIGHTER_ID,
    coachId: COACH_ID,
    rulesetId: RULESET_ID,
    eventName: 'Demo Cup',
    venue: null,
    opponentName: null,
    opponentAnalysis: {},
    scheduledRounds: null,
    weightClassCode: '60',
    weightLimitKg: '60.00',
    acuteLossLimitPct: '8.0',
    requirementsDueDays: 7,
    weighInAt: new Date('2026-10-30T01:00:00Z'),
    boutAt: new Date('2026-10-31T03:00:00Z'),
    status: 'SCHEDULED',
    trainingPlanId: null,
    officialWeightKg: null,
    madeWeight: null,
    catchweightKg: null,
    hydrationCheck: null,
    result: null,
    method: null,
    resultRound: null,
    knockedDown: null,
    cancelReason: null,
    notes: null,
    history: [],
    createdById: 'coach-user-1',
    createdAt: new Date('2026-10-01T03:00:00Z'),
    updatedAt: new Date('2026-10-01T03:00:00Z'),
    deletedAt: null,
    ...over,
  };
}

function makeRequirement(
  over: Partial<BoutRequirementRow> & { code: string },
): BoutRequirementRow {
  return {
    id: `req-${over.code}`,
    boutId: BOUT_ID,
    label: over.code,
    required: true,
    status: 'MISSING',
    issuedOn: null,
    validUntil: null,
    validityDays: null,
    source: 'PRESET',
    statusReason: null,
    updatedById: null,
    confirmedById: null,
    confirmedAt: null,
    createdAt: new Date('2026-10-01T03:00:00Z'),
    updatedAt: new Date('2026-10-01T03:00:00Z'),
    ...over,
  };
}

const createInput: CreateBoutInput = {
  fighterId: FIGHTER_ID,
  rulesetId: RULESET_ID,
  eventName: 'Demo Cup',
  weightClassCode: '60',
  weighInAt: '2026-10-30T08:00:00+07:00',
  boutAt: '2026-10-31T10:00:00+07:00',
};

async function expectHttp(
  promise: Promise<unknown>,
  status: number,
  code?: string,
): Promise<HttpException> {
  const error = await promise.then(
    () => undefined,
    (caught: unknown) => caught,
  );
  expect(error).toBeInstanceOf(HttpException);
  const http = error as HttpException;
  expect(http.getStatus()).toBe(status);
  if (code) expect((http.getResponse() as { code?: string }).code).toBe(code);
  return http;
}

describe('BoutsService', () => {
  let service: BoutsService;
  let repo: Mocked<BoutsRepository>;
  const tx = { execute: vi.fn() } as unknown as Transaction;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);

    repo = {
      transaction: vi.fn(async (work: (t: Transaction) => unknown) => work(tx)),
      findActiveFighterIdByUserId: vi.fn().mockResolvedValue(FIGHTER_ID),
      findActiveCoachIdByUserId: vi.fn().mockResolvedValue(COACH_ID),
      isActiveFighter: vi.fn().mockResolvedValue(true),
      isCoachAssignedToFighter: vi.fn().mockResolvedValue(true),
      isCoachProfileAssignedToFighter: vi.fn().mockResolvedValue(true),
      isDoctorAssignedToFighter: vi.fn().mockResolvedValue(true),
      listRulesets: vi.fn().mockResolvedValue([makeRuleset()]),
      findRulesetById: vi.fn().mockResolvedValue(makeRuleset()),
      findBoutById: vi.fn().mockResolvedValue(makeBout()),
      listBouts: vi.fn().mockResolvedValue([]),
      lockBoutById: vi.fn(async (id: string) => repo.findBoutById(id)),
      listRounds: vi.fn().mockResolvedValue([]),
      findAnalysisSessions: vi.fn().mockResolvedValue([]),
      upsertRound: vi.fn(),
      findActiveBoutIdForFighter: vi.fn().mockResolvedValue(undefined),
      insertFighterMeasurement: vi.fn().mockResolvedValue(undefined),
      insertBout: vi.fn(async (values: Record<string, unknown>) =>
        makeBout({ ...(values as Partial<BoutRow>) }),
      ),
      updateBout: vi.fn(
        async (
          id: string,
          changes: Partial<BoutRow>,
          options?: {
            expectedStatus?: string;
            historyEntry?: BoutHistoryEntry;
          },
        ) => {
          const current = await repo.findBoutById(id);
          return makeBout({
            ...current,
            ...changes,
            ...(options?.historyEntry
              ? { history: [...(current?.history ?? []), options.historyEntry] }
              : {}),
          });
        },
      ),
      findPlanById: vi.fn().mockResolvedValue(undefined),
      listRequirements: vi.fn().mockResolvedValue([]),
      findRequirement: vi.fn().mockResolvedValue(undefined),
      insertRequirements: vi.fn(async (rows: Partial<BoutRequirementRow>[]) =>
        rows.map((row, index) =>
          makeRequirement({ code: `ROW${index}`, ...row }),
        ),
      ),
      updateRequirement: vi.fn(
        async (
          _b: string,
          code: string,
          changes: Partial<BoutRequirementRow>,
        ) => makeRequirement({ code, ...changes }),
      ),
      deleteRequirement: vi.fn().mockResolvedValue(true),
      findWeightMeasurements: vi.fn().mockResolvedValue([]),
    } as unknown as Mocked<BoutsRepository>;

    service = new BoutsService(repo);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('createBout', () => {
    it('rejects weighInAt >= boutAt with 422 (criterion 6)', async () => {
      await expectHttp(
        service.createBout(
          coachActor,
          {
            ...createInput,
            weighInAt: '2026-10-31T10:00:00+07:00',
            boutAt: '2026-10-31T10:00:00+07:00',
          },
          REQUEST_ID,
        ),
        422,
        'BOUT_INVALID_SCHEDULE',
      );
      await expectHttp(
        service.createBout(
          coachActor,
          {
            ...createInput,
            weighInAt: '2026-11-01T08:00:00+07:00',
            boutAt: '2026-10-31T10:00:00+07:00',
          },
          REQUEST_ID,
        ),
        422,
        'BOUT_INVALID_SCHEDULE',
      );
      expect(repo.insertBout).not.toHaveBeenCalled();
    });

    it('rejects a bout that is not in the future with 422', async () => {
      await expectHttp(
        service.createBout(
          coachActor,
          {
            ...createInput,
            weighInAt: '2026-10-19T08:00:00+07:00',
            boutAt: '2026-10-19T10:00:00+07:00',
          },
          REQUEST_ID,
        ),
        422,
        'BOUT_INVALID_SCHEDULE',
      );
    });

    it('rejects a coach creating a bout for an unassigned fighter with 403 (criterion 7)', async () => {
      repo.isCoachAssignedToFighter.mockResolvedValue(false);
      await expectHttp(
        service.createBout(
          coachActor,
          { ...createInput, fighterId: OTHER_FIGHTER_ID },
          REQUEST_ID,
        ),
        403,
      );
      expect(repo.insertBout).not.toHaveBeenCalled();
    });

    it('forbids FIGHTER and DOCTOR from creating bouts even if the route permission was granted', async () => {
      await expectHttp(
        service.createBout(fighterActor, createInput, REQUEST_ID),
        403,
      );
      await expectHttp(
        service.createBout(doctorActor, createInput, REQUEST_ID),
        403,
      );
    });

    it('creates an empty checklist for a ruleset without templates, then the coach adds 3 items with source COACH (criterion 8)', async () => {
      const detail = await service.createBout(
        coachActor,
        createInput,
        REQUEST_ID,
      );
      expect(repo.insertRequirements).toHaveBeenCalledWith([], tx);
      expect(detail.requirements).toEqual([]);
      expect(detail.status).toBe('SCHEDULED');

      for (const code of ['HEALTH_CERT', 'INSURANCE', 'CLUB_LETTER']) {
        repo.insertRequirements.mockClear();
        await service.addRequirement(
          coachActor,
          BOUT_ID,
          { code, label: code, required: true, validityDays: 90 },
          REQUEST_ID,
        );
        const [rows] = repo.insertRequirements.mock.calls[0]!;
        expect(rows).toHaveLength(1);
        expect(rows[0]).toMatchObject({
          code,
          source: 'COACH',
          validityDays: 90,
        });
      }
    });

    it('generates the checklist from the ruleset templates with source PRESET', async () => {
      repo.findRulesetById.mockResolvedValue(
        makeRuleset({
          requirementTemplates: [
            {
              code: 'HEALTH_CERT',
              label: 'Giấy khám sức khỏe',
              required: true,
              validityDays: 180,
            },
            { code: 'INSURANCE', label: 'Bảo hiểm thi đấu', required: false },
          ],
        }),
      );
      await service.createBout(coachActor, createInput, REQUEST_ID);
      const [rows] = repo.insertRequirements.mock.calls[0]!;
      expect(rows).toEqual([
        expect.objectContaining({
          code: 'HEALTH_CERT',
          required: true,
          validityDays: 180,
          source: 'PRESET',
        }),
        expect.objectContaining({
          code: 'INSURANCE',
          required: false,
          validityDays: null,
          source: 'PRESET',
        }),
      ]);
    });

    it('snapshots the weight limit, due days and acute threshold (24h -> 8%, 6h -> 5%)', async () => {
      await service.createBout(coachActor, createInput, REQUEST_ID);
      expect(repo.insertBout).toHaveBeenLastCalledWith(
        expect.objectContaining({
          coachId: COACH_ID,
          weightClassCode: '60',
          weightLimitKg: '60',
          acuteLossLimitPct: '8',
          requirementsDueDays: 7,
          createdById: coachActor.id,
        }),
        tx,
      );

      await service.createBout(
        coachActor,
        {
          ...createInput,
          weighInAt: '2026-10-31T04:00:00+07:00',
          boutAt: '2026-10-31T10:00:00+07:00',
          requirementsDueDays: 10,
        },
        REQUEST_ID,
      );
      expect(repo.insertBout).toHaveBeenLastCalledWith(
        expect.objectContaining({
          acuteLossLimitPct: '5',
          requirementsDueDays: 10,
        }),
        tx,
      );
    });

    it('needs weightLimitKg for a free-form ruleset and for an open class', async () => {
      repo.findRulesetById.mockResolvedValue(
        makeRuleset({ weightClasses: [] }),
      );
      await expectHttp(
        service.createBout(
          coachActor,
          { ...createInput, weightClassCode: undefined },
          REQUEST_ID,
        ),
        422,
        'BOUT_INVALID_WEIGHT_CLASS',
      );
      await service.createBout(
        coachActor,
        { ...createInput, weightClassCode: undefined, weightLimitKg: 72.5 },
        REQUEST_ID,
      );
      expect(repo.insertBout).toHaveBeenLastCalledWith(
        expect.objectContaining({
          weightClassCode: 'CUSTOM',
          weightLimitKg: '72.5',
        }),
        tx,
      );

      repo.findRulesetById.mockResolvedValue(makeRuleset());
      await expectHttp(
        service.createBout(
          coachActor,
          { ...createInput, weightClassCode: '91+' },
          REQUEST_ID,
        ),
        422,
        'BOUT_INVALID_WEIGHT_CLASS',
      );
      await expectHttp(
        service.createBout(
          coachActor,
          { ...createInput, weightClassCode: '77' },
          REQUEST_ID,
        ),
        422,
        'BOUT_INVALID_WEIGHT_CLASS',
      );
    });

    it('requires an admin to name an assigned coach', async () => {
      await expectHttp(
        service.createBout(adminActor, createInput, REQUEST_ID),
        422,
        'BOUT_COACH_REQUIRED',
      );
      repo.isCoachProfileAssignedToFighter.mockResolvedValue(false);
      await expectHttp(
        service.createBout(
          adminActor,
          { ...createInput, coachId: COACH_ID },
          REQUEST_ID,
        ),
        422,
        'BOUT_COACH_NOT_ASSIGNED',
      );
      repo.isCoachProfileAssignedToFighter.mockResolvedValue(true);
      await service.createBout(
        adminActor,
        { ...createInput, coachId: COACH_ID },
        REQUEST_ID,
      );
      expect(repo.insertBout).toHaveBeenLastCalledWith(
        expect.objectContaining({ coachId: COACH_ID }),
        tx,
      );
    });

    it('maps a missing ruleset and a missing fighter to 404', async () => {
      repo.findRulesetById.mockResolvedValue(undefined);
      await expectHttp(
        service.createBout(coachActor, createInput, REQUEST_ID),
        404,
        'RULESET_NOT_FOUND',
      );
      repo.findRulesetById.mockResolvedValue(makeRuleset());
      repo.isActiveFighter.mockResolvedValue(false);
      await expectHttp(
        service.createBout(coachActor, createInput, REQUEST_ID),
        404,
        'BOUT_FIGHTER_NOT_FOUND',
      );
    });

    it('maps the unique active-bout violation to 409 BOUT_ACTIVE_EXISTS', async () => {
      repo.insertBout.mockRejectedValue(
        Object.assign(new Error('duplicate'), {
          code: '23505',
          constraint: 'uq_bouts_active_per_fighter',
        }),
      );
      await expectHttp(
        service.createBout(coachActor, createInput, REQUEST_ID),
        409,
        'BOUT_ACTIVE_EXISTS',
      );
    });
  });

  describe('startCamp', () => {
    const plan = {
      id: PLAN_ID,
      fighterId: FIGHTER_ID,
      phase: 'fight_camp',
      startDate: '2026-10-06',
      deletedAt: null,
    };

    beforeEach(() => {
      repo.findPlanById.mockResolvedValue(plan);
    });

    it('attaches the plan, moves SCHEDULED to CAMP and appends a history entry', async () => {
      const detail = await service.startCamp(
        coachActor,
        BOUT_ID,
        { trainingPlanId: PLAN_ID },
        REQUEST_ID,
      );
      expect(repo.updateBout).toHaveBeenCalledWith(
        BOUT_ID,
        { trainingPlanId: PLAN_ID, status: 'CAMP' },
        {
          expectedStatus: 'SCHEDULED',
          historyEntry: {
            at: NOW.toISOString(),
            by: coachActor.id,
            from: 'SCHEDULED',
            to: 'CAMP',
          },
        },
        tx,
      );
      expect(detail.status).toBe('CAMP');
    });

    it('rejects a second bout moving to CAMP with 409 BOUT_ACTIVE_EXISTS (criterion 9)', async () => {
      repo.findActiveBoutIdForFighter.mockResolvedValue(
        '40000000-0000-4000-8000-000000000099',
      );
      await expectHttp(
        service.startCamp(
          coachActor,
          BOUT_ID,
          { trainingPlanId: PLAN_ID },
          REQUEST_ID,
        ),
        409,
        'BOUT_ACTIVE_EXISTS',
      );
      expect(repo.findActiveBoutIdForFighter).toHaveBeenCalledWith(
        FIGHTER_ID,
        BOUT_ID,
      );
      expect(repo.updateBout).not.toHaveBeenCalled();
    });

    it('rejects a plan of another fighter with 422 (criterion 11)', async () => {
      repo.findPlanById.mockResolvedValue({
        ...plan,
        fighterId: OTHER_FIGHTER_ID,
      });
      await expectHttp(
        service.startCamp(
          coachActor,
          BOUT_ID,
          { trainingPlanId: PLAN_ID },
          REQUEST_ID,
        ),
        422,
        'BOUT_PLAN_INVALID',
      );
      expect(repo.updateBout).not.toHaveBeenCalled();
    });

    it('rejects a plan whose phase is not fight_camp with 422 (criterion 11)', async () => {
      repo.findPlanById.mockResolvedValue({ ...plan, phase: 'build' });
      await expectHttp(
        service.startCamp(
          coachActor,
          BOUT_ID,
          { trainingPlanId: PLAN_ID },
          REQUEST_ID,
        ),
        422,
        'BOUT_PLAN_INVALID',
      );
    });

    it('rejects a deleted or unknown plan with 422', async () => {
      repo.findPlanById.mockResolvedValue({ ...plan, deletedAt: new Date() });
      await expectHttp(
        service.startCamp(
          coachActor,
          BOUT_ID,
          { trainingPlanId: PLAN_ID },
          REQUEST_ID,
        ),
        422,
        'BOUT_PLAN_INVALID',
      );
      repo.findPlanById.mockResolvedValue(undefined);
      await expectHttp(
        service.startCamp(
          coachActor,
          BOUT_ID,
          { trainingPlanId: PLAN_ID },
          REQUEST_ID,
        ),
        422,
        'BOUT_PLAN_INVALID',
      );
    });

    it('rejects starting a camp from any status other than SCHEDULED', async () => {
      repo.findBoutById.mockResolvedValue(makeBout({ status: 'CAMP' }));
      await expectHttp(
        service.startCamp(
          coachActor,
          BOUT_ID,
          { trainingPlanId: PLAN_ID },
          REQUEST_ID,
        ),
        409,
        'BOUT_INVALID_TRANSITION',
      );
    });

    it('reports a concurrent status change as 409 BOUT_STATE_CONFLICT', async () => {
      repo.updateBout.mockResolvedValue(undefined);
      await expectHttp(
        service.startCamp(
          coachActor,
          BOUT_ID,
          { trainingPlanId: PLAN_ID },
          REQUEST_ID,
        ),
        409,
        'BOUT_STATE_CONFLICT',
      );
    });
  });

  describe('enterFightWeek', () => {
    const campBout = () =>
      makeBout({
        status: 'CAMP',
        // weigh-in 2026-10-23: the fight-week window (7 days) opened on 2026-10-16
        weighInAt: new Date('2026-10-23T01:00:00Z'),
        boutAt: new Date('2026-10-24T03:00:00Z'),
      });

    beforeEach(() => {
      repo.findBoutById.mockResolvedValue(campBout());
    });

    it('returns 409 BOUT_REQUIREMENTS_INCOMPLETE and keeps the status when an item is missing (criterion 10)', async () => {
      repo.listRequirements.mockResolvedValue([
        makeRequirement({
          code: 'A',
          status: 'PROVIDED',
          validUntil: '2027-01-01',
        }),
        makeRequirement({ code: 'B', status: 'MISSING' }),
      ]);
      const error = await expectHttp(
        service.enterFightWeek(coachActor, BOUT_ID, REQUEST_ID),
        409,
        'BOUT_REQUIREMENTS_INCOMPLETE',
      );
      const details = (
        error.getResponse() as {
          details: { missing: { code: string }[]; expiring: unknown[] };
        }
      ).details;
      expect(details.missing.map((m) => m.code)).toEqual(['B']);
      expect(details.expiring).toEqual([]);
      expect(repo.updateBout).not.toHaveBeenCalled();
    });

    it('reports items that expire before the bout', async () => {
      repo.listRequirements.mockResolvedValue([
        makeRequirement({
          code: 'A',
          status: 'PROVIDED',
          validUntil: '2026-10-23',
        }),
      ]);
      const error = await expectHttp(
        service.enterFightWeek(coachActor, BOUT_ID, REQUEST_ID),
        409,
        'BOUT_REQUIREMENTS_INCOMPLETE',
      );
      const details = (
        error.getResponse() as { details: { expiring: { code: string }[] } }
      ).details;
      expect(details.expiring.map((m) => m.code)).toEqual(['A']);
    });

    it('moves CAMP to FIGHT_WEEK when Gate 1 passes inside the window', async () => {
      repo.listRequirements.mockResolvedValue([
        makeRequirement({
          code: 'A',
          status: 'PROVIDED',
          validUntil: '2027-01-01',
        }),
      ]);
      const detail = await service.enterFightWeek(
        coachActor,
        BOUT_ID,
        REQUEST_ID,
      );
      expect(repo.updateBout).toHaveBeenCalledWith(
        BOUT_ID,
        { status: 'FIGHT_WEEK' },
        expect.objectContaining({
          expectedStatus: 'CAMP',
          historyEntry: expect.objectContaining({
            from: 'CAMP',
            to: 'FIGHT_WEEK',
          }),
        }),
        tx,
      );
      expect(detail.status).toBe('FIGHT_WEEK');
    });

    it('returns 409 BOUT_FIGHT_WEEK_TOO_EARLY before the window opens', async () => {
      repo.findBoutById.mockResolvedValue(
        makeBout({
          status: 'CAMP',
          weighInAt: new Date('2026-10-30T01:00:00Z'), // window opens 2026-10-23
        }),
      );
      const error = await expectHttp(
        service.enterFightWeek(coachActor, BOUT_ID, REQUEST_ID),
        409,
        'BOUT_FIGHT_WEEK_TOO_EARLY',
      );
      expect(
        (error.getResponse() as { details: { earliestOn: string } }).details
          .earliestOn,
      ).toBe('2026-10-23');
      expect(repo.updateBout).not.toHaveBeenCalled();
    });

    it('rejects the transition from SCHEDULED', async () => {
      repo.findBoutById.mockResolvedValue(makeBout({ status: 'SCHEDULED' }));
      await expectHttp(
        service.enterFightWeek(coachActor, BOUT_ID, REQUEST_ID),
        409,
        'BOUT_INVALID_TRANSITION',
      );
    });
  });

  describe('cancelBout', () => {
    it('cancels from each non-final status and records the reason in the history', async () => {
      for (const status of [
        'SCHEDULED',
        'CAMP',
        'FIGHT_WEEK',
        'WEIGHED_IN',
      ] as const) {
        repo.findBoutById.mockResolvedValue(makeBout({ status }));
        repo.updateBout.mockClear();
        const detail = await service.cancelBout(
          coachActor,
          BOUT_ID,
          { reason: 'Đối thủ rút' },
          REQUEST_ID,
        );
        expect(detail.status).toBe('CANCELLED');
        expect(repo.updateBout).toHaveBeenCalledWith(
          BOUT_ID,
          { cancelReason: 'Đối thủ rút', status: 'CANCELLED' },
          {
            expectedStatus: status,
            historyEntry: {
              at: NOW.toISOString(),
              by: coachActor.id,
              from: status,
              to: 'CANCELLED',
              reason: 'Đối thủ rút',
            },
          },
          tx,
        );
      }
    });

    it('rejects cancelling a COMPLETED or CANCELLED bout with 409 BOUT_INVALID_TRANSITION', async () => {
      for (const status of ['COMPLETED', 'CANCELLED'] as const) {
        repo.findBoutById.mockResolvedValue(makeBout({ status }));
        await expectHttp(
          service.cancelBout(
            coachActor,
            BOUT_ID,
            { reason: 'x y z' },
            REQUEST_ID,
          ),
          409,
          'BOUT_INVALID_TRANSITION',
        );
      }
    });
  });

  describe('updateBout (F8)', () => {
    it('recomputes the acute threshold when the dates change', async () => {
      await service.updateBout(
        coachActor,
        BOUT_ID,
        {
          weighInAt: '2026-10-31T04:00:00+07:00',
          boutAt: '2026-10-31T10:00:00+07:00',
        },
        REQUEST_ID,
      );
      expect(repo.updateBout).toHaveBeenCalledWith(
        BOUT_ID,
        expect.objectContaining({
          acuteLossLimitPct: '5',
          weighInAt: new Date('2026-10-30T21:00:00Z'),
          boutAt: new Date('2026-10-31T03:00:00Z'),
        }),
        { expectedStatus: 'SCHEDULED' },
        tx,
      );
    });

    it('rejects a new weigh-in that is not before the existing bout time with 422', async () => {
      await expectHttp(
        service.updateBout(
          coachActor,
          BOUT_ID,
          { weighInAt: '2026-11-02T08:00:00+07:00' },
          REQUEST_ID,
        ),
        422,
        'BOUT_INVALID_SCHEDULE',
      );
    });

    it('changes the weight class and snapshots the new limit', async () => {
      await service.updateBout(
        coachActor,
        BOUT_ID,
        {
          weightClassCode: '91+',
          weightLimitKg: 95,
          reason: 'Heavyweight match',
        },
        REQUEST_ID,
      );
      expect(repo.updateBout).toHaveBeenCalledWith(
        BOUT_ID,
        { weightClassCode: '91+', weightLimitKg: '95' },
        expect.objectContaining({
          expectedStatus: 'SCHEDULED',
          historyEntry: expect.objectContaining({
            action: 'WEIGHT_CLASS_CHANGE',
            reason: 'Heavyweight match',
          }),
        }),
        tx,
      );
    });

    it('refuses date, class and due-days changes once the bout is WEIGHED_IN, COMPLETED or CANCELLED', async () => {
      for (const status of ['WEIGHED_IN', 'COMPLETED', 'CANCELLED'] as const) {
        repo.findBoutById.mockResolvedValue(makeBout({ status }));
        await expectHttp(
          service.updateBout(
            coachActor,
            BOUT_ID,
            { requirementsDueDays: 3 },
            REQUEST_ID,
          ),
          409,
          'BOUT_INVALID_TRANSITION',
        );
      }
    });

    it('lets a final bout change only its notes', async () => {
      repo.findBoutById.mockResolvedValue(makeBout({ status: 'COMPLETED' }));
      await service.updateBout(
        coachActor,
        BOUT_ID,
        { notes: 'Ghi chú sau trận' },
        REQUEST_ID,
      );
      expect(repo.updateBout).toHaveBeenCalledWith(
        BOUT_ID,
        { notes: 'Ghi chú sau trận' },
        { expectedStatus: 'COMPLETED' },
        tx,
      );
      await expectHttp(
        service.updateBout(
          coachActor,
          BOUT_ID,
          { eventName: 'Khác' },
          REQUEST_ID,
        ),
        409,
        'BOUT_INVALID_TRANSITION',
      );
    });
  });

  describe('requirements', () => {
    it('rejects PROVIDED without validUntil with 422', async () => {
      repo.findRequirement.mockResolvedValue(
        makeRequirement({ code: 'HEALTH_CERT' }),
      );
      await expectHttp(
        service.updateRequirement(
          coachActor,
          BOUT_ID,
          'HEALTH_CERT',
          { status: 'PROVIDED' },
          REQUEST_ID,
        ),
        422,
        'BOUT_REQUIREMENT_INVALID',
      );
      expect(repo.updateRequirement).not.toHaveBeenCalled();
    });

    it('derives validUntil from issuedOn and validityDays for PROVIDED', async () => {
      repo.findRequirement.mockResolvedValue(
        makeRequirement({ code: 'HEALTH_CERT', validityDays: 180 }),
      );
      await service.updateRequirement(
        coachActor,
        BOUT_ID,
        'HEALTH_CERT',
        { status: 'PROVIDED', issuedOn: '2026-10-01' },
        REQUEST_ID,
      );
      expect(repo.updateRequirement).toHaveBeenCalledWith(
        BOUT_ID,
        'HEALTH_CERT',
        expect.objectContaining({
          status: 'PROVIDED',
          issuedOn: '2026-10-01',
          validUntil: '2027-03-30',
          updatedById: coachActor.id,
        }),
        tx,
      );
    });

    it('rejects REJECTED without a statusReason with 422', async () => {
      repo.findRequirement.mockResolvedValue(
        makeRequirement({ code: 'INSURANCE' }),
      );
      await expectHttp(
        service.updateRequirement(
          coachActor,
          BOUT_ID,
          'INSURANCE',
          { status: 'REJECTED' },
          REQUEST_ID,
        ),
        422,
        'BOUT_REQUIREMENT_INVALID',
      );
      await service.updateRequirement(
        coachActor,
        BOUT_ID,
        'INSURANCE',
        { status: 'REJECTED', statusReason: 'Sai tên võ sĩ' },
        REQUEST_ID,
      );
      expect(repo.updateRequirement).toHaveBeenCalledWith(
        BOUT_ID,
        'INSURANCE',
        expect.objectContaining({
          status: 'REJECTED',
          statusReason: 'Sai tên võ sĩ',
        }),
        tx,
      );
    });

    it('rejects validUntil before issuedOn', async () => {
      repo.findRequirement.mockResolvedValue(makeRequirement({ code: 'A' }));
      await expectHttp(
        service.updateRequirement(
          coachActor,
          BOUT_ID,
          'A',
          {
            status: 'PROVIDED',
            issuedOn: '2026-10-10',
            validUntil: '2026-10-01',
          },
          REQUEST_ID,
        ),
        422,
        'BOUT_REQUIREMENT_INVALID',
      );
    });

    it('clears dates and reason when an item goes back to MISSING', async () => {
      repo.findRequirement.mockResolvedValue(
        makeRequirement({
          code: 'A',
          status: 'PROVIDED',
          issuedOn: '2026-10-01',
          validUntil: '2027-01-01',
        }),
      );
      await service.updateRequirement(
        coachActor,
        BOUT_ID,
        'A',
        { status: 'MISSING' },
        REQUEST_ID,
      );
      expect(repo.updateRequirement).toHaveBeenCalledWith(
        BOUT_ID,
        'A',
        expect.objectContaining({
          status: 'MISSING',
          issuedOn: null,
          validUntil: null,
          statusReason: null,
        }),
        tx,
      );
    });

    it('returns the refreshed Gate 1 after a change', async () => {
      repo.findRequirement.mockResolvedValue(makeRequirement({ code: 'A' }));
      repo.listRequirements.mockResolvedValue([
        makeRequirement({
          code: 'A',
          status: 'PROVIDED',
          validUntil: '2027-01-01',
        }),
      ]);
      const result = await service.updateRequirement(
        coachActor,
        BOUT_ID,
        'A',
        { status: 'PROVIDED', validUntil: '2027-01-01' },
        REQUEST_ID,
      );
      expect(result.gate1.passed).toBe(true);
    });

    it('returns 404 for an unknown item and 409 for a duplicate code', async () => {
      await expectHttp(
        service.updateRequirement(
          coachActor,
          BOUT_ID,
          'NOPE',
          { label: 'x' },
          REQUEST_ID,
        ),
        404,
        'BOUT_REQUIREMENT_NOT_FOUND',
      );
      repo.deleteRequirement.mockResolvedValue(false);
      await expectHttp(
        service.removeRequirement(coachActor, BOUT_ID, 'NOPE', REQUEST_ID),
        404,
        'BOUT_REQUIREMENT_NOT_FOUND',
      );
      repo.findRequirement.mockResolvedValue(makeRequirement({ code: 'DUP' }));
      await expectHttp(
        service.addRequirement(
          coachActor,
          BOUT_ID,
          { code: 'DUP', label: 'Dup', required: true },
          REQUEST_ID,
        ),
        409,
        'BOUT_REQUIREMENT_EXISTS',
      );
    });

    it('removes an item inside an audited transaction', async () => {
      const result = await service.removeRequirement(
        coachActor,
        BOUT_ID,
        'A',
        REQUEST_ID,
      );
      expect(repo.deleteRequirement).toHaveBeenCalledWith(BOUT_ID, 'A', tx);
      expect(result.code).toBe('A');
    });

    it('freezes the checklist of a final bout', async () => {
      repo.findBoutById.mockResolvedValue(makeBout({ status: 'CANCELLED' }));
      await expectHttp(
        service.addRequirement(
          coachActor,
          BOUT_ID,
          { code: 'NEW_ITEM', label: 'New', required: true },
          REQUEST_ID,
        ),
        409,
        'BOUT_INVALID_TRANSITION',
      );
    });

    it('does not let a fighter or doctor edit the checklist', async () => {
      await expectHttp(
        service.addRequirement(
          fighterActor,
          BOUT_ID,
          { code: 'NEW_ITEM', label: 'New', required: true },
          REQUEST_ID,
        ),
        403,
      );
      await expectHttp(
        service.removeRequirement(doctorActor, BOUT_ID, 'A', REQUEST_ID),
        403,
      );
    });
  });

  describe('read scope', () => {
    it('forbids a FIGHTER from reading the bout of another fighter with 403 (criterion 12)', async () => {
      repo.findActiveFighterIdByUserId.mockResolvedValue(OTHER_FIGHTER_ID);
      await expectHttp(service.getBout(fighterActor, BOUT_ID), 403);
      await expectHttp(service.getWeightTrack(fighterActor, BOUT_ID), 403);
    });

    it('lets a FIGHTER read their own bout', async () => {
      const detail = await service.getBout(fighterActor, BOUT_ID);
      expect(detail.id).toBe(BOUT_ID);
    });

    it('forbids a COACH or DOCTOR who is not assigned', async () => {
      repo.isCoachAssignedToFighter.mockResolvedValue(false);
      repo.isDoctorAssignedToFighter.mockResolvedValue(false);
      await expectHttp(service.getBout(coachActor, BOUT_ID), 403);
      await expectHttp(service.getBout(doctorActor, BOUT_ID), 403);
    });

    it('lets an assigned DOCTOR and any ADMIN read', async () => {
      await service.getBout(doctorActor, BOUT_ID);
      await service.getBout(adminActor, BOUT_ID);
      expect(repo.isDoctorAssignedToFighter).toHaveBeenCalledWith(
        doctorActor.id,
        FIGHTER_ID,
      );
    });

    it('returns 404 for an unknown bout', async () => {
      repo.findBoutById.mockResolvedValue(undefined);
      await expectHttp(
        service.getBout(adminActor, BOUT_ID),
        404,
        'BOUT_NOT_FOUND',
      );
    });
  });

  describe('getBout computed values', () => {
    it('returns daysToWeighIn, requirementsDueOn, gate1 and canEnterFightWeek', async () => {
      repo.findBoutById.mockResolvedValue(
        makeBout({
          status: 'CAMP',
          weighInAt: new Date('2026-10-23T01:00:00Z'), // in 3 academy days
          boutAt: new Date('2026-10-24T03:00:00Z'),
          requirementsDueDays: 5,
        }),
      );
      repo.listRequirements.mockResolvedValue([
        makeRequirement({
          code: 'A',
          status: 'PROVIDED',
          validUntil: '2027-01-01',
        }),
      ]);
      const detail = await service.getBout(coachActor, BOUT_ID);
      expect(detail.daysToWeighIn).toBe(3);
      expect(detail.requirementsDueOn).toBe('2026-10-18');
      expect(detail.requirementsOverdue).toBe(false);
      expect(detail.gate1).toEqual({ passed: true, missing: [], expiring: [] });
      expect(detail.canEnterFightWeek).toBe(true);
      expect(detail.weight.status).toBe('NOT_WEIGHED');
      expect(detail.requirements).toHaveLength(1);
      expect(detail.ruleset.id).toBe(RULESET_ID);
    });

    it('marks the paperwork overdue after the due date while Gate 1 fails', async () => {
      repo.findBoutById.mockResolvedValue(
        makeBout({
          status: 'CAMP',
          weighInAt: new Date('2026-10-23T01:00:00Z'),
          boutAt: new Date('2026-10-24T03:00:00Z'),
          requirementsDueDays: 5,
        }),
      );
      repo.listRequirements.mockResolvedValue([makeRequirement({ code: 'A' })]);
      const detail = await service.getBout(coachActor, BOUT_ID);
      expect(detail.requirementsOverdue).toBe(true);
      expect(detail.canEnterFightWeek).toBe(false);
    });
  });

  describe('weight track', () => {
    const measurement = (iso: string, kg: number) => ({
      measuredAt: new Date(iso),
      createdAt: new Date(iso),
      weightKg: kg,
    });

    it('charts measurements from the attached plan start date, even if the bout only moved to CAMP today (criterion 12a)', async () => {
      repo.findBoutById.mockResolvedValue(
        makeBout({ status: 'CAMP', trainingPlanId: PLAN_ID }),
      );
      repo.findPlanById.mockResolvedValue({
        id: PLAN_ID,
        fighterId: FIGHTER_ID,
        phase: 'fight_camp',
        startDate: '2026-10-06', // 14 days before 2026-10-20
        deletedAt: null,
      });
      repo.findWeightMeasurements.mockResolvedValue([
        measurement('2026-10-10T01:00:00Z', 68.4), // 10 days ago
        measurement('2026-10-20T00:30:00Z', 66.9),
      ]);

      const track = await service.getWeightTrack(coachActor, BOUT_ID);

      expect(repo.findWeightMeasurements).toHaveBeenCalledWith(
        FIGHTER_ID,
        academyStartOfDay('2026-10-06'),
        NOW,
      );
      expect(track.points).toEqual([
        { date: '2026-10-10', kg: 68.4 },
        { date: '2026-10-20', kg: 66.9 },
      ]);
      expect(track.limitKg).toBe(60);
      expect(track.latestKg).toBe(66.9);
    });

    it('falls back to the creation date of the bout when no plan is attached', async () => {
      repo.findBoutById.mockResolvedValue(makeBout({ trainingPlanId: null }));
      await service.getWeightTrack(coachActor, BOUT_ID);
      expect(repo.findWeightMeasurements).toHaveBeenCalledWith(
        FIGHTER_ID,
        academyStartOfDay('2026-10-01'),
        NOW,
      );
    });

    it('keeps one point per academy day: 66.0 then 65.4 on the same day and 64.8 the next day (criterion 12b)', async () => {
      repo.findWeightMeasurements.mockResolvedValue([
        measurement('2026-10-19T00:00:00Z', 66.0),
        measurement('2026-10-19T02:00:00Z', 65.4),
        measurement('2026-10-20T00:30:00Z', 64.8),
      ]);
      const track = await service.getWeightTrack(coachActor, BOUT_ID);
      expect(track.points).toEqual([
        { date: '2026-10-19', kg: 65.4 },
        { date: '2026-10-20', kg: 64.8 },
      ]);
      expect(track.latestKg).toBe(64.8);
    });

    it('uses the catchweight as the limit when the bout has one', async () => {
      repo.findBoutById.mockResolvedValue(makeBout({ catchweightKg: '62.50' }));
      const track = await service.getWeightTrack(coachActor, BOUT_ID);
      expect(track.limitKg).toBe(62.5);
    });

    it('returns NOT_WEIGHED with null numbers when the fighter has no weight yet', async () => {
      const track = await service.getWeightTrack(coachActor, BOUT_ID);
      expect(track).toMatchObject({
        status: 'NOT_WEIGHED',
        points: [],
        latestKg: null,
        latestOn: null,
        remainingPct: null,
      });
    });
  });

  describe('listBouts and rulesets', () => {
    const rows = (count: number) =>
      Array.from({ length: count }, (_, index) =>
        makeBout({
          id: `40000000-0000-4000-8000-00000000010${index}`,
          weighInAt: new Date(Date.UTC(2026, 9, 25 + index, 1)),
        }),
      );

    it('pages with a cursor built from the last returned row', async () => {
      repo.listBouts.mockResolvedValue(rows(3));
      const page = await service.listBouts(adminActor, { limit: 2 });
      expect(page.data).toHaveLength(2);
      expect(page.hasNextPage).toBe(true);
      expect(page.nextCursor).toEqual(expect.any(String));
      expect(repo.listBouts).toHaveBeenCalledWith(
        expect.objectContaining({ scope: { kind: 'ALL' }, limit: 2 }),
      );

      repo.listBouts.mockResolvedValue(rows(2));
      const last = await service.listBouts(adminActor, { limit: 2 });
      expect(last.hasNextPage).toBe(false);
      expect(last.nextCursor).toBeNull();
    });

    it('scopes a FIGHTER to their own bouts and forbids another fighterId', async () => {
      await service.listBouts(fighterActor, { limit: 20 });
      expect(repo.listBouts).toHaveBeenLastCalledWith(
        expect.objectContaining({
          scope: { kind: 'FIGHTER', fighterId: FIGHTER_ID },
        }),
      );
      await expectHttp(
        service.listBouts(fighterActor, {
          limit: 20,
          fighterId: OTHER_FIGHTER_ID,
        }),
        403,
      );
    });

    it('scopes COACH and DOCTOR by assignment and checks an explicit fighterId', async () => {
      await service.listBouts(coachActor, { limit: 20, status: ['CAMP'] });
      expect(repo.listBouts).toHaveBeenLastCalledWith(
        expect.objectContaining({
          scope: { kind: 'COACH', userId: coachActor.id },
          statuses: ['CAMP'],
        }),
      );
      await service.listBouts(doctorActor, { limit: 20 });
      expect(repo.listBouts).toHaveBeenLastCalledWith(
        expect.objectContaining({
          scope: { kind: 'DOCTOR', userId: doctorActor.id },
        }),
      );
      repo.isCoachAssignedToFighter.mockResolvedValue(false);
      await expectHttp(
        service.listBouts(coachActor, {
          limit: 20,
          fighterId: OTHER_FIGHTER_ID,
        }),
        403,
      );
    });

    it('maps rulesets with numeric thresholds', async () => {
      const [ruleset] = await service.listRulesets();
      expect(ruleset).toMatchObject({
        id: RULESET_ID,
        acuteLossLimitPctLong: 8,
        acuteLossLimitPctShort: 5,
        verified: false,
      });
    });
  });
  describe('recordWeighIn (criteria 4, 5, 6, 8, 9, 18)', () => {
    const weighInAt = new Date('2026-10-30T01:00:00Z');
    const boutAt = new Date('2026-10-31T03:00:00Z');

    beforeEach(() => {
      vi.setSystemTime(new Date('2026-10-30T03:00:00Z'));
      repo.findBoutById.mockResolvedValue(
        makeBout({
          status: 'FIGHT_WEEK',
          weightLimitKg: '60.00',
          weighInAt,
          boutAt,
        }),
      );
    });

    it('criterion 4: official weigh-in 59.8 kg moves to WEIGHED_IN, inserts measurement and returns PASSED with empty options', async () => {
      const res = await service.recordWeighIn(
        coachActor,
        BOUT_ID,
        { weightKg: 59.8 },
        REQUEST_ID,
      );

      expect(repo.insertFighterMeasurement).toHaveBeenCalledWith(
        expect.objectContaining({
          fighterId: FIGHTER_ID,
          measurementContext: 'WEIGH_IN',
          weightKg: '59.80',
          recordedById: coachActor.id,
        }),
        expect.anything(),
      );

      expect(repo.updateBout).toHaveBeenCalledWith(
        BOUT_ID,
        expect.objectContaining({
          status: 'WEIGHED_IN',
          officialWeightKg: '59.80',
          madeWeight: true,
          hydrationCheck: 'NOT_APPLICABLE',
        }),
        expect.objectContaining({
          expectedStatus: 'FIGHT_WEEK',
          historyEntry: expect.objectContaining({
            from: 'FIGHT_WEEK',
            to: 'WEIGHED_IN',
          }),
        }),
        expect.anything(),
      );

      expect(res.status).toBe('WEIGHED_IN');
      expect(res.weighIn).toEqual({
        outcome: 'PASSED',
        reason: null,
        overByKg: null,
        overByPct: null,
        options: [],
      });
    });

    it('criterion 5: official weight 60.0 kg passes, 60.5 kg fails with OVER_LIMIT, overByKg 0.5, overByPct 0.8 and stays FIGHT_WEEK', async () => {
      const passRes = await service.recordWeighIn(
        coachActor,
        BOUT_ID,
        { weightKg: 60.0 },
        REQUEST_ID,
      );
      expect(passRes.weighIn.outcome).toBe('PASSED');
      expect(passRes.status).toBe('WEIGHED_IN');

      const failRes = await service.recordWeighIn(
        coachActor,
        BOUT_ID,
        { weightKg: 60.5 },
        REQUEST_ID,
      );
      expect(failRes.weighIn).toEqual({
        outcome: 'FAILED',
        reason: 'OVER_LIMIT',
        overByKg: 0.5,
        overByPct: 0.8,
        options: ['CATCHWEIGHT', 'CANCEL'],
      });
      expect(failRes.status).toBe('FIGHT_WEEK');
      expect(repo.updateBout).toHaveBeenLastCalledWith(
        BOUT_ID,
        expect.objectContaining({
          officialWeightKg: '60.50',
          madeWeight: false,
        }),
        expect.objectContaining({
          expectedStatus: 'FIGHT_WEEK',
        }),
        expect.anything(),
      );
    });

    it('criterion 6: 59.8 kg with hydrationCheck FAILED keeps FIGHT_WEEK, HYDRATION_FAILED, madeWeight true', async () => {
      const res = await service.recordWeighIn(
        coachActor,
        BOUT_ID,
        { weightKg: 59.8, hydrationCheck: 'FAILED' },
        REQUEST_ID,
      );
      expect(res.weighIn).toEqual({
        outcome: 'FAILED',
        reason: 'HYDRATION_FAILED',
        overByKg: null,
        overByPct: null,
        options: ['CATCHWEIGHT', 'CANCEL'],
      });
      expect(res.status).toBe('FIGHT_WEEK');
      expect(repo.updateBout).toHaveBeenLastCalledWith(
        BOUT_ID,
        expect.objectContaining({
          officialWeightKg: '59.80',
          madeWeight: true,
          hydrationCheck: 'FAILED',
        }),
        expect.objectContaining({
          expectedStatus: 'FIGHT_WEEK',
        }),
        expect.anything(),
      );
    });

    it('criterion 8: re-weighing while still in FIGHT_WEEK records both measurements and succeeds on 2nd attempt; calling when WEIGHED_IN throws 409', async () => {
      await service.recordWeighIn(
        coachActor,
        BOUT_ID,
        { weightKg: 60.5 },
        REQUEST_ID,
      );
      expect(repo.insertFighterMeasurement).toHaveBeenCalledTimes(1);

      const res2 = await service.recordWeighIn(
        coachActor,
        BOUT_ID,
        { weightKg: 59.9 },
        REQUEST_ID,
      );
      expect(repo.insertFighterMeasurement).toHaveBeenCalledTimes(2);
      expect(res2.status).toBe('WEIGHED_IN');
      expect(res2.officialWeightKg).toBe(59.9);

      repo.findBoutById.mockResolvedValue(
        makeBout({ status: 'WEIGHED_IN', weighInAt, boutAt }),
      );
      await expectHttp(
        service.recordWeighIn(
          coachActor,
          BOUT_ID,
          { weightKg: 59.9 },
          REQUEST_ID,
        ),
        409,
        'BOUT_INVALID_TRANSITION',
      );
    });

    it('criterion 9: weigh-in before weigh-in date throws 409 BOUT_WEIGH_IN_TOO_EARLY; bout in CAMP throws 409 BOUT_INVALID_TRANSITION', async () => {
      vi.setSystemTime(new Date('2026-10-25T03:00:00Z'));
      const err = await expectHttp(
        service.recordWeighIn(
          coachActor,
          BOUT_ID,
          { weightKg: 59.5 },
          REQUEST_ID,
        ),
        409,
        'BOUT_WEIGH_IN_TOO_EARLY',
      );
      expect(
        (err.getResponse() as { details: { earliestOn: string } }).details
          .earliestOn,
      ).toBe('2026-10-30');

      vi.setSystemTime(new Date('2026-10-30T03:00:00Z'));
      repo.findBoutById.mockResolvedValue(
        makeBout({ status: 'CAMP', weighInAt, boutAt }),
      );
      await expectHttp(
        service.recordWeighIn(
          coachActor,
          BOUT_ID,
          { weightKg: 59.5 },
          REQUEST_ID,
        ),
        409,
        'BOUT_INVALID_TRANSITION',
      );
    });

    it('criterion 18: concurrent weigh-in requests: one succeeds, one gets BOUT_STATE_CONFLICT', async () => {
      repo.updateBout.mockResolvedValueOnce(makeBout({ status: 'WEIGHED_IN' }));
      repo.updateBout.mockResolvedValueOnce(undefined);

      const p1 = service.recordWeighIn(
        coachActor,
        BOUT_ID,
        { weightKg: 59.5 },
        REQUEST_ID,
      );
      const p2 = service.recordWeighIn(
        coachActor,
        BOUT_ID,
        { weightKg: 59.5 },
        REQUEST_ID,
      );

      const [res1, err2] = await Promise.all([p1, p2.catch((e: unknown) => e)]);

      expect(res1.status).toBe('WEIGHED_IN');
      expect(err2).toBeInstanceOf(HttpException);
      expect((err2 as HttpException).getStatus()).toBe(409);
      expect(
        ((err2 as HttpException).getResponse() as { code: string }).code,
      ).toBe('BOUT_STATE_CONFLICT');
    });

    it('a lost race fails inside the transaction so the WEIGH_IN measurement rolls back', async () => {
      repo.updateBout.mockResolvedValueOnce(undefined);
      const transaction = vi.spyOn(repo, 'transaction');

      await expectHttp(
        service.recordWeighIn(
          coachActor,
          BOUT_ID,
          { weightKg: 59.5 },
          REQUEST_ID,
        ),
        409,
        'BOUT_STATE_CONFLICT',
      );

      expect(repo.insertFighterMeasurement).toHaveBeenCalledTimes(1);
      await expect(transaction.mock.results[0]?.value).rejects.toBeInstanceOf(
        HttpException,
      );
    });
  });

  describe('recordCatchweight (criterion 7)', () => {
    it('accepts a catchweight when only the hydration check failed (official weight below the limit)', async () => {
      repo.findBoutById.mockResolvedValue(
        makeBout({
          status: 'FIGHT_WEEK',
          weightLimitKg: '60.00',
          officialWeightKg: '59.80',
          madeWeight: true,
          hydrationCheck: 'FAILED',
        }),
      );

      const res = await service.recordCatchweight(
        coachActor,
        BOUT_ID,
        {},
        REQUEST_ID,
      );

      expect(repo.updateBout).toHaveBeenCalledWith(
        BOUT_ID,
        expect.objectContaining({
          catchweightKg: '59.80',
          status: 'WEIGHED_IN',
        }),
        expect.anything(),
        expect.anything(),
      );
      expect(res.status).toBe('WEIGHED_IN');
    });

    beforeEach(() => {
      repo.findBoutById.mockResolvedValue(
        makeBout({
          status: 'FIGHT_WEEK',
          weightLimitKg: '60.00',
          officialWeightKg: '60.50',
          madeWeight: false,
          hydrationCheck: 'NOT_APPLICABLE',
        }),
      );
    });

    it('criterion 7: catchweight defaults to official weight (60.5) and moves to WEIGHED_IN; rejects < official weight with 422; rejects when weigh-in did not fail with 409', async () => {
      const res = await service.recordCatchweight(
        coachActor,
        BOUT_ID,
        {},
        REQUEST_ID,
      );
      expect(repo.updateBout).toHaveBeenCalledWith(
        BOUT_ID,
        expect.objectContaining({
          catchweightKg: '60.50',
          madeWeight: true,
          status: 'WEIGHED_IN',
        }),
        expect.objectContaining({
          expectedStatus: 'FIGHT_WEEK',
          historyEntry: expect.objectContaining({
            from: 'FIGHT_WEEK',
            to: 'WEIGHED_IN',
            catchweightKg: 60.5,
            reason: 'Catchweight',
          }),
        }),
        expect.anything(),
      );
      expect(res.status).toBe('WEIGHED_IN');

      await expectHttp(
        service.recordCatchweight(
          coachActor,
          BOUT_ID,
          { catchweightKg: 60.2 },
          REQUEST_ID,
        ),
        422,
        'BOUT_INVALID_CATCHWEIGHT',
      );

      repo.findBoutById.mockResolvedValue(
        makeBout({
          status: 'FIGHT_WEEK',
          weightLimitKg: '60.00',
          officialWeightKg: '59.80',
          madeWeight: true,
          hydrationCheck: 'PASSED',
        }),
      );
      await expectHttp(
        service.recordCatchweight(coachActor, BOUT_ID, {}, REQUEST_ID),
        409,
        'BOUT_WEIGH_IN_NOT_FAILED',
      );
    });
  });

  describe('weight feasibility and reminder (T-029)', () => {
    const near = {
      ...createInput,
      weighInAt: '2026-10-22T08:00:00+07:00',
      boutAt: '2026-10-23T10:00:00+07:00',
    };
    const weightOn = (iso: string, kg: number) => ({
      measuredAt: new Date(iso),
      createdAt: new Date(iso),
      weightKg: kg,
      measurementContext: 'TRAINING',
    });

    it('createBout warns WEIGHT_AT_RISK (60 kg, 2 days, 66 kg yesterday) and still saves', async () => {
      repo.findWeightMeasurements.mockResolvedValue([weightOn('2026-10-19T03:00:00Z', 66)]);
      const created = await service.createBout(coachActor, near, REQUEST_ID);
      expect(repo.insertBout).toHaveBeenCalledTimes(1);
      expect(created.warnings).toEqual([{ code: 'WEIGHT_AT_RISK' }]);
    });

    it('createBout warns WEIGHT_INSUFFICIENT_DATA without a weight in 7 days', async () => {
      repo.findWeightMeasurements.mockResolvedValue([]);
      const created = await service.createBout(coachActor, near, REQUEST_ID);
      expect(created.warnings).toEqual([{ code: 'WEIGHT_INSUFFICIENT_DATA' }]);
    });

    it('createBout has no warning at 64.5 kg, nor while the weigh-in is outside the acute window', async () => {
      repo.findWeightMeasurements.mockResolvedValue([weightOn('2026-10-20T01:00:00Z', 64.5)]);
      expect((await service.createBout(coachActor, near, REQUEST_ID)).warnings).toEqual([]);
      repo.findWeightMeasurements.mockResolvedValue([weightOn('2026-10-20T01:00:00Z', 66)]);
      expect((await service.createBout(coachActor, createInput, REQUEST_ID)).warnings).toEqual([]);
    });

    it('getFeasibility previews without saving, with the same limits as createBout', async () => {
      repo.findWeightMeasurements.mockResolvedValue([weightOn('2026-10-19T03:00:00Z', 66)]);
      const preview = await service.getFeasibility(coachActor, {
        fighterId: FIGHTER_ID,
        rulesetId: RULESET_ID,
        weightClassCode: '60',
        weighInAt: near.weighInAt,
        boutAt: near.boutAt,
      });
      expect(preview).toMatchObject({
        status: 'OVER_LIMIT',
        remainingPct: 9.1,
        limitKg: 60,
        acuteLossLimitPct: 8,
        daysToWeighIn: 2,
        warnings: [{ code: 'WEIGHT_AT_RISK' }],
      });
      expect(repo.insertBout).not.toHaveBeenCalled();
    });

    it('getFeasibility is for the coach of an assigned fighter, like createBout', async () => {
      const query = {
        fighterId: FIGHTER_ID,
        rulesetId: RULESET_ID,
        weightClassCode: '60',
        weighInAt: near.weighInAt,
        boutAt: near.boutAt,
      };
      await expectHttp(service.getFeasibility(fighterActor, query), 403);
      repo.isCoachAssignedToFighter.mockResolvedValue(false);
      await expectHttp(service.getFeasibility(coachActor, query), 403);
      await expectHttp(
        service.getFeasibility(adminActor, { ...query, weighInAt: query.boutAt }),
        422,
        'BOUT_INVALID_SCHEDULE',
      );
    });

    it('the bout detail carries weightReminder only in FIGHT_WEEK', async () => {
      repo.findWeightMeasurements.mockResolvedValue([weightOn('2026-10-19T03:00:00Z', 63)]);
      repo.findBoutById.mockResolvedValue(makeBout({ status: 'FIGHT_WEEK' }));
      expect((await service.getBout(coachActor, BOUT_ID)).weightReminder).toEqual({
        active: true,
        level: 'ASK_TODAY',
        daysSinceLastWeight: 1,
        messageCode: 'WEIGHT_REMINDER_ASK_TODAY',
      });
      repo.findWeightMeasurements.mockResolvedValue([weightOn('2026-10-18T03:00:00Z', 63)]);
      expect((await service.getBout(coachActor, BOUT_ID)).weightReminder.level).toBe(
        'YESTERDAY_MISSING',
      );
      repo.findBoutById.mockResolvedValue(makeBout({ status: 'CAMP' }));
      expect((await service.getBout(coachActor, BOUT_ID)).weightReminder.active).toBe(false);
    });
  });

  describe('getWeightTrack with official weigh-in (criterion 10)', () => {
    it('criterion 10: official weigh-in appears in points and, from WEIGHED_IN on, the track is NEUTRAL (T-029)', async () => {
      const today = '2026-10-30';
      vi.setSystemTime(new Date('2026-10-30T03:00:00Z'));
      repo.findBoutById.mockResolvedValue(
        makeBout({
          status: 'WEIGHED_IN',
          weightLimitKg: '60.00',
          officialWeightKg: '59.80',
          madeWeight: true,
          weighInAt: new Date('2026-10-30T01:00:00Z'),
          boutAt: new Date('2026-10-31T03:00:00Z'),
          createdAt: new Date('2026-10-10T03:00:00Z'),
        }),
      );

      repo.findWeightMeasurements.mockResolvedValue([
        {
          measuredAt: new Date('2026-10-10T03:00:00Z'),
          createdAt: new Date('2026-10-10T03:00:00Z'),
          weightKg: 65.0,
          measurementContext: 'TRAINING',
        },
        {
          measuredAt: new Date('2026-10-30T02:00:00Z'),
          createdAt: new Date('2026-10-30T02:00:00Z'),
          weightKg: 59.8,
          measurementContext: 'WEIGH_IN',
        },
      ]);

      const track = await service.getWeightTrack(coachActor, BOUT_ID);
      expect(track.points).toContainEqual({ date: today, kg: 59.8 });
      expect(track.latestKg).toBe(59.8);
      expect(track.status).toBe('NEUTRAL');
    });
  });

  describe('recordResult and cancellation (criteria 11, 12, 13, 14)', () => {
    const boutAt = new Date('2026-10-31T03:00:00Z');

    beforeEach(() => {
      repo.findBoutById.mockResolvedValue(
        makeBout({
          status: 'WEIGHED_IN',
          boutAt,
          weighInAt: new Date('2026-10-30T01:00:00Z'),
        }),
      );
    });

    it('criterion 11: result before bout date throws 409 BOUT_NOT_STARTED; on/after bout date WIN + DECISION without round completes bout', async () => {
      vi.setSystemTime(new Date('2026-10-30T10:00:00Z'));
      const err = await expectHttp(
        service.recordResult(
          coachActor,
          BOUT_ID,
          { result: 'WIN', method: 'DECISION' },
          REQUEST_ID,
        ),
        409,
        'BOUT_NOT_STARTED',
      );
      expect(
        (err.getResponse() as { details: { earliestOn: string } }).details
          .earliestOn,
      ).toBe('2026-10-31');

      vi.setSystemTime(new Date('2026-10-31T05:00:00Z'));
      const res = await service.recordResult(
        coachActor,
        BOUT_ID,
        { result: 'WIN', method: 'DECISION' },
        REQUEST_ID,
      );

      expect(repo.updateBout).toHaveBeenCalledWith(
        BOUT_ID,
        expect.objectContaining({
          status: 'COMPLETED',
          result: 'WIN',
          method: 'DECISION',
          resultRound: null,
          knockedDown: false,
        }),
        expect.objectContaining({
          expectedStatus: 'WEIGHED_IN',
          historyEntry: expect.objectContaining({
            from: 'WEIGHED_IN',
            to: 'COMPLETED',
          }),
        }),
        expect.anything(),
      );
      expect(res.status).toBe('COMPLETED');
    });

    it('criterion 12: verifies all 5 conditional validation error cases for result recording', async () => {
      vi.setSystemTime(new Date('2026-10-31T05:00:00Z'));

      const err1 = await expectHttp(
        service.recordResult(
          coachActor,
          BOUT_ID,
          { result: 'LOSS', method: 'KO', resultRound: 1 },
          REQUEST_ID,
        ),
        422,
        'BOUT_RESULT_INVALID',
      );
      expect(
        (err1.getResponse() as { details: { reason: string } }).details.reason,
      ).toBe('CONSCIOUSNESS_REQUIRED');

      const err2 = await expectHttp(
        service.recordResult(
          coachActor,
          BOUT_ID,
          {
            result: 'WIN',
            method: 'KO',
            resultRound: 1,
            lossOfConsciousness: 'NONE',
          },
          REQUEST_ID,
        ),
        422,
        'BOUT_RESULT_INVALID',
      );
      expect(
        (err2.getResponse() as { details: { reason: string } }).details.reason,
      ).toBe('CONSCIOUSNESS_NOT_ALLOWED');

      const err3 = await expectHttp(
        service.recordResult(
          coachActor,
          BOUT_ID,
          {
            result: 'LOSS',
            method: 'TKO',
            resultRound: 2,
            lossOfConsciousness: 'NONE',
          },
          REQUEST_ID,
        ),
        422,
        'BOUT_RESULT_INVALID',
      );
      expect(
        (err3.getResponse() as { details: { reason: string } }).details.reason,
      ).toBe('HEAD_STRIKE_REQUIRED');

      const err4 = await expectHttp(
        service.recordResult(
          coachActor,
          BOUT_ID,
          { result: 'WIN', method: 'DECISION', resultRound: 3 },
          REQUEST_ID,
        ),
        422,
        'BOUT_RESULT_INVALID',
      );
      expect(
        (err4.getResponse() as { details: { reason: string } }).details.reason,
      ).toBe('ROUND_NOT_ALLOWED');

      const err5 = await expectHttp(
        service.recordResult(
          coachActor,
          BOUT_ID,
          { result: 'WIN', method: 'KO' },
          REQUEST_ID,
        ),
        422,
        'BOUT_RESULT_INVALID',
      );
      expect(
        (err5.getResponse() as { details: { reason: string } }).details.reason,
      ).toBe('ROUND_REQUIRED');
    });

    it('criterion 13: valid TKO loss records history with all 3 fields, completes bout, and creates no injury or suspension records', async () => {
      vi.setSystemTime(new Date('2026-10-31T05:00:00Z'));

      const res = await service.recordResult(
        coachActor,
        BOUT_ID,
        {
          result: 'LOSS',
          method: 'TKO',
          resultRound: 2,
          lossOfConsciousness: 'NONE',
          stoppedByHeadStrike: true,
          injuryNote: 'Minor eyebrow cut',
        },
        REQUEST_ID,
      );

      expect(repo.updateBout).toHaveBeenCalledWith(
        BOUT_ID,
        expect.objectContaining({
          status: 'COMPLETED',
          result: 'LOSS',
          method: 'TKO',
          resultRound: 2,
        }),
        expect.objectContaining({
          expectedStatus: 'WEIGHED_IN',
          historyEntry: expect.objectContaining({
            from: 'WEIGHED_IN',
            to: 'COMPLETED',
            lossOfConsciousness: 'NONE',
            stoppedByHeadStrike: true,
            injuryNote: 'Minor eyebrow cut',
          }),
        }),
        expect.anything(),
      );
      expect(res.status).toBe('COMPLETED');
      expect(
        (repo as Record<string, unknown>).insertInjuryRecord,
      ).toBeUndefined();
    });

    it('criterion 14: WEIGHED_IN -> CANCELLED with reason "Không đạt cân" does not create anything else', async () => {
      const res = await service.cancelBout(
        coachActor,
        BOUT_ID,
        { reason: 'Không đạt cân' },
        REQUEST_ID,
      );
      expect(repo.updateBout).toHaveBeenCalledWith(
        BOUT_ID,
        expect.objectContaining({
          status: 'CANCELLED',
          cancelReason: 'Không đạt cân',
        }),
        expect.objectContaining({
          expectedStatus: 'WEIGHED_IN',
          historyEntry: expect.objectContaining({
            from: 'WEIGHED_IN',
            to: 'CANCELLED',
            reason: 'Không đạt cân',
          }),
        }),
        expect.anything(),
      );
      expect(res.status).toBe('CANCELLED');
    });
  });

  describe('requirements locking (criterion 15)', () => {
    beforeEach(() => {
      repo.findRequirement.mockResolvedValue(
        makeRequirement({ code: 'BLOOD', status: 'MISSING' }),
      );
    });

    it('criterion 15: locks requirements in FIGHT_WEEK requiring unlockReason for PATCH, POST and DELETE, but not in CAMP', async () => {
      repo.findBoutById.mockResolvedValue(makeBout({ status: 'FIGHT_WEEK' }));

      await expectHttp(
        service.updateRequirement(
          coachActor,
          BOUT_ID,
          'BLOOD',
          { status: 'PROVIDED', validUntil: '2026-12-01' },
          REQUEST_ID,
        ),
        409,
        'BOUT_REQUIREMENTS_LOCKED',
      );

      await service.updateRequirement(
        coachActor,
        BOUT_ID,
        'BLOOD',
        {
          status: 'PROVIDED',
          validUntil: '2026-12-01',
          unlockReason: 'Doctor approved delay',
        },
        REQUEST_ID,
      );
      expect(repo.updateBout).toHaveBeenCalledWith(
        BOUT_ID,
        {},
        expect.objectContaining({
          expectedStatus: 'FIGHT_WEEK',
          historyEntry: expect.objectContaining({
            action: 'REQUIREMENT_UNLOCK',
            requirementCode: 'BLOOD',
            reason: 'Doctor approved delay',
            from: 'FIGHT_WEEK',
            to: 'FIGHT_WEEK',
          }),
        }),
        expect.anything(),
      );

      repo.findRequirement.mockResolvedValue(undefined);
      await expectHttp(
        service.addRequirement(
          coachActor,
          BOUT_ID,
          { code: 'EXTRA', label: 'Extra', required: true },
          REQUEST_ID,
        ),
        409,
        'BOUT_REQUIREMENTS_LOCKED',
      );

      await service.addRequirement(
        coachActor,
        BOUT_ID,
        {
          code: 'EXTRA',
          label: 'Extra',
          required: true,
          unlockReason: 'Special permit',
        },
        REQUEST_ID,
      );
      expect(repo.updateBout).toHaveBeenLastCalledWith(
        BOUT_ID,
        {},
        expect.objectContaining({
          historyEntry: expect.objectContaining({
            action: 'REQUIREMENT_UNLOCK',
            requirementCode: 'EXTRA',
            reason: 'Special permit',
          }),
        }),
        expect.anything(),
      );

      await expectHttp(
        service.removeRequirement(coachActor, BOUT_ID, 'BLOOD', REQUEST_ID),
        409,
        'BOUT_REQUIREMENTS_LOCKED',
      );

      await service.removeRequirement(
        coachActor,
        BOUT_ID,
        'BLOOD',
        REQUEST_ID,
        'Organizer waived check',
      );
      expect(repo.updateBout).toHaveBeenLastCalledWith(
        BOUT_ID,
        {},
        expect.objectContaining({
          historyEntry: expect.objectContaining({
            action: 'REQUIREMENT_UNLOCK',
            requirementCode: 'BLOOD',
            reason: 'Organizer waived check',
          }),
        }),
        expect.anything(),
      );

      repo.findBoutById.mockResolvedValue(makeBout({ status: 'CAMP' }));
      repo.findRequirement.mockResolvedValue(
        makeRequirement({ code: 'BLOOD', status: 'MISSING' }),
      );
      repo.updateBout.mockClear();

      await service.updateRequirement(
        coachActor,
        BOUT_ID,
        'BLOOD',
        { status: 'PROVIDED', validUntil: '2026-12-01' },
        REQUEST_ID,
      );
      expect(repo.updateBout).not.toHaveBeenCalled();
    });
  });

  describe('updateBout weight class change reason (criterion 16)', () => {
    beforeEach(() => {
      repo.findBoutById.mockResolvedValue(
        makeBout({
          status: 'SCHEDULED',
          weightClassCode: '60',
          weightLimitKg: '60.00',
        }),
      );
    });

    it('criterion 16: PATCH changing weight class requires reason; records WEIGHT_CLASS_CHANGE history; re-sending same class requires no reason', async () => {
      await expectHttp(
        service.updateBout(
          coachActor,
          BOUT_ID,
          { weightClassCode: '91+', weightLimitKg: 95 },
          REQUEST_ID,
        ),
        422,
        'BOUT_CHANGE_REASON_REQUIRED',
      );

      await service.updateBout(
        coachActor,
        BOUT_ID,
        {
          weightClassCode: '91+',
          weightLimitKg: 95,
          reason: 'Moved up to heavyweight',
        },
        REQUEST_ID,
      );

      expect(repo.updateBout).toHaveBeenCalledWith(
        BOUT_ID,
        expect.objectContaining({
          weightClassCode: '91+',
          weightLimitKg: '95',
        }),
        expect.objectContaining({
          expectedStatus: 'SCHEDULED',
          historyEntry: expect.objectContaining({
            action: 'WEIGHT_CLASS_CHANGE',
            fromClass: '60',
            toClass: '91+',
            fromLimitKg: 60,
            toLimitKg: 95,
            reason: 'Moved up to heavyweight',
            from: 'SCHEDULED',
            to: 'SCHEDULED',
          }),
        }),
        expect.anything(),
      );

      repo.updateBout.mockClear();
      await service.updateBout(
        coachActor,
        BOUT_ID,
        { weightClassCode: '60' },
        REQUEST_ID,
      );
      expect(repo.updateBout).toHaveBeenCalledWith(
        BOUT_ID,
        expect.objectContaining({
          weightClassCode: '60',
          weightLimitKg: '60',
        }),
        expect.objectContaining({
          historyEntry: undefined,
        }),
        expect.anything(),
      );
    });
  });

  describe('RBAC for weighIn, catchweight, result (criterion 17)', () => {
    beforeEach(() => {
      vi.setSystemTime(new Date('2026-10-31T05:00:00Z'));
      repo.findBoutById.mockResolvedValue(
        makeBout({
          status: 'FIGHT_WEEK',
          weightLimitKg: '60.00',
          officialWeightKg: '60.50',
          madeWeight: false,
          weighInAt: new Date('2026-10-30T01:00:00Z'),
          boutAt: new Date('2026-10-31T03:00:00Z'),
        }),
      );
    });

    it('criterion 17: FIGHTER and unassigned COACH get 403, ADMIN succeeds on weighIn, catchweight, result', async () => {
      await expectHttp(
        service.recordWeighIn(
          fighterActor,
          BOUT_ID,
          { weightKg: 60.0 },
          REQUEST_ID,
        ),
        403,
      );
      await expectHttp(
        service.recordCatchweight(fighterActor, BOUT_ID, {}, REQUEST_ID),
        403,
      );
      await expectHttp(
        service.recordResult(
          fighterActor,
          BOUT_ID,
          { result: 'WIN', method: 'DECISION' },
          REQUEST_ID,
        ),
        403,
      );

      repo.isCoachAssignedToFighter.mockResolvedValue(false);
      await expectHttp(
        service.recordWeighIn(
          coachActor,
          BOUT_ID,
          { weightKg: 60.0 },
          REQUEST_ID,
        ),
        403,
      );
      await expectHttp(
        service.recordCatchweight(coachActor, BOUT_ID, {}, REQUEST_ID),
        403,
      );
      await expectHttp(
        service.recordResult(
          coachActor,
          BOUT_ID,
          { result: 'WIN', method: 'DECISION' },
          REQUEST_ID,
        ),
        403,
      );

      const weighInRes = await service.recordWeighIn(
        adminActor,
        BOUT_ID,
        { weightKg: 60.0 },
        REQUEST_ID,
      );
      expect(weighInRes.weighIn.outcome).toBe('PASSED');

      const catchRes = await service.recordCatchweight(
        adminActor,
        BOUT_ID,
        {},
        REQUEST_ID,
      );
      expect(catchRes.status).toBe('WEIGHED_IN');

      repo.findBoutById.mockResolvedValue(
        makeBout({
          status: 'WEIGHED_IN',
          boutAt: new Date('2026-10-31T03:00:00Z'),
        }),
      );
      const resultRes = await service.recordResult(
        adminActor,
        BOUT_ID,
        { result: 'WIN', method: 'DECISION' },
        REQUEST_ID,
      );
      expect(resultRes.status).toBe('COMPLETED');
    });
  });

  describe('T-010 opponent analysis and rounds', () => {
    const input: OpponentAnalysisInput = {
      profile: { stance: 'SOUTHPAW' },
      observations: [
        {
          id: 'o1',
          kind: 'OPENING',
          text: 'opening',
          evidenceNote: 'video',
          confidence: 'ONCE',
        },
      ],
      tactics: [
        {
          id: 't1',
          text: 'counter',
          round: null,
          observationIds: ['o1'],
          sessionIds: [],
        },
      ],
    };
    const setup = (over: Partial<BoutRow> = {}) => {
      const bout = makeBout({
        status: 'WEIGHED_IN',
        scheduledRounds: 3,
        opponentAnalysis: input,
        ...over,
      });
      repo.findBoutById.mockResolvedValue(bout);
      repo.lockBoutById.mockResolvedValue(bout);
      return bout;
    };
    const round = (roundNo: number, over: RoundInput = {}) => ({
      id: '60000000-0000-4000-8000-000000000001',
      boutId: BOUT_ID,
      roundNo,
      tacticMarks: {},
      observationMarks: {},
      selfScore: null,
      knockdownsAgainst: 0,
      stunned: false,
      bleeding: false,
      fatigued: false,
      note: null,
      recordedById: coachActor.id,
      createdAt: NOW,
      updatedAt: NOW,
      ...over,
    });

    it.each([{ ids: [] }, { ids: ['missing'] }])(
      'rejects missing or unknown tactic evidence without writes (AC8): %j',
      async ({ ids }) => {
        setup();
        await expectHttp(
          service.putOpponentAnalysis(
            coachActor,
            BOUT_ID,
            {
              ...input,
              tactics: [{ ...input.tactics[0]!, observationIds: ids }],
            },
            REQUEST_ID,
          ),
          422,
          'OPPONENT_TACTIC_EVIDENCE_REQUIRED',
        );
        expect(repo.updateBout).not.toHaveBeenCalled();
      },
    );

    it('revalidates malformed bodies in the service (AC8)', async () => {
      setup();
      for (const bad of [
        {
          ...input,
          observations: Array.from({ length: 7 }, (_, n) => ({
            ...input.observations[0],
            id: 'o' + n,
          })),
        },
        {
          ...input,
          observations: [{ ...input.observations[0], evidenceNote: null }],
        },
        {
          ...input,
          observations: [
            { ...input.observations[0], evidenceUrl: 'javascript:bad' },
          ],
        },
        {
          ...input,
          tactics: [{ ...input.tactics[0], review: { outcome: 'EFFECTIVE' } }],
        },
      ])
        await expectHttp(
          service.putOpponentAnalysis(
            coachActor,
            BOUT_ID,
            bad as OpponentAnalysisInput,
            REQUEST_ID,
          ),
          422,
        );
      expect(repo.updateBout).not.toHaveBeenCalled();
    });

    it.each(['another fighter', 'deleted'])(
      'rejects a session unavailable for this fighter: %s (AC9)',
      async () => {
        setup();
        const sessionId = '70000000-0000-4000-8000-000000000001';
        await expectHttp(
          service.putOpponentAnalysis(
            coachActor,
            BOUT_ID,
            {
              ...input,
              tactics: [{ ...input.tactics[0]!, sessionIds: [sessionId] }],
            },
            REQUEST_ID,
          ),
          422,
          'OPPONENT_SESSION_INVALID',
        );
        expect(repo.findAnalysisSessions).toHaveBeenCalledWith(
          [sessionId],
          FIGHTER_ID,
          tx,
        );
        expect(repo.updateBout).not.toHaveBeenCalled();
      },
    );

    it('keeps server reviews by tactic ID, fills metadata and exposes tacticsWithoutSessions (AC9)', async () => {
      setup({
        opponentAnalysis: {
          ...input,
          tactics: [
            {
              ...input.tactics[0]!,
              review: { outcome: 'EFFECTIVE', note: 'keep' },
            },
          ],
        },
      });
      const result = await service.putOpponentAnalysis(
        coachActor,
        BOUT_ID,
        input,
        REQUEST_ID,
      );
      expect(result.tacticsWithoutSessions).toEqual(['t1']);
      expect(result.opponentAnalysis).toMatchObject({
        updatedAt: NOW.toISOString(),
        updatedById: coachActor.id,
      });
      expect(result.opponentAnalysis.tactics?.[0]?.review).toEqual({
        outcome: 'EFFECTIVE',
        note: 'keep',
      });
      expect(tx.execute).toHaveBeenCalled();
    });

    it('validates session ownership using the repository and accepts an active session (AC9)', async () => {
      setup();
      const id = '70000000-0000-4000-8000-000000000001';
      repo.findAnalysisSessions.mockResolvedValue([
        { id, title: 'Practice', scheduledAt: NOW },
      ]);
      const result = await service.putOpponentAnalysis(
        coachActor,
        BOUT_ID,
        {
          ...input,
          tactics: [{ ...input.tactics[0]!, sessionIds: [id] }],
        },
        REQUEST_ID,
      );
      expect(result.tacticsWithoutSessions).toEqual([]);
    });

    it.each(['COMPLETED', 'CANCELLED'] as const)(
      'blocks document replacement at %s (AC10)',
      async (status) => {
        setup({ status });
        await expectHttp(
          service.putOpponentAnalysis(coachActor, BOUT_ID, input, REQUEST_ID),
          409,
          'BOUT_INVALID_TRANSITION',
        );
        expect(repo.updateBout).not.toHaveBeenCalled();
      },
    );

    it('only reviews completed bouts, preserves other reviews and rejects unknown IDs (AC10)', async () => {
      setup();
      await expectHttp(
        service.putOpponentReview(
          coachActor,
          BOUT_ID,
          { reviews: [{ tacticId: 't1', outcome: 'INEFFECTIVE' }] },
          REQUEST_ID,
        ),
        409,
        'BOUT_INVALID_TRANSITION',
      );
      setup({
        status: 'COMPLETED',
        opponentAnalysis: {
          ...input,
          tactics: [
            input.tactics[0]!,
            {
              ...input.tactics[0]!,
              id: 't2',
              review: { outcome: 'EFFECTIVE' },
            },
          ],
        },
      });
      const result = await service.putOpponentReview(
        coachActor,
        BOUT_ID,
        {
          reviews: [{ tacticId: 't1', outcome: 'INEFFECTIVE', note: 'manual' }],
        },
        REQUEST_ID,
      );
      expect(result.opponentAnalysis.tactics?.[0]?.review).toEqual({
        outcome: 'INEFFECTIVE',
        note: 'manual',
        auto: false,
      });
      expect(result.opponentAnalysis.tactics?.[1]?.review).toEqual({
        outcome: 'EFFECTIVE',
      });
      repo.updateBout.mockClear();
      await expectHttp(
        service.putOpponentReview(
          coachActor,
          BOUT_ID,
          { reviews: [{ tacticId: 'unknown', outcome: 'NOT_USED' }] },
          REQUEST_ID,
        ),
        422,
        'OPPONENT_TACTIC_UNKNOWN',
      );
      expect(repo.updateBout).not.toHaveBeenCalled();
    });

    it('redacts fighter detail and includes linked session summaries (AC11)', async () => {
      const id = '70000000-0000-4000-8000-000000000001';
      setup({
        opponentAnalysis: {
          ...input,
          tactics: [
            {
              ...input.tactics[0]!,
              sessionIds: [id],
              review: { outcome: 'INEFFECTIVE' },
            },
          ],
        },
      });
      repo.findAnalysisSessions.mockResolvedValue([
        { id, title: 'Practice', scheduledAt: NOW },
      ]);
      const detail = await service.getBout(fighterActor, BOUT_ID);
      expect(Object.keys(detail.opponentAnalysis)).toEqual(['tactics']);
      expect(detail.opponentAnalysis.tactics?.[0]).toEqual({
        id: 't1',
        text: 'counter',
        round: null,
        partnerBrief: null,
        sessionIds: [id],
      });
      expect(detail.sessions).toEqual([
        { id, title: 'Practice', scheduledAt: NOW.toISOString() },
      ]);
      expect(detail.tacticsWithoutSessions).toEqual([]);
      await expectHttp(service.getRounds(fighterActor, BOUT_ID), 403);
      await expectHttp(service.getCornerCard(fighterActor, BOUT_ID), 403);
    });

    it('rejects unassigned coaches for reads and writes (AC11)', async () => {
      setup();
      repo.isCoachAssignedToFighter.mockResolvedValue(false);
      await expectHttp(service.getBout(coachActor, BOUT_ID), 403);
      await expectHttp(service.getRounds(coachActor, BOUT_ID), 403);
      await expectHttp(service.getCornerCard(coachActor, BOUT_ID), 403);
      await expectHttp(
        service.putRound(coachActor, BOUT_ID, 1, {}, REQUEST_ID),
        403,
      );
      await expectHttp(
        service.putOpponentAnalysis(coachActor, BOUT_ID, input, REQUEST_ID),
        403,
      );
      await expectHttp(
        service.putOpponentReview(
          coachActor,
          BOUT_ID,
          { reviews: [] },
          REQUEST_ID,
        ),
        403,
      );
      expect(repo.updateBout).not.toHaveBeenCalled();
      expect(repo.upsertRound).not.toHaveBeenCalled();
    });

    it('allows assigned doctors and admins private reads; requires eligible status for cards', async () => {
      setup();
      await expect(
        service.getCornerCard(doctorActor, BOUT_ID),
      ).resolves.toMatchObject({ acuteLossFlag: false });
      await expect(
        service.getRounds(adminActor, BOUT_ID),
      ).resolves.toMatchObject({ scheduledRounds: 3 });
      setup({ status: 'CAMP' });
      await expectHttp(
        service.getCornerCard(coachActor, BOUT_ID),
        409,
        'BOUT_INVALID_TRANSITION',
      );
    });

    it('checks schedule, range, state and map IDs before upsert (AC12)', async () => {
      setup();
      await expectHttp(
        service.putRound(coachActor, BOUT_ID, 4, {}, REQUEST_ID),
        422,
        'BOUT_ROUND_OUT_OF_RANGE',
      );
      setup({ scheduledRounds: null });
      await expectHttp(
        service.putRound(coachActor, BOUT_ID, 1, {}, REQUEST_ID),
        422,
        'BOUT_ROUNDS_NOT_SET',
      );
      setup({ status: 'FIGHT_WEEK' });
      await expectHttp(
        service.putRound(coachActor, BOUT_ID, 1, {}, REQUEST_ID),
        409,
        'BOUT_INVALID_TRANSITION',
      );
      setup();
      await expectHttp(
        service.putRound(
          coachActor,
          BOUT_ID,
          1,
          { tacticMarks: { bad: 'EFFECTIVE' } },
          REQUEST_ID,
        ),
        422,
        'BOUT_ROUND_MARK_UNKNOWN',
      );
      await expectHttp(
        service.putRound(
          coachActor,
          BOUT_ID,
          1,
          { observationMarks: { bad: 'SEEN' } },
          REQUEST_ID,
        ),
        422,
        'BOUT_ROUND_MARK_UNKNOWN',
      );
      expect(repo.upsertRound).not.toHaveBeenCalled();
    });

    it('upserts one record, preserves absent fields and permits post-bout edits (AC12)', async () => {
      setup({ status: 'COMPLETED' });
      let stored = round(1);
      repo.upsertRound.mockImplementation(async (value) => {
        stored = { ...stored, ...value } as typeof stored;
        return stored;
      });
      await service.putRound(
        coachActor,
        BOUT_ID,
        1,
        { tacticMarks: { t1: 'EFFECTIVE' }, stunned: true, note: 'first' },
        REQUEST_ID,
      );
      const result = await service.putRound(
        coachActor,
        BOUT_ID,
        1,
        { note: null, stunned: false },
        REQUEST_ID,
      );
      expect(result).toMatchObject({
        tacticMarks: { t1: 'EFFECTIVE' },
        stunned: false,
        note: null,
      });
      expect(repo.upsertRound.mock.calls[1]?.[0]).not.toHaveProperty(
        'tacticMarks',
      );
      expect(repo.lockBoutById).toHaveBeenCalledWith(BOUT_ID, tx);
    });

    it('returns ordered rounds, computed advice, and null at completion or before any round (AC13)', async () => {
      const bout = setup();
      expect((await service.getRounds(coachActor, BOUT_ID)).advice).toBeNull();
      const rounds = [
        round(1, { selfScore: 'LOSS' }),
        round(2, { selfScore: 'WIN' }),
      ];
      repo.listRounds.mockResolvedValue(rounds);
      expect((await service.getRounds(coachActor, BOUT_ID)).advice).toEqual(
        buildRoundAdvice(bout.opponentAnalysis, rounds, 3),
      );
      repo.listRounds.mockResolvedValue([...rounds, round(3)]);
      expect((await service.getRounds(coachActor, BOUT_ID)).advice).toBeNull();
    });

    it('blocks reducing the schedule below the highest recorded round, inside the lock (AC14)', async () => {
      setup({ scheduledRounds: 5 });
      repo.listRounds.mockResolvedValue([round(1), round(2), round(3)]);
      await expectHttp(
        service.updateBout(
          coachActor,
          BOUT_ID,
          { scheduledRounds: 2 },
          REQUEST_ID,
        ),
        422,
        'BOUT_ROUNDS_BELOW_RECORDED',
      );
      expect(repo.updateBout).not.toHaveBeenCalled();
      expect(repo.lockBoutById).toHaveBeenCalledWith(BOUT_ID, tx);
      await service.updateBout(
        coachActor,
        BOUT_ID,
        { scheduledRounds: 4 },
        REQUEST_ID,
      );
      expect(repo.updateBout).toHaveBeenCalledWith(
        BOUT_ID,
        { scheduledRounds: 4 },
        { expectedStatus: 'WEIGHED_IN' },
        tx,
      );
    });

    it.each(['COMPLETED', 'CANCELLED'] as const)(
      'blocks scheduledRounds edits at %s',
      async (status) => {
        setup({ status });
        await expectHttp(
          service.updateBout(
            coachActor,
            BOUT_ID,
            { scheduledRounds: 3 },
            REQUEST_ID,
          ),
          409,
          'BOUT_INVALID_TRANSITION',
        );
      },
    );

    it('creates and summarizes scheduledRounds', async () => {
      const detail = await service.createBout(
        coachActor,
        { ...createInput, scheduledRounds: 5 },
        REQUEST_ID,
      );
      expect(detail.scheduledRounds).toBe(5);
      expect(repo.insertBout.mock.calls[0]?.[0].scheduledRounds).toBe(5);
    });

    it('report restricts private data by role and assignment before loading rounds (AC11)', async () => {
      setup({ status: 'COMPLETED' });
      await expectHttp(service.getReport(fighterActor, BOUT_ID), 403);
      repo.isCoachAssignedToFighter.mockResolvedValue(false);
      await expectHttp(service.getReport(coachActor, BOUT_ID), 403);
      repo.isDoctorAssignedToFighter.mockResolvedValue(false);
      await expectHttp(service.getReport(doctorActor, BOUT_ID), 403);
      expect(repo.listRounds).not.toHaveBeenCalled();
      repo.isDoctorAssignedToFighter.mockResolvedValue(true);
      expect(
        (await service.getReport(doctorActor, BOUT_ID)).roundsRecorded,
      ).toBe(0);
      expect(
        (await service.getReport(adminActor, BOUT_ID)).roundsRecorded,
      ).toBe(0);
    });

    it.each(['WEIGHED_IN', 'CAMP', 'CANCELLED'] as const)(
      'report requires COMPLETED, rejects %s (AC17)',
      async (status) => {
        setup({ status });
        await expectHttp(
          service.getReport(coachActor, BOUT_ID),
          409,
          'BOUT_INVALID_TRANSITION',
        );
        expect(repo.listRounds).not.toHaveBeenCalled();
      },
    );

    it('report exposes evaluations, saved reviews and improvement data without changing analysis (AC6, AC7)', async () => {
      const bout = setup({
        status: 'COMPLETED',
        result: 'WIN',
        method: 'DECISION',
        resultRound: null,
        knockedDown: true,
      });
      repo.listRounds.mockResolvedValue([
        round(1, {
          tacticMarks: { t1: 'INEFFECTIVE' },
          observationMarks: { o1: 'NOT_SEEN' },
        }),
        round(2, { fatigued: true }),
        round(3, { fatigued: true }),
      ]);
      const report = await service.getReport(coachActor, BOUT_ID);
      expect(report.result).toEqual({
        result: 'WIN',
        method: 'DECISION',
        resultRound: null,
        knockedDown: true,
      });
      expect(report.tactics).toEqual([
        {
          id: 't1',
          text: 'counter',
          effectiveRounds: 0,
          ineffectiveRounds: 1,
          outcome: 'INEFFECTIVE',
          review: null,
        },
      ]);
      expect(report.observations).toEqual([
        { id: 'o1', text: 'opening', notSeenInBout: true },
      ]);
      expect(report.improvementPoints).toEqual([
        { code: 'TACTIC_INEFFECTIVE', tacticId: 't1', text: 'counter' },
        { code: 'FATIGUE_FROM_ROUND_2', fromRound: 2 },
      ]);
      expect(report.roundsRecorded).toBe(3);
      expect(bout.opponentAnalysis).toEqual(input);
      expect(repo.updateBout).not.toHaveBeenCalled();
    });

    it('report without rounds suppresses outcomes and tactical points even with saved reviews (AC17)', async () => {
      setup({
        status: 'COMPLETED',
        officialWeightKg: '60',
        weighInAt: NOW,
        opponentAnalysis: {
          ...input,
          tactics: [
            {
              ...input.tactics[0]!,
              review: { outcome: 'INEFFECTIVE', auto: false },
            },
          ],
        },
      });
      repo.findWeightMeasurements.mockResolvedValue([
        { measuredAt: new Date('2026-10-15T03:00:00Z'), weightKg: 70 },
      ]);
      const report = await service.getReport(coachActor, BOUT_ID);
      expect(report.roundsRecorded).toBe(0);
      expect(report.tactics[0]).toMatchObject({
        outcome: null,
        effectiveRounds: 0,
        ineffectiveRounds: 0,
        review: { outcome: 'INEFFECTIVE' },
      });
      expect(report.improvementPoints).toEqual([
        { code: 'ACUTE_LOSS_EXCEEDED' },
      ]);
      expect(report.acuteLoss?.status).toBe('EXCEEDED');
      expect(report.observations[0]?.notSeenInBout).toBe(false);
      repo.findWeightMeasurements.mockResolvedValue([]);
      expect(
        (await service.getReport(coachActor, BOUT_ID)).improvementPoints,
      ).toEqual([]);
    });

    it('corner-card uses T-006 acute loss, including NO_DATA and absent official weight', async () => {
      setup({ officialWeightKg: '60', weighInAt: NOW });
      repo.findWeightMeasurements.mockResolvedValue([
        { measuredAt: new Date('2026-10-15T03:00:00Z'), weightKg: 70 },
      ]);
      expect(
        (await service.getCornerCard(coachActor, BOUT_ID)).acuteLossFlag,
      ).toBe(true);
      repo.findWeightMeasurements.mockResolvedValue([]);
      expect(
        (await service.getCornerCard(coachActor, BOUT_ID)).acuteLossFlag,
      ).toBe(false);
      setup();
      expect(
        (await service.getCornerCard(coachActor, BOUT_ID)).acuteLossFlag,
      ).toBe(false);
    });

    it('prior-context derives points from latest completed bout of requested fighter across scoped pages (AC15)', async () => {
      const completed = setup({
        status: 'COMPLETED',
        opponentName: 'different',
      });
      const old = {
        ...completed,
        id: 'older',
        boutAt: new Date('2026-01-01'),
        opponentAnalysis: {},
      };
      const other = {
        ...completed,
        id: 'other',
        fighterId: OTHER_FIGHTER_ID,
        boutAt: new Date('2026-12-01'),
        opponentAnalysis: {},
      };
      repo.listBouts
        .mockResolvedValueOnce(Array.from({ length: 101 }, () => old))
        .mockResolvedValueOnce([completed, other]);
      repo.listRounds.mockResolvedValue([
        round(1, { tacticMarks: { t1: 'INEFFECTIVE' } }),
      ]);
      const result = await service.getPriorContext(coachActor, {
        fighterId: FIGHTER_ID,
        opponentName: 'unmatched',
      });
      expect(result.copyableAnalysis).toBeNull();
      expect(result.improvementPoints).toEqual([
        { code: 'TACTIC_INEFFECTIVE', tacticId: 't1', text: 'counter' },
      ]);
      expect(repo.listRounds).toHaveBeenCalledWith(BOUT_ID);
      expect(repo.listBouts.mock.calls[1]?.[0].cursor).toBeDefined();
      repo.isCoachAssignedToFighter.mockResolvedValue(false);
      await expectHttp(
        service.getPriorContext(coachActor, {
          fighterId: FIGHTER_ID,
          opponentName: 'different',
        }),
        403,
      );
    });

    it('result-prefill returns the last recorded round and knockdowns, or nulls without rounds (AC16)', async () => {
      setup();
      expect(await service.getResultPrefill(coachActor, BOUT_ID)).toEqual({
        resultRound: null,
        knockedDown: null,
      });
      repo.listRounds.mockResolvedValue([
        round(1),
        round(2, { knockdownsAgainst: 1 }),
        round(3),
      ]);
      expect(await service.getResultPrefill(coachActor, BOUT_ID)).toEqual({
        resultRound: 3,
        knockedDown: true,
      });
      repo.listRounds.mockResolvedValue([round(1)]);
      expect(await service.getResultPrefill(adminActor, BOUT_ID)).toEqual({
        resultRound: 1,
        knockedDown: false,
      });
      await expectHttp(service.getResultPrefill(fighterActor, BOUT_ID), 403);
      await expectHttp(service.getResultPrefill(doctorActor, BOUT_ID), 403);
      repo.isCoachAssignedToFighter.mockResolvedValue(false);
      await expectHttp(service.getResultPrefill(coachActor, BOUT_ID), 403);
      setup({ status: 'COMPLETED' });
      await expectHttp(
        service.getResultPrefill(adminActor, BOUT_ID),
        409,
        'BOUT_INVALID_TRANSITION',
      );
    });

    it('R26 validates scheduled rounds from locked row and requires explicit incomplete decision confirmation (AC16)', async () => {
      vi.setSystemTime(new Date('2026-11-01T03:00:00Z'));
      setup();
      // The row locked in the transaction is authoritative, even after an intervening schedule edit.
      repo.findBoutById.mockResolvedValue(
        makeBout({ status: 'WEIGHED_IN', scheduledRounds: 5 }),
      );
      const err = await expectHttp(
        service.recordResult(
          coachActor,
          BOUT_ID,
          { result: 'WIN', method: 'KO', resultRound: 5 },
          REQUEST_ID,
        ),
        422,
        'BOUT_RESULT_INVALID',
      );
      expect(err.getResponse()).toMatchObject({
        details: { reason: 'ROUND_EXCEEDS_SCHEDULED' },
      });
      expect(repo.updateBout).not.toHaveBeenCalled();
      repo.listRounds.mockResolvedValue([round(1), round(2)]);
      const incomplete = await expectHttp(
        service.recordResult(
          coachActor,
          BOUT_ID,
          { result: 'WIN', method: 'DECISION', confirmIncompleteRounds: false },
          REQUEST_ID,
        ),
        409,
        'BOUT_ROUNDS_INCOMPLETE',
      );
      expect(incomplete.getResponse()).toMatchObject({
        details: { recorded: 2, scheduled: 3 },
      });
      expect(repo.updateBout).not.toHaveBeenCalled();
      const done = await service.recordResult(
        coachActor,
        BOUT_ID,
        { result: 'WIN', method: 'DECISION', confirmIncompleteRounds: true },
        REQUEST_ID,
      );
      expect(done.status).toBe('COMPLETED');
      expect(repo.lockBoutById).toHaveBeenCalledWith(BOUT_ID, tx);
      expect(repo.listRounds).toHaveBeenCalledWith(BOUT_ID, tx);
    });

    it.each([null, 3])(
      'R26 allows decisions without recorded rounds or without a schedule (%s) and does not auto review absent rounds (AC16)',
      async (scheduledRounds) => {
        vi.setSystemTime(new Date('2026-11-01T03:00:00Z'));
        setup({ scheduledRounds });
        const result = await service.recordResult(
          coachActor,
          BOUT_ID,
          { result: 'WIN', method: 'DECISION' },
          REQUEST_ID,
        );
        expect(result.status).toBe('COMPLETED');
        expect(repo.updateBout.mock.calls[0]?.[1]).not.toHaveProperty(
          'opponentAnalysis',
        );
        if (scheduledRounds === null) {
          repo.listRounds.mockResolvedValue([round(1)]);
          expect(
            (
              await service.recordResult(
                coachActor,
                BOUT_ID,
                { result: 'WIN', method: 'DECISION' },
                REQUEST_ID,
              )
            ).status,
          ).toBe('COMPLETED');
        }
      },
    );

    it('R29 auto reviews only missing reviews in the same audited result update (AC16)', async () => {
      vi.setSystemTime(new Date('2026-11-01T03:00:00Z'));
      const bout = setup({
        opponentAnalysis: {
          ...input,
          tactics: [
            input.tactics[0]!,
            {
              ...input.tactics[0]!,
              id: 't2',
              review: { outcome: 'INEFFECTIVE', note: 'keep', auto: false },
            },
            { ...input.tactics[0]!, id: 't3' },
          ],
        },
      });
      repo.listRounds.mockResolvedValue([
        round(1, { tacticMarks: { t1: 'EFFECTIVE', t2: 'EFFECTIVE' } }),
        round(2),
        round(3),
      ]);
      const result = await service.recordResult(
        coachActor,
        BOUT_ID,
        { result: 'WIN', method: 'DECISION' },
        REQUEST_ID,
      );
      expect(
        result.opponentAnalysis.tactics?.map((t) =>
          'review' in t ? t.review : undefined,
        ),
      ).toEqual([
        { outcome: 'EFFECTIVE', note: null, auto: true },
        { outcome: 'INEFFECTIVE', note: 'keep', auto: false },
        { outcome: 'NOT_USED', note: null, auto: true },
      ]);
      expect(repo.updateBout).toHaveBeenCalledTimes(1);
      expect(repo.updateBout).toHaveBeenCalledWith(
        BOUT_ID,
        expect.objectContaining({
          status: 'COMPLETED',
          opponentAnalysis: expect.any(Object),
        }),
        expect.anything(),
        tx,
      );
      expect(tx.execute).toHaveBeenCalled();
      expect(bout.opponentAnalysis.tactics?.[0]).not.toHaveProperty('review');
      setup({
        status: 'COMPLETED',
        opponentAnalysis:
          result.opponentAnalysis as BoutRow['opponentAnalysis'],
      });
      const manual = await service.putOpponentReview(
        coachActor,
        BOUT_ID,
        {
          reviews: [
            {
              tacticId: 't1',
              outcome: 'INEFFECTIVE',
              note: 'coach correction',
            },
          ],
        },
        REQUEST_ID,
      );
      expect(manual.opponentAnalysis.tactics?.[0]?.review).toEqual({
        outcome: 'INEFFECTIVE',
        note: 'coach correction',
        auto: false,
      });
    });

    it('result does not write reviews when locked status changes or the conditional result update fails (AC16)', async () => {
      vi.setSystemTime(new Date('2026-11-01T03:00:00Z'));
      setup();
      repo.lockBoutById.mockResolvedValue(makeBout({ status: 'COMPLETED' }));
      await expectHttp(
        service.recordResult(
          coachActor,
          BOUT_ID,
          { result: 'WIN', method: 'DECISION' },
          REQUEST_ID,
        ),
        409,
        'BOUT_STATE_CONFLICT',
      );
      expect(repo.updateBout).not.toHaveBeenCalled();
      const bout = setup();
      repo.listRounds.mockResolvedValue([
        round(1, { tacticMarks: { t1: 'INEFFECTIVE' } }),
      ]);
      repo.updateBout.mockResolvedValue(undefined);
      await expectHttp(
        service.recordResult(
          coachActor,
          BOUT_ID,
          { result: 'WIN', method: 'KO', resultRound: 1 },
          REQUEST_ID,
        ),
        409,
        'BOUT_STATE_CONFLICT',
      );
      expect(repo.updateBout).toHaveBeenCalledTimes(1);
      expect(bout.opponentAnalysis.tactics?.[0]).not.toHaveProperty('review');
    });

    it('normalizes opponent names, selects the latest visible bout and strips reviews (AC15 copy)', async () => {
      const bout = setup({
        opponentName: 'nguyen van a',
        opponentAnalysis: {
          ...input,
          tactics: [
            { ...input.tactics[0]!, review: { outcome: 'INEFFECTIVE' } },
          ],
        },
      });
      repo.listBouts.mockResolvedValue([
        bout,
        { ...bout, id: 'older', boutAt: new Date('2026-01-01') },
      ]);
      const result = await service.getPriorContext(coachActor, {
        fighterId: FIGHTER_ID,
        opponentName: '  Nguyen  VAN a ',
      });
      expect(result.copyableAnalysis?.boutId).toBe(BOUT_ID);
      expect(
        result.copyableAnalysis?.opponentAnalysis.tactics?.[0],
      ).not.toHaveProperty('review');
      expect(repo.listBouts).toHaveBeenCalledWith({
        scope: { kind: 'COACH', userId: coachActor.id },
        limit: 100,
        cursor: undefined,
      });
      expect(result.improvementPoints).toBeNull(); // No completed bout in this history.
      repo.listBouts.mockResolvedValue([]); // Scope excludes the unassigned historical fighter.
      expect(
        (
          await service.getPriorContext(coachActor, {
            fighterId: FIGHTER_ID,
            opponentName: 'nguyen van a',
          })
        ).copyableAnalysis,
      ).toBeNull();
    });

    it('paginates scope-filtered history before choosing the latest match', async () => {
      const bout = setup({ opponentName: 'match' });
      repo.listBouts
        .mockResolvedValueOnce(
          Array.from({ length: 101 }, (_, n) => ({
            ...bout,
            id: String(n),
            opponentName: 'other',
          })),
        )
        .mockResolvedValueOnce([bout]);
      const result = await service.getPriorContext(coachActor, {
        fighterId: FIGHTER_ID,
        opponentName: 'match',
      });
      expect(result.copyableAnalysis?.boutId).toBe(BOUT_ID);
      expect(repo.listBouts.mock.calls[1]?.[0].cursor).toBeDefined();
    });
  });
});
