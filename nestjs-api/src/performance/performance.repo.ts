import { Inject, Injectable } from '@nestjs/common';
import { and, eq, gt, isNull, lte, or, sql } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../database/database.module.js';
import {
  coachFighters,
  coaches,
  doctorFighters,
  fighters,
  sportsDoctors,
} from '../database/schema.js';
import { type PerformanceMetric, WEEK_MS } from './performance.model.js';

type MetricRow = {
  weekStart: Date | string;
  sessionsCompleted: number | string | null;
  trainingMinutes: number | string | null;
  avgRpe: number | string | null;
  jabCount: number | string | null;
  crossCount: number | string | null;
  hookCount: number | string | null;
  kickCount: number | string | null;
  jabScore: number | string | null;
  crossScore: number | string | null;
  hookScore: number | string | null;
  kickScore: number | string | null;
  avgPunchSpeed: number | string | null;
  avgKickSpeed: number | string | null;
  guardUptimePct: number | string | null;
  sessionScore: number | string | null;
};

function toNumber(value: number | string | null): number {
  return value === null ? 0 : Number(value);
}

@Injectable()
export class PerformanceRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async findActiveFighterIdByUserId(
    userId: string,
  ): Promise<string | undefined> {
    const [row] = await this.db
      .select({ id: fighters.id })
      .from(fighters)
      .where(
        and(
          eq(fighters.userId, userId),
          eq(fighters.isActive, true),
          isNull(fighters.deletedAt),
        ),
      )
      .limit(1);
    return row?.id;
  }

  async isCoachAssignedToFighter(userId: string, fighterId: string) {
    const now = new Date();
    const [row] = await this.db
      .select({ id: coachFighters.id })
      .from(coachFighters)
      .innerJoin(coaches, eq(coaches.id, coachFighters.coachId))
      .innerJoin(fighters, eq(fighters.id, coachFighters.fighterId))
      .where(
        and(
          eq(coaches.userId, userId),
          eq(coaches.isActive, true),
          isNull(coaches.deletedAt),
          eq(coachFighters.fighterId, fighterId),
          lte(coachFighters.startsAt, now),
          or(isNull(coachFighters.endsAt), gt(coachFighters.endsAt, now)),
          eq(fighters.isActive, true),
          isNull(fighters.deletedAt),
        ),
      )
      .limit(1);
    return Boolean(row);
  }

  async isDoctorAssignedToFighter(userId: string, fighterId: string) {
    const now = new Date();
    const [row] = await this.db
      .select({ id: doctorFighters.id })
      .from(doctorFighters)
      .innerJoin(sportsDoctors, eq(sportsDoctors.id, doctorFighters.doctorId))
      .innerJoin(fighters, eq(fighters.id, doctorFighters.fighterId))
      .where(
        and(
          eq(sportsDoctors.userId, userId),
          eq(sportsDoctors.isActive, true),
          isNull(sportsDoctors.deletedAt),
          eq(doctorFighters.fighterId, fighterId),
          lte(doctorFighters.startsAt, now),
          or(isNull(doctorFighters.endsAt), gt(doctorFighters.endsAt, now)),
          eq(fighters.isActive, true),
          isNull(fighters.deletedAt),
        ),
      )
      .limit(1);
    return Boolean(row);
  }

  async findHistory(
    fighterId: string,
    weeks: number,
  ): Promise<PerformanceMetric[]> {
    const cutoff = new Date(Date.now() - (weeks + 1) * WEEK_MS);
    const { rows } = await this.db.execute<MetricRow>(sql`
      WITH session_week AS (
        SELECT date_trunc('week', scheduled_at) AS week_start,
          count(*)::int AS sessions_completed,
          coalesce(sum(coalesce(actual_duration_sec, planned_duration_sec, 0)) / 60.0, 0) AS training_minutes,
          coalesce(avg(reported_rpe), 0) AS avg_rpe
        FROM public.training_sessions
        WHERE fighter_id = ${fighterId} AND status = 'COMPLETED' AND deleted_at IS NULL AND scheduled_at >= ${cutoff.toISOString()}
        GROUP BY 1
      ), event_week AS (
        SELECT date_trunc('week', event_at) AS week_start,
          count(*) FILTER (WHERE technique_type = 'JAB')::int AS jab_count,
          count(*) FILTER (WHERE technique_type = 'CROSS')::int AS cross_count,
          count(*) FILTER (WHERE technique_type::text LIKE '%HOOK%')::int AS hook_count,
          count(*) FILTER (WHERE technique_type::text LIKE '%KICK%' OR technique_type = 'FRONT_TEEP')::int AS kick_count,
          coalesce(avg(score) FILTER (WHERE technique_type = 'JAB'), 0) AS jab_score,
          coalesce(avg(score) FILTER (WHERE technique_type = 'CROSS'), 0) AS cross_score,
          coalesce(avg(score) FILTER (WHERE technique_type::text LIKE '%HOOK%'), 0) AS hook_score,
          coalesce(avg(score) FILTER (WHERE technique_type::text LIKE '%KICK%' OR technique_type = 'FRONT_TEEP'), 0) AS kick_score,
          coalesce(avg(peak_speed_norm) FILTER (WHERE technique_type IN ('JAB','CROSS','LEAD_HOOK','REAR_HOOK','LEAD_UPPERCUT','REAR_UPPERCUT')), 0) AS avg_punch_speed,
          coalesce(avg(peak_speed_norm) FILTER (WHERE technique_type::text LIKE '%KICK%' OR technique_type = 'FRONT_TEEP'), 0) AS avg_kick_speed,
          coalesce(avg(CASE WHEN guard_preserved THEN 100.0 ELSE 0.0 END), 0) AS guard_uptime_pct
        FROM public.technique_events
        WHERE fighter_id = ${fighterId} AND event_at >= ${cutoff.toISOString()}
        GROUP BY 1
      ), summary_week AS (
        SELECT date_trunc('week', created_at) AS week_start, coalesce(avg(avg_session_score), 0) AS session_score
        FROM public.session_summaries
        WHERE fighter_id = ${fighterId} AND created_at >= ${cutoff.toISOString()}
        GROUP BY 1
      ), weeks AS (
        SELECT week_start FROM session_week UNION SELECT week_start FROM event_week UNION SELECT week_start FROM summary_week
      )
      SELECT weeks.week_start AS "weekStart",
        sw.sessions_completed AS "sessionsCompleted", sw.training_minutes AS "trainingMinutes", sw.avg_rpe AS "avgRpe",
        ew.jab_count AS "jabCount", ew.cross_count AS "crossCount", ew.hook_count AS "hookCount", ew.kick_count AS "kickCount",
        ew.jab_score AS "jabScore", ew.cross_score AS "crossScore", ew.hook_score AS "hookScore", ew.kick_score AS "kickScore",
        ew.avg_punch_speed AS "avgPunchSpeed", ew.avg_kick_speed AS "avgKickSpeed", ew.guard_uptime_pct AS "guardUptimePct",
        mw.session_score AS "sessionScore"
      FROM weeks
      LEFT JOIN session_week sw USING (week_start)
      LEFT JOIN event_week ew USING (week_start)
      LEFT JOIN summary_week mw USING (week_start)
      ORDER BY weeks.week_start ASC
    `);

    return rows.slice(-weeks).map((row) => {
      const weekStart = new Date(row.weekStart).toISOString();
      const jab = toNumber(row.jabScore);
      const cross = toNumber(row.crossScore);
      const hook = toNumber(row.hookScore);
      const kick = toNumber(row.kickScore);
      const sessionScore = toNumber(row.sessionScore);
      const observed = [jab, cross, hook, kick].filter((value) => value > 0);
      const composite =
        sessionScore ||
        (observed.length > 0
          ? observed.reduce((sum, value) => sum + value, 0) / observed.length
          : 0);
      return {
        id: `${fighterId}:${weekStart.slice(0, 10)}`,
        fighterId,
        weekStart,
        scores: {
          jab,
          cross,
          hook,
          kick,
          combination: composite,
          footwork: composite,
          guard: toNumber(row.guardUptimePct),
          head_movement: composite,
        },
        strikeCounts: {
          jab: toNumber(row.jabCount),
          cross: toNumber(row.crossCount),
          hook: toNumber(row.hookCount),
          kick: toNumber(row.kickCount),
        },
        combinations: 0,
        sessionsCompleted: toNumber(row.sessionsCompleted),
        trainingMinutes: toNumber(row.trainingMinutes),
        avgRpe: toNumber(row.avgRpe),
        avgPunchSpeed: toNumber(row.avgPunchSpeed),
        avgKickSpeed: toNumber(row.avgKickSpeed),
        guardUptimePct: toNumber(row.guardUptimePct),
        headMovementsPerMin: 0,
      };
    });
  }
}
