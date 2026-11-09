import fs from "fs";
import path from "path";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Fighter, User } from "@/lib/domain/types";
import { routes } from "@/lib/routes";
import type { BoardRow, DoctorBoard } from "@/lib/services/doctor-board";
import DoctorDashboardPage from "./page";

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
    assignmentScope: { fighterIds: ["f-1"] },
};

let currentBoard: DoctorBoard;

vi.mock("@/lib/auth/session", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@/lib/auth/session")>();
    return {
        ...actual,
        requireRole: vi.fn(async () => mockDoctor),
    };
});

vi.mock("@/lib/services/doctor-board", () => ({
    loadDoctorBoard: vi.fn(async () => currentBoard),
}));

vi.mock("@/lib/services/medical", () => ({
    listRecoveryPlans: vi.fn(async () => []),
}));

vi.mock("@/lib/services/medical-features", () => ({
    medicalFeatureAvailable: vi.fn(() => false),
}));

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

type BuildRowOverrides = Omit<Partial<BoardRow>, "summary"> & {
    fighterId?: string;
    name?: string;
    summary?: Partial<BoardRow["summary"]>;
};

function buildRow(overrides: BuildRowOverrides): BoardRow {
    const id = overrides.fighterId ?? "f-1";
    const fighter = overrides.fighter ?? createMockFighter(id, overrides.name ?? "Võ Sĩ Một");
    const { summary: summaryOverride, ...restOverrides } = overrides;
    return {
        fighter,
        training: { scope: "TRAINING", eligible: true, reasons: [] },
        competition: null,
        dossier: null,
        tag: "green",
        items: [],
        ...restOverrides,
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
            ...summaryOverride,
        } as BoardRow["summary"],
    };
}

function buildBoard(rows: BoardRow[], reviews = 0, now = "2026-11-03T08:00:00Z"): DoctorBoard {
    const blocked = rows.filter((r) => r.tag === "red").length;
    return {
        rows,
        alerts: [],
        alertsAvailable: false,
        warningDays: 7,
        counts: {
            blocked,
            reviews,
            alerts: 0,
        },
        now,
    };
}

describe("T-054 Ca kiểm thử D1–D7, C1, C2", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // ─── D1 ─────────────────────────────────────────────────────────────────
    it("D1: 1 hàng đỏ, reviews 0 -> băng chứa '1 võ sĩ bị chặn tập'; không chứa '0 yêu cầu'; link băng href='#ln-red' chữ 'Xem thẻ đỏ'", async () => {
        const redRow = buildRow({
            fighterId: "f-red",
            name: "Diego Alvarez",
            tag: "red",
            training: { scope: "TRAINING", eligible: false, reasons: ["EXAMINATION_NOT_ELIGIBLE"] },
        });
        currentBoard = buildBoard([redRow], 0);

        const pageElement = await DoctorDashboardPage();
        const html = renderToStaticMarkup(pageElement);

        expect(html).toContain("1 võ sĩ bị chặn tập");
        expect(html).not.toContain("0 yêu cầu");
        expect(html).toContain('href="#ln-red"');
        expect(html).toContain("Xem thẻ đỏ");
    });

    // ─── D2 ─────────────────────────────────────────────────────────────────
    it("D2: 0 hàng đỏ, reviews 2 -> băng chứa '2 yêu cầu xem xét'; không chứa 'bị chặn tập'; link tới routes.doctor.reviewRequests", async () => {
        currentBoard = buildBoard([], 2);

        const pageElement = await DoctorDashboardPage();
        const html = renderToStaticMarkup(pageElement);

        expect(html).toContain("2 yêu cầu xem xét");
        expect(html).not.toContain("bị chặn tập");
        expect(html).toContain(`href="${routes.doctor.reviewRequests}"`);
    });

    // ─── D3 ─────────────────────────────────────────────────────────────────
    it("D3: 1 đỏ, reviews 2 -> băng chứa cả hai vế, link 'Mở yêu cầu'", async () => {
        const redRow = buildRow({ fighterId: "f-red", name: "Diego Alvarez", tag: "red" });
        currentBoard = buildBoard([redRow], 2);

        const pageElement = await DoctorDashboardPage();
        const html = renderToStaticMarkup(pageElement);

        expect(html).toContain("1 võ sĩ bị chặn tập");
        expect(html).toContain("2 yêu cầu xem xét");
        expect(html).toContain("Mở yêu cầu");
    });

    // ─── D4 ─────────────────────────────────────────────────────────────────
    it("D4: 0 đỏ, reviews 0 -> không có băng (td-urgent vắng)", async () => {
        currentBoard = buildBoard([], 0);

        const pageElement = await DoctorDashboardPage();
        const html = renderToStaticMarkup(pageElement);

        expect(html).not.toContain("td-urgent");
    });

    // ─── D5 ─────────────────────────────────────────────────────────────────
    it("D5: 1 hàng xanh không reasons/items/activeInjuries -> thẻ của hàng mang dấu gọn (data-compact='true'); không có td-open ở bất kỳ thẻ nào", async () => {
        const greenRow = buildRow({
            fighterId: "f-green",
            name: "Emma Lindqvist",
            tag: "green",
            training: { scope: "TRAINING", eligible: true, reasons: [] },
            items: [],
        });
        currentBoard = buildBoard([greenRow], 0);

        const pageElement = await DoctorDashboardPage();
        const html = renderToStaticMarkup(pageElement);

        expect(html).toContain('data-compact="true"');
        expect(html).not.toContain("td-open");
    });

    // ─── D6 ─────────────────────────────────────────────────────────────────
    it("D6: 1 hàng vàng có 1 việc followup -> thẻ không gọn, có dòng việc mở; link thẻ href=routes.doctor.fighter(id)", async () => {
        const yellowRow = buildRow({
            fighterId: "f-yellow",
            name: "Hoàng Long",
            tag: "amber",
            training: { scope: "TRAINING", eligible: true, reasons: [] },
            items: [{ kind: "followup", text: "Tái khám sau 2 ngày", date: "2026-11-05" }],
        });
        currentBoard = buildBoard([yellowRow], 0);

        const pageElement = await DoctorDashboardPage();
        const html = renderToStaticMarkup(pageElement);

        // Thẻ của hàng vàng không mang dấu gọn
        expect(html).not.toMatch(/data-tag="amber"[^>]*data-compact="true"/);
        expect(html).toContain("Tái khám sau 2 ngày");
        expect(html).toContain(`href="${routes.doctor.fighter("f-yellow")}"`);
    });

    // ─── D7 ─────────────────────────────────────────────────────────────────
    it("D7: việc followup ngày hôm nay + 2, không gì khác -> trong td-week có đúng 7 li.td-day; ngày có sự kiện mang chip chứa tên và 'Tái khám'; ngày trống mang data-empty='true'", async () => {
        const now = "2026-11-03T08:00:00Z";
        const followupRow = buildRow({
            fighterId: "f-followup",
            name: "Hoàng Long",
            tag: "amber",
            items: [{ kind: "followup", text: "Tái khám sau 2 ngày", date: "2026-11-05T08:00:00Z" }],
        });
        currentBoard = buildBoard([followupRow], 0, now);

        const pageElement = await DoctorDashboardPage();
        const html = renderToStaticMarkup(pageElement);

        const weekMatch = html.match(/<ol class="td-week[^"]*">([\s\S]*?)<\/ol>/);
        expect(weekMatch).toBeTruthy();
        const weekHtml = weekMatch![1];

        const days = weekHtml.match(/<li[^>]*class="[^"]*td-day[^"]*"[\s\S]*?<\/li>/g) ?? [];
        expect(days).toHaveLength(7);

        // li.td-day thứ 3 (hôm nay + 2) không có data-empty và chứa chip td-ev có <b>Long</b> và "Tái khám"
        const day3 = days[2];
        expect(day3).not.toContain("data-empty");
        expect(day3).toContain("td-ev");
        expect(day3).toContain("<b>Long</b>");
        expect(day3).toContain("Tái khám");

        // 6 ngày còn lại có data-empty="true"
        const otherDays = days.filter((_, idx) => idx !== 2);
        expect(otherDays).toHaveLength(6);
        for (const day of otherDays) {
            expect(day).toContain('data-empty="true"');
        }
    });

    // ─── D8 ─────────────────────────────────────────────────────────────────
    it("D8: 1 hàng vàng: clearanceState 'restricted', training { eligible: true, reasons: [] }, không việc mở, không chấn thương -> thẻ ở làn vàng không mang data-compact=\"true\"; chỉ thẻ xanh được gọn", async () => {
        const yellowRow = buildRow({
            fighterId: "f-yellow-d8",
            name: "Hoàng Long",
            tag: "amber",
            summary: {
                clearanceState: "restricted",
                activeInjuries: [],
            },
            training: { scope: "TRAINING", eligible: true, reasons: [] },
            items: [],
        });
        currentBoard = buildBoard([yellowRow], 0);

        const pageElement = await DoctorDashboardPage();
        const html = renderToStaticMarkup(pageElement);

        expect(html).not.toMatch(/data-tag="amber"[^>]*data-compact="true"/);
        expect(html).not.toContain('data-compact="true"');
    });

    // ─── D9 ─────────────────────────────────────────────────────────────────
    it("D9: 1 hàng đỏ: training { eligible: false, reasons: [] }, không gì khác -> thẻ không gọn", async () => {
        const redRow = buildRow({
            fighterId: "f-red-d9",
            name: "Diego Alvarez",
            tag: "red",
            training: { scope: "TRAINING", eligible: false, reasons: [] },
            items: [],
        });
        currentBoard = buildBoard([redRow], 0);

        const pageElement = await DoctorDashboardPage();
        const html = renderToStaticMarkup(pageElement);

        expect(html).not.toMatch(/data-tag="red"[^>]*data-compact="true"/);
        expect(html).not.toContain('data-compact="true"');
    });

    // ─── C1 ─────────────────────────────────────────────────────────────────
    it("C1 (9/11): làn và thẻ dùng tone của app, không vạch màu một cạnh; doctor.css không còn lớp td-*", () => {
        const css = fs.readFileSync(path.resolve(__dirname, "../../../../components/doctor/doctor.css"), "utf8");
        expect(css).not.toMatch(/border-(?:left|right|inline-start|inline-end)\s*:/);
        expect(css).not.toMatch(/\.td-[a-z]/);
    });

    // ─── C2 ─────────────────────────────────────────────────────────────────
    it("C2: markup trang dashboard không chứa yt-hole hay lớp viền một cạnh; trạng thái làn có chữ đi kèm", async () => {
        const redRow = buildRow({ fighterId: "f-red", tag: "red" });
        const greenRow = buildRow({ fighterId: "f-green", tag: "green" });
        currentBoard = buildBoard([redRow, greenRow], 0);

        const html = renderToStaticMarkup(await DoctorDashboardPage());
        expect(html).not.toContain("yt-hole");
        expect(html).not.toMatch(/[\s"]border-[lrse](?:-\S*)?(?=[\s"])/);
        expect(html).toContain("workspace-editorial");
        // Thẻ đỏ mang chữ của làn ("Chặn"), không chỉ màu.
        const redLane = html.match(/<section[^>]*data-tag="red"[^>]*>([\s\S]*?)<\/section>/);
        expect(redLane![1]).toContain("Chặn");
    });
});
