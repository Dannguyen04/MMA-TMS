// UI smoke test: signs in as each role (demo buttons, or real accounts in API mode), opens every navigation page plus one detail page per
// route shape, and reports what a person would notice — HTTP 5xx, uncaught errors, console errors, an error screen,
// a missing h1 or a page wider than the screen. It asserts layout, not pixels: demo dates move with the clock, so
// screenshots (with --shots) are a gallery to compare by eye, not a golden set.
//
// Needs a running dev server in demo mode (e.g. `pnpm dev` with the demo .env.local). Exits 1 when a page has a problem.
//
//   pnpm --filter nextjs-frontend ui:smoke
//   pnpm --filter nextjs-frontend ui:smoke -- --base http://localhost:3100 --widths 390 --locale en --shots ../ui-shots
//   pnpm --filter nextjs-frontend ui:smoke -- --axe        # also WCAG 2.1 AA checks (serious and critical only)
//   pnpm --filter nextjs-frontend ui:smoke -- --theme dark  # light (default), dark or system
//   API mode: pass the accounts; each password is asked once on the terminal (hidden, never on the command line).
//   pnpm --filter nextjs-frontend ui:smoke -- --base http://localhost:3100 --coach-email … --fighter-email … --doctor-email … --admin-email …
//
// Every run also prints how long each page took to load, slowest first, to spot slow screens in API mode.

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { parseArgs } from "node:util";

import AxeBuilder from "@axe-core/playwright";
import { chromium } from "@playwright/test";

const { values: args } = parseArgs({
    // pnpm passes the `--` of `pnpm ui:smoke -- --base …` through to the script.
    args: process.argv.slice(2).filter((arg, index) => !(index === 0 && arg === "--")),
    options: {
        base: { type: "string", default: "http://localhost:3000" },
        widths: { type: "string", default: "1440,390" },
        locale: { type: "string", default: "vi" },
        theme: { type: "string", default: "light" },
        roles: { type: "string", default: "fighter,coach,doctor,admin" },
        shots: { type: "string" },
        "max-pages": { type: "string", default: "70" },
        axe: { type: "boolean", default: false },
        "fighter-email": { type: "string" },
        "coach-email": { type: "string" },
        "doctor-email": { type: "string" },
        "admin-email": { type: "string" },
    },
});

/** Demo sign-in buttons, matched by the person's name so the label's language doesn't matter. */
const DEMO_USERS = { fighter: "Minh", coach: "Rafael", doctor: "Thu", admin: "Nora" };
/** Noise from dev tooling and WebGL drivers, not from the app. */
const IGNORE = /Download the React DevTools|\[HMR\]|\[Fast Refresh\]|THREE\.Clock|Program object expected|X4122|found a shader name|willReadFrequently/;
const ERROR_SCREEN = /Đã xảy ra lỗi|Something went wrong|Application error|Unhandled Runtime Error/;

const base = args.base.replace(/\/$/, "");
const apiEmails = Object.fromEntries(["fighter", "coach", "doctor", "admin"].filter((role) => args[`${role}-email`]).map((role) => [role, args[`${role}-email`]]));
const apiMode = Object.keys(apiEmails).length > 0;
const passwords = new Map();

/** Asked once per email, typed hidden; never printed or kept outside this process. */
async function passwordFor(email) {
    if (passwords.has(email)) return passwords.get(email);
    const question = `Password for ${email}: `;
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = (text) => process.stdout.write(text.startsWith(question) ? question : text.replace(/[^\r\n]/g, "*"));
    const password = await new Promise((resolve) => rl.question(question, resolve));
    rl.close();
    process.stdout.write("\n");
    passwords.set(email, password);
    return password;
}
const widths = args.widths.split(",").map(Number);
const roles = args.roles.split(",");
const maxPages = Number(args["max-pages"]);

const browser = await chromium.launch();
const problems = [];
/** axe rule id → { impact, help, pages } */
const axeFindings = new Map();
let visited = 0;
/** Time to the load event per page (server render included, so API-mode reads show here). */
const timings = [];

for (const width of widths) {
    for (const role of roles) {
        const context = await browser.newContext({ viewport: { width, height: width < 640 ? 844 : 900 } });
        await context.addCookies([
            { name: "mma_locale", value: args.locale, url: base },
            { name: "mma_theme", value: args.theme, url: base },
        ]);
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
        if (apiMode) {
            const email = apiEmails[role];
            if (!email) {
                console.log(`no --${role}-email: ${role} skipped`);
                await context.close();
                continue;
            }
            await page.locator('input[name="email"]').fill(email);
            await page.locator('input[name="password"]').fill(await passwordFor(email));
            await page.locator('input[name="password"]').press("Enter");
        } else {
            await page.getByRole("button").filter({ hasText: DEMO_USERS[role] }).first().click();
        }
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
            const startedAt = Date.now();
            const response = await page.goto(base + href, { waitUntil: "load", timeout: 120_000 }).catch((error) => ({ status: () => `goto: ${error.message.slice(0, 80)}` }));
            timings.push({ ms: Date.now() - startedAt, where: `${role}@${width} ${href}` });
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

console.log(`ui:smoke ${args.locale} ${args.theme} ${widths.join("/")} px: ${visited} pages, ${problems.length} with problems`);
for (const problem of problems) console.log(JSON.stringify(problem));
if (timings.length > 0) {
    const sorted = [...timings].sort((a, b) => b.ms - a.ms);
    const median = sorted[Math.floor(sorted.length / 2)].ms;
    console.log(`page load: median ${median} ms, slowest ${sorted[0].ms} ms`);
    for (const { ms, where } of sorted.slice(0, 15)) console.log(`  ${String(ms).padStart(6)} ms  ${where}`);
}
if (args.axe) {
    console.log(`axe: ${axeFindings.size} serious/critical rules`);
    for (const [id, entry] of axeFindings) {
        console.log(`- ${id} [${entry.impact}] ${entry.help}: ${entry.pages.length} pages`);
        for (const where of entry.pages.slice(0, 8)) console.log(`    ${where}`);
    }
}
if (args.shots) writeFileSync(join(args.shots, `report-${args.locale}.json`), JSON.stringify({ visited, problems, timings }, null, 2));
process.exit(problems.length > 0 || axeFindings.size > 0 ? 1 : 0);
