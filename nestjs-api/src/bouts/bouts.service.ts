import { Injectable } from '@nestjs/common';
import type {
  BoutHistoryEntry,
  BoutRequirementRow,
  BoutRow,
  CompetitionRuleset,
} from '../database/schema.js';
import { forbidden } from '../shared/errors/access.error.js';
import type { AuthenticatedUser } from '../shared/models/auth-context.model.js';
import { USER } from '../shared/types/user.role.js';
import { setAuditContext } from '../shared/utils/audit-context.util.js';
import {
  boutActiveExists,
  boutChangeReasonRequired,
  boutCoachNotAssigned,
  boutCoachRequired,
  boutFightWeekTooEarly,
  boutFighterNotFound,
  boutInvalidCatchweight,
  boutInvalidPlan,
  boutInvalidSchedule,
  boutInvalidTransition,
  boutInvalidWeightClass,
  boutNotEditable,
  boutNotFound,
  boutNotStarted,
  boutRequirementsIncomplete,
  boutRequirementsLocked,
  boutResultInvalid,
  boutStateConflict,
  boutWeighInNotFailed,
  boutWeighInTooEarly,
  mapBoutPersistenceError,
  requirementExists,
  requirementInvalid,
  requirementNotFound,
  rulesetNotFound,
} from './bouts.error.js';
import {
  academyDateOf,
  academyStartOfDay,
  acuteLossLimitPctFor,
  addDaysToDate,
  buildDailyWeightPoints,
  canEnterFightWeek,
  canTransition,
  computeAcuteLoss,
  computeWeightTrack,
  daysToWeighIn,
  encodeBoutCursor,
  evaluateGate1,
  fightWeekStartsOn,
  isFinalStatus,
  requirementsDueOn,
  resolveWeightClass,
  SCHEDULE_EDITABLE_STATUSES,
  type AcuteLossResult,
  type BoutDetailResponse,
  type BoutListResponse,
  type BoutStatus,
  type BoutSummary,
  type CancelBoutInput,
  type CatchweightInput,
  type CreateBoutInput,
  type CreateRequirementInput,
  type Gate1Result,
  type ListBoutsQuery,
  type RecordResultInput,
  type RequirementResponse,
  type RulesetResponse,
  type StartCampInput,
  type UpdateBoutInput,
  type UpdateRequirementInput,
  type WeighInBlock,
  type WeighInInput,
  type WeighInResponse,
  type WeightTrack,
} from './bouts.model.js';
import { BoutsRepository, type BoutScope } from './bouts.repo.js';

@Injectable()
export class BoutsService {
  constructor(private readonly repo: BoutsRepository) {}

  // ---------------------------------------------------------------------------
  // Rulesets
  // ---------------------------------------------------------------------------

  async listRulesets(): Promise<RulesetResponse[]> {
    const rows = await this.repo.listRulesets();
    return rows.map(toRulesetResponse);
  }

  // ---------------------------------------------------------------------------
  // Reads
  // ---------------------------------------------------------------------------

  async listBouts(
    actor: AuthenticatedUser,
    query: ListBoutsQuery,
  ): Promise<BoutListResponse> {
    const scope = await this.resolveListScope(actor, query.fighterId);
    const rows = await this.repo.listBouts({
      scope,
      fighterId: query.fighterId,
      statuses: query.status,
      cursor: query.cursor,
      limit: query.limit,
    });
    const hasNextPage = rows.length > query.limit;
    const page = hasNextPage ? rows.slice(0, query.limit) : rows;
    const last = page[page.length - 1];
    return {
      data: page.map(toBoutSummary),
      hasNextPage,
      nextCursor:
        hasNextPage && last
          ? encodeBoutCursor({
              weighInAt: last.weighInAt.toISOString(),
              id: last.id,
            })
          : null,
    };
  }

  async getBout(
    actor: AuthenticatedUser,
    id: string,
  ): Promise<BoutDetailResponse> {
    const bout = await this.requireBout(id);
    await this.assertReadAccess(actor, bout.fighterId);
    return this.buildDetail(bout);
  }

  async getWeightTrack(
    actor: AuthenticatedUser,
    id: string,
  ): Promise<WeightTrack> {
    const bout = await this.requireBout(id);
    await this.assertReadAccess(actor, bout.fighterId);
    const ruleset = await this.requireRuleset(bout.rulesetId);
    return this.loadWeightTrack(bout, ruleset, new Date());
  }

  // ---------------------------------------------------------------------------
  // Create and edit
  // ---------------------------------------------------------------------------

  async createBout(
    actor: AuthenticatedUser,
    input: CreateBoutInput,
    requestId: string,
  ): Promise<BoutDetailResponse> {
    await this.assertWriteAccess(actor, input.fighterId);

    const weighInAt = new Date(input.weighInAt);
    const boutAt = new Date(input.boutAt);
    const now = new Date();
    if (weighInAt.getTime() >= boutAt.getTime())
      throw boutInvalidSchedule('WEIGH_IN_NOT_BEFORE_BOUT');
    if (boutAt.getTime() <= now.getTime())
      throw boutInvalidSchedule('BOUT_NOT_IN_FUTURE');

    if (!(await this.repo.isActiveFighter(input.fighterId)))
      throw boutFighterNotFound();
    const coachId = await this.resolveCoachId(actor, input);
    const ruleset = await this.requireRuleset(input.rulesetId);

    const weightClass = resolveWeightClass(ruleset.weightClasses, {
      weightClassCode: input.weightClassCode,
      weightLimitKg: input.weightLimitKg,
    });
    if (!weightClass.ok) throw boutInvalidWeightClass(weightClass.reason);

    const acuteLossLimitPct = acuteLossLimitPctFor(weighInAt, boutAt, {
      long: Number(ruleset.acuteLossLimitPctLong),
      short: Number(ruleset.acuteLossLimitPctShort),
    });

    try {
      const bout = await this.repo.transaction(async (tx) => {
        await setAuditContext(actor.authSubject, requestId, tx);
        const created = await this.repo.insertBout(
          {
            fighterId: input.fighterId,
            coachId,
            rulesetId: ruleset.id,
            eventName: input.eventName,
            venue: input.venue ?? null,
            opponentName: input.opponentName ?? null,
            weightClassCode: weightClass.code,
            weightLimitKg: String(weightClass.limitKg),
            acuteLossLimitPct: String(acuteLossLimitPct),
            requirementsDueDays:
              input.requirementsDueDays ?? ruleset.requirementsDueDays,
            weighInAt,
            boutAt,
            notes: input.notes ?? null,
            createdById: actor.id,
          },
          tx,
        );
        await this.repo.insertRequirements(
          ruleset.requirementTemplates.map((template) => ({
            boutId: created.id,
            code: template.code,
            label: template.label,
            required: template.required,
            validityDays: template.validityDays ?? null,
            source: 'PRESET',
            updatedById: actor.id,
          })),
          tx,
        );
        return created;
      });
      return await this.buildDetail(bout, ruleset);
    } catch (error) {
      throw mapBoutPersistenceError(error);
    }
  }

  async updateBout(
    actor: AuthenticatedUser,
    id: string,
    input: UpdateBoutInput,
    requestId: string,
  ): Promise<BoutDetailResponse> {
    const bout = await this.requireBout(id);
    await this.assertWriteAccess(actor, bout.fighterId);

    const scheduleKeys = [
      'weighInAt',
      'boutAt',
      'weightClassCode',
      'weightLimitKg',
      'requirementsDueDays',
    ] as const;
    const touchesSchedule = scheduleKeys.some((key) => input[key] !== undefined);
    const touchesOther = (
      ['eventName', 'venue', 'opponentName'] as const
    ).some((key) => input[key] !== undefined);

    if (isFinalStatus(bout.status) && (touchesSchedule || touchesOther))
      throw boutNotEditable(bout.status);
    if (touchesSchedule && !SCHEDULE_EDITABLE_STATUSES.includes(bout.status))
      throw boutNotEditable(bout.status);

    const changes: Parameters<BoutsRepository['updateBout']>[1] = {};
    if (input.eventName !== undefined) changes.eventName = input.eventName;
    if (input.venue !== undefined) changes.venue = input.venue;
    if (input.opponentName !== undefined) changes.opponentName = input.opponentName;
    if (input.notes !== undefined) changes.notes = input.notes;
    if (input.requirementsDueDays !== undefined)
      changes.requirementsDueDays = input.requirementsDueDays;

    const datesChanged =
      input.weighInAt !== undefined || input.boutAt !== undefined;
    const classChanged =
      input.weightClassCode !== undefined || input.weightLimitKg !== undefined;

    let ruleset: CompetitionRuleset | undefined;
    if (datesChanged || classChanged) ruleset = await this.requireRuleset(bout.rulesetId);

    if (datesChanged && ruleset) {
      const weighInAt = input.weighInAt ? new Date(input.weighInAt) : bout.weighInAt;
      const boutAt = input.boutAt ? new Date(input.boutAt) : bout.boutAt;
      if (weighInAt.getTime() >= boutAt.getTime())
        throw boutInvalidSchedule('WEIGH_IN_NOT_BEFORE_BOUT');
      if (input.boutAt && boutAt.getTime() <= Date.now())
        throw boutInvalidSchedule('BOUT_NOT_IN_FUTURE');
      changes.weighInAt = weighInAt;
      changes.boutAt = boutAt;
      changes.acuteLossLimitPct = String(
        acuteLossLimitPctFor(weighInAt, boutAt, {
          long: Number(ruleset.acuteLossLimitPctLong),
          short: Number(ruleset.acuteLossLimitPctShort),
        }),
      );
    }

    let weightClassHistoryEntry: BoutHistoryEntry | undefined;
    if (classChanged && ruleset) {
      const weightClass = resolveWeightClass(ruleset.weightClasses, {
        weightClassCode: input.weightClassCode ?? bout.weightClassCode,
        weightLimitKg: input.weightLimitKg,
      });
      if (!weightClass.ok) throw boutInvalidWeightClass(weightClass.reason);

      const fromClass = bout.weightClassCode;
      const toClass = weightClass.code;
      const fromLimitKg = Number(bout.weightLimitKg);
      const toLimitKg = weightClass.limitKg;

      const isActuallyChanged =
        fromClass !== toClass ||
        Math.round(fromLimitKg * 100) !== Math.round(toLimitKg * 100);

      if (isActuallyChanged) {
        if (!input.reason) throw boutChangeReasonRequired();
        weightClassHistoryEntry = {
          at: new Date().toISOString(),
          by: actor.id,
          from: bout.status,
          to: bout.status,
          reason: input.reason,
          action: 'WEIGHT_CLASS_CHANGE',
          fromClass,
          toClass,
          fromLimitKg,
          toLimitKg,
        };
      }

      changes.weightClassCode = weightClass.code;
      changes.weightLimitKg = String(weightClass.limitKg);
    }

    try {
      const updated = await this.repo.transaction(async (tx) => {
        await setAuditContext(actor.authSubject, requestId, tx);
        return this.repo.updateBout(
          bout.id,
          changes,
          {
            expectedStatus: bout.status,
            historyEntry: weightClassHistoryEntry,
          },
          tx,
        );
      });
      if (!updated) throw boutStateConflict();
      return await this.buildDetail(updated, ruleset);
    } catch (error) {
      throw mapBoutPersistenceError(error);
    }
  }

  // ---------------------------------------------------------------------------
  // Lifecycle (F2, F5, F8)
  // ---------------------------------------------------------------------------

  async startCamp(
    actor: AuthenticatedUser,
    id: string,
    input: StartCampInput,
    requestId: string,
  ): Promise<BoutDetailResponse> {
    const bout = await this.requireBout(id);
    await this.assertWriteAccess(actor, bout.fighterId);
    if (!canTransition(bout.status, 'CAMP'))
      throw boutInvalidTransition(bout.status, 'CAMP');

    const plan = await this.repo.findPlanById(input.trainingPlanId);
    if (!plan || plan.deletedAt !== null) throw boutInvalidPlan('NOT_FOUND');
    if (plan.fighterId !== bout.fighterId) throw boutInvalidPlan('FIGHTER_MISMATCH');
    if (plan.phase !== 'fight_camp') throw boutInvalidPlan('PHASE_NOT_FIGHT_CAMP');

    if (await this.repo.findActiveBoutIdForFighter(bout.fighterId, bout.id))
      throw boutActiveExists();

    return this.transition(actor, bout, 'CAMP', requestId, {
      changes: { trainingPlanId: plan.id },
    });
  }

  async enterFightWeek(
    actor: AuthenticatedUser,
    id: string,
    requestId: string,
  ): Promise<BoutDetailResponse> {
    const bout = await this.requireBout(id);
    await this.assertWriteAccess(actor, bout.fighterId);
    if (!canTransition(bout.status, 'FIGHT_WEEK'))
      throw boutInvalidTransition(bout.status, 'FIGHT_WEEK');

    const ruleset = await this.requireRuleset(bout.rulesetId);
    const requirements = await this.repo.listRequirements(bout.id);
    const gate1 = evaluateGate1(requirements.map(toRequirementState), bout.boutAt);
    if (!gate1.passed)
      throw boutRequirementsIncomplete({
        missing: gate1.missing,
        expiring: gate1.expiring,
      });

    const earliestOn = fightWeekStartsOn(bout.weighInAt, ruleset.fightWeekDays);
    if (academyDateOf(new Date()) < earliestOn)
      throw boutFightWeekTooEarly(earliestOn);

    return this.transition(actor, bout, 'FIGHT_WEEK', requestId, {
      changes: {},
      ruleset,
    });
  }

  async cancelBout(
    actor: AuthenticatedUser,
    id: string,
    input: CancelBoutInput,
    requestId: string,
  ): Promise<BoutDetailResponse> {
    const bout = await this.requireBout(id);
    await this.assertWriteAccess(actor, bout.fighterId);
    if (!canTransition(bout.status, 'CANCELLED'))
      throw boutInvalidTransition(bout.status, 'CANCELLED');

    return this.transition(actor, bout, 'CANCELLED', requestId, {
      changes: { cancelReason: input.reason },
      reason: input.reason,
    });
  }

  // ---------------------------------------------------------------------------
  // Requirements checklist (F4)
  // ---------------------------------------------------------------------------

  async addRequirement(
    actor: AuthenticatedUser,
    boutId: string,
    input: CreateRequirementInput,
    requestId: string,
  ): Promise<{ requirement: RequirementResponse; gate1: Gate1Result }> {
    const bout = await this.requireBout(boutId);
    await this.assertWriteAccess(actor, bout.fighterId);
    if (isFinalStatus(bout.status)) throw boutNotEditable(bout.status);

    const isLocked = bout.status === 'FIGHT_WEEK' || bout.status === 'WEIGHED_IN';
    if (isLocked && !input.unlockReason) throw boutRequirementsLocked();

    if (await this.repo.findRequirement(bout.id, input.code))
      throw requirementExists();

    try {
      const [created] = await this.repo.transaction(async (tx) => {
        await setAuditContext(actor.authSubject, requestId, tx);
        if (isLocked) {
          const historyEntry: BoutHistoryEntry = {
            at: new Date().toISOString(),
            by: actor.id,
            from: bout.status,
            to: bout.status,
            reason: input.unlockReason,
            action: 'REQUIREMENT_UNLOCK',
            requirementCode: input.code,
          };
          const unlocked = await this.repo.updateBout(
            bout.id,
            {},
            { expectedStatus: bout.status, historyEntry },
            tx,
          );
          if (!unlocked) throw boutStateConflict();
        }
        return this.repo.insertRequirements(
          [
            {
              boutId: bout.id,
              code: input.code,
              label: input.label,
              required: input.required,
              validityDays: input.validityDays ?? null,
              source: 'COACH',
              updatedById: actor.id,
            },
          ],
          tx,
        );
      });
      if (!created) throw boutStateConflict();
      return {
        requirement: toRequirementResponse(created),
        gate1: await this.loadGate1(bout),
      };
    } catch (error) {
      throw mapBoutPersistenceError(error);
    }
  }

  async updateRequirement(
    actor: AuthenticatedUser,
    boutId: string,
    code: string,
    input: UpdateRequirementInput,
    requestId: string,
  ): Promise<{ requirement: RequirementResponse; gate1: Gate1Result }> {
    const bout = await this.requireBout(boutId);
    await this.assertWriteAccess(actor, bout.fighterId);
    if (isFinalStatus(bout.status)) throw boutNotEditable(bout.status);

    const isLocked = bout.status === 'FIGHT_WEEK' || bout.status === 'WEIGHED_IN';
    if (isLocked && !input.unlockReason) throw boutRequirementsLocked();

    const existing = await this.repo.findRequirement(bout.id, code);
    if (!existing) throw requirementNotFound();

    const status = input.status ?? existing.status;
    let issuedOn = input.issuedOn !== undefined ? input.issuedOn : existing.issuedOn;
    let validUntil =
      input.validUntil !== undefined ? input.validUntil : existing.validUntil;
    let statusReason =
      input.statusReason !== undefined ? input.statusReason : existing.statusReason;

    if (status === 'MISSING') {
      issuedOn = null;
      validUntil = null;
      statusReason = null;
    } else if (status === 'PROVIDED') {
      if (validUntil === null && issuedOn !== null && existing.validityDays !== null)
        validUntil = addDaysToDate(issuedOn, existing.validityDays);
      if (validUntil === null) throw requirementInvalid('VALID_UNTIL_REQUIRED');
      if (input.status !== undefined && input.statusReason === undefined)
        statusReason = null;
    } else if (status === 'REJECTED') {
      if (!statusReason || statusReason.trim() === '')
        throw requirementInvalid('STATUS_REASON_REQUIRED');
    }
    if (issuedOn !== null && validUntil !== null && validUntil < issuedOn)
      throw requirementInvalid('PERIOD_INVALID');

    try {
      const updated = await this.repo.transaction(async (tx) => {
        await setAuditContext(actor.authSubject, requestId, tx);
        if (isLocked) {
          const historyEntry: BoutHistoryEntry = {
            at: new Date().toISOString(),
            by: actor.id,
            from: bout.status,
            to: bout.status,
            reason: input.unlockReason,
            action: 'REQUIREMENT_UNLOCK',
            requirementCode: code,
          };
          const unlocked = await this.repo.updateBout(
            bout.id,
            {},
            { expectedStatus: bout.status, historyEntry },
            tx,
          );
          if (!unlocked) throw boutStateConflict();
        }
        return this.repo.updateRequirement(
          bout.id,
          code,
          {
            ...(input.label !== undefined ? { label: input.label } : {}),
            ...(input.required !== undefined ? { required: input.required } : {}),
            status,
            issuedOn,
            validUntil,
            statusReason,
            updatedById: actor.id,
          },
          tx,
        );
      });
      if (!updated) throw requirementNotFound();
      return {
        requirement: toRequirementResponse(updated),
        gate1: await this.loadGate1(bout),
      };
    } catch (error) {
      throw mapBoutPersistenceError(error);
    }
  }

  async removeRequirement(
    actor: AuthenticatedUser,
    boutId: string,
    code: string,
    requestId: string,
    unlockReason?: string,
  ): Promise<{ code: string; gate1: Gate1Result }> {
    const bout = await this.requireBout(boutId);
    await this.assertWriteAccess(actor, bout.fighterId);
    if (isFinalStatus(bout.status)) throw boutNotEditable(bout.status);

    const isLocked = bout.status === 'FIGHT_WEEK' || bout.status === 'WEIGHED_IN';
    if (isLocked && !unlockReason) throw boutRequirementsLocked();

    try {
      const removed = await this.repo.transaction(async (tx) => {
        await setAuditContext(actor.authSubject, requestId, tx);
        if (isLocked) {
          const historyEntry: BoutHistoryEntry = {
            at: new Date().toISOString(),
            by: actor.id,
            from: bout.status,
            to: bout.status,
            reason: unlockReason,
            action: 'REQUIREMENT_UNLOCK',
            requirementCode: code,
          };
          const unlocked = await this.repo.updateBout(
            bout.id,
            {},
            { expectedStatus: bout.status, historyEntry },
            tx,
          );
          if (!unlocked) throw boutStateConflict();
        }
        return this.repo.deleteRequirement(bout.id, code, tx);
      });
      if (!removed) throw requirementNotFound();
      return { code, gate1: await this.loadGate1(bout) };
    } catch (error) {
      throw mapBoutPersistenceError(error);
    }
  }


  // ---------------------------------------------------------------------------
  // Weigh-in and result (F5, F6, R17-R19, R26)
  // ---------------------------------------------------------------------------

  async recordWeighIn(
    actor: AuthenticatedUser,
    id: string,
    input: WeighInInput,
    requestId: string,
  ): Promise<WeighInResponse> {
    const bout = await this.requireBout(id);
    await this.assertWriteAccess(actor, bout.fighterId);

    if (bout.status !== 'FIGHT_WEEK') {
      throw boutInvalidTransition(bout.status, 'WEIGHED_IN');
    }

    const now = new Date();
    const today = academyDateOf(now);
    const earliestOn = academyDateOf(bout.weighInAt);
    if (today < earliestOn) {
      throw boutWeighInTooEarly(earliestOn);
    }

    const ruleset = await this.requireRuleset(bout.rulesetId);
    const limit = bout.catchweightKg !== null ? Number(bout.catchweightKg) : Number(bout.weightLimitKg);
    const weightKg = input.weightKg;
    const hydrationCheck = input.hydrationCheck ?? 'NOT_APPLICABLE';

    const roundedWeight = Math.round(weightKg * 100);
    const roundedLimit = Math.round(limit * 100);
    const weightPassed = roundedWeight <= roundedLimit;

    const isPassed = weightPassed && hydrationCheck !== 'FAILED';
    const madeWeight = weightPassed;

    let outcome: 'PASSED' | 'FAILED';
    let reason: 'OVER_LIMIT' | 'HYDRATION_FAILED' | null = null;
    let overByKg: number | null = null;
    let overByPct: number | null = null;
    let options: ('CATCHWEIGHT' | 'CANCEL')[] = [];

    if (isPassed) {
      outcome = 'PASSED';
      reason = null;
      overByKg = null;
      overByPct = null;
      options = [];
    } else {
      outcome = 'FAILED';
      options = ['CATCHWEIGHT', 'CANCEL'];
      if (!weightPassed) {
        reason = 'OVER_LIMIT';
        overByKg = Math.round((weightKg - limit) * 100) / 100;
        overByPct = Math.round(((weightKg - limit) / limit * 100) * 10) / 10;
      } else {
        reason = 'HYDRATION_FAILED';
        overByKg = null;
        overByPct = null;
      }
    }

    const weighInBlock: WeighInBlock = {
      outcome,
      reason,
      overByKg,
      overByPct,
      options,
    };

    try {
      const updated = await this.repo.transaction(async (tx) => {
        await setAuditContext(actor.authSubject, requestId, tx);
        await this.repo.insertFighterMeasurement(
          {
            fighterId: bout.fighterId,
            recordedById: actor.id,
            measuredAt: now,
            measurementContext: 'WEIGH_IN',
            weightKg: weightKg.toFixed(2),
            notes: input.notes ?? null,
          },
          tx,
        );

        const changes: Parameters<BoutsRepository['updateBout']>[1] = {
          officialWeightKg: weightKg.toFixed(2),
          madeWeight,
          hydrationCheck,
        };

        let historyEntry: BoutHistoryEntry | undefined;
        if (isPassed) {
          changes.status = 'WEIGHED_IN';
          historyEntry = {
            at: now.toISOString(),
            by: actor.id,
            from: 'FIGHT_WEEK',
            to: 'WEIGHED_IN',
          };
        }
        const row = await this.repo.updateBout(
          bout.id,
          changes,
          { expectedStatus: 'FIGHT_WEEK', ...(historyEntry ? { historyEntry } : {}) },
          tx,
        );
        // Throw inside the transaction so a lost race rolls back the measurement insert.
        if (!row) throw boutStateConflict();
        return row;
      });

      const detail = await this.buildDetail(updated, ruleset);
      return {
        ...detail,
        weighIn: weighInBlock,
      };
    } catch (error) {
      throw mapBoutPersistenceError(error);
    }
  }

  async recordCatchweight(
    actor: AuthenticatedUser,
    id: string,
    input: CatchweightInput,
    requestId: string,
  ): Promise<BoutDetailResponse> {
    const bout = await this.requireBout(id);
    await this.assertWriteAccess(actor, bout.fighterId);

    if (
      bout.status !== 'FIGHT_WEEK' ||
      (bout.madeWeight !== false && bout.hydrationCheck !== 'FAILED')
    ) {
      throw boutWeighInNotFailed();
    }

    if (bout.officialWeightKg === null) {
      throw boutWeighInNotFailed();
    }

    const officialWeight = Number(bout.officialWeightKg);
    const targetKg = input.catchweightKg ?? officialWeight;

    // An over-limit official weight already exceeds `weight_limit_kg`, so `>= officialWeight`
    // is enough; a hydration-only failure has an official weight below the limit.
    if (targetKg < officialWeight) {
      throw boutInvalidCatchweight();
    }

    const reason = input.note ?? 'Catchweight';
    const historyEntry: BoutHistoryEntry = {
      at: new Date().toISOString(),
      by: actor.id,
      from: 'FIGHT_WEEK',
      to: 'WEIGHED_IN',
      reason,
      catchweightKg: targetKg,
    };

    try {
      const updated = await this.repo.transaction(async (tx) => {
        await setAuditContext(actor.authSubject, requestId, tx);
        return this.repo.updateBout(
          bout.id,
          {
            catchweightKg: targetKg.toFixed(2),
            madeWeight: true,
            status: 'WEIGHED_IN',
          },
          { expectedStatus: 'FIGHT_WEEK', historyEntry },
          tx,
        );
      });
      if (!updated) throw boutStateConflict();
      return await this.buildDetail(updated);
    } catch (error) {
      throw mapBoutPersistenceError(error);
    }
  }

  async recordResult(
    actor: AuthenticatedUser,
    id: string,
    input: RecordResultInput,
    requestId: string,
  ): Promise<BoutDetailResponse> {
    const bout = await this.requireBout(id);
    await this.assertWriteAccess(actor, bout.fighterId);

    if (bout.status !== 'WEIGHED_IN') {
      throw boutInvalidTransition(bout.status, 'COMPLETED');
    }

    const now = new Date();
    const today = academyDateOf(now);
    const earliestOn = academyDateOf(bout.boutAt);
    if (today < earliestOn) {
      throw boutNotStarted(earliestOn);
    }

    // Conditional validations (mục 4):
    if (['KO', 'TKO', 'SUBMISSION'].includes(input.method)) {
      if (input.resultRound === undefined || input.resultRound === null) {
        throw boutResultInvalid('ROUND_REQUIRED');
      }
    } else if (input.method === 'DECISION') {
      if (input.resultRound !== undefined && input.resultRound !== null) {
        throw boutResultInvalid('ROUND_NOT_ALLOWED');
      }
    }

    const isKoOrTkoLoss = input.result === 'LOSS' && ['KO', 'TKO'].includes(input.method);
    if (isKoOrTkoLoss) {
      if (!input.lossOfConsciousness) {
        throw boutResultInvalid('CONSCIOUSNESS_REQUIRED');
      }
    } else {
      if (input.lossOfConsciousness !== undefined && input.lossOfConsciousness !== null) {
        throw boutResultInvalid('CONSCIOUSNESS_NOT_ALLOWED');
      }
    }

    const isTkoLoss = input.result === 'LOSS' && input.method === 'TKO';
    if (isTkoLoss) {
      if (input.stoppedByHeadStrike === undefined || input.stoppedByHeadStrike === null) {
        throw boutResultInvalid('HEAD_STRIKE_REQUIRED');
      }
    } else {
      if (input.stoppedByHeadStrike !== undefined && input.stoppedByHeadStrike !== null) {
        throw boutResultInvalid('HEAD_STRIKE_NOT_ALLOWED');
      }
    }

    const historyEntry: BoutHistoryEntry = {
      at: now.toISOString(),
      by: actor.id,
      from: 'WEIGHED_IN',
      to: 'COMPLETED',
      ...(input.lossOfConsciousness !== undefined
        ? { lossOfConsciousness: input.lossOfConsciousness }
        : {}),
      ...(input.stoppedByHeadStrike !== undefined
        ? { stoppedByHeadStrike: input.stoppedByHeadStrike }
        : {}),
      ...(input.injuryNote !== undefined
        ? { injuryNote: input.injuryNote }
        : {}),
    };

    const changes: Parameters<BoutsRepository['updateBout']>[1] = {
      result: input.result,
      method: input.method,
      resultRound: input.resultRound ?? null,
      knockedDown: input.knockedDown ?? false,
      status: 'COMPLETED',
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
    };

    try {
      const updated = await this.repo.transaction(async (tx) => {
        await setAuditContext(actor.authSubject, requestId, tx);
        return this.repo.updateBout(
          bout.id,
          changes,
          { expectedStatus: 'WEIGHED_IN', historyEntry },
          tx,
        );
      });
      if (!updated) throw boutStateConflict();
      return await this.buildDetail(updated);
    } catch (error) {
      throw mapBoutPersistenceError(error);
    }
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  private async transition(
    actor: AuthenticatedUser,
    bout: BoutRow,
    to: BoutStatus,
    requestId: string,
    options: {
      changes: Parameters<BoutsRepository['updateBout']>[1];
      reason?: string;
      ruleset?: CompetitionRuleset;
    },
  ): Promise<BoutDetailResponse> {
    const entry: BoutHistoryEntry = {
      at: new Date().toISOString(),
      by: actor.id,
      from: bout.status,
      to,
      ...(options.reason ? { reason: options.reason } : {}),
    };
    try {
      const updated = await this.repo.transaction(async (tx) => {
        await setAuditContext(actor.authSubject, requestId, tx);
        return this.repo.updateBout(
          bout.id,
          { ...options.changes, status: to },
          { expectedStatus: bout.status, historyEntry: entry },
          tx,
        );
      });
      if (!updated) throw boutStateConflict();
      return await this.buildDetail(updated, options.ruleset);
    } catch (error) {
      throw mapBoutPersistenceError(error);
    }
  }

  private async buildDetail(
    bout: BoutRow,
    knownRuleset?: CompetitionRuleset,
  ): Promise<BoutDetailResponse> {
    const now = new Date();
    const ruleset = knownRuleset ?? (await this.requireRuleset(bout.rulesetId));
    const requirementRows = await this.repo.listRequirements(bout.id);
    const gate1 = evaluateGate1(requirementRows.map(toRequirementState), bout.boutAt);
    const track = await this.loadWeightTrack(bout, ruleset, now);
    const dueOn = requirementsDueOn(bout.weighInAt, bout.requirementsDueDays);

    let acuteLoss: AcuteLossResult | null = null;
    if (bout.officialWeightKg !== null) {
      const windowStart = addDaysToDate(
        academyDateOf(bout.weighInAt),
        -ruleset.acuteWindowDays,
      );
      const measurements = await this.repo.findWeightMeasurements(
        bout.fighterId,
        academyStartOfDay(windowStart),
        now,
      );
      acuteLoss = computeAcuteLoss({
        officialWeightKg: Number(bout.officialWeightKg),
        limitPct: Number(bout.acuteLossLimitPct),
        acuteWindowDays: ruleset.acuteWindowDays,
        weighInDate: academyDateOf(bout.weighInAt),
        measurements,
      });
    }

    return {
      ...toBoutSummary(bout),
      ruleset: {
        id: ruleset.id,
        name: ruleset.name,
        sport: ruleset.sport,
        verified: ruleset.verified,
        sourceNote: ruleset.sourceNote,
        fightWeekDays: ruleset.fightWeekDays,
        acuteWindowDays: ruleset.acuteWindowDays,
      },
      requirements: requirementRows.map(toRequirementResponse),
      daysToWeighIn: daysToWeighIn(bout.weighInAt, now),
      requirementsDueOn: dueOn,
      requirementsOverdue:
        !isFinalStatus(bout.status) &&
        !gate1.passed &&
        academyDateOf(now) > dueOn,
      gate1,
      canEnterFightWeek: canEnterFightWeek({
        status: bout.status,
        weighInAt: bout.weighInAt,
        fightWeekDays: ruleset.fightWeekDays,
        now,
        gate1,
      }),
      weight: {
        latestKg: track.latestKg,
        latestOn: track.latestOn,
        remainingPct: track.remainingPct,
        status: track.status,
        referencePath: track.referencePath,
      },
      acuteLoss,
    };
  }

  private async loadGate1(bout: BoutRow): Promise<Gate1Result> {
    const rows = await this.repo.listRequirements(bout.id);
    return evaluateGate1(rows.map(toRequirementState), bout.boutAt);
  }

  /**
   * Camp start is the attached plan's start date, or the creation date of the bout
   * when no plan is attached, so measurements from before the status moved to CAMP
   * are still charted.
   */
  private async loadWeightTrack(
    bout: BoutRow,
    ruleset: CompetitionRuleset,
    now: Date,
  ): Promise<WeightTrack> {
    const plan = bout.trainingPlanId
      ? await this.repo.findPlanById(bout.trainingPlanId)
      : undefined;
    const campStart = plan?.startDate ?? academyDateOf(bout.createdAt);
    const today = academyDateOf(now);
    const measurements = await this.repo.findWeightMeasurements(
      bout.fighterId,
      academyStartOfDay(campStart),
      now,
    );
    return computeWeightTrack({
      limitKg: Number(bout.catchweightKg ?? bout.weightLimitKg),
      acuteLossLimitPct: Number(bout.acuteLossLimitPct),
      acuteWindowDays: ruleset.acuteWindowDays,
      weighInDate: academyDateOf(bout.weighInAt),
      today,
      campStart,
      points: buildDailyWeightPoints(measurements, { from: campStart, to: today }),
    });
  }

  private async requireBout(id: string): Promise<BoutRow> {
    const bout = await this.repo.findBoutById(id);
    if (!bout) throw boutNotFound();
    return bout;
  }

  private async requireRuleset(id: string): Promise<CompetitionRuleset> {
    const ruleset = await this.repo.findRulesetById(id);
    if (!ruleset) throw rulesetNotFound();
    return ruleset;
  }

  private async resolveCoachId(
    actor: AuthenticatedUser,
    input: CreateBoutInput,
  ): Promise<string> {
    if (actor.role === USER.COACH) {
      const coachId = await this.repo.findActiveCoachIdByUserId(actor.id);
      if (!coachId) throw forbidden();
      return coachId;
    }
    if (!input.coachId) throw boutCoachRequired();
    const assigned = await this.repo.isCoachProfileAssignedToFighter(
      input.coachId,
      input.fighterId,
    );
    if (!assigned) throw boutCoachNotAssigned();
    return input.coachId;
  }

  private async resolveListScope(
    actor: AuthenticatedUser,
    fighterId: string | undefined,
  ): Promise<BoutScope> {
    switch (actor.role) {
      case USER.ADMIN:
        return { kind: 'ALL' };
      case USER.FIGHTER: {
        const own = await this.repo.findActiveFighterIdByUserId(actor.id);
        if (!own || (fighterId !== undefined && fighterId !== own)) throw forbidden();
        return { kind: 'FIGHTER', fighterId: own };
      }
      case USER.COACH:
        if (fighterId) await this.assertReadAccess(actor, fighterId);
        return { kind: 'COACH', userId: actor.id };
      case USER.DOCTOR:
        if (fighterId) await this.assertReadAccess(actor, fighterId);
        return { kind: 'DOCTOR', userId: actor.id };
      default:
        throw forbidden();
    }
  }

  /** Same rules as TrainingAccessService.assertFighterAccess, written against this module's repo. */
  private async assertReadAccess(
    actor: AuthenticatedUser,
    fighterId: string,
  ): Promise<void> {
    if (actor.role === USER.ADMIN) return;
    if (actor.role === USER.FIGHTER) {
      const own = await this.repo.findActiveFighterIdByUserId(actor.id);
      if (own !== fighterId) throw forbidden();
    } else if (actor.role === USER.COACH) {
      if (!(await this.repo.isCoachAssignedToFighter(actor.id, fighterId)))
        throw forbidden();
    } else if (actor.role === USER.DOCTOR) {
      if (!(await this.repo.isDoctorAssignedToFighter(actor.id, fighterId)))
        throw forbidden();
    } else {
      throw forbidden();
    }
  }

  /**
   * Writes are limited to ADMIN and the assigned COACH. Enforced here, not only by
   * route metadata, because an individually granted permission outranks role metadata.
   */
  private async assertWriteAccess(
    actor: AuthenticatedUser,
    fighterId: string,
  ): Promise<void> {
    if (actor.role === USER.ADMIN) return;
    if (actor.role !== USER.COACH) throw forbidden();
    if (!(await this.repo.isCoachAssignedToFighter(actor.id, fighterId)))
      throw forbidden();
  }
}

// ---------------------------------------------------------------------------
// Row -> response mappers
// ---------------------------------------------------------------------------

function toNumber(value: string | null): number | null {
  return value === null ? null : Number(value);
}

function toRulesetResponse(row: CompetitionRuleset): RulesetResponse {
  return {
    id: row.id,
    name: row.name,
    sport: row.sport,
    organizer: row.organizer,
    verified: row.verified,
    sourceNote: row.sourceNote,
    weightClasses: row.weightClasses,
    requirementTemplates: row.requirementTemplates,
    fightWeekDays: row.fightWeekDays,
    requirementsDueDays: row.requirementsDueDays,
    acuteWindowDays: row.acuteWindowDays,
    acuteLossLimitPctLong: Number(row.acuteLossLimitPctLong),
    acuteLossLimitPctShort: Number(row.acuteLossLimitPctShort),
    suspensionRules: row.suspensionRules,
    defaultBlockedSessionTypes: row.defaultBlockedSessionTypes,
    restDaysAfterBout: row.restDaysAfterBout,
  };
}

function toBoutSummary(row: BoutRow): BoutSummary {
  return {
    id: row.id,
    fighterId: row.fighterId,
    coachId: row.coachId,
    rulesetId: row.rulesetId,
    eventName: row.eventName,
    venue: row.venue,
    opponentName: row.opponentName,
    weightClassCode: row.weightClassCode,
    weightLimitKg: Number(row.weightLimitKg),
    acuteLossLimitPct: Number(row.acuteLossLimitPct),
    requirementsDueDays: row.requirementsDueDays,
    weighInAt: row.weighInAt.toISOString(),
    boutAt: row.boutAt.toISOString(),
    status: row.status,
    trainingPlanId: row.trainingPlanId,
    officialWeightKg: toNumber(row.officialWeightKg),
    madeWeight: row.madeWeight,
    catchweightKg: toNumber(row.catchweightKg),
    hydrationCheck: row.hydrationCheck,
    result: row.result,
    method: row.method,
    resultRound: row.resultRound,
    knockedDown: row.knockedDown,
    cancelReason: row.cancelReason,
    notes: row.notes,
    history: row.history,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toRequirementState(row: BoutRequirementRow) {
  return {
    code: row.code,
    label: row.label,
    required: row.required,
    status: row.status,
    validUntil: row.validUntil,
  };
}

function toRequirementResponse(row: BoutRequirementRow): RequirementResponse {
  return {
    code: row.code,
    label: row.label,
    required: row.required,
    status: row.status,
    issuedOn: row.issuedOn,
    validUntil: row.validUntil,
    validityDays: row.validityDays,
    source: row.source as RequirementResponse['source'],
    statusReason: row.statusReason,
    confirmedAt: row.confirmedAt ? row.confirmedAt.toISOString() : null,
  };
}
