import "server-only";

import { apiWriteFailure, type ServiceErrorMessages, type WriteFailure } from "./api-write-errors";

/** How the user service's refusals read on the account forms; the status rules are shared (`api-write-errors.ts`). */

const ACCOUNT_ERRORS: ServiceErrorMessages = {
    service: "user service",
    forbidden: "Your account can no longer manage accounts. Ask another administrator to check your role.",
    notFound: "This account no longer exists. Reload the page.",
    codes: {
        USER_NOT_FOUND: "This account no longer exists. Someone may have deleted it. Reload the page.",
        USER_ALREADY_EXISTS: "An account with this email already exists.",
        // The sign-in provider refuses a second identity for the same email before the service can say so itself.
        USER_CREATION_FAILED: "The account couldn't be created. This email may already have an account: use another email or find the existing account.",
        USER_ROLE_MISMATCH: "This account's role changed since the page loaded. Reload the page and try again.",
        INVALID_USER_DATA: "The user service rejected some of the values. Check the form and try again.",
    },
};

/** Service body paths → the account form's field names (`user.profile.firstName` → `profile.firstName`). */
const ACCOUNT_FIELDS = { "user.email": "email", "user.password": "password", "user.profile": "profile" };

/** What to show for a failed account write. Anything that isn't an API error is a bug and is rethrown. */
export function accountWriteFailure(error: unknown): WriteFailure {
    return apiWriteFailure(error, ACCOUNT_ERRORS, { fields: ACCOUNT_FIELDS, conflictFields: { USER_ALREADY_EXISTS: "email", USER_CREATION_FAILED: "email" } });
}
