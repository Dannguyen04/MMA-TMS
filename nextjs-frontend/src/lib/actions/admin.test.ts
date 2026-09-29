import { beforeEach, describe, expect, it, vi } from "vitest";

const services = vi.hoisted(() => ({ inviteUser: vi.fn(), updateUser: vi.fn(), setUserStatus: vi.fn(), resendInvite: vi.fn() }));

vi.mock("@/lib/services/admin", async (loadOriginal) => ({ ...(await loadOriginal<typeof import("@/lib/services/admin")>()), ...services }));
vi.mock("@/lib/auth/session", async (loadOriginal) => ({
    ...(await loadOriginal<typeof import("@/lib/auth/session")>()),
    authorizeAction: vi.fn(async () => ({ ok: true, user: { id: "admin-1", role: "admin" } })),
}));

import { ADMIN_FEATURE_UNAVAILABLE_MESSAGE } from "@/lib/services/admin-features";
import { inviteUserAction, resendInviteAction, setUserStatusAction, updateUserAction } from "./admin";
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
