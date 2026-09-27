import { beforeEach, describe, expect, it, vi } from "vitest";

const authenticatedApiRequest = vi.hoisted(() => vi.fn());
const authenticatedMutableApiRequest = vi.hoisted(() => vi.fn());
const getCurrentUser = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api/client", async (loadOriginal) => {
    const original = await loadOriginal<typeof import("@/lib/api/client")>();
    return { ...original, authenticatedApiRequest, authenticatedMutableApiRequest };
});

vi.mock("@/lib/auth/session", async (loadOriginal) => {
    const original = await loadOriginal<typeof import("@/lib/auth/session")>();
    return { ...original, getCurrentUser };
});

import type { User } from "@/lib/domain/types";
import {
    adaptBackendFighter,
    backendFighterSchema,
    doctorsForFighter,
    listCoaches,
    listFighters,
    updateOwnProfile,
} from "./people";

const fighterId = "11111111-1111-4111-8111-111111111111";
const userId = "22222222-2222-4222-8222-222222222222";
const coachId = "33333333-3333-4333-8333-333333333333";
const doctorId = "44444444-4444-4444-8444-444444444444";

const backendFighter = {
    id: fighterId,
    userId,
    firstName: "An",
    lastName: "Nguyen",
    dateOfBirth: "1995-04-03",
    nationality: "Vietnamese",
    weightClass: "LIGHTWEIGHT" as const,
    heightCm: 175,
    reachCm: 179,
    dominantStance: "SOUTHPAW" as const,
    currentMedicalStatus: "MONITORING" as const,
    isActive: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
    nickname: null,
    sex: "MALE" as const,
    weightKg: 69.8,
    bodyFatPct: 11,
    restingHeartRate: 52,
    level: "SEMI_PRO" as const,
    primaryDiscipline: "Muay Thai",
    record: { wins: 8, losses: 2, draws: 1 },
    coachIds: [coachId],
    primaryCoachId: coachId,
    doctorIds: [doctorId],
    upcomingBout: {
        date: "2026-11-01",
        event: "Saigon Fight Night",
        opponent: "B. Tran",
        weightClass: "LIGHTWEIGHT" as const,
    },
};

const viewer: User = {
    id: userId,
    email: "an@example.test",
    name: "An Nguyen",
    role: "fighter",
    title: "Fighter",
    phone: null,
    status: "active",
    createdAt: "2026-01-01T00:00:00.000Z",
    lastActiveAt: null,
    profileId: fighterId,
};

describe("people API adapter", () => {
    beforeEach(() => {
        vi.stubEnv("APP_DATA_MODE", "api");
        authenticatedApiRequest.mockReset();
        authenticatedMutableApiRequest.mockReset();
        getCurrentUser.mockReset();
    });

    it("chuyển enum backend viết hoa thành mô hình giao diện viết thường", () => {
        const fighter = adaptBackendFighter(backendFighterSchema.parse(backendFighter));

        expect(fighter).toMatchObject({
            name: "An Nguyen",
            weightClass: "lightweight",
            stance: "southpaw",
            level: "semi_pro",
            healthStatus: "monitoring",
            sex: "male",
            targetWeightKg: 70.3,
            upcomingBout: { weightClass: "lightweight" },
        });
    });

    it("gửi bộ lọc theo hợp đồng backend và dùng phạm vi do backend kiểm soát", async () => {
        authenticatedApiRequest.mockResolvedValue({ data: [backendFighter], total: 1, hasNextPage: false });

        await expect(
            listFighters(viewer, { search: "An Nguyen", weightClass: "lightweight", healthStatus: "monitoring" }),
        ).resolves.toHaveLength(1);
        expect(authenticatedApiRequest).toHaveBeenCalledWith(
            "/fighters?page=1&limit=100&search=An+Nguyen&weightClass=LIGHTWEIGHT&medicalStatus=MONITORING",
            expect.anything(),
        );
    });

    it("keeps profile fields the API doesn't return yet as null instead of failing or guessing", () => {
        const current = {
            id: fighterId,
            userId,
            firstName: "An",
            lastName: "Nguyen",
            dateOfBirth: "1995-04-03",
            nationality: null,
            weightClass: "LIGHTWEIGHT" as const,
            heightCm: null,
            reachCm: null,
            dominantStance: null,
            currentMedicalStatus: "HEALTHY" as const,
            isActive: true,
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-02T00:00:00.000Z",
        };
        expect(adaptBackendFighter(backendFighterSchema.parse(current))).toMatchObject({
            name: "An Nguyen",
            nickname: null,
            sex: null,
            weightKg: null,
            stance: null,
            level: null,
            record: null,
            coachIds: [],
            primaryCoachId: null,
            upcomingBout: null,
            targetWeightKg: 70.3,
            healthStatus: "healthy",
        });
    });

    it("builds the coach list from the assignments of fighters in scope, since the API has no coach directory", async () => {
        getCurrentUser.mockResolvedValue({
            ...viewer,
            role: "coach",
            effectiveCapabilities: ["fighters:read"],
            assignmentScope: { fighterIds: [fighterId] },
        });
        authenticatedApiRequest.mockImplementation(async (path: string) => {
            if (path === `/fighters/${fighterId}/coaches`) {
                return [
                    { id: "a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1", coachId, fighterId, startsAt: "2026-01-01T00:00:00.000Z", endsAt: null, coachName: "Rafael Santos" },
                    {
                        id: "b2b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2",
                        coachId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
                        fighterId,
                        startsAt: "2025-01-01T00:00:00.000Z",
                        endsAt: "2025-06-01T00:00:00.000Z",
                        coachName: "Former Coach",
                    },
                ];
            }
            return { data: [], total: 0, hasNextPage: false };
        });

        await expect(listCoaches()).resolves.toEqual([
            { id: coachId, userId: null, name: "Rafael Santos", specialty: "", certifications: [], yearsExperience: null, fighterIds: [fighterId] },
        ]);
        expect(authenticatedApiRequest).not.toHaveBeenCalledWith(expect.stringContaining("/coaches?"), expect.anything());
    });

    it("cập nhật hồ sơ của chính người dùng qua API", async () => {
        authenticatedMutableApiRequest.mockResolvedValue({
            id: userId,
            email: viewer.email,
            role: "FIGHTER",
            isActive: true,
            status: "ACTIVE",
            displayName: "An Updated",
            phone: "+84 912 345 678",
            title: "Fighter",
            lastActiveAt: null,
            createdAt: viewer.createdAt,
            updatedAt: "2026-01-02T00:00:00.000Z",
            deletedAt: null,
            profile: { id: fighterId, firstName: "An", lastName: "Nguyen" },
        });

        await expect(
            updateOwnProfile(userId, { name: "An Updated", phone: "+84 912 345 678" }, viewer),
        ).resolves.toMatchObject({ ok: true, user: { name: "An Updated", phone: "+84 912 345 678" } });
        expect(authenticatedMutableApiRequest).toHaveBeenCalledWith("/users/me", expect.anything(), {
            method: "PATCH",
            body: JSON.stringify({ displayName: "An Updated", phone: "+84 912 345 678" }),
        });
    });

    it("chỉ trả về bác sĩ đang được phân công", async () => {
        authenticatedApiRequest.mockResolvedValue({
            total: 2,
            hasNextPage: false,
            data: [
            {
                id: "55555555-5555-4555-8555-555555555555",
                doctorId,
                fighterId,
                assignedById: userId,
                startsAt: "2026-01-01T00:00:00.000Z",
                endsAt: null,
                endedById: null,
                endReason: null,
                createdAt: "2026-01-01T00:00:00.000Z",
                doctorName: "Thu Le",
            },
            {
                id: "66666666-6666-4666-8666-666666666666",
                doctorId: "77777777-7777-4777-8777-777777777777",
                fighterId,
                assignedById: userId,
                startsAt: "2025-01-01T00:00:00.000Z",
                endsAt: "2025-06-01T00:00:00.000Z",
                endedById: userId,
                endReason: "Care transferred",
                createdAt: "2025-01-01T00:00:00.000Z",
                doctorName: "Former Doctor",
            },
            ],
        });

        // Assignments carry the doctor's profile id and name only; the rest stays empty rather than guessed.
        await expect(doctorsForFighter(fighterId)).resolves.toEqual([
            { id: doctorId, userId: null, name: "Thu Le", specialty: "", licenseNumber: null, fighterIds: [fighterId] },
        ]);
        expect(authenticatedApiRequest).toHaveBeenCalledWith(`/fighters/${fighterId}/doctors?page=1&limit=100`, expect.anything());
    });
});
