"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { canAccessFighter } from "@/lib/auth/access";
import { authorizeAction } from "@/lib/auth/session";
import { GOAL_STATUS_LABELS, TECHNIQUES } from "@/lib/domain/labels";
import type { Goal, Technique, User } from "@/lib/domain/types";
import { academyDayEndIso, academyDayStartIso, dayKey, isDateKey } from "@/lib/format";
import { routes } from "@/lib/routes";
import {
    createGoal as createGoalRecord,
    deleteGoal as deleteGoalRecord,
    getGoal,
    updateGoal as updateGoalRecord,
    updateGoalProgress,
} from "@/lib/services/goals";
import { actionError, actionSuccess, validationError, type ActionState } from "./state";

const GOAL_NOT_FOUND = "This goal no longer exists. It may have been deleted — refresh to see the latest list.";

/* ─── Parsing ─────────────────────────────────────────────────────────────── */

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function requiredNumber(label: string) {
    return z
        .string({ error: `Enter the ${label}.` })
        .trim()
        .min(1, `Enter the ${label}.`)
        .transform(Number)
        .refine(Number.isFinite, `The ${label} must be a number.`);
}

function dayField(label: string) {
    return z
        .string({ error: `Choose the ${label}.` })
        .regex(DAY_PATTERN, `Choose the ${label}.`)
        .refine(isDateKey, `Choose a valid ${label}.`);
}

const goalFields = z.object({
    title: z
        .string({ error: "Give the goal a title." })
        .trim()
        .min(3, "Give the goal a title of at least 3 characters.")
        .max(120, "Keep the title under 120 characters."),
    technique: z
        .string()
        .refine((value) => value === "" || TECHNIQUES.includes(value as Technique), "Choose a technique from the list.")
        .transform((value) => (value === "" ? null : (value as Technique))),
    metricLabel: z
        .string({ error: "Describe what is measured." })
        .trim()
        .min(2, "Describe what is measured, e.g. “Jab peak speed”.")
        .max(80, "Keep the metric label under 80 characters."),
    unit: z.string({ error: "Enter a unit." }).trim().min(1, "Enter a unit, e.g. %, m/s or kg.").max(16, "Keep the unit under 16 characters."),
    lowerIsBetter: z.boolean(),
    baseline: requiredNumber("baseline"),
    target: requiredNumber("target"),
    startDate: dayField("start date"),
    dueDate: dayField("due date"),
});

type GoalFields = z.output<typeof goalFields>;

/** Rules shared by create and edit: a real change to aim for, in the right direction, over a real period. */
function checkGoalRules(value: GoalFields, ctx: z.RefinementCtx) {
    if (value.target === value.baseline) {
        ctx.addIssue({ code: "custom", path: ["target"], message: "The target must be different from the baseline." });
    } else if (value.lowerIsBetter && value.target > value.baseline) {
        ctx.addIssue({ code: "custom", path: ["target"], message: "For a lower-is-better metric, set the target below the baseline." });
    } else if (!value.lowerIsBetter && value.target < value.baseline) {
        ctx.addIssue({ code: "custom", path: ["target"], message: "Set the target above the baseline, or tick “Lower is better”." });
    }
    if (value.dueDate <= value.startDate) {
        ctx.addIssue({ code: "custom", path: ["dueDate"], message: "The due date must be after the start date." });
    }
}

const createGoalSchema = goalFields
    .extend({
        fighterId: z.string({ error: "Choose a fighter." }).min(1, "Choose a fighter."),
        current: z
            .string()
            .trim()
            .transform((value) => (value === "" ? null : Number(value)))
            .refine((value) => value === null || Number.isFinite(value), "The current value must be a number."),
    })
    .superRefine((value, ctx) => {
        checkGoalRules(value, ctx);
        if (value.dueDate < dayKey(new Date())) {
            ctx.addIssue({ code: "custom", path: ["dueDate"], message: "The due date can't be in the past." });
        }
    });

const updateGoalSchema = goalFields.extend({ goalId: z.string().min(1, GOAL_NOT_FOUND) }).superRefine(checkGoalRules);

const progressSchema = z.object({
    goalId: z.string({ error: GOAL_NOT_FOUND }).min(1, GOAL_NOT_FOUND),
    value: requiredNumber("new value"),
});

/** Reads text inputs as strings (missing inputs become undefined so zod reports them) and checkboxes as booleans. */
function readForm(formData: FormData, textFields: string[], checkboxes: string[] = []): Record<string, string | boolean | undefined> {
    const values: Record<string, string | boolean | undefined> = {};
    for (const name of textFields) {
        const value = formData.get(name);
        values[name] = typeof value === "string" ? value : undefined;
    }
    for (const name of checkboxes) values[name] = formData.get(name) === "on";
    return values;
}

const GOAL_TEXT_FIELDS = ["title", "technique", "metricLabel", "unit", "baseline", "target", "startDate", "dueDate"];

/* ─── Helpers ─────────────────────────────────────────────────────────────── */

/** Keeps the stored instant when the calendar day is unchanged, so editing other fields doesn't shift dates. */
function keepOrSetDay(existing: string, day: string, toIso: (key: string) => string): string {
    return dayKey(existing) === day ? existing : toIso(day);
}

/** Loads a goal the user may manage. Inaccessible goals read as missing so other rosters aren't revealed. */
async function loadManagedGoal(user: User, goalId: string): Promise<Goal | null> {
    const goal = await getGoal(goalId);
    return goal && canAccessFighter(user, goal.fighterId) ? goal : null;
}

function revalidateGoalPages(fighterId: string) {
    revalidatePath(routes.coach.goals);
    revalidatePath(routes.coach.fighterGoals(fighterId));
    revalidatePath(routes.coach.dashboard);
    revalidatePath(routes.fighter.goals);
    revalidatePath(routes.fighter.dashboard);
    revalidatePath("/fighter/performance/[technique]", "page");
}

/* ─── Actions ─────────────────────────────────────────────────────────────── */

export async function createGoal(_prev: ActionState, formData: FormData): Promise<ActionState> {
    const auth = await authorizeAction("goals:write");
    if (!auth.ok) return actionError(auth.message);

    const values = readForm(formData, [...GOAL_TEXT_FIELDS, "fighterId", "current"], ["lowerIsBetter"]);
    const parsed = createGoalSchema.safeParse({ ...values, technique: values.technique ?? "", current: values.current ?? "" });
    if (!parsed.success) return validationError(parsed.error);
    const input = parsed.data;

    if (!canAccessFighter(auth.user, input.fighterId)) {
        return actionError("You can only set goals for fighters you coach.", { fighterId: "Choose a fighter from your roster." });
    }
    if (!auth.user.profileId) return actionError("Your account has no coaching profile, so goals can't be assigned to you.");

    const goal = await createGoalRecord(
        {
            fighterId: input.fighterId,
            coachId: auth.user.profileId,
            title: input.title,
            technique: input.technique,
            metricLabel: input.metricLabel,
            unit: input.unit,
            lowerIsBetter: input.lowerIsBetter,
            baseline: input.baseline,
            target: input.target,
            current: input.current ?? undefined,
            startDate: academyDayStartIso(input.startDate),
            dueDate: academyDayEndIso(input.dueDate),
        },
        auth.user,
    );

    revalidateGoalPages(goal.fighterId);
    return actionSuccess(`Goal “${goal.title}” created. The fighter has been notified.`);
}

export async function updateGoal(_prev: ActionState, formData: FormData): Promise<ActionState> {
    const auth = await authorizeAction("goals:write");
    if (!auth.ok) return actionError(auth.message);

    const values = readForm(formData, [...GOAL_TEXT_FIELDS, "goalId"], ["lowerIsBetter"]);
    const parsed = updateGoalSchema.safeParse({ ...values, technique: values.technique ?? "" });
    if (!parsed.success) return validationError(parsed.error);
    const input = parsed.data;

    const existing = await loadManagedGoal(auth.user, input.goalId);
    if (!existing) return actionError(GOAL_NOT_FOUND);

    const goal = await updateGoalRecord(
        existing.id,
        {
            title: input.title,
            technique: input.technique,
            metricLabel: input.metricLabel,
            unit: input.unit,
            lowerIsBetter: input.lowerIsBetter,
            baseline: input.baseline,
            target: input.target,
            startDate: keepOrSetDay(existing.startDate, input.startDate, academyDayStartIso),
            dueDate: keepOrSetDay(existing.dueDate, input.dueDate, academyDayEndIso),
        },
        auth.user,
    );
    if (!goal) return actionError(GOAL_NOT_FOUND);

    revalidateGoalPages(goal.fighterId);
    return actionSuccess(`Saved changes to “${goal.title}”. Status: ${GOAL_STATUS_LABELS[goal.status]}.`);
}

export async function logGoalProgress(_prev: ActionState, formData: FormData): Promise<ActionState> {
    const auth = await authorizeAction("goals:write");
    if (!auth.ok) return actionError(auth.message);

    const parsed = progressSchema.safeParse(readForm(formData, ["goalId", "value"]));
    if (!parsed.success) return validationError(parsed.error);

    const existing = await loadManagedGoal(auth.user, parsed.data.goalId);
    if (!existing) return actionError(GOAL_NOT_FOUND);
    const previousStatus = existing.status;

    const goal = await updateGoalProgress(existing.id, parsed.data.value, auth.user);
    if (!goal) return actionError(GOAL_NOT_FOUND);

    revalidateGoalPages(goal.fighterId);
    if (goal.status === "achieved" && previousStatus !== "achieved") {
        return actionSuccess(`Target reached — “${goal.title}” is marked achieved.`);
    }
    return actionSuccess(
        previousStatus === goal.status
            ? `Progress logged for “${goal.title}”.`
            : `Progress logged. “${goal.title}” is now ${GOAL_STATUS_LABELS[goal.status].toLowerCase()}.`,
    );
}

export async function deleteGoal(goalId: string): Promise<ActionState> {
    const auth = await authorizeAction("goals:write");
    if (!auth.ok) return actionError(auth.message);

    const parsed = z.string().min(1).safeParse(goalId);
    if (!parsed.success) return actionError(GOAL_NOT_FOUND);

    const existing = await loadManagedGoal(auth.user, parsed.data);
    if (!existing) return actionError(GOAL_NOT_FOUND);

    const deleted = await deleteGoalRecord(existing.id, auth.user);
    if (!deleted) return actionError(GOAL_NOT_FOUND);

    revalidateGoalPages(existing.fighterId);
    return actionSuccess(`Deleted “${existing.title}”.`);
}
