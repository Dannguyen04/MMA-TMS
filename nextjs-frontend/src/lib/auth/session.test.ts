import { beforeEach, describe, expect, it, vi } from "vitest";

const authenticatedApiRequest = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api/client", async (loadOriginal) => ({
    ...(await loadOriginal<typeof import("@/lib/api/client")>()),
    authenticatedApiRequest,
}));

import { ApiError } from "@/lib/api/client";
import { getCurrentUser, getSessionAccount } from "./session";

const doctorProfileId = "44444444-4444-4444-8444-444444444444";
const fighterId = "11111111-1111-4111-8111-111111111111";
const account = {
    id: "88888888-8888-4888-8888-888888888888",
    email: "thu.le@example.test",
    role: "DOCTOR",
    isActive: true,
    createdAt: "2026-02-01T00:00:00.000Z",
    updatedAt: "2026-02-03T00:00:00.000Z",
    profile: { id: doctorProfileId, firstName: "Thu", lastName: "Le", specialization: "Sports medicine" },
};

describe("current user in API mode", () => {
    beforeEach(() => {
        vi.stubEnv("APP_DATA_MODE", "api");
        authenticatedApiRequest.mockReset();
    });

    it("scopes a doctor to their assigned roster, since doctors can't list the fighter directory", async () => {
        authenticatedApiRequest.mockImplementation(async (path: string) =>
            path === "/users/me" ? account : { data: [{ id: fighterId }], total: 1, hasNextPage: false },
        );

        await expect(getCurrentUser()).resolves.toMatchObject({ role: "doctor", profileId: doctorProfileId, assignmentScope: { fighterIds: [fighterId] } });
        expect(authenticatedApiRequest).toHaveBeenCalledWith(`/doctors/${doctorProfileId}/fighters?page=1&limit=100`, expect.anything());
    });

    it("gives a coach whose roster is refused no fighters, never all of them", async () => {
        authenticatedApiRequest.mockImplementation(async (path: string) => {
            if (path === "/users/me") return { ...account, role: "COACH", profile: { id: doctorProfileId, firstName: "Rafael", lastName: "Santos" } };
            throw new ApiError({ message: "Forbidden", kind: "http", status: 403, code: "FORBIDDEN" });
        });

        await expect(getCurrentUser()).resolves.toMatchObject({ role: "coach", assignmentScope: { fighterIds: [] } });
        expect(authenticatedApiRequest).toHaveBeenCalledWith("/fighters?page=1&limit=100", expect.anything());
    });

    it("treats a signed-in account that was deleted as signed out instead of failing the page", async () => {
        authenticatedApiRequest.mockRejectedValue(new ApiError({ message: "User not found", kind: "http", status: 404, code: "USER_NOT_FOUND" }));
        await expect(getSessionAccount()).resolves.toBeNull();

        authenticatedApiRequest.mockRejectedValue(new ApiError({ message: "The service can't be reached right now.", kind: "network", code: "API_UNAVAILABLE" }));
        await expect(getSessionAccount()).rejects.toThrow("can't be reached");
    });

    it("treats a self-registered applicant as an applicant, not an academy member", async () => {
        authenticatedApiRequest.mockResolvedValue({ ...account, role: "GUEST", profile: null });

        await expect(getSessionAccount()).resolves.toEqual({ kind: "applicant", applicant: { id: account.id, email: account.email } });
        await expect(getCurrentUser()).resolves.toBeNull();
        expect(authenticatedApiRequest).toHaveBeenCalledWith("/users/me", expect.anything());
    });
});
