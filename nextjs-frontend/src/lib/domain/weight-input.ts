export interface ParsedWeight {
    ok: true;
    kg: number;
}

export interface WeightInputError {
    ok: false;
    message: string;
}

const WEIGHT_PATTERN = /^\d+(\.\d)?$/;

/**
 * A self-reported morning weight. Accepts `66.5` and `66,5`, one decimal place, 30–200 kg.
 * Anything else is a field error and must not be sent.
 */
export function parseSelfWeight(raw: string): ParsedWeight | WeightInputError {
    const normalised = raw.trim().replace(",", ".");
    if (!WEIGHT_PATTERN.test(normalised)) {
        return { ok: false, message: "Enter a weight in kilograms, such as 66.5." };
    }
    const kg = Number(normalised);
    if (kg < 30 || kg > 200) {
        return { ok: false, message: "Enter a weight between 30 and 200 kg." };
    }
    return { ok: true, kg };
}
