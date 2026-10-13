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
import { requestAdmissionCodeAction, signIn, verifyAdmissionCodeAction } from "./auth";
import { IDLE, type ActionState } from "./state";

function form(fields: Record<string, string>): FormData {
    const data = new FormData();
    for (const [name, value] of Object.entries(fields)) data.set(name, value);
    return data;
}

const session = { accessToken: "access", refreshToken: "refresh", expiresAt: 1_900_000_000, expiresIn: 3600, tokenType: "bearer" };
/** The code request's own idle state: it answers with the email the code went to. */
const CODE_IDLE: ActionState<{ email: string }> = { status: "idle" };

const guest = { id: "11111111-1111-4111-8111-111111111111", authSubject: "sub", email: "new@example.test", role: "GUEST" };

describe("applicant email codes and sign-in in API mode", () => {
    beforeEach(() => {
        vi.stubEnv("APP_DATA_MODE", "api");
        apiRequest.mockReset();
        setSessionCookies.mockReset();
    });

    it("asks for a code with the email as typed, and answers the same whatever the account", async () => {
        apiRequest.mockResolvedValue({ requested: true });

        await expect(requestAdmissionCodeAction(CODE_IDLE, form({ email: " New@Example.TEST " }))).resolves.toMatchObject({ status: "success", data: { email: "new@example.test" } });
        expect(apiRequest).toHaveBeenCalledWith("/auth/admission/email-code", expect.anything(), expect.objectContaining({ body: JSON.stringify({ email: "new@example.test" }) }));

        apiRequest.mockRejectedValue(new ApiError({ message: "Too many requests", kind: "http", status: 429, code: "TOO_MANY_REQUESTS" }));
        await expect(requestAdmissionCodeAction(CODE_IDLE, form({ email: "new@example.test" }))).resolves.toMatchObject({ status: "error", message: expect.stringContaining("Wait a minute") });
    });

    it("signs the applicant in with the code and opens their application", async () => {
        apiRequest.mockResolvedValue({ user: guest, session });

        await expect(verifyAdmissionCodeAction(IDLE, form({ email: "new@example.test", token: " 123456 " }))).rejects.toThrow("redirect:/apply");
        expect(apiRequest).toHaveBeenCalledWith("/auth/admission/verify-email", expect.anything(), expect.objectContaining({ body: JSON.stringify({ email: "new@example.test", token: "123456" }) }));
        expect(setSessionCookies).toHaveBeenCalledWith(session);
    });

    it("checks the code's format and explains a wrong, expired or used code on the code field", async () => {
        await expect(verifyAdmissionCodeAction(IDLE, form({ email: "new@example.test", token: "12ab" }))).resolves.toMatchObject({ fieldErrors: { token: expect.stringContaining("6 to 10 digits") } });
        expect(apiRequest).not.toHaveBeenCalled();

        apiRequest.mockRejectedValue(new ApiError({ message: "Invalid credentials", kind: "http", status: 401, code: "INVALID_CREDENTIALS" }));
        await expect(verifyAdmissionCodeAction(IDLE, form({ email: "new@example.test", token: "123456" }))).resolves.toMatchObject({ fieldErrors: { token: expect.stringContaining("Send a new code") } });
        expect(setSessionCookies).not.toHaveBeenCalled();
    });

    it("asks a rate-limited sign-in to wait instead of showing the service's error", async () => {
        apiRequest.mockRejectedValue(new ApiError({ message: "ThrottlerException: Too Many Requests", kind: "http", status: 429, code: "HTTP_429" }));

        await expect(signIn(IDLE, form({ email: "rafael.costa@example.test", password: "a long password" }))).resolves.toMatchObject({
            status: "error",
            message: "Too many attempts in a short time. Wait a minute, then try again.",
        });
    });

    it("sends a signed-in applicant to their application, whatever ?next= says", async () => {
        apiRequest.mockResolvedValue({ user: guest, session });

        await expect(signIn(IDLE, form({ email: "new@example.test", password: "a long password", next: "/coach/dashboard" }))).rejects.toThrow("redirect:/apply");
    });
});
