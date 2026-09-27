import { describe, expect, it } from "vitest";

import { permissionsForRole } from "./capabilities";
import { ROLE_DEFAULT_PERMISSIONS } from "./permissions";

describe("permissionsForRole", () => {
    it("falls back to the role's baseline when the backend lists no capabilities", () => {
        expect(permissionsForRole("coach", undefined).sort()).toEqual([...ROLE_DEFAULT_PERMISSIONS.coach].sort());
        expect(permissionsForRole("doctor", []).sort()).toEqual([...ROLE_DEFAULT_PERMISSIONS.doctor].sort());
    });

    it("keeps listed interface permissions and ignores unknown names", () => {
        expect(permissionsForRole("coach", ["fighters:read", "training:read", "something.new:do"])).toEqual(["fighters:read", "training:read"]);
    });

    it("adds the baseline when only backend medical names are listed", () => {
        const fighter = permissionsForRole("fighter", ["fighter.medical:read"]);
        expect(fighter).toContain("fighters:read");
        expect(fighter).toContain("medical:read_summary");
        expect(fighter).not.toContain("medical:read");
    });

    it("translates backend medical capabilities and keeps full clinical reads for doctors", () => {
        const doctor = permissionsForRole("doctor", ["fighters:read", "fighter.medical:read", "fighter.medical:write", "fighter.medical_clearance:issue"]);
        expect(doctor).toEqual(expect.arrayContaining(["medical:read_summary", "medical:read", "medical:write", "clearance:manage"]));
    });

    it("never gives clinical permissions to other roles", () => {
        const coach = permissionsForRole("coach", ["fighters:read", "medical:read", "medical:write", "fighter.medical_clearance:issue"]);
        expect(coach).toEqual(["fighters:read"]);
    });
});
