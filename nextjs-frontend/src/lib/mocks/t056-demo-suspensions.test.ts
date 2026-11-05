import { beforeEach, describe, expect, it, vi } from "vitest";

import { accessibleFighterIds } from "@/lib/auth/access";
import {
    academyDateOf,
    addDaysToDate,
    filterEarlyEndExaminations,
    isSessionBlockedBySuspension,
    suspensionStatusOn,
} from "@/lib/domain/suspension-rules";
import type { Suspension, TrainingSession, User } from "@/lib/domain/types";
import { db } from "@/lib/mocks/db";
import { mockCoaches, mockDoctors, mockUsers } from "@/lib/mocks/people";
import { mockSystemSettings } from "@/lib/mocks/roles";
import { buildMockSuspensions } from "@/lib/mocks/suspensions";
import { MOCK_ANCHOR_ISO, mondayOffset, TODAY_KEY } from "@/lib/mocks/time";
import { mockTrainingSessions } from "@/lib/mocks/training";
import { createExamination } from "@/lib/services/medical.demo";
import { endSuspensionEarly } from "@/lib/services/suspensions.demo";

// User builders following suspensions-page.test.ts
const baseRafael = mockUsers.find((u) => u.id === "u-rafael-costa")!;
const rafaelCoach = mockCoaches.find((c) => c.userId === "u-rafael-costa")!;
const mockRafaelCoach: User = {
    ...baseRafael,
    effectiveCapabilities: [
        "fighters:read",
        "fighters:write",
        "training:read",
        "training:write",
    ],
    assignmentScope: {
        fighterIds: [...rafaelCoach.fighterIds],
    },
};

const baseThu = mockUsers.find((u) => u.id === "u-thu-le")!;
const thuDoctor = mockDoctors.find((d) => d.userId === "u-thu-le")!;
const mockThuDoctor: User = {
    ...baseThu,
    effectiveCapabilities: ["fighters:read", "medical:read", "medical:write"],
    assignmentScope: {
        fighterIds: [...thuDoctor.fighterIds],
    },
};

describe("T-056: Dữ liệu demo đủ các tình huống đình chỉ", () => {
    beforeEach(() => {
        delete (globalThis as Record<string, unknown>).__mmaMockDb;
    });

    it("M1 suspensionStatusOn cho từng id S6, S7, S8, H1, H2, H3 -> S6, S7, S8: ACTIVE, H1, H2, H3: ENDED", () => {
        const suspensions = db().suspensions;
        const s6 = suspensions.find((s) => s.id === "susp-medical-club-exam")!;
        const s7 = suspensions.find((s) => s.id === "susp-medical-organizer")!;
        const s8 = suspensions.find((s) => s.id === "susp-medical-club-pending")!;
        const h1 = suspensions.find((s) => s.id === "susp-history-early-end")!;
        const h2 = suspensions.find((s) => s.id === "susp-history-no-medical")!;
        const h3 = suspensions.find((s) => s.id === "susp-history-dq")!;

        expect(suspensionStatusOn(s6, TODAY_KEY)).toBe("ACTIVE");
        expect(suspensionStatusOn(s7, TODAY_KEY)).toBe("ACTIVE");
        expect(suspensionStatusOn(s8, TODAY_KEY)).toBe("ACTIVE");
        expect(suspensionStatusOn(h1, TODAY_KEY)).toBe("ENDED");
        expect(suspensionStatusOn(h2, TODAY_KEY)).toBe("ENDED");
        expect(suspensionStatusOn(h3, TODAY_KEY)).toBe("ENDED");
    });

    it("M2 Năm tình huống cũ -> Trạng thái không đổi: Marcus susp-active-ko ACTIVE, Diego AWAITING_CLEARANCE, Linh ENDED có gradedReturn.ceiling 3, Tariq susp-mandatory-rest ACTIVE, Emma không có đình chỉ nào", () => {
        const suspensions = db().suspensions;
        const marcus = suspensions.find((s) => s.id === "susp-active-ko")!;
        const diego = suspensions.find((s) => s.id === "susp-awaiting-clearance")!;
        const linh = suspensions.find((s) => s.id === "susp-graded-return")!;
        const tariq = suspensions.find((s) => s.id === "susp-mandatory-rest")!;
        const emmaSuspensions = suspensions.filter((s) => s.fighterId === "f-emma-lindqvist");

        expect(suspensionStatusOn(marcus, TODAY_KEY)).toBe("ACTIVE");
        expect(suspensionStatusOn(diego, TODAY_KEY)).toBe("AWAITING_CLEARANCE");
        expect(suspensionStatusOn(linh, TODAY_KEY)).toBe("ENDED");
        expect(linh.gradedReturn?.ceiling).toBe(3);
        expect(suspensionStatusOn(tariq, TODAY_KEY)).toBe("ACTIVE");
        expect(emmaSuspensions).toHaveLength(0);
    });

    it("M3 filterEarlyEndExaminations(exams, S6, { doctorId: 'd-thu-le', now }) -> Đúng 1 phiếu, là phiếu S6", () => {
        const exams = db().medicalExaminations;
        const s6 = db().suspensions.find((s) => s.id === "susp-medical-club-exam")!;
        const filtered = filterEarlyEndExaminations(exams, s6, {
            doctorId: "d-thu-le",
            now: MOCK_ANCHOR_ISO,
        });

        expect(filtered).toHaveLength(1);
        expect(filtered[0]?.id).toBe("ex-hoang-early-end-0d");
        expect(filtered[0]?.fighterId).toBe("f-hoang-long");
        expect(filtered[0]?.doctorId).toBe("d-thu-le");
        expect(filtered[0]?.scope).toBe("TRAINING");
        expect(filtered[0]?.outcome).toBe("fit");
    });

    it("M4 Như M3 cho S8 -> Mảng rỗng", () => {
        const exams = db().medicalExaminations;
        const s8 = db().suspensions.find((s) => s.id === "susp-medical-club-pending")!;
        const filtered = filterEarlyEndExaminations(exams, s8, {
            doctorId: "d-thu-le",
            now: MOCK_ANCHOR_ISO,
        });

        expect(filtered).toEqual([]);
    });

    it("M5 S7 -> reason 'MEDICAL', issuedBy 'ORGANIZER', issuerReference khác rỗng", () => {
        const s7 = db().suspensions.find((s) => s.id === "susp-medical-organizer")!;

        expect(s7.reason).toBe("MEDICAL");
        expect(s7.issuedBy).toBe("ORGANIZER");
        expect(s7.issuerReference).toBeTruthy();
        expect(s7.issuerReference).toBe("QĐ 12/BTC – Giải MMA mở rộng TP.HCM");
    });

    it("M6 accessibleFighterIds của HLV Rafael và bác sĩ Thu (đúng cách suspensions-page.test.ts dựng user) -> Rafael có Hoàng Long, Bảo, Sofia; Thu có Hoàng Long, Sofia, Marcus", () => {
        const rafaelIds = accessibleFighterIds(mockRafaelCoach);
        const thuIds = accessibleFighterIds(mockThuDoctor);

        expect(rafaelIds).toContain("f-hoang-long");
        expect(rafaelIds).toContain("f-bao-nguyen");
        expect(rafaelIds).toContain("f-sofia-kowalski");

        expect(thuIds).toContain("f-hoang-long");
        expect(thuIds).toContain("f-sofia-kowalski");
        expect(thuIds).toContain("f-marcus-hale");
    });

    it("M7 endSuspensionEarly(S6, { examinationId: <phiếu S6>, note }, bác sĩ Thu) trên db demo -> Trả về status 'ENDED', gradedReturn.ceiling 3, earlyEndExaminationId là phiếu S6", async () => {
        const res = await endSuspensionEarly(
            "susp-medical-club-exam",
            {
                examinationId: "ex-hoang-early-end-0d",
                note: "Bác sĩ Thu Lê kết thúc sớm đình chỉ sau khi khám lại",
            },
            mockThuDoctor,
        );

        expect(res.status).toBe("ENDED");
        expect(res.gradedReturn?.ceiling).toBe(3);
        expect(res.earlyEndExaminationId).toBe("ex-hoang-early-end-0d");
    });

    it("M8 endSuspensionEarly(S6, { examinationId, note }, HLV Rafael) -> Lỗi 403 FORBIDDEN", async () => {
        await expect(
            endSuspensionEarly(
                "susp-medical-club-exam",
                {
                    examinationId: "ex-hoang-early-end-0d",
                    note: "HLV thử kết thúc sớm đình chỉ cấp CLB",
                },
                mockRafaelCoach,
            ),
        ).rejects.toMatchObject({
            status: 403,
            code: "FORBIDDEN",
        });
    });

    it("M9 endSuspensionEarly(S7, { liftReference: 'CV 30/BTC', note }, HLV Rafael) -> status 'ENDED', liftReference 'CV 30/BTC'", async () => {
        const res = await endSuspensionEarly(
            "susp-medical-organizer",
            {
                liftReference: "CV 30/BTC",
                note: "HLV gỡ đình chỉ theo công văn ban tổ chức",
            },
            mockRafaelCoach,
        );

        expect(res.status).toBe("ENDED");
        expect(res.liftReference).toBe("CV 30/BTC");
    });

    it("M10 H1 -> earlyEndExaminationId trỏ tới một phiếu có trong seed: Marcus, d-thu-le, scope 'TRAINING', kết luận fit hoặc fit_with_restrictions, ngày khám nằm giữa startsOn và clearedAt", () => {
        const h1 = db().suspensions.find((s) => s.id === "susp-history-early-end")!;
        expect(h1.earlyEndExaminationId).toBeTruthy();

        const exam = db().medicalExaminations.find((e) => e.id === h1.earlyEndExaminationId);
        expect(exam).toBeDefined();
        expect(exam?.fighterId).toBe("f-marcus-hale");
        expect(exam?.doctorId).toBe("d-thu-le");
        expect(exam?.scope).toBe("TRAINING");
        expect(["fit", "fit_with_restrictions"]).toContain(exam?.outcome);

        const examDate = academyDateOf(new Date(exam!.date));
        const clearedDate = academyDateOf(new Date(h1.clearedAt!));
        expect(examDate >= h1.startsOn && examDate <= clearedDate).toBe(true);
    });

    it("M11 H2 -> requiresClearance true, clearedById 'u-rafael-costa', clearanceNote chứa 'không có xác nhận y tế'", () => {
        const h2 = db().suspensions.find((s) => s.id === "susp-history-no-medical")!;

        expect(h2.requiresClearance).toBe(true);
        expect(h2.clearedById).toBe("u-rafael-costa");
        expect(h2.clearanceNote).toContain("không có xác nhận y tế");
    });

    it("M12 H3 -> reason 'DQ', requiresClearance false, clearedAt null", () => {
        const h3 = db().suspensions.find((s) => s.id === "susp-history-dq")!;

        expect(h3.reason).toBe("DQ");
        expect(h3.requiresClearance).toBe(false);
        expect(h3.clearedAt).toBeNull();
    });

    it("M13 medicalReviewRequests của seed -> Đúng một dòng OPEN cho Sofia, người gửi u-rafael-costa, vai trò COACH", () => {
        const requests = db().medicalReviewRequests;
        const openSofia = requests.filter(
            (r) => r.fighterId === "f-sofia-kowalski" && r.status === "OPEN",
        );

        expect(openSofia).toHaveLength(1);
        expect(openSofia[0]?.requestedById).toBe("u-rafael-costa");
        expect(openSofia[0]?.requesterRole).toBe("COACH");
    });

    it("M14 Gọi createExamination của medical.demo.ts cho Sofia bằng bác sĩ Thu (scope 'TRAINING', outcome 'fit', ngày hôm nay), rồi chạy filterEarlyEndExaminations cho S8 -> Trước: 0 phiếu, Sau: 1 phiếu, Yêu cầu khám M13 chuyển RESOLVED", async () => {
        const s8 = db().suspensions.find((s) => s.id === "susp-medical-club-pending")!;
        const before = filterEarlyEndExaminations(db().medicalExaminations, s8, {
            doctorId: "d-thu-le",
            now: MOCK_ANCHOR_ISO,
        });
        expect(before).toHaveLength(0);

        const reqBefore = db().medicalReviewRequests.find(
            (r) => r.fighterId === "f-sofia-kowalski" && r.requestedById === "u-rafael-costa",
        );
        expect(reqBefore?.status).toBe("OPEN");

        const createRes = await createExamination(
            {
                fighterId: "f-sofia-kowalski",
                type: "return_to_play",
                date: `${TODAY_KEY}T10:00:00.000Z`,
                scope: "TRAINING",
                outcome: "fit",
                assessments: [],
                summary: "Khám lại cho Sofia sau đình chỉ",
                recommendations: "Đủ điều kiện tập luyện",
                followUpDate: null,
                vitals: null,
                scat6: null,
            },
            mockThuDoctor,
        );
        expect(createRes.ok).toBe(true);

        const after = filterEarlyEndExaminations(db().medicalExaminations, s8, {
            doctorId: "d-thu-le",
            now: MOCK_ANCHOR_ISO,
        });
        expect(after).toHaveLength(1);

        const reqAfter = db().medicalReviewRequests.find((r) => r.id === reqBefore?.id);
        expect(reqAfter?.status).toBe("RESOLVED");
    });

    it("M15 Buổi tập trong seed (db().trainingSessions) của Hoàng Long, Bảo, Sofia: không có buổi nào status 'completed' có ngày từ startsOn của S6, S7, S8 tương ứng", () => {
        const suspensions = db().suspensions;
        const sessions = db().trainingSessions;
        const targets = [
            { fighterId: "f-hoang-long", suspId: "susp-medical-club-exam" },
            { fighterId: "f-bao-nguyen", suspId: "susp-medical-organizer" },
            { fighterId: "f-sofia-kowalski", suspId: "susp-medical-club-pending" },
        ];

        const violations: string[] = [];
        for (const { fighterId, suspId } of targets) {
            const susp = suspensions.find((s) => s.id === suspId)!;
            const completed = sessions.filter(
                (s) =>
                    s.fighterId === fighterId &&
                    s.status === "completed" &&
                    academyDateOf(s.scheduledAt) >= susp.startsOn,
            );
            if (completed.length > 0) {
                violations.push(
                    `${fighterId} có ${completed.length} buổi completed từ startsOn ${susp.startsOn}: ${completed.map((s) => s.id).join(", ")}`,
                );
            }
        }

        expect(violations).toEqual([]);
    });

    it("M16 Phiếu H1 (summary, recommendations, các note của assessments) và clearanceNote của H1: không chứa 'gãy', 'xương' hay 'bàn tay'", () => {
        const h1 = db().suspensions.find((s) => s.id === "susp-history-early-end")!;
        const exam = db().medicalExaminations.find((e) => e.id === h1.earlyEndExaminationId)!;

        const forbiddenWords = ["gãy", "xương", "bàn tay"];
        const violations: string[] = [];

        const texts = [
            h1.clearanceNote ?? "",
            exam.summary,
            exam.recommendations,
            ...exam.assessments.map((a) => a.note),
        ];

        for (const text of texts) {
            for (const word of forbiddenWords) {
                if (text.toLowerCase().includes(word.toLowerCase())) {
                    violations.push(`Tìm thấy "${word}" trong text: "${text}"`);
                }
            }
        }

        expect(violations).toEqual([]);
    });

    function assertSuspensionInvariants(
        targetDb: { suspensions: Suspension[]; trainingSessions: TrainingSession[] },
        suspId: string,
        isBlockedFn = isSessionBlockedBySuspension,
        dateOfFn = academyDateOf,
    ) {
        const susp = targetDb.suspensions.find((s) => s.id === suspId)!;
        expect(susp).toBeDefined();

        const blockedSessions = targetDb.trainingSessions.filter((s) => {
            if (s.fighterId !== susp.fighterId) return false;
            const sessionDate = dateOfFn(new Date(s.scheduledAt));
            if (sessionDate < susp.startsOn || sessionDate > susp.endsOn) return false;
            return isBlockedFn(s, susp);
        });

        // (a) Không có buổi nào scheduled hay completed
        const scheduledOrCompleted = blockedSessions.filter(
            (s) => s.status === "scheduled" || s.status === "completed",
        );
        expect(scheduledOrCompleted).toHaveLength(0);

        // (b) Có ít nhất một buổi pending
        const pendingSessions = blockedSessions.filter((s) => s.status === "pending");
        expect(pendingSessions.length).toBeGreaterThanOrEqual(1);
    }

    it("K1 Toàn bộ test hiện có và kịch bản demo giữ nguyên tính toàn vẹn", () => {
        // Assert all 10 suspensions exist in seed (buildMockSuspensions()) and db(), and are uniquely identified
        const seeded = buildMockSuspensions();
        expect(seeded).toHaveLength(10);
        expect(new Set(seeded.map((s) => s.id)).size).toBe(10);

        const currentDb = db();
        const suspensions = currentDb.suspensions;
        expect(suspensions).toHaveLength(10); // 4 initial + 3 active new (S6, S7, S8) + 3 history (H1, H2, H3)
        const ids = new Set(suspensions.map((s) => s.id));
        expect(ids.size).toBe(10);

        // Tác dụng phụ đã biết theo F7 (Item 6):
        const sofiaPlan = currentDb.trainingPlans.find((p) => p.id === "tp-sofia-camp");
        const hoangPlan = currentDb.trainingPlans.find((p) => p.id === "tp-hoang-camp");
        expect(sofiaPlan?.phase).toBe("rehab");
        expect(hoangPlan?.phase).toBe("rehab");

        // Bất biến theo Lượt sửa 4: Trong khung đình chỉ đang hiệu lực của S6, S7, S8,
        // mọi buổi mà isSessionBlockedBySuspension trả true:
        // (a) không có buổi nào scheduled hay completed;
        // (b) có ít nhất một buổi pending.
        for (const suspId of [
            "susp-medical-club-exam",
            "susp-medical-organizer",
            "susp-medical-club-pending",
        ]) {
            assertSuspensionInvariants(currentDb, suspId);
        }
    });

    it("M17 Mốc neo giả lúc 12:00 giờ học viện của bảy ngày liên tiếp (thứ Hai tới Chủ nhật), cộng thêm 00:30 và 23:30 của một ngày -> Ở mọi mốc, M15 và K1 đều qua", async () => {
        const anchorStore = globalThis as { __mmaMockAnchorMs?: number };
        const originalAnchor = anchorStore.__mmaMockAnchorMs;

        const monday = addDaysToDate(TODAY_KEY, mondayOffset());
        const testAnchors = [
            ...Array.from({ length: 7 }, (_, i) => {
                const dateKey = addDaysToDate(monday, i);
                return {
                    timeStr: `${dateKey} 12:00`,
                    anchorMs: Date.parse(`${dateKey}T12:00:00+07:00`),
                };
            }),
            {
                timeStr: `${TODAY_KEY} 00:30`,
                anchorMs: Date.parse(`${TODAY_KEY}T00:30:00+07:00`),
            },
            {
                timeStr: `${TODAY_KEY} 23:30`,
                anchorMs: Date.parse(`${TODAY_KEY}T23:30:00+07:00`),
            },
        ];

        try {
            for (const { timeStr, anchorMs } of testAnchors) {
                vi.resetModules();
                delete (globalThis as Record<string, unknown>).__mmaMockDb;
                anchorStore.__mmaMockAnchorMs = anchorMs;

                const { db: freshDb } = await import("@/lib/mocks/db");
                const { buildMockSuspensions: freshBuildMockSuspensions } = await import(
                    "@/lib/mocks/suspensions"
                );
                const {
                    academyDateOf: freshAcademyDateOf,
                    isSessionBlockedBySuspension: freshIsBlocked,
                } = await import("@/lib/domain/suspension-rules");

                const currentDb = freshDb();

                // Kiểm tra M15: không có buổi completed từ startsOn
                const s6 = currentDb.suspensions.find((s) => s.id === "susp-medical-club-exam")!;
                const s7 = currentDb.suspensions.find((s) => s.id === "susp-medical-organizer")!;
                const s8 = currentDb.suspensions.find((s) => s.id === "susp-medical-club-pending")!;

                const targets = [
                    { fighterId: "f-hoang-long", startsOn: s6.startsOn },
                    { fighterId: "f-bao-nguyen", startsOn: s7.startsOn },
                    { fighterId: "f-sofia-kowalski", startsOn: s8.startsOn },
                ];

                const violations: string[] = [];
                for (const { fighterId, startsOn } of targets) {
                    const invalidSessions = currentDb.trainingSessions.filter((s) => {
                        if (s.fighterId !== fighterId) return false;
                        if (s.status !== "completed") return false;
                        const sessionDate = freshAcademyDateOf(new Date(s.scheduledAt));
                        return sessionDate >= startsOn;
                    });

                    if (invalidSessions.length > 0) {
                        violations.push(
                            `[${timeStr}] ${fighterId} có ${invalidSessions.length} buổi completed từ startsOn ${startsOn}: ${invalidSessions.map((s) => s.id).join(", ")}`,
                        );
                    }
                }
                expect(violations).toEqual([]);

                // Kiểm tra K1: 10 đình chỉ trong seed và side effects F7
                expect(freshBuildMockSuspensions()).toHaveLength(10);
                expect(currentDb.suspensions).toHaveLength(10);
                expect(new Set(currentDb.suspensions.map((s) => s.id)).size).toBe(10);

                const sofiaPlan = currentDb.trainingPlans.find((p) => p.id === "tp-sofia-camp");
                const hoangPlan = currentDb.trainingPlans.find((p) => p.id === "tp-hoang-camp");
                expect(sofiaPlan?.phase).toBe("rehab");
                expect(hoangPlan?.phase).toBe("rehab");

                // Bất biến theo Lượt sửa 4:
                for (const suspId of [
                    "susp-medical-club-exam",
                    "susp-medical-organizer",
                    "susp-medical-club-pending",
                ]) {
                    assertSuspensionInvariants(
                        currentDb,
                        suspId,
                        freshIsBlocked,
                        freshAcademyDateOf,
                    );
                }
            }
        } finally {
            anchorStore.__mmaMockAnchorMs = originalAnchor;
            delete (globalThis as Record<string, unknown>).__mmaMockDb;
            vi.resetModules();
        }
    });

    it("M18 Sửa db().settings hoặc một buổi trong db().trainingSessions (ví dụ đổi status), rồi đọc hằng tương ứng của module (mockSystemSettings, mockTrainingSessions) -> Hằng của module không đổi", () => {
        const originalOrgName = mockSystemSettings.organizationName;
        const targetSession = mockTrainingSessions[0]!;
        const originalStatus = targetSession.status;

        const currentDb = db();
        currentDb.settings.organizationName = "Modified Org Name For Test";
        const sessionInDb = currentDb.trainingSessions.find((s) => s.id === targetSession.id)!;
        sessionInDb.status = sessionInDb.status === "completed" ? "cancelled" : "completed";

        try {
            expect(mockSystemSettings.organizationName).toBe(originalOrgName);
            expect(targetSession.status).toBe(originalStatus);
        } finally {
            mockSystemSettings.organizationName = originalOrgName;
            targetSession.status = originalStatus;
        }
    });

    it("M19 Mốc neo giả mà buổi recovery_mobility hôm nay của Marcus (s-marcus-recovery-today) đã completed trong mockTrainingSessions (ví dụ 07/11 lúc 23:30) -> Trong db(), buổi đó vẫn completed", async () => {
        const anchorStore = globalThis as { __mmaMockAnchorMs?: number };
        const originalAnchor = anchorStore.__mmaMockAnchorMs;
        const testAnchorMs = Date.parse("2026-11-07T23:30:00+07:00");

        try {
            vi.resetModules();
            delete (globalThis as Record<string, unknown>).__mmaMockDb;
            anchorStore.__mmaMockAnchorMs = testAnchorMs;

            const { mockTrainingSessions: freshMockSessions } = await import("@/lib/mocks/training");
            const { db: freshDb } = await import("@/lib/mocks/db");

            const rawMarcus = freshMockSessions.find(
                (s) => s.fighterId === "f-marcus-hale" && s.id === "s-marcus-recovery-today",
            );
            expect(rawMarcus?.status).toBe("completed");

            const dbMarcus = freshDb().trainingSessions.find(
                (s) => s.fighterId === "f-marcus-hale" && s.id === "s-marcus-recovery-today",
            );
            expect(dbMarcus?.status).toBe("completed");
        } finally {
            anchorStore.__mmaMockAnchorMs = originalAnchor;
            delete (globalThis as Record<string, unknown>).__mmaMockDb;
            vi.resetModules();
        }
    });
});
