/** Validation bounds shared by the account forms and their Server Actions, so hints match the server. */

export interface MeasurementLimit {
    min: number;
    max: number;
    step: number;
}

export const BODY_METRIC_LIMITS = {
    weightKg: { min: 40, max: 160, step: 0.1 },
    bodyFatPct: { min: 3, max: 40, step: 0.1 },
    restingHeartRate: { min: 30, max: 110, step: 1 },
} as const satisfies Record<string, MeasurementLimit>;

export const NAME_MAX_LENGTH = 80;
export const PHONE_MAX_LENGTH = 24;
