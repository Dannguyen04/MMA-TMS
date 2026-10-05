import { beforeEach, describe, expect, it, vi } from "vitest";

const authenticatedApiRequest = vi.hoisted(() => vi.fn());
const authenticatedMutableApiRequest = vi.hoisted(() => vi.fn());
const drainAuthenticatedCursorPages = vi.hoisted(() => vi.fn());
const listVideos = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api/client", async (loadOriginal) => ({
    ...(await loadOriginal<typeof import("@/lib/api/client")>()),
    authenticatedApiRequest,
    authenticatedMutableApiRequest,
    drainAuthenticatedCursorPages,
}));

import type { User } from "@/lib/domain/types";
vi.mock("./videos", () => ({ listVideos }));

import { PERMISSION_CATALOG, ROLE_DEFINITIONS } from "@/lib/auth/role-catalog";
import { DEFAULT_SYSTEM_SETTINGS } from "@/lib/domain/system-settings";
import { ApiError } from "@/lib/api/client";
import {
    createAccount,
    deleteAccount,
    getAdminOverview,
    getSettings,
    getUserDetail,
    inviteUser,
    listPermissionCatalog,
    listRoleDefinitions,
    listUsers,
    setUserStatus,
    updateAccount,
    updateRolePermissions,
} from "./admin";

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

    it("counts accounts and leaves the footage figures empty, not the overview, when the video service fails", async () => {
        authenticatedApiRequest.mockResolvedValue(usersPage([backendUser, backendCoach]));
        listVideos.mockRejectedValueOnce(new ApiError({ message: "Cannot GET /videos", kind: "http", status: 404, code: "NOT_FOUND" }));

        await expect(getAdminOverview(new Date("2026-10-05T00:00:00.000Z"))).resolves.toMatchObject({
            usersByRole: { admin: 1, coach: 1 },
            videosTotal: null,
            videosLast7d: null,
            storageUsedGb: null,
        });
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

    it("leaves self-registered applicants and deleted accounts out of the account list", async () => {
        const deleted = { ...backendCoach, isActive: false, deletedAt: "2026-09-03T00:00:00.000Z" };
        authenticatedApiRequest.mockResolvedValue(usersPage([backendUser, backendApplicant, deleted]));

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

describe("accounts in the user service's terms", () => {
    const coachProfile = { firstName: "Rafael", lastName: "Santos", specialization: "Striking", isHeadCoach: true };

    beforeEach(() => {
        vi.stubEnv("APP_DATA_MODE", "api");
        authenticatedApiRequest.mockReset();
        authenticatedMutableApiRequest.mockReset();
    });

    it("reads the profile an administrator edits along with the account", async () => {
        const responses: Record<string, unknown> = { "/users/me": backendUser, [`/users/${backendCoach.id}`]: { ...backendCoach, isActive: true } };
        authenticatedApiRequest.mockImplementation(async (path: string) => responses[path] ?? usersPage([]));

        await expect(getUserDetail(backendCoach.id)).resolves.toMatchObject({ account: { role: "coach", profile: coachProfile } });
    });

    it("creates an account with its first password and profile", async () => {
        authenticatedMutableApiRequest.mockResolvedValue({ ...backendCoach, isActive: true });

        await expect(createAccount({ email: "Rafael@Example.test", password: "a long first password", account: { role: "coach", profile: coachProfile } })).resolves.toMatchObject({
            name: "Rafael Santos",
            role: "coach",
        });
        expect(authenticatedMutableApiRequest).toHaveBeenCalledWith(
            "/users",
            expect.anything(),
            expect.objectContaining({
                method: "POST",
                body: JSON.stringify({ user: { email: "rafael@example.test", password: "a long first password", role: "COACH", profile: coachProfile } }),
            }),
        );
    });

    it("edits a profile, and reports an account that has gone", async () => {
        authenticatedMutableApiRequest.mockResolvedValueOnce({ ...backendCoach, isActive: true });
        await expect(updateAccount(backendCoach.id, { role: "coach", profile: coachProfile })).resolves.toMatchObject({ role: "coach" });
        expect(authenticatedMutableApiRequest).toHaveBeenCalledWith(`/users/${backendCoach.id}`, expect.anything(), expect.objectContaining({ method: "PATCH" }));

        authenticatedMutableApiRequest.mockRejectedValueOnce(new ApiError({ message: "User not found", kind: "http", status: 404, code: "USER_NOT_FOUND" }));
        await expect(updateAccount(backendCoach.id, { role: "coach", profile: coachProfile })).resolves.toBeNull();
    });

    it("deletes an account, treating one already gone as done", async () => {
        authenticatedMutableApiRequest.mockResolvedValueOnce({ id: backendCoach.id, deleted: true });
        await expect(deleteAccount(backendCoach.id)).resolves.toBe(true);
        expect(authenticatedMutableApiRequest).toHaveBeenCalledWith(`/users/${backendCoach.id}`, expect.anything(), { method: "DELETE" });

        authenticatedMutableApiRequest.mockRejectedValueOnce(new ApiError({ message: "User not found", kind: "http", status: 404, code: "USER_NOT_FOUND" }));
        await expect(deleteAccount(backendCoach.id)).resolves.toBe(false);
    });

    it("doesn't call invitation or suspension routes the service doesn't have", async () => {
        await expect(inviteUser({ name: "Nora", email: "nora@example.test", role: "admin", title: "Ops" }, actor)).rejects.toMatchObject({ status: 501 });
        await expect(setUserStatus(backendCoach.id, "suspended", actor)).rejects.toMatchObject({ status: 501 });
        expect(authenticatedMutableApiRequest).not.toHaveBeenCalled();
    });

    it("runs in API mode only: the demo manages accounts through invitations", async () => {
        vi.stubEnv("APP_DATA_MODE", "demo");

        await expect(deleteAccount(backendCoach.id)).rejects.toThrow("API mode only");
        expect(authenticatedMutableApiRequest).not.toHaveBeenCalled();
    });
});
