import "server-only";

import type { Goal, GoalStatus, Technique, User } from "@/lib/domain/types";
import { dayKey, daysBetween, formatDate } from "@/lib/format";
import { db, newId, nowIso, simulateLatency } from "@/lib/mocks/db";
import { routes } from "@/lib/routes";
import { recordAudit } from "./audit";
import { notifyUsers, staffUserIdsForFighter } from "./notifications";

/** Below this many days of data a trend is not meaningful, so goals stay "on track". */
const MIN_TREND_DAYS = 7;

const STATUS_ORDER: GoalStatus[] = ["at_risk", "on_track", "achieved", "missed"];

function fighterName(fighterId: string): string {
    return db().fighters.find((f) => f.id === fighterId)?.name ?? "Unknown fighter";
}

/** "68%", "7.9 m/s". */
function withUnit(value: number, unit: string): string {
    return unit === "%" ? `${value}%` : `${value} ${unit}`;
}

function goalLabel(goal: Pick<Goal, "fighterId" | "title">): string {
    return `${fighterName(goal.fighterId)} — ${goal.title}`;
}

/** Fighter's user id(s) minus the actor. */
function fighterRecipients(fighterId: string, actor: User): string[] {
    return staffUserIdsForFighter(fighterId, ["fighter"]).filter((id) => id !== actor.id);
}

function hasReachedTarget(goal: Pick<Goal, "current" | "target" | "lowerIsBetter">): boolean {
    return goal.lowerIsBetter ? goal.current <= goal.target : goal.current >= goal.target;
}

/**
 * Achieved when the target is reached; missed when the due date has passed without it; otherwise the
 * average daily rate since the start is projected to the due date — at risk when it falls short.
 */
function projectStatus(
    goal: Pick<Goal, "baseline" | "target" | "current" | "lowerIsBetter" | "startDate" | "dueDate">,
    now: string,
): GoalStatus {
    if (hasReachedTarget(goal)) return "achieved";
    const daysLeft = daysBetween(now, goal.dueDate);
    if (daysLeft < 0) return "missed";
    const elapsed = daysBetween(goal.startDate, now);
    if (elapsed < MIN_TREND_DAYS) return "on_track";
    const projected = goal.current + ((goal.current - goal.baseline) / elapsed) * daysLeft;
    return hasReachedTarget({ ...goal, current: projected }) ? "on_track" : "at_risk";
}

/* ─── Reads ───────────────────────────────────────────────────────────────── */

export interface GoalFilter {
    /** Fighters the viewer may see (from `accessibleFighterIds`). Omit for all. */
    fighterIds?: string[] | "all";
    coachId?: string;
    status?: GoalStatus | GoalStatus[];
    technique?: Technique;
}

/** Goals ordered by urgency (at risk first), then by due date. */
export async function listGoals(filter: GoalFilter = {}): Promise<Goal[]> {
    await simulateLatency();
    const statuses = filter.status === undefined ? null : Array.isArray(filter.status) ? filter.status : [filter.status];
    return db()
        .goals.filter(
            (g) =>
                (filter.fighterIds === undefined || filter.fighterIds === "all" || filter.fighterIds.includes(g.fighterId)) &&
                (!filter.coachId || g.coachId === filter.coachId) &&
                (!statuses || statuses.includes(g.status)) &&
                (!filter.technique || g.technique === filter.technique),
        )
        .sort(
            (a, b) =>
                STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status) || a.dueDate.localeCompare(b.dueDate),
        );
}

/** A single goal, or null when it doesn't exist. */
export async function getGoal(id: string): Promise<Goal | null> {
    await simulateLatency(0.5);
    return db().goals.find((g) => g.id === id) ?? null;
}

/* ─── Mutations ───────────────────────────────────────────────────────────── */

export interface GoalInput {
    fighterId: string;
    coachId: string;
    title: string;
    technique: Technique | null;
    metricLabel: string;
    unit: string;
    lowerIsBetter: boolean;
    baseline: number;
    target: number;
    startDate: string;
    dueDate: string;
    /** Latest measured value. Defaults to the baseline. */
    current?: number;
}

/** Everything except the fighter and the measured value, which change through their own flows. */
export type GoalUpdateInput = Partial<Omit<GoalInput, "fighterId" | "current">>;

/** Creates a goal with an initial checkpoint and notifies the fighter. */
export async function createGoal(input: GoalInput, actor: User): Promise<Goal> {
    const now = nowIso();
    const current = input.current ?? input.baseline;
    const fields = {
        fighterId: input.fighterId,
        coachId: input.coachId,
        title: input.title.trim(),
        technique: input.technique,
        metricLabel: input.metricLabel.trim(),
        unit: input.unit.trim(),
        lowerIsBetter: input.lowerIsBetter,
        baseline: input.baseline,
        target: input.target,
        current,
        startDate: input.startDate,
        dueDate: input.dueDate,
    };
    const goal: Goal = {
        ...fields,
        id: newId("g"),
        status: projectStatus(fields, now),
        history: [{ date: now, value: current }],
        createdAt: now,
    };
    db().goals.unshift(goal);

    recordAudit({
        actor,
        action: "goal.create",
        resourceType: "goal",
        resourceId: goal.id,
        resourceLabel: goalLabel(goal),
        details: `${goal.metricLabel}: ${withUnit(goal.baseline, goal.unit)} → ${withUnit(goal.target, goal.unit)} by ${formatDate(goal.dueDate)}`,
    });

    const userIds = fighterRecipients(goal.fighterId, actor);
    if (userIds.length > 0) {
        notifyUsers({
            userIds,
            category: "goal",
            title: "New goal set",
            body: `${goal.title} — ${goal.metricLabel}: from ${withUnit(goal.baseline, goal.unit)} to ${withUnit(goal.target, goal.unit)} by ${formatDate(goal.dueDate)}.`,
            href: routes.fighter.goals,
        });
    }
    return goal;
}

/**
 * Records a new measurement: appends (or replaces today's) checkpoint, updates `current` and recomputes
 * the status. Notifies the fighter and coach when the goal becomes achieved. Returns null when not found.
 */
export async function updateGoalProgress(id: string, value: number, actor: User): Promise<Goal | null> {
    const goal = db().goals.find((g) => g.id === id);
    if (!goal) return null;
    const now = nowIso();
    const previousValue = goal.current;
    const previousStatus = goal.status;

    const last = goal.history[goal.history.length - 1];
    if (last && dayKey(last.date) === dayKey(now)) {
        last.date = now;
        last.value = value;
    } else {
        goal.history.push({ date: now, value });
    }
    goal.current = value;
    goal.status = projectStatus(goal, now);

    recordAudit({
        actor,
        action: "goal.progress_update",
        resourceType: "goal",
        resourceId: goal.id,
        resourceLabel: goalLabel(goal),
        details: `${goal.metricLabel}: ${withUnit(previousValue, goal.unit)} → ${withUnit(value, goal.unit)}${previousStatus === goal.status ? "" : ` (${previousStatus} → ${goal.status})`}`,
    });

    if (goal.status === "achieved" && previousStatus !== "achieved") {
        const coachUserIds = db()
            .coaches.filter((c) => c.id === goal.coachId)
            .map((c) => c.userId);
        const userIds = [...new Set([...staffUserIdsForFighter(goal.fighterId, ["fighter"]), ...coachUserIds])].filter(
            (userId) => userId !== actor.id,
        );
        if (userIds.length > 0) {
            notifyUsers({
                userIds,
                category: "goal",
                severity: "success",
                title: "Goal achieved",
                body: `${fighterName(goal.fighterId)} reached the target of ${withUnit(goal.target, goal.unit)} on "${goal.title}" — ${goal.metricLabel.toLowerCase()} is now ${withUnit(goal.current, goal.unit)}.`,
                href: routes.fighter.goals,
            });
        }
    }
    return goal;
}

/** Edits goal details and recomputes the status. Returns null when not found. */
export async function updateGoal(id: string, input: GoalUpdateInput, actor: User): Promise<Goal | null> {
    const goal = db().goals.find((g) => g.id === id);
    if (!goal) return null;
    const changed = (Object.keys(input) as (keyof GoalUpdateInput)[]).filter((key) => input[key] !== undefined);

    if (input.coachId !== undefined) goal.coachId = input.coachId;
    if (input.title !== undefined) goal.title = input.title.trim();
    if (input.technique !== undefined) goal.technique = input.technique;
    if (input.metricLabel !== undefined) goal.metricLabel = input.metricLabel.trim();
    if (input.unit !== undefined) goal.unit = input.unit.trim();
    if (input.lowerIsBetter !== undefined) goal.lowerIsBetter = input.lowerIsBetter;
    if (input.baseline !== undefined) goal.baseline = input.baseline;
    if (input.target !== undefined) goal.target = input.target;
    if (input.startDate !== undefined) goal.startDate = input.startDate;
    if (input.dueDate !== undefined) goal.dueDate = input.dueDate;
    goal.status = projectStatus(goal, nowIso());

    recordAudit({
        actor,
        action: "goal.update",
        resourceType: "goal",
        resourceId: goal.id,
        resourceLabel: goalLabel(goal),
        details: changed.length > 0 ? `Changed: ${changed.join(", ")}` : null,
    });
    return goal;
}

/** Permanently removes a goal. Returns false when it doesn't exist. */
export async function deleteGoal(id: string, actor: User): Promise<boolean> {
    const goals = db().goals;
    const index = goals.findIndex((g) => g.id === id);
    if (index === -1) return false;
    const [goal] = goals.splice(index, 1);
    recordAudit({
        actor,
        action: "goal.delete",
        resourceType: "goal",
        resourceId: goal.id,
        resourceLabel: goalLabel(goal),
        details: `${goal.metricLabel} (${goal.status})`,
    });
    return true;
}
