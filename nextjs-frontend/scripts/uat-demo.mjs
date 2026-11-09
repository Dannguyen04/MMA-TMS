// UAT for the coach demo flow (docs/DEMO-API-MODE-SCRIPT.md) in demo mode: one fighter goes from a fight-camp plan to
// a scheduled bout, camp, fight week, official weigh-in, two recorded rounds, a KO loss, the post-bout report, the
// suspension it creates, Gate 2 on a sparring session and the clearance; then the fighter's own screens on a phone.
// Every step asserts what a person would see (status badge, toast, text) in the chosen language, with the words taken
// from the app's dictionaries (src/lib/i18n/messages), so a renamed label fails here instead of drifting.
//
// Needs a running dev server in demo mode (APP_DATA_MODE=demo). Runs on the real clock: the bout is set for today
// (weigh-in 08:00, bout at the later of now + 30 min and 22:00, academy time UTC+7), so it fails early when the day is
// too far gone to fit. Each run uses its own event name, so it can be run again on the same server without a restart;
// a fighter still holding an unfinished bout from an earlier run is reported as such. Where demo mode lacks what API
// mode provides (sample tactics on a new bout), the script supplies it through the UI and records a finding.
//
// Prints one line per step, `PASS|FAIL|SKIP <id> <title> (<ms> ms)` (SKIP: a step it needs failed), then the findings
// (app problems: what was expected, what was seen, screenshot) and notes. Exits 1 unless every step passed and no
// console error, uncaught page error or HTTP 5xx was seen. With --shots <dir>: run-<label>/NN-<step>.png and
// run-<label>/uat-summary.json under that directory.
//
//   pnpm --filter nextjs-frontend uat:demo
//   node scripts/uat-demo.mjs --base http://localhost:3000 --fighter "Minh Trần" --locale vi --shots ../uat-shots --run-label r1

import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

import { chromium } from "@playwright/test";

const { values: args } = parseArgs({
    // pnpm passes the `--` of `pnpm uat:demo -- --base …` through to the script.
    args: process.argv.slice(2).filter((arg, index) => !(index === 0 && arg === "--")),
    options: {
        base: { type: "string", default: "http://localhost:3000" },
        fighter: { type: "string", default: "Minh Trần" },
        locale: { type: "string", default: "vi" },
        shots: { type: "string" },
        "run-label": { type: "string" },
        headed: { type: "boolean", default: false },
        // API mode: sign the coach in with this email and the password in UAT_PASSWORD (never on the command line).
        email: { type: "string" },
        // API mode, optional: the fighter's and the doctor's accounts for steps F and D (passwords asked on the terminal).
        "fighter-email": { type: "string" },
        "doctor-email": { type: "string" },
        "admin-email": { type: "string" },
    },
});
const apiMode = Boolean(args.email);

const COACH = "Rafael Costa";
// The demo sports doctor (the sign-in button reads "BS. Thu Lê").
const DOCTOR = "Thu Lê";
const ADMIN = "Nora Whitfield";
const RULESET = "MMA – VMMAF 2021";
const OPPONENT = "Arman Petrosyan";
const WEIGH_IN_KG = "69,5";
const SUSPENSION_DAYS = 30;
/** Academy clock (UTC+7, no DST), the one the app schedules bouts on. */
const ACADEMY_OFFSET_MS = 7 * 3_600_000;
/** Noise from dev tooling and WebGL drivers, not from the app (same list as ui-smoke). */
const IGNORE = /Download the React DevTools|\[HMR\]|\[Fast Refresh\]|THREE\.Clock|Program object expected|X4122|found a shader name|willReadFrequently/;
const ERROR_SCREEN = /Đã xảy ra lỗi|Something went wrong|Application error|Unhandled Runtime Error/;
/** A sentence of English in a Vietnamese screen: service refusals that were never translated. */
const ENGLISH = /\b(the|This|That|Choose|already|can't|cannot|Finish|Only|first|is suspended|blocked)\b/;

const base = args.base.replace(/\/$/, "");
const fighterName = args.fighter;
const runLabel = args["run-label"] ?? academyNow().toISOString().slice(11, 19).replaceAll(":", "");
const eventName = `UAT ${runLabel}`;
const planTitle = `UAT ${runLabel} – ${fighterName}`;
const shotsDir = args.shots ? join(args.shots, `run-${runLabel.replace(/[^\w.-]+/g, "_")}`) : null;
if (shotsDir) mkdirSync(shotsDir, { recursive: true });

/* ─── Dictionary ──────────────────────────────────────────────────────────── */

const messagesDir = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "lib", "i18n", "messages");
const messages = loadMessages(args.locale);

/** Every `"key": "value"` pair of the locale's dictionary files (`vi.ts` and `*.vi.ts`). */
function loadMessages(locale) {
    const map = new Map();
    const files = readdirSync(messagesDir).filter((file) => file === `${locale}.ts` || file.endsWith(`.${locale}.ts`));
    if (files.length === 0) throw new Error(`No dictionary for locale "${locale}" in ${messagesDir}`);
    for (const file of files) {
        const source = readFileSync(join(messagesDir, file), "utf8");
        for (const match of source.matchAll(/"([\w.-]+)":\s*"((?:[^"\\]|\\.)*)"/g)) map.set(match[1], JSON.parse(`"${match[2]}"`));
    }
    return map;
}

/** The screen text for a dictionary key, with `{name}` placeholders filled in. */
function t(key, values = {}) {
    const text = messages.get(key);
    if (text === undefined) throw new Error(`Script bug: no message "${key}" in the ${args.locale} dictionary`);
    return text.replace(/\{(\w+)\}/g, (whole, name) => (name in values ? String(values[name]) : whole));
}

/** The fixed text before the first placeholder, for messages that carry data. */
const prefix = (key) => t(key).split("{")[0].trim();
const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/* ─── Clock ───────────────────────────────────────────────────────────────── */

/** Now as a Date whose UTC fields read the academy wall clock. */
function academyNow() {
    return new Date(Date.now() + ACADEMY_OFFSET_MS);
}

const pad = (n) => String(n).padStart(2, "0");
const todayKey = academyNow().toISOString().slice(0, 10);

/** Minutes after academy midnight, rounded up to five. */
function minutesFromNow(offsetMin) {
    const now = academyNow();
    const minutes = now.getUTCHours() * 60 + now.getUTCMinutes() + offsetMin;
    return Math.ceil(minutes / 5) * 5;
}

const hhmm = (minutes) => `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;

/* ─── Run state ───────────────────────────────────────────────────────────── */

const results = [];
const errors = [];
const findings = [];
const observations = [];
const hotReloads = [];
/** Errors from an attempt that a hot reload spoiled (reported, not counted). */
const setAside = [];
const ctx = { boutId: null, fighterId: null, tactics: [], weightClass: null, suspensionNote: `UAT clearance ${runLabel}` };
let currentStep = "setup";

function finding(what) {
    findings.push({ step: currentStep, ...what });
}

function observe(text) {
    observations.push({ step: currentStep, text });
}

const browser = await chromium.launch({ headless: !args.headed });

async function newPage(viewport) {
    const context = await browser.newContext({ viewport, locale: args.locale === "vi" ? "vi-VN" : "en-US" });
    await context.addCookies([
        { name: "mma_locale", value: args.locale, url: base },
        { name: "mma_theme", value: "light", url: base },
    ]);
    const page = await context.newPage();
    page.setDefaultTimeout(60_000);
    page.setDefaultNavigationTimeout(120_000);
    page.on("console", (message) => {
        // A code edit elsewhere makes the dev server hot-reload the page under the script; such a step is retried once.
        if (/\[Fast Refresh\] rebuilding/.test(message.text())) hotReloads.push({ step: currentStep, text: message.text().slice(0, 120) });
        // Hydration warnings carry the mismatching attribute at the end, so they are kept whole for the JSON.
        if (message.type() === "error" && !IGNORE.test(message.text())) errors.push({ step: currentStep, kind: "console", text: message.text().slice(0, 4000), url: page.url() });
    });
    page.on("pageerror", (error) => errors.push({ step: currentStep, kind: "pageerror", text: error.message.slice(0, 300), url: page.url() }));
    page.on("response", (response) => {
        if (response.status() >= 500) errors.push({ step: currentStep, kind: "http", text: `HTTP ${response.status()} ${response.url().slice(0, 160)}`, url: page.url() });
    });
    return page;
}

const typedPasswords = new Map();

/**
 * The password for an API-mode account: UAT_PASSWORD for the coach, otherwise asked once per email on the terminal with
 * the typing masked. It stays in this process only.
 */
async function passwordFor(email) {
    if (email === args.email && process.env.UAT_PASSWORD) return process.env.UAT_PASSWORD;
    if (typedPasswords.has(email)) return typedPasswords.get(email);
    const { createInterface } = await import("node:readline");
    const question = `Password for ${email}: `;
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = (text) => process.stdout.write(text.startsWith(question) ? question : text.replace(/[^\r\n]/g, "*"));
    const password = await new Promise((resolve) => rl.question(question, resolve));
    rl.close();
    process.stdout.write("\n");
    typedPasswords.set(email, password);
    return password;
}

const askedEmails = new Map();

/** Asks once on the terminal for a role's account email (Enter skips that role). */
async function askEmail(role) {
    if (askedEmails.has(role)) return askedEmails.get(role);
    const { createInterface } = await import("node:readline");
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    const answer = (await new Promise((resolve) => rl.question(`Email for the ${role} account (Enter to skip): `, resolve))).trim();
    rl.close();
    askedEmails.set(role, answer || null);
    return answer || null;
}

/** API-mode email per demo name: --email, --fighter-email, --doctor-email, --admin-email, or asked on the terminal. */
async function apiEmailFor(name) {
    if (name === COACH) return args.email;
    const role = name === DOCTOR ? "doctor" : name === ADMIN ? "admin" : "fighter";
    return args[`${role}-email`] ?? (process.stdin.isTTY ? askEmail(role) : null);
}

async function signIn(page, name) {
    await page.goto(`${base}/login`, { waitUntil: "load" });
    if (apiMode) {
        const email = await apiEmailFor(name);
        if (!email) return false;
        const password = await passwordFor(email);
        if (!password) throw new Error(`API mode needs the password for ${email}.`);
        await page.locator('input[name="email"]').fill(email);
        await page.locator('input[name="password"]').fill(password);
        await page.getByRole("button", { name: t("auth.submit"), exact: true }).click();
        await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 60_000 });
        return true;
    }
    const button = page.getByRole("button").filter({ hasText: name }).first();
    if ((await button.count()) === 0) return false;
    await button.click();
    await page.waitForURL((url) => !url.pathname.startsWith("/login"));
    return true;
}

/* ─── Assertions ──────────────────────────────────────────────────────────── */

class AppProblem extends Error {}

/** Opens a page, waits for its streamed content (the h1 replaces the loading skeleton), fails on non-200 or an error screen. */
async function open(page, path) {
    const response = await page.goto(base + path, { waitUntil: "load" });
    if (response && response.status() !== 200) throw new AppProblem(`${path} answered HTTP ${response.status()}`);
    // Streamed pages show a skeleton first; wait for the h1 or an error screen, whichever comes first.
    const deadline = Date.now() + 90_000;
    while (Date.now() < deadline) {
        if (await visible(page.locator("main h1"))) break;
        if (ERROR_SCREEN.test(await page.evaluate(() => document.body.innerText).catch(() => ""))) break;
        await page.waitForTimeout(200);
    }
    await assertNoErrorScreen(page);
    await hydrated(page);
    await assertNoErrorScreen(page);
}

/**
 * Waits until React has hydrated the page (its nodes carry `__reactFiber$…`). Clicking before that is lost, and a
 * screenshot taken before it (which hides the caret with an inline style) shows up as a hydration mismatch.
 */
async function hydrated(page) {
    await page
        .waitForFunction(() => {
            const node = document.querySelector("main h1") ?? document.querySelector("main");
            return node !== null && Object.keys(node).some((key) => key.startsWith("__reactFiber$"));
        }, null, { timeout: 60_000, polling: 100 })
        .catch(() => {});
}

/** A full-page screenshot that leaves the DOM alone (no caret-hiding inline styles). */
async function shoot(target, path) {
    await target.screenshot({ path, fullPage: true, caret: "initial" });
}

/** Records a finding (not a failure) when Vietnamese screen text holds an English sentence. */
async function englishCheck(locator, where) {
    if (args.locale !== "vi") return;
    const texts = await locator.allInnerTexts().catch(() => []);
    const english = texts.map((text) => text.trim()).filter((text) => text && ENGLISH.test(text) && !/[ăâđêôơưàáảãạèéẻẽẹìíỉĩịòóỏõọùúủũụỳýỷỹỵ]/i.test(text));
    if (english.length > 0) finding({ url: locator.page().url(), expected: `Vietnamese text in ${where}`, saw: `English: "${english.join(" | ").slice(0, 200)}"`, severity: "minor" });
}

async function assertNoErrorScreen(page) {
    const text = await mainText(page);
    if (ERROR_SCREEN.test(text)) throw new AppProblem(`error screen on ${page.url()}: ${text.slice(0, 200).replace(/\s+/g, " ")}`);
}

async function mainText(page) {
    return page.evaluate(() => (document.querySelector("main") ?? document.body).innerText);
}

/** Visible alert texts, without Next's route announcer. */
async function alertTexts(page) {
    return page.evaluate(() =>
        [...document.querySelectorAll('[role="alert"]')]
            .filter((node) => node.id !== "__next-route-announcer__" && node.getClientRects().length > 0)
            .map((node) => node.innerText.trim())
            .filter(Boolean),
    );
}

/**
 * Runs `act` (a click that sends a server action) and waits until `done()` is true, polling every 200 ms. A new alert
 * (refusal, field error), an error screen or a timeout fails with what the screen said.
 */
async function settle(page, act, done, { what, timeout = 60_000 } = {}) {
    const before = new Set(await alertTexts(page));
    await act();
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
        if (await done().catch(() => false)) return;
        const fresh = (await alertTexts(page).catch(() => [])).filter((text) => !before.has(text));
        if (fresh.length > 0) {
            const text = fresh.join(" | ").replace(/\s+/g, " ").slice(0, 400);
            if (args.locale === "vi" && ENGLISH.test(text)) finding({ url: page.url(), expected: `${what}, or a Vietnamese refusal`, saw: `English text: "${text}"` });
            throw new AppProblem(`${what}: the app refused: "${text}"`);
        }
        const text = await mainText(page).catch(() => "");
        if (ERROR_SCREEN.test(text)) throw new AppProblem(`${what}: error screen on ${page.url()}`);
        await page.waitForTimeout(200);
    }
    throw new AppProblem(`${what}: nothing confirmed it within ${timeout / 1000} s (${page.url()})`);
}

const visible = (locator) => locator.first().isVisible();
/** A toast (role=status) with this text. */
const toast = (page, text) => page.getByRole("status").filter({ hasText: text });

/** The bout's phase badge in the page header. */
async function phase(page) {
    const labels = ["SCHEDULED", "CAMP", "FIGHT_WEEK", "WEIGHED_IN", "COMPLETED", "CANCELLED"].map((key) => [key, t(`boutLabel.phase.${key}`)]);
    const text = await page.evaluate(() => document.querySelector('header[data-ui="page-header"]')?.innerText ?? "");
    const lines = text.split("\n").map((line) => line.trim());
    return labels.find(([, label]) => lines.includes(label))?.[0] ?? null;
}

async function expectPhase(page, expected, what) {
    const deadline = Date.now() + 30_000;
    let seen = null;
    while (Date.now() < deadline) {
        seen = await phase(page);
        if (seen === expected) return;
        await page.waitForTimeout(250);
    }
    throw new AppProblem(`${what}: expected status "${t(`boutLabel.phase.${expected}`)}", saw "${seen ? t(`boutLabel.phase.${seen}`) : "no status badge"}"`);
}

async function expectText(locator, what, timeout = 15_000) {
    try {
        await locator.first().waitFor({ state: "visible", timeout });
    } catch {
        throw new AppProblem(`expected ${what}`);
    }
}

/** Picks the option whose text matches, returning its value. */
async function selectByText(select, pattern, what) {
    const options = await select.locator("option").evaluateAll((nodes) => nodes.map((node) => ({ value: node.value, text: node.textContent.trim() })));
    const option = options.find((item) => (typeof pattern === "string" ? item.text === pattern : pattern.test(item.text)));
    if (!option) throw new AppProblem(`${what}: no option ${pattern} among ${options.map((item) => item.text).join(" / ")}`);
    await select.selectOption(option.value);
    return option;
}

/**
 * The rounds screen on a 390 px phone (T-037 B): no sideways scroll and no tap target in main under 44 px. Notes how
 * many screens the "Hiệp sau" block and the open round take, and saves a screenshot when --shots is given.
 */
async function phoneCheck(page, when, name) {
    const size = page.viewportSize();
    await page.setViewportSize({ width: 390, height: 844 });
    try {
        await page.waitForTimeout(400);
        const m = await page.evaluate(() => {
            const main = document.querySelector("main");
            const targets = [...main.querySelectorAll('button, a[href], input:not([type="hidden"]), select, textarea, [role="button"]')];
            const small = targets
                .filter((node) => {
                    const box = node.getBoundingClientRect();
                    return box.width > 0 && box.height > 0 && box.height < 44;
                })
                .map((node) => `${node.tagName.toLowerCase()} "${(node.innerText || node.getAttribute("aria-label") || node.getAttribute("name") || "").trim().slice(0, 40)}" ${Math.round(node.getBoundingClientRect().height)}px`);
            const forms = [...document.querySelectorAll('form[id^="round-form-"]')].filter((form) => form.getClientRects().length > 0);
            const open = forms.find((form) => !form.closest('[id$="-edit"]'));
            const plan = document.querySelector('form[id^="next-round-"]');
            const tops = [plan, open].filter(Boolean).map((node) => node.getBoundingClientRect().top);
            const top = tops.length > 0 ? Math.min(...tops) : 0;
            const bottom = open ? open.getBoundingClientRect().bottom : top;
            return { scrollWidth: document.documentElement.scrollWidth, small, screens: (bottom - top) / window.innerHeight };
        });
        observe(`390 px ${when}: "Hiệp sau" + open round span ${m.screens.toFixed(2)} screens; ${m.small.length} tap targets under 44 px; page width ${m.scrollWidth}px`);
        if (shotsDir) await shoot(page, join(shotsDir, `${name}.png`));
        if (m.scrollWidth > 390) throw new AppProblem(`390 px ${when}: the page scrolls sideways (${m.scrollWidth}px wide)`);
        if (m.small.length > 0) throw new AppProblem(`390 px ${when}: tap targets under 44 px in main: ${m.small.slice(0, 8).join("; ")}`);
    } finally {
        if (size) await page.setViewportSize(size);
    }
}

/* ─── Steps ───────────────────────────────────────────────────────────────── */

const page = await newPage({ width: 1440, height: 900 });
const boutPath = () => `/coach/bouts/${ctx.boutId}`;

const steps = [
    {
        id: "0",
        title: "Fight-camp plan",
        async run() {
            if (!(await signIn(page, COACH))) throw new AppProblem(`no demo sign-in button for ${COACH}`);
            await open(page, "/coach/training-plans/new");
            await page.getByRole("button").filter({ hasText: t("screens.training.template.fight_camp.label") }).first().click();
            const next = page.getByRole("button", { name: t("screens.training.formSteps.next"), exact: true });
            const submit = page.getByRole("button", { name: t("training.planForm.submitCreate"), exact: true });
            // The step list marks the current step with aria-current="step".
            const stepOf = (n) => page.locator(`nav[aria-label="${t("screens.training.formSteps.nav")}"] li:nth-child(${n})[aria-current="step"]`);
            // Step 2: the basics.
            await next.click();
            await expectText(stepOf(2), "step 2 of the plan form");
            await page.locator('select[name="fighterId"]').selectOption({ label: fighterName });
            ctx.fighterId = await page.locator('select[name="fighterId"]').inputValue();
            await page.locator('input[name="title"]').fill(planTitle);
            const phaseRadio = page.locator('input[name="phase"][value="fight_camp"]');
            if (!(await phaseRadio.isChecked())) throw new AppProblem(`the Fight camp template did not set the phase to fight_camp`);
            await englishCheck(page.locator("fieldset").filter({ has: phaseRadio }).locator("p"), "the phase hint on the plan form");
            const focus = page.locator('input[name="focusAreas"]');
            if ((await focus.count()) > 0 && (await page.locator('input[name="focusAreas"]:checked').count()) === 0) {
                await page.locator('label:has(input[name="focusAreas"]:not([disabled]))').first().click();
            }
            // Steps 3 (exercises) and 4 (review).
            for (let n = 3; n <= 4 && !(await visible(submit)); n++) {
                await next.click();
                await expectText(stepOf(n), `step ${n} of the plan form`);
            }
            await settle(page, () => submit.click(), async () => !new URL(page.url()).pathname.endsWith("/new"), { what: "saving the plan" });
            await expectText(page.locator("main").getByText(planTitle, { exact: true }), `the plan page to show "${planTitle}"`);
        },
    },
    {
        id: "A1",
        title: "Create bout",
        needs: [],
        async run() {
            const boutMinutes = Math.max(minutesFromNow(30), 22 * 60);
            if (boutMinutes > 23 * 60 + 55) {
                throw new Error(`too late in the day: the bout must be later than now + 30 min and still today (academy time ${academyNow().toISOString().slice(11, 16)}); run before 23:25 UTC+7`);
            }
            const boutTime = hhmm(boutMinutes);
            ctx.boutTime = boutTime;
            await open(page, "/coach/bouts/new");
            await page.locator('select[name="fighterId"]').selectOption({ label: fighterName });
            ctx.fighterId ??= await page.locator('select[name="fighterId"]').inputValue();
            await page.locator('select[name="rulesetId"]').selectOption({ label: RULESET });
            const weightClass = page.locator('select[name="weightClassCode"]');
            await expectText(weightClass.locator("option", { hasText: /^70 kg$/ }).or(weightClass.locator("option", { hasText: /^77 kg$/ })), "the VMMAF weight classes", 15_000).catch(() => {});
            ctx.weightClass = (await selectByText(weightClass, /^70\s?kg$/, "weight class").catch(() => selectByText(weightClass, /^77\s?kg$/, "weight class"))).text;
            await page.locator('input[name="event"]').fill(eventName);
            await page.locator('input[name="opponent"]').fill(OPPONENT);
            await page.locator('select[name="scheduledRounds"]').selectOption("3");
            await page.locator('input[name="weighInAt"]').fill(`${todayKey}T08:00`);
            await page.locator('input[name="boutAt"]').fill(`${todayKey}T${boutTime}`);
            // The weight-check preview: at risk at 70 kg means the doc's fallback, 77 kg.
            const preview = page.getByRole("status").filter({ hasText: t("feasibility.title") });
            await preview.first().waitFor({ state: "visible", timeout: 10_000 }).catch(() => observe("the weight-check preview did not appear within 10 s"));
            if (ctx.weightClass.startsWith("70") && (await preview.filter({ hasText: prefix("feasibility.OVER_LIMIT") }).count()) > 0) {
                ctx.weightClass = (await selectByText(weightClass, /^77\s?kg$/, "weight class")).text;
                observe("70 kg was over the limit in the weight-check preview; switched to 77 kg");
            }
            const submit = page.getByRole("button", { name: t("coachBouts.form.submit"), exact: true });
            await settle(page, () => submit.click(), async () => /^\/coach\/bouts\/(?!new\b)[^/]+$/.test(new URL(page.url()).pathname), { what: "creating the bout" });
            ctx.boutId = new URL(page.url()).pathname.split("/").pop();
            const title = (await page.locator("main h1").first().innerText()).trim();
            if (title !== eventName) throw new AppProblem(`the new bout page is titled "${title}", expected "${eventName}"`);
            if (new URL(page.url()).searchParams.get("notice") === "created-suspended") observe(`created with the "${t("boutDetail.notice.createdSuspended")}" notice`);
            await expectPhase(page, "SCHEDULED", "new bout");
            // The bout is found again by its event name in the bout list.
            await open(page, "/coach/bouts");
            // Table rows (desktop) name the event under the fighter's link; the phone list puts both in one link.
            const listed = page.locator("main tr, main a[href^='/coach/bouts/']").filter({ has: page.getByText(eventName, { exact: true }) });
            await expectText(listed.filter({ visible: true }), `a row "${eventName}" in the bout list`, 30_000);
            const links = await listed.evaluateAll((nodes) => [
                ...new Set(nodes.map((node) => (node.matches("a") ? node : node.querySelector("a[href]"))?.getAttribute("href")).filter(Boolean)),
            ]);
            if (!links.some((href) => href.endsWith(`/${ctx.boutId}`))) throw new AppProblem(`the bout list has no row "${eventName}" leading to ${ctx.boutId}`);
            if (links.length > 1) observe(`${links.length} bouts named "${eventName}" in the list`);
        },
    },
    {
        id: "A2",
        title: "Link camp plan",
        needs: ["0", "A1"],
        async run() {
            await open(page, boutPath());
            const noPlans = page.getByText(t("boutDetail.link.noPlans", { name: fighterName }));
            if (await visible(noPlans)) throw new AppProblem(`the bout offers no fight-camp plan for ${fighterName}`);
            await page.getByRole("button", { name: t("boutDetail.link.button"), exact: true }).click();
            const dialog = page.getByRole("dialog");
            await selectByText(dialog.locator('select[name="trainingPlanId"]'), new RegExp(`^${escapeRegExp(planTitle)} \\(`), "camp plan");
            try {
                await settle(page, () => dialog.getByRole("button", { name: t("boutDetail.link.submit"), exact: true }).click(), () => visible(toast(page, t("boutMsg.action.campStarted"))), { what: "linking the camp" });
            } catch (error) {
                if (/already has a bout|đã có trận|Finish or cancel/i.test(error.message)) {
                    throw new AppProblem(`${fighterName} cannot start a new camp: an earlier bout (likely from a previous UAT run) is still unfinished. ${error.message}`);
                }
                throw error;
            }
            await expectPhase(page, "CAMP", "after linking the camp");
            await expectText(page.locator("main a").filter({ hasText: planTitle }), `the camp plan link "${planTitle}"`);
        },
    },
    {
        id: "A3",
        title: "Meal plan",
        needs: ["A2"],
        async run() {
            const camp = `Cơm, thịt nạc, rau. Cắt tinh bột sau 18h. (${runLabel})`;
            const fightWeek = "Giảm nước từ D−2. Không sauna nếu chóng mặt.";
            await page.locator('textarea[name="camp"]').fill(camp);
            await page.locator('textarea[name="fightWeek"]').fill(fightWeek);
            await settle(
                page,
                () => page.getByRole("button", { name: t("boutFighter.plan.save"), exact: true }).click(),
                async () => new URL(page.url()).searchParams.get("notice") === "plan" || (await visible(toast(page, t("boutDetail.notice.planSaved")))),
                { what: "saving the meal plan" },
            );
            await open(page, boutPath());
            const saved = await page.locator('textarea[name="camp"]').inputValue();
            if (saved !== camp) throw new AppProblem(`after reload the camp meal plan reads "${saved}"`);
        },
    },
    {
        id: "A4",
        title: "Enter fight week (Gate 1)",
        needs: ["A2"],
        async run() {
            await open(page, boutPath());
            await settle(page, () => page.getByRole("button", { name: t("boutDetail.fightWeek.submit"), exact: true }).click(), async () => (await phase(page)) === "FIGHT_WEEK", {
                what: "entering fight week",
            });
            await expectPhase(page, "FIGHT_WEEK", "after Gate 1");
        },
    },
    {
        id: "A5",
        title: "Official weigh-in 69,5 kg",
        needs: ["A4"],
        async run() {
            await page.getByRole("button", { name: t("boutDetail.weighIn.button"), exact: true }).click();
            const dialog = page.getByRole("dialog");
            await dialog.locator('input[name="weightKg"]').fill(WEIGH_IN_KG);
            await expectText(dialog.getByText(t("boutDetail.weighIn.made"), { exact: true }), `"${t("boutDetail.weighIn.made")}" under the weight`);
            await settle(page, () => dialog.getByRole("button", { name: t("boutDetail.weighIn.submit"), exact: true }).click(), () => visible(toast(page, t("boutMsg.action.madeWeight"))), {
                what: "recording the weigh-in",
            });
            await expectPhase(page, "WEIGHED_IN", "after the weigh-in");
        },
    },
    {
        id: "A6",
        title: "Opponent analysis has 2+ tactics",
        needs: ["A1"],
        async run() {
            // API mode attaches four sample tactics to a new bout (docs/DEMO-API-MODE-SCRIPT.md, B2); without tactics the
            // rounds have nothing to mark and the report nothing to judge. Demo mode is checked for the same, and when it
            // has none the coach writes two here (one observation as their basis) so the rest of the flow can run.
            await open(page, `${boutPath()}/opponent-analysis`);
            const existing = await page.locator('textarea[name^="tactics."], li[id^="tac-"]').count();
            if (existing >= 2) return;
            finding({
                url: page.url(),
                expected: "a new bout to come with sample tactics, as in API mode (doc §B2: 4 sample tactics)",
                saw: `the opponent analysis of a new demo bout has ${existing} tactics; corner card says "${t("boutAnalysis.cornerCard.noAnalysisYet")}"`,
                severity: "parity",
            });
            observe("demo bout had no tactics; the script wrote 1 observation and 2 tactics on the opponent-analysis page");
            const observations = await page.locator('li[id^="obs-"]').count();
            await page.getByRole("button", { name: t("boutAnalysis.analysis.addObservation"), exact: true }).click();
            const observationText = `Hạ tay phải sau cú jab (UAT ${runLabel})`;
            await page.locator(`textarea[name="observations.${observations}.text"]`).fill(observationText);
            await page.locator(`input[name="observations.${observations}.evidenceNote"]`).fill("Băng trận gần nhất, hiệp 1");
            const tactics = [`Móc trái khi đối thủ ra jab (UAT ${runLabel})`, `Ép lưới vật ôm hiệp đầu (UAT ${runLabel})`];
            for (const [offset, text] of tactics.entries()) {
                const index = existing + offset;
                await page.getByRole("button", { name: t("boutAnalysis.analysis.addTactic"), exact: true }).click();
                const editor = page.locator("fieldset").filter({ has: page.locator(`textarea[name="tactics.${index}.text"]`) }).first();
                await page.locator(`textarea[name="tactics.${index}.text"]`).fill(text);
                const basis = editor.getByRole("button").filter({ hasText: observationText }).first();
                if ((await basis.getAttribute("aria-pressed")) !== "true") await basis.click();
            }
            await settle(page, () => page.getByRole("button", { name: t("boutAnalysis.analysis.save"), exact: true }).click(), () => visible(toast(page, t("boutAnalysis.analysis.action.saved"))), {
                what: "saving the opponent analysis",
            });
            await open(page, `${boutPath()}/opponent-analysis`);
            for (const text of tactics) await expectText(page.locator("main").getByText(text), `the tactic "${text}" after saving`);
        },
    },
    {
        id: "B1",
        title: "Record rounds 1 and 2",
        needs: ["A5", "A6"],
        async run() {
            await open(page, `${boutPath()}/rounds`);
            await phoneCheck(page, "before recording", "B1-390-before");
            for (const roundNo of [1, 2]) {
                // Between-round mode (T-037 B): only the round being recorded is open, with four taps by default.
                const form = page.locator(`form#round-form-${roundNo}`);
                await expectText(form, `round ${roundNo} open for recording (form#round-form-${roundNo})`);
                const press = async (button) => {
                    if ((await button.getAttribute("aria-pressed")) !== "true") await button.click();
                    if ((await button.getAttribute("aria-pressed")) !== "true") throw new AppProblem(`round ${roundNo}: "${await button.innerText()}" did not stay selected`);
                };
                const effective = form.getByRole("button", { name: t("boutAnalysis.rounds.tacticMark.EFFECTIVE"), exact: true });
                const fatigued = form.getByRole("button", { name: t("boutAnalysis.rounds.fatigued"), exact: true });
                const quick = await effective.count();
                if (quick < 1 || quick > 2) throw new AppProblem(`round ${roundNo}: ${quick} tactics shown by default, expected 2`);
                if (await visible(fatigued)) throw new AppProblem(`round ${roundNo}: "${t("boutAnalysis.rounds.fatigued")}" shows before "${t("boutAnalysis.rounds.recordMore")}"`);
                await press(form.getByRole("button", { name: t("boutAnalysis.rounds.selfScore.LOSS"), exact: true }));
                // Condition and knockdowns sit behind "Ghi thêm", which also lists the other tactics.
                const more = form.getByRole("button", { name: t("boutAnalysis.rounds.recordMore") });
                if ((await more.getAttribute("aria-expanded")) !== "true") await more.click();
                await form.locator('input[name="knockdownsAgainst"]').fill("0");
                await press(fatigued);
                if (roundNo === 1) {
                    // The first two tactics, as the default taps show them; round 2 marks the same two.
                    if ((await effective.count()) < 2) throw new AppProblem(`round 1: ${await effective.count()} tactics to mark, expected at least 2`);
                    ctx.tactics = await form.evaluate((node, label) => {
                        const rows = [...node.querySelectorAll("button")].filter((button) => button.textContent.trim() === label).map((button) => button.closest("div.rounded-lg"));
                        return rows.slice(0, 2).map((row) => row?.querySelector("p")?.textContent.trim() ?? "");
                    }, t("boutAnalysis.rounds.tacticMark.EFFECTIVE"));
                }
                const row = (text) => form.locator("div.rounded-lg").filter({ has: page.locator("p").getByText(text, { exact: true }) }).last();
                await press(row(ctx.tactics[0]).getByRole("button", { name: t("boutAnalysis.rounds.tacticMark.EFFECTIVE"), exact: true }));
                await press(row(ctx.tactics[1]).getByRole("button", { name: t("boutAnalysis.rounds.tacticMark.INEFFECTIVE"), exact: true }));
                // Saved, the round folds into one line under its heading: badge, "Thua hiệp", "Mệt" and an edit button.
                const card = page.locator('[data-ui="card"]').filter({ has: page.getByRole("heading", { name: t("boutAnalysis.rounds.roundTitle", { roundNo }), exact: true }) });
                const edit = card.getByRole("button", { name: t("boutAnalysis.rounds.editRound", { roundNo }), exact: true });
                await settle(
                    page,
                    () => form.getByRole("button", { name: t("boutAnalysis.rounds.saveRound", { roundNo }), exact: true }).click(),
                    () => visible(edit),
                    { what: `saving round ${roundNo}` },
                );
                await expectText(card.getByText(t("boutAnalysis.rounds.recordedBadge"), { exact: true }), `the "${t("boutAnalysis.rounds.recordedBadge")}" badge on round ${roundNo}`);
                const summary = (await card.innerText()).replace(/\s+/g, " ");
                for (const word of [t("boutAnalysis.rounds.selfScore.LOSS"), t("boutAnalysis.rounds.fatigued")]) {
                    if (!summary.includes(word)) throw new AppProblem(`round ${roundNo}: the summary line lacks "${word}": "${summary.slice(0, 200)}"`);
                }
                if (roundNo === 1) {
                    // Opening a recorded round shows its form again, saved with "Cập nhật hiệp 1".
                    await edit.click();
                    await expectText(card.getByRole("button", { name: t("boutAnalysis.rounds.updateRound", { roundNo }), exact: true }), `"${t("boutAnalysis.rounds.updateRound", { roundNo })}" after opening round 1`);
                    await card.getByRole("button", { name: t("boutAnalysis.rounds.closeEdit"), exact: true }).click();
                    await phoneCheck(page, "after round 1", "B1-390-round1");
                }
            }
            if (ctx.tactics.filter(Boolean).length < 2) throw new AppProblem(`could not read the tactic texts: ${JSON.stringify(ctx.tactics)}`);
        },
    },
    {
        id: "B2",
        title: "Corner card shows tactics",
        needs: ["A5", "A6"],
        async run() {
            await open(page, `${boutPath()}/corner-card`);
            for (const key of ["boutAnalysis.cornerCard.noAnalysisYet", "boutAnalysis.cornerCard.emptyTactics"]) {
                if (await visible(page.getByText(t(key)))) throw new AppProblem(`the corner card says "${t(key)}"`);
            }
            const first = ctx.tactics[0];
            if (first) await expectText(page.locator("main").getByText(first), `the tactic "${first}" on the corner card`);
            else observe("tactic texts unknown (B1 failed), only checked the card is not empty");
        },
    },
    {
        id: "C1",
        title: "Result: KO loss, round 2, 30-day suspension",
        needs: ["A5"],
        async run() {
            await open(page, boutPath());
            await page.getByRole("button", { name: t("boutDetail.result.button"), exact: true }).click();
            let dialog = page.getByRole("dialog");
            await dialog.locator('select[name="result"]').selectOption("LOSS");
            await dialog.locator('select[name="method"]').selectOption("KO");
            await dialog.locator('input[name="round"]').fill("2");
            await dialog.locator('select[name="lossOfConsciousness"]').selectOption("UNDER_1_MIN");
            const daysInResult = dialog.locator('input[name="suspensionDays"]');
            const asksDays = await visible(daysInResult);
            if (asksDays) await daysInResult.fill(String(SUSPENSION_DAYS));
            await settle(page, () => dialog.getByRole("button", { name: t("boutDetail.result.submit"), exact: true }).click(), () => visible(toast(page, t("boutMsg.action.resultRecorded"))), {
                what: "recording the result",
            });
            await expectPhase(page, "COMPLETED", "after the result");
            if (!asksDays) {
                // Demo mode asks for the suspension's length after the result, on the bout's suspension card.
                observe(`the result dialog has no suspension-days field; the KO suspension is confirmed with "${t("boutDetail.suspension.confirm")}"`);
                await page.getByRole("button", { name: t("boutDetail.suspension.confirm"), exact: true }).click();
                dialog = page.getByRole("dialog");
                await dialog.locator('input[name="days"]').fill(String(SUSPENSION_DAYS));
                const override = dialog.locator('textarea[name="overrideReason"]');
                if (await visible(override)) await override.fill(`UAT ${runLabel}: ${SUSPENSION_DAYS} ngày theo điều lệ giải`);
                const clearance = dialog.locator('input[name="requiresClearance"]');
                if (!(await clearance.isChecked())) throw new AppProblem("the KO suspension dialog does not require clearance by default");
                await settle(page, () => dialog.getByRole("button", { name: t("coachBouts.suspensionDialog.save"), exact: true }).click(), () => visible(toast(page, t("boutMsg.action.suspensionSaved"))), {
                    what: "saving the KO suspension",
                });
            }
            const card = page.locator("main").getByText(new RegExp(`^${escapeRegExp(t("boutLabel.suspensionReason.KO"))}:`));
            await expectText(card, `a "${t("boutLabel.suspensionReason.KO")}: …" line in the bout's suspension card`);
            const line = (await card.first().innerText()).replace(/\s+/g, " ");
            if (!line.includes(t("boutLabel.suspensionState.ACTIVE"))) throw new AppProblem(`the KO suspension line reads "${line}", expected "${t("boutLabel.suspensionState.ACTIVE")}"`);
        },
    },
    {
        id: "R",
        title: "Post-bout report",
        needs: ["B1", "C1"],
        async run() {
            await open(page, `${boutPath()}/report`);
            const main = page.locator("main");
            const resultLine = `${t("boutLabel.result.LOSS")} · ${t("boutLabel.method.KO")}, ${t("boutDetail.resultCard.round", { n: 2 })}`;
            await expectText(main.getByText(resultLine, { exact: true }), `the result line "${resultLine}"`);
            const points = main.locator("div").filter({ has: page.getByText(t("boutAnalysis.report.pointsTitle"), { exact: true }) }).filter({ has: page.locator("ul") }).last();
            await expectText(points, `the "${t("boutAnalysis.report.pointsTitle")}" card`);
            const ineffective = t("boutAnalysis.report.point.tacticIneffective", { tactic: ctx.tactics[1] });
            await expectText(points.getByText(ineffective, { exact: true }), `"${ineffective}" in ${t("boutAnalysis.report.pointsTitle")}`);
            const fatigue = t("boutAnalysis.report.point.fatigue", { round: 1 });
            await expectText(points.getByText(fatigue, { exact: true }), `"${fatigue}" in ${t("boutAnalysis.report.pointsTitle")}`);
            const form = page.locator("form#tactic-review");
            await expectText(form, "the tactic review form (form#tactic-review)");
            const rows = form.locator("li");
            const prefilled = t("boutAnalysis.report.prefilled");
            if ((await rows.filter({ hasText: prefilled }).count()) === 0) throw new AppProblem(`no tactic shows "${prefilled}"`);
            // Change the first tactic (Hiệu quả in both rounds) to Không hiệu quả, with a note.
            const row = rows.filter({ hasText: ctx.tactics[0] }).first();
            const note = `UAT note ${runLabel}`;
            await row.locator("select").selectOption("INEFFECTIVE");
            await row.locator("textarea").fill(note);
            // Saved = a confirmation, or the page refreshing to show the coach's verdict without "App điền sẵn".
            let confirmed = false;
            const reviewed = page.locator("form#tactic-review li").filter({ hasText: ctx.tactics[0] }).first();
            await settle(
                page,
                () => form.getByRole("button", { name: t("boutAnalysis.report.review.submit"), exact: true }).click(),
                async () => {
                    confirmed ||= (await visible(toast(page, t("boutAnalysis.report.review.saved")))) || (await visible(form.getByText(t("boutAnalysis.report.review.saved"))));
                    const badge = reviewed.locator("p + div").getByText(t("boutAnalysis.rounds.tacticMark.INEFFECTIVE"), { exact: true });
                    return confirmed || ((await visible(badge)) && !(await visible(reviewed.getByText(prefilled, { exact: true }))));
                },
                { what: "saving the tactic review" },
            );
            if (!confirmed) {
                // A last look: the confirmation may come right after the refresh.
                await page.waitForTimeout(500);
                confirmed = (await visible(toast(page, t("boutAnalysis.report.review.saved")))) || (await visible(form.getByText(t("boutAnalysis.report.review.saved"))));
            }
            if (!confirmed) {
                finding({
                    url: page.url(),
                    expected: `a confirmation such as "${t("boutAnalysis.report.review.saved")}" after "${t("boutAnalysis.report.review.submit")}"`,
                    saw: "the verdicts refresh silently; no toast or message (the success text exists in the dictionary but is never shown)",
                    severity: "minor",
                });
            }
            await page.reload({ waitUntil: "load" });
            await hydrated(page);
            await assertNoErrorScreen(page);
            const after = page.locator("form#tactic-review li").filter({ hasText: ctx.tactics[0] }).first();
            await expectText(after.locator("p + div").getByText(t("boutAnalysis.rounds.tacticMark.INEFFECTIVE"), { exact: true }), `the reviewed tactic to show "${t("boutAnalysis.rounds.tacticMark.INEFFECTIVE")}" after reload`);
            if (await visible(after.getByText(prefilled, { exact: true }))) throw new AppProblem(`the reviewed tactic still shows "${prefilled}" after reload`);
            const savedNote = await after.locator("textarea").inputValue();
            if (savedNote !== note) throw new AppProblem(`the review note reads "${savedNote}" after reload`);
        },
    },
    {
        id: "C2",
        title: "Suspensions list: KO row, 30 days, active",
        needs: ["C1"],
        async run() {
            await open(page, "/coach/bouts/suspensions");
            const row = suspensionRow();
            if ((await row.count()) === 0) {
                const fighterRows = await page.locator("main").locator("div.flex.flex-col.gap-4").filter({ hasText: fighterName }).allInnerTexts();
                throw new AppProblem(
                    `no row for ${fighterName} with reason ${t("boutLabel.suspensionReason.KO")} and event "${eventName}" (${fighterRows.length} rows for the fighter: ${fighterRows.map((text) => text.replace(/\s+/g, " ").slice(0, 120)).join(" | ") || "none"})`,
                );
            }
            const text = (await row.first().innerText()).replace(/\s+/g, " ");
            // The status badge reads "Đang đình chỉ · ngày 1/30".
            const active = t("suspension.status.ACTIVE_WITH_DAY", { elapsed: 1, total: SUSPENSION_DAYS });
            if (!text.includes(active)) {
                const days = text.match(new RegExp(`${escapeRegExp(prefix("suspension.status.ACTIVE_WITH_DAY"))}[^/]*/(\\d+)`))?.[1];
                throw new AppProblem(
                    days ? `the KO row spans ${days} days, expected ${SUSPENSION_DAYS}: "${text.slice(0, 200)}"` : `the KO row is not "${active}": "${text.slice(0, 200)}"`,
                );
            }
        },
    },
    {
        id: "C3",
        title: "Gate 2 refuses a sparring session",
        needs: ["C1"],
        async run() {
            const result = await trySparring("C3");
            if (result.saved) throw new AppProblem(`Gate 2 did not stop a sparring session for ${fighterName}: it was saved (${result.url})`);
            // Demo words it "<name> đang bị đình chỉ: …"; the API's refusal reads "Võ sĩ đang bị đình chỉ (KO): …". Both are Gate 2.
            if (!result.message.includes(gate2Lead()) && !/đang bị đình chỉ/.test(result.message)) {
                throw new AppProblem(`refused, but with "${result.message}" instead of a suspension refusal`);
            }
            observe(`${result.refusedUpFront ? "refused before saving (button disabled by the live check)" : "refused on save"}: "${result.message.slice(0, 200)}"`);
        },
    },
    {
        // T-049: only a suspension awaiting clearance (after its end date) can be cleared, in both modes. The KO just
        // recorded is still running, so it must NOT offer the action; clearing is shown on one that is waiting.
        id: "C4",
        title: "Clear to train (only once a suspension is awaiting clearance)",
        needs: ["C1"],
        async run() {
            await open(page, "/coach/bouts/suspensions");
            const clearAction = t("suspensions.row.clearAction");
            const ko = suspensionRow().first();
            if ((await ko.count()) === 0) throw new AppProblem(`no KO row for ${fighterName} / "${eventName}" on the suspensions page`);
            if (await visible(ko.getByRole("button", { name: clearAction, exact: true }))) {
                throw new AppProblem(`the running KO suspension offers "${clearAction}"; T-049 allows it only once the suspension awaits clearance`);
            }
            const waiting = page
                .locator("main div.flex.flex-col.gap-4")
                .filter({ hasText: t("suspension.status.AWAITING_CLEARANCE") })
                .filter({ has: page.getByRole("button", { name: clearAction, exact: true }) })
                .first();
            if ((await waiting.count()) === 0) {
                observe(`no suspension awaiting clearance left on this server (an earlier run cleared the seeded one); only the T-049 rule was checked`);
                return;
            }
            if (apiMode) {
                // Real data: clearing someone's suspension is the coach's call, not the script's.
                observe(`a suspension awaits clearance (${(await waiting.innerText()).replace(/\s+/g, " ").slice(0, 80)}); not cleared in API mode`);
                return;
            }
            const who = (await waiting.innerText()).replace(/\s+/g, " ").slice(0, 80);
            await waiting.getByRole("button", { name: clearAction, exact: true }).click();
            const dialog = page.getByRole("dialog");
            await dialog.locator("textarea").fill(ctx.suspensionNote);
            await settle(page, () => dialog.getByRole("button", { name: t("suspensions.clearDialog.confirm"), exact: true }).click(), () => visible(toast(page, t("suspensions.action.cleared"))), {
                what: "clearing the fighter awaiting clearance",
            });
            observe(`cleared the suspension awaiting clearance: "${who}"`);
        },
    },
    roleStep("F", "Fighter screens", fighterName, "fighter", [
        "/fighter/dashboard",
        "/fighter/bout",
        "/fighter/bout/weigh-in",
        "/fighter/training",
        "/fighter/schedule",
        "/fighter/health",
        "/fighter/health/history",
        "/fighter/performance",
        "/fighter/videos",
    ], [390, 1440]),
    roleStep("D", "Doctor screens", DOCTOR, "doctor", [
        "/doctor/dashboard",
        "/doctor/fighters",
        "/doctor/examinations",
        "/doctor/injuries",
        "/doctor/medical-clearance",
        "/doctor/recovery",
        "/doctor/review-requests",
        "/doctor/history",
        "/doctor/ai-alerts",
        { from: "/doctor/fighters", link: /^\/doctor\/fighters\/[^/]+$/ },
    ], [1440, 390]),
    roleStep("AD", "Admin screens", ADMIN, "admin", [
        "/admin/dashboard",
        "/admin/users",
        "/admin/roles",
        "/admin/admissions",
        "/admin/exercises",
        "/admin/notifications",
        "/admin/audit-logs",
        "/admin/settings",
        "/admin/ai-jobs",
        "/admin/ai-models",
        "/admin/videos",
        { from: "/admin/users", link: /^\/admin\/users\/[^/]+$/ },
    ], [1440, 390]),
];

/**
 * A role's own screens, read only: each page must answer 200, stream its h1, show no error screen and, at 390 px,
 * not be wider than the phone. `{ from, link }` opens the first detail link found on a list page. Skipped when the
 * role has no sign-in (no demo button, or no --fighter-email / --doctor-email / --admin-email in API mode).
 */
function roleStep(id, title, name, role, paths, widths) {
    return {
        id,
        title,
        needs: [],
        async run() {
            for (const width of widths) {
                const tab = await newPage({ width, height: width < 768 ? 844 : 900 });
                try {
                    if (!(await signIn(tab, name))) {
                        observe(`no sign-in for the ${role} (${name}); ${title.toLowerCase()} skipped`);
                        return "SKIP";
                    }
                    for (const entry of paths) {
                        let path = entry;
                        if (typeof entry === "object") {
                            await open(tab, entry.from);
                            const hrefs = await tab.locator("main a[href]").evaluateAll((links) => links.map((a) => a.getAttribute("href")));
                            path = hrefs.find((href) => entry.link.test(href ?? ""));
                            if (!path) {
                                observe(`${role}: no detail link on ${entry.from} at ${width} px`);
                                continue;
                            }
                        }
                        ctx.stepUrl = base + path;
                        ctx.stepShot = shotsDir ? join(shotsDir, `${id}-${width}-${path.replace(/^\//, "").replaceAll("/", "_")}.png`) : null;
                        try {
                            await open(tab, path);
                            const info = await tab.evaluate(() => ({ h1: Boolean(document.querySelector("h1")), overflow: document.documentElement.scrollWidth > window.innerWidth + 1 }));
                            if (!info.h1) throw new AppProblem(`${path} has no h1 at ${width} px`);
                            if (width < 768 && info.overflow) throw new AppProblem(`${path} is wider than the ${width} px screen`);
                        } finally {
                            if (ctx.stepShot) await shoot(tab, ctx.stepShot).catch(() => (ctx.stepShot = null));
                        }
                    }
                } finally {
                    await tab.context().close();
                }
            }
        },
    };
}

/** The fighter's KO row for this run's bout on the suspensions page. */
function suspensionRow() {
    return page
        .locator("main div.flex.flex-col.gap-4")
        .filter({ hasText: fighterName })
        .filter({ hasText: eventName })
        .filter({ has: page.getByText(t("boutLabel.suspensionReason.KO"), { exact: true }) });
}

/** The Gate 2 sentence for this fighter up to its details: "Minh Trần đang bị đình chỉ". */
const gate2Lead = () => t("training.gate2.suspended", { name: fighterName, type: "", until: "" }).split(":")[0];

/**
 * Tries to schedule a sparring session today for the fighter. Demo mode checks the clearance live while the form is
 * filled in (and refuses up front); API mode refuses on save. Returns whether it saved, what the live check said and
 * the refusal.
 */
async function trySparring(tag) {
    await open(page, "/coach/sessions/new");
    await page.locator('select[name="fighterId"]').selectOption({ label: fighterName });
    await page.locator('label:has(input[name="type"][value="sparring"])').first().click();
    await page.locator('input[name="date"]').fill(todayKey);
    await page.locator('input[name="time"]').fill(hhmm(Math.min(minutesFromNow(60), 23 * 60 + 55)));
    const title = page.locator('input[name="title"]');
    if (!(await title.inputValue()).trim()) await title.fill(`UAT ${runLabel} sparring ${tag}`);
    // The live check is debounced (350 ms) and then shows "Đang kiểm tra cấp phép y tế…" until it answers.
    const checking = page.getByText(t("training.clearanceCheck.checking"));
    const settledBy = Date.now() + 30_000;
    await page.waitForTimeout(600);
    while (Date.now() < settledBy && (await visible(checking))) await page.waitForTimeout(200);
    const lead = page.locator("main").getByText(gate2Lead());
    const preview = (await visible(lead)) ? (await lead.first().innerText()).replace(/\s+/g, " ").trim() : null;

    const submit = page.getByRole("button", { name: t("training.sessionForm.submitCreate"), exact: true });
    // While the live check holds a blocking conflict the form disables saving and says why under the button.
    if (await submit.isDisabled()) {
        const reason = (await page.locator("main").getByText(t("training.sessionForm.blockedResolve")).first().innerText().catch(() => "")).trim();
        return { saved: false, refusedUpFront: true, message: [preview, reason].filter(Boolean).join(" | "), preview };
    }
    const before = new Set(await alertTexts(page));
    await submit.click();
    const started = Date.now();
    while (Date.now() < started + 60_000) {
        const path = new URL(page.url()).pathname;
        if (!path.endsWith("/new")) return { saved: true, url: page.url(), preview };
        const fresh = (await alertTexts(page).catch(() => [])).filter((text) => !before.has(text));
        if (fresh.length > 0) {
            const message = fresh.join(" | ").replace(/\s+/g, " ");
            if (args.locale === "vi" && ENGLISH.test(message)) finding({ url: page.url(), expected: "a Vietnamese refusal", saw: `English text: "${message.slice(0, 300)}"` });
            return { saved: false, message, preview };
        }
        await page.waitForTimeout(200);
    }
    throw new AppProblem("saving the sparring session: no answer within 60 s");
}

/* ─── Runner ──────────────────────────────────────────────────────────────── */

console.log(`uat:demo ${base} · fighter ${fighterName} · ${args.locale} · run ${runLabel} · academy ${todayKey} ${academyNow().toISOString().slice(11, 16)}`);
const status = new Map();
let index = 0;
for (const step of steps) {
    index++;
    currentStep = step.id;
    const started = Date.now();
    const entry = { id: step.id, title: step.title, status: "PASS", ms: 0, url: null, error: null, shot: null };
    const blocked = (step.needs ?? (index > 1 ? [steps[index - 2].id] : [])).filter((id) => status.get(id) !== "PASS");
    const errorsBefore = errors.length;
    if (blocked.length > 0) {
        entry.status = "SKIP";
        entry.error = `needs ${blocked.join(", ")}`;
    } else {
        for (let attempt = 1; attempt <= 2; attempt++) {
            const reloadsBefore = hotReloads.length;
            const findingsBefore = findings.length;
            const errorsAtStart = errors.length;
            entry.status = "PASS";
            entry.error = null;
            try {
                const outcome = await step.run();
                if (outcome === "SKIP") entry.status = "SKIP";
            } catch (error) {
                entry.status = "FAIL";
                entry.error = error.message.split("\n")[0];
                entry.appProblem = error instanceof AppProblem;
            }
            // A hot reload (someone saving code while the dev server runs) pulls the page from under the script:
            // that attempt says nothing about the app, so it is run once more and its findings and errors set aside.
            if (entry.status !== "FAIL" || attempt === 2 || hotReloads.length === reloadsBefore) break;
            console.log(`RETRY ${step.id} ${step.title} — the dev server hot-reloaded the page during the step (${entry.error})`);
            entry.retried = entry.error;
            findings.splice(findingsBefore);
            setAside.push(...errors.splice(errorsAtStart));
        }
        entry.url = ctx.stepUrl ?? page.url();
        if (ctx.stepShot !== undefined) entry.shot = ctx.stepShot;
        else if (shotsDir) {
            entry.shot = join(shotsDir, `${pad(index)}-${step.id}.png`);
            await shoot(page, entry.shot).catch(() => (entry.shot = null));
        }
        delete ctx.stepUrl;
        delete ctx.stepShot;
        const stepErrors = errors.slice(errorsBefore);
        if (stepErrors.length > 0 && entry.status === "PASS") entry.note = `${stepErrors.length} console/page/HTTP error(s)`;
        if (entry.status === "FAIL" && entry.appProblem) finding({ url: entry.url, expected: step.title, saw: entry.error });
        for (const item of findings) if (item.step === step.id && !item.shot) item.shot = entry.shot;
    }
    entry.ms = Date.now() - started;
    status.set(step.id, entry.status);
    results.push(entry);
    console.log(`${entry.status} ${step.id} ${step.title} (${entry.ms} ms)${entry.error ? ` — ${entry.error}` : ""}${entry.note ? ` [${entry.note}]` : ""}`);
}
await browser.close();

for (const item of findings) console.log(`finding ${item.step}${item.severity ? ` (${item.severity})` : ""}: expected ${item.expected}; saw ${item.saw} — ${item.url}${item.shot ? ` [${item.shot}]` : ""}`);
for (const item of observations) console.log(`note ${item.step}: ${item.text}`);
for (const item of errors) console.log(`error ${item.step} ${item.kind}: ${item.text.replace(/\s+/g, " ").slice(0, 300)} (${item.url})`);
for (const item of setAside) console.log(`set aside (hot reload) ${item.step} ${item.kind}: ${item.text.replace(/\s+/g, " ").slice(0, 200)}`);
if (hotReloads.length > 0) console.log(`dev server hot reloads seen: ${hotReloads.length} (steps ${[...new Set(hotReloads.map((item) => item.step))].join(", ")})`);
const ok = results.every((entry) => entry.status === "PASS" || (entry.status === "SKIP" && entry.id === "F" && !entry.error)) && errors.length === 0;
const passed = results.filter((entry) => entry.status === "PASS").length;
console.log(`uat:demo run ${runLabel}: ${passed}/${results.length} steps passed, ${errors.length} console/page/HTTP errors, ${findings.length} findings → ${ok ? "OK" : "FAILED"}`);
if (shotsDir) {
    const summary = { runLabel, base, fighter: fighterName, locale: args.locale, event: eventName, plan: planTitle, boutId: ctx.boutId, academyDay: todayKey, ok, steps: results, errors, findings, observations, hotReloads, setAside };
    writeFileSync(join(shotsDir, "uat-summary.json"), JSON.stringify(summary, null, 2));
    console.log(`summary: ${join(shotsDir, "uat-summary.json")}`);
}
process.exit(ok ? 0 : 1);
