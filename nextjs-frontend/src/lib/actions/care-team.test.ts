import { beforeEach, describe, expect, it, vi } from "vitest";

const careTeam = vi.hoisted(() => ({ assignStaff: vi.fn(), endAssignment: vi.fn(), getCareTeam: vi.fn() }));
const revalidatePath = vi.hoisted(() => vi.fn());
const authorizeAction = vi.hoisted(() => vi.fn());

vi.mock("@/lib/services/care-team", () => careTeam);
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/lib/auth/session", async (loadOriginal) => ({ ...(await loadOriginal<typeof import("@/lib/auth/session")>()), authorizeAction }));

import { assignCareTeamMemberAction } from "./care-team";
import { IDLE } from "./state";

const fighterId = "33333333-3333-4333-8333-000000000001";

function form(fields: Record<string, string | string[]>): FormData {
    const data = new FormData();
    for (const [name, value] of Object.entries(fields)) for (const item of [value].flat()) data.append(name, item);
    return data;
}

const doctor = (staffId: string, name: string) => ({ assignmentId: `a-${staffId}`, staffId, name, since: null, primary: false });

describe("assignCareTeamMemberAction", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        authorizeAction.mockResolvedValue({ ok: true, user: { id: "admin-1", role: "admin" } });
        careTeam.assignStaff.mockResolvedValue({ ok: true });
    });

    it("assigns when the team is still the one the administrator saw", async () => {
        careTeam.getCareTeam.mockResolvedValue({ coach: [], doctor: [] });

        const result = await assignCareTeamMemberAction(IDLE, form({ fighterId, role: "doctor", staffId: "d-1" }));

        expect(result).toMatchObject({ status: "success" });
        expect(careTeam.assignStaff).toHaveBeenCalledWith(fighterId, "doctor", "d-1", expect.objectContaining({ id: "admin-1" }));
    });

    it("writes nothing when someone else assigned a doctor meanwhile, and reloads the care team", async () => {
        careTeam.getCareTeam.mockResolvedValue({ coach: [], doctor: [doctor("d-2", "Dr Minh Tran")] });

        const result = await assignCareTeamMemberAction(IDLE, form({ fighterId, role: "doctor", staffId: "d-1" }));

        expect(result).toMatchObject({ status: "error", message: expect.stringContaining("Dr Minh Tran was assigned as sports doctor") });
        expect(careTeam.assignStaff).not.toHaveBeenCalled();
        expect(revalidatePath).toHaveBeenCalledWith("/admin/users/[userId]", "page");
    });

    it("adds another doctor on purpose when the administrator already saw the current one", async () => {
        careTeam.getCareTeam.mockResolvedValue({ coach: [], doctor: [doctor("d-2", "Dr Minh Tran")] });

        await expect(assignCareTeamMemberAction(IDLE, form({ fighterId, role: "doctor", staffId: "d-1", expected: ["d-2"] }))).resolves.toMatchObject({ status: "success" });
    });

    it("leaves the check to the write when the team can't be read, and refuses without permission", async () => {
        careTeam.getCareTeam.mockResolvedValue({ coach: [], doctor: null });
        await expect(assignCareTeamMemberAction(IDLE, form({ fighterId, role: "doctor", staffId: "d-1" }))).resolves.toMatchObject({ status: "success" });

        authorizeAction.mockResolvedValue({ ok: false, message: "You don't have permission to do this." });
        careTeam.assignStaff.mockClear();
        await expect(assignCareTeamMemberAction(IDLE, form({ fighterId, role: "doctor", staffId: "d-1" }))).resolves.toMatchObject({ status: "error" });
        expect(careTeam.assignStaff).not.toHaveBeenCalled();
    });
});
