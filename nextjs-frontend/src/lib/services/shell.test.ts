import { beforeEach, describe, expect, it, vi } from "vitest";

const authenticatedApiRequest = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api/client", () => ({ authenticatedApiRequest }));

import type { User } from "@/lib/domain/types";
import { getNavBadgeCounts } from "./shell";

const user: User = {
    id: "11111111-1111-4111-8111-111111111111",
    email: "coach@example.test",
    name: "Coach Test",
    role: "coach",
    title: "Coach",
    phone: null,
    status: "active",
    createdAt: "2026-01-01T00:00:00.000Z",
    lastActiveAt: null,
    profileId: "22222222-2222-4222-8222-222222222222",
};

describe("navigation badge API adapter", () => {
    beforeEach(() => {
        vi.stubEnv("APP_DATA_MODE", "api");
        authenticatedApiRequest.mockReset();
    });

    it("đọc bộ đếm đã được backend phân quyền", async () => {
        authenticatedApiRequest.mockResolvedValue({ notifications: 3, reviewQueue: 2 });

        await expect(getNavBadgeCounts(user)).resolves.toEqual({ notifications: 3, reviewQueue: 2 });
        expect(authenticatedApiRequest).toHaveBeenCalledWith("/navigation/badges", expect.anything());
    });

    it("không quay lại kho dữ liệu demo khi API bị lỗi", async () => {
        authenticatedApiRequest.mockRejectedValue(new Error("backend unavailable"));

        await expect(getNavBadgeCounts(user)).rejects.toThrow("backend unavailable");
    });
});
