import { DASHBOARDS, expect, expectPageReady, test, type Role } from "./fixtures";

interface NavTarget {
    /** Start of the link's accessible name (badges append a count, e.g. "Notifications 6 unread"). */
    link: string;
    href: string;
    h1: string | RegExp;
}

/** Every sidebar destination per role, in sidebar order. Doctor uses the grouped rail in `doctor/shell.tsx`, not hubs. */
const SIDEBAR: Record<Role, NavTarget[]> = {
    fighter: [
        { link: "Hôm nay", href: DASHBOARDS.fighter, h1: /, Minh$/ },
        { link: "Trận đấu", href: "/fighter/bout", h1: "Trận đấu" },
        { link: "Tập luyện", href: "/fighter/schedule", h1: "Lịch tập" },
        { link: "Video", href: "/fighter/videos", h1: "Video" },
        { link: "Sức khỏe", href: "/fighter/health", h1: "Sức khỏe & Cấp phép y tế" },
    ],
    coach: [
        { link: "Hôm nay", href: DASHBOARDS.coach, h1: /, Rafael$/ },
        { link: "Trận đấu", href: "/coach/bouts", h1: "Trận đấu" },
        { link: "Võ sĩ", href: "/coach/fighters", h1: "Võ sĩ" },
        { link: "Tập luyện", href: "/coach/sessions", h1: "Buổi tập" },
        { link: "Phòng video", href: "/coach/video-analysis", h1: "Phòng video" },
        { link: "Cấp phép", href: "/coach/medical-clearance", h1: "Cấp phép y tế" },
    ],
    doctor: [
        { link: "Hôm nay", href: DASHBOARDS.doctor, h1: "Phân loại hôm nay" },
        { link: "Võ sĩ", href: "/doctor/fighters", h1: "Võ sĩ" },
        { link: "Yêu cầu xem xét", href: "/doctor/review-requests", h1: "Yêu cầu xem xét" },
        { link: "Quan sát AI", href: "/doctor/ai-alerts", h1: "Quan sát AI" },
        { link: "Phiếu khám", href: "/doctor/examinations", h1: "Phiếu khám" },
        { link: "Chấn thương", href: "/doctor/injuries", h1: "Chấn thương" },
        { link: "Kế hoạch phục hồi", href: "/doctor/recovery", h1: "Kế hoạch phục hồi" },
        { link: "Giấy phép", href: "/doctor/medical-clearance", h1: "Giấy phép" },
        { link: "Lịch sử y tế", href: "/doctor/history", h1: "Lịch sử y tế" },
        { link: "Bệnh án", href: "/doctor/medical-records", h1: "Bệnh án" },
    ],
    admin: [
        { link: "Hôm nay", href: DASHBOARDS.admin, h1: /^Chào buổi (sáng|chiều|tối)$/ },
        { link: "Người dùng", href: "/admin/users", h1: "Người dùng" },
        { link: "Tập luyện", href: "/admin/exercises", h1: "Thư viện bài tập" },
        { link: "Nền tảng AI", href: "/admin/ai-jobs", h1: "Tác vụ AI" },
        { link: "Hệ thống", href: "/admin/audit-logs", h1: "Nhật ký hệ thống" },
    ],
};

/** Pages reached through a hub's tabs, per hub. Each list ends back on the hub's first tab. */
const HUB_TABS: Partial<Record<Role, { hub: string; tabs: NavTarget[] }[]>> = {
    fighter: [
        {
            hub: "Tập luyện",
            tabs: [
                { link: "Giáo án", href: "/fighter/training", h1: "Giáo án tập luyện" },
                { link: "Lịch sử", href: "/fighter/training/history", h1: "Lịch sử tập luyện" },
                { link: "Lịch tập", href: "/fighter/schedule", h1: "Lịch tập" },
            ],
        },
    ],
    coach: [
        {
            hub: "Trận đấu",
            tabs: [
                { link: "Đình chỉ", href: "/coach/bouts/suspensions", h1: "Đình chỉ" },
                { link: "Sẵn sàng", href: "/coach/bouts/readiness", h1: "Sẵn sàng thi đấu" },
                { link: "Sắp tới", href: "/coach/bouts", h1: "Trận đấu" },
            ],
        },
        {
            hub: "Tập luyện",
            tabs: [
                { link: "Giáo án", href: "/coach/training-plans", h1: "Giáo án tập luyện" },
                { link: "Buổi tập", href: "/coach/sessions", h1: "Buổi tập" },
            ],
        },
    ],
    admin: [
        {
            hub: "Người dùng",
            tabs: [
                { link: "Vai trò và quyền", href: "/admin/roles", h1: "Vai trò và quyền" },
                { link: "Người dùng", href: "/admin/users", h1: "Người dùng" },
            ],
        },
        {
            hub: "Nền tảng AI",
            tabs: [
                { link: "Video", href: "/admin/videos", h1: "Video" },
                { link: "Tác vụ AI", href: "/admin/ai-jobs", h1: "Tác vụ AI" },
            ],
        },
        {
            hub: "Hệ thống",
            tabs: [
                { link: "Thông báo chung", href: "/admin/notifications", h1: "Thông báo chung" },
                { link: "Cài đặt", href: "/admin/settings", h1: "Cài đặt hệ thống" },
                { link: "Nhật ký hệ thống", href: "/admin/audit-logs", h1: "Nhật ký hệ thống" },
            ],
        },
    ],
};

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const linkName = (label: string) => new RegExp(`^${escapeRegExp(label)}(\\s|$)`);

test.describe("sidebar navigation", () => {
    for (const role of Object.keys(SIDEBAR) as Role[]) {
        test(`every ${role} sidebar link opens a working page`, async ({ page, signInAs, isMobile }) => {
            test.skip(isMobile, "The sidebar is replaced by the drawer and bottom bar on small screens.");
            test.slow(); // one test visits a dozen pages, each compiled on first visit by the dev server
            await signInAs(role);
            await page.goto(DASHBOARDS[role]);
            const sidebar = page.getByRole("navigation", { name: "Điều hướng chính" });

            for (const target of SIDEBAR[role]) {
                await test.step(`${target.link} → ${target.href}`, async () => {
                    const link = sidebar.getByRole("link", { name: linkName(target.link) });
                    await link.click();
                    await expect(page).toHaveURL(target.href);
                    await expectPageReady(page, target.h1);
                    await expect(link).toHaveAttribute("aria-current", "page");
                });
            }
        });
    }
});

test.describe("hub tabs", () => {
    for (const role of Object.keys(HUB_TABS) as Role[]) {
        test(`every ${role} hub tab opens a working page and keeps its hub current`, async ({ page, signInAs, isMobile }) => {
            test.skip(isMobile, "The sidebar hub link is only checked on large screens.");
            test.slow();
            await signInAs(role);
            await page.goto(DASHBOARDS[role]);
            const sidebar = page.getByRole("navigation", { name: "Điều hướng chính" });

            for (const { hub, tabs } of HUB_TABS[role] ?? []) {
                const hubLink = sidebar.getByRole("link", { name: linkName(hub) });
                await hubLink.click();
                const tabNav = page.getByRole("navigation", { name: `Các mục của ${hub}` });
                await expect(tabNav).toBeVisible();

                for (const target of tabs) {
                    await test.step(`${hub} › ${target.link} → ${target.href}`, async () => {
                        const tab = tabNav.getByRole("link", { name: linkName(target.link) });
                        await tab.click();
                        await expect(page).toHaveURL(target.href);
                        await expectPageReady(page, target.h1);
                        await expect(tab).toHaveAttribute("aria-current", "page");
                        await expect(hubLink).toHaveAttribute("aria-current", "page");
                    });
                }
            }
        });
    }

    test("profile and preferences are reachable from the account menu", async ({ page, signInAs }) => {
        await signInAs("fighter");
        await page.goto(DASHBOARDS.fighter);
        const menu = page.getByRole("button", { name: /^Menu tài khoản của/ });

        await menu.click();
        await page.getByRole("link", { name: "Hồ sơ", exact: true }).click();
        await expect(page).toHaveURL("/profile");
        await expectPageReady(page, "Hồ sơ");

        await menu.click();
        await page.getByRole("link", { name: "Tùy chọn", exact: true }).click();
        await expect(page).toHaveURL("/settings");
        await expectPageReady(page, "Tùy chọn");
    });
});

test.describe("mobile navigation @mobile", () => {
    test.beforeEach(({ isMobile }) => {
        test.skip(!isMobile, "The bottom bar and the drawer only render on small screens.");
    });

    test("the bottom bar reaches every fighter hub", async ({ page, signInAs }) => {
        await signInAs("fighter");
        await page.goto(DASHBOARDS.fighter);
        await expectPageReady(page, /, Minh$/);

        const bar = page.getByRole("navigation", { name: "Điều hướng nhanh" });
        await expect(bar.getByRole("link")).toHaveCount(SIDEBAR.fighter.length);
        for (const target of SIDEBAR.fighter) {
            const link = bar.getByRole("link", { name: linkName(target.link) });
            await link.click();
            await expect(page).toHaveURL(target.href);
            await expectPageReady(page, target.h1);
            await expect(link).toHaveAttribute("aria-current", "page");
        }
    });

    test("the navigation drawer opens, navigates, closes and returns focus", async ({ page, signInAs }) => {
        await signInAs("coach");
        await page.goto(DASHBOARDS.coach);
        await expectPageReady(page, /, Rafael$/);

        const open = page.getByRole("button", { name: "Mở menu" });
        const drawer = page.getByRole("dialog", { name: "Menu" });
        await expect(drawer).toBeHidden();

        // Open and navigate: the drawer closes on its own and focus goes back to the menu button.
        await open.click();
        await expect(drawer).toBeVisible();
        await expect(open).toHaveAttribute("aria-expanded", "true");
        await drawer.getByRole("link", { name: linkName("Tập luyện") }).click();
        await expect(page).toHaveURL("/coach/sessions");
        await expect(drawer).toBeHidden();
        await expectPageReady(page, "Buổi tập");
        await expect(open).toHaveAttribute("aria-expanded", "false");
        await expect(open).toBeFocused();

        // The current page is marked in the drawer.
        await open.click();
        await expect(drawer.getByRole("link", { name: linkName("Tập luyện") })).toHaveAttribute("aria-current", "page");

        // Escape closes it and returns focus.
        await page.keyboard.press("Escape");
        await expect(drawer).toBeHidden();
        await expect(open).toBeFocused();

        // So does the close button.
        await open.click();
        await expect(drawer).toBeVisible();
        await drawer.getByRole("button", { name: "Đóng menu" }).click();
        await expect(drawer).toBeHidden();
        await expect(open).toBeFocused();
        await expect(page).toHaveURL("/coach/sessions");
    });
});
