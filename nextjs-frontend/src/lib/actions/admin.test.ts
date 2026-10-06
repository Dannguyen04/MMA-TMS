import { beforeEach, describe, expect, it, vi } from "vitest";

const services = vi.hoisted(() => ({ inviteUser: vi.fn(), updateUser: vi.fn(), setUserStatus: vi.fn(), resendInvite: vi.fn() }));
const accountServices = vi.hoisted(() => ({ createAccount: vi.fn(), updateAccount: vi.fn(), deleteAccount: vi.fn() }));
const careTeam = vi.hoisted(() => ({ assignStaff: vi.fn(), endAssignment: vi.fn() }));
const navigation = vi.hoisted(() => ({
    redirect: vi.fn((href: string) => {
        throw new Error(`redirect:${href}`);
    }),
}));

vi.mock("@/lib/services/admin", async (loadOriginal) => ({ ...(await loadOriginal<typeof import("@/lib/services/admin")>()), ...services, ...accountServices }));
vi.mock("@/lib/services/care-team", () => careTeam);
vi.mock("next/navigation", () => navigation);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/session", async (loadOriginal) => ({
    ...(await loadOriginal<typeof import("@/lib/auth/session")>()),
    authorizeAction: vi.fn(async () => ({ ok: true, user: { id: "admin-1", role: "admin" } })),
}));

import { ApiError } from "@/lib/api/client";
import { ADMIN_FEATURE_UNAVAILABLE_MESSAGE } from "@/lib/services/admin-features";
import {
    assignStaffAction,
    createAccountAction,
    deleteAccountAction,
    endAssignmentAction,
    inviteUserAction,
    resendInviteAction,
    setUserStatusAction,
    updateAccountAction,
    updateUserAction,
} from "./admin";
import { IDLE } from "./state";

function form(fields: Record<string, string>): FormData {
    const data = new FormData();
    for (const [name, value] of Object.entries(fields)) data.set(name, value);
    return data;
}

describe("account actions in API mode", () => {
    beforeEach(() => {
        vi.stubEnv("APP_DATA_MODE", "api");
        for (const service of Object.values(services)) service.mockReset();
    });

    it.each([
        ["invite", inviteUserAction, { name: "Nora Whitfield", email: "nora@example.test", role: "admin", title: "Operations" }],
        ["edit", updateUserAction, { userId: "user-1", name: "Nora Whitfield", title: "Operations" }],
        ["suspend", setUserStatusAction, { userId: "user-1", status: "suspended" }],
        ["re-invite", resendInviteAction, { userId: "user-1" }],
    ] as const)("refuses to %s an account, since the user service has no route for it yet", async (_, action, fields) => {
        await expect(action(IDLE, form(fields))).resolves.toMatchObject({ status: "error", message: ADMIN_FEATURE_UNAVAILABLE_MESSAGE });
        for (const service of Object.values(services)) expect(service).not.toHaveBeenCalled();
    });
});

describe("accounts in the user service's terms", () => {
    const fighter = {
        role: "fighter",
        email: " Linh@Example.test ",
        password: "a long first password",
        "profile.firstName": "Linh",
        "profile.lastName": "Tran",
        "profile.dateOfBirth": "2001-04-12",
        "profile.weightClass": "lightweight",
        "profile.dominantStance": "",
        "profile.nationality": "",
    };

    beforeEach(() => {
        vi.stubEnv("APP_DATA_MODE", "api");
        for (const service of Object.values(accountServices)) service.mockReset();
        navigation.redirect.mockClear();
    });

    it("creates a fighter account from the form and opens it", async () => {
        accountServices.createAccount.mockResolvedValue({ id: "user-9" });

        await expect(createAccountAction(IDLE, form(fighter))).rejects.toThrow("redirect:/admin/users/user-9?notice=created");
        expect(accountServices.createAccount).toHaveBeenCalledWith({
            email: "linh@example.test",
            password: "a long first password",
            account: expect.objectContaining({
                role: "fighter",
                profile: { firstName: "Linh", lastName: "Tran", dateOfBirth: "2001-04-12", weightClass: "lightweight", dominantStance: null, nationality: null },
            }),
        });
    });

    it("checks the profile fields before asking the service", async () => {
        const state = await createAccountAction(IDLE, form({ ...fighter, password: "short", "profile.dateOfBirth": "2999-01-01", "profile.weightClass": "" }));

        expect(state.fieldErrors).toMatchObject({ password: expect.any(String), "profile.dateOfBirth": expect.stringContaining("future"), "profile.weightClass": "Choose a weight class." });
        expect(accountServices.createAccount).not.toHaveBeenCalled();
    });

    it("creates an administrator from just an email and password", async () => {
        accountServices.createAccount.mockResolvedValue({ id: "user-10" });

        await expect(createAccountAction(IDLE, form({ role: "admin", email: "ops@example.test", password: "a long first password" }))).rejects.toThrow("redirect:");
        expect(accountServices.createAccount).toHaveBeenCalledWith({ email: "ops@example.test", password: "a long first password", account: expect.objectContaining({ role: "admin", profile: null }) });
    });

    it("shows a taken email on the email field", async () => {
        accountServices.createAccount.mockRejectedValue(new ApiError({ message: "Conflict", kind: "http", status: 409, code: "USER_ALREADY_EXISTS" }));

        await expect(createAccountAction(IDLE, form(fighter))).resolves.toMatchObject({ status: "error", fieldErrors: { email: "An account with this email already exists." } });
    });

    it("saves a coach's profile under the same role", async () => {
        accountServices.updateAccount.mockResolvedValue({ name: "Rafael Santos" });

        await expect(
            updateAccountAction(IDLE, form({ userId: "user-2", role: "coach", "profile.firstName": "Rafael", "profile.lastName": "Santos", "profile.isHeadCoach": "on" })),
        ).resolves.toMatchObject({ status: "success" });
        expect(accountServices.updateAccount).toHaveBeenCalledWith("user-2", { role: "coach", profile: { firstName: "Rafael", lastName: "Santos", specialization: null, isHeadCoach: true } });
    });

    it("has no administrator profile to edit", async () => {
        await expect(updateAccountAction(IDLE, form({ userId: "user-1", role: "admin" }))).resolves.toMatchObject({ status: "error" });
        expect(accountServices.updateAccount).not.toHaveBeenCalled();
    });

    it("deletes another account and returns to the list, but never your own", async () => {
        accountServices.deleteAccount.mockResolvedValue(true);
        await expect(deleteAccountAction(IDLE, form({ userId: "user-2" }))).rejects.toThrow("redirect:/admin/users?notice=account-deleted");

        await expect(deleteAccountAction(IDLE, form({ userId: "admin-1" }))).resolves.toMatchObject({ status: "error", message: expect.stringContaining("your own account") });
        expect(accountServices.deleteAccount).toHaveBeenCalledTimes(1);
    });

    it("leaves the demo's invitation flow in place", async () => {
        vi.stubEnv("APP_DATA_MODE", "demo");

        await expect(createAccountAction(IDLE, form(fighter))).resolves.toMatchObject({ message: ADMIN_FEATURE_UNAVAILABLE_MESSAGE });
        expect(accountServices.createAccount).not.toHaveBeenCalled();
    });
});

describe("care team actions", () => {
    beforeEach(() => {
        for (const service of Object.values(careTeam)) service.mockReset();
    });

    it("assigns the chosen coach", async () => {
        careTeam.assignStaff.mockResolvedValue({ ok: true });

        await expect(assignStaffAction(IDLE, form({ fighterId: "fighter-1", role: "coach", staffId: "coach-1" }))).resolves.toMatchObject({ status: "success" });
        expect(careTeam.assignStaff).toHaveBeenCalledWith("fighter-1", "coach", "coach-1", expect.objectContaining({ id: "admin-1" }));
    });

    it("asks for a reason before ending an assignment", async () => {
        const state = await endAssignmentAction(IDLE, form({ fighterId: "fighter-1", role: "doctor", assignmentId: "a-1", reason: "   " }));

        expect(state.fieldErrors).toEqual({ reason: "Enter the reason." });
        expect(careTeam.endAssignment).not.toHaveBeenCalled();
    });

    it("shows the service's refusal on the form", async () => {
        careTeam.endAssignment.mockResolvedValue({ ok: false, message: "This assignment has already ended. Reload the page." });

        await expect(endAssignmentAction(IDLE, form({ fighterId: "fighter-1", role: "doctor", assignmentId: "a-1", reason: "Moved camp" }))).resolves.toMatchObject({
            status: "error",
            message: "This assignment has already ended. Reload the page.",
        });
    });
});
