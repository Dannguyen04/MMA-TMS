import { describe, expect, it } from "vitest";

import { createAccountBody, updateAccountBody } from "./account-contract";

describe("account bodies for the user service", () => {
    it("sends a new fighter with upper-case enums, trimmed names and empty optional text as null", () => {
        expect(
            createAccountBody({
                email: "  Linh.Tran@Example.TEST ",
                password: "a long first password",
                account: {
                    role: "fighter",
                    profile: { firstName: " Linh ", lastName: "Tran ", dateOfBirth: "2001-04-12", weightClass: "light_heavyweight", dominantStance: null, nationality: "  " },
                },
            }),
        ).toEqual({
            user: {
                email: "linh.tran@example.test",
                password: "a long first password",
                role: "FIGHTER",
                profile: { firstName: "Linh", lastName: "Tran", dateOfBirth: "2001-04-12", weightClass: "LIGHT_HEAVYWEIGHT", dominantStance: null, nationality: null },
            },
        });
    });

    it("sends an administrator without a profile", () => {
        expect(createAccountBody({ email: "ops@example.test", password: "a long first password", account: { role: "admin", profile: null } })).toEqual({
            user: { email: "ops@example.test", password: "a long first password", role: "ADMIN" },
        });
    });

    it("edits the whole profile under the account's unchanged role", () => {
        expect(updateAccountBody({ role: "doctor", profile: { firstName: "An", lastName: "Pham", licenseNumber: " VN-4471 ", specialization: "Sports medicine" } })).toEqual({
            user: { role: "DOCTOR", profile: { firstName: "An", lastName: "Pham", licenseNumber: "VN-4471", specialization: "Sports medicine" } },
        });
        expect(updateAccountBody({ role: "coach", profile: { firstName: "Rafael", lastName: "Santos", specialization: "", isHeadCoach: true } })).toEqual({
            user: { role: "COACH", profile: { firstName: "Rafael", lastName: "Santos", specialization: null, isHeadCoach: true } },
        });
    });
});
