import { beforeEach, describe, expect, it, vi } from "vitest";

const apiRequest = vi.hoisted(() => vi.fn());
const setSessionCookies = vi.hoisted(() => vi.fn());
const navigation = vi.hoisted(() => ({
    redirect: vi.fn((href: string) => {
        throw new Error(`redirect:${href}`);
    }),
}));

vi.mock("@/lib/api/client", async (loadOriginal) => ({ ...(await loadOriginal<typeof import("@/lib/api/client")>()), apiRequest }));
vi.mock("@/lib/auth/session-cookies", () => ({ setSessionCookies, clearSessionCookies: vi.fn() }));
vi.mock("next/navigation", () => navigation);

import { ApiError } from "@/lib/api/client";
import { registerAction, signIn } from "./auth";
import { IDLE } from "./state";

function form(fields: Record<string, string>): FormData {
    const data = new FormData();
    for (const [name, value] of Object.entries(fields)) data.set(name, value);
    return data;
}

const session = { accessToken: "access", refreshToken: "refresh", expiresAt: 1_900_000_000, expiresIn: 3600, tokenType: "bearer" };
const registration = { email: "New@Example.TEST", newPassword: "a long password", confirmPassword: "a long password" };

describe("registration and sign-in in API mode", () => {
    beforeEach(() => {
        vi.stubEnv("APP_DATA_MODE", "api");
        apiRequest.mockReset();
        setSessionCookies.mockReset();
    });

    it("registers an applicant and opens their application page", async () => {
        apiRequest.mockResolvedValue({ user: {}, session, confirmationRequired: false });

        await expect(registerAction(IDLE, form(registration))).rejects.toThrow("redirect:/apply");
        expect(apiRequest).toHaveBeenCalledWith("/auth/register", expect.anything(), expect.objectContaining({ body: JSON.stringify({ email: "new@example.test", password: "a long password" }) }));
        expect(setSessionCookies).toHaveBeenCalledWith(session);
    });

    it("asks a new account to confirm its email before signing in", async () => {
        apiRequest.mockResolvedValue({ user: {}, session: null, confirmationRequired: true });

        await expect(registerAction(IDLE, form(registration))).rejects.toThrow("redirect:/login?notice=confirm-email");
        expect(setSessionCookies).not.toHaveBeenCalled();
    });

    it("checks the passwords match and explains an email the auth service refuses", async () => {
        await expect(registerAction(IDLE, form({ ...registration, confirmPassword: "something else" }))).resolves.toMatchObject({ fieldErrors: { confirmPassword: "The passwords don't match." } });

        apiRequest.mockRejectedValue(new ApiError({ message: "Conflict", kind: "http", status: 409, code: "REGISTRATION_CONFLICT" }));
        await expect(registerAction(IDLE, form(registration))).resolves.toMatchObject({ fieldErrors: { email: expect.stringContaining("already have an account") } });
    });

    it("sends a signed-in applicant to their application, whatever ?next= says", async () => {
        apiRequest.mockResolvedValue({ user: { id: "11111111-1111-4111-8111-111111111111", authSubject: "sub", email: "new@example.test", role: "GUEST" }, session });

        await expect(signIn(IDLE, form({ email: "new@example.test", password: "a long password", next: "/coach/dashboard" }))).rejects.toThrow("redirect:/apply");
    });
});
