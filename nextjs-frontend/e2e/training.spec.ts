import { academyClock, checkHidden, expect, expectPageReady, test, toast, uniqueSuffix, USERS } from "./fixtures";

/**
 * Coach training workflows. Every record is new and uniquely titled; seeded plans and sessions are only read.
 * Kenji Morita (restricted: protect right shoulder, max RPE 8) and Diego Alvarez (not cleared) are on
 * Rafael Costa's roster — see the storylines in src/lib/mocks/people.ts.
 */
test.describe("training", () => {
    test.beforeEach(async ({ signInAs }) => {
        await signInAs("coach");
    });

    test("a coach creates a training plan and lands on it", async ({ page }) => {
        const title = `E2E conditioning block ${uniqueSuffix()}`;
        await page.goto("/coach/training-plans/new");
        await expectPageReady(page, "New training plan");

        await page.getByRole("combobox", { name: "Fighter", exact: true }).selectOption({ label: "Emma Lindqvist" });
        await page.getByLabel("Plan title").fill(title);
        await page.getByLabel("Objective").fill("Build a steady aerobic base and sharpen the jab before the next camp.");
        await checkHidden(page.getByRole("group", { name: /^Focus areas/ }).getByRole("checkbox", { name: "Jab", exact: true }));
        await page.getByRole("button", { name: "Create plan" }).click();

        await expect(page).toHaveURL(/\/coach\/training-plans\/[^/]+$/);
        await expectPageReady(page, title);
    });

    test("scheduling for a fighter who isn't cleared is blocked", async ({ page }) => {
        await page.goto("/coach/sessions/new?fighter=f-diego-alvarez");
        await expectPageReady(page, "Schedule a session");
        await expect(page.getByRole("combobox", { name: "Fighter", exact: true })).toHaveValue("f-diego-alvarez");
        await page.getByLabel("Session title").fill(`E2E light drilling ${uniqueSuffix()}`);

        const check = page.getByRole("region", { name: "Clearance check" });
        await expect(check.getByText("Can't be scheduled as planned")).toBeVisible();
        await expect(check.getByRole("checkbox", { name: "I've reviewed these warnings" })).toHaveCount(0);
        await expect(page.getByRole("button", { name: "Schedule session" })).toBeDisabled();
        await expect(page.getByText("Resolve the blocking clearance conflicts to schedule this session.")).toBeVisible();
    });

    test("a clearance warning must be acknowledged before the session is scheduled", async ({ page }) => {
        const title = `E2E bag rounds ${uniqueSuffix()}`;
        await page.goto("/coach/sessions/new?fighter=f-kenji-morita");
        await expectPageReady(page, "Schedule a session");
        await page.getByLabel("Session title").fill(title);

        // Heavy bag power rounds load both shoulders; Kenji's clearance protects the right one.
        await page.getByLabel("Exercise library").selectOption({ label: "Heavy bag power rounds" });
        await page.getByRole("button", { name: "Add exercise" }).click();
        await expect(page.getByText("Touches a restriction")).toBeVisible();

        const check = page.getByRole("region", { name: "Clearance check" });
        await expect(check.getByText("Needs your judgement")).toBeVisible();
        const acknowledge = check.getByRole("checkbox", { name: "I've reviewed these warnings" });
        const submit = page.getByRole("button", { name: "Schedule session" });
        await expect(submit).toBeDisabled();
        await expect(page.getByText("Confirm you've reviewed the clearance warnings to continue.")).toBeVisible();

        await acknowledge.check();
        await expect(submit).toBeEnabled();
        await submit.click();

        await expect(page).toHaveURL(/\/coach\/sessions\/[^/]+$/);
        await expectPageReady(page, title);
        await expect(page.getByText("Medical Clearance restrictions apply to this session")).toBeVisible();
    });

    test("a coach records a result and feedback that the fighter then sees", async ({ page, signInAs }) => {
        const title = `E2E technical pads ${uniqueSuffix()}`;
        const summary = `Sharp entries off the jab; guard came home on most reps (${uniqueSuffix()}).`;
        const feedback = `Keep the rear hand glued to the cheek after every hook (${uniqueSuffix()}).`;

        // A result can only be recorded once a session has started, so schedule one for right now.
        const { date, time } = academyClock();
        await page.goto(`/coach/sessions/new?fighter=f-minh-tran`);
        await expectPageReady(page, "Schedule a session");
        await page.getByLabel("Session title").fill(title);
        await page.getByRole("textbox", { name: "Date", exact: true }).fill(date);
        await page.getByLabel("Start time").fill(time);
        await page.getByLabel("Duration (min)").fill("45");
        await expect(page.getByRole("region", { name: "Clearance check" }).getByText(/No conflicts with/)).toBeVisible();
        await page.getByRole("button", { name: "Schedule session" }).click();

        await expect(page).toHaveURL(/\/coach\/sessions\/[^/]+$/);
        await expectPageReady(page, title);
        const sessionId = new URL(page.url()).pathname.split("/").pop();

        // Record the result.
        await page.getByRole("button", { name: "Record result" }).click();
        const resultDialog = page.getByRole("dialog", { name: "Record session result" });
        await resultDialog.getByLabel("Actual duration (min)").fill("40");
        await checkHidden(resultDialog.getByRole("radio", { name: "4 of 5 · Strong" }));
        await resultDialog.getByLabel("Summary").fill(summary);
        await resultDialog.getByRole("button", { name: "Record result" }).click();
        await expect(resultDialog).toBeHidden();
        await expect(toast(page, "Result recorded. The session is now completed.")).toBeVisible();
        const resultCard = page.getByRole("main").getByText(summary);
        await expect(resultCard).toBeVisible();
        await expect(page.getByRole("button", { name: "Edit result" })).toBeVisible();

        // Share feedback.
        await page.getByRole("button", { name: "Add feedback" }).click();
        const feedbackDialog = page.getByRole("dialog", { name: "Add feedback" });
        await feedbackDialog.getByRole("radio", { name: /^Correction/ }).check();
        await feedbackDialog.getByLabel("Feedback").fill(feedback);
        await feedbackDialog.getByRole("button", { name: "Share feedback" }).click();
        await expect(feedbackDialog).toBeHidden();
        await expect(page.getByRole("main").getByText(feedback)).toBeVisible();

        // The fighter sees both on the session page.
        await signInAs(USERS.minh);
        await page.goto(`/fighter/training/sessions/${sessionId}`);
        await expectPageReady(page, title);
        await expect(page.getByRole("main").getByText(summary)).toBeVisible();
        await expect(page.getByRole("main").getByText(feedback)).toBeVisible();
    });
});
