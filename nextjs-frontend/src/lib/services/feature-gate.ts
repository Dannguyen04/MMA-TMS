import "server-only";

import { isDemoAuthEnabled } from "@/lib/auth/constants";

/**
 * Builds the availability check for features the frontend has but the API doesn't offer yet: every feature is on in
 * demo mode, and the listed ones are off in API mode. The mode is read on every call, so tests can switch it.
 */
export function demoOnlyFeatureGate<Feature extends string>(demoOnly: readonly Feature[]): (feature: Feature) => boolean {
    const unavailableInApiMode: ReadonlySet<Feature> = new Set(demoOnly);
    return (feature) => isDemoAuthEnabled() || !unavailableInApiMode.has(feature);
}
