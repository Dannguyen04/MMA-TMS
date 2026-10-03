import { beforeEach, describe, expect, it, vi } from "vitest";

const authenticatedApiRequest = vi.hoisted(() => vi.fn());
const authenticatedMutableApiRequest = vi.hoisted(() => vi.fn());
const drainAuthenticatedCursorPages = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api/client", async (loadOriginal) => ({
    ...(await loadOriginal<typeof import("@/lib/api/client")>()),
    authenticatedApiRequest,
    authenticatedMutableApiRequest,
    drainAuthenticatedCursorPages,
}));

import type { User } from "@/lib/domain/types";
import { PERMISSION_CATALOG, ROLE_DEFINITIONS } from "@/lib/auth/role-catalog";
import { DEFAULT_SYSTEM_SETTINGS } from "@/lib/domain/system-settings";
import { getSettings, getUserDetail, listPermissionCatalog, listRoleDefinitions, listUsers, updateRolePermissions } from "./admin";

const actor = {} as User;
/** Accounts as `GET /users` returns them (the service's `publicUserSchema`). */
const backendUser = {
    id: "11111111-1111-4111-8111-111111111111",
    email: "admin@example.test",
    role: "ADMIN",
    isActive: true,
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-02T00:00:00.000Z",
    deletedAt: null,
    profile: null,
};
const backendCoach = {
    ...backendUser,
    id: "22222222-2222-4222-8222-222222222222",
    email: "rafael@example.test",
    role: "COACH",
    isActive: false,
    profile: { id: "33333333-3333-4333-8333-333333333333", firstName: "Rafael", lastName: "Santos", isHeadCoach: true, specialization: "Striking" },
};
const backendApplicant = { ...backendUser, id: "44444444-4444-4444-8444-444444444444", email: "applicant@example.test", role: "GUEST" };
const usersPage = (items: unknown[]) => ({ items, total: items.length, page: 1, limit: 100 });

describe("admin API adapter", () => {
    beforeEach(() => {
        vi.stubEnv("APP_DATA_MODE", "api");
        authenticatedApiRequest.mockReset();
        authenticatedMutableApiRequest.mockReset();
        drainAuthenticatedCursorPages.mockReset();
    });

    it("lists users with the service's page, role, status and search parameters", async () => {
        authenticatedApiRequest.mockResolvedValue(usersPage([backendUser]));

        await expect(listUsers({ role: "admin", status: "active", search: "admin" })).resolves.toEqual([
            expect.objectContaining({ name: "admin@example.test", role: "admin", status: "active", title: "" }),
        ]);
        expect(authenticatedApiRequest).toHaveBeenCalledWith("/users?page=1&limit=100&search=admin&role=ADMIN&status=ACTIVE", expect.anything());
    });

    it("asks for inactive accounts when filtering suspended ones, and reads them as suspended", async () => {
        authenticatedApiRequest.mockResolvedValue(usersPage([backendCoach]));

        await expect(listUsers({ status: "suspended" })).resolves.toEqual([
            expect.objectContaining({ name: "Rafael Santos", role: "coach", status: "suspended", title: "Striking" }),
        ]);
        expect(authenticatedApiRequest).toHaveBeenCalledWith("/users?page=1&limit=100&status=INACTIVE", expect.anything());
    });

    it("has no invited accounts to list, so it doesn't ask the service", async () => {
        await expect(listUsers({ status: "invited" })).resolves.toEqual([]);
        expect(authenticatedApiRequest).not.toHaveBeenCalled();
    });

    it("leaves self-registered applicants out of the account list", async () => {
        authenticatedApiRequest.mockResolvedValue(usersPage([backendUser, backendApplicant]));

        await expect(listUsers()).resolves.toEqual([expect.objectContaining({ email: "admin@example.test" })]);
    });

    it("reads an account's detail without the audit trail or role permissions the service can't serve yet", async () => {
        authenticatedApiRequest.mockResolvedValue(backendUser);

        await expect(getUserDetail(backendUser.id)).resolves.toMatchObject({ user: { email: "admin@example.test" }, profile: null, recentAudit: [], permissions: [] });
        expect(authenticatedApiRequest).toHaveBeenCalledTimes(1);
        expect(authenticatedApiRequest).toHaveBeenCalledWith(`/users/${backendUser.id}`, expect.anything());
        expect(drainAuthenticatedCursorPages).not.toHaveBeenCalled();
    });

    it("shows each role's baseline grants without asking the service, which can't list them", async () => {
        await expect(listRoleDefinitions()).resolves.toEqual(ROLE_DEFINITIONS);
        await expect(listPermissionCatalog()).resolves.toEqual(PERMISSION_CATALOG);
        expect(authenticatedApiRequest).not.toHaveBeenCalled();
    });

    it("refuses to change a role's permissions, because the service has no role permission list", async () => {
        await expect(updateRolePermissions("coach", ["fighters:read", "training:write"], actor)).rejects.toMatchObject({
            status: 501,
            code: "API_OPERATION_UNSUPPORTED",
        });
        expect(authenticatedMutableApiRequest).not.toHaveBeenCalled();
    });

    it("khong lui ve du lieu demo khi API loi", async () => {
        authenticatedApiRequest.mockRejectedValue(new Error("backend unavailable"));

        await expect(listUsers()).rejects.toThrow("backend unavailable");
    });

    it("uses the default settings without asking the service, which has no settings endpoint", async () => {
        await expect(getSettings()).resolves.toEqual(DEFAULT_SYSTEM_SETTINGS);
        expect(authenticatedApiRequest).not.toHaveBeenCalled();
    });
});
