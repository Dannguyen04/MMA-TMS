import { daysBetweenKeys } from "@/lib/format";
import { createTranslator, type Translator } from "@/lib/i18n/translate";

import type { BoutPhase, NutritionNote, NutritionPhaseKey, NutritionPlan } from "./bout";
import type { PlanAdherence, WeightStatus } from "./weight-chart";

export const ADHERENCE_VALUES = ["ON_PLAN", "SLIGHTLY_OFF", "WAY_OFF"] as const satisfies readonly PlanAdherence[];

/** The only medical sentence on a red camp. It is not a diet. */
export const RED_WEIGHT_RECOMMENDATION =
    "Talk with the sports doctor or a nutrition specialist, and consider another weight class.";

const PLAN_TEXT_MAX = 2000;
/** Messages default to English, so the demo store and the tests need no translator. */
const english = createTranslator("en");
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
export function readPlanAnswer(
    adherenceRaw: string,
    noteRaw: string,
    t: Translator = english,
): { ok: true; adherence: PlanAdherence | null; note: string | null } | { ok: false; field: "adherence" | "note"; message: string } {
    const note = noteRaw.trim();
    if (note.length > NOTE_MAX) return { ok: false, field: "note", message: t("boutMsg.plan.noteTooLong", { max: NOTE_MAX }) };
    if (!adherenceRaw) {
        if (note) return { ok: false, field: "adherence", message: t("boutMsg.plan.adherenceRequired") };
        return { ok: true, adherence: null, note: null };
    }
    if (!isPlanAdherence(adherenceRaw)) return { ok: false, field: "adherence", message: t("boutMsg.plan.adherenceInvalid") };
    return { ok: true, adherence: adherenceRaw, note: note || null };
}

export function wayOffCount(checkins: { loggedOn: string; adherence: PlanAdherence }[], todayOn: string, days = 3): number {
    return checkins.filter((item) => {
        const age = daysBetweenKeys(item.loggedOn, todayOn);
        return age >= 0 && age < days && item.adherence === "WAY_OFF";
    }).length;
}

export function adherenceAlertLine(count: number, t: Translator = english): string {
    return t("boutMsg.adherenceAlert", { n: count });
}

export function readPlanText(raw: string, t: Translator = english): { ok: true; text: string } | { ok: false; message: string } {
    const text = raw.trim();
    if (text.length > PLAN_TEXT_MAX) return { ok: false, message: t("boutMsg.plan.textTooLong") };
    return { ok: true, text };
}

export function readPlanAuthor(raw: string, fallback: string, t: Translator = english): { ok: true; authorName: string } | { ok: false; message: string } {
    const authorName = raw.trim() || fallback.trim();
    if (!authorName) return { ok: false, message: t("boutMsg.plan.authorRequired") };
    if (authorName.length > AUTHOR_MAX) return { ok: false, message: t("boutMsg.common.nameTooLong", { max: AUTHOR_MAX }) };
    return { ok: true, authorName };
}

export function savedWeightMessage(saved: string | undefined, status: string | undefined, t: Translator = english): string | null {
    if (!saved || !/^\d+(\.\d)?$/.test(saved)) return null;
    const kg = Number(saved);
    if (kg < 30 || kg > 200) return null;
    if (!isWeightStatus(status)) return t("boutMsg.savedWeight", { kg: saved });
    return t("boutMsg.savedWeightStatus", { kg: saved, status: t(`boutLabel.weightStatus.${status}`) });
}

function isWeightStatus(value: string | undefined): value is WeightStatus {
    return value === "GREEN" || value === "YELLOW" || value === "RED" || value === "GREY";
}

export function weighInCountdown(days: number, t: Translator = english): string {
    if (days === 0) return t("boutMsg.countdown.today");
    if (days === 1) return t("boutMsg.countdown.tomorrow");
    if (days > 1) return t("boutMsg.countdown.days", { n: days });
    const ago = Math.abs(days);
    return ago === 1 ? t("boutMsg.countdown.yesterday") : t("boutMsg.countdown.daysAgo", { n: ago });
}
