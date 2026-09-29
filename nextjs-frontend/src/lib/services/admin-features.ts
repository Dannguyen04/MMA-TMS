import "server-only";

import { isDemoAuthEnabled } from "@/lib/auth/constants";

/**
 * Account-management features the frontend has but the user service doesn't offer yet. They stay available
 * in demo mode only; in API mode pages show a "not available yet" state and actions refuse, instead of
 * calling routes that don't exist. Server-only, because the mode comes from server environment variables:
 * pass the result to client components as a prop.
 */
export type AdminFeature =
    /** Inviting someone by email to set their own password. The service creates accounts with a password and full profile instead. */
    | "inviteUsers"
    /** Changing an account's name, job title or role. The service only edits role profile fields. */
    | "editUsers"
    /** Suspending and reactivating an account, and resending an invitation. */
    | "accountStatus"
    /** A phone number on the account. */
    | "accountPhone"
    /** A coach's certifications and years of experience. */
    | "coachCredentials"
    /** When each account last signed in. */
    | "lastActive"
    /** Opening a deactivated or deleted account: the service reads active accounts only. */
    | "inactiveAccountDetail"
    /** The audit trail of what an account did. */
    | "auditTrail"
    /** Reading which permissions each role grants. */
    | "rolePermissions";

/** Features with no user-service API yet. Remove one from this set once the service offers it. */
const DEMO_ONLY_FEATURES: ReadonlySet<AdminFeature> = new Set([
    "inviteUsers",
    "editUsers",
    "accountStatus",
    "accountPhone",
    "coachCredentials",
    "lastActive",
    "inactiveAccountDetail",
    "auditTrail",
    "rolePermissions",
]);

export function adminFeatureAvailable(feature: AdminFeature): boolean {
    return isDemoAuthEnabled() || !DEMO_ONLY_FEATURES.has(feature);
}

/** Message returned by server actions for an account feature that isn't available in this mode. */
export const ADMIN_FEATURE_UNAVAILABLE_MESSAGE = "This isn't available yet. The user service will add it in a later release.";
