import { DASHBOARDS, expect, expectNotFound, expectPageReady, test, USERS } from "./fixtures";

/**
 * Distinctive clinical wording from the seeded medical records (src/lib/mocks/medical.ts): injury
 * descriptions, clearance reasons and the clinical audit details. None of it may reach an administrator.
 */
const CLINICAL_TEXT: RegExp[] = [
    /biceps femoris/i,
    /SCAT6/,
    /metacarpal/i,
    /impingement/i,
    /MCL sprain/i,
    /Diagnosis confirmed/i,
    /Suspected injury recorded/i,
    /Outcome: Fit/i,
    /Injury record/i,
    /Pre-camp physical satisfactory/i,
    /Level: (Cleared|Restricted|Not cleared)/i,
];

/** The clinical reason of Lucas Ferreira's current restricted clearance (cl-lucas-current). */
const LUCAS_CLEARANCE_REASON = "Recovering from a left hamstring strain and progressing well on the rehabilitation plan.";

test.describe("role separation", () => {
    for (const path of ["/admin/users", "/doctor/dashboard", "/coach/fighters"]) {
        test(`a fighter opening ${path} is sent to the fighter dashboard`, async ({ page, signInAs }) => {
            await signInAs("fighter");
            await page.goto(path);
            await expect(page).toHaveURL(DASHBOARDS.fighter);
            await expectPageReady(page, /, Minh$/);
        });
    }

    test("a coach opening a doctor page is sent to the coach dashboard", async ({ page, signInAs }) => {
        await signInAs("coach");
        await page.goto("/doctor/injuries");
        await expect(page).toHaveURL(DASHBOARDS.coach);
        await expectPageReady(page, /, Rafael$/);
    });
});

test.describe("record access", () => {
    // These pages stream behind a loading state, so the not-found UI arrives with a 200 status: assert the content.
    test("a coach can't open a fighter who isn't on their roster", async ({ page, signInAs }) => {
        await signInAs("coach");
        await page.goto("/coach/fighters/f-lucas-ferreira");
        await expectNotFound(page);
        await expect(page.getByRole("main").getByText("Lucas Ferreira")).toHaveCount(0);
    });

    test("a doctor can't open a fighter they aren't assigned to", async ({ page, signInAs }) => {
        await signInAs(USERS.samuelBrooks);
        await page.goto("/doctor/fighters/f-diego-alvarez");
        await expectNotFound(page);
        await expect(page.getByRole("main").getByText("Diego Alvarez")).toHaveCount(0);
    });
});

test.describe("clinical data stays with the medical team", () => {
    test("the audit log shows administrators clinical entries only as restricted placeholders", async ({ page, signInAs }) => {
        await signInAs("admin");
        await page.goto("/admin/audit-logs?actor=doctor");
        await expectPageReady(page, "Audit logs");

        const table = page.getByRole("table", { name: "Audit log entries" });
        await expect(table.getByText("Clinical record (restricted)").first()).toBeVisible();
        // Clinical resource types can't even be filtered on.
        const resourceTypes = page.getByRole("combobox", { name: "Resource types" });
        for (const option of ["Injury", "Examination", "Medical Clearance", "Treatment", "Recovery plan"]) {
            await expect(resourceTypes.getByRole("option", { name: option, exact: true })).toHaveCount(0);
        }

        // Expanding a restricted entry reveals only the neutral placeholder.
        await table.getByRole("row").filter({ hasText: "Clinical record (restricted)" }).first().getByRole("button", { name: /^Show details for/ }).click();
        await expect(table.getByText("Visible to the medical team only.").first()).toBeVisible();
        await expectNoClinicalText(page);

        // Search runs on the redacted entries, so clinical actions and record labels find nothing. (Words such
        // as "hamstring" can legitimately match coach-authored training plan titles.)
        for (const term of ["injury", "examination"]) {
            await page.goto(`/admin/audit-logs?q=${term}`);
            await expectPageReady(page, "Audit logs");
            await expect(page.getByRole("heading", { name: "0 matching entries", level: 2 })).toBeVisible();
        }
    });

    test("a doctor's account page shows administrators no clinical activity", async ({ page, signInAs }) => {
        await signInAs("admin");
        await page.goto(`/admin/users/${USERS.thuLe}`);
        await expectPageReady(page, "Dr. Thu Lê");
        await expectNoClinicalText(page);
    });

    test("a coach sees a fighter's restrictions but not the clinical reason for them", async ({ page, signInAs }) => {
        await signInAs(USERS.anna);
        await page.goto("/coach/medical-clearance");
        await expectPageReady(page, "Medical Clearance");

        const restricted = page.getByRole("region", { name: /^Restricted/ });
        const lucas = restricted.getByRole("listitem").filter({ has: page.getByRole("link", { name: "Lucas Ferreira" }) });
        await expect(lucas).toBeVisible();
        for (const restriction of ["No sparring", "No kicks", "Max session intensity RPE 7", "Protect left hamstring — no explosive hip extension"]) {
            await expect(lucas.getByText(restriction, { exact: true })).toBeVisible();
        }
        await expect(page.getByText(LUCAS_CLEARANCE_REASON)).toHaveCount(0);
        await expect(page.getByText(/rehabilitation plan/i)).toHaveCount(0);
    });
});

async function expectNoClinicalText(page: import("@playwright/test").Page) {
    const text = await page.locator("body").innerText();
    for (const pattern of CLINICAL_TEXT) {
        expect(text, `page text should not match ${pattern}`).not.toMatch(pattern);
    }
}
