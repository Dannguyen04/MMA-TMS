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

import { getNotificationSummary, listNotifications, markAllNotificationsRead } from "./notifications";

const backendNotification = {
    id: "notification-1",
    userId: "user-1",
    category: "AI_ANALYSIS",
    severity: "WARNING",
    title: "Analysis ready",
    body: "Review the latest result.",
    href: "/fighter/videos/video-1",
    createdAt: "2026-09-20T00:00:00.000Z",
    readAt: null,
};

describe("notifications API adapter", () => {
    beforeEach(() => {
        vi.stubEnv("APP_DATA_MODE", "api");
        authenticatedApiRequest.mockReset();
        authenticatedMutableApiRequest.mockReset();
        drainAuthenticatedCursorPages.mockReset();
    });

    it("chuyen danh muc va muc do backend sang giao dien", async () => {
        drainAuthenticatedCursorPages.mockResolvedValue([backendNotification]);

        await expect(listNotifications("user-1", { category: "ai_analysis", unreadOnly: true })).resolves.toEqual([
            expect.objectContaining({ category: "ai_analysis", severity: "warning" }),
        ]);
        expect(drainAuthenticatedCursorPages).toHaveBeenCalledWith(
            "/notifications?category=AI_ANALYSIS&unreadOnly=true",
            expect.anything(),
        );
    });

    it("doc tom tat bang ngu canh chi doc", async () => {
        authenticatedApiRequest.mockResolvedValue({ unread: 1, latest: [backendNotification] });

        await expect(getNotificationSummary("user-1", 4)).resolves.toEqual({
            unread: 1,
            latest: [expect.objectContaining({ id: "notification-1", severity: "warning" })],
        });
        expect(authenticatedApiRequest).toHaveBeenCalledWith("/notifications/summary?limit=4", expect.anything());
    });

    it("tra ve so thong bao da danh dau da doc", async () => {
        authenticatedMutableApiRequest.mockResolvedValue({ count: 3 });

        await expect(markAllNotificationsRead("user-1")).resolves.toBe(3);
        expect(authenticatedMutableApiRequest).toHaveBeenCalledWith(
            "/notifications/read-all",
            expect.anything(),
            { method: "POST" },
        );
    });
});
