import fs from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi as vitest } from "vitest";

import {
    DEFAULT_MANUAL_BLOCKED_SESSION_TYPES,
    SESSION_INTENSITY_TIERS,
    tierOfTrainingType,
} from "@/lib/domain/intensity-tiers";
import { SESSION_TYPES } from "@/lib/domain/medical-contract";
import { sessionTypeFor } from "@/lib/domain/training-contract";
import {
    academyDateOf,
    addDaysToDate,
    classifyReadiness,
    gradedReturnFor,
} from "@/lib/domain/suspension-rules";
import type { Bout, TrainingPlan, User } from "@/lib/domain/types";
import { en } from "@/lib/i18n/messages/en";
import { vi } from "@/lib/i18n/messages/vi";
import { db, nowIso } from "@/lib/mocks/db";
import { ApiError } from "@/lib/api/client";
import {
    applyConflicts,
    backendCreateSuspensionResponseSchema,
    backendReadinessRowSchema,
    backendSuspensionSchema,
    createSuspension,
    getReadiness,
    listSuspensions,
    toSuspensionCreation,
} from "./suspensions";
import { backendSessionSchema, toSession } from "./training";

vitest.mock("next/cache", () => ({ revalidatePath: vitest.fn() }));

vitest.mock("@/lib/i18n/server", async () => {
    const { createTranslator } = await import("@/lib/i18n/translate");
    return { getTranslator: async () => ({ locale: "vi", t: createTranslator("vi") }) };
});

const mockCoach: User = {
    id: "u-coach-rafael",
    email: "coach.rafael@example.com",
    name: "Rafael Costa",
    role: "coach",
    title: "Head Striking Coach",
    phone: null,
    status: "active",
    createdAt: "2026-01-01T00:00:00.000Z",
    lastActiveAt: null,
    profileId: "c-rafael-costa",
    assignmentScope: {
        fighterIds: ["f-diego-alvarez", "f-marcus-hale", "f-lucas-ferreira"],
    },
    effectiveCapabilities: ["fighters:read"],
};

const mockAdmin: User = {
    id: "u-admin-1",
    email: "admin@example.com",
    name: "Admin User",
    role: "admin",
    title: "Administrator",
    phone: null,
    status: "active",
    createdAt: "2026-01-01T00:00:00.000Z",
    lastActiveAt: null,
    profileId: null,
    effectiveCapabilities: ["fighters:read"],
};

const mockDoctorUser: User = {
    id: "u-doctor-samuel",
    email: "samuel@example.com",
    name: "Dr. Samuel Brooks",
    role: "doctor",
    title: "Sports Physician",
    phone: null,
    status: "active",
    createdAt: "2026-01-01T00:00:00.000Z",
    lastActiveAt: null,
    profileId: "d-samuel-brooks",
    assignmentScope: {
        fighterIds: ["f-diego-alvarez"],
    },
    effectiveCapabilities: ["fighters:read", "medical:read"],
};

const mockFighterUser: User = {
    id: "u-fighter-diego",
    email: "diego@example.com",
    name: "Diego Alvarez",
    role: "fighter",
    title: "Pro Fighter",
    phone: null,
    status: "active",
    createdAt: "2026-01-01T00:00:00.000Z",
    lastActiveAt: null,
    profileId: "f-diego-alvarez",
    effectiveCapabilities: ["fighters:read"],
};

describe("T-030 Phần B2: Nền dữ liệu đình chỉ & sẵn sàng", () => {
    beforeEach(() => {
        delete (globalThis as Record<string, unknown>).__mmaMockDb;
    });

    it("B2-1: JSON đình chỉ đúng contract (lấy từ một response mẫu dựng theo suspensionResponseSchema của backend) -> Parse được, có maxAllowedTier, gradedReturn", () => {
        const rawBackendResponse = {
            id: "550e8400-e29b-41d4-a716-446655440000",
            fighterId: "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
            boutId: null,
            reason: "KO",
            startsOn: "2026-11-01",
            endsOn: "2026-11-30",
            lossOfConsciousness: "OVER_1_MIN",
            suggestedDays: 30,
            overrideReason: null,
            blockedSessionTypes: [
                "SHADOW_BOXING",
                "PAD_WORK",
                "HEAVY_BAG",
                "SPARRING",
                "GRAPPLING",
                "STRENGTH_CONDITIONING",
            ],
            maxAllowedTier: 1,
            requiresClearance: true,
            clearedAt: null,
            clearedById: null,
            clearanceNote: null,
            createdById: "7ba7b810-9dad-11d1-80b4-00c04fd430c8",
            createdAt: "2026-10-29T10:00:00.000Z",
            updatedAt: "2026-10-29T10:00:00.000Z",
            status: "ACTIVE",
            gradedReturn: {
                ceiling: 3,
                fullReturnOn: "2026-12-03",
            },
            affectedSessions: [
                {
                    sessionId: "11111111-1111-1111-1111-111111111111",
                    action: "CANCEL",
                },
            ],
            affectedPlans: [
                {
                    planId: "22222222-2222-2222-2222-222222222222",
                    fromPhase: "fight_camp",
                    toPhase: "rehab",
                },
            ],
        };

        const parsed = backendSuspensionSchema.parse(rawBackendResponse);
        expect(parsed.id).toBe("550e8400-e29b-41d4-a716-446655440000");
        expect(parsed.maxAllowedTier).toBe(1);
        expect(parsed.gradedReturn).toEqual({
            ceiling: 3,
            fullReturnOn: "2026-12-03",
        });
        expect(parsed.status).toBe("ACTIVE");

        // Bổ sung: toSuspensionCreation maps CANCEL -> cancel
        const creation = toSuspensionCreation(backendCreateSuspensionResponseSchema.parse(rawBackendResponse));
        expect(creation.affectedSessions[0]?.action).toBe("cancel");

        // Bổ sung: thiếu affectedSessions trong create response -> lỗi parse
        const { affectedSessions: _, ...withoutSessions } = rawBackendResponse;
        void _;
        expect(() => backendCreateSuspensionResponseSchema.parse(withoutSessions)).toThrow();
    });

    it("B2-2: Buổi API status: 'PENDING' -> Thành pending; map ngược ra PENDING", async () => {
        const { sessionStatusFromApi, sessionStatusToApi } = await import("./training");
        expect(sessionStatusFromApi.PENDING).toBe("pending");
        expect(sessionStatusToApi.pending).toBe("PENDING");

        // Bổ sung: Một buổi backend status 'PENDING' parse qua backendSessionSchema & toSession -> status 'pending'
        const rawBackendSession = {
            id: "sess-pending-test",
            fighterId: "f-diego-alvarez",
            coachId: "c-rafael-costa",
            planId: null,
            title: "Pending Sparring Session",
            scheduledAt: "2026-11-05T10:00:00.000Z",
            plannedDurationSec: 3600,
            actualDurationSec: null,
            roundCount: 5,
            location: "Ring 1",
            sessionType: "SPARRING" as const,
            status: "PENDING" as const,
            coachNotes: null,
            cancellationReason: null,
            checkedInAt: null,
            completedAt: null,
            abandonedAt: null,
            skippedAt: null,
            reportedRpe: null,
            isActive: true,
            createdAt: "2026-10-29T10:00:00.000Z",
            updatedAt: "2026-10-29T10:00:00.000Z",
            deletedAt: null,
            cancelledAt: null,
        };

        const parsedBackendSession = backendSessionSchema.parse(rawBackendSession);
        const mappedSession = toSession(parsedBackendSession);
        expect(mappedSession.status).toBe("pending");
    });

    it("B2-3: Hằng bậc frontend -> Đúng 8 loại, đúng bậc như backend", () => {
        expect(Object.keys(SESSION_INTENSITY_TIERS)).toHaveLength(8);
        expect(SESSION_INTENSITY_TIERS).toEqual({
            RECOVERY: 1,
            PHYSICAL_THERAPY: 1,
            STRENGTH_CONDITIONING: 2,
            SHADOW_BOXING: 3,
            HEAVY_BAG: 3,
            PAD_WORK: 3,
            GRAPPLING: 4,
            SPARRING: 5,
        });

        for (const type of SESSION_TYPES) {
            expect(SESSION_INTENSITY_TIERS[type]).toBeDefined();
        }
    });

    it("B2-4: demo, OTHER 7 ngày, maxTier 3, buổi GRAPPLING ngày thứ 3 và buổi PAD_WORK ngày thứ 3 → GRAPPLING pending, PAD_WORK không đổi", async () => {
        const today = academyDateOf(new Date());
        const day3 = addDaysToDate(today, 2);

        const sessGrapplingId = "sess-b2-4-grappling";
        const sessPadWorkId = "sess-b2-4-padwork";

        db().suspensions = (db().suspensions ?? []).filter((s) => s.fighterId !== "f-diego-alvarez");
        db().trainingSessions = db().trainingSessions.filter(
            (s) => s.id !== sessGrapplingId && s.id !== sessPadWorkId,
        );

        db().trainingSessions.push(
            {
                id: sessGrapplingId,
                fighterId: "f-diego-alvarez",
                coachId: "c-rafael-costa",
                planId: null,
                title: "Grappling Session",
                type: "grappling", // tier 4
                scheduledAt: `${day3}T10:00:00.000Z`,
                durationMin: 60,
                location: "Mat 1",
                targetRpe: 7,
                status: "scheduled",
                exercises: [],
                result: null,
                videoIds: [],
                cancellationReason: null,
                notes: null,
            },
            {
                id: sessPadWorkId,
                fighterId: "f-diego-alvarez",
                coachId: "c-rafael-costa",
                planId: null,
                title: "Pad Work Session",
                type: "pad_work", // tier 3
                scheduledAt: `${day3}T15:00:00.000Z`,
                durationMin: 45,
                location: "Bag Area",
                targetRpe: 6,
                status: "scheduled",
                exercises: [],
                result: null,
                videoIds: [],
                cancellationReason: null,
                notes: null,
            },
        );

        const res = await createSuspension(
            {
                fighterId: "f-diego-alvarez",
                reason: "OTHER",
                days: 7,
                startsOn: today,
                maxTier: 3, // blocks tiers > 3: SPARRING and GRAPPLING
                requiresClearance: false,
            },
            mockCoach,
        );

        // GRAPPLING (tier 4) is blocked -> pending
        const grapplingAffected = res.affectedSessions.find((s) => s.sessionId === sessGrapplingId);
        expect(grapplingAffected).toBeDefined();
        expect(grapplingAffected?.action).toBe("pending");

        const updatedGrappling = db().trainingSessions.find((s) => s.id === sessGrapplingId);
        expect(updatedGrappling?.status).toBe("pending");

        // PAD_WORK (tier 3) is allowed -> not affected
        const padWorkAffected = res.affectedSessions.find((s) => s.sessionId === sessPadWorkId);
        expect(padWorkAffected).toBeUndefined();

        const updatedPadWork = db().trainingSessions.find((s) => s.id === sessPadWorkId);
        expect(updatedPadWork?.status).toBe("scheduled");
    });

    it("B2-5: Demo: tạo KO cần xác nhận, buổi sparring sau startsOn -> Buổi thành cancelled; giáo án demo pha fight_camp thành rehab, có trong affectedPlans", async () => {
        const today = academyDateOf(new Date());
        const tomorrow = addDaysToDate(today, 1);
        const testSessionId = "sess-b2-5-ko-sparring";

        db().trainingSessions = db().trainingSessions.filter((s) => s.id !== testSessionId);
        db().trainingSessions.push({
            id: testSessionId,
            fighterId: "f-diego-alvarez",
            coachId: "c-rafael-costa",
            planId: "plan-b2-5-camp",
            title: "Sparring Session",
            type: "sparring",
            scheduledAt: `${tomorrow}T14:00:00.000Z`,
            durationMin: 60,
            location: "Ring 1",
            targetRpe: 9,
            status: "scheduled",
            exercises: [],
            result: null,
            videoIds: [],
            cancellationReason: null,
            notes: null,
        });

        const testPlanId = "plan-b2-5-camp";
        db().trainingPlans = db().trainingPlans.filter((p) => p.id !== testPlanId);
        db().trainingPlans.push({
            id: testPlanId,
            fighterId: "f-diego-alvarez",
            coachId: "c-rafael-costa",
            title: "Diego Fight Camp Plan",
            objective: "Diego Fight Camp Plan",
            phase: "fight_camp",
            focusAreas: ["jab", "guard"],
            startDate: `${today}T00:00:00.000Z`,
            endDate: null,
            weeklySessionTarget: 4,
            status: "active",
            notes: "Camp before bout",
            createdAt: `${today}T00:00:00.000Z`,
            updatedAt: `${today}T00:00:00.000Z`,
        } as TrainingPlan);

        const res = await createSuspension(
            {
                fighterId: "f-diego-alvarez",
                reason: "KO",
                days: 30,
                startsOn: today,
                requiresClearance: true,
            },
            mockCoach,
        );

        const affectedSession = res.affectedSessions.find((s) => s.sessionId === testSessionId);
        expect(affectedSession).toBeDefined();
        expect(affectedSession?.action).toBe("cancel");

        const updatedSession = db().trainingSessions.find((s) => s.id === testSessionId);
        expect(updatedSession?.status).toBe("cancelled");
        expect(updatedSession?.cancellationReason).toBe("Suspension in force");

        const affectedPlan = res.affectedPlans.find((p) => p.planId === testPlanId);
        expect(affectedPlan).toBeDefined();
        expect(affectedPlan?.fromPhase).toBe("fight_camp");
        expect(affectedPlan?.toPhase).toBe("rehab");

        const updatedPlan = db().trainingPlans.find((p) => p.id === testPlanId);
        expect(updatedPlan?.phase).toBe("rehab");
    });

    it("B2-6: demo createSuspension maxTier 3 → đình chỉ lưu blockedSessionTypes ['SPARRING','GRAPPLING'] và maxAllowedTier 3", async () => {
        const res = await createSuspension(
            {
                fighterId: "f-diego-alvarez",
                reason: "OTHER",
                days: 10,
                maxTier: 3,
            },
            mockCoach,
        );

        expect(res.blockedSessionTypes).toEqual(["SPARRING", "GRAPPLING"]);
        expect(res.maxAllowedTier).toBe(3);
    });

    it("B2-7: dữ liệu mẫu, xét theo luật backend: có đủ 5 trường hợp; Diego đúng AWAITING_CLEARANCE; Tariq có ít nhất một buổi 'pending', mọi buổi pending của Tariq nằm trong [startsOn, endsOn] và loại bị chặn; Marcus không còn buổi tương lai loại bị chặn ở trạng thái scheduled; Lucas có gradedReturn ceiling 3 hôm nay; Emma READY", async () => {
        const rows = await getReadiness({}, mockAdmin);
        expect(rows.length).toBeGreaterThanOrEqual(5);

        // 1. Đang đình chỉ KO: Marcus Hale
        const marcus = rows.find((r) => r.fighterId === "f-marcus-hale");
        expect(marcus).toBeDefined();
        expect(marcus?.status).toBe("SUSPENDED");
        expect(marcus?.ready).toBe(false);

        // 2. Chờ xác nhận: Diego Alvarez (đúng AWAITING_CLEARANCE)
        const diego = rows.find((r) => r.fighterId === "f-diego-alvarez");
        expect(diego).toBeDefined();
        expect(diego?.status).toBe("AWAITING_CLEARANCE");
        expect(diego?.ready).toBe(false);

        // 3. Đang tập lại bậc 3 hôm nay: Lucas Ferreira
        const lucas = rows.find((r) => r.fighterId === "f-lucas-ferreira");
        expect(lucas).toBeDefined();
        expect(lucas?.gradedReturn).toBeDefined();
        expect(lucas?.gradedReturn?.ceiling).toBe(3);

        // 4. Nghỉ bắt buộc: Tariq Haddad
        const tariq = rows.find((r) => r.fighterId === "f-tariq-haddad");
        expect(tariq).toBeDefined();
        expect(tariq?.status).toBe("SUSPENDED");

        // 5. Sẵn sàng: Emma Lindqvist
        const emma = rows.find((r) => r.fighterId === "f-emma-lindqvist");
        expect(emma).toBeDefined();
        expect(emma?.status).toBe("READY");
        expect(emma?.ready).toBe(true);

        // Kiểm tra Tariq: có ít nhất một buổi 'pending', mọi buổi pending nằm trong [startsOn, endsOn] và loại bị chặn
        const tariqSuspension = (db().suspensions ?? []).find((s) => s.fighterId === "f-tariq-haddad");
        expect(tariqSuspension).toBeDefined();

        const tariqPendingSessions = db().trainingSessions.filter(
            (s) => s.fighterId === "f-tariq-haddad" && s.status === "pending",
        );
        expect(tariqPendingSessions.length).toBeGreaterThan(0);
        for (const session of tariqPendingSessions) {
            const date = academyDateOf(session.scheduledAt);
            expect(date >= tariqSuspension!.startsOn && date <= tariqSuspension!.endsOn).toBe(true);
            const backendType = sessionTypeFor(session.type);
            expect(backendType).toBeDefined();
            expect(tariqSuspension!.blockedSessionTypes).toContain(backendType);
        }

        // Kiểm tra Marcus: không còn buổi tương lai loại bị chặn ở trạng thái scheduled
        const today = academyDateOf(new Date());
        const marcusBlockedTypes = ["sparring", "grappling", "pad_work", "heavy_bag", "strength_conditioning", "shadow_boxing", "technical_drilling"];
        const marcusFutureScheduled = db().trainingSessions.filter(
            (s) =>
                s.fighterId === "f-marcus-hale" &&
                academyDateOf(s.scheduledAt) >= today &&
                marcusBlockedTypes.includes(s.type) &&
                s.status === "scheduled",
        );
        expect(marcusFutureScheduled).toEqual([]);
    });

    it("B2-8: Mọi khoá i18n mới -> Có ở cả vi và en (test integrity có sẵn qua)", () => {
        const requiredKeys = [
            "sessionStatus.pending",
            "suspension.reason.KO",
            "suspension.reason.TKO",
            "suspension.reason.DQ",
            "suspension.reason.MANDATORY_REST",
            "suspension.reason.MEDICAL",
            "suspension.reason.OTHER",
            "suspension.status.UPCOMING",
            "suspension.status.ACTIVE",
            "suspension.status.AWAITING_CLEARANCE",
            "suspension.status.ENDED",
            "intensityTier.1.name",
            "intensityTier.2.name",
            "intensityTier.3.name",
            "intensityTier.4.name",
            "intensityTier.5.name",
            "readiness.status.READY",
            "readiness.status.SUSPENDED",
            "readiness.status.AWAITING_CLEARANCE",
            "readiness.status.IN_BOUT",
            "suspensions.action.created",
            "suspensions.action.cleared",
            "suspensions.action.conflictsApplied",
            "suspensions.action.unauthorized",
            "suspensions.action.notFound",
            "suspensions.action.adminClearForbidden",
            "suspensions.action.clearanceNoteLength",
            "suspensions.action.maxTierAndTypesExclusive",
            "suspensions.action.requiresClearanceKoMandatory",
            "suspensions.action.requiresClearanceDqForbidden",
            "suspensions.action.alreadyCleared",
            "suspensions.action.failed",
            "suspensions.action.startsOnNotBeforeToday",
            "suspensions.action.blockedSessionTypesMin",
            "suspensions.action.duplicateSessionTypes",
        ] as const;

        for (const key of requiredKeys) {
            expect(en[key as keyof typeof en]).toBeDefined();
            expect(vi[key as keyof typeof vi]).toBeDefined();
        }
    });

    it("B2-9: tierOfTrainingType('recovery_mobility') = 1 và ('sparring') = 5", () => {
        expect(tierOfTrainingType("recovery_mobility")).toBe(1);
        expect(tierOfTrainingType("sparring")).toBe(5);
    });

    it("B2-10: demo gradedReturn: đình chỉ KO xác nhận ngày D -> ngày D trần 3, D+1 trần 4, D+2 null", () => {
        const dayD = "2026-11-10";
        const dayDPlus1 = "2026-11-11";
        const dayDPlus2 = "2026-11-12";

        const suspension = {
            reason: "KO" as const,
            startsOn: "2026-10-01",
            endsOn: "2026-10-31",
            requiresClearance: true,
            clearedAt: `${dayD}T08:00:00.000Z`,
        };

        const grOnDayD = gradedReturnFor(suspension, dayD);
        expect(grOnDayD).toEqual({
            ceiling: 3,
            fullReturnOn: "2026-11-12",
        });

        const grOnDayDPlus1 = gradedReturnFor(suspension, dayDPlus1);
        expect(grOnDayDPlus1).toEqual({
            ceiling: 4,
            fullReturnOn: "2026-11-12",
        });

        const grOnDayDPlus2 = gradedReturnFor(suspension, dayDPlus2);
        expect(grOnDayDPlus2).toBeNull();
    });

    it("B2-11: đình chỉ KO cũ chưa xác nhận đang có hiệu lực, tạo MANDATORY_REST mới chặn SPARRING, buổi SPARRING trong khoảng → cancel (không phải pending)", async () => {
        const fighterId = "f-b2-11-fighter";
        const today = academyDateOf(new Date());
        const sessionDate = addDaysToDate(today, 2);
        const sessionId = "sess-b2-11-sparring";

        // Setup existing active KO suspension (requiresClearance = true, uncleared)
        db().suspensions = (db().suspensions ?? []).filter((s) => s.fighterId !== fighterId);
        db().suspensions.push({
            id: "susp-b2-11-old-ko",
            fighterId,
            boutId: null,
            reason: "KO",
            startsOn: addDaysToDate(today, -5),
            endsOn: addDaysToDate(today, 25),
            lossOfConsciousness: "NONE",
            suggestedDays: 30,
            overrideReason: null,
            blockedSessionTypes: ["SPARRING"],
            maxAllowedTier: 4,
            requiresClearance: true,
            clearedAt: null,
            clearedById: null,
            clearanceNote: null,
            createdById: mockCoach.id,
            createdAt: nowIso(),
            updatedAt: nowIso(),
            status: "ACTIVE",
            gradedReturn: null,
        });

        // Setup future scheduled sparring session
        db().trainingSessions = db().trainingSessions.filter((s) => s.id !== sessionId);
        db().trainingSessions.push({
            id: sessionId,
            fighterId,
            coachId: mockCoach.id,
            planId: null,
            title: "Future Sparring",
            type: "sparring",
            scheduledAt: `${sessionDate}T10:00:00.000Z`,
            durationMin: 60,
            location: "Ring 1",
            targetRpe: 8,
            status: "scheduled",
            exercises: [],
            result: null,
            videoIds: [],
            cancellationReason: null,
            notes: null,
        });

        // Create new MANDATORY_REST (which normally proposes PENDING)
        const res = await createSuspension(
            {
                fighterId,
                reason: "MANDATORY_REST",
                days: 7,
                startsOn: today,
                blockedSessionTypes: ["SPARRING"],
                requiresClearance: false,
            },
            mockCoach,
        );

        // Because the older in-force KO requires clearance, planConflicts proposes CANCEL
        const affected = res.affectedSessions.find((s) => s.sessionId === sessionId);
        expect(affected).toBeDefined();
        expect(affected?.action).toBe("cancel");

        const sessionInDb = db().trainingSessions.find((s) => s.id === sessionId);
        expect(sessionInDb?.status).toBe("cancelled");
        expect(sessionInDb?.cancellationReason).toBe("Suspension in force");
    });

    it("B2-12: demo tạo KO với requiresClearance false → ném lỗi validation, không tạo đình chỉ", async () => {
        const countBefore = (db().suspensions ?? []).length;

        await expect(
            createSuspension(
                {
                    fighterId: "f-diego-alvarez",
                    reason: "KO",
                    days: 30,
                    requiresClearance: false,
                },
                mockCoach,
            ),
        ).rejects.toMatchObject({
            status: 422,
            code: "VALIDATION_ERROR",
        });

        const countAfter = (db().suspensions ?? []).length;
        expect(countAfter).toBe(countBefore);
    });

    it("B2-13: võ sĩ có một trận SCHEDULED đứng trước một trận CAMP trong mảng → activeBout là trận CAMP; võ sĩ chỉ có trận SCHEDULED → READY", async () => {
        const fighterId = "f-emma-lindqvist";
        db().suspensions = (db().suspensions ?? []).filter((s) => s.fighterId !== fighterId);
        db().bouts = db().bouts.filter((b) => b.fighterId !== fighterId);

        db().bouts.push(
            {
                id: "bout-scheduled-first",
                fighterId,
                eventName: "Event 1 - Scheduled",
                status: "SCHEDULED",
                boutAt: "2026-12-01T20:00:00.000Z",
                weightClassCode: "WW",
                weightLimitKg: 77,
                weighInAt: "2026-12-01T10:00:00.000Z",
                rulesetId: "ruleset-1",
                trainingPlanId: null,
                acuteLossLimitPct: 8,
                deletedAt: null,
                createdAt: nowIso(),
                updatedAt: nowIso(),
                history: [],
            } as unknown as Bout,
            {
                id: "bout-camp-second",
                fighterId,
                eventName: "Event 2 - In Camp",
                status: "CAMP",
                boutAt: "2026-11-15T20:00:00.000Z",
                weightClassCode: "WW",
                weightLimitKg: 77,
                weighInAt: "2026-11-15T10:00:00.000Z",
                rulesetId: "ruleset-1",
                trainingPlanId: null,
                acuteLossLimitPct: 8,
                deletedAt: null,
                createdAt: nowIso(),
                updatedAt: nowIso(),
                history: [],
            } as unknown as Bout,
        );

        const rowsWithCamp = await getReadiness({}, mockAdmin);
        const emmaCamp = rowsWithCamp.find((r) => r.fighterId === fighterId);
        expect(emmaCamp).toBeDefined();
        expect(emmaCamp?.activeBout?.id).toBe("bout-camp-second");
        expect(emmaCamp?.status).toBe("IN_BOUT");

        // Now remove the CAMP bout, leaving only SCHEDULED
        db().bouts = db().bouts.filter((b) => b.id !== "bout-camp-second");
        const rowsScheduledOnly = await getReadiness({}, mockAdmin);
        const emmaScheduled = rowsScheduledOnly.find((r) => r.fighterId === fighterId);
        expect(emmaScheduled).toBeDefined();
        expect(emmaScheduled?.status).toBe("READY");
        expect(emmaScheduled?.ready).toBe(true);
        expect(emmaScheduled?.activeBout).toBeNull();
    });

    it("B2-14: coach nhận đúng các dòng của võ sĩ được phân công (kiểm danh sách id, không chấp nhận rỗng); doctor listSuspensions chỉ võ sĩ được phân công; fighter listSuspensions với fighterId người khác → forbidden", async () => {
        // Coach sees only assigned active fighters, non-empty
        const coachRows = await getReadiness({}, mockCoach);
        const assignedIds = mockCoach.assignmentScope?.fighterIds ?? [];
        expect(assignedIds.length).toBeGreaterThan(0);
        expect(coachRows.length).toBe(assignedIds.length);
        const coachRowIds = coachRows.map((r) => r.fighterId).sort();
        expect(coachRowIds).toEqual([...assignedIds].sort());

        // Doctor listSuspensions only sees assigned fighters
        const doctorList = await listSuspensions({}, mockDoctorUser);
        expect(doctorList.length).toBeGreaterThan(0);
        for (const s of doctorList) {
            expect(s.fighterId).toBe("f-diego-alvarez");
        }

        // Fighter calling readiness -> 403 Forbidden
        await expect(getReadiness({}, mockFighterUser)).rejects.toMatchObject({
            status: 403,
            code: "FORBIDDEN",
        });

        // Fighter listSuspensions with someone else's fighterId -> 403 Forbidden
        await expect(
            listSuspensions({ fighterId: "f-marcus-hale" }, mockFighterUser),
        ).rejects.toMatchObject({
            status: 403,
            code: "FORBIDDEN",
        });
    });

    it("B2-15: một đình chỉ ACTIVE và một AWAITING_CLEARANCE → status SUSPENDED", () => {
        const today = "2026-11-01";
        const row = classifyReadiness({
            fighterId: "f-test-both",
            fighterName: "Both Fighter",
            today,
            suspensions: [
                {
                    startsOn: "2026-10-15",
                    endsOn: "2026-11-15",
                    requiresClearance: false,
                    clearedAt: null,
                    blockedSessionTypes: ["SPARRING"],
                },
                {
                    startsOn: "2026-09-01",
                    endsOn: "2026-10-01",
                    requiresClearance: true,
                    clearedAt: null,
                    blockedSessionTypes: ["GRAPPLING"],
                },
            ],
        });

        expect(row.status).toBe("SUSPENDED");
        expect(row.ready).toBe(false);
    });

    it("B2-16: boutOn sau ngày hết đình chỉ đang hiệu lực hôm nay → ready true, notReadyReasons rỗng", () => {
        const today = "2026-11-01";
        const boutOn = "2026-11-20";

        const row = classifyReadiness({
            fighterId: "f-test-future-bout",
            fighterName: "Future Bout Fighter",
            today,
            boutOn,
            suspensions: [
                {
                    startsOn: "2026-10-20",
                    endsOn: "2026-11-10",
                    requiresClearance: false,
                    clearedAt: null,
                    blockedSessionTypes: ["SPARRING"],
                },
            ],
        });

        expect(row.ready).toBe(true);
        expect(row.notReadyReasons).toEqual([]);
    });

    it("B2-17: hai đình chỉ hiệu lực ([SPARRING] hết 2026-12-03; [GRAPPLING] KO cần xác nhận) → blockedSessionTypes chứa cả hai, endsOn muộn nhất, expectedResumeOn null, fullReturnOn null", () => {
        const today = "2026-11-01";
        const row = classifyReadiness({
            fighterId: "f-test-two-active",
            fighterName: "Two Active Fighter",
            today,
            suspensions: [
                {
                    startsOn: "2026-10-01",
                    endsOn: "2026-12-03",
                    requiresClearance: false,
                    clearedAt: null,
                    blockedSessionTypes: ["SPARRING"],
                },
                {
                    reason: "KO",
                    startsOn: "2026-10-15",
                    endsOn: "2026-11-15",
                    requiresClearance: true,
                    clearedAt: null,
                    blockedSessionTypes: ["GRAPPLING"],
                },
            ],
        });

        expect(row.suspension).toBeDefined();
        expect(row.suspension?.blockedSessionTypes).toEqual(
            expect.arrayContaining(["SPARRING", "GRAPPLING"]),
        );
        expect(row.suspension?.endsOn).toBe("2026-12-03");
        expect(row.suspension?.expectedResumeOn).toBeNull();
        expect(row.fullReturnOn).toBeNull();
    });

    it("B2-18: readiness weightLimitKg mà thiếu rulesetId → lỗi validation", async () => {
        await expect(getReadiness({ weightLimitKg: 70 }, mockCoach)).rejects.toMatchObject({
            status: 422,
            code: "VALIDATION_ERROR",
        });
    });

    it("B2-19: active=true chỉ trả đình chỉ đang hiệu lực; đình chỉ KO đã xác nhận đang trong lộ trình tập lại nằm ở active=false", async () => {
        const today = academyDateOf(new Date());
        const clearedSuspId = "susp-b2-19-cleared-ko";

        db().suspensions = (db().suspensions ?? []).filter((s) => s.id !== clearedSuspId);
        db().suspensions.push({
            id: clearedSuspId,
            fighterId: "f-lucas-ferreira",
            boutId: null,
            reason: "KO",
            startsOn: addDaysToDate(today, -30),
            endsOn: addDaysToDate(today, -5),
            lossOfConsciousness: "UNDER_1_MIN",
            suggestedDays: 30,
            overrideReason: null,
            blockedSessionTypes: ["SPARRING"],
            maxAllowedTier: 4,
            requiresClearance: true,
            clearedAt: `${today}T08:00:00.000Z`,
            clearedById: mockCoach.id,
            clearanceNote: "Cleared today",
            createdById: mockCoach.id,
            createdAt: nowIso(),
            updatedAt: nowIso(),
            status: "ENDED",
            gradedReturn: {
                ceiling: 3,
                fullReturnOn: addDaysToDate(today, 2),
            },
        });

        const activeList = await listSuspensions({ active: true }, mockAdmin);
        expect(activeList.some((s) => s.id === clearedSuspId)).toBe(false);

        const inactiveList = await listSuspensions({ active: false }, mockAdmin);
        expect(inactiveList.some((s) => s.id === clearedSuspId)).toBe(true);
    });

    it("B2-20: API applyConflicts trả TrainingSession có status 'pending' (chữ thường) từ dữ liệu backend 'PENDING'", async () => {
        const clientModule = await import("@/lib/api/client");
        const spy = vitest.spyOn(clientModule, "authenticatedMutableApiRequest").mockResolvedValueOnce([
            {
                id: "sess-b2-20",
                fighterId: "f-diego-alvarez",
                coachId: "c-rafael-costa",
                planId: null,
                title: "Applied Conflict Session",
                scheduledAt: "2026-11-10T10:00:00.000Z",
                plannedDurationSec: 3600,
                actualDurationSec: null,
                roundCount: 3,
                location: "Gym",
                sessionType: "SPARRING",
                status: "PENDING",
                coachNotes: null,
                cancellationReason: null,
                checkedInAt: null,
                completedAt: null,
                abandonedAt: null,
                skippedAt: null,
                reportedRpe: null,
                isActive: true,
                createdAt: "2026-10-29T10:00:00.000Z",
                updatedAt: "2026-10-29T10:00:00.000Z",
                deletedAt: null,
                cancelledAt: null,
            },
        ]);

        const constantsModule = await import("@/lib/auth/constants");
        const demoAuthSpy = vitest.spyOn(constantsModule, "isDemoAuthEnabled").mockReturnValue(false);

        try {
            const results = await applyConflicts("susp-1", ["sess-b2-20"], mockCoach);
            expect(results).toHaveLength(1);
            expect(results[0]?.status).toBe("pending");
            expect(results[0]?.type).toBe("sparring");
        } finally {
            spy.mockRestore();
            demoAuthSpy.mockRestore();
        }
    });

    it("B2-21: API listSuspensions với fighterIds [a, b] → một request không có fighterId, kết quả lọc còn a, b; với [a] → request có fighterId=a; mọi request có limit=100", async () => {
        const clientModule = await import("@/lib/api/client");
        const requestedPaths: string[] = [];

        const fakeSuspension = (id: string, fId: string) => ({
            id,
            fighterId: fId,
            boutId: null,
            reason: "OTHER",
            startsOn: "2026-11-01",
            endsOn: "2026-11-10",
            lossOfConsciousness: null,
            suggestedDays: 10,
            overrideReason: null,
            blockedSessionTypes: ["SPARRING"],
            maxAllowedTier: 4,
            requiresClearance: false,
            clearedAt: null,
            clearedById: null,
            clearanceNote: null,
            createdById: "u-coach-rafael",
            createdAt: "2026-10-29T10:00:00.000Z",
            updatedAt: "2026-10-29T10:00:00.000Z",
            status: "ACTIVE",
            gradedReturn: null,
        });

        const spy = vitest.spyOn(clientModule, "authenticatedApiRequest").mockImplementation(async (url) => {
            requestedPaths.push(String(url));
            return {
                data: [
                    fakeSuspension("s-a", "fighter-a"),
                    fakeSuspension("s-b", "fighter-b"),
                    fakeSuspension("s-c", "fighter-c"),
                ],
                hasNextPage: false,
                nextCursor: null,
            };
        });

        const constantsModule = await import("@/lib/auth/constants");
        const demoAuthSpy = vitest.spyOn(constantsModule, "isDemoAuthEnabled").mockReturnValue(false);

        try {
            // Case 1: multiple fighterIds [a, b]
            const multi = await listSuspensions({ fighterIds: ["fighter-a", "fighter-b"] }, mockCoach);
            expect(requestedPaths[0]).toContain("limit=100");
            expect(requestedPaths[0]).not.toContain("fighterId=");
            expect(multi.map((s) => s.fighterId)).toEqual(["fighter-a", "fighter-b"]);

            // Case 2: single fighterId [a]
            const single = await listSuspensions({ fighterIds: ["fighter-a"] }, mockCoach);
            expect(requestedPaths[1]).toContain("limit=100");
            expect(requestedPaths[1]).toContain("fighterId=fighter-a");
            expect(single.map((s) => s.fighterId)).toEqual(["fighter-a"]);
        } finally {
            spy.mockRestore();
            demoAuthSpy.mockRestore();
        }
    });

    it("B2-22: không file nào trong src/lib/actions hoặc src/lib/domain import từ '*.demo'", () => {
        const targetDirs = [
            path.resolve(__dirname, "../actions"),
            path.resolve(__dirname, "../domain"),
        ];

        const offenders: string[] = [];

        for (const dir of targetDirs) {
            const files = fs.readdirSync(dir).filter((f) => /\.(ts|tsx)$/.test(f) && !f.includes(".test."));
            for (const file of files) {
                const content = fs.readFileSync(path.join(dir, file), "utf-8");
                const lines = content.split(/\r?\n/);
                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i]!;
                    if (/from\s+["'][^"']*\.demo(?:\.[jt]sx?)?["']/.test(line)) {
                        offenders.push(`${file}:${i + 1}: ${line}`);
                    }
                }
            }
        }

        expect(offenders).toEqual([]);
    });

    it("B2-23: readiness API parse response có feasibility.status 'NEUTRAL' và 'OVER_LIMIT' → không lỗi; parse 'CAUTION' → ném lỗi", () => {
        const baseRow = {
            fighterId: "f-1",
            fighterName: "Fighter 1",
            ready: true,
            status: "READY" as const,
            latestWeightKg: 70,
            latestWeightOn: "2026-10-25",
            activeBout: null,
            suspension: null,
            fullReturnOn: null,
            gradedReturn: null,
        };

        const neutralRow = {
            ...baseRow,
            feasibility: {
                status: "NEUTRAL" as const,
                remainingPct: 2.5,
                latestKg: 72,
                latestOn: "2026-10-25",
                daysToWeighIn: 20,
            },
        };
        expect(() => backendReadinessRowSchema.parse(neutralRow)).not.toThrow();
        const parsedNeutral = backendReadinessRowSchema.parse(neutralRow);
        expect(parsedNeutral.feasibility?.status).toBe("NEUTRAL");

        const overLimitRow = {
            ...baseRow,
            feasibility: {
                status: "OVER_LIMIT" as const,
                remainingPct: 8.5,
                latestKg: 76,
                latestOn: "2026-10-28",
                daysToWeighIn: 3,
            },
        };
        expect(() => backendReadinessRowSchema.parse(overLimitRow)).not.toThrow();
        const parsedOver = backendReadinessRowSchema.parse(overLimitRow);
        expect(parsedOver.feasibility?.status).toBe("OVER_LIMIT");

        // 'CAUTION' is from frontend BoutFeasibilityStatus, not backend WeightWarningStatus
        const cautionRow = {
            ...baseRow,
            feasibility: {
                status: "CAUTION" as const,
                remainingPct: 4.5,
                latestKg: 74,
                latestOn: "2026-10-25",
                daysToWeighIn: 10,
            },
        };
        expect(() => backendReadinessRowSchema.parse(cautionRow)).toThrow();
    });

    it("B2-24: demo readiness không có weightLimitKg → feasibility undefined; có đủ weightLimitKg, rulesetId, boutOn → status giống getFeasibility của bouts.demo cho cùng đầu vào (dùng f-minh-tran)", async () => {
        const { getFeasibility } = await import("./bouts.demo");
        const ruleset = db().rulesets.find((r) => r.id === "ruleset-vmmaf-2021") ?? db().rulesets[0];
        expect(ruleset).toBeDefined();

        const today = academyDateOf(new Date());
        const boutOn = addDaysToDate(today, 5);

        // 1. Without weightLimitKg -> feasibility undefined
        const rowsNoWeight = await getReadiness({ rulesetId: ruleset!.id, boutOn }, mockAdmin);
        const minhNoWeight = rowsNoWeight.find((r) => r.fighterId === "f-minh-tran");
        expect(minhNoWeight?.feasibility).toBeUndefined();

        // 2. With all required fields -> matches bouts.demo getFeasibility
        const weightLimitKg = 60;
        const rowsWithWeight = await getReadiness(
            { weightLimitKg, rulesetId: ruleset!.id, boutOn },
            mockAdmin,
        );
        const minhRow = rowsWithWeight.find((r) => r.fighterId === "f-minh-tran");
        expect(minhRow?.feasibility).toBeDefined();

        const demoFeasibility = await getFeasibility({
            fighterId: "f-minh-tran",
            rulesetId: ruleset!.id,
            weightClassCode: "60",
            weightLimitKg,
            weighInAt: `${boutOn}T09:00:00.000Z`,
            boutAt: `${boutOn}T19:00:00.000Z`,
        });

        expect(minhRow?.feasibility?.status).toBe(demoFeasibility?.status);
        expect(minhRow?.feasibility?.status).not.toBe("NOT_WEIGHED");
        expect(minhRow?.feasibility?.remainingPct).toBe(demoFeasibility?.remainingPct);
        expect(minhRow?.feasibility?.latestKg).toBe(demoFeasibility?.latestKg);
        expect(minhRow?.feasibility?.daysToWeighIn).toBe(demoFeasibility?.daysToWeighIn);
    });

    it("B2-25: demo tạo KO cần xác nhận khi võ sĩ có buổi 'pending' loại bị chặn sau startsOn → buổi thành 'cancelled', có trong affectedSessions", async () => {
        const today = academyDateOf(new Date());
        const tomorrow = addDaysToDate(today, 1);
        const sessPendingId = "sess-b2-25-pending-sparring";

        db().trainingSessions = db().trainingSessions.filter((s) => s.id !== sessPendingId);
        db().trainingSessions.push({
            id: sessPendingId,
            fighterId: "f-diego-alvarez",
            coachId: "c-rafael-costa",
            planId: null,
            title: "Pending Sparring Session",
            type: "sparring",
            scheduledAt: `${tomorrow}T10:00:00.000Z`,
            durationMin: 60,
            location: "Ring 1",
            targetRpe: 8,
            status: "pending",
            exercises: [],
            result: null,
            videoIds: [],
            cancellationReason: null,
            notes: null,
        });

        const res = await createSuspension(
            {
                fighterId: "f-diego-alvarez",
                reason: "KO",
                days: 30,
                startsOn: today,
                requiresClearance: true,
            },
            mockCoach,
        );

        const affected = res.affectedSessions.find((s) => s.sessionId === sessPendingId);
        expect(affected).toBeDefined();
        expect(affected?.action).toBe("cancel");

        const inDb = db().trainingSessions.find((s) => s.id === sessPendingId);
        expect(inDb?.status).toBe("cancelled");
        expect(inDb?.cancellationReason).toBe("Suspension in force");
    });

    it("B2-26: demo listConflicts của đình chỉ đã xác nhận → []; của đình chỉ bắt đầu ngày mai → []; của đình chỉ đang có hiệu lực → có proposal", async () => {
        const { listConflicts } = await import("./suspensions.demo");
        const today = academyDateOf(new Date());
        const tomorrow = addDaysToDate(today, 1);
        const fighterId = "f-diego-alvarez";

        // Create test session for tomorrow
        const testSessionId = "sess-b2-26-sparring";
        db().trainingSessions = db().trainingSessions.filter((s) => s.id !== testSessionId);
        db().trainingSessions.push({
            id: testSessionId,
            fighterId,
            coachId: mockCoach.id,
            planId: null,
            title: "Tomorrow Sparring",
            type: "sparring",
            scheduledAt: `${tomorrow}T10:00:00.000Z`,
            durationMin: 60,
            location: "Ring",
            targetRpe: 8,
            status: "scheduled",
            exercises: [],
            result: null,
            videoIds: [],
            cancellationReason: null,
            notes: null,
        });

        // 1. Cleared suspension -> []
        const clearedId = "susp-b2-26-cleared";
        db().suspensions = (db().suspensions ?? []).filter((s) => s.id !== clearedId);
        db().suspensions.push({
            id: clearedId,
            fighterId,
            boutId: null,
            reason: "OTHER",
            startsOn: addDaysToDate(today, -5),
            endsOn: addDaysToDate(today, 5),
            lossOfConsciousness: null,
            suggestedDays: 10,
            overrideReason: null,
            blockedSessionTypes: ["SPARRING"],
            maxAllowedTier: 4,
            requiresClearance: false,
            clearedAt: `${today}T08:00:00.000Z`,
            clearedById: mockCoach.id,
            clearanceNote: "Cleared",
            createdById: mockCoach.id,
            createdAt: nowIso(),
            updatedAt: nowIso(),
            status: "ENDED",
            gradedReturn: null,
        });
        const conflictsCleared = await listConflicts(clearedId, mockCoach);
        expect(conflictsCleared).toEqual([]);

        // 2. Starts tomorrow (not yet in force today) -> []
        const futureId = "susp-b2-26-future";
        db().suspensions = db().suspensions.filter((s) => s.id !== futureId);
        db().suspensions.push({
            id: futureId,
            fighterId,
            boutId: null,
            reason: "OTHER",
            startsOn: tomorrow,
            endsOn: addDaysToDate(tomorrow, 7),
            lossOfConsciousness: null,
            suggestedDays: 7,
            overrideReason: null,
            blockedSessionTypes: ["SPARRING"],
            maxAllowedTier: 4,
            requiresClearance: false,
            clearedAt: null,
            clearedById: null,
            clearanceNote: null,
            createdById: mockCoach.id,
            createdAt: nowIso(),
            updatedAt: nowIso(),
            status: "UPCOMING",
            gradedReturn: null,
        });
        const conflictsFuture = await listConflicts(futureId, mockCoach);
        expect(conflictsFuture).toEqual([]);

        // 3. Active suspension in force today -> has proposal for tomorrow's session
        const activeId = "susp-b2-26-active";
        db().suspensions = db().suspensions.filter((s) => s.id !== activeId);
        db().suspensions.push({
            id: activeId,
            fighterId,
            boutId: null,
            reason: "OTHER",
            startsOn: today,
            endsOn: addDaysToDate(today, 7),
            lossOfConsciousness: null,
            suggestedDays: 7,
            overrideReason: null,
            blockedSessionTypes: ["SPARRING"],
            maxAllowedTier: 4,
            requiresClearance: false,
            clearedAt: null,
            clearedById: null,
            clearanceNote: null,
            createdById: mockCoach.id,
            createdAt: nowIso(),
            updatedAt: nowIso(),
            status: "ACTIVE",
            gradedReturn: null,
        });
        const conflictsActive = await listConflicts(activeId, mockCoach);
        expect(conflictsActive.length).toBeGreaterThan(0);
        expect(conflictsActive.some((p) => p.sessionId === testSessionId)).toBe(true);
    });

    it("B2-27: demo applyConflicts với sessionId không có trong đề xuất → lỗi 422; coach phân công võ sĩ A form gửi fighterId = A nhưng đình chỉ thuộc B → từ chối; đối chứng đình chỉ thuộc A → thành công (cả clear và applyConflicts)", async () => {
        const today = academyDateOf(new Date());
        const fighterA = "f-diego-alvarez";
        const fighterB = "f-marcus-hale";

        const coachOnlyA: User = {
            ...mockCoach,
            id: "u-coach-only-a",
            profileId: "c-only-a",
            assignmentScope: { fighterIds: [fighterA] },
            effectiveCapabilities: ["fighters:read"],
        };

        const suspIdA = "susp-b2-27-a";
        const suspIdB = "susp-b2-27-b";
        const suspApplyIdA = "susp-b2-27-apply-a";
        const suspApplyIdB = "susp-b2-27-apply-b";
        const sessIdA = "sess-b2-27-a";
        const sessIdB = "sess-b2-27-b";

        db().suspensions = (db().suspensions ?? []).filter(
            (s) => ![suspIdA, suspIdB, suspApplyIdA, suspApplyIdB].includes(s.id),
        );
        db().suspensions.push(
            {
                id: suspIdA,
                fighterId: fighterA,
                boutId: null,
                reason: "OTHER",
                startsOn: today,
                endsOn: addDaysToDate(today, 5),
                lossOfConsciousness: null,
                suggestedDays: 5,
                overrideReason: null,
                blockedSessionTypes: ["SPARRING"],
                maxAllowedTier: 4,
                requiresClearance: false,
                clearedAt: null,
                clearedById: null,
                clearanceNote: null,
                createdById: mockCoach.id,
                createdAt: nowIso(),
                updatedAt: nowIso(),
                status: "ACTIVE",
                gradedReturn: null,
            },
            {
                id: suspIdB,
                fighterId: fighterB,
                boutId: null,
                reason: "OTHER",
                startsOn: today,
                endsOn: addDaysToDate(today, 5),
                lossOfConsciousness: null,
                suggestedDays: 5,
                overrideReason: null,
                blockedSessionTypes: ["SPARRING"],
                maxAllowedTier: 4,
                requiresClearance: false,
                clearedAt: null,
                clearedById: null,
                clearanceNote: null,
                createdById: mockCoach.id,
                createdAt: nowIso(),
                updatedAt: nowIso(),
                status: "ACTIVE",
                gradedReturn: null,
            },
            {
                id: suspApplyIdA,
                fighterId: fighterA,
                boutId: null,
                reason: "OTHER",
                startsOn: today,
                endsOn: addDaysToDate(today, 5),
                lossOfConsciousness: null,
                suggestedDays: 5,
                overrideReason: null,
                blockedSessionTypes: ["SPARRING"],
                maxAllowedTier: 4,
                requiresClearance: false,
                clearedAt: null,
                clearedById: null,
                clearanceNote: null,
                createdById: mockCoach.id,
                createdAt: nowIso(),
                updatedAt: nowIso(),
                status: "ACTIVE",
                gradedReturn: null,
            },
            {
                id: suspApplyIdB,
                fighterId: fighterB,
                boutId: null,
                reason: "OTHER",
                startsOn: today,
                endsOn: addDaysToDate(today, 5),
                lossOfConsciousness: null,
                suggestedDays: 5,
                overrideReason: null,
                blockedSessionTypes: ["SPARRING"],
                maxAllowedTier: 4,
                requiresClearance: false,
                clearedAt: null,
                clearedById: null,
                clearanceNote: null,
                createdById: mockCoach.id,
                createdAt: nowIso(),
                updatedAt: nowIso(),
                status: "ACTIVE",
                gradedReturn: null,
            },
        );

        db().trainingSessions = db().trainingSessions.filter((s) => s.id !== sessIdA && s.id !== sessIdB);
        db().trainingSessions.push(
            {
                id: sessIdA,
                fighterId: fighterA,
                coachId: mockCoach.id,
                planId: null,
                title: "Scheduled Sparring A",
                type: "sparring",
                scheduledAt: `${today}T15:00:00.000Z`,
                durationMin: 60,
                location: "Ring",
                targetRpe: 8,
                status: "scheduled",
                exercises: [],
                result: null,
                videoIds: [],
                cancellationReason: null,
                notes: null,
            },
            {
                id: sessIdB,
                fighterId: fighterB,
                coachId: mockCoach.id,
                planId: null,
                title: "Scheduled Sparring B",
                type: "sparring",
                scheduledAt: `${today}T15:00:00.000Z`,
                durationMin: 60,
                location: "Ring",
                targetRpe: 8,
                status: "scheduled",
                exercises: [],
                result: null,
                videoIds: [],
                cancellationReason: null,
                notes: null,
            },
        );

        // 1. SessionId not in proposal -> 422
        await expect(
            applyConflicts(suspIdA, [sessIdA, "invalid-sess-id"], mockCoach),
        ).rejects.toMatchObject({
            status: 422,
            code: "VALIDATION_ERROR",
        });

        // 2. Clear suspension action:
        const { clearSuspensionAction, applyConflictsAction } = await import("@/lib/actions/suspensions");
        const sessionModule = await import("@/lib/auth/session");
        const userSpy = vitest.spyOn(sessionModule, "getCurrentUser").mockResolvedValue(coachOnlyA);

        try {
            // Form sends fighterId = A, but suspension belongs to B -> rejected
            const formClearB = new FormData();
            formClearB.append("id", suspIdB);
            formClearB.append("fighterId", fighterA);
            formClearB.append("clearanceNote", "Valid clearance note text");

            const resClearB = await clearSuspensionAction({ status: "idle" }, formClearB);
            expect(resClearB.status).toBe("error");
            expect(resClearB.message).toBe("Bạn không có quyền thực hiện thao tác này.");

            // Đối chứng: form sends suspension belonging to A -> success
            const formClearA = new FormData();
            formClearA.append("id", suspIdA);
            formClearA.append("fighterId", fighterA);
            formClearA.append("clearanceNote", "Valid clearance note text");

            const resClearA = await clearSuspensionAction({ status: "idle" }, formClearA);
            expect(resClearA.status).toBe("success");

            // 3. Apply conflicts action:
            // Form sends fighterId = A, but suspension belongs to B -> rejected
            const formApplyB = new FormData();
            formApplyB.append("id", suspApplyIdB);
            formApplyB.append("fighterId", fighterA);
            formApplyB.append("sessionIds", sessIdB);

            const resApplyB = await applyConflictsAction({ status: "idle" }, formApplyB);
            expect(resApplyB.status).toBe("error");
            expect(resApplyB.message).toBe("Bạn không có quyền thực hiện thao tác này.");

            // Đối chứng: form sends suspension belonging to A -> success
            const formApplyA = new FormData();
            formApplyA.append("id", suspApplyIdA);
            formApplyA.append("fighterId", fighterA);
            formApplyA.append("sessionIds", sessIdA);

            const resApplyA = await applyConflictsAction({ status: "idle" }, formApplyA);
            expect(resApplyA.status).toBe("success");
        } finally {
            userSpy.mockRestore();
        }
    });

    it("B2-28: action clear trả câu vi 'đã được xác nhận' khi lỗi mã SUSPENSION_ALREADY_CLEARED; lỗi 404 trả câu riêng vi; lỗi 422 clearanceNote tiếng Việt không có 'Too short'; lỗi không phải ApiError trả câu chung", async () => {
        const { clearSuspensionAction } = await import("@/lib/actions/suspensions");
        const suspensionsService = await import("./suspensions");
        const sessionModule = await import("@/lib/auth/session");
        const userSpy = vitest.spyOn(sessionModule, "getCurrentUser").mockResolvedValue(mockCoach);

        const formData = new FormData();
        formData.append("id", "susp-1");
        formData.append("clearanceNote", "Valid clearance note text");

        try {
            // 1. SUSPENSION_ALREADY_CLEARED
            vitest.spyOn(suspensionsService, "clearSuspension").mockRejectedValueOnce(
                new ApiError({
                    message: "The suspension has already been cleared",
                    kind: "http",
                    status: 409,
                    code: "SUSPENSION_ALREADY_CLEARED",
                }),
            );
            const resCleared = await clearSuspensionAction({ status: "idle" }, formData);
            expect(resCleared.status).toBe("error");
            expect(resCleared.message).toContain("Đình chỉ này đã được xác nhận kết thúc trước đó");

            // 2. 404 SUSPENSION_NOT_FOUND
            vitest.spyOn(suspensionsService, "clearSuspension").mockRejectedValueOnce(
                new ApiError({
                    message: "Suspension not found",
                    kind: "http",
                    status: 404,
                    code: "SUSPENSION_NOT_FOUND",
                }),
            );
            const resNotFound = await clearSuspensionAction({ status: "idle" }, formData);
            expect(resNotFound.status).toBe("error");
            expect(resNotFound.message).toBe("Không tìm thấy đình chỉ.");

            // 3. 422 with backend English detail: "Too short"
            vitest.spyOn(suspensionsService, "clearSuspension").mockRejectedValueOnce(
                new ApiError({
                    message: "Validation failed",
                    kind: "http",
                    status: 422,
                    code: "VALIDATION_ERROR",
                    details: [{ path: ["clearanceNote"], message: "Too short" }],
                }),
            );
            const res422 = await clearSuspensionAction({ status: "idle" }, formData);
            expect(res422.status).toBe("error");
            expect(res422.fieldErrors?.clearanceNote).toBe("Căn cứ xác nhận phải từ 3 đến 500 ký tự.");
            expect(res422.fieldErrors?.clearanceNote).not.toContain("Too short");

            // 4. Non-ApiError (general Error)
            vitest.spyOn(suspensionsService, "clearSuspension").mockRejectedValueOnce(
                new Error("Database connection timed out"),
            );
            const resGeneral = await clearSuspensionAction({ status: "idle" }, formData);
            expect(resGeneral.status).toBe("error");
            expect(resGeneral.message).toBe("Thao tác không thành công.");
        } finally {
            userSpy.mockRestore();
        }
    });

    it("B2-29: listSuspensions API: phân trang vượt số trang tối đa → ném lỗi", async () => {
        const clientModule = await import("@/lib/api/client");
        let pageCount = 0;
        const spy = vitest.spyOn(clientModule, "authenticatedApiRequest").mockImplementation(async () => {
            pageCount += 1;
            return {
                data: [],
                hasNextPage: true,
                nextCursor: `cursor-page-${pageCount}`,
            };
        });

        const constantsModule = await import("@/lib/auth/constants");
        const demoAuthSpy = vitest.spyOn(constantsModule, "isDemoAuthEnabled").mockReturnValue(false);

        try {
            await expect(listSuspensions({}, mockCoach)).rejects.toMatchObject({
                code: "PAGINATION_LIMIT_EXCEEDED",
            });
        } finally {
            spy.mockRestore();
            demoAuthSpy.mockRestore();
        }
    });

    it("B2-30: schema tạo đình chỉ: requiresClearance 'on' → true; days ngoài 1-365 → câu lỗi tiếng Việt", async () => {
        const { buildCreateSuspensionSchema } = await import("@/lib/actions/suspension-schemas");
        const { getTranslator } = await import("@/lib/i18n/server");
        const { t } = await getTranslator();

        const schema = buildCreateSuspensionSchema(t);

        // 1. requiresClearance "on" parses to true
        const parsedOn = schema.safeParse({
            fighterId: "f-diego-alvarez",
            reason: "KO",
            days: 30,
            requiresClearance: "on",
        });
        expect(parsedOn.success).toBe(true);
        if (parsedOn.success) {
            expect(parsedOn.data.requiresClearance).toBe(true);
        }

        // 2. days outside 1-365 -> Vietnamese error message
        const parsedZero = schema.safeParse({
            fighterId: "f-diego-alvarez",
            reason: "OTHER",
            days: 0,
        });
        expect(parsedZero.success).toBe(false);
        if (!parsedZero.success) {
            const daysIssue = parsedZero.error.issues.find((i) => i.path.includes("days"));
            expect(daysIssue?.message).toBe("Số ngày đình chỉ phải từ 1 đến 365.");
        }

        const parsedTooBig = schema.safeParse({
            fighterId: "f-diego-alvarez",
            reason: "OTHER",
            days: 366,
        });
        expect(parsedTooBig.success).toBe(false);
        if (!parsedTooBig.success) {
            const daysIssue = parsedTooBig.error.issues.find((i) => i.path.includes("days"));
            expect(daysIssue?.message).toBe("Số ngày đình chỉ phải từ 1 đến 365.");
        }
    });

    it("B2-31: seedData 2 lần khác Date.now() vẫn cùng fingerprint và có hiệu ứng tự áp dụng (Tariq pending, Marcus cancelled)", async () => {
        const { seedData, fingerprint } = await import("@/lib/mocks/db");
        const s1 = seedData();
        const fp1 = fingerprint(s1);

        vitest.setSystemTime(new Date(Date.now() + 3600_000));
        try {
            const s2 = seedData();
            const fp2 = fingerprint(s2);
            expect(fp1).toBe(fp2);

            const tariqPending = s1.trainingSessions.filter(
                (s) => s.fighterId === "f-tariq-haddad" && s.status === "pending",
            );
            expect(tariqPending.length).toBeGreaterThan(0);

            const marcusCancelled = s1.trainingSessions.filter(
                (s) => s.fighterId === "f-marcus-hale" && s.status === "cancelled",
            );
            expect(marcusCancelled.length).toBeGreaterThan(0);
        } finally {
            vitest.useRealTimers();
        }
    });

    it("B2-32: demo clearSuspension bởi fighter và admin → 403 FORBIDDEN", async () => {
        const { clearSuspension } = await import("./suspensions.demo");
        await expect(
            clearSuspension("susp-awaiting-clearance", "Note", mockFighterUser),
        ).rejects.toMatchObject({
            status: 403,
            code: "FORBIDDEN",
        });

        await expect(
            clearSuspension("susp-awaiting-clearance", "Note", mockAdmin),
        ).rejects.toMatchObject({
            status: 403,
            code: "FORBIDDEN",
        });
    });

    it("B2-33: demo listConflicts id sai 404 SUSPENSION_NOT_FOUND, unassigned coach 403 FORBIDDEN", async () => {
        const { listConflicts } = await import("./suspensions.demo");
        await expect(
            listConflicts("non-existent-suspension-id", mockCoach),
        ).rejects.toMatchObject({
            status: 404,
            code: "SUSPENSION_NOT_FOUND",
        });

        const unassignedCoach: User = {
            ...mockCoach,
            id: "u-coach-unassigned",
            profileId: "c-unassigned",
            assignmentScope: { fighterIds: [] },
        };
        await expect(
            listConflicts("susp-active-ko", unassignedCoach),
        ).rejects.toMatchObject({
            status: 403,
            code: "FORBIDDEN",
        });
    });

    it("B2-34: demo readiness chọn trận CAMP chưa xoá có boutAt sớm nhất", async () => {
        const today = academyDateOf(new Date());
        const fighterId = "f-b2-34-test";

        const baseFighter = db().fighters[0];
        db().fighters = db().fighters.filter((f) => f.id !== fighterId);
        db().fighters.push({
            ...baseFighter,
            id: fighterId,
            name: "Test Fighter B2-34",
            primaryCoachId: mockCoach.profileId ?? "c-rafael-costa",
            coachIds: [mockCoach.profileId ?? "c-rafael-costa"],
        });

        const bout1Id = "bout-b2-34-late";
        const bout2Id = "bout-b2-34-early";
        const bout3Id = "bout-b2-34-deleted";

        db().bouts = db().bouts.filter((b) => ![bout1Id, bout2Id, bout3Id].includes(b.id));
        db().bouts.push(
            {
                id: bout1Id,
                fighterId,
                coachId: mockCoach.profileId ?? "c-rafael-costa",
                rulesetId: "ruleset-vmmaf-2021",
                eventName: "Later Bout",
                venue: "Venue",
                opponentName: "Opp 1",
                weightClassCode: "WW",
                weightLimitKg: 77,
                acuteLossLimitPct: 8,
                requirementsDueDays: 7,
                weighInAt: `${addDaysToDate(today, 19)}T09:00:00.000Z`,
                boutAt: `${addDaysToDate(today, 20)}T19:00:00.000Z`,
                status: "CAMP",
                trainingPlanId: null,
                officialWeightKg: null,
                madeWeight: null,
                catchweightKg: null,
                hydrationCheck: null,
                result: null,
                method: null,
                resultRound: null,
                knockedDown: null,
                notes: null,
                deletedAt: null,
                createdAt: nowIso(),
                updatedAt: nowIso(),
            } as unknown as Bout,
            {
                id: bout2Id,
                fighterId,
                coachId: mockCoach.profileId ?? "c-rafael-costa",
                rulesetId: "ruleset-vmmaf-2021",
                eventName: "Earliest Non-Deleted Bout",
                venue: "Venue",
                opponentName: "Opp 2",
                weightClassCode: "WW",
                weightLimitKg: 77,
                acuteLossLimitPct: 8,
                requirementsDueDays: 7,
                weighInAt: `${addDaysToDate(today, 9)}T09:00:00.000Z`,
                boutAt: `${addDaysToDate(today, 10)}T19:00:00.000Z`,
                status: "CAMP",
                trainingPlanId: null,
                officialWeightKg: null,
                madeWeight: null,
                catchweightKg: null,
                hydrationCheck: null,
                result: null,
                method: null,
                resultRound: null,
                knockedDown: null,
                notes: null,
                deletedAt: null,
                createdAt: nowIso(),
                updatedAt: nowIso(),
            } as unknown as Bout,
            {
                id: bout3Id,
                fighterId,
                coachId: mockCoach.profileId ?? "c-rafael-costa",
                rulesetId: "ruleset-vmmaf-2021",
                eventName: "Deleted Earliest Bout",
                venue: "Venue",
                opponentName: "Opp 3",
                weightClassCode: "WW",
                weightLimitKg: 77,
                acuteLossLimitPct: 8,
                requirementsDueDays: 7,
                weighInAt: `${addDaysToDate(today, 4)}T09:00:00.000Z`,
                boutAt: `${addDaysToDate(today, 5)}T19:00:00.000Z`,
                status: "CAMP",
                trainingPlanId: null,
                officialWeightKg: null,
                madeWeight: null,
                catchweightKg: null,
                hydrationCheck: null,
                result: null,
                method: null,
                resultRound: null,
                knockedDown: null,
                notes: null,
                deletedAt: `${today}T00:00:00.000Z`,
                createdAt: nowIso(),
                updatedAt: nowIso(),
            } as unknown as Bout,
        );

        const rows = await getReadiness({}, mockAdmin);
        const fighterRow = rows.find((r) => r.fighterId === fighterId);
        expect(fighterRow).toBeDefined();
        expect(fighterRow?.activeBout?.id).toBe(bout2Id);
        expect(fighterRow?.activeBout?.eventName).toBe("Earliest Non-Deleted Bout");
    });

    it("B2-35: KO maxTier 1 chặn technical_drilling, maxTier 3 không chặn; demo createSuspension KO huỷ buổi technical_drilling", async () => {
        const { isSessionBlockedBySuspension } = await import("@/lib/domain/suspension-rules");
        const session = {
            scheduledAt: "2026-11-01T10:00:00.000Z",
            type: "technical_drilling" as const,
        };

        // 1. Suspension with maxAllowedTier: 1 (KO default) -> blocks tier 3 technical_drilling
        const suspTier1 = {
            startsOn: "2026-10-25",
            endsOn: "2026-11-10",
            requiresClearance: true,
            clearedAt: null,
            blockedSessionTypes: DEFAULT_MANUAL_BLOCKED_SESSION_TYPES,
            maxAllowedTier: 1,
        };
        expect(isSessionBlockedBySuspension(session, suspTier1)).toBe(true);

        // 2. Suspension with maxAllowedTier: 3 -> does NOT block tier 3 technical_drilling
        const suspTier3 = {
            startsOn: "2026-10-25",
            endsOn: "2026-11-10",
            requiresClearance: false,
            clearedAt: null,
            blockedSessionTypes: ["SPARRING", "GRAPPLING"] as const,
            maxAllowedTier: 3,
        };
        expect(isSessionBlockedBySuspension(session, suspTier3)).toBe(false);

        // 3. Demo createSuspension KO mặc định cho võ sĩ có buổi technical_drilling scheduled trong khoảng -> cancelled và có trong affectedSessions
        const today = academyDateOf(new Date());
        const fighterId = "f-diego-alvarez";
        const drillSessId = "sess-b2-35-tech-drill";

        db().trainingSessions = db().trainingSessions.filter((s) => s.id !== drillSessId);
        db().trainingSessions.push({
            id: drillSessId,
            fighterId,
            coachId: mockCoach.id,
            planId: null,
            title: "Scheduled Technical Drilling",
            type: "technical_drilling",
            scheduledAt: `${addDaysToDate(today, 2)}T10:00:00.000Z`,
            durationMin: 60,
            location: "Mat 1",
            targetRpe: 6,
            status: "scheduled",
            exercises: [],
            result: null,
            videoIds: [],
            cancellationReason: null,
            notes: null,
        });

        const created = await createSuspension(
            {
                fighterId,
                reason: "KO",
                startsOn: today,
                days: 14,
                requiresClearance: true,
            },
            mockCoach,
        );

        expect(created.affectedSessions).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    sessionId: drillSessId,
                    action: "cancel",
                }),
            ]),
        );

        const updatedSession = db().trainingSessions.find((s) => s.id === drillSessId);
        expect(updatedSession?.status).toBe("cancelled");
    });

    it("B2-36: API mode clearSuspensionAction không gọi request liệt kê đình chỉ nào, gọi thẳng POST /suspensions/:id/clear; backend trả 403 → câu vi forbidden", async () => {
        const { clearSuspensionAction } = await import("@/lib/actions/suspensions");
        const clientModule = await import("@/lib/api/client");
        const constantsModule = await import("@/lib/auth/constants");
        const sessionModule = await import("@/lib/auth/session");

        const demoAuthSpy = vitest.spyOn(constantsModule, "isDemoAuthEnabled").mockReturnValue(false);
        const userSpy = vitest.spyOn(sessionModule, "getCurrentUser").mockResolvedValue(mockCoach);
        const apiGetSpy = vitest.spyOn(clientModule, "authenticatedApiRequest").mockImplementation(async () => {
            throw new Error("authenticatedApiRequest should not be called in clearSuspensionAction");
        });
        const apiMutateSpy = vitest.spyOn(clientModule, "authenticatedMutableApiRequest").mockRejectedValueOnce(
            new ApiError({
                message: "Forbidden",
                kind: "http",
                status: 403,
                code: "FORBIDDEN",
            }),
        );

        const formData = new FormData();
        formData.append("id", "susp-api-clear-403");
        formData.append("clearanceNote", "Valid clearance note text");

        try {
            const res = await clearSuspensionAction({ status: "idle" }, formData);
            expect(apiGetSpy).not.toHaveBeenCalled();
            expect(apiMutateSpy).toHaveBeenCalledWith(
                "/suspensions/susp-api-clear-403/clear",
                expect.anything(),
                expect.objectContaining({
                    method: "POST",
                    body: JSON.stringify({ clearanceNote: "Valid clearance note text" }),
                }),
            );
            expect(res.status).toBe("error");
            expect(res.message).toBe("Bạn không có quyền thực hiện thao tác này.");
        } finally {
            demoAuthSpy.mockRestore();
            userSpy.mockRestore();
            apiGetSpy.mockRestore();
            apiMutateSpy.mockRestore();
        }
    });

    it("B2-37: 422 requiresClearance với lý do MANDATORY_REST → câu requiresClearanceDqForbidden; với KO → câu bắt buộc xác nhận", async () => {
        const { createSuspensionAction } = await import("@/lib/actions/suspensions");
        const sessionModule = await import("@/lib/auth/session");
        const userSpy = vitest.spyOn(sessionModule, "getCurrentUser").mockResolvedValue(mockCoach);

        try {
            // 1. MANDATORY_REST with requiresClearance: true -> requiresClearanceDqForbidden
            const formMandatory = new FormData();
            formMandatory.append("fighterId", "f-diego-alvarez");
            formMandatory.append("reason", "MANDATORY_REST");
            formMandatory.append("days", "14");
            formMandatory.append("requiresClearance", "on");

            const resMandatory = await createSuspensionAction({ status: "idle" }, formMandatory);
            expect(resMandatory.status).toBe("error");
            expect(resMandatory.fieldErrors?.requiresClearance).toBe(
                vi["suspensions.action.requiresClearanceDqForbidden"],
            );

            // 2. KO with requiresClearance: false -> requiresClearanceKoMandatory ("bắt buộc xác nhận")
            const formKo = new FormData();
            formKo.append("fighterId", "f-diego-alvarez");
            formKo.append("reason", "KO");
            formKo.append("days", "30");
            formKo.append("requiresClearance", "false");

            const resKo = await createSuspensionAction({ status: "idle" }, formKo);
            expect(resKo.status).toBe("error");
            expect(resKo.fieldErrors?.requiresClearance).toBe(
                vi["suspensions.action.requiresClearanceKoMandatory"],
            );

            // 3. Backend 422 error via mapSuspensionActionError
            const suspensionsService = await import("./suspensions");
            const createSpy = vitest.spyOn(suspensionsService, "createSuspension").mockRejectedValueOnce(
                new ApiError({
                    message: "Validation failed",
                    kind: "http",
                    status: 422,
                    code: "VALIDATION_ERROR",
                    details: [{ path: ["requiresClearance"], message: "Mandatory clearance error" }],
                }),
            );

            const formBackendKo = new FormData();
            formBackendKo.append("fighterId", "f-diego-alvarez");
            formBackendKo.append("reason", "KO");
            formBackendKo.append("days", "30");
            formBackendKo.append("requiresClearance", "on");

            const resBackendKo = await createSuspensionAction({ status: "idle" }, formBackendKo);
            expect(resBackendKo.status).toBe("error");
            expect(resBackendKo.fieldErrors?.requiresClearance).toBe(
                vi["suspensions.action.requiresClearanceKoMandatory"],
            );
            createSpy.mockRestore();
        } finally {
            userSpy.mockRestore();
        }
    });

    it("B2-38: Demo readiness: không có dòng cho võ sĩ không hoạt động; các dòng sắp theo tên", async () => {
        const baseFighter = db().fighters[0];
        const inactiveId = "f-test-inactive";
        const deletedId = "f-test-deleted";

        db().fighters = db().fighters.filter((f) => f.id !== inactiveId && f.id !== deletedId);
        db().fighters.push(
            {
                ...baseFighter,
                id: inactiveId,
                name: "AAA Inactive Fighter",
                status: "suspended",
            } as unknown as typeof baseFighter,
            {
                ...baseFighter,
                id: deletedId,
                name: "AAA Deleted Fighter",
                deletedAt: nowIso(),
            } as unknown as typeof baseFighter,
        );

        const rows = await getReadiness({}, mockAdmin);
        expect(rows.find((r) => r.fighterId === inactiveId)).toBeUndefined();
        expect(rows.find((r) => r.fighterId === deletedId)).toBeUndefined();
        expect(rows.length).toBeGreaterThan(1);

        for (let i = 0; i < rows.length - 1; i++) {
            expect(rows[i].fighterName.localeCompare(rows[i + 1].fighterName)).toBeLessThanOrEqual(0);
        }
    });

    it("B2-39: Demo applyConflicts bởi DOCTOR → 403 FORBIDDEN", async () => {
        const { applyConflicts } = await import("./suspensions.demo");
        await expect(
            applyConflicts("susp-active-ko", ["sess-1"], mockDoctorUser),
        ).rejects.toMatchObject({
            status: 403,
            code: "FORBIDDEN",
        });
    });
});
