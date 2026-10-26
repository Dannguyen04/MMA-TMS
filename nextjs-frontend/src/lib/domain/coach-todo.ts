import { addDaysToKey, dayKey, daysBetweenKeys } from "@/lib/format";
import type { Bout, BoutStatus, CoachTodoItem, CoachTodoSource } from "./types";

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
