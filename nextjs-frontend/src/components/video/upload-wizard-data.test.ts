import { beforeEach, describe, expect, it, vi } from "vitest";

const people = vi.hoisted(() => ({ getFighter: vi.fn(), listFighters: vi.fn() }));

vi.mock("@/lib/services/people", () => people);
vi.mock("@/lib/services/training", () => ({ listSessions: vi.fn(async () => []) }));
vi.mock("@/lib/services/admin", () => ({ getSettings: vi.fn(async () => ({ allowedVideoFormats: ["mp4"], videoMaxSizeMb: 500 })) }));
vi.mock("@/lib/services/medical", () => ({ getClearanceStatus: vi.fn(async () => ({ clearance: null, state: "full" })) }));

import type { Fighter, User } from "@/lib/domain/types";
import { loadUploadWizardData } from "./upload-wizard-data";

const fighterId = "11111111-1111-4111-8111-111111111111";
const self = {
    id: fighterId,
    name: "An Nguyen",
    nickname: null,
    weightClass: "lightweight",
    stance: "orthodox",
    level: "amateur",
    healthStatus: "healthy",
} as Fighter;

function signedIn(role: User["role"], profileId: string | null): User {
    return {
        id: "22222222-2222-4222-8222-222222222222",
        email: "an@example.test",
        name: "An Nguyen",
        role,
        title: role,
        phone: null,
        status: "active",
        createdAt: "2026-01-01T00:00:00.000Z",
        lastActiveAt: null,
        profileId,
    };
}

describe("upload wizard fighters", () => {
    beforeEach(() => {
        people.getFighter.mockReset().mockResolvedValue(self);
        people.listFighters.mockReset().mockResolvedValue([self]);
    });

    it("gives a fighter their own profile without reading the fighter directory", async () => {
        const data = await loadUploadWizardData(signedIn("fighter", fighterId));

        expect(people.getFighter).toHaveBeenCalledWith(fighterId);
        expect(people.listFighters).not.toHaveBeenCalled();
        expect(data.fighters.map((fighter) => fighter.id)).toEqual([fighterId]);
    });

    it("offers no fighter to a fighter account without a profile", async () => {
        const data = await loadUploadWizardData(signedIn("fighter", null));

        expect(people.getFighter).not.toHaveBeenCalled();
        expect(people.listFighters).not.toHaveBeenCalled();
        expect(data.fighters).toEqual([]);
    });

    it("still offers a coach their roster", async () => {
        const coach = signedIn("coach", "33333333-3333-4333-8333-333333333333");
        await loadUploadWizardData(coach);

        expect(people.listFighters).toHaveBeenCalledWith(coach);
        expect(people.getFighter).not.toHaveBeenCalled();
    });
});
