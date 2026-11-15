import { describe, expect, it } from "vitest";

import { suspendedFromTraining } from "./ui";

describe("suspendedFromTraining", () => {
    it("is true only for a suspension that blocks training (red)", () => {
        expect(suspendedFromTraining({ items: [{ kind: "suspension", tone: "red" }] })).toBe(true);
        expect(suspendedFromTraining({ items: [{ kind: "suspension", tone: "amber" }] })).toBe(false);
        expect(suspendedFromTraining({ items: [{ kind: "followup" }, { kind: "expiry" }] })).toBe(false);
        expect(suspendedFromTraining({ items: [] })).toBe(false);
    });
});
