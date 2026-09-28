import AxeBuilder from "@axe-core/playwright";

import { expect, expectPageReady, test } from "./fixtures";

/**
 * Colour contrast of the main screens in both themes, checked with axe (WCAG 2.1 AA). It guards the Fight Night
 * tokens: a token change that drops text below 4.5:1 (3:1 for large text) fails here, on every role's first screen.
 */
const SCREENS: { who: "fighter" | "coach" | "doctor" | "admin"; path: string; h1: string | RegExp }[] = [
    { who: "fighter", path: "/fighter/dashboard", h1: /^Good (morning|afternoon|evening), / },
    { who: "fighter", path: "/fighter/health", h1: "Health & Medical Clearance" },
    { who: "coach", path: "/coach/dashboard", h1: /^Good (morning|afternoon|evening), / },
    { who: "doctor", path: "/doctor/dashboard", h1: "Triage" },
    { who: "admin", path: "/admin/dashboard", h1: "Platform overview" },
];

for (const theme of ["light", "dark"] as const) {
    test.describe(`colour contrast (${theme})`, () => {
        for (const screen of SCREENS) {
            test(`${screen.path} meets WCAG AA contrast`, async ({ page, signInAs, setTheme }) => {
                await setTheme(theme);
                await signInAs(screen.who);
                await page.goto(screen.path);
                await expectPageReady(page, screen.h1);

                const results = await new AxeBuilder({ page }).withRules(["color-contrast"]).analyze();
                const failures = results.violations.flatMap((violation) =>
                    violation.nodes.map((node) => `${node.target.join(" ")}: ${node.failureSummary?.split("\n").slice(1).join(" ").trim()}`),
                );
                expect(failures, `Low-contrast text on ${screen.path} (${theme})`).toEqual([]);
            });
        }
    });
}
