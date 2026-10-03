import "server-only";

import { isDemoAuthEnabled } from "@/lib/auth/constants";
import { demoOnlyFeatureGate } from "./feature-gate";

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

/** Features with no backend API yet. Remove one from this list once the medical service offers it. */
export const medicalFeatureAvailable = demoOnlyFeatureGate<MedicalFeature>([
    "medicalRecord",
    "vitals",
    "recoveryPhasesAndCheckIns",
    "treatmentStatus",
    "aiObservations",
    "followUps",
    "healthStatusOverride",
]);

/**
 * Whether the doctor records clinical decisions in the medical service's own terms: examination decisions per scope,
 * clearances issued from an examination, injuries by joint, flat recovery milestones. True in API mode; demo mode
 * keeps its richer demo forms.
 */
export function usesMedicalServiceForms(): boolean {
    return !isDemoAuthEnabled();
}

/** Message returned by server actions for a feature that isn't available in this mode. */
export const FEATURE_UNAVAILABLE_MESSAGE = "This isn't available yet. The medical service will add it in a later release.";
