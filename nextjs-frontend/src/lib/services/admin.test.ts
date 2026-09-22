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
import { listUsers, updateRolePermissions } from "./admin";

const actor = {} as User;
const backendUser = {
    id: "11111111-1111-4111-8111-111111111111",
    email: "admin@example.test",
    role: "ADMIN",
    isActive: true,
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-02T00:00:00.000Z",
    deletedAt: null,
    profile: null,
    phone: null,
    status: "ACTIVE",
    displayName: "Nora Whitfield",
    lastActiveAt: "2026-09-20T00:00:00.000Z",
    title: "Administrator",
    effectiveCapabilities: ["users:manage", "roles:manage"],
    assignmentScope: { fighterIds: [] },
};

describe("admin API adapter", () => {
    beforeEach(() => {
        vi.stubEnv("APP_DATA_MODE", "api");
        authenticatedApiRequest.mockReset();
        authenticatedMutableApiRequest.mockReset();
        drainAuthenticatedCursorPages.mockReset();
    });

    it("lay nguoi dung bang bo loc backend va chuyen enum vai tro", async () => {
        drainAuthenticatedCursorPages.mockResolvedValue([backendUser]);

        await expect(listUsers({ role: "admin", status: "active", search: "admin" })).resolves.toEqual([
            expect.objectContaining({ name: "Nora Whitfield", role: "admin", status: "active", title: "Administrator" }),
        ]);
        expect(drainAuthenticatedCursorPages).toHaveBeenCalledWith(
            "/users?search=admin&role=ADMIN&status=ACTIVE",
            expect.anything(),
        );
    });

    it("thay the toan bo quyen cua vai tro trong mot yeu cau", async () => {
        authenticatedMutableApiRequest.mockResolvedValue({
            role: "COACH",
            label: "Coach",
            description: "Training staff",
            permissions: ["fighters:read", "training:write"],
        });

        await expect(updateRolePermissions("coach", ["fighters:read", "training:write"], actor)).resolves.toEqual({
            ok: true,
            role: expect.objectContaining({ role: "coach", permissions: ["fighters:read", "training:write"] }),
        });
        expect(authenticatedMutableApiRequest).toHaveBeenCalledWith(
            "/authorization/roles/COACH/permissions",
            expect.anything(),
            expect.objectContaining({ method: "PUT" }),
        );
    });

    it("khong lui ve du lieu demo khi API loi", async () => {
        drainAuthenticatedCursorPages.mockRejectedValue(new Error("backend unavailable"));

        await expect(listUsers()).rejects.toThrow("backend unavailable");
    });
});
