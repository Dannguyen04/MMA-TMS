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

function extractMediaBlocks(cssText: string, queryPattern: RegExp): string[] {
    const blocks: string[] = [];
    const re = new RegExp(queryPattern.source, "g");
    let match: RegExpExecArray | null;
    while ((match = re.exec(cssText)) !== null) {
        const braceOpen = cssText.indexOf("{", match.index);
        if (braceOpen === -1) break;
        let depth = 1;
        let i = braceOpen + 1;
        while (i < cssText.length && depth > 0) {
            if (cssText[i] === "{") depth++;
            else if (cssText[i] === "}") depth--;
            i++;
        }
        blocks.push(cssText.slice(match.index, i));
    }
    return blocks;
}

function extractCssBlock(cssText: string, selector: string): string {
    const idx = cssText.indexOf(selector);
    if (idx === -1) return "";
    const braceOpen = cssText.indexOf("{", idx);
    if (braceOpen === -1) return "";
    let depth = 1;
    let i = braceOpen + 1;
    while (i < cssText.length && depth > 0) {
        if (cssText[i] === "{") depth++;
        else if (cssText[i] === "}") depth--;
        i++;
    }
    return cssText.slice(idx, i);
}

function extractAllMatchingRules(cssText: string, selectorPattern: RegExp): { selector: string; body: string }[] {
    const rules: { selector: string; body: string }[] = [];
    const re = new RegExp(selectorPattern.source, "g");
    let match: RegExpExecArray | null;
    while ((match = re.exec(cssText)) !== null) {
        const braceOpen = cssText.indexOf("{", match.index);
        if (braceOpen === -1) break;
        let start = match.index;
        while (start > 0 && cssText[start - 1] !== "}" && cssText[start - 1] !== "{" && cssText[start - 1] !== ";") {
            start--;
        }
        const selector = cssText.slice(start, braceOpen).trim();
        let depth = 1;
        let i = braceOpen + 1;
        while (i < cssText.length && depth > 0) {
            if (cssText[i] === "{") depth++;
            else if (cssText[i] === "}") depth--;
            i++;
        }
        const body = cssText.slice(braceOpen + 1, i - 1).trim();
        rules.push({ selector, body });
        re.lastIndex = i;
    }
    return rules;
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

        const weekMatch = html.match(/<ol class="td-week">([\s\S]*?)<\/ol>/);
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
    it("C1: doctor.css -> .td-field của làn amber/green không dùng nền var(--t) đặc; có quy tắc @media (max-width: 767px) cho .td-week không còn overflow-x: auto; có prefers-reduced-motion tắt td-drop", () => {
        const cssPath = path.resolve(__dirname, "../../../../components/doctor/doctor.css");
        const css = fs.readFileSync(cssPath, "utf8");

        // Tìm MỌI quy tắc [data-tag=...] .td-field trong CSS
        const tagFieldRules = extractAllMatchingRules(css, /\[data-tag=[^\]]+\][^{}]*\.td-field(?:\s*,\s*|\s*\{)/);
        expect(tagFieldRules.length).toBeGreaterThanOrEqual(3);

        // Không quy tắc nào dùng nền var(--t) đặc và không có fallback color-mix thừa
        for (const rule of tagFieldRules) {
            expect(rule.body).not.toMatch(/background:\s*var\(--t\)/);
            expect(rule.body).not.toContain("color-mix");
        }

        // Nền vàng là var(--amb-soft), xanh là var(--ok-soft)
        const amberRule = tagFieldRules.find((r) => r.selector.includes('[data-tag="amber"]'));
        expect(amberRule).toBeTruthy();
        expect(amberRule!.body).toMatch(/background:\s*var\(--amb-soft\)/);

        const greenRule = tagFieldRules.find((r) => r.selector.includes('[data-tag="green"]') && !r.selector.includes('[data-compact="true"]'));
        expect(greenRule).toBeTruthy();
        expect(greenRule!.body).toMatch(/background:\s*var\(--ok-soft\)/);

        // có quy tắc @media (max-width: 767px) cho .td-week không còn overflow-x: auto
        const mediaBlocks = extractMediaBlocks(css, /@media\s*\(\s*max-width\s*:\s*767px\s*\)/);
        const weekBlock = mediaBlocks.find((b) => b.includes(".td-week"));
        expect(weekBlock).toBeTruthy();
        expect(weekBlock).not.toContain("overflow-x: auto");

        // có prefers-reduced-motion tắt td-drop
        expect(css).toMatch(/@media\s*\(\s*prefers-reduced-motion\s*:\s*reduce\s*\)[\s\S]*?\.td-tag\s*\{[^}]*animation\s*:\s*none/);
    });

    // ─── C2 ─────────────────────────────────────────────────────────────────
    it("C2: markup trang dashboard không chứa lớp yt-hole; CSS có white-space: nowrap cho chip cổng trong thẻ gọn", async () => {
        // 1. Markup trang dashboard không chứa lớp yt-hole
        const redRow = buildRow({ fighterId: "f-red", tag: "red" });
        const greenRow = buildRow({ fighterId: "f-green", tag: "green" });
        currentBoard = buildBoard([redRow, greenRow], 0);

        const pageElement = await DoctorDashboardPage();
        const html = renderToStaticMarkup(pageElement);
        expect(html).not.toContain("yt-hole");

        // 2. CSS có white-space: nowrap cho chip cổng trong thẻ gọn
        const cssPath = path.resolve(__dirname, "../../../../components/doctor/doctor.css");
        const css = fs.readFileSync(cssPath, "utf8");
        expect(css).toMatch(/(?:\.td-(?:tag\[data-compact="true"\]|field)|\[data-compact="true"\])[^{}]*\.yt-gate[^{}]*\{[^}]*white-space:\s*nowrap/);
    });

    // ─── Q1 ─────────────────────────────────────────────────────────────────
    it("Q1: doctor.css -> .td-tally li không có background: var(--t)", () => {
        const cssPath = path.resolve(__dirname, "../../../../components/doctor/doctor.css");
        const css = fs.readFileSync(cssPath, "utf8");
        const tallyLiBlock = extractCssBlock(css, ".td-tally li");
        expect(tallyLiBlock).toBeTruthy();
        expect(tallyLiBlock).not.toMatch(/background:\s*var\(--t\)/);
    });

    // ─── Q2 ─────────────────────────────────────────────────────────────────
    it("Q2: doctor.css -> .td-urgent không dùng background: var(--ink)", () => {
        const cssPath = path.resolve(__dirname, "../../../../components/doctor/doctor.css");
        const css = fs.readFileSync(cssPath, "utf8");
        const urgentBlock = extractCssBlock(css, ".td-urgent");
        expect(urgentBlock).toBeTruthy();
        expect(urgentBlock).not.toMatch(/background:\s*var\(--ink\)/);
    });

    // ─── Q3 ─────────────────────────────────────────────────────────────────
    it("Q3: doctor.css -> không quy tắc .td-tag nào dùng nền var(--t) đặc cho .td-field; thẻ đỏ dùng --block-soft", () => {
        const cssPath = path.resolve(__dirname, "../../../../components/doctor/doctor.css");
        const css = fs.readFileSync(cssPath, "utf8");
        const tdFieldBaseBlock = extractCssBlock(css, ".td-field");
        expect(tdFieldBaseBlock).toBeTruthy();
        expect(tdFieldBaseBlock).not.toMatch(/background:\s*var\(--t\)\s*;/);

        // Tìm MỌI quy tắc [data-tag=...] .td-field trong CSS
        const tagFieldRules = extractAllMatchingRules(css, /\[data-tag=[^\]]+\][^{}]*\.td-field(?:\s*,\s*|\s*\{)/);
        expect(tagFieldRules.length).toBeGreaterThanOrEqual(3);

        for (const rule of tagFieldRules) {
            expect(rule.body).not.toMatch(/background:\s*var\(--t\)/);
            expect(rule.body).not.toContain("color-mix");
        }

        // Thẻ đỏ dùng --block-soft
        const redRule = tagFieldRules.find((r) => r.selector.includes('[data-tag="red"]'));
        expect(redRule).toBeTruthy();
        expect(redRule!.body).toMatch(/background:\s*var\(--block-soft\)/);
    });

    // ─── Q4 ─────────────────────────────────────────────────────────────────
    it("Q4: doctor.css -> @keyframes td-drop không chứa rotate; .td-tag > a:hover không chứa rotate", () => {
        const cssPath = path.resolve(__dirname, "../../../../components/doctor/doctor.css");
        const css = fs.readFileSync(cssPath, "utf8");
        const keyframesBlock = extractCssBlock(css, "@keyframes td-drop");
        expect(keyframesBlock).toBeTruthy();
        expect(keyframesBlock).not.toContain("rotate");

        const hoverBlock = extractCssBlock(css, ".td-tag > a:hover");
        expect(hoverBlock).toBeTruthy();
        expect(hoverBlock).not.toContain("rotate");
    });

    // ─── Q5 ─────────────────────────────────────────────────────────────────
    it("Q5: doctor.css -> .td-day[data-today=\"true\"] không có border 2 px màu --ink và không có nền --ink", () => {
        const cssPath = path.resolve(__dirname, "../../../../components/doctor/doctor.css");
        const css = fs.readFileSync(cssPath, "utf8");
        const todayBlock = extractCssBlock(css, '.td-day[data-today="true"]');
        expect(todayBlock).toBeTruthy();
        expect(todayBlock).not.toMatch(/border:[^;]*2px[^;]*var\(--ink\)/);
        expect(todayBlock).not.toMatch(/background:\s*var\(--ink\)/);
    });

    // ─── Q6 ─────────────────────────────────────────────────────────────────
    it("Q6: doctor.css -> .td-tag[data-tag=\"red\"] .td-field small dùng màu var(--block-ink) đặc, không color-mix hay trong suốt", () => {
        const cssPath = path.resolve(__dirname, "../../../../components/doctor/doctor.css");
        const css = fs.readFileSync(cssPath, "utf8");
        const redSmallBlock = extractCssBlock(css, '.td-tag[data-tag="red"] .td-field small');
        expect(redSmallBlock).toBeTruthy();
        expect(redSmallBlock).toMatch(/color:\s*var\(--block-ink\)/);
        expect(redSmallBlock).not.toContain("color-mix");
        expect(redSmallBlock).not.toContain("transparent");
    });
});
