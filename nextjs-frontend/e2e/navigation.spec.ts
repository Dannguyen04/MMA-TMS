import { DASHBOARDS, expect, expectPageReady, test, type Role } from "./fixtures";

interface NavTarget {
    /** Start of the link's accessible name (badges append a count, e.g. "Notifications 6 unread"). */
    link: string;
    href: string;
    h1: string | RegExp;
}

/** Every sidebar destination per role, in sidebar order (src/components/layout/navigation.ts). A hub opens its first tab. */
const SIDEBAR: Record<Role, NavTarget[]> = {
    fighter: [
        { link: "Training", href: "/fighter/schedule", h1: "Schedule" },
        { link: "Film", href: "/fighter/videos", h1: "Film" },
        { link: "Progress", href: "/fighter/performance", h1: "Performance" },
        { link: "Health", href: "/fighter/health", h1: "Health & Medical Clearance" },
        { link: "Today", href: DASHBOARDS.fighter, h1: /, Minh$/ },
    ],
    coach: [
        { link: "Roster", href: "/coach/fighters", h1: "Fighters" },
        { link: "Training", href: "/coach/sessions", h1: "Sessions" },
        { link: "Film room", href: "/coach/video-analysis", h1: "Film room" },
        { link: "Clearance", href: "/coach/medical-clearance", h1: "Medical Clearance" },
        { link: "Today", href: DASHBOARDS.coach, h1: /, Rafael$/ },
    ],
    doctor: [
        { link: "Patients", href: "/doctor/fighters", h1: "Fighters" },
        { link: "Clinical", href: "/doctor/examinations", h1: "Examinations" },
        { link: "Observations", href: "/doctor/ai-alerts", h1: "AI movement observations" },
        { link: "Triage", href: DASHBOARDS.doctor, h1: "Triage" },
    ],
    admin: [
        { link: "Users", href: "/admin/users", h1: "Users" },
        { link: "Roles & permissions", href: "/admin/roles", h1: "Roles & permissions" },
        { link: "Videos", href: "/admin/videos", h1: "Videos" },
        { link: "AI jobs", href: "/admin/ai-jobs", h1: "AI jobs" },
        { link: "AI models", href: "/admin/ai-models", h1: "AI models" },
        { link: "Audit logs", href: "/admin/audit-logs", h1: "Audit logs" },
        { link: "Broadcasts", href: "/admin/notifications", h1: "Broadcasts" },
        { link: "System settings", href: "/admin/settings", h1: "System settings" },
        { link: "Dashboard", href: DASHBOARDS.admin, h1: "Platform overview" },
    ],
};

/** Pages reached through a hub's tabs, per hub. Each list ends back on the hub's first tab. */
const HUB_TABS: Partial<Record<Role, { hub: string; tabs: NavTarget[] }[]>> = {
    fighter: [
        {
            hub: "Training",
            tabs: [
                { link: "Plans", href: "/fighter/training", h1: "Training plans" },
                { link: "History", href: "/fighter/training/history", h1: "Training history" },
                { link: "Schedule", href: "/fighter/schedule", h1: "Schedule" },
            ],
        },
        {
            hub: "Progress",
            tabs: [
                { link: "Goals", href: "/fighter/goals", h1: "Goals" },
                { link: "Performance", href: "/fighter/performance", h1: "Performance" },
            ],
        },
    ],
    coach: [
        {
            hub: "Roster",
            tabs: [
                { link: "Performance", href: "/coach/performance", h1: "Team performance" },
                { link: "Goals", href: "/coach/goals", h1: "Goals" },
                { link: "Fighters", href: "/coach/fighters", h1: "Fighters" },
            ],
        },
        {
            hub: "Training",
            tabs: [
                { link: "Plans", href: "/coach/training-plans", h1: "Training plans" },
                { link: "Sessions", href: "/coach/sessions", h1: "Sessions" },
            ],
        },
    ],
    doctor: [
        {
            hub: "Patients",
            tabs: [
                { link: "Records", href: "/doctor/medical-records", h1: "Medical records" },
                { link: "Fighters", href: "/doctor/fighters", h1: "Fighters" },
            ],
        },
        {
            hub: "Clinical",
            tabs: [
                { link: "Injuries", href: "/doctor/injuries", h1: "Injuries" },
                { link: "Recovery", href: "/doctor/recovery", h1: "Recovery" },
                { link: "Clearance", href: "/doctor/medical-clearance", h1: "Medical Clearance" },
                { link: "Examinations", href: "/doctor/examinations", h1: "Examinations" },
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
            const sidebar = page.getByRole("navigation", { name: "Main" });

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
            const sidebar = page.getByRole("navigation", { name: "Main" });

            for (const { hub, tabs } of HUB_TABS[role] ?? []) {
                const hubLink = sidebar.getByRole("link", { name: linkName(hub) });
                await hubLink.click();
                const tabNav = page.getByRole("navigation", { name: `${hub} sections` });
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
        const menu = page.getByRole("button", { name: /^Account menu for/ });

        await menu.click();
        await page.getByRole("link", { name: "Profile", exact: true }).click();
        await expect(page).toHaveURL("/profile");
        await expectPageReady(page, "Profile");

        await menu.click();
        await page.getByRole("link", { name: "Preferences", exact: true }).click();
        await expect(page).toHaveURL("/settings");
        await expectPageReady(page, "Preferences");
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

        const bar = page.getByRole("navigation", { name: "Primary" });
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

        const open = page.getByRole("button", { name: "Open navigation" });
        const drawer = page.getByRole("dialog", { name: "Navigation" });
        await expect(drawer).toBeHidden();

        // Open and navigate: the drawer closes on its own and focus goes back to the menu button.
        await open.click();
        await expect(drawer).toBeVisible();
        await expect(open).toHaveAttribute("aria-expanded", "true");
        await drawer.getByRole("link", { name: linkName("Training") }).click();
        await expect(page).toHaveURL("/coach/sessions");
        await expect(drawer).toBeHidden();
        await expectPageReady(page, "Sessions");
        await expect(open).toHaveAttribute("aria-expanded", "false");
        await expect(open).toBeFocused();

        // The current page is marked in the drawer.
        await open.click();
        await expect(drawer.getByRole("link", { name: linkName("Training") })).toHaveAttribute("aria-current", "page");

        // Escape closes it and returns focus.
        await page.keyboard.press("Escape");
        await expect(drawer).toBeHidden();
        await expect(open).toBeFocused();

        // So does the close button.
        await open.click();
        await expect(drawer).toBeVisible();
        await drawer.getByRole("button", { name: "Close navigation" }).click();
        await expect(drawer).toBeHidden();
        await expect(open).toBeFocused();
        await expect(page).toHaveURL("/coach/sessions");
    });
});
