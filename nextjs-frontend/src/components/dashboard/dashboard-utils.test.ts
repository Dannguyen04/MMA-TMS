import { describe, expect, it } from "vitest";

import { greetingTitle } from "./dashboard-utils";

const EVENING = "2026-10-13T12:30:00.000Z";

describe("greetingTitle", () => {
    it("greets by first name", () => {
        expect(greetingTitle(EVENING, { name: "Rafael Costa", email: "rafael.costa@lotus-combat.test" })).toBe("Good evening, Rafael");
    });

    it("never greets by email when the account has no name of its own", () => {
        expect(greetingTitle(EVENING, { name: "nora.whitfield@lotus-combat.test", email: "nora.whitfield@lotus-combat.test" })).toBe("Good evening");
        expect(greetingTitle(EVENING, { name: "  ", email: "nora.whitfield@lotus-combat.test" })).toBe("Good evening");
    });
});
