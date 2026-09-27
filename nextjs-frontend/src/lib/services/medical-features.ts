import "server-only";

import { isDemoAuthEnabled } from "@/lib/auth/constants";

/**
 * Medical features the frontend has but the backend API doesn't offer yet. They stay available in demo
 * mode only; in API mode pages show a "not available yet" state instead of mock data. Server-only, because
 * the mode comes from server environment variables: pass the result to client components as a prop.
 */
export type MedicalFeature =
    /** Blood type, allergies, medications, surgical history, emergency contact, documents. */
    | "medicalRecord"
    /** Vitals and per-area assessments on an examination. */
    | "vitals"
    /** Phased recovery plans with check-ins (pain, mobility, strength). */
    | "recoveryPhasesAndCheckIns"
    /** Planned / ongoing / completed status on a treatment. */
    | "treatmentStatus"
    /** AI movement observations raised from video analysis. */
    | "aiObservations"
    /** Follow-up dates set on examinations. */
    | "followUps"
    /** Setting a fighter's health status by hand. */
    | "healthStatusOverride";

/** Features with no backend API yet. Remove one from this set once the medical service offers it. */
const DEMO_ONLY_FEATURES: ReadonlySet<MedicalFeature> = new Set([
    "medicalRecord",
    "vitals",
    "recoveryPhasesAndCheckIns",
    "treatmentStatus",
    "aiObservations",
    "followUps",
    "healthStatusOverride",
]);

export function medicalFeatureAvailable(feature: MedicalFeature): boolean {
    return isDemoAuthEnabled() || !DEMO_ONLY_FEATURES.has(feature);
}

/** Message returned by server actions for a feature that isn't available in this mode. */
export const FEATURE_UNAVAILABLE_MESSAGE = "This isn't available yet. The medical service will add it in a later release.";
