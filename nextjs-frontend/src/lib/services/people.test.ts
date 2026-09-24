import { beforeEach, describe, expect, it, vi } from "vitest";

const authenticatedApiRequest = vi.hoisted(() => vi.fn());
const authenticatedMutableApiRequest = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api/client", async (loadOriginal) => {
    const original = await loadOriginal<typeof import("@/lib/api/client")>();
    return { ...original, authenticatedApiRequest, authenticatedMutableApiRequest };
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
const doctorUserId = "88888888-8888-4888-8888-888888888888";

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

    it("báo lỗi rõ ràng khi backend chưa trả đủ trường giao diện", () => {
        expect(
            backendFighterSchema.safeParse({
                ...backendFighter,
                nickname: undefined,
                sex: undefined,
                weightKg: undefined,
            }).success,
        ).toBe(false);
    });

    it("không âm thầm dùng dữ liệu demo khi endpoint danh mục chưa tồn tại", async () => {
        authenticatedApiRequest.mockResolvedValue({
            data: [
                {
                    id: coachId,
                    userId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
                    firstName: "Rafael",
                    lastName: "Santos",
                    specialization: "Striking",
                    certifications: ["Level 2"],
                    yearsExperience: 12,
                    fighterIds: [fighterId],
                },
            ],
            total: 1,
            hasNextPage: false,
        });

        await expect(listCoaches()).resolves.toEqual([
            expect.objectContaining({ id: coachId, name: "Rafael Santos", specialty: "Striking", fighterIds: [fighterId] }),
        ]);
        expect(authenticatedApiRequest).toHaveBeenCalledWith("/coaches?page=1&limit=100", expect.anything());
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
        authenticatedApiRequest.mockResolvedValue([
            {
                id: "55555555-5555-4555-8555-555555555555",
                doctorId,
                doctorUserId,
                fighterId,
                assignedById: userId,
                startsAt: "2026-01-01T00:00:00.000Z",
                endsAt: null,
                endedById: null,
                endReason: null,
                createdAt: "2026-01-01T00:00:00.000Z",
                doctorName: "Thu Le",
                doctorSpecialization: "Sports medicine",
                doctorLicenseNumber: "VN-SPORT-001",
            },
            {
                id: "66666666-6666-4666-8666-666666666666",
                doctorId: "77777777-7777-4777-8777-777777777777",
                doctorUserId: "99999999-9999-4999-8999-999999999999",
                fighterId,
                assignedById: userId,
                startsAt: "2025-01-01T00:00:00.000Z",
                endsAt: "2025-06-01T00:00:00.000Z",
                endedById: userId,
                endReason: "Care transferred",
                createdAt: "2025-01-01T00:00:00.000Z",
                doctorName: "Former Doctor",
                doctorSpecialization: null,
                doctorLicenseNumber: "VN-OLD-001",
            },
        ]);

        await expect(doctorsForFighter(fighterId)).resolves.toEqual([
            {
                id: doctorId,
                userId: doctorUserId,
                name: "Thu Le",
                specialty: "Sports medicine",
                licenseNumber: "VN-SPORT-001",
                fighterIds: [fighterId],
            },
        ]);
        expect(authenticatedApiRequest).toHaveBeenCalledWith(
            `/fighters/${fighterId}/doctors`,
            expect.anything(),
        );
    });
});
