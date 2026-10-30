import "server-only";

import type { NutritionCheckin, NutritionPlan } from "@/lib/domain/bout";
import type { PlanAdherence } from "@/lib/domain/weight-chart";

/**
 * Meal plans and plan answers in API mode while the bouts service has no endpoints for them (T-009 A, migration
 * 026). They live in this server's memory, keyed by the service's bout id, and are lost when the server restarts.
 */

interface NutritionMockStore {
    plans: Map<string, NutritionPlan>;
    checkins: Map<string, NutritionCheckin[]>;
}

const globalStore = globalThis as typeof globalThis & { __mmaNutritionMock?: NutritionMockStore };

function store(): NutritionMockStore {
    globalStore.__mmaNutritionMock ??= { plans: new Map(), checkins: new Map() };
    return globalStore.__mmaNutritionMock;
}

const EMPTY_PLAN: NutritionPlan = { camp: null, fightWeek: null, postWeighIn: null };

export function mockNutritionPlan(boutId: string): NutritionPlan {
    return store().plans.get(boutId) ?? EMPTY_PLAN;
}

export function setMockNutritionPlan(boutId: string, plan: NutritionPlan): void {
    store().plans.set(boutId, plan);
}

export function mockCheckins(boutId: string): NutritionCheckin[] {
    return store().checkins.get(boutId) ?? [];
}

/** One answer per academy day: a second answer replaces the first, like the day's weight. */
export function recordMockCheckin(boutId: string, academyDate: string, loggedOn: string, adherence: PlanAdherence, note: string | null, now: Date): void {
    const kept = mockCheckins(boutId).filter((item) => item.academyDate !== academyDate);
    store().checkins.set(boutId, [...kept, { boutId, academyDate, loggedOn, adherence, note, recordedAt: now.toISOString() }]);
}
