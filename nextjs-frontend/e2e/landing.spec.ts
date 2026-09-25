import { expect, test } from "./fixtures";

const CHAPTER_HEADINGS = [
    "Every rep, read like a scorecard.",
    "Plans that move with the camp.",
    "Progress you can prove.",
    "Cleared by a doctor, not a guess.",
    "One corner. Four roles.",
    "Every signal. One clear decision.",
];

test.describe("public landing", () => {
    test("leads a signed-out visitor to login and tells the whole product story", async ({ page }) => {
        await page.goto("/");

        await expect(page.getByRole("heading", { level: 1 })).toContainText("Train harder");
        await expect(page.getByRole("link", { name: "Enter the arena", exact: true }).first()).toHaveAttribute("href", "/login");
        for (const heading of CHAPTER_HEADINGS) {
            await expect(page.getByRole("heading", { level: 2, name: heading })).toBeAttached();
        }
    });

    test("keeps the landing page visible after sign-in and routes the CTA to the role dashboard", async ({ page, signInAs }) => {
        await signInAs("fighter");
        await page.goto("/");

        const dashboardCta = page.getByRole("link", { name: "Open dashboard", exact: true }).first();
        await expect(page.getByRole("heading", { level: 1 })).toContainText("Train harder");
        await expect(dashboardCta).toHaveAttribute("href", "/fighter/dashboard");
        await dashboardCta.click();
        await expect(page).toHaveURL(/\/fighter\/dashboard$/);
    });

    test("builds the octagon stage from the fighter cutout in a single decorative canvas", async ({ page }) => {
        const cutout = page.waitForResponse((response) => response.url().endsWith("/images/landing/fighter-guard.webp"));
        await page.goto("/");

        expect((await cutout).status()).toBe(200);
        await expect(page.locator("canvas")).toHaveCount(1);
        await expect(page.locator(".landing-stage")).toHaveAttribute("aria-hidden", "true");
    });

    test("scrolling runs the analysis chapter without hijacking the page", async ({ page }) => {
        await page.goto("/");
        await page.waitForResponse((response) => response.url().endsWith("/images/landing/fighter-guard.webp"));

        // About two viewports down: past the hero and into the pinned analysis chapter.
        for (let step = 0; step < 6; step++) {
            await page.mouse.wheel(0, 320);
            await page.waitForTimeout(80);
        }
        await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(1200);
        await expect(page.locator("[data-hud-item='analysis']")).toHaveAttribute("data-active", "");
        await expect.poll(async () => Number(await page.locator("[data-analysis-percent]").textContent())).toBeGreaterThan(0);
    });

    test("header links glide to their chapter", async ({ page }) => {
        await page.goto("/");

        await page.getByRole("navigation", { name: "Landing navigation" }).getByRole("link", { name: "Sports medicine" }).click();
        await expect(page.getByRole("heading", { level: 2, name: "Cleared by a doctor, not a guess." })).toBeInViewport();
    });

    test("keeps every chapter readable with reduced motion", async ({ page }) => {
        await page.emulateMedia({ reducedMotion: "reduce" });
        await page.goto("/");

        await page.getByRole("heading", { level: 2, name: "Every rep, read like a scorecard." }).scrollIntoViewIfNeeded();
        await expect(page.getByText("Area of concern", { exact: true })).toBeVisible();
        await expect(page.getByText("Generating findings", { exact: true })).toBeVisible();
        await page.getByRole("heading", { level: 2, name: "Cleared by a doctor, not a guess." }).scrollIntoViewIfNeeded();
        await expect(page.getByText("Clinical notes stay with the medical team.", { exact: false })).toBeVisible();
    });

    test("shows the poster and the full content when WebGL is unavailable", async ({ page }) => {
        await page.addInitScript(() => {
            const original = HTMLCanvasElement.prototype.getContext;
            HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, contextId: string, ...args: unknown[]) {
                if (contextId.startsWith("webgl")) return null;
                return original.call(this, contextId as never, ...(args as []));
            } as typeof HTMLCanvasElement.prototype.getContext;
        });
        await page.goto("/");

        await expect(page.locator("canvas")).toHaveCount(0);
        await expect(page.getByTestId("fighter-poster")).toBeVisible();
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        await expect(page.getByRole("heading", { level: 2, name: "Progress you can prove." })).toBeAttached();
    });

    test("contains a WebGL initialization failure inside the stage", async ({ page, consoleErrors }) => {
        await page.addInitScript(() => {
            const original = HTMLCanvasElement.prototype.getContext;
            let webgl2Calls = 0;
            HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, contextId: string, ...args: unknown[]) {
                if (contextId === "webgl2" && webgl2Calls++ > 0) return null;
                return original.call(this, contextId as never, ...(args as []));
            } as typeof HTMLCanvasElement.prototype.getContext;
        });
        consoleErrors.allow(/WebGL|error boundary|THREE/i);
        await page.goto("/");

        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        await expect(page.getByTestId("fighter-poster")).toBeVisible();
        await expect(page.getByText("MMA-TMS is temporarily unavailable")).toHaveCount(0);
    });

    test("@mobile has no horizontal overflow and retains the primary journey", async ({ page }) => {
        await page.goto("/");

        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        await expect(page.getByRole("link", { name: "Enter the arena", exact: true }).first()).toBeVisible();
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow).toBeLessThanOrEqual(1);
    });
});
