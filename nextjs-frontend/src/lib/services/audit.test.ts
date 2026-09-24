import { beforeEach, describe, expect, it, vi } from "vitest";

const drainAuthenticatedCursorPages = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api/client", () => ({ drainAuthenticatedCursorPages }));

import { listAuditLogs } from "./audit";

describe("audit API adapter", () => {
    beforeEach(() => {
        vi.stubEnv("APP_DATA_MODE", "api");
        drainAuthenticatedCursorPages.mockReset();
    });

    it("chuyen vai tro, loai tai nguyen va trang thai tu backend", async () => {
        drainAuthenticatedCursorPages.mockResolvedValue([
            {
                id: "log-1",
                actorId: null,
                actorName: "System",
                actorRole: "SYSTEM",
                action: "auth.login_failed",
                resourceType: "AUTH",
                resourceId: "user-1",
                resourceLabel: "Sign in",
                timestamp: "2026-09-20T00:00:00.000Z",
                ipAddress: "127.0.0.1",
                status: "FAILURE",
                details: null,
            },
        ]);

        await expect(listAuditLogs({ actorRole: "system", resourceType: "auth", status: "failure" })).resolves.toEqual([
            expect.objectContaining({ actorRole: "system", resourceType: "auth", status: "failure" }),
        ]);
        expect(drainAuthenticatedCursorPages).toHaveBeenCalledWith(
            "/audit-logs?actorRole=SYSTEM&resourceType=AUTH&status=FAILURE",
            expect.anything(),
        );
    });

    it("khong lui ve nhat ky demo khi API loi", async () => {
        drainAuthenticatedCursorPages.mockRejectedValue(new Error("backend unavailable"));

        await expect(listAuditLogs()).rejects.toThrow("backend unavailable");
    });
});
