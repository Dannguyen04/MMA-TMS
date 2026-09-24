import { test as base, expect, type BrowserContext, type Locator, type Page } from "@playwright/test";

/**
 * Bộ fixture Playwright dùng chung cho kiểm thử end-to-end MMA-TMS.
 *
 * - `signInAs(role | userId)`: đăng nhập qua giao diện bằng tài khoản E2E.
 * - `loginThroughUi(...)`: điền biểu mẫu đăng nhập thật.
 * - `consoleErrors`: thu thập lỗi trang, console và hydration ngoài dự kiến.
 * - `setTheme(theme)`: đặt cookie giao diện không liên quan đến xác thực.
 */

export const THEME_COOKIE = "mma_theme";
export const E2E_PASSWORD = process.env.E2E_PASSWORD ?? "";

export type Role = "fighter" | "coach" | "doctor" | "admin";

/** Users of the isolated E2E seed referenced by the specs (backend user ids). */
export const USERS = {
    minh: "11111111-1111-4111-8111-111111111101",
    lucas: "11111111-1111-4111-8111-111111111102",
    diego: "11111111-1111-4111-8111-111111111103",
    bao: "11111111-1111-4111-8111-111111111104",
    kenji: "11111111-1111-4111-8111-111111111105",
    rafael: "11111111-1111-4111-8111-111111111106",
    anna: "11111111-1111-4111-8111-111111111107",
    thuLe: "11111111-1111-4111-8111-111111111108",
    samuelBrooks: "11111111-1111-4111-8111-111111111109",
    nora: "11111111-1111-4111-8111-111111111110",
} as const;

/** Tài khoản E2E chính cho từng vai trò. */
export const E2E_USER_IDS: Record<Role, string> = {
    fighter: USERS.minh,
    coach: USERS.rafael,
    doctor: USERS.thuLe,
    admin: USERS.nora,
};

const E2E_EMAILS: Record<string, string> = {
    [USERS.minh]: "minh.tran@lotus-combat.test",
    [USERS.lucas]: "lucas.ferreira@lotus-combat.test",
    [USERS.diego]: "diego.alvarez@lotus-combat.test",
    [USERS.bao]: "bao.nguyen@lotus-combat.test",
    [USERS.kenji]: "kenji.morita@lotus-combat.test",
    [USERS.rafael]: "rafael.costa@lotus-combat.test",
    [USERS.anna]: "anna.volkova@lotus-combat.test",
    [USERS.thuLe]: "thu.le@lotus-combat.test",
    [USERS.samuelBrooks]: "samuel.brooks@lotus-combat.test",
    [USERS.nora]: "nora.whitfield@lotus-combat.test",
};

export const DASHBOARDS: Record<Role, string> = {
    fighter: "/fighter/dashboard",
    coach: "/coach/dashboard",
    doctor: "/doctor/dashboard",
    admin: "/admin/dashboard",
};

/** Sign-in email of a seeded E2E user. */
export function emailFor(userId: string): string {
    const email = E2E_EMAILS[userId];
    if (!email) throw new Error(`No E2E email is registered for user ${userId}.`);
    return email;
}

/** A suffix that keeps records created by one run distinct from every other run. */
export function uniqueSuffix(): string {
    return `${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;
}

/** Academy wall-clock values (Asia/Ho_Chi_Minh, the timezone every form uses), `days` from now. */
export function academyClock(days = 0): { date: string; time: string } {
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Ho_Chi_Minh",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
    }).formatToParts(new Date(Date.now() + days * 86_400_000));
    const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
    return { date: `${part("year")}-${part("month")}-${part("day")}`, time: `${part("hour")}:${part("minute")}` };
}

/** Console messages the dev server prints on every page that say nothing about the app's health. */
const BENIGN_CONSOLE_MESSAGES: RegExp[] = [
    /Download the React DevTools/i,
    /\[HMR\]/,
    /\[Fast Refresh\]/,
    // Dev-only hot reload socket reconnects when the dev server recompiles.
    /(webpack|turbopack)-hmr/i,
    /_next\/webpack-hmr|__nextjs_original-stack-frame/,
];

/** Error messages rendered by the app's error boundaries (src/app/(app)/error.tsx, global-error.tsx). */
const ERROR_BOUNDARY_TEXT = [/This page didn.t load/, /MMA-TMS is temporarily unavailable/, /Unhandled Runtime Error/];

export interface ConsoleErrors {
    /** Everything collected so far. */
    readonly messages: string[];
    /** Accept messages matching this pattern for the rest of the test. */
    allow(pattern: RegExp): void;
}

export interface Fixtures {
    signInAs(who: Role | string): Promise<void>;
    loginThroughUi(page: Page, options: { email: string; password: string }): Promise<void>;
    setTheme(theme: "light" | "dark" | "system"): Promise<void>;
    consoleErrors: ConsoleErrors;
    hideDevOverlay: void;
}

function userIdFor(who: Role | string): string {
    return who in E2E_USER_IDS ? E2E_USER_IDS[who as Role] : who;
}

function requiredE2EPassword(): string {
    if (!E2E_PASSWORD) throw new Error("E2E_PASSWORD must be configured for real Playwright authentication.");
    return E2E_PASSWORD;
}

/** Fills and submits the real login form on the current page. */
async function submitLoginForm(page: Page, { email, password }: { email: string; password: string }) {
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
}

async function setCookie(context: BrowserContext, baseURL: string, name: string, value: string) {
    await context.addCookies([{ name, value, url: baseURL, sameSite: "Lax" }]);
}

/** Attaches console and page error listeners to a page. */
function watchPage(page: Page, messages: string[]) {
    page.on("pageerror", (error) => messages.push(`pageerror: ${error.message}`));
    page.on("console", (message) => {
        const type = message.type();
        const text = message.text();
        if (type === "error" || (type === "warning" && /hydrat/i.test(text))) {
            messages.push(`console.${type}: ${text}`);
        }
    });
}

export const test = base.extend<Fixtures>({
    signInAs: async ({ page }, provideFixture) => {
        await provideFixture(async (who) => {
            await page.goto("/login");
            await submitLoginForm(page, { email: emailFor(userIdFor(who)), password: requiredE2EPassword() });
            await expect(page).not.toHaveURL(/\/login(?:\?|$)/);
        });
    },

    loginThroughUi: async ({}, provideFixture) => {
        await provideFixture(submitLoginForm);
    },

    setTheme: async ({ context, baseURL }, provideFixture) => {
        await provideFixture(async (theme) => {
            await setCookie(context, baseURL!, THEME_COOKIE, theme);
        });
    },

    hideDevOverlay: [
        async ({ context }, use) => {
            // `next dev` renders its indicator (and error overlay) in a <nextjs-portal> in the bottom-left
            // corner, on top of the mobile bottom bar. It doesn't exist in production, so hide it. Runtime
            // errors still fail the test through the console error collector.
            await context.addInitScript(() => {
                const hide = () =>
                    document.querySelectorAll<HTMLElement>("nextjs-portal").forEach((portal) => {
                        if (portal.style.display !== "none") portal.style.setProperty("display", "none", "important");
                    });
                new MutationObserver(hide).observe(document, { childList: true, subtree: true });
            });
            await use();
        },
        { auto: true },
    ],

    consoleErrors: [
        async ({ context }, use, testInfo) => {
            const messages: string[] = [];
            const allowed: RegExp[] = [...BENIGN_CONSOLE_MESSAGES];
            for (const page of context.pages()) watchPage(page, messages);
            context.on("page", (page) => watchPage(page, messages));

            await use({
                messages,
                allow: (pattern) => {
                    allowed.push(pattern);
                },
            });

            const unexpected = messages.filter((message) => !allowed.some((pattern) => pattern.test(message)));
            if (unexpected.length > 0) {
                await testInfo.attach("console-errors", { body: unexpected.join("\n\n"), contentType: "text/plain" });
            }
            expect(unexpected, "No page errors, console errors or hydration warnings").toEqual([]);
        },
        { auto: true },
    ],
});

export { expect };

/**
 * Asserts the page finished rendering: exactly one h1 with the expected text and no error boundary.
 * Server-rendered pages stream in after their loading skeleton, so this waits for the heading.
 */
export async function expectPageReady(page: Page, h1: string | RegExp) {
    // Accessible name, not raw text: decorative content such as avatar initials is aria-hidden.
    await expect(page.getByRole("heading", { level: 1, name: h1, exact: typeof h1 === "string" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    for (const text of ERROR_BOUNDARY_TEXT) {
        await expect(page.getByText(text)).toHaveCount(0);
    }
}

/** The app's "not found" states: the (app) boundary, the coach roster boundary or the root 404 page. */
export async function expectNotFound(page: Page) {
    await expect(
        page
            .getByText("We couldn't find that")
            .or(page.getByText("Fighter not found"))
            .or(page.getByRole("heading", { name: "This page isn't in the octagon" })),
    ).toBeVisible();
}

/** The toast region is shared; wait for a toast with this title. */
export function toast(page: Page, title: string | RegExp) {
    return page.getByRole("status").or(page.getByRole("alert")).filter({ hasText: title });
}

/**
 * Checks a native radio or checkbox that is visually hidden (`sr-only`) behind a custom-drawn control
 * (star ratings, chip checkboxes). A pointer click on a 1px clipped input never lands on it, so do what
 * a keyboard user does: focus it and press Space.
 */
export async function checkHidden(control: Locator) {
    if (await control.isChecked()) return;
    await control.focus();
    await control.press("Space");
    await expect(control).toBeChecked();
}
