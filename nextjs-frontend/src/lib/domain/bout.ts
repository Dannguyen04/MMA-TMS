import type { WeightClass } from "./types";
import type { PlanAdherence } from "./weight-chart";

/** Bout lifecycle. Running camps are the first four. */
export type BoutPhase = "SCHEDULED" | "CAMP" | "FIGHT_WEEK" | "WEIGHED_IN" | "COMPLETED" | "CANCELLED";

export type RequirementState = "MISSING" | "PROVIDED" | "CONFIRMED" | "REJECTED";

export interface BoutRequirement {
    id: string;
    label: string;
    state: RequirementState;
}

/** Text a coach, or a specialist they name, typed. The app does not calculate a diet. */
export interface NutritionNote {
    text: string;
    authorName: string;
    updatedAt: string;
}

export interface NutritionPlan {
    camp: NutritionNote | null;
    fightWeek: NutritionNote | null;
    postWeighIn: NutritionNote | null;
}

export type NutritionPhaseKey = keyof NutritionPlan;

export interface CampBout {
    id: string;
    fighterId: string;
    event: string;
    opponent: string | null;
    weightClass: WeightClass;
    /** Agreed limit in kg. A catchweight replaces the class ceiling. */
    limitKg: number;
    catchweightKg: number | null;
    acuteLossLimitPct: number;
    acuteWindowDays: number;
    weighInAt: string;
    boutAt: string;
    phase: BoutPhase;
    /** Academy date the reference line starts from. */
    campStartedOn: string;
    requirements: BoutRequirement[];
    nutritionPlan: NutritionPlan;
}

export interface NutritionCheckin {
    boutId: string;
    /** Academy date the question is about (yesterday). */
    academyDate: string;
    /** Academy date the fighter answered. */
    loggedOn: string;
    adherence: PlanAdherence;
    note: string | null;
    recordedAt: string;
}

export function isRunningPhase(phase: BoutPhase): boolean {
    return phase === "SCHEDULED" || phase === "CAMP" || phase === "FIGHT_WEEK" || phase === "WEIGHED_IN";
}

export function requirementsReady(items: BoutRequirement[]): { ready: number; total: number } {
    return {
        ready: items.filter((item) => item.state === "PROVIDED" || item.state === "CONFIRMED").length,
        total: items.length,
    };
}
