import "server-only";

import { z } from "zod";

import { isDemoAuthEnabled } from "@/lib/auth/constants";
import { authenticatedApiRequest, authenticatedMutableApiRequest, drainAuthenticatedCursorPages } from "@/lib/api/client";
import type { Goal, GoalStatus, Technique, User } from "@/lib/domain/types";
import { isNotFound, nullIfNotFound } from "./api-helpers";

const techniqueSchema = z.enum(["JAB", "CROSS", "HOOK", "KICK", "COMBINATION", "FOOTWORK", "GUARD", "HEAD_MOVEMENT"]);
const goalStatusSchema = z.enum(["ON_TRACK", "AT_RISK", "ACHIEVED", "MISSED"]);
const backendGoalSchema = z.object({
    id: z.string(),
    fighterId: z.string(),
    coachId: z.string(),
    title: z.string(),
    technique: techniqueSchema.nullable(),
    metricLabel: z.string(),
    unit: z.string(),
    lowerIsBetter: z.boolean(),
    baseline: z.number(),
    target: z.number(),
    current: z.number(),
    startDate: z.string(),
    dueDate: z.string(),
    status: goalStatusSchema,
    history: z.array(z.object({ date: z.string(), value: z.number() })),
    createdAt: z.string(),
});

type BackendGoal = z.infer<typeof backendGoalSchema>;

const techniqueFromApi: Record<z.infer<typeof techniqueSchema>, Technique> = {
    JAB: "jab",
    CROSS: "cross",
    HOOK: "hook",
    KICK: "kick",
    COMBINATION: "combination",
    FOOTWORK: "footwork",
    GUARD: "guard",
    HEAD_MOVEMENT: "head_movement",
};
const techniqueToApi: Record<Technique, keyof typeof techniqueFromApi> = {
    jab: "JAB",
    cross: "CROSS",
    hook: "HOOK",
    kick: "KICK",
    combination: "COMBINATION",
    footwork: "FOOTWORK",
    guard: "GUARD",
    head_movement: "HEAD_MOVEMENT",
};
const statusFromApi: Record<z.infer<typeof goalStatusSchema>, GoalStatus> = {
    ON_TRACK: "on_track",
    AT_RISK: "at_risk",
    ACHIEVED: "achieved",
    MISSED: "missed",
};
const statusToApi: Record<GoalStatus, keyof typeof statusFromApi> = {
    on_track: "ON_TRACK",
    at_risk: "AT_RISK",
    achieved: "ACHIEVED",
    missed: "MISSED",
};

function toGoal(goal: BackendGoal): Goal {
    return {
        ...goal,
        technique: goal.technique === null ? null : techniqueFromApi[goal.technique],
        status: statusFromApi[goal.status],
    };
}

async function demoService(): Promise<typeof import("./goals.demo")> {
    return import("./goals.demo");
}

export interface GoalFilter {
    /** Fighters the viewer may see (from `accessibleFighterIds`). Omit for all. */
    fighterIds?: string[] | "all";
    coachId?: string;
    status?: GoalStatus | GoalStatus[];
    technique?: Technique;
}

export async function listGoals(filter: GoalFilter = {}): Promise<Goal[]> {
    if (isDemoAuthEnabled()) return (await demoService()).listGoals(filter);
    if (Array.isArray(filter.fighterIds) && filter.fighterIds.length === 0) return [];

    const params = new URLSearchParams();
    if (Array.isArray(filter.fighterIds)) filter.fighterIds.forEach((fighterId) => params.append("fighterId", fighterId));
    if (filter.coachId) params.set("coachId", filter.coachId);
    const statuses = filter.status === undefined ? [] : Array.isArray(filter.status) ? filter.status : [filter.status];
    statuses.forEach((status) => params.append("status", statusToApi[status]));
    if (filter.technique) params.set("technique", techniqueToApi[filter.technique]);

    const query = params.toString();
    const goals = await drainAuthenticatedCursorPages(`/goals${query ? `?${query}` : ""}`, backendGoalSchema);
    return goals.map(toGoal);
}

export async function getGoal(id: string): Promise<Goal | null> {
    if (isDemoAuthEnabled()) return (await demoService()).getGoal(id);
    const goal = await nullIfNotFound(authenticatedApiRequest(`/goals/${encodeURIComponent(id)}`, backendGoalSchema));
    return goal && toGoal(goal);
}

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

function goalBody(input: GoalInput | GoalUpdateInput): Record<string, unknown> {
    return {
        ...input,
        ...(input.technique !== undefined ? { technique: input.technique === null ? null : techniqueToApi[input.technique] } : {}),
    };
}

export async function createGoal(input: GoalInput, actor: User): Promise<Goal> {
    if (isDemoAuthEnabled()) return (await demoService()).createGoal(input, actor);
    return toGoal(
        await authenticatedMutableApiRequest("/goals", backendGoalSchema, {
            method: "POST",
            body: JSON.stringify(goalBody(input)),
        }),
    );
}

export async function updateGoalProgress(id: string, value: number, actor: User): Promise<Goal | null> {
    if (isDemoAuthEnabled()) return (await demoService()).updateGoalProgress(id, value, actor);
    const goal = await nullIfNotFound(
        authenticatedMutableApiRequest(`/goals/${encodeURIComponent(id)}/progress`, backendGoalSchema, {
            method: "POST",
            body: JSON.stringify({ value }),
        }),
    );
    return goal && toGoal(goal);
}

export async function updateGoal(id: string, input: GoalUpdateInput, actor: User): Promise<Goal | null> {
    if (isDemoAuthEnabled()) return (await demoService()).updateGoal(id, input, actor);
    const goal = await nullIfNotFound(
        authenticatedMutableApiRequest(`/goals/${encodeURIComponent(id)}`, backendGoalSchema, {
            method: "PATCH",
            body: JSON.stringify(goalBody(input)),
        }),
    );
    return goal && toGoal(goal);
}

export async function deleteGoal(id: string, actor: User): Promise<boolean> {
    if (isDemoAuthEnabled()) return (await demoService()).deleteGoal(id, actor);
    try {
        await authenticatedMutableApiRequest(`/goals/${encodeURIComponent(id)}`, z.null(), { method: "DELETE" });
        return true;
    } catch (error) {
        if (isNotFound(error)) return false;
        throw error;
    }
}
