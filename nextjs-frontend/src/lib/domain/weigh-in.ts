import type { Translator } from "@/lib/i18n/translate";
import type { Bout, BoutStatus, WeightWarningStatus } from "./types";

/** Self-reported body weight bounds, in kg (T-005). */
export const WEIGHT_MIN_KG = 30;
export const WEIGHT_MAX_KG = 200;

/** Bout statuses that count as the fighter's running bout: booked, in camp, fight week or weighed in. */
export const ACTIVE_BOUT_STATUSES: readonly BoutStatus[] = ["SCHEDULED", "CAMP", "FIGHT_WEEK", "WEIGHED_IN"];

/** `?notice=` value after a weigh-in; the bout page and Today read it back into a "Saved" toast. */
export const WEIGHT_SAVED_NOTICE = "weight-saved";

export type WeightInputError = "empty" | "notNumber" | "range";

export type ParsedWeight = { ok: true; kg: number } | { ok: false; error: WeightInputError };

/**
 * Reads a typed weight in kg. Accepts a comma or a dot as the decimal separator ("66,5" and "66.5"),
 * rounds to 0.1 kg and keeps it within the 30–200 kg range.
 */
export function parseWeightKg(raw: string | null | undefined): ParsedWeight {
    const text = (raw ?? "").trim().replace(",", ".");
    if (text === "") return { ok: false, error: "empty" };
    if (!/^\d+(\.\d+)?$/.test(text)) return { ok: false, error: "notNumber" };
    const kg = Math.round(Number(text) * 10) / 10;
    if (kg < WEIGHT_MIN_KG || kg > WEIGHT_MAX_KG) {
        return { ok: false, error: "range" };
    }
    return { ok: true, kg };
}

/** The fighter's running bout: the earliest weigh-in among bouts that are not completed or cancelled. */
export function activeBout(bouts: Bout[]): Bout | null {
    return (
        bouts
            .filter((bout) => bout.deletedAt === null && ACTIVE_BOUT_STATUSES.includes(bout.status))
            .sort((a, b) => a.weighInAt.localeCompare(b.weighInAt))[0] ?? null
    );
}

const ALERT_ORDER: Partial<Record<WeightWarningStatus, number>> = { RED: 0, YELLOW: 1, GREY: 2 };

/**
 * Running bouts whose weight needs the coach's attention: red first, then yellow, then grey,
 * the earliest weigh-in first within each status. Green bouts are left out.
 */
export function weightAlerts(bouts: Bout[]): Bout[] {
    const rank = (bout: Bout) => ALERT_ORDER[bout.weight?.status ?? "GREY"];
    return bouts
        .filter((bout) => bout.deletedAt === null && ACTIVE_BOUT_STATUSES.includes(bout.status) && rank(bout) !== undefined)
        .sort((a, b) => rank(a)! - rank(b)! || a.weighInAt.localeCompare(b.weighInAt));
}

/** The field message for a weight that `parseWeightKg` rejected, in the viewer's language. */
export function weightInputMessage(t: Translator, error: WeightInputError): string {
    if (error === "range") return t("weighIn.error.range", { min: WEIGHT_MIN_KG, max: WEIGHT_MAX_KG });
    return t(error === "empty" ? "weighIn.error.empty" : "weighIn.error.notNumber");
}
