import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { hubTabsFor } from "@/components/layout/navigation";
import { formatShortDate } from "@/lib/format";
import { createTranslator, type MessageKey, navLabel } from "@/lib/i18n/translate";
import { mockCoaches, mockUsers } from "@/lib/mocks/people";
import { routes } from "@/lib/routes";
import { getReadiness } from "@/lib/services/suspensions";
import { blockedTypesForMaxTier } from "@/lib/domain/intensity-tiers";
import { addDaysToDate, isGradedReturnOnly, readinessMaxTier } from "@/lib/domain/suspension-rules";
import { TODAY_KEY } from "@/lib/mocks/time";
import type { ReadinessRow, User } from "@/lib/domain/types";

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

const mockAdmin: User = {
    ...mockUsers.find((u) => u.role === "admin")!,
    effectiveCapabilities: ["fighters:read"],
};

const { localeRef, readinessMock } = vi.hoisted(() => ({
    localeRef: { current: "vi" as "vi" | "en" },
    readinessMock: {
        fn: null as null | ((filter: unknown, user: unknown) => Promise<unknown>),
        lastFilter: null as unknown,
    },
}));

vi.mock("@/lib/services/suspensions", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@/lib/services/suspensions")>();
    return {
        ...actual,
        getReadiness: vi.fn(async (filter, user) => {
            readinessMock.lastFilter = filter;
            if (readinessMock.fn) {
                return readinessMock.fn(filter, user);
            }
            return actual.getReadiness(filter, user);
        }),
    };
});

let currentUser: User = mockRafaelCoach;

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
        requireRole: vi.fn(async (role: string) => {
            if (currentUser.role !== role) {
                const { redirect } = await import("next/navigation");
                const { dashboardPath } = await import("@/lib/routes");
                redirect(dashboardPath(currentUser.role));
            }
            return currentUser;
        }),
    };
});

vi.mock("@/lib/i18n/server", async () => {
    const { createTranslator: makeT } = await import("@/lib/i18n/translate");
    return {
        getTranslator: async () => ({
            locale: localeRef.current,
            t: makeT(localeRef.current),
        }),
    };
});

import CoachReadinessPage from "./page";

const tVi = createTranslator("vi");

function makeProps(searchParams: Record<string, string | string[] | undefined> = {}) {
    return {
        params: Promise.resolve({}),
        searchParams: Promise.resolve(searchParams),
    };
}

function getCardHtml(fullHtml: string, fighterId: string): string {
    const attr = `data-fighter-card="${fighterId}"`;
    const start = fullHtml.indexOf(attr);
    expect(start).toBeGreaterThan(-1);
    const next = fullHtml.indexOf('data-fighter-card="', start + attr.length);
    return next === -1 ? fullHtml.slice(start) : fullHtml.slice(start, next);
}

describe("T-030 Phần B6: Màn /coach/bouts/readiness", () => {
    beforeEach(() => {
        delete (globalThis as Record<string, unknown>).__mmaMockDb;
        currentUser = mockRafaelCoach;
        localeRef.current = "vi";
        readinessMock.fn = null;
        readinessMock.lastFilter = null;
    });

    // ─── B6-1 ──────────────────────────────────────────────────────────────────
    it("B6-1: Dòng ready: true nằm ở cột 'Sẵn sàng'", async () => {
        const page = await CoachReadinessPage(makeProps());
        const html = renderToStaticMarkup(page);

        // Emma Lindqvist có ready: true, phải nằm ở khối Sẵn sàng
        expect(html).toContain("Emma Lindqvist");
        // Kiểm tra phần tử chứa Emma Lindqvist nằm trong container cột Sẵn sàng
        const readyColumnSection = html.slice(
            html.indexOf('data-column="ready"'),
            html.indexOf('data-column="graded-return"'),
        );
        expect(readyColumnSection).toContain("Emma Lindqvist");
    });

    // ─── B6-2 ──────────────────────────────────────────────────────────────────
    it("B6-2: Dòng có gradedReturn nằm ở cột 'Đang tập lại', có 'Tập đầy đủ từ {ngày}'", async () => {
        const page = await CoachReadinessPage(makeProps());
        const html = renderToStaticMarkup(page);

        // Linh Phạm đang trong lộ trình gradedReturn
        expect(html).toContain("Linh Phạm");
        const gradedColumnSection = html.slice(
            html.indexOf('data-column="graded-return"'),
            html.indexOf('data-column="not-ready"'),
        );
        expect(gradedColumnSection).toContain("Linh Phạm");
        expect(gradedColumnSection).toContain("Tập đầy đủ từ");
    });

    // ─── B6-3 ──────────────────────────────────────────────────────────────────
    it("B6-3: Dòng SUSPENDED không gradedReturn, AWAITING_CLEARANCE, IN_BOUT nằm ở cột 'Chưa sẵn sàng' kèm lý do rõ", async () => {
        const page = await CoachReadinessPage(makeProps());
        const html = renderToStaticMarkup(page);

        const notReadyColumnSection = html.slice(html.indexOf('data-column="not-ready"'));

        // 1. Marcus Hale (SUSPENDED KO)
        expect(notReadyColumnSection).toContain("Marcus Hale");
        expect(notReadyColumnSection).toMatch(/đình chỉ đến ngày|Đình chỉ đến ngày/i);

        // 2. Diego Alvarez (AWAITING_CLEARANCE)
        expect(notReadyColumnSection).toContain("Diego Alvarez");
        expect(notReadyColumnSection).toMatch(/chờ xác nhận được tập lại/i);

        // 3. Minh Trần (IN_BOUT)
        expect(notReadyColumnSection).toContain("Minh Trần");
        expect(notReadyColumnSection).toMatch(/đang có trận/i);
        expect(notReadyColumnSection).toContain("Saigon Warriors MMA 04");
    });

    // ─── B6-4 ──────────────────────────────────────────────────────────────────
    it("B6-4: Lọc hạng cân hoặc ngày thi mà thiếu bộ luật -> Không gọi API, hiện câu nhắc 'Chọn bộ luật để kiểm tra hạng cân và ngày thi'", async () => {
        // Chỉ chọn weightLimitKg hoặc boutOn mà thiếu rulesetId
        const page = await CoachReadinessPage(makeProps({ weightLimitKg: "65", boutOn: "2026-11-20" }));
        const html = renderToStaticMarkup(page);

        // Phải hiển thị câu nhắc cảnh báo
        expect(html).toContain("Chọn bộ luật để kiểm tra hạng cân và ngày thi");
    });

    // ─── B6-5 ──────────────────────────────────────────────────────────────────
    it("B6-5: Màn hình hẹp (< lg / 390px) chia thành ba nhóm dọc có tiêu đề dính (sticky)", async () => {
        const page = await CoachReadinessPage(makeProps());
        const html = renderToStaticMarkup(page);

        // Kiểm tra layout: grid 3 cột trên lg (grid-cols-1 lg:grid-cols-3)
        expect(html).toContain("grid-cols-1 lg:grid-cols-3");
        // Kiểm tra tiêu đề có class sticky để dính khi cuộn trên màn hẹp
        expect(html).toContain("sticky top-");
    });

    // ─── B6-6 ──────────────────────────────────────────────────────────────────
    it("B6-6: Demo, không lọc: Linh Phạm nằm cột 'Đang tập lại' với 'Tập đầy đủ từ' đúng fullReturnOn; Marcus và Diego nằm 'Chưa sẵn sàng'; số đếm ba cột cộng lại bằng số võ sĩ trong roster của Rafael mà readiness trả về", async () => {
        currentUser = mockRafaelCoach;
        const readinessRows = await getReadiness({}, mockRafaelCoach);
        const totalFighters = readinessRows.length;
        expect(totalFighters).toBe(8);

        const page = await CoachReadinessPage(makeProps());
        const html = renderToStaticMarkup(page);

        // Linh Phạm
        const linhRow = readinessRows.find((r) => r.fighterId === "f-linh-pham")!;
        expect(linhRow.gradedReturn).not.toBeNull();
        const expectedDateFormatted = formatShortDate(linhRow.fullReturnOn!, "vi");
        expect(html).toContain("Linh Phạm");
        expect(html).toContain(expectedDateFormatted);

        // Marcus và Diego nằm ở cột Chưa sẵn sàng
        const notReadyColumn = html.slice(html.indexOf('data-column="not-ready"'));
        expect(notReadyColumn).toContain("Marcus Hale");
        expect(notReadyColumn).toContain("Diego Alvarez");

        // Tổng số đếm 3 cột = 8 (1 ready + 1 graded + 6 not ready)
        // Tìm các thẻ đếm số của từng cột
        expect(html).toMatch(/data-count="ready"[^>]*>1</);
        expect(html).toMatch(/data-count="graded-return"[^>]*>1</);
        expect(html).toMatch(/data-count="not-ready"[^>]*>6</);
    });

    // ─── B6-7 ──────────────────────────────────────────────────────────────────
    it("B6-7: Lọc rulesetId + weightLimitKg + boutOn hợp lệ -> thẻ của võ sĩ có số cân hiện WeightWarningBadge theo feasibility.status (kể cả NEUTRAL không lỗi)", async () => {
        currentUser = mockRafaelCoach;
        const page = await CoachReadinessPage(
            makeProps({
                rulesetId: "ruleset-vmmaf-2021",
                weightLimitKg: "65",
                boutOn: "2026-11-20",
            }),
        );
        const html = renderToStaticMarkup(page);

        // Thẻ của các võ sĩ có cân nặng đo được (Minh Trần, Kenji Morita, Aigerim Sadykova...)
        // Hiển thị badge trạng thái cân (WeightWarningBadge)
        expect(html).toMatch(/data-badge="weight-warning"|badge/i);
    });

    // ─── B6-8 ──────────────────────────────────────────────────────────────────
    it("B6-8: Thanh tab hub Trận có đủ 'Trận đấu', 'Đình chỉ', 'Sẵn sàng' với link đúng", () => {
        // Kiểm tra hub tabs khi đang ở trang readiness
        const readinessHub = hubTabsFor("coach", routes.coach.readiness);
        expect(readinessHub).not.toBeNull();
        expect(readinessHub?.label).toBe("Bouts");
        expect(readinessHub?.tabs).toHaveLength(3);

        const tabHrefs = readinessHub!.tabs.map((t) => t.href);
        expect(tabHrefs).toEqual([
            routes.coach.bouts,
            routes.coach.suspensions,
            routes.coach.readiness,
        ]);

        // Kiểm tra nhãn hiển thị trong tiếng Việt
        const tabLabels = readinessHub!.tabs.map((tab) => navLabel(tVi, tab.label));
        // The bout list tab reads "Sắp tới" since the demo fixes (T-032); merged in T-040 A.
        expect(tabLabels).toEqual(["Sắp tới", "Đình chỉ", "Sẵn sàng"]);

        // Kiểm tra hub tabs khi ở trang bouts và suspensions cũng đồng bộ có đủ 3 tab
        const boutsHub = hubTabsFor("coach", routes.coach.bouts);
        expect(boutsHub?.tabs).toHaveLength(3);
        const suspensionsHub = hubTabsFor("coach", routes.coach.suspensions);
        expect(suspensionsHub?.tabs).toHaveLength(3);
    });

    // ─── B6-9 ──────────────────────────────────────────────────────────────────
    it("B6-9: locale vi, HTML trang có 'Cường độ tối đa:' trên từng thẻ (số lần xuất hiện = số thẻ = 8); thẻ của Tariq Haddad (đình chỉ nghỉ bắt buộc, maxAllowedTier 1) chứa nhãn của intensityTier.1.label; thẻ của Linh Phạm (tập lại theo bậc, ceiling 3) chứa nhãn intensityTier.3.label; thẻ của Emma Lindqvist (sẵn sàng) chứa nhãn intensityTier.5.label. Lấy nhãn bằng translator vi, không gõ cứng chuỗi.", async () => {
        const page = await CoachReadinessPage(makeProps());
        const html = renderToStaticMarkup(page);

        // Số lần xuất hiện = số thẻ = 8
        const occurrences = (html.match(/Cường độ tối đa:/g) || []).length;
        expect(occurrences).toBe(8);



        // Tariq Haddad (đình chỉ nghỉ bắt buộc, maxAllowedTier 1) -> tVi('readiness.card.maxIntensity', { tier: tVi('intensityTier.1.label') })
        const tariqCard = getCardHtml(html, "f-tariq-haddad");
        expect(tariqCard).toContain(
            tVi("readiness.card.maxIntensity", { tier: tVi("intensityTier.1.label" as MessageKey) }),
        );

        // Linh Phạm (tập lại theo bậc, ceiling 3) -> bậc 3
        const linhCard = getCardHtml(html, "f-linh-pham");
        expect(linhCard).toContain(
            tVi("readiness.card.maxIntensity", { tier: tVi("intensityTier.3.label" as MessageKey) }),
        );

        // Emma Lindqvist (sẵn sàng) -> bậc 5
        const emmaCard = getCardHtml(html, "f-emma-lindqvist");
        expect(emmaCard).toContain(
            tVi("readiness.card.maxIntensity", { tier: tVi("intensityTier.5.label" as MessageKey) }),
        );
    });

    // ─── B6-10 ─────────────────────────────────────────────────────────────────
    it("B6-10: locale en có 'Max intensity:' (không còn khoá thô readiness.card.maxIntensity trong HTML)", async () => {
        localeRef.current = "en";
        const page = await CoachReadinessPage(makeProps());
        const html = renderToStaticMarkup(page);

        expect(html).toContain("Max intensity:");
        expect(html).not.toContain("readiness.card.maxIntensity");
    });

    // ─── B6-11 ─────────────────────────────────────────────────────────────────
    it("B6-11: cột 'Chưa sẵn sàng' của Rafael: vị trí trong HTML của Marcus Hale và Tariq Haddad (đình chỉ) đứng trước Diego Alvarez (chờ xác nhận), và Diego đứng trước Aigerim Sadykova, Kenji Morita, Minh Trần (đang có trận). Kiểm bằng indexOf trong phần HTML của cột, không bằng thứ tự toàn trang.", async () => {
        const page = await CoachReadinessPage(makeProps());
        const html = renderToStaticMarkup(page);

        const notReadyColumnSection = html.slice(html.indexOf('data-column="not-ready"'));

        const marcusPos = notReadyColumnSection.indexOf("Marcus Hale");
        const tariqPos = notReadyColumnSection.indexOf("Tariq Haddad");
        const diegoPos = notReadyColumnSection.indexOf("Diego Alvarez");
        const aigerimPos = notReadyColumnSection.indexOf("Aigerim Sadykova");
        const kenjiPos = notReadyColumnSection.indexOf("Kenji Morita");
        const minhPos = notReadyColumnSection.indexOf("Minh Trần");

        expect(marcusPos).toBeGreaterThan(-1);
        expect(tariqPos).toBeGreaterThan(-1);
        expect(diegoPos).toBeGreaterThan(-1);
        expect(aigerimPos).toBeGreaterThan(-1);
        expect(kenjiPos).toBeGreaterThan(-1);
        expect(minhPos).toBeGreaterThan(-1);

        // Marcus Hale và Tariq Haddad (đình chỉ) đứng trước Diego Alvarez (chờ xác nhận)
        expect(marcusPos).toBeLessThan(diegoPos);
        expect(tariqPos).toBeLessThan(diegoPos);

        // Diego Alvarez đứng trước Aigerim Sadykova, Kenji Morita, Minh Trần (đang có trận)
        expect(diegoPos).toBeLessThan(aigerimPos);
        expect(diegoPos).toBeLessThan(kenjiPos);
        expect(diegoPos).toBeLessThan(minhPos);
    });

    // ─── Admin access restriction ──────────────────────────────────────────────
    it("B6-admin: Admin truy cập trang /coach/bouts/readiness bị redirect về /admin/dashboard", async () => {
        currentUser = mockAdmin;
        await expect(CoachReadinessPage(makeProps())).rejects.toThrow("REDIRECT:/admin/dashboard");
    });

    // ─── B6-12 ─────────────────────────────────────────────────────────────────
    it("B6-12: dòng readiness có suspension chặn RECOVERY (maxAllowedTier 0) -> HTML không chứa 'intensityTier.0', có câu bị chặn hoàn toàn", async () => {
        const mockRow: ReadinessRow = {
            fighterId: "f-test-blocked-all",
            fighterName: "Test Blocked All",
            ready: false,
            status: "SUSPENDED",
            latestWeightKg: 70,
            latestWeightOn: "2026-10-25",
            activeBout: null,
            gradedReturn: null,
            fullReturnOn: null,
            suspension: {
                startsOn: "2026-10-20",
                endsOn: "2026-11-20",
                blockedSessionTypes: [
                    "RECOVERY",
                    "PHYSICAL_THERAPY",
                    "SHADOW_BOXING",
                    "PAD_WORK",
                    "HEAVY_BAG",
                    "SPARRING",
                    "GRAPPLING",
                    "STRENGTH_CONDITIONING",
                ],
                allowedSessionTypes: [],
                expectedResumeOn: null,
            },
        };

        readinessMock.fn = async () => [mockRow];

        const page = await CoachReadinessPage(makeProps());
        const html = renderToStaticMarkup(page);

        const cardHtml = getCardHtml(html, "f-test-blocked-all");
        expect(cardHtml).not.toContain("intensityTier.0");
        expect(cardHtml).toContain(tVi("intensityLadder.summaryBlocked"));
        expect(cardHtml).toContain(
            `<span data-testid="max-intensity-text" class="text-xs text-fg-muted font-medium">${tVi("intensityLadder.summaryBlocked")}</span>`
        );
    });

    // ─── B6-13a ────────────────────────────────────────────────────────────────
    it("B6-13a (unit isGradedReturnOnly): row status SUSPENDED, gradedReturn { ceiling 3, fullReturnOn F }, suspension { expectedResumeOn F, blockedSessionTypes = blockedTypesForMaxTier(3) } -> true", () => {
        const fullReturnOn = "2026-11-10";
        const row: ReadinessRow = {
            fighterId: "f-test-a",
            fighterName: "Fighter A",
            ready: false,
            status: "SUSPENDED",
            latestWeightKg: 70,
            latestWeightOn: "2026-10-25",
            activeBout: null,
            gradedReturn: { ceiling: 3, fullReturnOn },
            fullReturnOn,
            suspension: {
                startsOn: "2026-10-10",
                endsOn: "2026-10-25",
                blockedSessionTypes: [...blockedTypesForMaxTier(3)],
                allowedSessionTypes: [],
                expectedResumeOn: fullReturnOn,
            },
        };
        expect(isGradedReturnOnly(row)).toBe(true);
    });

    // ─── B6-13b ────────────────────────────────────────────────────────────────
    it("B6-13b: như a nhưng suspension.expectedResumeOn = một ngày khác F (có đình chỉ khác còn hiệu lực) -> false", () => {
        const fullReturnOn = "2026-11-10";
        const row: ReadinessRow = {
            fighterId: "f-test-b",
            fighterName: "Fighter B",
            ready: false,
            status: "SUSPENDED",
            latestWeightKg: 70,
            latestWeightOn: "2026-10-25",
            activeBout: null,
            gradedReturn: { ceiling: 3, fullReturnOn },
            fullReturnOn,
            suspension: {
                startsOn: "2026-10-10",
                endsOn: "2026-11-20",
                blockedSessionTypes: [...blockedTypesForMaxTier(3)],
                allowedSessionTypes: [],
                expectedResumeOn: "2026-11-21",
            },
        };
        expect(isGradedReturnOnly(row)).toBe(false);
    });

    // ─── B6-13c ────────────────────────────────────────────────────────────────
    it("B6-13c: như a nhưng blockedSessionTypes thêm một loại không thuộc blockedTypesForMaxTier(3) -> false", () => {
        const fullReturnOn = "2026-11-10";
        const row: ReadinessRow = {
            fighterId: "f-test-c",
            fighterName: "Fighter C",
            ready: false,
            status: "SUSPENDED",
            latestWeightKg: 70,
            latestWeightOn: "2026-10-25",
            activeBout: null,
            gradedReturn: { ceiling: 3, fullReturnOn },
            fullReturnOn,
            suspension: {
                startsOn: "2026-10-10",
                endsOn: "2026-10-25",
                blockedSessionTypes: [...blockedTypesForMaxTier(3), "PAD_WORK"],
                allowedSessionTypes: [],
                expectedResumeOn: fullReturnOn,
            },
        };
        expect(isGradedReturnOnly(row)).toBe(false);
    });

    // ─── B6-13d ────────────────────────────────────────────────────────────────
    it("B6-13d: status AWAITING_CLEARANCE, gradedReturn có -> false", () => {
        const fullReturnOn = "2026-11-10";
        const row: ReadinessRow = {
            fighterId: "f-test-d",
            fighterName: "Fighter D",
            ready: false,
            status: "AWAITING_CLEARANCE",
            latestWeightKg: 70,
            latestWeightOn: "2026-10-25",
            activeBout: null,
            gradedReturn: { ceiling: 3, fullReturnOn },
            fullReturnOn,
            suspension: {
                startsOn: "2026-10-10",
                endsOn: "2026-10-25",
                blockedSessionTypes: [...blockedTypesForMaxTier(3)],
                allowedSessionTypes: [],
                expectedResumeOn: fullReturnOn,
            },
        };
        expect(isGradedReturnOnly(row)).toBe(false);
    });

    // ─── B6-13e ────────────────────────────────────────────────────────────────
    it("B6-13e: trang, demo của Rafael: Linh Phạm vẫn ở cột 'Đang tập lại' (B6-2, B6-6 vẫn qua mà không sửa)", async () => {
        currentUser = mockRafaelCoach;
        const page = await CoachReadinessPage(makeProps());
        const html = renderToStaticMarkup(page);

        const gradedColumn = html.slice(
            html.indexOf('data-column="graded-return"'),
            html.indexOf('data-column="not-ready"'),
        );
        expect(gradedColumn).toContain("Linh Phạm");
        expect(gradedColumn).toContain("Tập đầy đủ từ");
    });

    // ─── B6-14 ─────────────────────────────────────────────────────────────────
    it("B6-14: searchParams weightLimitKg='abc' cùng rulesetId hợp lệ -> getReadiness được gọi không có weightLimitKg (hoặc undefined), trang render không lỗi", async () => {
        const page = await CoachReadinessPage(
            makeProps({
                rulesetId: "ruleset-vmmaf-2021",
                weightLimitKg: "abc",
            }),
        );
        const html = renderToStaticMarkup(page);

        expect(html).toBeDefined();
        expect(html).not.toContain("NaN");

        const lastFilter = readinessMock.lastFilter as { rulesetId?: string; weightLimitKg?: number };
        expect(lastFilter).toBeDefined();
        expect(lastFilter.rulesetId).toBe("ruleset-vmmaf-2021");
        expect(lastFilter.weightLimitKg).toBeUndefined();
    });

    // ─── B6-15 ─────────────────────────────────────────────────────────────────
    it("B6-15 (demo khớp backend): classifyReadiness cho võ sĩ chỉ đang tập lại theo bậc (Linh) trả suspension khác null với expectedResumeOn === fullReturnOn và blockedSessionTypes bằng blockedTypesForMaxTier(ceiling)", async () => {
        currentUser = mockRafaelCoach;
        const rows = await getReadiness({}, mockRafaelCoach);
        const linh = rows.find((r) => r.fighterId === "f-linh-pham");
        expect(linh).toBeDefined();
        expect(linh!.gradedReturn).not.toBeNull();
        expect(linh!.suspension).not.toBeNull();
        expect(linh!.suspension!.expectedResumeOn).toBe(linh!.fullReturnOn);
        expect(linh!.suspension!.expectedResumeOn).toBe(linh!.gradedReturn!.fullReturnOn);

        const expectedBlocked = blockedTypesForMaxTier(linh!.gradedReturn!.ceiling);
        expect(new Set(linh!.suspension!.blockedSessionTypes)).toEqual(new Set(expectedBlocked));
    });

    // ─── B6-16 ─────────────────────────────────────────────────────────────────
    it("B6-16 (trang, demo Rafael): searchParams có rulesetId hợp lệ và boutOn = hôm nay demo + 10 ngày -> thẻ Linh Phạm có dòng chữ Bậc 3, KHÔNG có dòng với Bậc 5", async () => {
        currentUser = mockRafaelCoach;
        const boutOn = addDaysToDate(TODAY_KEY, 10);
        const page = await CoachReadinessPage(
            makeProps({
                rulesetId: "ruleset-vmmaf-2021",
                boutOn,
            }),
        );
        const html = renderToStaticMarkup(page);

        const linhCard = getCardHtml(html, "f-linh-pham");
        const expectedTier3Text = tVi("readiness.card.maxIntensity", {
            tier: tVi("intensityTier.3.label"),
        });
        const tier5Text = tVi("readiness.card.maxIntensity", {
            tier: tVi("intensityTier.5.label"),
        });

        expect(linhCard).toContain(expectedTier3Text);
        expect(linhCard).not.toContain(tier5Text);
    });

    // ─── B6-17 ─────────────────────────────────────────────────────────────────
    it("B6-17: status SUSPENDED, suspension.blockedSessionTypes = ['SPARRING'] (maxAllowedTier 4), gradedReturn ceiling 3, expectedResumeOn khác fullReturnOn -> nằm cột Chưa sẵn sàng, dòng chữ Bậc 3", async () => {
        const fullReturnOn = "2026-11-10";
        const row: ReadinessRow = {
            fighterId: "f-test-b6-17",
            fighterName: "Test B6 17",
            ready: false,
            status: "SUSPENDED",
            latestWeightKg: 70,
            latestWeightOn: "2026-10-25",
            activeBout: null,
            gradedReturn: { ceiling: 3, fullReturnOn },
            fullReturnOn,
            suspension: {
                startsOn: "2026-10-10",
                endsOn: "2026-11-20",
                blockedSessionTypes: ["SPARRING"],
                allowedSessionTypes: [],
                expectedResumeOn: "2026-11-21",
            },
        };

        readinessMock.fn = async () => [row];

        const page = await CoachReadinessPage(makeProps());
        const html = renderToStaticMarkup(page);

        // Nằm cột Chưa sẵn sàng
        const notReadyColumn = html.slice(html.indexOf('data-column="not-ready"'));
        expect(notReadyColumn).toContain("Test B6 17");

        expect(readinessMaxTier(row)).toEqual({ allowed: 4, effective: 3 });

        const cardHtml = getCardHtml(html, "f-test-b6-17");
        const expectedTier3Text = tVi("readiness.card.maxIntensity", {
            tier: tVi("intensityTier.3.label"),
        });
        expect(cardHtml).toContain(expectedTier3Text);
    });

    // ─── B6-18 ─────────────────────────────────────────────────────────────────
    it("B6-18: dòng ready: true, suspension null, gradedReturn null -> dòng chữ Bậc 5 (không đổi hành vi cũ)", async () => {
        const row: ReadinessRow = {
            fighterId: "f-test-b6-18",
            fighterName: "Test B6 18 Ready",
            ready: true,
            status: "READY",
            latestWeightKg: 70,
            latestWeightOn: "2026-10-25",
            activeBout: null,
            gradedReturn: null,
            fullReturnOn: null,
            suspension: null,
        };

        readinessMock.fn = async () => [row];

        const page = await CoachReadinessPage(makeProps());
        const html = renderToStaticMarkup(page);

        expect(readinessMaxTier(row)).toEqual({ allowed: 5, effective: 5 });

        const cardHtml = getCardHtml(html, "f-test-b6-18");
        const expectedTier5Text = tVi("readiness.card.maxIntensity", {
            tier: tVi("intensityTier.5.label"),
        });
        expect(cardHtml).toContain(expectedTier5Text);
    });

    // ─── B6-19 ─────────────────────────────────────────────────────────────────
    it("B6-19 (unit): dòng chỉ tập lại theo bậc (như B6-13a, ceiling 3) -> readinessMaxTier = { allowed: 5, effective: 3 }", () => {
        const fullReturnOn = "2026-11-10";
        const row: ReadinessRow = {
            fighterId: "f-test-b6-19",
            fighterName: "Test B6 19 Graded Only",
            ready: false,
            status: "SUSPENDED",
            latestWeightKg: 70,
            latestWeightOn: "2026-10-25",
            activeBout: null,
            gradedReturn: { ceiling: 3, fullReturnOn },
            fullReturnOn,
            suspension: {
                startsOn: "2026-10-10",
                endsOn: "2026-10-25",
                blockedSessionTypes: [...blockedTypesForMaxTier(3)],
                allowedSessionTypes: [],
                expectedResumeOn: fullReturnOn,
            },
        };
        expect(readinessMaxTier(row)).toEqual({ allowed: 5, effective: 3 });
    });

    // ─── B6-20 ─────────────────────────────────────────────────────────────────
    it("B6-20 (unit): dòng B6-17 (đình chỉ ACTIVE chặn SPARRING + gradedReturn ceiling 3, không phải graded-only) -> { allowed: 4, effective: 3 }", () => {
        const fullReturnOn = "2026-11-10";
        const row: ReadinessRow = {
            fighterId: "f-test-b6-20",
            fighterName: "Test B6 20",
            ready: false,
            status: "SUSPENDED",
            latestWeightKg: 70,
            latestWeightOn: "2026-10-25",
            activeBout: null,
            gradedReturn: { ceiling: 3, fullReturnOn },
            fullReturnOn,
            suspension: {
                startsOn: "2026-10-10",
                endsOn: "2026-11-20",
                blockedSessionTypes: ["SPARRING"],
                allowedSessionTypes: [],
                expectedResumeOn: "2026-11-21",
            },
        };
        expect(readinessMaxTier(row)).toEqual({ allowed: 4, effective: 3 });
    });

    // ─── B6-21 ─────────────────────────────────────────────────────────────────
    it("B6-21 (trang, demo Rafael): trong HTML thẻ của Linh Phạm (data-fighter-card), đoạn 4 và 5 của thang có trạng thái trần tập lại (nhãn sr hoặc class của trạng thái blocked_ceiling trong intensity-ladder.tsx), KHÔNG có trạng thái bị cấm thường; thẻ của Tariq Haddad thì đoạn 2-5 ở trạng thái bị cấm thường", async () => {
        currentUser = mockRafaelCoach;
        const page = await CoachReadinessPage(makeProps());
        const html = renderToStaticMarkup(page);

        // Thẻ của Linh Phạm
        const linhCard = getCardHtml(html, "f-linh-pham");
        // Có class ladder-pattern-ceiling (trạng thái blocked_ceiling)
        expect(linhCard).toContain("ladder-pattern-ceiling");
        // KHÔNG có class ladder-pattern-blocked (trạng thái blocked thông thường)
        expect(linhCard).not.toContain("ladder-pattern-blocked");
        // Có nhãn sr của trạng thái trần tập lại
        expect(linhCard).toContain(tVi("intensityLadder.blockedToday"));

        // Thẻ của Tariq Haddad (đình chỉ bắt buộc, chặn bậc 2-5)
        const tariqCard = getCardHtml(html, "f-tariq-haddad");
        // Có class ladder-pattern-blocked (trạng thái bị cấm thường)
        expect(tariqCard).toContain("ladder-pattern-blocked");
        // KHÔNG có class ladder-pattern-ceiling
        expect(tariqCard).not.toContain("ladder-pattern-ceiling");
        // Có nhãn sr của trạng thái bị cấm
        expect(tariqCard).toContain(tVi("intensityLadder.blocked"));
    });
});
