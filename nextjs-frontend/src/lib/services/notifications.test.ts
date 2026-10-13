import { beforeEach, describe, expect, it, vi } from "vitest";

const authenticatedApiRequest = vi.hoisted(() => vi.fn());
const authenticatedMutableApiRequest = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api/client", async (loadOriginal) => ({
    ...(await loadOriginal<typeof import("@/lib/api/client")>()),
    authenticatedApiRequest,
    authenticatedMutableApiRequest,
}));

import { ApiError } from "@/lib/api/client";
import { canMarkAllNotificationsRead, getNotificationBell, getNotificationPage, getUnreadNotificationCount, markNotificationRead } from "./notifications";

const notification = (type: string, payload: object = {}, readAt: string | null = null) => ({
    id: `n-${type}`,
    type,
    title: "Title",
    message: "Message",
    payload,
    isRead: readAt !== null,
    readAt,
    createdAt: "2026-10-05T03:00:00.000Z",
});

const page = (data: object[], total = data.length) => ({ data, total, hasNextPage: false });

/** Answers each route like the service: the inbox page, or the unread count. */
function respond(inbox: object, unread: number) {
    authenticatedApiRequest.mockImplementation(async (path: string, schema: { parse: (value: unknown) => unknown }) =>
        schema.parse(path.startsWith("/notifications/unread-count") ? { count: unread } : inbox),
    );
}

describe("notifications in API mode", () => {
    beforeEach(() => {
        vi.stubEnv("APP_DATA_MODE", "api");
        authenticatedApiRequest.mockReset();
        authenticatedMutableApiRequest.mockReset();
    });

    it("reads one page of the inbox, links each event into the reader's own area and counts unread separately", async () => {
        respond(
            page(
                [
                    notification("TRAINING_SESSION_CANCELLED", { v: 1, target: { type: "TRAINING_SESSION", id: "s-1" } }),
                    notification("ADMISSION_DECISION_RECORDED", { v: 1, target: { type: "FIGHTER_APPLICATION", id: "app-1" }, data: { decision: "APPROVED" } }),
                    notification("ANOMALY_HIGH", {}, "2026-10-05T04:00:00.000Z"),
                ],
                23,
            ),
            2,
        );

        const result = await getNotificationPage({ id: "u-1", role: "fighter" }, { page: 2, pageSize: 20, unreadOnly: false });

        expect(authenticatedApiRequest).toHaveBeenCalledWith("/notifications?page=2&limit=20", expect.anything());
        expect(result).toMatchObject({ page: 2, pageCount: 2, total: 23, all: 23, unread: 2, categories: null });
        expect(result.items).toEqual([
            expect.objectContaining({ userId: "u-1", category: "training", severity: "warning", body: "Message", href: "/fighter/training/sessions/s-1" }),
            expect.objectContaining({ category: "admission", severity: "success", href: null }),
            expect.objectContaining({ category: "ai_alert", severity: "danger", href: null, readAt: "2026-10-05T04:00:00.000Z" }),
        ]);
    });

    it("asks the service for unread only, and leaves the overall total unknown", async () => {
        respond(page([], 0), 0);

        await expect(getNotificationPage({ id: "u-1", role: "coach" }, { page: 1, pageSize: 20, unreadOnly: true })).resolves.toMatchObject({ all: null, total: 0 });
        expect(authenticatedApiRequest).toHaveBeenCalledWith("/notifications?page=1&limit=20&unreadOnly=true", expect.anything());
    });

    it("shows the last page when the requested one is past the end", async () => {
        authenticatedApiRequest.mockImplementation(async (path: string, schema: { parse: (value: unknown) => unknown }) =>
            schema.parse(path.startsWith("/notifications/unread-count") ? { count: 19 } : page(path.includes("page=1&") ? [notification("TRAINING_PLAN_ACTIVATED")] : [], 19)),
        );

        await expect(getNotificationPage({ id: "u-1", role: "coach" }, { page: 3, pageSize: 20, unreadOnly: true })).resolves.toMatchObject({ page: 1, pageCount: 1, total: 19, items: [{ category: "training" }] });
        expect(authenticatedApiRequest).toHaveBeenCalledWith("/notifications?page=3&limit=20&unreadOnly=true", expect.anything());
        expect(authenticatedApiRequest).toHaveBeenCalledWith("/notifications?page=1&limit=20&unreadOnly=true", expect.anything());
    });

    it("counts unread notifications for polling straight from the service", async () => {
        respond(page([]), 4);
        await expect(getUnreadNotificationCount()).resolves.toBe(4);
        expect(authenticatedApiRequest).toHaveBeenCalledTimes(1);
        expect(authenticatedApiRequest).toHaveBeenCalledWith("/notifications/unread-count", expect.anything());
    });

    it("sends an applicant to their application and an admin to the application they act on", async () => {
        const decided = notification("ADMISSION_ASSESSMENT_RESULT", { v: 1, target: { type: "FIGHTER_APPLICATION", id: "app-1" }, data: { conclusion: "FAIL" } });
        respond(page([decided]), 1);
        await expect(getNotificationPage({ id: "g-1", role: "applicant" }, { page: 1, pageSize: 6, unreadOnly: false })).resolves.toMatchObject({
            items: [{ href: "/apply", severity: "warning" }],
        });
        await expect(getNotificationPage({ id: "a-1", role: "admin" }, { page: 1, pageSize: 6, unreadOnly: false })).resolves.toMatchObject({
            items: [{ href: "/admin/admissions/app-1" }],
        });
    });

    it("sends an admin from a fighter's doctor or coach reminder to that fighter's care team, never the account list", async () => {
        const reminders = [
            notification("FIGHTER_DOCTOR_ASSIGNMENT_REQUIRED", { v: 1, target: { type: "FIGHTER", id: "f-1" } }),
            { ...notification("ADMISSION_ACTIVATION_COMPLETED", { v: 1, target: { type: "FIGHTER", id: "f-2" }, data: { applicationId: "app-1" } }), id: "n-activated" },
        ];
        respond(page(reminders), 2);

        const admin = await getNotificationPage({ id: "a-1", role: "admin" }, { page: 1, pageSize: 6, unreadOnly: false });
        expect(admin.items).toEqual([
            expect.objectContaining({ category: "medical", severity: "warning", href: "/admin/fighters/f-1", body: "Message" }),
            expect.objectContaining({ category: "admission", severity: "success", href: "/admin/fighters/f-2" }),
        ]);

        const doctor = await getNotificationPage({ id: "d-1", role: "doctor" }, { page: 1, pageSize: 6, unreadOnly: false });
        expect(doctor.items[0]).toMatchObject({ href: "/doctor/fighters/f-1" });
        const fighter = await getNotificationPage({ id: "u-1", role: "fighter" }, { page: 1, pageSize: 6, unreadOnly: false });
        expect(fighter.items[0]).toMatchObject({ href: null });
    });

    it("marks one notification read and treats a missing one as gone", async () => {
        authenticatedMutableApiRequest.mockResolvedValueOnce(notification("TRAINING_PLAN_ACTIVATED", {}, "2026-10-05T05:00:00.000Z"));
        await expect(markNotificationRead({ id: "u-1", role: "fighter" }, "n-1")).resolves.toBe(true);
        expect(authenticatedMutableApiRequest).toHaveBeenCalledWith("/notifications/n-1/read", expect.anything(), { method: "PATCH" });

        authenticatedMutableApiRequest.mockRejectedValueOnce(new ApiError({ message: "Not found", kind: "http", status: 404, code: "NOTIFICATION_NOT_FOUND" }));
        await expect(markNotificationRead({ id: "u-1", role: "fighter" }, "n-2")).resolves.toBe(false);
    });

    it("streams in API mode, has no 'mark all read', and leaves the bell out when the service fails", async () => {
        expect(canMarkAllNotificationsRead()).toBe(false);
        respond(page([]), 0);
        await expect(getNotificationBell({ id: "u-1", role: "doctor" })).resolves.toMatchObject({ live: true, canMarkAllRead: false, allHref: "/notifications" });
        await expect(getNotificationBell({ id: "g-1", role: "applicant" })).resolves.toMatchObject({ allHref: null });

        authenticatedApiRequest.mockRejectedValue(new ApiError({ message: "Down", kind: "http", status: 503, code: "SERVICE_UNAVAILABLE" }));
        await expect(getNotificationBell({ id: "u-1", role: "doctor" })).resolves.toBeNull();
    });
});
