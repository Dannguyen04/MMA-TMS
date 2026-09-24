import { DASHBOARDS, E2E_PASSWORD, emailFor, expect, expectPageReady, test, USERS, type Role } from "./fixtures";

const DASHBOARD_HEADINGS: Record<Role, RegExp> = {
    fighter: /, Minh$/,
    coach: /, Rafael$/,
    doctor: /^Clinical overview$/,
    admin: /^Platform overview$/,
};

test.describe("authentication", () => {
    test("an unauthenticated visit to a protected page redirects to login with ?next=", async ({ page }) => {
        await page.goto("/coach/sessions");
        await expect(page).toHaveURL((url) => url.pathname === "/login" && url.searchParams.get("next") === "/coach/sessions");
        await expectPageReady(page, "Sign in");
    });

    for (const role of Object.keys(DASHBOARDS) as Role[]) {
        test(`the ${role} account signs in and lands on the ${role} dashboard`, async ({ page, signInAs }) => {
            await signInAs(role);
            await expect(page).toHaveURL(DASHBOARDS[role]);
            await expectPageReady(page, DASHBOARD_HEADINGS[role]);
        });
    }

    test("email and password sign-in honours ?next=", async ({ page, loginThroughUi }) => {
        await page.goto("/coach/sessions");
        await expect(page).toHaveURL(/\/login\?next=/);
        await loginThroughUi(page, { email: emailFor(USERS.rafael), password: E2E_PASSWORD });
        await expect(page).toHaveURL("/coach/sessions");
        await expectPageReady(page, "Sessions");
    });

    test("a wrong password shows an inline error and keeps the email", async ({ page, loginThroughUi }) => {
        const email = emailFor(USERS.minh);
        await page.goto("/login");
        await loginThroughUi(page, { email, password: "not-the-password" });
        await expect(page.getByRole("main").getByRole("alert")).toHaveText("That email and password combination is incorrect.");
        await expect(page).toHaveURL(/\/login/);
        await expect(page.getByLabel("Email")).toHaveValue(email);
    });

    test.describe("open redirects", () => {
        const payloads = [
            "//evil.example",
            "/%09/evil.example",
            "/\\evil.example",
            "https://evil.example/fighter/dashboard",
            "/.//evil.example",
            "/%2F%2Fevil.example",
        ];

        for (const payload of payloads) {
            test(`next=${payload} never leaves the origin`, async ({ page, loginThroughUi, baseURL }) => {
                const origin = new URL(baseURL!).origin;
                // The raw value goes into the query string as an attacker would write it.
                await page.goto(`/login?next=${payload}`);
                await loginThroughUi(page, { email: emailFor(USERS.minh), password: E2E_PASSWORD });
                await expect(page).toHaveURL(DASHBOARDS.fighter);
                expect(new URL(page.url()).origin).toBe(origin);
                await expectPageReady(page, DASHBOARD_HEADINGS.fighter);
            });
        }

        test("role sign-in ignores a hostile ?next= too", async ({ page, baseURL, loginThroughUi }) => {
            await page.goto("/login?next=//evil.example");
            await loginThroughUi(page, { email: emailFor(USERS.rafael), password: E2E_PASSWORD });
            await expect(page).toHaveURL(DASHBOARDS.coach);
            expect(new URL(page.url()).origin).toBe(new URL(baseURL!).origin);
        });
    });

    test("forgot password always shows the neutral success message", async ({ page }) => {
        await page.goto("/login");
        await page.getByRole("link", { name: "Forgot password?" }).click();
        await expectPageReady(page, "Reset your password");

        const email = "nobody-here@lotus-combat.test";
        await page.getByLabel("Email").fill(email);
        await page.getByRole("button", { name: "Send reset link" }).click();
        await expect(page.getByRole("status")).toContainText("Check your inbox");
        await expect(page.getByRole("status")).toContainText("If that email belongs to an account, reset instructions are on the way.");
    });

    test("sign out returns to login and protected pages redirect again", async ({ page, signInAs }) => {
        await signInAs("doctor");
        await page.goto(DASHBOARDS.doctor);
        await expectPageReady(page, DASHBOARD_HEADINGS.doctor);

        await page.getByRole("button", { name: /Account menu for/ }).click();
        await page.getByRole("button", { name: "Sign out" }).click();
        await expect(page).toHaveURL("/login");
        await expectPageReady(page, "Sign in");

        await page.goto("/doctor/injuries");
        await expect(page).toHaveURL((url) => url.pathname === "/login" && url.searchParams.get("next") === "/doctor/injuries");
    });
});
