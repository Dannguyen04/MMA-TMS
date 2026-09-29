import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DEMO_PASSWORD, DEMO_SESSION_COOKIE } from "./constants";

const cookieValues = new Map<string, string>();

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) => (cookieValues.has(name) ? { value: cookieValues.get(name) } : undefined),
        set: (name: string, value: string) => void cookieValues.set(name, value),
        delete: (name: string) => void cookieValues.delete(name),
    }),
}));

import { db } from "@/lib/mocks/db";
import { DEMO_ACCOUNTS, endDemoSession, readDemoUser, signInDemoAccount, signInDemoWithPassword } from "./demo-session";

describe("demo session", () => {
    beforeEach(() => {
        cookieValues.clear();
        vi.stubEnv("APP_DATA_MODE", "demo");
    });

    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it("signs in a demo account with role capabilities and assigned fighters", async () => {
        await expect(signInDemoAccount("coach")).resolves.toMatchObject({ ok: true });
        expect(cookieValues.get(DEMO_SESSION_COOKIE)).toBe(DEMO_ACCOUNTS.coach);

        const user = await readDemoUser();
        const coachUser = db().users.find((u) => u.id === DEMO_ACCOUNTS.coach)!;
        const coach = db().coaches.find((c) => c.id === coachUser.profileId)!;
        expect(user?.role).toBe("coach");
        expect(user?.effectiveCapabilities).toEqual(db().roleDefinitions.find((r) => r.role === "coach")!.permissions);
        expect(user?.assignmentScope?.fighterIds).toEqual(coach.fighterIds);
    });

    it("accepts the shared demo password and rejects anything else", async () => {
        const email = db().users.find((u) => u.id === DEMO_ACCOUNTS.fighter)!.email;

        await expect(signInDemoWithPassword(email, "wrong")).resolves.toMatchObject({ ok: false });
        expect(cookieValues.has(DEMO_SESSION_COOKIE)).toBe(false);
        await expect(signInDemoWithPassword(email, DEMO_PASSWORD)).resolves.toMatchObject({ ok: true });
    });

    it("refuses accounts that are not active", async () => {
        const invited = db().users.find((u) => u.status === "invited")!;

        await expect(signInDemoWithPassword(invited.email, DEMO_PASSWORD)).resolves.toMatchObject({ ok: false });
        expect(cookieValues.has(DEMO_SESSION_COOKIE)).toBe(false);
    });

    it("never trusts the demo cookie outside demo mode", async () => {
        cookieValues.set(DEMO_SESSION_COOKIE, DEMO_ACCOUNTS.admin);
        vi.stubEnv("APP_DATA_MODE", "api");

        await expect(readDemoUser()).resolves.toBeNull();
        await expect(signInDemoAccount("admin")).resolves.toMatchObject({ ok: false });
    });

    it("clears the session on sign-out", async () => {
        await signInDemoAccount("doctor");
        await endDemoSession();

        expect(cookieValues.has(DEMO_SESSION_COOKIE)).toBe(false);
        await expect(readDemoUser()).resolves.toBeNull();
    });
});
