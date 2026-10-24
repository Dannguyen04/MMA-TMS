import { Injectable } from '@nestjs/common';
import { forbidden } from '../shared/errors/access.error.js';
import type { AuthenticatedUser } from '../shared/models/auth-context.model.js';
import { USER } from '../shared/types/user.role.js';
import {
  collectTodoItems,
  type CoachTodoResponse,
  type TodoBoutContext,
} from './bouts-todo.model.js';
import {
  academyDateOf,
  academyStartOfDay,
  campStartOf,
  canEnterFightWeek,
  computeBoutWeightTrack,
  computeWeighInReminder,
  evaluateGate1,
  requirementsDueOn,
  type BoutStatus,
} from './bouts.model.js';
import { BoutsRepository, type BoutScope } from './bouts.repo.js';
import { toRequirementState } from './bouts.service.js';

const RUNNING_STATUSES: readonly BoutStatus[] = [
  'SCHEDULED',
  'CAMP',
  'FIGHT_WEEK',
  'WEIGHED_IN',
];

/** More running bouts than this is far beyond one coach; the card says so instead of paging. */
export const COACH_TODO_BOUT_LIMIT = 100;

@Injectable()
export class BoutsTodoService {
  constructor(private readonly repo: BoutsRepository) {}

  /**
   * The coach's "to-do" card. COACH sees assigned fighters, ADMIN the whole club;
   * every other role is refused here even if the route permission was granted.
   * Reads are batched (bouts, checklists, plans, rulesets, weights): no query per bout.
   */
  async getCoachTodo(actor: AuthenticatedUser): Promise<CoachTodoResponse> {
    const scope = this.resolveScope(actor);

    const now = new Date();
    const today = academyDateOf(now);
    const rows = await this.repo.listBouts({
      scope,
      statuses: RUNNING_STATUSES,
      limit: COACH_TODO_BOUT_LIMIT,
    });
    const truncated = rows.length > COACH_TODO_BOUT_LIMIT;
    const bouts = truncated ? rows.slice(0, COACH_TODO_BOUT_LIMIT) : rows;
    if (bouts.length === 0) return { items: [], truncated };

    const boutIds = bouts.map((bout) => bout.id);
    const fighterIds = [...new Set(bouts.map((bout) => bout.fighterId))];
    const planIds = [
      ...new Set(bouts.flatMap((bout) => (bout.trainingPlanId ? [bout.trainingPlanId] : []))),
    ];
    const [rulesets, requirementRows, plans] = await Promise.all([
      this.repo.listRulesets(),
      this.repo.listRequirementsForBouts(boutIds),
      this.repo.findPlansByIds(planIds),
    ]);
    const planStartById = new Map(plans.map((plan) => [plan.id, plan.startDate]));
    const rulesetById = new Map(rulesets.map((ruleset) => [ruleset.id, ruleset]));

    const earliest = bouts
      .map((bout) =>
        campStartOf(
          bout.trainingPlanId ? (planStartById.get(bout.trainingPlanId) ?? null) : null,
          bout.createdAt,
        ),
      )
      .reduce((a, b) => (a < b ? a : b));
    const measurements = await this.repo.findWeightMeasurementsForFighters(
      fighterIds,
      academyStartOfDay(earliest),
      now,
    );

    const contexts: TodoBoutContext[] = [];
    for (const bout of bouts) {
      const ruleset = rulesetById.get(bout.rulesetId);
      if (!ruleset) continue; // a bout whose ruleset was removed has nothing to judge against
      const requirements = requirementRows
        .filter((row) => row.boutId === bout.id)
        .map(toRequirementState);
      const gate1 = evaluateGate1(requirements, bout.boutAt);
      const track = computeBoutWeightTrack({
        status: bout.status,
        limitKg: Number(bout.catchweightKg ?? bout.weightLimitKg),
        acuteLossLimitPct: Number(bout.acuteLossLimitPct),
        acuteWindowDays: ruleset.acuteWindowDays,
        weighInAt: bout.weighInAt,
        createdAt: bout.createdAt,
        planStartDate: bout.trainingPlanId
          ? (planStartById.get(bout.trainingPlanId) ?? null)
          : null,
        measurements: measurements.filter((m) => m.fighterId === bout.fighterId),
        now,
      });
      contexts.push({
        boutId: bout.id,
        fighterId: bout.fighterId,
        eventName: bout.eventName,
        status: bout.status,
        boutAt: bout.boutAt,
        weighInAt: bout.weighInAt,
        today,
        requirementsOpen: gate1.missing.length + gate1.expiring.length,
        requirementsDueOn: requirementsDueOn(bout.weighInAt, bout.requirementsDueDays),
        canEnterFightWeek: canEnterFightWeek({
          status: bout.status,
          weighInAt: bout.weighInAt,
          fightWeekDays: ruleset.fightWeekDays,
          now,
          gate1,
        }),
        weightStatus: track.status,
        weightReminderLevel: computeWeighInReminder({
          status: bout.status,
          today,
          latestOn: track.latestOn,
        }).level,
        tacticsWithoutSessions: (bout.opponentAnalysis.tactics ?? []).filter(
          (tactic) => tactic.sessionIds.length === 0,
        ).length,
      });
    }

    return { items: collectTodoItems(contexts), truncated };
  }

  private resolveScope(actor: AuthenticatedUser): BoutScope {
    if (actor.role === USER.ADMIN) return { kind: 'ALL' };
    if (actor.role === USER.COACH) return { kind: 'COACH', userId: actor.id };
    throw forbidden();
  }
}
