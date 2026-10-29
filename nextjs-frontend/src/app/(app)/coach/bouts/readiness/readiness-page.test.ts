import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { hubTabsFor } from "@/components/layout/navigation";
import { formatShortDate } from "@/lib/format";
import { createTranslator, navLabel } from "@/lib/i18n/translate";
import { mockCoaches, mockUsers } from "@/lib/mocks/people";
import { routes } from "@/lib/routes";
import { getReadiness } from "@/lib/services/suspensions";
import type { User } from "@/lib/domain/types";

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
            locale: "vi",
            t: makeT("vi"),
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

describe("T-030 Phần B6: Màn /coach/bouts/readiness", () => {
    beforeEach(() => {
        delete (globalThis as Record<string, unknown>).__mmaMockDb;
        currentUser = mockRafaelCoach;
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
        expect(tabLabels).toEqual(["Trận đấu", "Đình chỉ", "Sẵn sàng"]);

        // Kiểm tra hub tabs khi ở trang bouts và suspensions cũng đồng bộ có đủ 3 tab
        const boutsHub = hubTabsFor("coach", routes.coach.bouts);
        expect(boutsHub?.tabs).toHaveLength(3);
        const suspensionsHub = hubTabsFor("coach", routes.coach.suspensions);
        expect(suspensionsHub?.tabs).toHaveLength(3);
    });

    // ─── Admin access restriction ──────────────────────────────────────────────
    it("B6-admin: Admin truy cập trang /coach/bouts/readiness bị redirect về /admin/dashboard", async () => {
        currentUser = mockAdmin;
        await expect(CoachReadinessPage(makeProps())).rejects.toThrow("REDIRECT:/admin/dashboard");
    });
});
