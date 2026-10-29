import { addDaysToKey, dayKey, daysBetweenKeys } from "@/lib/format";
import type { Bout, BoutStatus, CoachTodoItem, CoachTodoSource, Suspension, TrainingSession } from "./types";
import { academyDateOf, planConflicts, suspensionStatusOn } from "./suspension-rules";

/**
 * The coach's "to-do" card for demo mode: the same rules as the backend providers
 * (`GET /coach/todo`, T-029), read from the computed fields of the demo bouts. In API mode
 * the backend returns the items and this is not used. Tactics without sessions (R14) and the
 * suspension sources have no data in demo mode, so they are left out here.
 */

/** R11: paperwork still open within this many days of its due date is a task. */
export const REQUIREMENTS_WARNING_DAYS = 14;

const RUNNING: readonly BoutStatus[] = ["SCHEDULED", "CAMP", "FIGHT_WEEK", "WEIGHED_IN"];
const BEFORE_WEIGHED_IN: readonly BoutStatus[] = ["SCHEDULED", "CAMP", "FIGHT_WEEK"];

export function buildDemoCoachTodo(bouts: Bout[], now: string | Date = new Date()): CoachTodoItem[] {
    const today = dayKey(now);
    const items: CoachTodoItem[] = [];

    for (const bout of bouts) {
        if (bout.deletedAt !== null || !RUNNING.includes(bout.status)) continue;
        const add = (source: CoachTodoSource, phase: CoachTodoItem["phase"], extra: Partial<Pick<CoachTodoItem, "dueOn" | "count">> = {}) =>
            items.push({ source, phase, fighterId: bout.fighterId, boutId: bout.id, eventName: bout.eventName, dueOn: extra.dueOn ?? null, count: extra.count ?? null });

        // R11
        const open = (bout.gate1?.missing.length ?? 0) + (bout.gate1?.expiring.length ?? 0);
        const dueOn = bout.requirementsDueOn ?? addDaysToKey(dayKey(bout.weighInAt), -bout.requirementsDueDays);
        if (open > 0) {
            if (today > dueOn) add("REQUIREMENTS_OVERDUE", "BEFORE", { dueOn, count: open });
            else if (daysBetweenKeys(today, dueOn) <= REQUIREMENTS_WARNING_DAYS) add("REQUIREMENTS_DUE", "BEFORE", { dueOn, count: open });
        }

        // R7
        if (BEFORE_WEIGHED_IN.includes(bout.status)) {
            const status = bout.weight?.status;
            if (status === "OVER_LIMIT") add("WEIGHT_OVER_LIMIT", "BEFORE");
            else if (status === "ABOVE_TARGET") add("WEIGHT_ABOVE_TARGET", "BEFORE");
            else if (status === "NOT_WEIGHED") add("WEIGHT_NOT_WEIGHED", "BEFORE");
        }

        // R16
        if (bout.canEnterFightWeek) add("CAN_ENTER_FIGHT_WEEK", "BEFORE");

        // R17
        if (bout.status === "FIGHT_WEEK" && dayKey(bout.weighInAt) === today) add("WEIGH_IN_TODAY", "DURING", { dueOn: today });

        // R26
        const boutOn = dayKey(bout.boutAt);
        if (today > boutOn) add("RESULT_OVERDUE", "DURING", { dueOn: boutOn });

        // T0: only the escalated reminder
        if (bout.weightReminder?.level === "YESTERDAY_MISSING") add("WEIGHT_NOT_LOGGED", "DURING");
    }
    return items;
}

export function buildSuspensionTodoItems({
    suspensions,
    sessions = [],
    bouts = [],
    fighterIds,
    now = new Date(),
}: {
    suspensions: readonly Suspension[];
    sessions?: readonly TrainingSession[];
    bouts?: readonly Bout[];
    fighterIds?: string[] | "all";
    now?: string | Date;
}): CoachTodoItem[] {
    const today = academyDateOf(now);
    const items: CoachTodoItem[] = [];

    // Group suspensions by fighterId
    const fighterIdSet = new Set<string>();
    if (Array.isArray(fighterIds)) {
        for (const id of fighterIds) fighterIdSet.add(id);
    } else {
        for (const s of suspensions) fighterIdSet.add(s.fighterId);
        for (const b of bouts) fighterIdSet.add(b.fighterId);
    }

    // Find primary bout per fighter (prefer running, then most recent boutAt)
    const primaryBoutByFighter = new Map<string, Bout>();
    for (const bout of bouts) {
        if (bout.deletedAt !== null) continue;
        const existing = primaryBoutByFighter.get(bout.fighterId);
        if (!existing) {
            primaryBoutByFighter.set(bout.fighterId, bout);
        } else {
            const existingRunning = RUNNING.includes(existing.status);
            const candidateRunning = RUNNING.includes(bout.status);
            if (candidateRunning !== existingRunning) {
                if (candidateRunning) primaryBoutByFighter.set(bout.fighterId, bout);
            } else {
                const candidateTime = new Date(bout.boutAt).getTime();
                const existingTime = new Date(existing.boutAt).getTime();
                if (candidateTime > existingTime) {
                    primaryBoutByFighter.set(bout.fighterId, bout);
                }
            }
        }
    }

    for (const fighterId of fighterIdSet) {
        const fighterSuspensions = suspensions.filter(
            (s) => s.fighterId === fighterId && (s as { deletedAt?: string | null }).deletedAt == null,
        );
        if (fighterSuspensions.length === 0) continue;

        const bout = primaryBoutByFighter.get(fighterId);
        if (!bout) continue;
        const boutId = bout.id;
        const eventName = bout.eventName;

        // S3: Awaiting clearance
        const awaiting = fighterSuspensions.some(
            (s) => suspensionStatusOn(s, today) === "AWAITING_CLEARANCE",
        );
        if (awaiting) {
            items.push({
                source: "SUSPENSION_AWAITING_CLEARANCE",
                phase: "AFTER",
                fighterId,
                boutId,
                eventName,
                dueOn: null,
                count: null,
            });
        }

        // R28: Unresolved proposals for scheduled sessions from today
        const scheduledSessions = sessions.filter((s) => {
            if (s.fighterId !== fighterId) return false;
            if (s.status !== "scheduled") return false;
            const scheduledDate = academyDateOf(s.scheduledAt);
            return scheduledDate >= today;
        });

        if (scheduledSessions.length > 0) {
            const proposals = planConflicts(scheduledSessions, fighterSuspensions);
            if (proposals.length > 0) {
                items.push({
                    source: "TRAINING_CONFLICTS_WITH_SUSPENSION",
                    phase: "AFTER",
                    fighterId,
                    boutId,
                    eventName,
                    dueOn: null,
                    count: proposals.length,
                });
            }
        }
    }

    return items;
}
