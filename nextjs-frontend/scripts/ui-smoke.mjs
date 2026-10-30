// UI smoke test for demo mode: signs in as each demo role, opens every navigation page plus one detail page per
// route shape, and reports what a person would notice — HTTP 5xx, uncaught errors, console errors, an error screen,
// a missing h1 or a page wider than the screen. It asserts layout, not pixels: demo dates move with the clock, so
// screenshots (with --shots) are a gallery to compare by eye, not a golden set.
//
// Needs a running dev server in demo mode (e.g. `pnpm dev` with the demo .env.local). Exits 1 when a page has a problem.
//
//   pnpm --filter nextjs-frontend ui:smoke
//   pnpm --filter nextjs-frontend ui:smoke -- --base http://localhost:3100 --widths 390 --locale en --shots ../ui-shots
//   pnpm --filter nextjs-frontend ui:smoke -- --axe        # also WCAG 2.1 AA checks (serious and critical only)

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";

import AxeBuilder from "@axe-core/playwright";
import { chromium } from "@playwright/test";

const { values: args } = parseArgs({
    options: {
        base: { type: "string", default: "http://localhost:3000" },
        widths: { type: "string", default: "1440,390" },
        locale: { type: "string", default: "vi" },
        roles: { type: "string", default: "fighter,coach,doctor,admin" },
        shots: { type: "string" },
        "max-pages": { type: "string", default: "70" },
        axe: { type: "boolean", default: false },
    },
});

/** Demo sign-in buttons, matched by the person's name so the label's language doesn't matter. */
const DEMO_USERS = { fighter: "Minh", coach: "Rafael", doctor: "Thu", admin: "Nora" };
/** Noise from dev tooling and WebGL drivers, not from the app. */
const IGNORE = /Download the React DevTools|\[HMR\]|\[Fast Refresh\]|THREE\.Clock|Program object expected|X4122|found a shader name|willReadFrequently/;
const ERROR_SCREEN = /Đã xảy ra lỗi|Something went wrong|Application error|Unhandled Runtime Error/;

const base = args.base.replace(/\/$/, "");
const widths = args.widths.split(",").map(Number);
const roles = args.roles.split(",");
const maxPages = Number(args["max-pages"]);

const browser = await chromium.launch();
const problems = [];
/** axe rule id → { impact, help, pages } */
const axeFindings = new Map();
let visited = 0;

for (const width of widths) {
    for (const role of roles) {
        const context = await browser.newContext({ viewport: { width, height: width < 640 ? 844 : 900 } });
        await context.addCookies([{ name: "mma_locale", value: args.locale, url: base }]);
        const page = await context.newPage();
        let errors = [];
        page.on("console", (message) => {
            if (message.type() === "error" && !IGNORE.test(message.text())) errors.push(`console: ${message.text().slice(0, 200)}`);
        });
        page.on("pageerror", (error) => errors.push(`pageerror: ${error.message.slice(0, 200)}`));
        page.on("response", (response) => {
            if (response.status() >= 500) errors.push(`HTTP ${response.status()} ${response.url().slice(0, 120)}`);
        });

        await page.goto(`${base}/login`, { waitUntil: "load", timeout: 120_000 });
        await page.getByRole("button").filter({ hasText: DEMO_USERS[role] }).first().click();
        await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 120_000 });

        const queue = await page.evaluate(() => [
            ...new Set([...document.querySelectorAll("nav a[href^='/'], aside a[href^='/']")].map((link) => link.getAttribute("href"))),
        ]);
        const seen = new Set();
        const shapes = new Set();
        for (const href of queue) {
            if (!href || seen.has(href) || href.startsWith("/login") || href.includes("logout")) continue;
            if (seen.size >= maxPages) break;
            seen.add(href);
            errors = [];
            const response = await page.goto(base + href, { waitUntil: "load", timeout: 120_000 }).catch((error) => ({ status: () => `goto: ${error.message.slice(0, 80)}` }));
            await page.waitForTimeout(1000);
            const info = await page.evaluate((pattern) => ({
                errorScreen: new RegExp(pattern).test(document.querySelector("main")?.innerText ?? document.body.innerText),
                noH1: !document.querySelector("h1"),
                overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
                links: [...document.querySelectorAll("main a[href^='/']")].map((link) => link.getAttribute("href")),
            }), ERROR_SCREEN.source);
            visited++;
            const status = response?.status?.() ?? null;
            if (status !== 200 || info.errorScreen || info.noH1 || info.overflow || errors.length > 0) {
                problems.push({ width, role, href, status, errorScreen: info.errorScreen, noH1: info.noH1, overflow: info.overflow, errors: errors.slice(0, 4) });
            }
            if (args.axe) {
                const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).exclude("canvas").analyze();
                for (const violation of result.violations.filter((item) => item.impact === "serious" || item.impact === "critical")) {
                    const entry = axeFindings.get(violation.id) ?? { impact: violation.impact, help: violation.help, pages: [] };
                    entry.pages.push(`${role}@${width} ${href} (${violation.nodes.length}) ${violation.nodes[0]?.target.join(" ") ?? ""}`);
                    axeFindings.set(violation.id, entry);
                }
            }
            if (args.shots) {
                const dir = join(args.shots, `${args.locale}-${width}`, role);
                mkdirSync(dir, { recursive: true });
                const name = href.replace(/^\//, "").replace(/[/?=&]+/g, "_") || "home";
                await page.screenshot({ path: join(dir, `${name}.png`), fullPage: true });
            }
            // One detail page per route shape (ids replaced), so lists lead to their detail screens once.
            for (const link of info.links) {
                const shape = link.split("?")[0].replace(/\/[^/]*[0-9][^/]*/g, "/:id");
                if (!shapes.has(shape) && !seen.has(link) && !queue.includes(link)) {
                    shapes.add(shape);
                    queue.push(link);
                }
            }
        }
        await context.close();
    }
}
await browser.close();

console.log(`ui:smoke ${args.locale} ${widths.join("/")} px: ${visited} pages, ${problems.length} with problems`);
for (const problem of problems) console.log(JSON.stringify(problem));
if (args.axe) {
    console.log(`axe: ${axeFindings.size} serious/critical rules`);
    for (const [id, entry] of axeFindings) {
        console.log(`- ${id} [${entry.impact}] ${entry.help}: ${entry.pages.length} pages`);
        for (const where of entry.pages.slice(0, 8)) console.log(`    ${where}`);
    }
}
if (args.shots) writeFileSync(join(args.shots, `report-${args.locale}.json`), JSON.stringify({ visited, problems }, null, 2));
process.exit(problems.length > 0 || axeFindings.size > 0 ? 1 : 0);
