import { daysBetweenKeys } from "@/lib/format";

import type { BoutPhase, NutritionNote, NutritionPhaseKey, NutritionPlan } from "./bout";
import { weightStatusLabel, type PlanAdherence, type WeightStatus } from "./weight-chart";

export const ADHERENCE_VALUES = ["ON_PLAN", "SLIGHTLY_OFF", "WAY_OFF"] as const;

export const ADHERENCE_LABEL: Record<PlanAdherence, string> = {
    ON_PLAN: "On plan",
    SLIGHTLY_OFF: "Slightly off",
    WAY_OFF: "Way off",
};

export const NUTRITION_PHASE_LABEL: Record<NutritionPhaseKey, string> = {
    camp: "Camp",
    fightWeek: "Fight week",
    postWeighIn: "After the official weigh-in",
};

/** The only medical sentence on a red camp. It is not a diet. */
export const RED_WEIGHT_RECOMMENDATION =
    "Talk with the sports doctor or a nutrition specialist, and consider another weight class.";

const PLAN_TEXT_MAX = 2000;
const NOTE_MAX = 200;
const AUTHOR_MAX = 80;

/** The fighter sees one phase. Completed and cancelled camps have nothing to show. */
export function nutritionPhaseFor(phase: BoutPhase): NutritionPhaseKey | null {
    if (phase === "SCHEDULED" || phase === "CAMP") return "camp";
    if (phase === "FIGHT_WEEK") return "fightWeek";
    if (phase === "WEIGHED_IN") return "postWeighIn";
    return null;
}

export function planForPhase(plan: NutritionPlan, phase: BoutPhase): NutritionNote | null {
    const key = nutritionPhaseFor(phase);
    return key ? plan[key] : null;
}

export function isPlanAdherence(value: string): value is PlanAdherence {
    return (ADHERENCE_VALUES as readonly string[]).includes(value);
}

/**
 * The optional plan question. An empty answer is a skip. A note without an answer
 * is incomplete, so the weight save waits until the fighter clears it.
 */
export function readPlanAnswer(adherenceRaw: string, noteRaw: string): { ok: true; adherence: PlanAdherence | null; note: string | null } | { ok: false; field: "adherence" | "note"; message: string } {
    const note = noteRaw.trim();
    if (note.length > NOTE_MAX) return { ok: false, field: "note", message: "Keep the note to 200 characters." };
    if (!adherenceRaw) {
        if (note) return { ok: false, field: "adherence", message: "Choose how yesterday went, or clear the note." };
        return { ok: true, adherence: null, note: null };
    }
    if (!isPlanAdherence(adherenceRaw)) return { ok: false, field: "adherence", message: "Choose one of the three answers." };
    return { ok: true, adherence: adherenceRaw, note: note || null };
}

export function wayOffCount(checkins: { loggedOn: string; adherence: PlanAdherence }[], todayOn: string, days = 3): number {
    return checkins.filter((item) => {
        const age = daysBetweenKeys(item.loggedOn, todayOn);
        return age >= 0 && age < days && item.adherence === "WAY_OFF";
    }).length;
}

export function adherenceAlertLine(count: number): string {
    return `Last 3 days: ${count} way off.`;
}

export function readPlanText(raw: string): { ok: true; text: string } | { ok: false; message: string } {
    const text = raw.trim();
    if (text.length > PLAN_TEXT_MAX) return { ok: false, message: "Keep this note under 2,000 characters." };
    return { ok: true, text };
}

export function readPlanAuthor(raw: string, fallback: string): { ok: true; authorName: string } | { ok: false; message: string } {
    const authorName = raw.trim() || fallback.trim();
    if (!authorName) return { ok: false, message: "Enter who wrote the plan." };
    if (authorName.length > AUTHOR_MAX) return { ok: false, message: "Keep the name under 80 characters." };
    return { ok: true, authorName };
}

export function savedWeightMessage(saved: string | undefined, status: string | undefined): string | null {
    if (!saved || !/^\d+(\.\d)?$/.test(saved)) return null;
    const kg = Number(saved);
    if (kg < 30 || kg > 200) return null;
    if (!isWeightStatus(status)) return `Saved ${saved} kg.`;
    return `Saved ${saved} kg. Status: ${weightStatusLabel(status)}`;
}

function isWeightStatus(value: string | undefined): value is WeightStatus {
    return value === "GREEN" || value === "YELLOW" || value === "RED" || value === "GREY";
}

export function weighInCountdown(days: number): string {
    if (days === 0) return "Weigh-in is today";
    if (days === 1) return "1 day to weigh-in";
    if (days > 1) return `${days} days to weigh-in`;
    const ago = Math.abs(days);
    return ago === 1 ? "Weigh-in was yesterday" : `Weigh-in was ${ago} days ago`;
}
