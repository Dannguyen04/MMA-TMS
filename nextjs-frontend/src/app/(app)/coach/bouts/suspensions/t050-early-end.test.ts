import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/client";
import { filterEarlyEndExaminations } from "@/lib/domain/suspension-rules";
import type {
    MedicalExamination,
    Suspension,
    User,
} from "@/lib/domain/types";
import { createTranslator, type MessageKey } from "@/lib/i18n/translate";
import { buildCreateSuspensionSchema } from "@/lib/actions/suspension-schemas";
import { endSuspensionEarlyAction } from "@/lib/actions/suspensions";
import * as suspensionsService from "@/lib/services/suspensions";
import * as medicalService from "@/lib/services/medical";
import {
    SuspensionEarlyEndDialog,
    SuspensionEarlyEndAlert,
    handleEarlyEndActionResult,
} from "./suspension-early-end-dialog";
import { EarlyEndSuspensionButton, type EarlyEndSuspensionButtonProps } from "./early-end-suspension-button";
import { CreateSuspensionPanel, shouldShowSuspensionIssuer } from "./create-suspension-panel";
import CoachSuspensionsPage from "./page";
import DoctorFighterProfilePage from "@/app/(app)/doctor/fighters/[fighterId]/page";

const tVi = createTranslator("vi");
const tEn = createTranslator("en");

const mockDoctor: User = {
    id: "u-doctor-d",
    email: "doctor.d@example.com",
    name: "BS. Nguyễn Văn D",
    role: "doctor",
    title: "Bác sĩ thể thao",
    phone: null,
    status: "active",
    createdAt: "2026-01-01T00:00:00Z",
    lastActiveAt: null,
    profileId: "d-doctor-d",
    effectiveCapabilities: ["fighters:read", "medical:read", "medical:write"],
    assignmentScope: { fighterIds: ["f-fighter-1"] },
};

const mockCoach: User = {
    id: "u-coach-c",
    email: "coach.c@example.com",
    name: "HLV Trần C",
    role: "coach",
    title: "HLV MMA",
    phone: null,
    status: "active",
    createdAt: "2026-01-01T00:00:00Z",
    lastActiveAt: null,
    profileId: "coach-profile-c",
    effectiveCapabilities: ["training:read", "training:write"],
    assignmentScope: { fighterIds: ["f-fighter-1"] },
};

let currentUser: User = mockCoach;

vi.mock("@/lib/actions/suspensions", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@/lib/actions/suspensions")>();
    return {
        ...actual,
        endSuspensionEarlyAction: vi.fn(actual.endSuspensionEarlyAction),
    };
});

vi.mock("next/cache", () => ({
    revalidatePath: vi.fn(),
}));

vi.mock("next/navigation", () => ({
    useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
    redirect: vi.fn((url: string) => {
        throw new Error(`REDIRECT:${url}`);
    }),
}));

vi.mock("@/lib/auth/session", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@/lib/auth/session")>();
    return {
        ...actual,
        requireUser: vi.fn(async () => currentUser),
        getCurrentUser: vi.fn(async () => currentUser),
        requireRole: vi.fn(async () => currentUser),
    };
});

vi.mock("@/lib/i18n/server", () => ({
    getTranslator: async () => ({
        locale: "vi",
        t: tVi,
    }),
}));

vi.mock("@/components/ui/toast", () => ({
    useToast: () => vi.fn(),
}));

const mockFighterData = {
    id: "f-fighter-1",
    userId: "u-fighter-1",
    name: "Fighter One",
    nickname: null,
    sex: "male" as const,
    dateOfBirth: "1998-01-01",
    nationality: "VN",
    heightCm: 175,
    reachCm: 175,
    weightKg: 70,
    targetWeightKg: 70,
    bodyFatPct: null,
    restingHeartRate: null,
    weightClass: "lightweight" as const,
    stance: "orthodox" as const,
    level: "professional" as const,
    primaryDiscipline: "MMA",
    record: null,
    coachIds: ["u-coach-c"],
    primaryCoachId: "u-coach-c",
    doctorIds: ["d-doctor-d"],
    healthStatus: "fit" as const,
    joinedAt: "2026-01-01T00:00:00Z",
    upcomingBout: null,
};

vi.mock("@/lib/services/people", () => ({
    listFighters: vi.fn(async () => [
        { id: "f-fighter-1", name: "Fighter One", academyId: "acad-1" },
    ]),
    getFighter: vi.fn(async () => mockFighterData),
}));

vi.mock("@/lib/services/medical", () => ({
    listExaminations: vi.fn(async () => []),
    listInjuries: vi.fn(async () => []),
    getClearanceHistory: vi.fn(async () => []),
    listRecoveryPlans: vi.fn(async () => []),
    listReviewRequests: vi.fn(async () => []),
}));

vi.mock("@/lib/services/doctor-board", () => ({
    loadDoctorRow: vi.fn(async (stored: { id: string; name: string }) => ({
        fighter: { ...mockFighterData, id: stored.id, name: stored.name },
        summary: {
            fighter: { ...mockFighterData, id: stored.id, name: stored.name },
            clearance: null,
            clearanceState: "cleared" as const,
            activeInjuries: [],
            activeRecoveryPlan: null,
            latestExamination: null,
            needsBaseline: false,
            nextFollowUp: null,
            openReviewRequests: [],
        },
        training: { eligible: true, limitations: [] },
        competition: { eligible: true, limitations: [] },
        dossier: null,
        tag: "green" as const,
        items: [],
    })),
}));

vi.mock("@/lib/services/ai", () => ({
    listAlerts: vi.fn(async () => []),
}));

vi.mock("@/lib/services/medical-features", () => ({
    medicalFeatureAvailable: vi.fn(() => false),
}));

vi.mock("@/lib/services/suspensions", async (orig) => {
    const actual = await orig<typeof import("@/lib/services/suspensions")>();
    return {
        ...actual,
        listSuspensions: vi.fn(async () => []),
        suspensionBoutNames: vi.fn(async () => new Map()),
        endSuspensionEarly: vi.fn(),
    };
});

describe("T-050 Phần B: Ca kiểm thử W1-W9", () => {
    const SC: Suspension = {
        id: "susp-sc",
        fighterId: "f-fighter-1",
        boutId: null,
        reason: "MEDICAL",
        startsOn: "2026-11-01",
        endsOn: "2026-11-14",
        lossOfConsciousness: null,
        suggestedDays: 14,
        overrideReason: null,
        blockedSessionTypes: ["SPARRING"],
        maxAllowedTier: 1,
        requiresClearance: false,
        clearedAt: null,
        clearedById: null,
        clearanceNote: null,
        createdById: "u-coach-c",
        createdAt: "2026-11-01T08:00:00Z",
        updatedAt: "2026-11-01T08:00:00Z",
        status: "ACTIVE",
        gradedReturn: null,
        issuedBy: "CLUB",
        issuerReference: null,
        earlyEndExaminationId: null,
        liftReference: null,
    };

    const SO: Suspension = {
        ...SC,
        id: "susp-so",
        issuedBy: "ORGANIZER",
        issuerReference: "Giải MMA Hà Nội 2026, QĐ 12/BTC ngày 31/10",
    };

    const SKO: Suspension = {
        ...SC,
        id: "susp-sko",
        reason: "KO",
        requiresClearance: true,
    };

    const X1: MedicalExamination = {
        id: "exam-x1",
        fighterId: "f-fighter-1",
        doctorId: "d-doctor-d",
        date: "2026-11-05T02:00:00Z",
        type: "routine",
        vitals: null,
        assessments: [],
        outcome: "fit",
        summary: "Đủ điều kiện",
        recommendations: "",
        followUpDate: null,
        scope: "TRAINING",
        validUntil: null,
    };

    beforeEach(() => {
        vi.clearAllMocks();
        currentUser = mockCoach;
    });

    // ─── W1 ─────────────────────────────────────────────────────────────────
    it("W1: Trang bác sĩ thật, user DOCTOR (id 'u-doctor-d', profileId 'd-doctor-d') được phân cho F; listSuspensions trả SC, SO, SKO (KO ACTIVE) -> phần tử SC có 'Kết thúc sớm'; SO có 'Ban tổ chức đã gỡ'; SKO không có nút nào", async () => {
        currentUser = mockDoctor;
        vi.mocked(suspensionsService.listSuspensions).mockResolvedValueOnce([SC, SO, SKO]);

        const pageElement = await DoctorFighterProfilePage({
            params: Promise.resolve({ fighterId: "f-fighter-1" }),
            searchParams: Promise.resolve({}),
        });
        const html = renderToStaticMarkup(pageElement);

        expect(html).toContain("Kết thúc sớm");
        expect(html).toContain("Ban tổ chức đã gỡ");

        // Tìm phần tử của SKO (KO, ACTIVE): không chứa nút hành động nào
        const listItems = html.split("<li");
        const skoPart = listItems.find((p) => p.includes("Đình chỉ KO"));
        expect(skoPart).toBeDefined();
        expect(skoPart).not.toContain("Kết thúc sớm");
        expect(skoPart).not.toContain("Ban tổ chức đã gỡ");
        expect(skoPart).not.toContain("<button");

        // Phần tử của SC (CLUB, MEDICAL, ACTIVE) có nút "Kết thúc sớm"
        const scPart = listItems.find((p) => p.includes("Đình chỉ y tế") && !p.includes("Ban tổ chức"));
        expect(scPart).toBeDefined();
        expect(scPart).toContain("Kết thúc sớm");

        // Phần tử của SO (ORGANIZER, ACTIVE) có nút "Ban tổ chức đã gỡ"
        const soPart = listItems.find((p) => p.includes("Đình chỉ y tế (Ban tổ chức)"));
        expect(soPart).toBeDefined();
        expect(soPart).toContain("Ban tổ chức đã gỡ");
    });

    // ─── W2b ────────────────────────────────────────────────────────────────
    it("W2b: Tái hiện B1: Trang bác sĩ thật với X1 (doctorId: 'd-doctor-d') và X-other (doctorId: 'd-other') -> X1 được liệt kê, X-other không", async () => {
        currentUser = mockDoctor; // id: 'u-doctor-d', profileId: 'd-doctor-d'
        vi.mocked(suspensionsService.listSuspensions).mockResolvedValueOnce([SC]);

        const XOther: MedicalExamination = {
            ...X1,
            id: "exam-other",
            doctorId: "d-other",
        };

        vi.mocked(medicalService.listExaminations).mockResolvedValueOnce([X1, XOther]);

        const pageElement = await DoctorFighterProfilePage({
            params: Promise.resolve({ fighterId: "f-fighter-1" }),
            searchParams: Promise.resolve({}),
        });

        function findElementByType<P extends object>(
            node: unknown,
            type: unknown,
        ): React.ReactElement<P> | null {
            if (!node || typeof node !== "object" || !("type" in node)) return null;
            const element = node as React.ReactElement<P>;
            if (element.type === type) return element;
            const children = (element.props as { children?: unknown })?.children;
            if (children) {
                const childArray = Array.isArray(children) ? children : [children];
                for (const child of childArray) {
                    const found = findElementByType<P>(child, type);
                    if (found) return found;
                }
            }
            return null;
        }

        const buttonElement = findElementByType<EarlyEndSuspensionButtonProps>(pageElement, EarlyEndSuspensionButton);
        expect(buttonElement).toBeDefined();
        if (!buttonElement) throw new Error("Button element not found");

        // Render hộp thoại theo đúng đường dữ liệu trang bác sĩ truyền xuống
        const dialogHtml = renderToStaticMarkup(
            createElement(SuspensionEarlyEndDialog, {
                ...buttonElement.props,
                open: true,
                onClose: vi.fn(),
            }),
        );

        expect(dialogHtml).toContain('value="exam-x1"');
        expect(dialogHtml).not.toContain('value="exam-other"');
    });

    // ─── W2 ─────────────────────────────────────────────────────────────────
    it("W2: Hộp thoại kết thúc sớm, phiếu: X1, một phiếu COMPETITION, một phiếu ngày 31/10 -> Chỉ X1 được liệt kê", () => {
        const examCompetition: MedicalExamination = {
            ...X1,
            id: "exam-comp",
            scope: "COMPETITION",
        };

        const examOct31: MedicalExamination = {
            ...X1,
            id: "exam-oct31",
            date: "2026-10-31T10:00:00Z", // trước 2026-11-01
        };

        const exams = [X1, examCompetition, examOct31];
        const filtered = filterEarlyEndExaminations(exams, SC, { doctorId: "d-doctor-d" });

        expect(filtered).toHaveLength(1);
        expect(filtered[0].id).toBe("exam-x1");

        // Đồng thời kiểm tra trong HTML render của Dialog
        const html = renderToStaticMarkup(
            createElement(SuspensionEarlyEndDialog, {
                suspension: SC,
                examinations: exams,
                doctorId: "d-doctor-d",
                open: true,
                onClose: vi.fn(),
            }),
        );

        expect(html).toContain('value="exam-x1"');
        expect(html).not.toContain('value="exam-comp"');
        expect(html).not.toContain('value="exam-oct31"');
    });

    // ─── W2c ────────────────────────────────────────────────────────────────
    it("W2c: Phiếu X1 validUntil '2026-11-05T10:00:00+07:00' (= 03:00Z), now 2026-11-05T04:00:00Z -> X1 KHÔNG được liệt kê (đã hết hạn); validUntil '2026-11-05T12:00:00+07:00', cùng now -> X1 được liệt kê", () => {
        const now = "2026-11-05T04:00:00Z";

        // 1. validUntil 10:00+07:00 (= 03:00Z) <= 04:00Z -> Đã hết hạn -> KHÔNG được liệt kê
        const examExpired: MedicalExamination = {
            ...X1,
            validUntil: "2026-11-05T10:00:00+07:00",
        };
        const filteredExpired = filterEarlyEndExaminations([examExpired], SC, {
            doctorId: "d-doctor-d",
            now,
        });
        expect(filteredExpired).toHaveLength(0);

        // 2. validUntil 12:00+07:00 (= 05:00Z) > 04:00Z -> Chưa hết hạn -> Được liệt kê
        const examValid: MedicalExamination = {
            ...X1,
            validUntil: "2026-11-05T12:00:00+07:00",
        };
        const filteredValid = filterEarlyEndExaminations([examValid], SC, {
            doctorId: "d-doctor-d",
            now,
        });
        expect(filteredValid).toHaveLength(1);
        expect(filteredValid[0].id).toBe(examValid.id);
    });

    // ─── W3 ─────────────────────────────────────────────────────────────────
    it("W3: Hộp thoại, không phiếu nào hợp lệ -> Có câu báo và link 'Ghi phiếu khám'; nút gửi tắt", () => {
        const html = renderToStaticMarkup(
            createElement(SuspensionEarlyEndDialog, {
                suspension: SC,
                examinations: [],
                open: true,
                onClose: vi.fn(),
            }),
        );

        // Có câu báo
        expect(html).toContain("Chưa có phiếu khám tập luyện đủ điều kiện để kết thúc sớm");
        // Có link ghi phiếu khám
        expect(html).toContain("Ghi phiếu khám");
        expect(html).toContain("/doctor/examinations/new");
        // Theo T-053: không render nút submit, chỉ có nút Đóng và không có ô ghi chú
        expect(html).not.toContain('type="submit"');
        expect(html).toContain("Đóng");
        expect(html).not.toContain("early-end-note-textarea");
    });

    // ─── W4 ─────────────────────────────────────────────────────────────────
    it("W4: Ghi chú 2 ký tự -> Báo lỗi, không gọi action/service", async () => {
        currentUser = mockDoctor;
        const formData = new FormData();
        formData.set("id", "susp-sc");
        formData.set("note", "ok");
        formData.set("examinationId", "exam-x1");

        const result = await endSuspensionEarlyAction({ status: "idle" }, formData);
        expect(result.status).toBe("error");
        expect(result.fieldErrors?.note || result.message).toContain(
            tVi("suspensions.action.earlyEndNoteLength"),
        );
        expect(suspensionsService.endSuspensionEarly).not.toHaveBeenCalled();
    });

    // ─── W5 ─────────────────────────────────────────────────────────────────
    it("W5: Action nhận 409 SUSPENSION_EARLY_END_EXAM_INVALID cause EXPIRED, và MEDICAL_SUPERVISION_DISABLED -> Trả câu đã dịch theo từng mã/cause, không phải mã thô", async () => {
        currentUser = mockDoctor;

        // 1. Lỗi SUSPENSION_EARLY_END_EXAM_INVALID với cause EXPIRED
        vi.mocked(suspensionsService.endSuspensionEarly).mockRejectedValueOnce(
            new ApiError({
                message: "Exam expired",
                kind: "http",
                status: 409,
                code: "SUSPENSION_EARLY_END_EXAM_INVALID",
                details: { cause: "EXPIRED" },
            }),
        );

        const formExpired = new FormData();
        formExpired.set("id", "susp-sc");
        formExpired.set("note", "Khám ổn hết đau");
        formExpired.set("examinationId", "exam-x1");

        const resExpired = await endSuspensionEarlyAction({ status: "idle" }, formExpired);
        expect(resExpired.status).toBe("error");
        expect(resExpired.message).toBe("Phiếu khám đã hết hạn hiệu lực.");
        expect(resExpired.message).not.toContain("EXPIRED");
        expect(resExpired.message).not.toContain("SUSPENSION_EARLY_END_EXAM_INVALID");

        // 2. Lỗi MEDICAL_SUPERVISION_DISABLED
        vi.mocked(suspensionsService.endSuspensionEarly).mockRejectedValueOnce(
            new ApiError({
                message: "Medical supervision disabled",
                kind: "http",
                status: 409,
                code: "MEDICAL_SUPERVISION_DISABLED",
            }),
        );

        const formDisabled = new FormData();
        formDisabled.set("id", "susp-sc");
        formDisabled.set("note", "Khám ổn hết đau");
        formDisabled.set("examinationId", "exam-x1");

        const resDisabled = await endSuspensionEarlyAction({ status: "idle" }, formDisabled);
        expect(resDisabled.status).toBe("error");
        expect(resDisabled.message).toBe(
            "Học viện đang ở chế độ không giám sát y tế nên không thể dùng phiếu khám để kết thúc sớm.",
        );
        expect(resDisabled.message).not.toContain("MEDICAL_SUPERVISION_DISABLED");
    });

    // ─── W6 ─────────────────────────────────────────────────────────────────
    it("W6: Form tạo của HLV: lý do MEDICAL -> Có chọn nguồn; chọn ban tổ chức mà để trống văn bản thì báo lỗi; lý do KO thì không có chọn nguồn", () => {
        const schema = buildCreateSuspensionSchema(tVi);

        // 1. Schema: ORGANIZER để trống issuerReference -> báo lỗi
        const invalidOrg = schema.safeParse({
            fighterId: "f-fighter-1",
            reason: "MEDICAL",
            days: 14,
            issuedBy: "ORGANIZER",
            issuerReference: "",
        });
        expect(invalidOrg.success).toBe(false);
        if (!invalidOrg.success) {
            const err = invalidOrg.error.issues.find((i) => i.path.includes("issuerReference"));
            expect(err).toBeDefined();
            expect(err?.message).toBe(tVi("suspensions.action.issuerReferenceRequired"));
        }

        // 2. Schema: KO với issuedBy ORGANIZER -> báo lỗi
        const invalidKo = schema.safeParse({
            fighterId: "f-fighter-1",
            reason: "KO",
            days: 30,
            issuedBy: "ORGANIZER",
            issuerReference: "QĐ 12/BTC",
        });
        expect(invalidKo.success).toBe(false);
        if (!invalidKo.success) {
            const err = invalidKo.error.issues.find((i) => i.path.includes("issuedBy"));
            expect(err).toBeDefined();
            expect(err?.message).toBe(tVi("suspensions.action.organizerMedicalOnly"));
        }

        // 3. Hàm điều kiện trong production
        expect(shouldShowSuspensionIssuer("MEDICAL")).toBe(true);
        expect(shouldShowSuspensionIssuer("KO")).toBe(false);

        // 4. UI Component: Render CreateSuspensionPanel với initialReason MEDICAL -> có khối chọn nguồn
        const htmlMedical = renderToStaticMarkup(
            createElement(CreateSuspensionPanel, {
                open: true,
                onClose: vi.fn(),
                fighters: [{ id: "f-fighter-1", name: "Fighter One" }],
                locale: "vi",
                todayKey: "2026-11-05",
                initialReason: "MEDICAL",
            }),
        );
        expect(htmlMedical).toContain("Do ban tổ chức");

        // 5. UI Component: Render CreateSuspensionPanel mặc định (KO) -> không có ô chọn nguồn
        const htmlKo = renderToStaticMarkup(
            createElement(CreateSuspensionPanel, {
                open: true,
                onClose: vi.fn(),
                fighters: [{ id: "f-fighter-1", name: "Fighter One" }],
                locale: "vi",
                todayKey: "2026-11-05",
                initialReason: "KO",
            }),
        );
        expect(htmlKo).not.toContain("Do ban tổ chức");
        expect(htmlKo).not.toContain("Giải và văn bản đình chỉ");
    });

    // ─── W7 ─────────────────────────────────────────────────────────────────
    it("W7: Danh sách HLV: SO ACTIVE, SC ACTIVE -> SO có 'Ban tổ chức đã gỡ'; SC không có nút kết thúc nào, có dòng gợi ý yêu cầu khám", async () => {
        vi.mocked(suspensionsService.listSuspensions).mockResolvedValueOnce([SO, SC]);

        const pageElement = await CoachSuspensionsPage({
            params: Promise.resolve({}),
            searchParams: Promise.resolve({}),
        });
        const html = renderToStaticMarkup(pageElement);

        // SO (ORGANIZER ACTIVE) có nút "Ban tổ chức đã gỡ"
        expect(html).toContain("Ban tổ chức đã gỡ");

        // SC (CLUB MEDICAL ACTIVE) có dòng gợi ý yêu cầu khám kèm link và aria-label
        expect(html).toContain("Muốn kết thúc sớm: gửi yêu cầu khám, bác sĩ được phân kết thúc sau khi khám");
        expect(html).toContain("/coach/fighters/f-fighter-1");
        expect(html).toContain('aria-label="Gửi yêu cầu khám cho võ sĩ"');

        // Dòng nguồn của SO
        expect(html).toContain("Ban tổ chức: Giải MMA Hà Nội 2026, QĐ 12/BTC ngày 31/10");

        // Phần tử của SC không chứa nút kết thúc nào (không 'Ban tổ chức đã gỡ', không 'Kết thúc sớm', không <button> kết thúc)
        const rows = html.split("hover:bg-surface-muted/20");
        const scRow = rows.find((r) => r.includes("Muốn kết thúc sớm"));
        expect(scRow).toBeDefined();
        expect(scRow).not.toContain("Ban tổ chức đã gỡ");
        expect(scRow).not.toContain("Kết thúc sớm");
        expect(scRow).not.toContain("<button");
    });

    // ─── W8 ─────────────────────────────────────────────────────────────────
    it("W8: Đình chỉ kết thúc sớm clearedAt 2026-11-05T03:00:00Z theo X1 có ngày khám 2026-11-03 -> trang HLV hiện 'Kết thúc sớm ngày 05/11/2026 theo phiếu khám'; cái theo liftReference hiện 'Ban tổ chức gỡ: CV 15/BTC ngày 04/11 gỡ đình chỉ'", async () => {
        const endedByExam: Suspension = {
            ...SC,
            id: "susp-ended-exam",
            status: "ENDED",
            clearedAt: "2026-11-05T03:00:00Z",
            earlyEndExaminationId: "exam-x1",
        };

        const endedByLift: Suspension = {
            ...SO,
            id: "susp-ended-lift",
            status: "ENDED",
            clearedAt: "2026-11-05T03:00:00Z",
            liftReference: "CV 15/BTC ngày 04/11 gỡ đình chỉ",
        };

        vi.mocked(suspensionsService.listSuspensions).mockResolvedValueOnce([endedByExam, endedByLift]);

        const pageElement = await CoachSuspensionsPage({
            params: Promise.resolve({}),
            searchParams: Promise.resolve({}),
        });
        const html = renderToStaticMarkup(pageElement);

        // Hiện đúng hai dòng theo yêu cầu ca W8
        expect(html).toContain("Kết thúc sớm ngày 05/11/2026 theo phiếu khám");
        expect(html).toContain("Ban tổ chức gỡ: CV 15/BTC ngày 04/11 gỡ đình chỉ");
    });

    // ─── W9 ─────────────────────────────────────────────────────────────────
    it("W9: i18n -> Mọi khóa mới có cả vi và en (test dịch có sẵn qua)", () => {
        const newKeys = [
            "suspensions.action.earlyEnded",
            "suspensions.action.issuerReferenceRequired",
            "suspensions.action.liftReferenceLength",
            "suspensions.action.organizerMedicalOnly",
            "suspensions.action.clubIssuerReferenceForbidden",
            "suspensions.action.earlyEndNoteLength",
            "suspensions.action.earlyEndOneBasisRequired",
            "suspensions.action.medicalSupervisionDisabled",
            "suspensions.action.earlyEndNotEligible",
            "suspensions.action.examNotFound",
            "suspensions.action.examOtherDoctor",
            "suspensions.action.examNotTraining",
            "suspensions.action.examNotEligible",
            "suspensions.action.examBeforeSuspension",
            "suspensions.action.examSuperseded",
            "suspensions.action.examExpired",
            "suspensions.action.examInvalid",
            "suspensions.row.liftByOrganizerAction",
            "suspensions.row.earlyEndClubHint",
            "suspensions.row.earlyEndClubLinkAria",
            "suspensions.row.organizerPrefix",
            "suspensions.row.endedEarlyExam",
            "suspensions.row.endedEarlyLift",
            "suspensions.panel.issuedByLegend",
            "suspensions.panel.issuedByClub",
            "suspensions.panel.issuedByOrganizer",
            "suspensions.panel.issuerReferenceLabel",
            "suspensions.panel.issuerReferencePlaceholder",
            "suspensions.earlyEndDialog.organizerTitle",
            "suspensions.earlyEndDialog.organizerDesc",
            "suspensions.earlyEndDialog.medicalTitle",
            "suspensions.earlyEndDialog.medicalDesc",
            "suspensions.earlyEndDialog.sectionSuspension",
            "suspensions.earlyEndDialog.reasonLabel",
            "suspensions.earlyEndDialog.periodLabel",
            "suspensions.earlyEndDialog.sourceLabel",
            "suspensions.earlyEndDialog.sourceClub",
            "suspensions.earlyEndDialog.sourceOrganizer",
            "suspensions.earlyEndDialog.originalReference",
            "suspensions.earlyEndDialog.cutDays",
            "suspensions.earlyEndDialog.lastDay",
            "suspensions.earlyEndDialog.sectionBasis",
            "suspensions.earlyEndDialog.liftReferenceLabel",
            "suspensions.earlyEndDialog.liftReferencePlaceholder",
            "suspensions.earlyEndDialog.liftReferenceHint",
            "suspensions.earlyEndDialog.examLabel",
            "suspensions.earlyEndDialog.examRequired",
            "suspensions.earlyEndDialog.outcomeFit",
            "suspensions.earlyEndDialog.outcomeFitWithRestrictions",
            "suspensions.earlyEndDialog.validUntil",
            "suspensions.earlyEndDialog.noExamTitle",
            "suspensions.earlyEndDialog.noExamDesc",
            "suspensions.earlyEndDialog.createExamLink",
            "suspensions.earlyEndDialog.sectionConsequence",
            "suspensions.earlyEndDialog.afterEndDesc",
            "suspensions.earlyEndDialog.noteLabel",
            "suspensions.earlyEndDialog.notePlaceholder",
            "suspensions.earlyEndDialog.charCount",
            "suspensions.earlyEndDialog.confirm",
            "suspensions.earlyEndDialog.cancel",
            "suspensions.earlyEndDialog.close",
        ];

        for (const key of newKeys) {
            const viText = tVi(key as MessageKey);
            const enText = tEn(key as MessageKey);
            expect(viText).toBeDefined();
            expect(viText).not.toBe(key);
            expect(enText).toBeDefined();
            expect(enText).not.toBe(key);
        }
    });

    // ─── W10 ────────────────────────────────────────────────────────────────
    it("W10: Hộp thoại nhận lỗi server cause EXPIRED -> có phần tử role='alert' chứa câu đã dịch của EXPIRED trong hộp thoại", async () => {
        const expiredMsg = tVi("suspensions.action.examExpired"); // "Phiếu khám đã hết hạn hiệu lực."

        // 1. Mock endSuspensionEarlyAction trả { status: 'error', message: <câu đã dịch của cause EXPIRED> }
        vi.mocked(endSuspensionEarlyAction).mockResolvedValueOnce({
            status: "error",
            message: expiredMsg,
        });

        // 2. Kích hoạt submit qua action và xử lý kết quả bằng hàm production
        const formData = new FormData();
        formData.set("id", SC.id);
        formData.set("note", "Đã khám lại đạt yêu cầu");
        formData.set("examinationId", X1.id);

        const result = await endSuspensionEarlyAction({ status: "idle" }, formData);
        expect(result.status).toBe("error");

        let dialogServerError: string | null = null;
        handleEarlyEndActionResult(result, {
            setServerError: (msg) => {
                dialogServerError = msg;
            },
        });

        // Khẳng định setServerError được gọi với câu đã dịch của EXPIRED
        expect(dialogServerError).toBe(expiredMsg);

        // 3. Khẳng định hộp thoại ban đầu chưa có lỗi role='alert'
        const initialDialogHtml = renderToStaticMarkup(
            createElement(SuspensionEarlyEndDialog, {
                suspension: SC,
                examinations: [X1],
                doctorId: "d-doctor-d",
                open: true,
                onClose: vi.fn(),
            }),
        );
        expect(initialDialogHtml).not.toContain('role="alert"');

        // 4. Khi có serverError, component alert trong hộp thoại hiển thị role='alert' chứa câu đã dịch
        const alertHtml = renderToStaticMarkup(
            createElement(SuspensionEarlyEndAlert, { error: dialogServerError }),
        );
        expect(alertHtml).toContain('role="alert"');
        expect(alertHtml).toContain(expiredMsg);
    });

    // ─── W11 ────────────────────────────────────────────────────────────────
    it("W11: Trang bác sĩ, listSuspensions ném lỗi -> trang vẫn render (có tên võ sĩ) và có 'Không tải được danh sách đình chỉ'", async () => {
        currentUser = mockDoctor;
        vi.mocked(suspensionsService.listSuspensions).mockRejectedValueOnce(
            new ApiError({
                message: "Suspensions service unavailable",
                kind: "http",
                status: 500,
            }),
        );

        const pageElement = await DoctorFighterProfilePage({
            params: Promise.resolve({ fighterId: "f-fighter-1" }),
            searchParams: Promise.resolve({}),
        });
        const html = renderToStaticMarkup(pageElement);

        // The name now lives in the profile layout header; the page itself still renders its panels.
        expect(html).toContain("Bản đồ cơ thể");
        expect(html).toContain("Không tải được danh sách đình chỉ");
    });
});
