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

/**
 * Kilograms typed by a person. Accepts `66.5` and `66,5`, one decimal place, 30–200 kg.
 * Anything else is a field error and must not be sent. `example` fills the format message.
 */
export function parseKg(raw: string, { noun = "a weight", example = "66.5" }: { noun?: string; example?: string } = {}): ParsedWeight | WeightInputError {
    const normalised = raw.trim().replace(",", ".");
    if (!WEIGHT_PATTERN.test(normalised)) {
        return { ok: false, message: `Enter ${noun} in kilograms, such as ${example}.` };
    }
    const kg = Number(normalised);
    if (kg < MIN_KG || kg > MAX_KG) {
        return { ok: false, message: `Enter ${noun} between ${MIN_KG} and ${MAX_KG} kg.` };
    }
    return { ok: true, kg };
}

/** A self-reported morning weight. */
export function parseSelfWeight(raw: string): ParsedWeight | WeightInputError {
    return parseKg(raw);
}

/** A custom weight class limit, for a ruleset without a class list. */
export function parseWeightLimit(raw: string): ParsedWeight | WeightInputError {
    return parseKg(raw, { noun: "the limit", example: "63.5" });
}

/** "60 kg", "63.5 kg": a limit as a class label. */
export function kgLabel(kg: number): string {
    return `${Number.isInteger(kg) ? kg : kg.toFixed(1)} kg`;
}
