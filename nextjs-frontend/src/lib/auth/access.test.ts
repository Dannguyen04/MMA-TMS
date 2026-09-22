import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Fighter, Permission, Role, User } from "@/lib/domain/types";
import { accessibleFighterIds, canAccessFighter, canAccessFighterClinically, requireFighterAccess } from "./access";

const { getFighter, notFound } = vi.hoisted(() => ({
    getFighter: vi.fn(),
    notFound: vi.fn((): never => {
        throw new Error("NOT_FOUND");
    }),
}));

vi.mock("next/navigation", () => ({ notFound }));
vi.mock("@/lib/services/people", () => ({ getFighter }));

function user(role: Role, permissions: Permission[] = [], fighterIds?: string[]): User {
    return {
        id: `${role}-user`,
        email: `${role}@example.com`,
        name: role,
        role,
        title: "",
        phone: null,
        status: "active",
        createdAt: "2026-01-01T00:00:00.000Z",
        lastActiveAt: null,
        profileId: role === "admin" ? null : `${role}-profile`,
        effectiveCapabilities: permissions,
        assignmentScope: fighterIds ? { fighterIds } : undefined,
    };
}

describe("fighter access", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("fails closed when effective capabilities are absent", () => {
        const coach = user("coach", [], ["fighter-1"]);

        expect(accessibleFighterIds(coach)).toEqual([]);
        expect(canAccessFighter(coach, "fighter-1")).toBe(false);
    });

    it("uses the backend assignment scope for coaches and doctors", () => {
        const coach = user("coach", ["fighters:read"], ["fighter-1"]);
        const doctor = user("doctor", ["fighters:read"], ["fighter-2"]);

        expect(accessibleFighterIds(coach)).toEqual(["fighter-1"]);
        expect(canAccessFighter(coach, "fighter-2")).toBe(false);
        expect(accessibleFighterIds(doctor)).toEqual(["fighter-2"]);
    });

    it("fails closed when an assigned role has no backend scope", () => {
        expect(accessibleFighterIds(user("coach", ["fighters:read"]))).toEqual([]);
        expect(accessibleFighterIds(user("doctor", ["fighters:read"]))).toEqual([]);
    });

    it("limits fighters to their own profile and gates admins by capability", () => {
        const fighter = user("fighter", ["fighters:read"]);

        expect(accessibleFighterIds(fighter)).toEqual(["fighter-profile"]);
        expect(canAccessFighter(fighter, "another-fighter")).toBe(false);
        expect(accessibleFighterIds(user("admin", ["fighters:read"]))).toBe("all");
        expect(accessibleFighterIds(user("admin"))).toEqual([]);
    });

    it("requires doctor role, medical permission, and assignment for clinical access", () => {
        const assignedDoctor = user("doctor", ["fighters:read", "medical:read"], ["fighter-1"]);

        expect(canAccessFighterClinically(assignedDoctor, "fighter-1")).toBe(true);
        expect(canAccessFighterClinically(assignedDoctor, "fighter-2")).toBe(false);
        expect(canAccessFighterClinically(user("doctor", ["fighters:read"], ["fighter-1"]), "fighter-1")).toBe(false);
        expect(canAccessFighterClinically(user("admin", ["medical:read"], ["fighter-1"]), "fighter-1")).toBe(false);
    });

    it("loads an allowed fighter through the people service", async () => {
        const fighter = { id: "fighter-1" } as Fighter;
        getFighter.mockResolvedValueOnce(fighter);

        await expect(requireFighterAccess(user("coach", ["fighters:read"], [fighter.id]), fighter.id)).resolves.toBe(fighter);
        expect(getFighter).toHaveBeenCalledWith(fighter.id);
    });

    it("does not load a fighter outside the authenticated scope", async () => {
        await expect(requireFighterAccess(user("coach", ["fighters:read"], ["fighter-1"]), "fighter-2")).rejects.toThrow("NOT_FOUND");
        expect(getFighter).not.toHaveBeenCalled();
    });
});
