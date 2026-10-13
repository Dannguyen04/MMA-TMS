import { describe, expect, it } from "vitest";

import { careTeamChange } from "./care-team-change";

const member = (staffId: string, name: string) => ({ staffId, name });

describe("careTeamChange", () => {
    it("names whoever was assigned since the administrator looked", () => {
        expect(careTeamChange("doctor", [], [member("d-1", "Dr Minh Tran")])).toBe(
            "Dr Minh Tran was assigned as sports doctor while this page was open. Check the care team before adding anyone else.",
        );
        expect(careTeamChange("coach", ["c-1"], [member("c-1", "Ana"), member("c-2", "Ben"), member("c-3", "Cao")])).toMatch(/^Ben and Cao were assigned as coach/);
    });

    it("says so when an assignment ended meanwhile", () => {
        expect(careTeamChange("doctor", ["d-1"], [])).toBe("The sports doctor assignments changed while this page was open. Check the care team before assigning anyone.");
    });

    it("is null when the team is the one they saw", () => {
        expect(careTeamChange("doctor", [], [])).toBeNull();
        expect(careTeamChange("coach", ["c-2", "c-1"], [member("c-1", "Ana"), member("c-2", "Ben")])).toBeNull();
    });
});
