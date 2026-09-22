import "server-only";

import { cache } from "react";

import { accessibleFighterIds, requireFighterAccess } from "@/lib/auth/access";
import { clearanceDaysRemaining, clearanceState, currentClearance, type ClearanceConflict, type ClearanceState } from "@/lib/domain/rules";
import type { Fighter, MedicalClearance, TrainingSession, User } from "@/lib/domain/types";
import { DAY_MS } from "@/lib/format";
import { listClearances } from "@/lib/services/medical";
import { listFighters } from "@/lib/services/people";
import { getPerformanceHistory, getTeamPerformance, overallScore, type TeamPerformanceRow } from "@/lib/services/performance";
import { getUpcomingSessions, loadSessionClearanceConflicts } from "@/lib/services/training";
import { completeWeeks } from "./dashboard-utils";

/** How far ahead upcoming sessions are checked against Medical Clearance. */
export const SESSION_HORIZON_DAYS = 14;
const TREND_WEEKS = 8;

export interface SessionCheck {
    session: TrainingSession;
    conflicts: ClearanceConflict[];
}

export interface RosterEntry {
    fighter: Fighter;
    /** The clearance governing training (the revoked record when a revocation is the latest decision). */
    clearance: MedicalClearance | null;
    clearanceState: ClearanceState;
    revoked: boolean;
    /** Days until the clearance lapses; null when there is none, it is open-ended or it was revoked. */
    daysRemaining: number | null;
    performance: TeamPerformanceRow | null;
    /** False until there is an earlier complete week to compare the latest one with. */
    hasComparison: boolean;
    /** Weekly overall scores of complete weeks, oldest first. */
    overallSeries: number[];
    nextSession: TrainingSession | null;
    /** Scheduled or running sessions in the next {@link SESSION_HORIZON_DAYS} days, each checked against Medical Clearance. */
    upcoming: SessionCheck[];
}

export interface RosterOptions {
    /** Fighters to build entries for, when the caller already has (or is fetching) them. Defaults to `listFighters(user)`. */
    fighters?: Fighter[] | Promise<Fighter[]>;
}

/**
 * Fighter ids in the user's scope, available straight away so per-fighter reads can start alongside the
 * fighter list. Only an unrestricted scope ("all") waits for the list.
 */
export async function scopedFighterIds(user: User, fighters: Fighter[] | Promise<Fighter[]>): Promise<string[]> {
    const scope = accessibleFighterIds(user);
    return scope === "all" ? (await fighters).map((fighter) => fighter.id) : scope;
}

/**
 * Roster view model for coach screens: resolved Medical Clearance, performance trend and upcoming
 * sessions with their clearance conflicts. Summary level only — never clinical notes. The fighter list
 * and every per-fighter read run in one parallel stage; entries follow the order of the fighter list.
 */
export async function loadRoster(user: User, now: string, options: RosterOptions = {}): Promise<RosterEntry[]> {
    const fighters = options.fighters ?? listFighters(user);
    const ids = Array.isArray(fighters) ? Promise.resolve(fighters.map((fighter) => fighter.id)) : scopedFighterIds(user, fighters);
    return buildRoster(fighters, ids, now);
}

/**
 * One fighter's roster entry for the coach profile; not-found when the coach can't access the fighter.
 * Cached per request, so the profile layout and page share a single set of reads.
 */
export const loadRosterEntry = cache(async (user: User, fighterId: string): Promise<RosterEntry> => {
    const fighter = await requireFighterAccess(user, fighterId);
    const [entry] = await loadRoster(user, new Date().toISOString(), { fighters: [fighter] });
    return entry;
});

async function buildRoster(fightersInput: Fighter[] | Promise<Fighter[]>, idsInput: Promise<string[]>, now: string): Promise<RosterEntry[]> {
    const [fighters, clearances, team, upcoming, histories] = await Promise.all([
        fightersInput,
        idsInput.then((ids) => (ids.length === 0 ? [] : listClearances({ fighterIds: ids }))),
        idsInput.then((ids) => (ids.length === 0 ? [] : getTeamPerformance(ids))),
        idsInput.then((ids) => (ids.length === 0 ? [] : getUpcomingSessions(ids, Number.POSITIVE_INFINITY))),
        idsInput.then(async (ids) => new Map(await Promise.all(ids.map(async (id) => [id, await getPerformanceHistory(id, TREND_WEEKS + 1)] as const)))),
    ]);
    const horizon = Date.parse(now) + SESSION_HORIZON_DAYS * DAY_MS;

    return Promise.all(fighters.map(async (fighter) => {
        const clearance = currentClearance(clearances, fighter.id);
        const revoked = clearance?.status === "revoked";
        const weeks = completeWeeks(histories.get(fighter.id) ?? [], now).slice(-TREND_WEEKS);
        const own = upcoming.filter((session) => session.fighterId === fighter.id);
        return {
            fighter,
            clearance,
            clearanceState: clearanceState(clearance, now),
            revoked,
            daysRemaining: clearance && !revoked ? clearanceDaysRemaining(clearance, now) : null,
            performance: team.find((row) => row.fighterId === fighter.id) ?? null,
            hasComparison: weeks.length > 1,
            overallSeries: weeks.map((week) => overallScore(week.scores)),
            nextSession: own[0] ?? null,
            upcoming: await Promise.all(
                own
                    .filter((session) => Date.parse(session.scheduledAt) <= horizon)
                    .map(async (session) => ({ session, conflicts: await loadSessionClearanceConflicts(session) })),
            ),
        };
    }));
}

/** Sessions whose conflicts include at least one of the given severity. */
export function sessionsWith(checks: SessionCheck[], severity: ClearanceConflict["severity"]): SessionCheck[] {
    return checks.filter((check) => check.conflicts.some((conflict) => conflict.severity === severity));
}
