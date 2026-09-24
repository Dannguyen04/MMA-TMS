import { expect, test } from "./fixtures";

test.describe("public landing", () => {
    test("leads a signed-out visitor to login without hiding the product story", async ({ page }) => {
        await page.goto("/");

        await expect(page.getByRole("heading", { level: 1 })).toContainText("Train harder");
        await expect(page.getByRole("link", { name: "Enter the arena", exact: true }).first()).toHaveAttribute("href", "/login");
        await expect(page.getByText("AI-assisted analysis", { exact: true })).toBeVisible();
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

    test("responds to fighter gestures without blocking normal page scrolling", async ({ page }) => {
        await page.goto("/");
        const fighter = page.getByRole("img", { name: /Interactive stylized MMA fighter/ });
        await expect(fighter).toBeVisible();

        await fighter.click();
        await expect(fighter).toHaveAttribute("data-fighter-action", "jab-cross");
        await page.waitForTimeout(1_050);

        const bounds = await fighter.boundingBox();
        expect(bounds).not.toBeNull();
        await page.mouse.move(bounds!.x + bounds!.width * 0.35, bounds!.y + bounds!.height * 0.55);
        await page.mouse.down();
        await page.mouse.move(bounds!.x + bounds!.width * 0.7, bounds!.y + bounds!.height * 0.55, { steps: 5 });
        await page.mouse.up();
        await expect(fighter).toHaveAttribute("data-fighter-action", "hook-right");

        await page.mouse.wheel(0, 900);
        await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
    });

    test("keeps content usable with reduced motion", async ({ page }) => {
        await page.emulateMedia({ reducedMotion: "reduce" });
        await page.goto("/");

        const fighter = page.getByRole("img", { name: /Interactive stylized MMA fighter/ });
        await fighter.click();
        await expect(fighter).toHaveAttribute("data-fighter-action", "idle");
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        await expect(page.getByRole("link", { name: "Enter the arena", exact: true }).first()).toBeVisible();
    });

    test("shows the decorative fallback when WebGL is unavailable", async ({ page }) => {
        await page.addInitScript(() => {
            const original = HTMLCanvasElement.prototype.getContext;
            HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, contextId: string, ...args: unknown[]) {
                if (contextId.startsWith("webgl")) return null;
                return original.call(this, contextId as never, ...(args as []));
            } as typeof HTMLCanvasElement.prototype.getContext;
        });
        await page.goto("/");

        await expect(page.locator("canvas")).toHaveCount(0);
        await expect(page.getByRole("img", { name: /Interactive stylized MMA fighter/ })).toBeVisible();
        await expect(page.getByText("AI-assisted analysis", { exact: true })).toBeVisible();
    });

    test("@mobile has no horizontal overflow and retains the primary journey", async ({ page }) => {
        await page.goto("/");

        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        await expect(page.getByRole("link", { name: "Enter the arena", exact: true }).first()).toBeVisible();
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow).toBeLessThanOrEqual(1);
    });
});
