import { addDaysToKey, dayKey } from "@/lib/format";

import { SESSION_INTENSITY_TIERS } from "./intensity-tiers";
import { SESSION_TYPES, type SessionType } from "./medical-contract";
import { pickPrimarySuspension } from "./suspension-rules";
import type { Suspension, TrainingSession } from "./types";

/**
 * T-048: what the fighter sees of a suspension on their own screens (read only). Pure functions over the suspensions
 * `GET /suspensions` returns and the fighter's sessions; the status and `gradedReturn` of each suspension are the
 * server's, computed for today, so nothing here reads the clock except `upcomingSessions`.
 */

type LiveFields = Pick<Suspension, "status" | "gradedReturn">;

/**
 * T-048 §2.1 (owner's option A, 2/11): suspensions that limit training now or soon. `active=true` drops graded return
 * and UPCOMING (`suspensions.repo.ts`), so the list is read whole and narrowed here, like the mobile `liveSuspensions`.
 */
export function isLiveSuspension(suspension: LiveFields): boolean {
    return (
        suspension.status === "UPCOMING" ||
        suspension.status === "ACTIVE" ||
        suspension.status === "AWAITING_CLEARANCE" ||
        (suspension.status === "ENDED" && suspension.gradedReturn !== null && suspension.gradedReturn !== undefined)
    );
}

export function liveSuspensions<T extends LiveFields>(items: readonly T[]): T[] {
    return items.filter(isLiveSuspension);
}

export interface FighterSuspensionPick<T> {
    /** The suspension the card describes. */
    main: T;
    /** How many other live suspensions there are ("và {n} đình chỉ khác"). */
    others: number;
}

/**
 * The suspension the card shows, by the rule of T-030 B1's 409 message (`pickPrimarySuspension`): one without graded
 * return first, then the latest `endsOn`. An UPCOMING suspension does not limit training yet, so it is shown only when
 * nothing is in force (as the mobile `strictestSuspension` does). Null when nothing is live.
 */
export function pickFighterSuspension<T extends Suspension>(items: readonly T[]): FighterSuspensionPick<T> | null {
    const live = liveSuspensions(items);
    const main = pickPrimarySuspension(live.filter((s) => s.status !== "UPCOMING")) ?? pickPrimarySuspension(live);
    return main ? { main, others: live.length - 1 } : null;
}

export type SuspensionHeadline =
    | { kind: "gradedReturn"; fullReturnOn: string }
    | { kind: "awaitingClearance" }
    | { kind: "active"; endsOn: string; clearanceAfter: boolean }
    | { kind: "upcoming"; startsOn: string; endsOn: string };

/** Which of the card's main sentences applies (T-048 §2.1 item 1; UPCOMING gets its own, "Sắp đình chỉ từ … đến …"). */
export function suspensionHeadline(
    suspension: Pick<Suspension, "status" | "gradedReturn" | "startsOn" | "endsOn" | "requiresClearance">,
): SuspensionHeadline {
    if (suspension.gradedReturn) return { kind: "gradedReturn", fullReturnOn: suspension.gradedReturn.fullReturnOn };
    if (suspension.status === "AWAITING_CLEARANCE") return { kind: "awaitingClearance" };
    if (suspension.status === "UPCOMING") return { kind: "upcoming", startsOn: suspension.startsOn, endsOn: suspension.endsOn };
    return { kind: "active", endsOn: suspension.endsOn, clearanceAfter: suspension.requiresClearance };
}

/**
 * The highest tier the fighter may train at under this suspension. In graded return the day's ceiling decides: the
 * record's `maxAllowedTier` still describes the suspension that ended.
 */
export function suspensionTierToday(suspension: Pick<Suspension, "maxAllowedTier" | "gradedReturn">): number {
    return suspension.gradedReturn ? suspension.gradedReturn.ceiling : suspension.maxAllowedTier;
}

/** `IntensityLadder` props for a suspension, as the coach's suspensions page draws them (T-030 B). */
export function suspensionLadder(suspension: Pick<Suspension, "maxAllowedTier" | "gradedReturn">): { maxAllowedTier: number; ceiling?: 3 | 4 } {
    return suspension.gradedReturn
        ? { maxAllowedTier: 5, ceiling: suspension.gradedReturn.ceiling }
        : { maxAllowedTier: suspension.maxAllowedTier };
}

/** Session types at or under `tier`, lightest first ("Được tập: hồi phục, vật lý trị liệu" for tier 1). */
export function sessionTypesUpToTier(tier: number): SessionType[] {
    return SESSION_TYPES.filter((type) => SESSION_INTENSITY_TIERS[type] <= tier).sort(
        (a, b) => SESSION_INTENSITY_TIERS[a] - SESSION_INTENSITY_TIERS[b],
    );
}

/* ─── Sessions waiting to be rescheduled ──────────────────────────────────── */

export interface WeekSessionTally {
    /** Sessions still on the plan: completed, missed and to go. Neither cancelled nor pending. */
    planned: number;
    completed: number;
    missed: number;
    toGo: number;
    /** Sessions a suspension moved to `pending`: the coach reschedules them ("Chờ xếp lại"). */
    pending: number;
}

/**
 * The week's totals for the fighter's Today page. A pending session is its own count, outside "planned" and "to go",
 * so `completed + missed + toGo + pending` is every session of the week that wasn't cancelled (T-048 F2).
 */
export function weekSessionTally(sessions: readonly Pick<TrainingSession, "status">[]): WeekSessionTally {
    const tally: WeekSessionTally = { planned: 0, completed: 0, missed: 0, toGo: 0, pending: 0 };
    for (const { status } of sessions) {
        if (status === "cancelled") continue;
        if (status === "pending") {
            tally.pending += 1;
            continue;
        }
        tally.planned += 1;
        if (status === "completed") tally.completed += 1;
        else if (status === "missed") tally.missed += 1;
        else tally.toGo += 1;
    }
    return tally;
}

/** Pending sessions this many days ahead (today included) are listed in full on the training page (T-048 F1). */
export const PENDING_WINDOW_DAYS = 7;

/**
 * The next sessions to list, soonest first: the next `limit` scheduled or under way from `now`, plus every pending
 * session of the next {@link PENDING_WINDOW_DAYS} days, which takes no slot from them (T-048 F1: the fighter sees each
 * session the coach still has to move). A pending session keeps its old time until then, so one earlier today shows.
 */
export function upcomingSessions<T extends Pick<TrainingSession, "status" | "scheduledAt">>(sessions: readonly T[], now: string, limit: number): T[] {
    const today = dayKey(now);
    const windowEnd = addDaysToKey(today, PENDING_WINDOW_DAYS);
    const soonest = (a: T, b: T) => a.scheduledAt.localeCompare(b.scheduledAt);
    const scheduled = sessions
        .filter((session) => (session.status === "scheduled" || session.status === "in_progress") && session.scheduledAt >= now)
        .sort(soonest)
        .slice(0, limit);
    const pending = sessions.filter((session) => {
        if (session.status !== "pending") return false;
        const day = dayKey(session.scheduledAt);
        return day >= today && day < windowEnd;
    });
    return [...scheduled, ...pending].sort(soonest);
}
