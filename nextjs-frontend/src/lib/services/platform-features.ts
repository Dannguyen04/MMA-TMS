import "server-only";

import { isDemoAuthEnabled } from "@/lib/auth/constants";
import { demoOnlyFeatureGate } from "./feature-gate";

/**
 * Training, coaching and platform features the frontend has but the NestJS API doesn't offer yet. They stay
 * available in demo mode only; in API mode services skip the request (reads come back empty, writes refuse) and
 * pages show `FeatureUnavailable` instead of calling routes that don't exist. Server-only, because the mode comes
 * from server environment variables: pass the result to client components as a prop.
 *
 * Account features live in `admin-features.ts` and clinical ones in `medical-features.ts`.
 */
export type PlatformFeature =
    /** Measurable goals agreed between a coach and a fighter (`/goals`). */
    | "goals"
    /** Technique scores, trends, team comparisons and weekly volume (`/performance/*`). */
    | "performance"
    /** Praise, corrections and notes a coach leaves on a session or video (`/coach-feedback`). */
    | "coachFeedback"
    /** The notification inbox and the bell (`/notifications`). */
    | "notifications"
    /** Counts on navigation items (`/navigation/badges`). */
    | "navBadges"
    /** The platform audit log (`/audit-logs`). */
    | "auditLogs"
    /** Admin broadcasts to groups of users (`/broadcasts`). */
    | "broadcasts"
    /** System settings (`/settings`): reads use the defaults and saving refuses. */
    | "systemSettings"
    /** The AI model registry and its thresholds. */
    | "aiModels"
    /** Retrying or cancelling an AI processing job. */
    | "aiJobControl"
    /** The models a job ran, its analysis summary and earlier runs of the same footage. */
    | "aiJobInsights"
    /** A coach confirming, correcting or rejecting AI findings on an analysed video. */
    | "coachAiReview"
    /** A user editing their own name and phone number (`PATCH /users/me`). */
    | "selfProfileEdit"
    /** A fighter recording their own weight and body metrics. */
    | "bodyMetrics";

/** Features with no API yet. Remove one from this list once the backend offers it. */
export const platformFeatureAvailable = demoOnlyFeatureGate<PlatformFeature>([
    "goals",
    "performance",
    "coachFeedback",
    "notifications",
    "navBadges",
    "auditLogs",
    "broadcasts",
    "systemSettings",
    "aiModels",
    "aiJobControl",
    "aiJobInsights",
    "coachAiReview",
    "selfProfileEdit",
    "bodyMetrics",
]);

/**
 * Whether coaches plan training in the training service's own terms: plans without a phase, focus areas or weekly
 * target, sessions without a target RPE or exercise list, and results without a rating or summary. True in API mode;
 * demo mode keeps its richer forms.
 */
export function usesTrainingServiceForms(): boolean {
    return !isDemoAuthEnabled();
}

/** Message returned by server actions for a feature that isn't available in this mode. */
export const PLATFORM_FEATURE_UNAVAILABLE_MESSAGE = "This isn't available yet. The service will add it in a later release.";
