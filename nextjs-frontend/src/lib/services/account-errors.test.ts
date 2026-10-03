import { describe, expect, it } from "vitest";

import { ApiError } from "@/lib/api/client";
import { accountWriteFailure } from "./account-errors";

const http = (status: number, code: string, details?: unknown) => new ApiError({ message: "Request failed", kind: "http", status, code, details });

describe("accountWriteFailure", () => {
    it("puts a taken email on the email field, however the service reports it", () => {
        expect(accountWriteFailure(http(409, "USER_ALREADY_EXISTS")).fieldErrors).toEqual({ email: "An account with this email already exists." });
        expect(accountWriteFailure(http(409, "USER_CREATION_FAILED")).fieldErrors?.email).toContain("may already have an account");
    });

    it("puts the service's validation issues on the matching form fields", () => {
        const failure = accountWriteFailure(
            http(422, "VALIDATION_ERROR", [
                { code: "too_small", path: ["user", "password"], message: "Too small" },
                { code: "invalid_value", path: ["user", "profile", "weightClass"], message: "Invalid option" },
            ]),
        );
        expect(failure.fieldErrors).toEqual({ password: "Too small.", "profile.weightClass": "Invalid option." });
    });

    it("explains an account that disappeared and never claims a failed write wasn't saved", () => {
        expect(accountWriteFailure(http(404, "USER_NOT_FOUND")).message).toContain("no longer exists");
        expect(accountWriteFailure(http(500, "USER_OPERATION_FAILED")).message).toContain("may not have been saved");
    });
});
