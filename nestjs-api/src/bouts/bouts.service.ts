import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { BoutAiClient, AI_LIST_KEYS, anonymizeAiInput } from './bout-ai.client.js';
import { aiDecisionSchema, aiVideoInputSchema, aiKindSchema, type BoutAiKind } from './bout-analysis.model.js';
import type { BoutAiSuggestionRow } from '../database/schema.js';
import { boutAiAlreadyDecided, boutAiNoObservations } from './bouts.error.js';
import type {
  BoutHistoryEntry,
  BoutRequirementRow,
  BoutNutritionCheckinRow,
  BoutRow,
  CompetitionRuleset,
  SuspensionRow,
} from '../database/schema.js';
import { forbidden } from '../shared/errors/access.error.js';
import type { AuthenticatedUser } from '../shared/models/auth-context.model.js';
import { USER } from '../shared/types/user.role.js';
import { setAuditContext, type Transaction } from '../shared/utils/audit-context.util.js';
import {
  boutAnalysisInvalid,
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
  boutRoundsIncomplete,
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
  campStartOf,
  canTransition,
  classifyReadiness,
  computeAcuteLoss,
  computeBoutWeightTrack,
  computeWeighInReminder,
  computeWeightFeasibility,
  currentNutritionPhase,
  NUTRITION_PHASES,
  type NutritionCheckinInput,
  type NutritionCheckinResponse,
  type NutritionPlan,
  type NutritionPlanResponse,
  type UpdateNutritionPlanInput,
  daysToWeighIn,
  encodeBoutCursor,
  evaluateGate1,
  FEASIBILITY_WEIGHT_MAX_AGE_DAYS,
  fightWeekStartsOn,
  isFinalStatus,
  readinessQuerySchema,
  requirementsDueOn,
  resolveWeightClass,
  SCHEDULE_EDITABLE_STATUSES,
  weightFeasibilityWarnings,
  type AcuteLossResult,
  type BoutDetailResponse,
  type BoutListResponse,
  type BoutStatus,
  type BoutSummary,
  type CancelBoutInput,
  type CatchweightInput,
  type CreateBoutInput,
  type CreateBoutResponse,
  type CreateRequirementInput,
  type FeasibilityQuery,
  type FeasibilityResponse,
  type Gate1Result,
  type ListBoutsQuery,
  type ReadinessQuery,
  type ReadinessRow,
  type RecordResultInput,
  type RecordResultResponse,
  type RecordResultSuspension,
  type RequirementResponse,
  type RulesetResponse,
  type StartCampInput,
  type UpdateBoutInput,
  type UpdateRequirementInput,
  type WeighInBlock,
  type WeighInInput,
  type WeighInResponse,
  type WeightFeasibility,
  type WeightTrackResponse,
} from './bouts.model.js';
import {
  buildCornerCard,
  buildRoundAdvice,
  buildImprovementPoints,
  evaluateTactics,
  normalizeOpponentName,
  opponentAnalysisInputSchema,
  opponentReviewInputSchema,
  roundInputSchema,
  nextRoundPlanSchema,
  type OpponentAnalysis,
  type OpponentAnalysisInput,
  type OpponentReviewInput,
  type RoundInput,
} from './bout-analysis.model.js';
import { BoutsRepository, type BoutScope } from './bouts.repo.js';
import { isInForceOn, suggestSuspensions } from '../suspensions/suspensions.model.js';
import {
  suspensionDaysRequired,
  suspensionOverrideReasonRequired,
} from '../suspensions/suspensions.error.js';
import { SuspensionEffects } from '../suspensions/suspension.effects.js';
import { SuspensionsRepository } from '../suspensions/suspensions.repo.js';

@Injectable()
export class BoutsService {
  constructor(
    private readonly repo: BoutsRepository,
    private readonly suspensionsRepo: SuspensionsRepository,
    private readonly suspensionEffects: SuspensionEffects,
    private readonly ai?: BoutAiClient,
  ) {}

  async suggestAiTactics(actor: AuthenticatedUser, id: string, requestId: string) {
    return this.generateAiSuggestion(actor, id, 'PRE_BOUT_TACTICS', null, requestId);
  }

  async suggestAiRoundAdvice(actor: AuthenticatedUser, id: string, roundNo: number, requestId: string) {
    return this.generateAiSuggestion(actor, id, 'BETWEEN_ROUNDS', roundNo, requestId);
  }

  async suggestAiVideo(actor: AuthenticatedUser, id: string, input: { url: string; who: string }, requestId: string) {
    const parsed = aiVideoInputSchema.safeParse(input);
    if (!parsed.success) throw analysisValidationError();
    return this.generateAiSuggestion(actor, id, 'VIDEO_OBSERVATIONS', null, requestId, parsed.data);
  }

  private async generateAiSuggestion(actor: AuthenticatedUser, id: string, kind: BoutAiKind, roundNo: number | null, requestId: string, video?: { url: string; who: string }) {
    const bout = await this.requireBout(id);
    await this.assertWriteAccess(actor, bout.fighterId);
    const rounds = kind === 'BETWEEN_ROUNDS' ? await this.repo.listRounds(id) : [];
    const assertStatus = (current: BoutRow) => {
      if (kind === 'BETWEEN_ROUNDS') {
        this.assertCornerStatus(current);
        const lastRound = Math.max(0, ...rounds.map((r) => r.roundNo));
        if (roundNo === null || !Number.isInteger(roundNo) || roundNo < 2 ||
            current.scheduledRounds === null || roundNo > current.scheduledRounds || roundNo !== lastRound + 1)
          throw boutAnalysisInvalid('BOUT_ROUND_OUT_OF_RANGE');
      } else if (isFinalStatus(current.status)) throw boutNotEditable(current.status);
    };
    assertStatus(bout);
    const observations = bout.opponentAnalysis.observations ?? [];
    if (kind === 'PRE_BOUT_TACTICS' && !observations.length) throw boutAiNoObservations();
    const advice = kind === 'BETWEEN_ROUNDS'
      ? buildRoundAdvice(bout.opponentAnalysis, rounds, bout.scheduledRounds!) : null;
    const tactics = advice?.tactics ?? bout.opponentAnalysis.tactics ?? [];
    // Stable prompt-local references: database and analysis IDs never leave the server.
    const references = new Map<string, string>([
      ...observations.map((o, i) => [o.id, `o${i + 1}`] as [string, string]),
      ...tactics.map((t, i) => [t.id, `t${i + 1}`] as [string, string]),
    ]);
    const reverse = new Map([...references].map(([local, alias]) => [alias, local]));
    const alias = (value: unknown): unknown => {
      if (typeof value === 'string') return references.get(value) ?? value;
      if (Array.isArray(value)) return value.map(alias);
      if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [references.get(k) ?? k, alias(v)]));
      return value;
    };
    const { fighter, coach } = await this.repo.aiParticipantContext(bout.fighterId, bout.coachId);
    const participantNames = [bout.opponentName, ...(bout.opponentName?.split(/\s+/) ?? []), fighter?.firstName, fighter?.lastName,
      fighter && `${fighter.firstName} ${fighter.lastName}`, coach?.firstName, coach?.lastName,
      coach && `${coach.firstName} ${coach.lastName}`,
    ].filter((name): name is string => Boolean(name));
    const profile = bout.opponentAnalysis.profile;
    const input = anonymizeAiInput(alias(kind === 'VIDEO_OBSERVATIONS' ? {
      who: video!.who, subject: 'đối thủ',
    } : {
      scheduledRounds: bout.scheduledRounds, roundNo,
      fighter: { label: 'võ sĩ của ta', weightClass: bout.weightClassCode,
        stance: fighter?.stance, heightCm: fighter?.heightCm, reachCm: fighter?.reachCm },
      opponent: { label: 'đối thủ', opponentProfile: profile && {
        wins: profile.wins, losses: profile.losses, draws: profile.draws,
        stance: profile.stance, style: profile.style, heightCm: profile.heightCm, reachCm: profile.reachCm,
      } },
      observations: observations.map((o) => ({ id: o.id, kind: o.kind, text: o.text,
        confidence: o.confidence, evidenceTime: o.evidenceTime, evidenceNote: o.evidenceNote })),
      tactics: tactics.map((t) => ({ id: t.id, text: t.text, round: t.round,
        ...('observationIds' in t ? { observationIds: t.observationIds } : {}),
      })),
      ...(advice ? { advice, rounds: rounds.map((r) => ({
        roundNo: r.roundNo, ...Object.fromEntries(Object.keys(roundInputSchema.shape).map((key) => [key, r[key as keyof typeof r]])),
      })) } : {}),
    }), participantNames);
    if (!this.ai) throw new Error('BoutAiClient provider is required');
    const model = this.ai.model;
    // Include the local mapping only in the local hash, so cached references remain valid.
    const inputHash = createHash('sha256').update(JSON.stringify({ input, references: [...references], url: video?.url })).digest('hex');
    const cacheKey = { boutId: id, kind, roundNo, model, inputHash };
    const cached = await this.repo.findAiCache(cacheKey);
    if (cached) return { suggestion: toAiSuggestion(cached, true) };
    const started = Date.now();
    const result = await this.ai.generate(kind, input, video?.url);
    let items = result.ok ? result.items : [];
    if (kind === 'PRE_BOUT_TACTICS') items = items.filter((item) =>
      Array.isArray(item.observationIds) && item.observationIds.length > 0 &&
      item.observationIds.every((ref) => typeof ref === 'string' && observations.some((o) => references.get(o.id) === ref)) &&
      (item.round === null || (typeof item.round === 'number' && bout.scheduledRounds !== null && item.round <= bout.scheduledRounds)),
    ).map((item) => ({ ...item, observationIds: (item.observationIds as string[]).map((ref) => reverse.get(ref)!) }));
    if (kind === 'BETWEEN_ROUNDS') items = items.map(({ tacticId, ...item }) => ({
      ...item, ...(typeof tacticId === 'string' && tactics.some((t) => references.get(t.id) === tacticId) ? { tacticId: reverse.get(tacticId)! } : {}),
    }));
    // Give every displayed item a stable local ID for the coach's decision.
    items = items.slice(0, kind === 'VIDEO_OBSERVATIONS' ? 6 : 3).map((item, i) => ({ ...item, id: `ai${i + 1}` }));
    const errorCode = !result.ok ? result.error : !items.length ? 'EMPTY' as const : null;
    const output = { ...(items.length ? { [AI_LIST_KEYS[kind]]: items } : {}),
      ...(advice?.safety?.level === 'RED' ? { safety: 'RED' } : {}),
    };
    const row = await this.repo.transaction(async (tx) => {
      await setAuditContext(actor.authSubject, requestId, tx);
      const current = await this.repo.lockBoutById(id, tx);
      if (!current) throw boutNotFound();
      // A concurrent identical request may have finished while Gemini was running.
      const existing = await this.repo.findAiCache(cacheKey, tx);
      if (existing) return { row: existing, cached: true };
      return { row: await this.repo.insertAiSuggestion({ ...cacheKey, status: errorCode ? 'FAILED' : 'OK',
        errorCode, output, latencyMs: Date.now() - started, requestedById: actor.id }, tx), cached: false };
    });
    return { suggestion: toAiSuggestion(row.row, row.cached) };
  }

  async getAiSuggestions(actor: AuthenticatedUser, id: string, kind?: BoutAiKind) {
    const bout = await this.requireBout(id);
    await this.assertPrivateReadAccess(actor, bout);
    if (kind && !aiKindSchema.safeParse(kind).success) throw analysisValidationError();
    return { suggestions: (await this.repo.listAiSuggestions(id, kind)).map((row) => ({
      ...toAiSuggestion(row, false), decision: row.decision, acceptedItemIds: row.acceptedItemIds,
      decidedAt: row.decidedAt?.toISOString() ?? null,
    })) };
  }

  async decideAiSuggestion(actor: AuthenticatedUser, id: string, suggestionId: string, input: { decision: 'ACCEPTED' | 'PARTIAL' | 'REJECTED'; acceptedItemIds: string[] }, requestId: string) {
    const bout = await this.requireBout(id);
    await this.assertWriteAccess(actor, bout.fighterId);
    const parsed = aiDecisionSchema.safeParse(input);
    if (!parsed.success) throw analysisValidationError();
    return this.repo.transaction(async (tx) => {
      await setAuditContext(actor.authSubject, requestId, tx);
      const row = await this.repo.lockAiSuggestion(id, suggestionId, tx);
      if (!row) throw boutNotFound();
      if (row.decision !== null) throw boutAiAlreadyDecided();
      const list = row.output[AI_LIST_KEYS[row.kind]];
      const ids = new Set(Array.isArray(list) ? list.map((item: { id?: string }) => item.id) : []);
      if (parsed.data.acceptedItemIds.some((itemId) => !ids.has(itemId))) throw analysisValidationError();
      const updated = await this.repo.decideAiSuggestion(row.id, { ...parsed.data, decidedAt: new Date() }, tx);
      if (!updated) throw boutAiAlreadyDecided();
      return { suggestion: toAiSuggestion(updated, false) };
    });
  }

  // ---------------------------------------------------------------------------
  // Rulesets
  // ---------------------------------------------------------------------------

  async listRulesets(): Promise<RulesetResponse[]> {
    const rows = await this.repo.listRulesets();
    return rows.map(toRulesetResponse);
  }

  async getReadiness(
    actor: AuthenticatedUser,
    rawQuery: ReadinessQuery = {},
  ): Promise<ReadinessRow[]> {
    if (actor.role !== USER.COACH && actor.role !== USER.ADMIN) {
      throw forbidden();
    }
    const parsed = readinessQuerySchema.safeParse(rawQuery);
    if (!parsed.success) {
      throw new UnprocessableEntityException({
        statusCode: 422,
        error: 'Unprocessable Entity',
        code: 'VALIDATION_ERROR',
        message: 'Invalid readiness query parameters.',
      });
    }
    const query = parsed.data;
    const ruleset = query.rulesetId
      ? await this.requireRuleset(query.rulesetId)
      : undefined;

    const scope =
      actor.role === USER.ADMIN
        ? ({ kind: 'ALL' } as const)
        : ({ kind: 'COACH', userId: actor.id } as const);

    const fightersInScope = await this.repo.listActiveFightersInScope(scope);
    if (fightersInScope.length === 0) return [];

    const fighterIds = fightersInScope.map((f) => f.id);
    const now = new Date();
    const today = academyDateOf(now);

    const [suspensions, activeBouts, latestWeights] = await Promise.all([
      this.suspensionsRepo.findSuspensionsByFighterIds(fighterIds),
      this.repo.findActiveBoutsForFighters(fighterIds),
      this.repo.findLatestWeightsForFighters(fighterIds, now),
    ]);

    const suspensionsByFighter = new Map<string, SuspensionRow[]>();
    for (const s of suspensions) {
      const list = suspensionsByFighter.get(s.fighterId) ?? [];
      list.push(s);
      suspensionsByFighter.set(s.fighterId, list);
    }
    const activeBoutByFighter = new Map(
      activeBouts.map((b) => [b.fighterId, b]),
    );
    const latestWeightByFighter = new Map(
      latestWeights.map((w) => [
        w.fighterId,
        { kg: w.weightKg, date: academyDateOf(w.measuredAt) },
      ]),
    );

    return fightersInScope.map((fighter) =>
      classifyReadiness({
        fighterId: fighter.id,
        fighterName: `${fighter.firstName} ${fighter.lastName}`.trim(),
        today,
        suspensions: suspensionsByFighter.get(fighter.id) ?? [],
        activeBout: activeBoutByFighter.get(fighter.id) ?? null,
        latestWeight: latestWeightByFighter.get(fighter.id) ?? null,
        ...(query.boutOn !== undefined ? { boutOn: query.boutOn } : {}),
        ...(query.weightLimitKg !== undefined
          ? { weightLimitKg: query.weightLimitKg }
          : {}),
        ...(ruleset !== undefined ? { ruleset } : {}),
      }),
    );
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
    const detail = await this.buildDetail(bout);
    if (actor.role === USER.FIGHTER) {
      detail.opponentAnalysis = fighterAnalysis(bout.opponentAnalysis);
      const ids = [
        ...new Set(
          (bout.opponentAnalysis.tactics ?? []).flatMap((t) => t.sessionIds),
        ),
      ];
      detail.sessions = (
        await this.repo.findAnalysisSessions(ids, bout.fighterId)
      ).map((r) => ({
        ...r,
        scheduledAt: r.scheduledAt.toISOString(),
      }));
    }
    return detail;
  }

  async getWeightTrack(
    actor: AuthenticatedUser,
    id: string,
  ): Promise<WeightTrackResponse> {
    const bout = await this.requireBout(id);
    await this.assertReadAccess(actor, bout.fighterId);
    const ruleset = await this.requireRuleset(bout.rulesetId);
    return this.loadWeightTrack(bout, ruleset, new Date());
  }

  async putOpponentAnalysis(
    actor: AuthenticatedUser,
    id: string,
    input: OpponentAnalysisInput,
    requestId: string,
  ) {
    const parsed = opponentAnalysisInputSchema.safeParse(input);
    if (!parsed.success) throw analysisValidationError();
    const data = parsed.data;
    const observationIds = new Set(data.observations.map((o) => o.id));
    if (
      data.tactics.some(
        (t) =>
          !t.observationIds.length ||
          t.observationIds.some((id) => !observationIds.has(id)),
      )
    )
      throw boutAnalysisInvalid('OPPONENT_TACTIC_EVIDENCE_REQUIRED');
    return this.mutateAnalysis(actor, id, requestId, async (bout, tx) => {
      if (isFinalStatus(bout.status)) throw boutNotEditable(bout.status);
      const ids = [...new Set(data.tactics.flatMap((t) => t.sessionIds))];
      const sessions = await this.repo.findAnalysisSessions(
        ids,
        bout.fighterId,
        tx,
      );
      if (sessions.length !== ids.length)
        throw boutAnalysisInvalid('OPPONENT_SESSION_INVALID');
      const reviews = new Map(
        (bout.opponentAnalysis.tactics ?? []).map((t) => [t.id, t.review]),
      );
      return {
        ...data,
        tactics: data.tactics.map((t) => {
          const review = reviews.get(t.id);
          return { ...t, ...(review ? { review } : {}) };
        }),
      };
    });
  }

  async putOpponentReview(
    actor: AuthenticatedUser,
    id: string,
    input: OpponentReviewInput,
    requestId: string,
  ) {
    const parsed = opponentReviewInputSchema.safeParse(input);
    if (!parsed.success) throw analysisValidationError();
    return this.mutateAnalysis(actor, id, requestId, async (bout) => {
      if (bout.status !== 'COMPLETED') throw boutNotEditable(bout.status);
      const tactics = bout.opponentAnalysis.tactics ?? [];
      if (
        parsed.data.reviews.some(
          (r) => !tactics.some((t) => t.id === r.tacticId),
        )
      )
        throw boutAnalysisInvalid('OPPONENT_TACTIC_UNKNOWN');
      return {
        ...bout.opponentAnalysis,
        tactics: tactics.map((t) => {
          const r = parsed.data.reviews.find((r) => r.tacticId === t.id);
          return r
            ? {
                ...t,
                review: {
                  outcome: r.outcome,
                  note: r.note ?? null,
                  auto: false,
                },
              }
            : t;
        }),
      };
    });
  }

  private async mutateAnalysis(
    actor: AuthenticatedUser,
    id: string,
    requestId: string,
    change: (
      bout: BoutRow,
      tx: Parameters<Parameters<BoutsRepository['transaction']>[0]>[0],
    ) => Promise<OpponentAnalysis>,
  ) {
    const current = await this.requireBout(id);
    await this.assertWriteAccess(actor, current.fighterId);
    try {
      return await this.repo.transaction(async (tx) => {
        await setAuditContext(actor.authSubject, requestId, tx);
        const bout = await this.repo.lockBoutById(id, tx);
        if (!bout) throw boutNotFound();
        const analysis = {
          ...(await change(bout, tx)),
          updatedAt: new Date().toISOString(),
          updatedById: actor.id,
        };
        const updated = await this.repo.updateBout(
          id,
          { opponentAnalysis: analysis },
          { expectedStatus: bout.status },
          tx,
        );
        if (!updated) throw boutStateConflict();
        return {
          opponentAnalysis: analysis,
          tacticsWithoutSessions: (analysis.tactics ?? [])
            .filter((t) => !t.sessionIds.length)
            .map((t) => t.id),
        };
      });
    } catch (error) {
      throw mapBoutPersistenceError(error);
    }
  }

  async putRound(
    actor: AuthenticatedUser,
    id: string,
    roundNo: number,
    input: RoundInput,
    requestId: string,
  ) {
    const parsed = roundInputSchema.safeParse(input);
    if (!parsed.success) throw analysisValidationError();
    const current = await this.requireBout(id);
    await this.assertWriteAccess(actor, current.fighterId);
    try {
      const row = await this.repo.transaction(async (tx) => {
        await setAuditContext(actor.authSubject, requestId, tx);
        const bout = await this.repo.lockBoutById(id, tx);
        if (!bout) throw boutNotFound();
        this.assertCornerStatus(bout);
        if (bout.scheduledRounds === null)
          throw boutAnalysisInvalid('BOUT_ROUNDS_NOT_SET');
        if (
          !Number.isInteger(roundNo) ||
          roundNo < 1 ||
          roundNo > bout.scheduledRounds
        )
          throw boutAnalysisInvalid('BOUT_ROUND_OUT_OF_RANGE');
        const tactics = new Set(
          (bout.opponentAnalysis.tactics ?? []).map((t) => t.id),
        );
        const observations = new Set(
          (bout.opponentAnalysis.observations ?? []).map((o) => o.id),
        );
        const rounds = await this.repo.listRounds(id, tx);
        const previousAdded = rounds.filter((r) => r.roundNo < roundNo)
          .flatMap((r) => r.nextRoundPlan?.addedTactics ?? []);
        for (const t of previousAdded) tactics.add(t.id);
        const plan = parsed.data.nextRoundPlan;
        if (plan && roundNo === bout.scheduledRounds &&
          (plan.focusTacticIds.length || plan.addedTactics.length || plan.instructions.length))
          throw boutAnalysisInvalid('BOUT_NEXT_ROUND_PLAN_LAST_ROUND');
        const existingIds = new Set([...tactics, ...observations,
          ...rounds.filter((r) => r.roundNo !== roundNo)
            .flatMap((r) => (r.nextRoundPlan?.addedTactics ?? []).map((t) => t.id)),
        ]);
        for (const t of plan?.addedTactics ?? []) {
          if (existingIds.has(t.id) || t.observationIds.some((oid) => !observations.has(oid)))
            throw boutAnalysisInvalid('BOUT_ROUND_MARK_UNKNOWN');
          existingIds.add(t.id);
        }
        const planTactics = new Set([...tactics, ...(plan?.addedTactics ?? []).map((t) => t.id)]);
        if (plan?.focusTacticIds.some((tid) => !planTactics.has(tid)) ||
          plan?.instructions.some((instruction) => instruction.tacticId && !planTactics.has(instruction.tacticId)))
          throw boutAnalysisInvalid('BOUT_ROUND_MARK_UNKNOWN');
        if (
          Object.keys(parsed.data.tacticMarks ?? {}).some(
            (id) => !tactics.has(id),
          ) ||
          Object.keys(parsed.data.observationMarks ?? {}).some(
            (id) => !observations.has(id),
          )
        )
          throw boutAnalysisInvalid('BOUT_ROUND_MARK_UNKNOWN');
        return this.repo.upsertRound(
          { ...parsed.data, boutId: id, roundNo, recordedById: actor.id },
          tx,
        );
      });
      return toRoundResponse(row);
    } catch (error) {
      throw mapBoutPersistenceError(error);
    }
  }

  async getRounds(actor: AuthenticatedUser, id: string) {
    const bout = await this.requireBout(id);
    await this.assertPrivateReadAccess(actor, bout);
    const rounds = await this.repo.listRounds(id);
    return {
      scheduledRounds: bout.scheduledRounds,
      rounds: rounds.map(toRoundResponse),
      advice:
        rounds.length &&
        bout.scheduledRounds !== null &&
        rounds.length < bout.scheduledRounds
          ? buildRoundAdvice(
              bout.opponentAnalysis,
              rounds,
              bout.scheduledRounds,
            )
          : null,
    };
  }

  async getCornerCard(actor: AuthenticatedUser, id: string) {
    const bout = await this.requireBout(id);
    await this.assertPrivateReadAccess(actor, bout);
    this.assertCornerStatus(bout);
    return buildCornerCard(
      bout.opponentAnalysis,
      await this.repo.listRounds(id),
      await this.loadAcuteLoss(bout),
    );
  }

  async getReport(actor: AuthenticatedUser, id: string) {
    const bout = await this.requireBout(id);
    await this.assertPrivateReadAccess(actor, bout);
    if (bout.status !== 'COMPLETED') throw boutNotEditable(bout.status);
    const rounds = await this.repo.listRounds(id);
    const acuteLoss = await this.loadAcuteLoss(bout);
    const evaluation = evaluateTactics(bout.opponentAnalysis, rounds);
    return {
      result: {
        result: bout.result,
        method: bout.method,
        resultRound: bout.resultRound,
        knockedDown: bout.knockedDown,
      },
      tactics: evaluation.tactics.map((t) => ({
        ...t,
        outcome: rounds.length ? t.outcome : null,
        review:
          bout.opponentAnalysis.tactics?.find((source) => source.id === t.id)
            ?.review ?? null,
      })),
      observations: evaluation.observations,
      acuteLoss,
      improvementPoints: buildImprovementPoints(
        bout.opponentAnalysis,
        rounds,
        acuteLoss,
      ),
      roundsRecorded: rounds.length,
    };
  }

  async getResultPrefill(actor: AuthenticatedUser, id: string) {
    const bout = await this.requireBout(id);
    await this.assertWriteAccess(actor, bout.fighterId);
    if (bout.status !== 'WEIGHED_IN') throw boutNotEditable(bout.status);
    const rounds = await this.repo.listRounds(id);
    return {
      resultRound: rounds.length
        ? Math.max(...rounds.map((r) => r.roundNo))
        : null,
      knockedDown: rounds.length
        ? rounds.some((r) => r.knockdownsAgainst > 0)
        : null,
    };
  }

  private assertCornerStatus(bout: BoutRow) {
    if (bout.status !== 'WEIGHED_IN' && bout.status !== 'COMPLETED')
      throw boutNotEditable(bout.status);
  }

  private async assertPrivateReadAccess(
    actor: AuthenticatedUser,
    bout: BoutRow,
  ) {
    if (
      actor.role !== USER.COACH &&
      actor.role !== USER.DOCTOR &&
      actor.role !== USER.ADMIN
    )
      throw forbidden();
    await this.assertReadAccess(actor, bout.fighterId);
  }

  async getPriorContext(
    actor: AuthenticatedUser,
    query: { fighterId: string; opponentName: string },
  ) {
    // Resolve the exact same scope as listBouts; copy candidates may belong to other assigned fighters.
    await this.resolveListScope(actor, query.fighterId);
    const scope = await this.resolveListScope(actor, undefined);
    let cursor: string | undefined;
    let latest: BoutRow | undefined;
    let latestCompleted: BoutRow | undefined;
    do {
      const rows = await this.repo.listBouts({ scope, limit: 100, cursor });
      const page = rows.slice(0, 100);
      for (const row of page) {
        if (
          row.fighterId === query.fighterId &&
          row.status === 'COMPLETED' &&
          (!latestCompleted ||
            row.boutAt > latestCompleted.boutAt ||
            (row.boutAt.getTime() === latestCompleted.boutAt.getTime() &&
              row.id > latestCompleted.id))
        )
          latestCompleted = row;
        if (
          row.opponentName !== null &&
          normalizeOpponentName(row.opponentName) ===
            normalizeOpponentName(query.opponentName) &&
          (!latest ||
            row.boutAt > latest.boutAt ||
            (row.boutAt.getTime() === latest.boutAt.getTime() &&
              row.id > latest.id))
        )
          latest = row;
      }
      const last = page[page.length - 1];
      cursor =
        rows.length > 100 && last
          ? encodeBoutCursor({
              weighInAt: last.weighInAt.toISOString(),
              id: last.id,
            })
          : undefined;
    } while (cursor);
    const analysis = latest
      ? withoutReviews(latest.opponentAnalysis)
      : undefined;
    return {
      improvementPoints: latestCompleted
        ? buildImprovementPoints(
            latestCompleted.opponentAnalysis,
            await this.repo.listRounds(latestCompleted.id),
            await this.loadAcuteLoss(latestCompleted),
          )
        : null,
      copyableAnalysis:
        latest && analysis
          ? {
              boutId: latest.id,
              eventName: latest.eventName,
              opponentName: latest.opponentName,
              opponentAnalysis:
                actor.role === USER.FIGHTER
                  ? fighterAnalysis(analysis)
                  : analysis,
            }
          : null,
    };
  }

  // ---------------------------------------------------------------------------
  // Create and edit
  // ---------------------------------------------------------------------------

  async createBout(
    actor: AuthenticatedUser,
    input: CreateBoutInput,
    requestId: string,
  ): Promise<CreateBoutResponse> {
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
            scheduledRounds: input.scheduledRounds ?? null,
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
      const detail = await this.buildDetail(bout, ruleset);
      // R31: a warning only, never blocks saving the bout.
      const feasibility = await this.loadFeasibility(
        input.fighterId,
        {
          limitKg: weightClass.limitKg,
          acuteLossLimitPct,
          acuteWindowDays: ruleset.acuteWindowDays,
          weighInAt,
        },
        now,
      );
      const [activeBoutId, fighterSuspensions] = await Promise.all([
        this.repo.findActiveBoutIdForFighter(input.fighterId, bout.id),
        this.suspensionsRepo.findSuspensionsByFighterId(input.fighterId),
      ]);
      const warnings = [
        ...weightFeasibilityWarnings(feasibility),
        ...(activeBoutId ? [{ code: 'FIGHTER_ACTIVE_BOUT' as const }] : []),
        ...(fighterSuspensions.some((s) => isInForceOn(s, academyDateOf(boutAt)))
          ? [{ code: 'FIGHTER_SUSPENDED_PAST_BOUT_DATE' as const }]
          : []),
      ];
      return { ...detail, warnings };
    } catch (error) {
      throw mapBoutPersistenceError(error);
    }
  }

  /**
   * Read-only preview of the weight feasibility (R31) for the create form, with the
   * same access, ruleset and weight class rules as `createBout` but nothing saved.
   */
  async getFeasibility(
    actor: AuthenticatedUser,
    query: FeasibilityQuery,
  ): Promise<FeasibilityResponse> {
    await this.assertWriteAccess(actor, query.fighterId);

    const weighInAt = new Date(query.weighInAt);
    const boutAt = new Date(query.boutAt);
    if (weighInAt.getTime() >= boutAt.getTime())
      throw boutInvalidSchedule('WEIGH_IN_NOT_BEFORE_BOUT');
    if (!(await this.repo.isActiveFighter(query.fighterId)))
      throw boutFighterNotFound();
    const ruleset = await this.requireRuleset(query.rulesetId);
    const weightClass = resolveWeightClass(ruleset.weightClasses, {
      weightClassCode: query.weightClassCode,
      weightLimitKg: query.weightLimitKg,
    });
    if (!weightClass.ok) throw boutInvalidWeightClass(weightClass.reason);
    const acuteLossLimitPct = acuteLossLimitPctFor(weighInAt, boutAt, {
      long: Number(ruleset.acuteLossLimitPctLong),
      short: Number(ruleset.acuteLossLimitPctShort),
    });

    const feasibility = await this.loadFeasibility(
      query.fighterId,
      {
        limitKg: weightClass.limitKg,
        acuteLossLimitPct,
        acuteWindowDays: ruleset.acuteWindowDays,
        weighInAt,
      },
      new Date(),
    );
    return {
      ...feasibility,
      limitKg: weightClass.limitKg,
      acuteLossLimitPct,
      warnings: weightFeasibilityWarnings(feasibility),
    };
  }

  private async loadFeasibility(
    fighterId: string,
    target: {
      limitKg: number;
      acuteLossLimitPct: number;
      acuteWindowDays: number;
      weighInAt: Date;
    },
    now: Date,
  ): Promise<WeightFeasibility> {
    const today = academyDateOf(now);
    const from = addDaysToDate(today, -FEASIBILITY_WEIGHT_MAX_AGE_DAYS);
    const measurements = await this.repo.findWeightMeasurements(
      fighterId,
      academyStartOfDay(from),
      now,
    );
    const points = buildDailyWeightPoints(measurements, { from, to: today });
    return computeWeightFeasibility({
      limitKg: target.limitKg,
      acuteLossLimitPct: target.acuteLossLimitPct,
      acuteWindowDays: target.acuteWindowDays,
      today,
      weighInDate: academyDateOf(target.weighInAt),
      latest: points[points.length - 1] ?? null,
    });
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
    const touchesSchedule = scheduleKeys.some(
      (key) => input[key] !== undefined,
    );
    const touchesOther = (
      ['eventName', 'venue', 'opponentName', 'scheduledRounds'] as const
    ).some((key) => input[key] !== undefined);

    if (isFinalStatus(bout.status) && (touchesSchedule || touchesOther))
      throw boutNotEditable(bout.status);
    if (touchesSchedule && !SCHEDULE_EDITABLE_STATUSES.includes(bout.status))
      throw boutNotEditable(bout.status);

    const changes: Parameters<BoutsRepository['updateBout']>[1] = {};
    if (input.eventName !== undefined) changes.eventName = input.eventName;
    if (input.venue !== undefined) changes.venue = input.venue;
    if (input.opponentName !== undefined)
      changes.opponentName = input.opponentName;
    if (input.notes !== undefined) changes.notes = input.notes;
    if (input.scheduledRounds !== undefined)
      changes.scheduledRounds = input.scheduledRounds;
    if (input.requirementsDueDays !== undefined)
      changes.requirementsDueDays = input.requirementsDueDays;

    const datesChanged =
      input.weighInAt !== undefined || input.boutAt !== undefined;
    const classChanged =
      input.weightClassCode !== undefined || input.weightLimitKg !== undefined;

    let ruleset: CompetitionRuleset | undefined;
    if (datesChanged || classChanged)
      ruleset = await this.requireRuleset(bout.rulesetId);

    if (datesChanged && ruleset) {
      const weighInAt = input.weighInAt
        ? new Date(input.weighInAt)
        : bout.weighInAt;
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
        if (input.scheduledRounds !== undefined) {
          const locked = await this.repo.lockBoutById(bout.id, tx);
          if (!locked || locked.status !== bout.status)
            throw boutStateConflict();
          const rounds = await this.repo.listRounds(bout.id, tx);
          if (
            input.scheduledRounds !== null &&
            rounds.some((r) => r.roundNo > input.scheduledRounds!)
          )
            throw boutAnalysisInvalid('BOUT_ROUNDS_BELOW_RECORDED');
        }
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
    if (plan.fighterId !== bout.fighterId)
      throw boutInvalidPlan('FIGHTER_MISMATCH');
    if (plan.phase !== 'fight_camp')
      throw boutInvalidPlan('PHASE_NOT_FIGHT_CAMP');

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
    const gate1 = evaluateGate1(
      requirements.map(toRequirementState),
      bout.boutAt,
    );
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

    const isLocked =
      bout.status === 'FIGHT_WEEK' || bout.status === 'WEIGHED_IN';
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

    const isLocked =
      bout.status === 'FIGHT_WEEK' || bout.status === 'WEIGHED_IN';
    if (isLocked && !input.unlockReason) throw boutRequirementsLocked();

    const existing = await this.repo.findRequirement(bout.id, code);
    if (!existing) throw requirementNotFound();

    const status = input.status ?? existing.status;
    let issuedOn =
      input.issuedOn !== undefined ? input.issuedOn : existing.issuedOn;
    let validUntil =
      input.validUntil !== undefined ? input.validUntil : existing.validUntil;
    let statusReason =
      input.statusReason !== undefined
        ? input.statusReason
        : existing.statusReason;

    if (status === 'MISSING') {
      issuedOn = null;
      validUntil = null;
      statusReason = null;
    } else if (status === 'PROVIDED') {
      if (
        validUntil === null &&
        issuedOn !== null &&
        existing.validityDays !== null
      )
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
            ...(input.required !== undefined
              ? { required: input.required }
              : {}),
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

    const isLocked =
      bout.status === 'FIGHT_WEEK' || bout.status === 'WEIGHED_IN';
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
    const limit =
      bout.catchweightKg !== null
        ? Number(bout.catchweightKg)
        : Number(bout.weightLimitKg);
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
        overByPct = Math.round(((weightKg - limit) / limit) * 100 * 10) / 10;
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
          {
            expectedStatus: 'FIGHT_WEEK',
            ...(historyEntry ? { historyEntry } : {}),
          },
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
  ): Promise<RecordResultResponse> {
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

    const isKoOrTkoLoss =
      input.result === 'LOSS' && ['KO', 'TKO'].includes(input.method);
    if (isKoOrTkoLoss) {
      if (!input.lossOfConsciousness) {
        throw boutResultInvalid('CONSCIOUSNESS_REQUIRED');
      }
    } else {
      if (
        input.lossOfConsciousness !== undefined &&
        input.lossOfConsciousness !== null
      ) {
        throw boutResultInvalid('CONSCIOUSNESS_NOT_ALLOWED');
      }
    }

    const isTkoLoss = input.result === 'LOSS' && input.method === 'TKO';
    if (isTkoLoss) {
      if (
        input.stoppedByHeadStrike === undefined ||
        input.stoppedByHeadStrike === null
      ) {
        throw boutResultInvalid('HEAD_STRIKE_REQUIRED');
      }
    } else {
      if (
        input.stoppedByHeadStrike !== undefined &&
        input.stoppedByHeadStrike !== null
      ) {
        throw boutResultInvalid('HEAD_STRIKE_NOT_ALLOWED');
      }
    }

    const isKoDue = input.result === 'LOSS' && input.method === 'KO';
    const isTkoDue = isTkoLoss && input.stoppedByHeadStrike === true;
    const isSuspensionDue = isKoDue || isTkoDue;
    if (!isSuspensionDue) {
      if (input.suspensionDays !== undefined && input.suspensionDays !== null) {
        throw boutResultInvalid('SUSPENSION_DAYS_NOT_ALLOWED');
      }
      if (
        input.suspensionOverrideReason !== undefined &&
        input.suspensionOverrideReason !== null &&
        input.suspensionOverrideReason.trim().length > 0
      ) {
        throw boutResultInvalid('SUSPENSION_OVERRIDE_NOT_ALLOWED');
      }
    }

    const ruleset = await this.requireRuleset(bout.rulesetId);

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
      let createdSuspensions: RecordResultSuspension[] = [];
      let afterCommit: () => Promise<void> = async () => {};
      const updated = await this.repo.transaction(async (tx) => {
        await setAuditContext(actor.authSubject, requestId, tx);
        const locked = await this.repo.lockBoutById(bout.id, tx);
        if (!locked) throw boutNotFound();
        if (locked.status !== 'WEIGHED_IN') throw boutStateConflict();
        if (
          locked.scheduledRounds !== null &&
          input.resultRound !== undefined &&
          input.resultRound > locked.scheduledRounds
        ) {
          throw boutResultInvalid('ROUND_EXCEEDS_SCHEDULED');
        }
        const rounds = await this.repo.listRounds(bout.id, tx);
        if (
          input.method === 'DECISION' &&
          locked.scheduledRounds !== null &&
          rounds.length > 0 &&
          rounds.length < locked.scheduledRounds &&
          input.confirmIncompleteRounds !== true
        ) {
          throw boutRoundsIncomplete(rounds.length, locked.scheduledRounds);
        }
        if (rounds.length && locked.opponentAnalysis.tactics?.length) {
          const evaluation = evaluateTactics(locked.opponentAnalysis, rounds);
          changes.opponentAnalysis = {
            ...locked.opponentAnalysis,
            updatedAt: now.toISOString(),
            updatedById: actor.id,
            tactics: locked.opponentAnalysis.tactics.map((t) =>
              t.review
                ? t
                : {
                    ...t,
                    review: {
                      outcome: evaluation.tactics.find((e) => e.id === t.id)!
                        .outcome,
                      note: null,
                      auto: true,
                    },
                  },
            ),
          };
        }
        const updatedRow = await this.repo.updateBout(
          bout.id,
          changes,
          { expectedStatus: 'WEIGHED_IN', historyEntry },
          tx,
        );
        if (!updatedRow) throw boutStateConflict();

        const applied = await this.applyResultSuspensions(
          actor,
          bout,
          ruleset,
          input,
          today,
          tx,
        );

        createdSuspensions = applied.suspensions;
        afterCommit = applied.afterCommit;
        return updatedRow;
      });
      await afterCommit();

      const detail = await this.buildDetail(updated, ruleset);
      return {
        ...detail,
        suspensions: createdSuspensions,
      };
    } catch (error) {
      throw mapBoutPersistenceError(error);
    }
  }

  private async applyResultSuspensions(
    actor: AuthenticatedUser,
    bout: BoutRow,
    ruleset: CompetitionRuleset,
    input: RecordResultInput,
    today: string,
    tx: Transaction,
  ): Promise<{
    suspensions: RecordResultSuspension[];
    afterCommit: () => Promise<void>;
  }> {
    const priorSuspensions =
      await this.suspensionsRepo.findPriorKoTkoSuspensions(
        bout.fighterId,
        undefined,
        bout.id,
        tx,
      );

    const suggestion = suggestSuspensions({
      event: {
        result: input.result,
        method: input.method,
        lossOfConsciousness: input.lossOfConsciousness,
        stoppedByHeadStrike: input.stoppedByHeadStrike,
        knockedDown: input.knockedDown,
      },
      ruleset: {
        name: ruleset.name,
        suspensionRules: ruleset.suspensionRules,
        restDaysAfterBout: ruleset.restDaysAfterBout,
        defaultBlockedSessionTypes: ruleset.defaultBlockedSessionTypes,
      },
      today,
      boutDate: academyDateOf(bout.boutAt),
      priorKoTkoCount: priorSuspensions,
      coachInput: {
        suspensionDays: input.suspensionDays,
        suspensionOverrideReason: input.suspensionOverrideReason,
      },
    });

    if (!suggestion.ok) {
      if (suggestion.error === 'SUSPENSION_DAYS_REQUIRED') {
        throw suspensionDaysRequired();
      }
      if (suggestion.error === 'SUSPENSION_OVERRIDE_REASON_REQUIRED') {
        throw suspensionOverrideReasonRequired();
      }
      if (suggestion.error === 'SUSPENSION_DAYS_NOT_ALLOWED') {
        throw boutResultInvalid('SUSPENSION_DAYS_NOT_ALLOWED');
      }
      throw boutResultInvalid('SUSPENSION_OVERRIDE_NOT_ALLOWED');
    }

    const insertedRows: { row: SuspensionRow; explanation: string }[] = [];
    for (const s of suggestion.suspensions) {
      const row = await this.suspensionsRepo.insertSuspension(
        {
          fighterId: bout.fighterId,
          boutId: bout.id,
          reason: s.reason,
          startsOn: s.startsOn,
          endsOn: s.endsOn,
          lossOfConsciousness: s.lossOfConsciousness,
          suggestedDays: s.suggestedDays,
          overrideReason: s.overrideReason,
          blockedSessionTypes: [...s.blockedSessionTypes],
          requiresClearance: s.requiresClearance,
          createdById: actor.id,
          clearedAt: null,
          clearedById: null,
          clearanceNote: null,
        },
        tx,
      );
      insertedRows.push({ row, explanation: s.explanation });
    }
    const effects =
      insertedRows.length > 0
        ? await this.suspensionEffects.runOnCreated(
            insertedRows.map((item) => item.row),
            tx,
          )
        : {
            affectedSessions: [],
            affectedPlans: [],
            afterCommit: async () => {},
          };
    return {
      suspensions: insertedRows.map(({ row, explanation }) => ({
        id: row.id,
        reason: row.reason,
        startsOn: row.startsOn,
        endsOn: row.endsOn,
        requiresClearance: row.requiresClearance,
        suggestedDays: row.suggestedDays,
        explanation,
        affectedSessions: effects.affectedSessions,
        affectedPlans: effects.affectedPlans,
      })),
      afterCommit: effects.afterCommit,
    };
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

  private async loadAcuteLoss(
    bout: BoutRow,
    knownRuleset?: CompetitionRuleset,
    now = new Date(),
  ): Promise<AcuteLossResult | null> {
    if (bout.officialWeightKg === null) return null;
    const ruleset = knownRuleset ?? (await this.requireRuleset(bout.rulesetId));
    const windowStart = addDaysToDate(
      academyDateOf(bout.weighInAt),
      -ruleset.acuteWindowDays,
    );
    const measurements = await this.repo.findWeightMeasurements(
      bout.fighterId,
      academyStartOfDay(windowStart),
      now,
    );
    return computeAcuteLoss({
      officialWeightKg: Number(bout.officialWeightKg),
      limitPct: Number(bout.acuteLossLimitPct),
      acuteWindowDays: ruleset.acuteWindowDays,
      weighInDate: academyDateOf(bout.weighInAt),
      measurements,
    });
  }

  private async buildDetail(
    bout: BoutRow,
    knownRuleset?: CompetitionRuleset,
  ): Promise<BoutDetailResponse> {
    const now = new Date();
    const ruleset = knownRuleset ?? (await this.requireRuleset(bout.rulesetId));
    const requirementRows = await this.repo.listRequirements(bout.id);
    const gate1 = evaluateGate1(
      requirementRows.map(toRequirementState),
      bout.boutAt,
    );
    const track = await this.loadWeightTrack(bout, ruleset, now);
    const dueOn = requirementsDueOn(bout.weighInAt, bout.requirementsDueDays);

    const acuteLoss = await this.loadAcuteLoss(bout, ruleset, now);

    return {
      ...toBoutSummary(bout),
      nutritionPlan: (bout.nutritionPlan ?? {}) as NutritionPlan,
      currentNutritionPhase: currentNutritionPhase(bout.status),
      opponentAnalysis: bout.opponentAnalysis,
      tacticsWithoutSessions: (bout.opponentAnalysis.tactics ?? [])
        .filter((t) => !t.sessionIds.length)
        .map((t) => t.id),
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
      weightReminder: computeWeighInReminder({
        status: bout.status,
        today: academyDateOf(now),
        latestOn: track.latestOn,
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
  ): Promise<WeightTrackResponse> {
    const plan = bout.trainingPlanId
      ? await this.repo.findPlanById(bout.trainingPlanId)
      : undefined;
    const planStartDate = plan?.startDate ?? null;
    const [measurements, nutrition] = await Promise.all([
      this.repo.findWeightMeasurements(
        bout.fighterId,
        academyStartOfDay(campStartOf(planStartDate, bout.createdAt)),
        now,
      ),
      this.repo.findNutritionCheckinsForBout(bout.id),
    ]);
    const track = computeBoutWeightTrack({
      status: bout.status,
      limitKg: Number(bout.catchweightKg ?? bout.weightLimitKg),
      acuteLossLimitPct: Number(bout.acuteLossLimitPct),
      acuteWindowDays: ruleset.acuteWindowDays,
      weighInAt: bout.weighInAt,
      createdAt: bout.createdAt,
      planStartDate,
      measurements,
      now,
    });
    return {
      ...track,
      nutrition,
    };
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
        if (!own || (fighterId !== undefined && fighterId !== own))
          throw forbidden();
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

  async putNutritionPlan(
    actor: AuthenticatedUser,
    id: string,
    input: UpdateNutritionPlanInput,
    requestId: string,
    now = new Date(),
  ): Promise<NutritionPlanResponse> {
    const current = await this.requireBout(id);
    await this.assertWriteAccess(actor, current.fighterId);
    try {
      return await this.repo.transaction(async (tx) => {
        await setAuditContext(actor.authSubject, requestId, tx);
        const bout = await this.repo.lockBoutById(id, tx);
        if (!bout) throw boutNotFound();
        if (isFinalStatus(bout.status)) {
          throw boutNotEditable(bout.status);
        }
        const nowIso = now.toISOString();
        const currentPlan = (bout.nutritionPlan ?? {}) as NutritionPlan;
        const newPlan: NutritionPlan = {};
        for (const phase of NUTRITION_PHASES) {
          const item = input[phase];
          if (item) {
            const existing = currentPlan[phase];
            const isUnchanged =
              existing &&
              existing.text === item.text &&
              existing.author === item.author;
            newPlan[phase] = {
              text: item.text,
              author: item.author,
              updatedAt: isUnchanged ? existing.updatedAt : nowIso,
              updatedById: isUnchanged ? existing.updatedById : actor.id,
            };
          }
        }
        const updated = await this.repo.updateBout(
          id,
          { nutritionPlan: newPlan },
          { expectedStatus: bout.status },
          tx,
        );
        if (!updated) throw boutStateConflict();
        return { nutritionPlan: newPlan };
      });
    } catch (error) {
      throw mapBoutPersistenceError(error);
    }
  }

  async putNutritionCheckin(
    actor: AuthenticatedUser,
    id: string,
    date: string,
    input: NutritionCheckinInput,
    requestId: string,
  ): Promise<NutritionCheckinResponse> {
    const bout = await this.requireBout(id);
    await this.assertNutritionCheckinAccess(actor, bout.fighterId);

    try {
      return await this.repo.transaction(async (tx) => {
        await setAuditContext(actor.authSubject, requestId, tx);
        const locked = await this.repo.lockBoutById(id, tx);
        if (!locked) throw boutNotFound();
        const row = await this.repo.upsertNutritionCheckin(
          {
            boutId: locked.id,
            fighterId: locked.fighterId,
            academyDate: date,
            adherence: input.adherence,
            note: input.note ?? null,
            recordedById: actor.id,
          },
          tx,
        );
        return toNutritionCheckinResponse(row);
      });
    } catch (error) {
      throw mapBoutPersistenceError(error);
    }
  }

  private async assertNutritionCheckinAccess(
    actor: AuthenticatedUser,
    fighterId: string,
  ): Promise<void> {
    if (actor.role === USER.ADMIN) return;
    if (actor.role === USER.FIGHTER) {
      const own = await this.repo.findActiveFighterIdByUserId(actor.id);
      if (own !== fighterId) throw forbidden();
      return;
    }
    if (actor.role === USER.COACH) {
      if (!(await this.repo.isCoachAssignedToFighter(actor.id, fighterId)))
        throw forbidden();
      return;
    }
    throw forbidden();
  }

}

// ---------------------------------------------------------------------------
// Row -> response mappers
// ---------------------------------------------------------------------------

function toNumber(value: string | null): number | null {
  return value === null ? null : Number(value);
}

function toAiSuggestion(row: BoutAiSuggestionRow, cached: boolean) {
  return { id: row.id, kind: row.kind, roundNo: row.roundNo, status: row.status,
    errorCode: row.errorCode, model: row.model, output: row.output, cached,
    createdAt: row.createdAt.toISOString() };
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
    scheduledRounds: row.scheduledRounds,
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

export function toRequirementState(row: BoutRequirementRow) {
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

function analysisValidationError() {
  return new UnprocessableEntityException({
    statusCode: 422,
    error: 'Unprocessable Entity',
    code: 'VALIDATION_ERROR',
    message: 'Invalid analysis or round data.',
  });
}
function fighterAnalysis(analysis: OpponentAnalysis) {
  return {
    tactics: (analysis.tactics ?? []).map((t) => ({
      id: t.id,
      text: t.text,
      round: t.round,
      partnerBrief: t.partnerBrief ?? null,
      sessionIds: t.sessionIds,
    })),
  };
}
function withoutReviews(analysis: OpponentAnalysis): OpponentAnalysis {
  return {
    ...analysis,
    tactics: (analysis.tactics ?? []).map(({ review: _review, ...t }) => t),
  };
}
function toRoundResponse(
  row: Awaited<ReturnType<BoutsRepository['upsertRound']>>,
) {
  return {
    ...row,
    nextRoundPlan: nextRoundPlanSchema.parse(row.nextRoundPlan ?? {}),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toNutritionCheckinResponse(
  row: BoutNutritionCheckinRow,
): NutritionCheckinResponse {
  return {
    id: row.id,
    boutId: row.boutId,
    fighterId: row.fighterId,
    academyDate: row.academyDate,
    adherence: row.adherence,
    note: row.note,
    recordedById: row.recordedById,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
