import { DASHBOARDS, expect, expectPageReady, test, type Role } from "./fixtures";

interface NavTarget {
    /** Start of the link's accessible name (badges append a count, e.g. "Notifications 6 unread"). */
    link: string;
    href: string;
    h1: string | RegExp;
}

const ACCOUNT: NavTarget[] = [
    { link: "Notifications", href: "/notifications", h1: "Notifications" },
    { link: "Profile", href: "/profile", h1: "Profile" },
    { link: "Preferences", href: "/settings", h1: "Preferences" },
];

/** Every sidebar destination per role, in sidebar order (src/components/layout/navigation.ts). */
const SIDEBAR: Record<Role, NavTarget[]> = {
    fighter: [
        { link: "Schedule", href: "/fighter/schedule", h1: "Schedule" },
        { link: "Training plans", href: "/fighter/training", h1: "Training plans" },
        { link: "History", href: "/fighter/training/history", h1: "Training history" },
        { link: "Videos", href: "/fighter/videos", h1: "Videos" },
        { link: "Performance", href: "/fighter/performance", h1: "Performance" },
        { link: "Goals", href: "/fighter/goals", h1: "Goals" },
        { link: "Health & Medical Clearance", href: "/fighter/health", h1: "Health & Medical Clearance" },
        ...ACCOUNT,
        { link: "Dashboard", href: DASHBOARDS.fighter, h1: /, Minh$/ },
    ],
    coach: [
        { link: "Fighters", href: "/coach/fighters", h1: "Fighters" },
        { link: "Performance", href: "/coach/performance", h1: "Team performance" },
        { link: "Goals", href: "/coach/goals", h1: "Goals" },
        { link: "Training plans", href: "/coach/training-plans", h1: "Training plans" },
        { link: "Sessions", href: "/coach/sessions", h1: "Sessions" },
        { link: "Video analysis", href: "/coach/video-analysis", h1: "Video analysis" },
        { link: "Medical Clearance", href: "/coach/medical-clearance", h1: "Medical Clearance" },
        ...ACCOUNT,
        { link: "Dashboard", href: DASHBOARDS.coach, h1: /, Rafael$/ },
    ],
    doctor: [
        { link: "Fighters", href: "/doctor/fighters", h1: "Fighters" },
        { link: "Medical records", href: "/doctor/medical-records", h1: "Medical records" },
        { link: "Examinations", href: "/doctor/examinations", h1: "Examinations" },
        { link: "Injuries", href: "/doctor/injuries", h1: "Injuries" },
        { link: "Recovery", href: "/doctor/recovery", h1: "Recovery" },
        { link: "Medical Clearance", href: "/doctor/medical-clearance", h1: "Medical Clearance" },
        { link: "AI observations", href: "/doctor/ai-alerts", h1: "AI movement observations" },
        ...ACCOUNT,
        { link: "Dashboard", href: DASHBOARDS.doctor, h1: "Clinical overview" },
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
        ...ACCOUNT,
        { link: "Dashboard", href: DASHBOARDS.admin, h1: "Platform overview" },
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

test.describe("mobile navigation @mobile", () => {
    test.beforeEach(({ isMobile }) => {
        test.skip(!isMobile, "The bottom bar and the drawer only render on small screens.");
    });

    test("the bottom bar reaches the fighter's primary destinations", async ({ page, signInAs }) => {
        await signInAs("fighter");
        await page.goto(DASHBOARDS.fighter);
        await expectPageReady(page, /, Minh$/);

        const bar = page.getByRole("navigation", { name: "Primary" });
        await expect(bar.getByRole("link")).toHaveCount(4);
        const destinations: NavTarget[] = [
            { link: "Schedule", href: "/fighter/schedule", h1: "Schedule" },
            { link: "Videos", href: "/fighter/videos", h1: "Videos" },
            { link: "Health", href: "/fighter/health", h1: "Health & Medical Clearance" },
            { link: "Dashboard", href: DASHBOARDS.fighter, h1: /, Minh$/ },
        ];
        for (const target of destinations) {
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
        await drawer.getByRole("link", { name: linkName("Training plans") }).click();
        await expect(page).toHaveURL("/coach/training-plans");
        await expect(drawer).toBeHidden();
        await expectPageReady(page, "Training plans");
        await expect(open).toHaveAttribute("aria-expanded", "false");
        await expect(open).toBeFocused();

        // The current page is marked in the drawer.
        await open.click();
        await expect(drawer.getByRole("link", { name: linkName("Training plans") })).toHaveAttribute("aria-current", "page");

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
        await expect(page).toHaveURL("/coach/training-plans");
    });
});
