import fs from "fs";
import path from "path";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Fighter, Injury, MedicalExamination, User } from "@/lib/domain/types";
import type { MedicalReviewRequest } from "@/lib/domain/medical-contract";
import { routes } from "@/lib/routes";
import type { BoardRow, DoctorBoard } from "@/lib/services/doctor-board";
import * as doctorBoardService from "@/lib/services/doctor-board";
import * as medicalService from "@/lib/services/medical";
import * as peopleService from "@/lib/services/people";
import DoctorFightersPage from "./fighters/page";
// The list pages render these views; the views are what read the data, so the tests render them directly.
import { ExaminationsView } from "@/components/doctor/views/examinations-view";
import { HistoryView } from "@/components/doctor/views/history-view";
import { InjuriesView } from "@/components/doctor/views/injuries-view";
import DoctorReviewRequestsPage from "./review-requests/page";

const mockDoctor: User = {
    id: "u-doctor-d",
    email: "thu.le@example.com",
    name: "BS. Thu Lê",
    role: "doctor",
    title: "Bác sĩ thể thao",
    phone: null,
    status: "active",
    createdAt: "2026-01-01T00:00:00Z",
    lastActiveAt: null,
    profileId: "d-doctor-d",
    effectiveCapabilities: ["fighters:read", "medical:read", "medical:write"],
    assignmentScope: { fighterIds: ["f-1", "f-2"] },
};

function createMockFighter(id: string, name: string): Fighter {
    return {
        id,
        userId: `u-${id}`,
        name,
        nickname: null,
        sex: "male",
        dateOfBirth: "1998-01-01",
        nationality: "VN",
        heightCm: 175,
        reachCm: 175,
        weightKg: 70,
        targetWeightKg: 70,
        bodyFatPct: null,
        restingHeartRate: null,
        weightClass: "lightweight",
        stance: "orthodox",
        level: "professional",
        primaryDiscipline: "MMA",
        record: null,
        coachIds: [],
        primaryCoachId: null,
        doctorIds: ["d-doctor-d"],
        healthStatus: "healthy",
        joinedAt: "2026-01-01T00:00:00Z",
        upcomingBout: null,
    };
}

function buildBoardRow(fighterId: string, name: string): BoardRow {
    const fighter = createMockFighter(fighterId, name);
    return {
        fighter,
        summary: {
            fighter,
            clearance: null,
            clearanceState: "full",
            activeInjuries: [],
            activeRecoveryPlan: null,
            latestExamination: null,
            needsBaseline: false,
            nextFollowUp: null,
            openReviewRequests: [],
        },
        training: { scope: "TRAINING", eligible: true, reasons: [] },
        competition: null,
        dossier: null,
        tag: "green",
        items: [],
    };
}

vi.mock("@/lib/auth/session", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@/lib/auth/session")>();
    return {
        ...actual,
        requireRole: vi.fn(async () => mockDoctor),
    };
});

vi.mock("@/lib/services/doctor-board", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@/lib/services/doctor-board")>();
    return {
        ...actual,
        loadDoctorBoard: vi.fn(),
    };
});

vi.mock("@/lib/services/people", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@/lib/services/people")>();
    return {
        ...actual,
        listFighters: vi.fn(),
    };
});

vi.mock("@/lib/services/medical", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@/lib/services/medical")>();
    return {
        ...actual,
        listExaminations: vi.fn(),
        listInjuries: vi.fn(),
        listRecoveryPlans: vi.fn(),
        listClearances: vi.fn(),
        listReviewRequests: vi.fn(),
        getInjuryDetail: vi.fn(),
    };
});

function extractTableRows(html: string): string[] {
    const tbodyMatch = html.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/);
    if (!tbodyMatch) return [];
    return tbodyMatch[1].match(/<tr[\s\S]*?<\/tr>/g) ?? [];
}

function extractRowLinks(rowHtml: string): string[] {
    const matches = rowHtml.match(/<a[^>]*class="[^"]*yt-rowlink[^"]*"[^>]*href="([^"]+)"/g) ?? [];
    return matches.map((m) => {
        const hrefMatch = m.match(/href="([^"]+)"/);
        return hrefMatch ? hrefMatch[1] : "";
    });
}

describe("T-055 Ca kiểm thử L1–L4", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // ─── L1 ─────────────────────────────────────────────────────────────────
    it("L1: doctor.css -> có .yt-table tbody tr với position: relative; có a.yt-rowlink::after với position: absolute và inset: 0; có quy tắc :has( … :focus-visible cho hàng", () => {
        const cssPath = path.resolve(__dirname, "../../../components/doctor/doctor.css");
        const css = fs.readFileSync(cssPath, "utf8");

        // có .yt-table tbody tr với position: relative
        expect(css).toMatch(/\.yt-table\s+tbody\s+tr[^{]*\{[^}]*position:\s*relative/);

        // có a.yt-rowlink::after với position: absolute và inset: 0
        expect(css).toMatch(/a\.yt-rowlink::after[^{]*\{[^}]*position:\s*absolute[^}]*inset:\s*0/);

        // có quy tắc :has( … :focus-visible cho hàng
        expect(css).toMatch(/tr:has\([^)]*focus-visible\)/);
    });

    // ─── L2 ─────────────────────────────────────────────────────────────────
    it("L2: /doctor/fighters với 2 võ sĩ -> mỗi <tr> trong tbody có đúng 1 a.yt-rowlink, href là routes.doctor.fighter(id)", async () => {
        const r1 = buildBoardRow("f-1", "Nguyễn Văn A");
        const r2 = buildBoardRow("f-2", "Trần Văn B");
        const board: DoctorBoard = {
            rows: [r1, r2],
            alerts: [],
            alertsAvailable: false,
            warningDays: 7,
            counts: { blocked: 0, reviews: 0, alerts: 0 },
            now: "2026-11-03T08:00:00Z",
        };

        vi.mocked(doctorBoardService.loadDoctorBoard).mockResolvedValueOnce(board);

        const pageElement = await DoctorFightersPage({
            params: Promise.resolve({}),
            searchParams: Promise.resolve({}),
        });
        const html = renderToStaticMarkup(pageElement);

        const rows = extractTableRows(html);
        expect(rows).toHaveLength(2);

        for (let i = 0; i < rows.length; i++) {
            const links = extractRowLinks(rows[i]);
            expect(links).toHaveLength(1);
            expect(links[0]).toBe(routes.doctor.fighter(`f-${i + 1}`));
        }
    });

    // ─── L3 ─────────────────────────────────────────────────────────────────
    it("L3: /doctor/history với 1 sự kiện -> hàng có đúng 1 a.yt-rowlink (href = e.href) và 1 link võ sĩ không mang lớp yt-rowlink", async () => {
        const f1 = createMockFighter("f-1", "Nguyễn Văn A");
        const exam1: MedicalExamination = {
            id: "exam-1",
            fighterId: "f-1",
            doctorId: "d-doctor-d",
            date: "2026-11-03T08:00:00Z",
            type: "routine",
            vitals: null,
            assessments: [],
            outcome: "fit",
            summary: "Bình thường",
            recommendations: "",
            followUpDate: null,
            scope: "TRAINING",
            validUntil: null,
        };

        vi.mocked(peopleService.listFighters).mockResolvedValueOnce([f1]);
        vi.mocked(medicalService.listExaminations).mockResolvedValueOnce([exam1]);
        vi.mocked(medicalService.listInjuries).mockResolvedValueOnce([]);
        vi.mocked(medicalService.listRecoveryPlans).mockResolvedValueOnce([]);
        vi.mocked(medicalService.listClearances).mockResolvedValueOnce([]);
        vi.mocked(medicalService.listReviewRequests).mockResolvedValueOnce([]);

        const pageElement = await HistoryView({ query: {} });
        const html = renderToStaticMarkup(pageElement);

        const rows = extractTableRows(html);
        expect(rows).toHaveLength(1);
        const row = rows[0];

        // hàng có đúng 1 a.yt-rowlink (href = e.href)
        const rowlinks = extractRowLinks(row);
        expect(rowlinks).toHaveLength(1);
        // Records open inside their fighter's profile.
        expect(rowlinks[0]).toBe(routes.doctor.fighterExamination("f-1", "exam-1"));

        // 1 link võ sĩ không mang lớp yt-rowlink
        const fighterLinkMatch = row.match(/<a[^>]*href="\/doctor\/fighters\/f-1"[^>]*>/);
        expect(fighterLinkMatch).toBeTruthy();
        expect(fighterLinkMatch![0]).not.toContain("yt-rowlink");
    });

    // ─── L4 ─────────────────────────────────────────────────────────────────
    it("L4: mỗi trang còn lại trong bảng hiện trạng, 1 hàng -> mỗi hàng đúng 1 a.yt-rowlink", async () => {
        const f1 = createMockFighter("f-1", "Nguyễn Văn A");

        // 1. /doctor/examinations
        const exam1: MedicalExamination = {
            id: "exam-1",
            fighterId: "f-1",
            doctorId: "d-doctor-d",
            date: "2026-11-03T08:00:00Z",
            type: "routine",
            vitals: null,
            assessments: [],
            outcome: "fit",
            summary: "Bình thường",
            recommendations: "",
            followUpDate: null,
            scope: "TRAINING",
            validUntil: null,
        };
        vi.mocked(peopleService.listFighters).mockResolvedValueOnce([f1]);
        vi.mocked(medicalService.listExaminations).mockResolvedValueOnce([exam1]);

        const examPageElement = await ExaminationsView({ query: {} });
        const examHtml = renderToStaticMarkup(examPageElement);
        const examRows = extractTableRows(examHtml);
        expect(examRows).toHaveLength(1);
        expect(extractRowLinks(examRows[0])).toHaveLength(1);

        // 2. /doctor/injuries
        const inj1: Injury = {
            id: "inj-1",
            fighterId: "f-1",
            recordedById: "u-doctor-d",
            occurredAt: "2026-11-01T08:00:00Z",
            bodyRegion: "head",
            type: "contusion",
            severity: "minor",
            status: "active",
            description: "Bầm tím",
            resolvedAt: null,
            diagnosedAt: null,
            expectedReturnAt: null,
            linkedAlertId: null,
            mechanism: null,
        };
        vi.mocked(peopleService.listFighters).mockResolvedValueOnce([f1]);
        vi.mocked(medicalService.listInjuries).mockResolvedValueOnce([inj1]);
        vi.mocked(medicalService.getInjuryDetail).mockResolvedValueOnce({
            injury: inj1,
            fighter: f1,
            treatments: [],
            recoveryPlan: null,
            linkedAlert: null,
            recordedBy: null,
        });

        const injuryPageElement = await InjuriesView({ query: {} });
        const injuryHtml = renderToStaticMarkup(injuryPageElement);
        const injuryRows = extractTableRows(injuryHtml);
        expect(injuryRows).toHaveLength(1);
        expect(extractRowLinks(injuryRows[0])).toHaveLength(1);

        // 3. /doctor/review-requests
        const req1: MedicalReviewRequest = {
            id: "req-1",
            fighterId: "f-1",
            requestedById: "u-coach-1",
            requesterRole: "COACH",
            reason: "Kiểm tra tay sau buổi tập",
            status: "OPEN",
            requestedAt: "2026-11-02T10:00:00Z",
            resolvedAt: null,
            resolvedByExaminationId: null,
        };
        vi.mocked(peopleService.listFighters).mockResolvedValueOnce([f1]);
        vi.mocked(medicalService.listReviewRequests).mockResolvedValueOnce([req1]);

        const reviewPageElement = await DoctorReviewRequestsPage({
            params: Promise.resolve({}),
            searchParams: Promise.resolve({}),
        });
        const reviewHtml = renderToStaticMarkup(reviewPageElement);
        const reviewRows = extractTableRows(reviewHtml);
        expect(reviewRows).toHaveLength(1);
        expect(extractRowLinks(reviewRows[0])).toHaveLength(1);
    });
});
