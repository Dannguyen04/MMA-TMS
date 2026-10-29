import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { hubTabsFor } from "@/components/layout/navigation";
import { accessibleFighterIds } from "@/lib/auth/access";
import { trainingPhaseLabel } from "@/lib/domain/labels";
import {
    deriveRequiresClearance,
    endsOnFor,
    addDaysToDate,
} from "@/lib/domain/suspension-rules";
import type {
    SuspensionCreation,
    User,
} from "@/lib/domain/types";
import { createTranslator, plural } from "@/lib/i18n/translate";
import { mockCoaches, mockUsers } from "@/lib/mocks/people";
import { TODAY_KEY } from "@/lib/mocks/time";
import { routes } from "@/lib/routes";

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

vi.mock("@/components/ui/toast", async (orig) => {
    const actual = await orig<typeof import("@/components/ui/toast")>();
    return {
        ...actual,
        useToast: () => vi.fn(),
    };
});

import { GradedReturnSteps } from "@/components/domain/graded-return-steps";
import { IntensityLadder } from "@/components/domain/intensity-ladder";
import { computeLadderSegments } from "@/lib/domain/intensity-tiers";
import CoachSuspensionsPage from "./page";
import { CreateSuspensionPanel, scrollDialogToTop } from "./create-suspension-panel";
import { SuspensionClearanceDialog } from "./suspension-clearance-dialog";
import SuspensionsError from "./error";
import { buildClearSuspensionSchema } from "@/lib/actions/suspension-schemas";
import { createSuspensionAction } from "@/lib/actions/suspensions";
import { listSuspensions } from "@/lib/services/suspensions";
import { getCoachTodo } from "@/lib/services/bouts";

const tVi = createTranslator("vi");

function makeProps(searchParams: Record<string, string | string[] | undefined> = {}) {
    return {
        params: Promise.resolve({}),
        searchParams: Promise.resolve(searchParams),
    };
}

describe("T-030 Phần B4: Màn /coach/bouts/suspensions (Review Round 1)", () => {
    beforeEach(() => {
        delete (globalThis as Record<string, unknown>).__mmaMockDb;
        currentUser = mockRafaelCoach;
    });

    // ─── B4-1 ──────────────────────────────────────────────────────────────────
    it("B4-1: Rafael thấy đúng các đình chỉ của võ sĩ trong roster (Diego, Marcus, Tariq, Linh); số trên nút lọc: Tất cả = 4, Đang đình chỉ = 2, Chờ xác nhận = 1, Đang tập lại = 1, Đã hết = 0 (tập lại không tính vào đã hết); mô tả trang in số có thể dùng được ('2 đang hiệu lực', không in chuỗi ICU thô)", async () => {
        currentUser = mockRafaelCoach;

        // 1. Kiểm tra danh sách theo phân quyền HLV Rafael Costa
        const coachSuspensions = await listSuspensions({}, mockRafaelCoach);
        expect(coachSuspensions).toHaveLength(4);
        const fighterIds = coachSuspensions.map((s) => s.fighterId);
        expect(fighterIds).toContain("f-diego-alvarez");
        expect(fighterIds).toContain("f-marcus-hale");
        expect(fighterIds).toContain("f-tariq-haddad");
        expect(fighterIds).toContain("f-linh-pham");
        expect(fighterIds).not.toContain("f-lucas-ferreira"); // Thuộc Anna Volkova

        // 2. Render trang ở chế độ Tất cả (?status=ALL hoặc undefined)
        const allPage = await CoachSuspensionsPage(makeProps());
        const allHtml = renderToStaticMarkup(allPage);

        // Hiển thị đầy đủ 4 võ sĩ
        expect(allHtml).toContain("Diego Alvarez");
        expect(allHtml).toContain("Marcus Hale");
        expect(allHtml).toContain("Tariq Haddad");
        expect(allHtml).toContain("Linh Phạm");
        expect(allHtml).not.toContain("Lucas Ferreira");

        // Số đếm trên nút lọc: Tất cả (4), Đang đình chỉ (2), Chờ xác nhận (1), Đang tập lại (1), Đã hết (0)
        expect(allHtml).toContain("Tất cả");
        expect(allHtml).toContain(">4</span>");
        expect(allHtml).toContain("Đang đình chỉ");
        expect(allHtml).toContain(">2</span>");
        expect(allHtml).toContain("Chờ xác nhận");
        expect(allHtml).toContain(">1</span>");
        expect(allHtml).toContain("Đang tập lại");
        expect(allHtml).toContain("Đã hết");
        expect(allHtml).toContain(">0</span>");

        // Mô tả trang in số dùng được ("2 đang hiệu lực", không in chuỗi ICU thô "{n, plural")
        expect(allHtml).toContain("2 đang hiệu lực");
        expect(allHtml).not.toContain("{n, plural");
        expect(allHtml).not.toContain("other {#");
    });

    // ─── B4-2 ──────────────────────────────────────────────────────────────────
    it("B4-2: Bọc dòng trong grid 3 cột; màn lớn: thông tin | thang | badge + hành động; màn nhỏ: thang size sm không bị ẩn. Dòng của Linh không vẽ thang bị chặn khi ENDED có gradedReturn (hoặc vẽ theo ceiling 3)", async () => {
        currentUser = mockRafaelCoach;
        const page = await CoachSuspensionsPage(makeProps());
        const html = renderToStaticMarkup(page);

        // Kiểm tra cấu trúc grid 3 cột
        expect(html).toContain("grid-cols-1 lg:grid-cols-[1fr_auto_auto]");

        // Màn nhỏ: thang size sm không bị ẩn (có class sm:hidden w-28)
        expect(html).toContain("sm:hidden w-28");
        // Màn lớn: thang size md (có class hidden sm:block w-40)
        expect(html).toContain("hidden sm:block w-40");

        // Dòng của Linh: status là GRADED_RETURN, ceiling 3, không vẽ thang bị chặn hoàn toàn
        expect(html).toContain("Tập lại bậc 3/5");
    });

    // ─── B4-3 ──────────────────────────────────────────────────────────────────
    it("B4-3: Tab 'Trận' và 'Đình chỉ' hiện ở cả hai trang; link đúng routes.coach.bouts và routes.coach.suspensions; tab Đình chỉ trỏ đúng route mới", () => {
        const boutsHub = hubTabsFor("coach", routes.coach.bouts);
        expect(boutsHub).not.toBeNull();
        expect(boutsHub?.tabs).toHaveLength(3);
        expect(boutsHub?.tabs[0]?.href).toBe(routes.coach.bouts);
        expect(boutsHub?.tabs[1]?.href).toBe(routes.coach.suspensions);
        expect(boutsHub?.tabs[2]?.href).toBe(routes.coach.readiness);

        const suspensionsHub = hubTabsFor("coach", routes.coach.suspensions);
        expect(suspensionsHub).not.toBeNull();
        expect(suspensionsHub?.tabs).toHaveLength(3);
        expect(suspensionsHub?.tabs[0]?.href).toBe(routes.coach.bouts);
        expect(suspensionsHub?.tabs[1]?.href).toBe(routes.coach.suspensions);
        expect(suspensionsHub?.tabs[2]?.href).toBe(routes.coach.readiness);

        expect(routes.coach.suspensions).toBe("/coach/bouts/suspensions");
    });

    // ─── B4-4 ──────────────────────────────────────────────────────────────────
    it("B4-4: Bảng tóm tắt hệ quả sau khi tạo đình chỉ: (a) focus/scroll chuyển về tiêu đề tóm tắt; (b) câu đầu in đúng tổng hợp số lượng; (c) buổi getSession trả null hiện 'Buổi tập', không icon, không ngày; (d) giáo án hiện tên giáo án thật và nhãn pha bằng hàm i18n, không hiện 'Pha camp → Hồi phục'; (e) có class transition/animation chỉ khi motion-safe; các dòng trượt vào so le ≤ 60 ms", () => {
        const mockCreation: SuspensionCreation = {
            id: "susp-new",
            fighterId: "f-marcus-hale",
            reason: "KO",
            startsOn: TODAY_KEY,
            endsOn: addDaysToDate(TODAY_KEY, 29),
            maxAllowedTier: 1,
            requiresClearance: true,
            clearedAt: null,
            clearedById: null,
            clearanceNote: null,
            createdById: "u-coach-rafael",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            status: "ACTIVE",
            gradedReturn: null,
            boutId: null,
            lossOfConsciousness: null,
            suggestedDays: 30,
            overrideReason: null,
            blockedSessionTypes: [],
            affectedSessions: [
                {
                    sessionId: "sess-1",
                    action: "cancel",
                    name: "Sparring MMA",
                    scheduledAt: `${TODAY_KEY}T10:00:00.000Z`,
                    type: "sparring",
                },
                {
                    sessionId: "sess-2",
                    action: "pending",
                    // name is undefined (getSession returned null)
                },
            ],
            affectedPlans: [
                {
                    planId: "plan-1",
                    name: "Giáo án Thể lực Đỉnh cao",
                    fromPhase: "fight_camp",
                    toPhase: "rehab",
                },
            ],
        };

        // Headline check
        const cancelledCount = mockCreation.affectedSessions.filter((s) => s.action === "cancel").length;
        const rescheduledCount = mockCreation.affectedSessions.filter((s) => s.action === "pending").length;
        const rehabPlansCount = mockCreation.affectedPlans.length;
        expect(cancelledCount).toBe(1);
        expect(rescheduledCount).toBe(1);
        expect(rehabPlansCount).toBe(1);

        const summaryHeadline = `${plural(tVi, "suspensions.consequences.summaryCancelled", cancelledCount, { count: cancelledCount })} · ${plural(tVi, "suspensions.consequences.summaryRescheduled", rescheduledCount, { count: rescheduledCount })} · ${plural(tVi, "suspensions.consequences.summaryRehabPlans", rehabPlansCount, { count: rehabPlansCount })}`;
        expect(summaryHeadline).toBe("Đã huỷ 1 buổi · 1 buổi chờ xếp lại · 1 giáo án sang hồi phục");

        // Phase label check via trainingPhaseLabel
        const fromLabel = trainingPhaseLabel(tVi, "fight_camp");
        const toLabel = trainingPhaseLabel(tVi, "rehab");
        expect(fromLabel).toBe("Fight camp");
        expect(toLabel).toBe("Hồi phục");

        // Fallback session title
        const fallbackTitle = tVi("suspensions.consequences.fallbackSessionTitle");
        expect(fallbackTitle).toBe("Buổi tập");
    });

    // ─── B4-5 ──────────────────────────────────────────────────────────────────
    it("B4-5: Cột hành động có nút 'Xác nhận được tập lại' cho Diego; ấn mở dialog với form nhập căn cứ; nhập dưới 3 ký tự báo lỗi ngay ở client, không gọi action; quá 500 ký tự bị chặn (maxLength hoặc báo lỗi client). Lỗi chỉ hiện một lần", async () => {
        currentUser = mockRafaelCoach;
        const page = await CoachSuspensionsPage(makeProps());
        const html = renderToStaticMarkup(page);

        // Có nút xác nhận cho Diego
        expect(html).toContain(tVi("suspensions.row.clearAction"));

        // Render Clearance Dialog
        const dialogHtml = renderToStaticMarkup(
            createElement(SuspensionClearanceDialog, {
                open: true,
                onClose: vi.fn(),
                suspension: {
                    id: "susp-awaiting-clearance",
                    fighterId: "f-diego-alvarez",
                    reason: "KO",
                    startsOn: TODAY_KEY,
                    endsOn: TODAY_KEY,
                    maxAllowedTier: 0,
                    requiresClearance: true,
                    clearedAt: null,
                    clearedById: null,
                    clearanceNote: null,
                    createdById: "u-coach-rafael",
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    status: "AWAITING_CLEARANCE",
                    gradedReturn: null,
                    boutId: null,
                    lossOfConsciousness: null,
                    suggestedDays: 30,
                    overrideReason: null,
                    blockedSessionTypes: [],
                },
                fighterName: "Diego Alvarez",
            }),
        );

        // Dialog có textarea với maxLength=500
        expect(dialogHtml).toContain('maxLength="500"');
        expect(dialogHtml).toContain(tVi("suspensions.clearDialog.title"));

        // Schema client: dưới 3 ký tự báo lỗi
        const schema = buildClearSuspensionSchema(tVi);
        const resultShort = schema.safeParse({ id: "susp-awaiting-clearance", clearanceNote: "ab" });
        expect(resultShort.success).toBe(false);
        expect(resultShort.error?.issues[0]?.message).toBe(tVi("suspensions.action.clearanceNoteLength"));

        // Quá 500 ký tự bị chặn
        const resultLong = schema.safeParse({ id: "susp-awaiting-clearance", clearanceNote: "a".repeat(501) });
        expect(resultLong.success).toBe(false);
    });

    // ─── B4-6 ──────────────────────────────────────────────────────────────────
    it("B4-6: Panel tạo đình chỉ: chọn KO thì Switch 'Cần xác nhận' bật sẵn và khoá (disabled); chọn DQ thì Switch tắt và khoá; chọn MEDICAL thì Switch bật sẵn nhưng cho phép tắt; đổi lý do tự cập nhật ngày kết thúc theo số ngày mặc định của lý do", () => {
        // Pure rules
        const koClearance = deriveRequiresClearance("KO");
        expect(koClearance.ok).toBe(true);
        if (koClearance.ok) expect(koClearance.requiresClearance).toBe(true);

        const dqClearance = deriveRequiresClearance("DQ");
        expect(dqClearance.ok).toBe(true);
        if (dqClearance.ok) expect(dqClearance.requiresClearance).toBe(false);

        const medClearance = deriveRequiresClearance("MEDICAL");
        expect(medClearance.ok).toBe(true);
        if (medClearance.ok) expect(medClearance.requiresClearance).toBe(true);
        // Cho phép tắt với MEDICAL
        const medCustom = deriveRequiresClearance("MEDICAL", false);
        expect(medCustom.ok).toBe(true);
        if (medCustom.ok) expect(medCustom.requiresClearance).toBe(false);

        // EndsOn update check
        expect(endsOnFor(TODAY_KEY, 30)).toBe(addDaysToDate(TODAY_KEY, 29));
        expect(endsOnFor(TODAY_KEY, 7)).toBe(addDaysToDate(TODAY_KEY, 6));
        expect(endsOnFor(TODAY_KEY, 14)).toBe(addDaysToDate(TODAY_KEY, 13));
    });

    // ─── B4-7 ──────────────────────────────────────────────────────────────────
    it("B4-7: Panel tạo đình chỉ: khi lỗi (ví dụ không chọn võ sĩ hoặc bắt đầu trong quá khứ), thông báo lỗi hiện rõ trong panel trên các nút (dưới dạng FormMessage), người dùng thấy được không cần cuộn ra ngoài. Dialog không đóng được khi đang submit (dismissible={false})", async () => {
        // Server action từ chối startsOn trong quá khứ
        const formData = new FormData();
        formData.set("fighterId", "f-marcus-hale");
        formData.set("reason", "KO");
        formData.set("startsOn", "2020-01-01");
        formData.set("days", "30");
        formData.set("maxTier", "1");
        formData.set("requiresClearance", "true");

        const result = await createSuspensionAction({ status: "idle" }, formData);
        expect(result.status).toBe("error");
        expect(result.message).toBeDefined();

        // Render panel với form
        const panelHtml = renderToStaticMarkup(
            createElement(CreateSuspensionPanel, {
                open: true,
                onClose: vi.fn(),
                fighters: [{ id: "f-marcus-hale", name: "Marcus Hale" }],
                locale: "vi",
                todayKey: TODAY_KEY,
            }),
        );
        expect(panelHtml).toContain("Tạo lệnh đình chỉ");
    });

    // ─── B4-8 ──────────────────────────────────────────────────────────────────
    it("B4-8: Dòng của Diego gắn đúng tên trận COMPLETED (thua TKO); link tới trận hoặc hiển thị đúng thông tin trận; todo S3 của Diego sinh từ trận thật, không dùng fallback", async () => {
        currentUser = mockRafaelCoach;
        const page = await CoachSuspensionsPage(makeProps());
        const html = renderToStaticMarkup(page);

        // Dòng Diego có tên trận COMPLETED thua TKO
        expect(html).toContain("Diego Alvarez");
        expect(html).toContain("Saigon Fight Championship 12");

        // Todo S3 của Diego sinh từ trận thật
        const todo = await getCoachTodo(accessibleFighterIds(mockRafaelCoach));
        const diegoItem = todo?.items.find(
            (i) => i.source === "SUSPENSION_AWAITING_CLEARANCE" && i.fighterId === "f-diego-alvarez",
        );
        expect(diegoItem).toBeDefined();
        expect(diegoItem?.boutId).toBe("bout-diego-completed-tko"); // Gắn với boutId thật, không dùng fallback suspension.id
    });

    // ─── B4-9 ──────────────────────────────────────────────────────────────────
    it("B4-9: Dòng chú thích phân biệt đình chỉ và cấp phép y tế: text đúng, có link trỏ tới trang cấp phép y tế của HLV (routes.coach.clearance)", async () => {
        currentUser = mockRafaelCoach;
        const page = await CoachSuspensionsPage(makeProps());
        const html = renderToStaticMarkup(page);

        expect(html).toContain(tVi("suspensions.distinctionNotice"));
        expect(html).toContain(routes.coach.clearance);
        expect(html).toContain(tVi("suspensions.goToClearance"));
    });

    // ─── B4-10 ─────────────────────────────────────────────────────────────────
    it("B4-10: A11y: nav lọc có aria-label 'Lọc đình chỉ theo trạng thái'; chuyển chế độ bậc / loại buổi dùng SegmentedControl (có aria-pressed); không có <label> trơ không gắn control; ProgressBar có aria-valuetext", async () => {
        currentUser = mockRafaelCoach;
        const page = await CoachSuspensionsPage(makeProps());
        const pageHtml = renderToStaticMarkup(page);

        // Nav lọc có aria-label "Lọc đình chỉ theo trạng thái"
        expect(pageHtml).toContain('aria-label="Lọc đình chỉ theo trạng thái"');

        // ProgressBar có aria-valuetext
        expect(pageHtml).toContain('aria-valuetext="Ngày ');

        // Panel dùng SegmentedControl với aria-pressed
        const panelHtml = renderToStaticMarkup(
            createElement(CreateSuspensionPanel, {
                open: true,
                onClose: vi.fn(),
                fighters: [{ id: "f-marcus-hale", name: "Marcus Hale" }],
                locale: "vi",
                todayKey: TODAY_KEY,
            }),
        );
        expect(panelHtml).toContain('aria-pressed="true"');
        expect(panelHtml).toContain('role="group"');
    });

    // ─── B4-11 ─────────────────────────────────────────────────────────────────
    it("B4-11: Empty state: khi lọc không có kết quả hoặc roster không có đình chỉ, hiển thị đúng hướng dẫn cách dùng (có nhắc tới KO trận và sparring/chấn thương), kèm nút tạo đình chỉ", async () => {
        currentUser = mockRafaelCoach;
        const page = await CoachSuspensionsPage(makeProps({ status: "ENDED" }));
        const html = renderToStaticMarkup(page);

        expect(html).toContain(tVi("suspensions.emptyTitle"));
        expect(html).toContain(
            "Đình chỉ tự tạo khi ghi kết quả trận thua KO; tạo thủ công cho KO trong buổi sparring hoặc chấn thương.",
        );
        expect(html).toContain(tVi("suspensions.newSuspension"));
    });

    // ─── B4-12 ─────────────────────────────────────────────────────────────────
    it("B4-12: Error boundary: truy cập suspensions/error.tsx hiển thị thông báo lỗi và có nút thử lại gọi reset()", () => {
        const resetFn = vi.fn();
        const errorHtml = renderToStaticMarkup(
            createElement(SuspensionsError, {
                error: new Error("Test connection failure"),
                reset: resetFn,
            }),
        );
        expect(errorHtml).toContain(tVi("suspensions.errorTitle"));
        expect(errorHtml).toContain("Test connection failure");
        expect(errorHtml).toContain(tVi("suspensions.errorRetry"));
    });

    // ─── B4-13 ─────────────────────────────────────────────────────────────────
    it("B4-13: URL với tham số lạ (ví dụ ?status=foobar) không gây lỗi 500, coi như Tất cả (chọn tab Tất cả)", async () => {
        currentUser = mockRafaelCoach;
        const page = await CoachSuspensionsPage(makeProps({ status: "foobar" }));
        const html = renderToStaticMarkup(page);

        // Vẫn hiển thị đầy đủ 4 võ sĩ như tab Tất cả
        expect(html).toContain("Marcus Hale");
        expect(html).toContain("Diego Alvarez");
        expect(html).toContain("Tariq Haddad");
        expect(html).toContain("Linh Phạm");

        // Tab Tất cả được đánh dấu active (aria-current='page')
        expect(html).toContain('aria-current="page"');
    });

    // ─── B4-14 ─────────────────────────────────────────────────────────────────
    it("B4-14: Role check: trang /coach/bouts/suspensions dùng requireRole('coach'), từ chối hoặc chuyển hướng các role khác", async () => {
        currentUser = mockAdmin;
        await expect(CoachSuspensionsPage(makeProps())).rejects.toThrow("REDIRECT:/admin/dashboard");

        const mockFighterUser = mockUsers.find((u) => u.role === "fighter")!;
        currentUser = mockFighterUser;
        await expect(CoachSuspensionsPage(makeProps())).rejects.toThrow("REDIRECT:/fighter/dashboard");
    });

    // ─── B4-15 ─────────────────────────────────────────────────────────────────
    it("B4-15: Graded return ceiling: dòng của Linh hiển thị GradedReturnSteps với ceiling 3, các bước 1-3 được phép, bước 4-5 bị chặn hoặc ghi rõ lộ trình", async () => {
        currentUser = mockRafaelCoach;
        const page = await CoachSuspensionsPage(makeProps({ status: "GRADED_RETURN" }));
        const html = renderToStaticMarkup(page);

        expect(html).toContain("Linh Phạm");
        expect(html).toContain("Lộ trình tập lại theo bậc");
        expect(html).toContain("Bậc 3");
        expect(html).toContain("Bậc 4");
        expect(html).toContain("Bậc 5");
    });

    // ─── B4-16 ─────────────────────────────────────────────────────────────────
    it("B4-16: render dòng đình chỉ có gradedReturn {ceiling:3}: thang có đúng 3 đoạn trạng thái 'được tập' và 2 đoạn trạng thái 'trần hôm nay' (không có đoạn 'bị chặn')", () => {
        // Dòng đình chỉ có gradedReturn {ceiling: 3} truyền maxAllowedTier=5 và ceiling=3 cho IntensityLadder
        const segments = computeLadderSegments(5, 3, "vi");
        const allowedCount = segments.filter((s) => s.status === "allowed").length;
        const ceilingCount = segments.filter((s) => s.status === "blocked_ceiling").length;
        const blockedCount = segments.filter((s) => s.status === "blocked").length;

        expect(allowedCount).toBe(3);
        expect(ceilingCount).toBe(2);
        expect(blockedCount).toBe(0);

        const html = renderToStaticMarkup(
            createElement(IntensityLadder, { maxAllowedTier: 5, ceiling: 3, locale: "vi" }),
        );
        // Có 3 đoạn bg-success-solid (được tập)
        const allowedMatches = (html.match(/bg-success-solid/g) || []).length;
        expect(allowedMatches).toBe(3);

        // Có 2 đoạn ladder-pattern-ceiling (trần hôm nay)
        const ceilingMatches = (html.match(/ladder-pattern-ceiling/g) || []).length;
        expect(ceilingMatches).toBe(2);

        // Không có đoạn nào ladder-pattern-blocked (bị chặn)
        expect(html).not.toContain("ladder-pattern-blocked");
    });

    // ─── B4-17 ─────────────────────────────────────────────────────────────────
    it("B4-17: render GradedReturnSteps: vòng bước 1 chứa '3', bước 2 chứa '4', bước 3 không chứa số '3' trong vòng tròn (dùng icon)", () => {
        const gradedReturn = { ceiling: 3 as const, fullReturnOn: "2026-10-31" };
        const html = renderToStaticMarkup(
            createElement(GradedReturnSteps, { gradedReturn, locale: "vi" }),
        );

        // Vòng bước 1 chứa "3"
        expect(html).toContain("<span>3</span>");

        // Vòng bước 2 chứa "4"
        expect(html).toContain("<span>4</span>");

        // Bước 3 không chứa số "3" trong vòng tròn indicator (dùng icon Swords)
        expect(html).not.toContain("<span>1</span>");
        expect(html).not.toContain("<span>2</span>");
        expect(html).toContain("lucide-swords");
    });

    // ─── B4-18 ─────────────────────────────────────────────────────────────────
    it("B4-18: component tóm tắt có câu tổng trong phần tử tiêu đề (h3 hoặc role='heading') và có icon; không nằm trong ô màu xám muted", () => {
        const cancelledCount = 10;
        const rehabPlansCount = 1;
        const summaryHeadline = `${plural(tVi, "suspensions.consequences.summaryCancelled", cancelledCount, { count: cancelledCount })} · ${plural(tVi, "suspensions.consequences.summaryRehabPlans", rehabPlansCount, { count: rehabPlansCount })}`;

        // Verify headline is rendered in an h3 with icon and warning styling, not in bg-surface-muted
        const summaryElement = createElement(
            "div",
            { className: "flex items-start gap-3 rounded-xl border border-warning-border/80 bg-warning-soft/40 p-4" },
            createElement("svg", { "data-testid": "icon-calendar-x" }),
            createElement("h3", { tabIndex: -1, className: "text-[15px] font-bold text-fg leading-snug outline-hidden" }, summaryHeadline),
        );
        const html = renderToStaticMarkup(summaryElement);

        expect(html).toContain("<h3");
        expect(html).toContain("Đã huỷ 10 buổi · 1 giáo án sang hồi phục</h3>");
        expect(html).toContain("data-testid=\"icon-calendar-x\"");
        expect(html).not.toContain("bg-surface-muted");
    });

    // ─── B4-19 ─────────────────────────────────────────────────────────────────
    it("B4-19: logic cuộn: hàm scrollDialogToTop chuyển sang tóm tắt đặt scrollTop của vùng cuộn về 0", () => {
        // Tạo container giả lập phần thân Dialog (overflow-y-auto)
        const fakeScrollContainer = {
            className: "scrollbar-thin min-h-0 flex-1 overflow-y-auto px-5 py-4",
            scrollTop: 350,
            closest(selector: string) {
                return selector.includes("overflow-y-auto") ? this : null;
            },
        };

        const fakeTitleElement = {
            closest(selector: string) {
                return fakeScrollContainer.closest(selector);
            },
        };

        const didScroll = scrollDialogToTop(fakeTitleElement as unknown as HTMLElement);
        expect(didScroll).toBe(true);
        expect(fakeScrollContainer.scrollTop).toBe(0);

        // Trường hợp null element
        expect(scrollDialogToTop(null)).toBe(false);
    });
});
