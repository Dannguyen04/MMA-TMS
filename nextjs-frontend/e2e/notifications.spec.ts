import { expect, expectPageReady, test, uniqueSuffix, USERS } from "./fixtures";

test.describe("notifications", () => {
    test("the bell shows the unread count and mark all as read clears it", async ({ page, signInAs }) => {
        // Arrange: an administrator broadcasts to sports doctors, so Dr. Samuel Brooks has something
        // unread on every run, whatever earlier runs did to his notifications.
        const title = `E2E clinic notice ${uniqueSuffix()}`;
        await signInAs("admin");
        await page.goto("/admin/notifications");
        await expectPageReady(page, "Broadcasts");
        await page.getByRole("button", { name: "New broadcast" }).click();
        const composer = page.getByRole("dialog", { name: "New broadcast" });
        await composer.getByLabel("Title").fill(title);
        await composer.getByLabel("Message").fill("The recovery room is closed on Friday afternoon for maintenance.");
        await composer.getByRole("checkbox", { name: /^Sports doctors/ }).check();
        await composer.getByRole("button", { name: /^Send now/ }).click();
        const confirm = page.getByRole("alertdialog").or(page.getByRole("dialog", { name: /^Send to/ }));
        await confirm.getByRole("button", { name: "Send broadcast" }).click();
        await expect(composer).toBeHidden();
        // Broadcasts render as a table on wide screens and as cards on phones; check the visible one.
        await expect(page.getByRole("main").getByText(title).filter({ visible: true }).first()).toBeVisible();

        // The doctor's bell announces the unread count.
        await signInAs(USERS.samuelBrooks);
        await page.goto("/doctor/dashboard");
        await expectPageReady(page, "Clinical overview");
        const bell = page.getByRole("banner").getByRole("button", { name: /^Notifications, \d+ unread$/ });
        await expect(bell).toBeVisible();
        const label = (await bell.getAttribute("aria-label")) ?? "";
        const unread = Number(/(\d+) unread/.exec(label)?.[1]);
        expect(unread).toBeGreaterThan(0);
        await expect(bell).toHaveText(unread > 9 ? "9+" : String(unread));

        // The panel lists the new broadcast; mark all as read clears the badge.
        await bell.click();
        const panel = page.getByRole("dialog", { name: "Notifications" });
        await expect(panel.getByText(title)).toBeVisible();
        await panel.getByRole("button", { name: "Mark all read" }).click();
        const quietBell = page.getByRole("banner").getByRole("button", { name: "Notifications", exact: true });
        await expect(quietBell).toBeVisible();
        await expect(quietBell).toHaveText("");
        await expect(panel.getByRole("button", { name: "Mark all read" })).toBeDisabled();
        await expect(panel.getByText("Unread", { exact: true })).toHaveCount(0);

        // The notification center agrees.
        await panel.getByRole("link", { name: "View all notifications" }).click();
        await expect(page).toHaveURL("/notifications");
        await expectPageReady(page, "Notifications");
        await expect(page.getByRole("main").getByText("All caught up")).toBeVisible();
        await page.getByRole("navigation", { name: "Filter by read status" }).getByRole("link", { name: /^Unread/ }).click();
        await expect(page).toHaveURL(/status=unread/);
        await expect(page.getByText("You're all caught up")).toBeVisible();
        await expect(page.getByRole("button", { name: "Mark all as read" })).toBeDisabled();
    });
});
