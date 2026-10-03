import { beforeEach, describe, expect, it, vi } from "vitest";

const apiRequest = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api/client", async (loadOriginal) => ({ ...(await loadOriginal<typeof import("@/lib/api/client")>()), apiRequest }));

import { ApiError } from "@/lib/api/client";
import { requestPasswordRecovery, resetPassword } from "./password-recovery";

const refused = (status: number, code: string) => new ApiError({ message: "Refused", kind: "http", status, code });

describe("password recovery in API mode", () => {
    beforeEach(() => {
        vi.stubEnv("APP_DATA_MODE", "api");
        apiRequest.mockReset();
    });

    it("asks the auth service to email a link, with the email normalised", async () => {
        apiRequest.mockResolvedValue({ requested: true });

        await expect(requestPasswordRecovery("  An@Example.TEST ")).resolves.toEqual({ ok: true });
        expect(apiRequest).toHaveBeenCalledWith("/auth/forgot-password", expect.anything(), expect.objectContaining({ method: "POST", body: JSON.stringify({ email: "an@example.test" }) }));
    });

    it("sets a new password from the link's token and passes on a pending fighter activation", async () => {
        apiRequest.mockResolvedValue({ passwordUpdated: true, admissionActivationReady: true });

        await expect(resetPassword("token-hash-from-the-link", "a long new password")).resolves.toEqual({ ok: true, admissionActivationReady: true });
        expect(apiRequest).toHaveBeenCalledWith(
            "/auth/reset-password",
            expect.anything(),
            expect.objectContaining({ body: JSON.stringify({ tokenHash: "token-hash-from-the-link", newPassword: "a long new password" }) }),
        );
    });

    it("explains an expired link and puts password refusals on the password field", async () => {
        apiRequest.mockRejectedValueOnce(refused(401, "UNAUTHORIZED"));
        await expect(resetPassword("token-hash-from-the-link", "a long new password")).resolves.toMatchObject({ ok: false, message: expect.stringContaining("expired") });

        apiRequest.mockRejectedValueOnce(refused(409, "RESET_PASSWORD_SAME_AS_CURRENT"));
        await expect(resetPassword("token-hash-from-the-link", "a long new password")).resolves.toMatchObject({ ok: false, field: "newPassword" });

        apiRequest.mockRejectedValueOnce(refused(422, "RESET_PASSWORD_TOO_WEAK"));
        await expect(resetPassword("token-hash-from-the-link", "a long new password")).resolves.toMatchObject({ ok: false, field: "newPassword" });
    });

    it("doesn't reveal whether an account exists when the service is down", async () => {
        apiRequest.mockRejectedValue(refused(500, "INTERNAL"));

        await expect(requestPasswordRecovery("an@example.test")).resolves.toEqual({ ok: false, message: expect.not.stringContaining("account") });
    });
});
