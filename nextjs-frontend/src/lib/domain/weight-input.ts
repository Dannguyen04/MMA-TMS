import { createTranslator, type Translator } from "@/lib/i18n/translate";

export interface ParsedWeight {
    ok: true;
    kg: number;
}

export interface WeightInputError {
    ok: false;
    message: string;
}

const WEIGHT_PATTERN = /^\d+(\.\d)?$/;

/** The range every weight field accepts: a morning weigh-in, an official weigh-in or a custom class limit. */
export const MIN_KG = 30;
export const MAX_KG = 200;

/** Which weight a field asks for; it picks the wording and the example of the error messages. */
export type WeightKind = "weight" | "limit" | "official" | "catchweight";

/** Messages default to English, so the demo store and the tests need no translator. */
const english = createTranslator("en");

/**
 * Kilograms typed by a person. Accepts `66.5` and `66,5`, one decimal place, 30–200 kg.
 * Anything else is a field error and must not be sent.
 */
export function parseKg(raw: string, kind: WeightKind = "weight", t: Translator = english): ParsedWeight | WeightInputError {
    const normalised = raw.trim().replace(",", ".");
    if (!WEIGHT_PATTERN.test(normalised)) {
        return { ok: false, message: t(`boutMsg.kg.format.${kind}`) };
    }
    const kg = Number(normalised);
    if (kg < MIN_KG || kg > MAX_KG) {
        return { ok: false, message: t(`boutMsg.kg.range.${kind}`, { min: MIN_KG, max: MAX_KG }) };
    }
    return { ok: true, kg };
}

/** A self-reported morning weight. */
export function parseSelfWeight(raw: string, t?: Translator): ParsedWeight | WeightInputError {
    return parseKg(raw, "weight", t);
}

/** A custom weight class limit, for a ruleset without a class list. */
export function parseWeightLimit(raw: string, t?: Translator): ParsedWeight | WeightInputError {
    return parseKg(raw, "limit", t);
}

/** "60 kg", "63.5 kg": a limit as a class label. */
export function kgLabel(kg: number): string {
    return `${Number.isInteger(kg) ? kg : kg.toFixed(1)} kg`;
}
