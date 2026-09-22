import { Injectable } from '@nestjs/common';
import { forbidden } from '../shared/errors/access.error.js';
import type { AuthenticatedUser } from '../shared/models/auth-context.model.js';
import { USER } from '../shared/types/user.role.js';
import {
  DEFAULT_HISTORY_WEEKS,
  type PerformanceMetric,
  Technique,
  type TechniqueType,
  WEEK_MS,
} from './performance.model.js';
import { PerformanceRepository } from './performance.repo.js';

const techniques = Technique.options;
const strikeTechniques = ['jab', 'cross', 'hook', 'kick'] as const;
type StrikeTechnique = (typeof strikeTechniques)[number];
const weights: Record<TechniqueType, number> = {
  jab: 0.14,
  cross: 0.14,
  hook: 0.12,
  kick: 0.12,
  combination: 0.14,
  footwork: 0.12,
  guard: 0.12,
  head_movement: 0.1,
};

function round(value: number) {
  return Math.round(value * 10) / 10;
}
function average(values: number[]) {
  return values.length === 0
    ? 0
    : values.reduce((sum, value) => sum + value, 0) / values.length;
}
function overall(metric: PerformanceMetric) {
  return round(
    techniques.reduce(
      (sum, technique) => sum + metric.scores[technique] * weights[technique],
      0,
    ),
  );
}
function completeWeek(weekStart: string) {
  return Date.parse(weekStart) + WEEK_MS <= Date.now();
}
function isStrikeTechnique(
  technique: TechniqueType,
): technique is StrikeTechnique {
  return (strikeTechniques as readonly TechniqueType[]).includes(technique);
}

@Injectable()
export class PerformanceService {
  constructor(private readonly repo: PerformanceRepository) {}

  private async assertAccess(actor: AuthenticatedUser, fighterId: string) {
    if (
      actor.role === USER.FIGHTER &&
      (await this.repo.findActiveFighterIdByUserId(actor.id)) !== fighterId
    )
      throw forbidden();
    if (
      actor.role === USER.COACH &&
      !(await this.repo.isCoachAssignedToFighter(actor.id, fighterId))
    )
      throw forbidden();
    if (
      actor.role === USER.DOCTOR &&
      !(await this.repo.isDoctorAssignedToFighter(actor.id, fighterId))
    )
      throw forbidden();
  }

  async getHistory(
    actor: AuthenticatedUser,
    fighterId: string,
    weeks = DEFAULT_HISTORY_WEEKS,
  ) {
    await this.assertAccess(actor, fighterId);
    return this.repo.findHistory(fighterId, weeks);
  }

  private summarize(history: PerformanceMetric[]) {
    if (history.length === 0) return null;
    let index = history.findLastIndex((metric) =>
      completeWeek(metric.weekStart),
    );
    if (index < 0) index = history.length - 1;
    const latest = history[index];
    const earlier = history.slice(Math.max(0, index - 4), index);
    const baseline = Object.fromEntries(
      techniques.map((technique) => [
        technique,
        earlier.length > 0
          ? average(earlier.map((metric) => metric.scores[technique]))
          : latest.scores[technique],
      ]),
    ) as Record<TechniqueType, number>;
    const deltas = Object.fromEntries(
      techniques.map((technique) => [
        technique,
        round(latest.scores[technique] - baseline[technique]),
      ]),
    ) as Record<TechniqueType, number>;
    const overallScore = overall(latest);
    const baselineMetric = { ...latest, scores: baseline };
    const overallDelta = round(overallScore - overall(baselineMetric));
    const ranked = [...techniques].sort(
      (left, right) => latest.scores[right] - latest.scores[left],
    );
    return {
      latest,
      previous: index > 0 ? history[index - 1] : null,
      overall: overallScore,
      overallDelta,
      deltas,
      comparisonWeeks: earlier.length,
      strongest: ranked[0],
      weakest: ranked[ranked.length - 1],
      trend:
        overallDelta >= 1
          ? ('improving' as const)
          : overallDelta <= -1
            ? ('declining' as const)
            : ('steady' as const),
    };
  }

  async getSummary(actor: AuthenticatedUser, fighterId: string) {
    return this.summarize(await this.getHistory(actor, fighterId));
  }

  async getTechnique(
    actor: AuthenticatedUser,
    fighterId: string,
    technique: TechniqueType,
  ) {
    const history = await this.getHistory(actor, fighterId);
    const summary = this.summarize(history);
    if (!summary) return null;
    const relatedCounts = isStrikeTechnique(technique)
      ? history.map((metric) => ({
          weekStart: metric.weekStart,
          value: metric.strikeCounts[technique],
        }))
      : technique === 'combination'
        ? history.map((metric) => ({
            weekStart: metric.weekStart,
            value: metric.combinations,
          }))
        : null;
    const speedSeries = isStrikeTechnique(technique)
      ? {
          kind: technique === 'kick' ? ('kick' as const) : ('punch' as const),
          points: history.map((metric) => ({
            weekStart: metric.weekStart,
            value:
              (technique === 'kick'
                ? metric.avgKickSpeed
                : metric.avgPunchSpeed) || null,
          })),
        }
      : null;
    const rateSeries =
      technique === 'guard'
        ? {
            metric: 'guardUptimePct' as const,
            points: history.map((item) => ({
              weekStart: item.weekStart,
              value: item.guardUptimePct || null,
            })),
          }
        : technique === 'head_movement'
          ? {
              metric: 'headMovementsPerMin' as const,
              points: history.map((item) => ({
                weekStart: item.weekStart,
                value: item.headMovementsPerMin || null,
              })),
            }
          : null;
    return {
      technique,
      history: history.map((metric) => ({
        weekStart: metric.weekStart,
        score: metric.scores[technique],
      })),
      latestScore: summary.latest.scores[technique],
      change4w: summary.deltas[technique],
      relatedCounts,
      speedSeries,
      rateSeries,
      findings: [],
    };
  }

  async getTeam(actor: AuthenticatedUser, fighterIds: string[]) {
    const summaries = await Promise.all(
      fighterIds.map(async (fighterId) => ({
        fighterId,
        summary: await this.getSummary(actor, fighterId),
      })),
    );
    return summaries
      .flatMap(({ fighterId, summary }) =>
        summary
          ? [
              {
                fighterId,
                overall: summary.overall,
                overallDelta: summary.overallDelta,
                scores: summary.latest.scores,
                trainingMinutes: summary.latest.trainingMinutes,
                sessionsCompleted: summary.latest.sessionsCompleted,
                trend: summary.trend,
              },
            ]
          : [],
      )
      .sort((left, right) => right.overall - left.overall);
  }

  async getWeeklyVolume(
    actor: AuthenticatedUser,
    fighterIds: string[],
    weeks: number,
  ) {
    const histories = await Promise.all(
      fighterIds.map((fighterId) => this.getHistory(actor, fighterId, weeks)),
    );
    const grouped = new Map<string, PerformanceMetric[]>();
    for (const metric of histories.flat())
      grouped.set(metric.weekStart, [
        ...(grouped.get(metric.weekStart) ?? []),
        metric,
      ]);
    return [...grouped.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .slice(-weeks)
      .map(([weekStart, metrics]) => {
        const sessions = metrics.reduce(
          (sum, metric) => sum + metric.sessionsCompleted,
          0,
        );
        return {
          weekStart,
          complete: completeWeek(weekStart),
          fighters: metrics.length,
          sessionsCompleted: sessions,
          trainingMinutes: metrics.reduce(
            (sum, metric) => sum + metric.trainingMinutes,
            0,
          ),
          strikes: metrics.reduce(
            (sum, metric) =>
              sum +
              Object.values(metric.strikeCounts).reduce(
                (count, value) => count + value,
                0,
              ),
            0,
          ),
          combinations: metrics.reduce(
            (sum, metric) => sum + metric.combinations,
            0,
          ),
          avgRpe:
            sessions === 0
              ? 0
              : round(
                  metrics.reduce(
                    (sum, metric) =>
                      sum + metric.avgRpe * metric.sessionsCompleted,
                    0,
                  ) / sessions,
                ),
        };
      });
  }
}
