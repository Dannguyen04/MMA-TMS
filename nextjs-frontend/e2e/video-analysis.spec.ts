import type { Locator, Page } from "@playwright/test";

import { checkHidden, expect, expectPageReady, test, toast, uniqueSuffix, USERS } from "./fixtures";

/**
 * Video analysis, end to end in mock pipeline mode (NEXT_PUBLIC_VIDEO_PIPELINE=mock, the default):
 * Minh uploads footage → the mock pipeline processes it (~4 s queue + ~2.5 s per stage) → his coach
 * Rafael reviews the generated findings → Minh sees the human decisions read-only.
 *
 * The steps share one freshly uploaded video, so they run in order and stop at the first failure.
 */
test.describe.configure({ mode: "serial" });

const title = `E2E shadow rounds ${uniqueSuffix()}`;
const correctionNote = `Rear hand, not lead — E2E ${uniqueSuffix()}`;
const rejectionNote = `Feint only, no strike thrown — E2E ${uniqueSuffix()}`;
const reviewSummary = `Good pace and a tight guard on the jab. Next session: hands home after the hook (${uniqueSuffix()}).`;
let videoId = "";

/**
 * A tiny `.webm` file: a valid EBML magic number followed by padding. Browsers can't decode it, so the
 * wizard asks for the approximate length — the documented fallback — and the mock pipeline doesn't care.
 */
function sampleVideo() {
    const header = Buffer.from([0x1a, 0x45, 0xdf, 0xa3]);
    return { name: `e2e-shadow-${uniqueSuffix()}.webm`, mimeType: "video/webm", buffer: Buffer.concat([header, Buffer.alloc(64 * 1024, 7)]) };
}

function findingsPanel(page: Page): Locator {
    return page.getByRole("tabpanel", { name: /^Findings/ });
}

async function openTab(page: Page, name: RegExp) {
    const tab = page.getByRole("tablist", { name: "Findings, detections and coach review" }).getByRole("tab", { name });
    await tab.click();
    await expect(tab).toHaveAttribute("aria-selected", "true");
}

test("a fighter uploads footage and follows the AI pipeline to the analysis", async ({ page, signInAs }) => {
    test.slow(); // the mock pipeline takes ~22 s
    await signInAs("fighter");
    await page.goto("/fighter/videos/upload");
    await expectPageReady(page, "Upload training video");

    // Step 1 — footage, chosen through the real file picker.
    const chooser = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: "Choose video" }).click();
    const file = sampleVideo();
    await (await chooser).setFiles(file);
    await expect(page.getByText(file.name)).toBeVisible();
    const length = page.getByLabel(/^Approximate length \(seconds\)/);
    await expect(length.or(page.getByText(/ long$/))).toBeVisible();
    if (await length.isVisible()) await length.fill("45");
    await page.getByRole("button", { name: "Next: Details" }).click();

    // Step 2 — details. Validation first: nothing chosen yet.
    await expect(page.getByRole("heading", { name: "Describe the session" })).toBeFocused();
    await page.getByRole("button", { name: /^Next: Upload/ }).click();
    await expect(page.getByText("Choose the type of training in the video.")).toBeVisible();
    await checkHidden(page.getByRole("radio", { name: /^Shadow boxing/ }));
    await checkHidden(page.getByRole("radio", { name: /^45° diagonal/ }));
    await page.getByRole("textbox", { name: "Title" }).fill(title);
    await page.getByRole("button", { name: /^Next: Upload/ }).click();

    // Step 3 — upload progress, then the pipeline stages, then the result.
    await expect(page.getByRole("heading", { name: "Upload and analyse" })).toBeVisible();
    await expect(page.getByText(title).first()).toBeVisible();
    await page.getByRole("button", { name: "Upload and analyse" }).click();
    await expect(page.getByRole("progressbar", { name: "Upload progress" })).toBeVisible();

    const stages = page.getByRole("list", { name: "Pipeline stages" });
    await expect(stages).toBeVisible({ timeout: 30_000 });
    await expect(stages.getByRole("listitem")).toHaveCount(9);
    await expect(page.getByRole("progressbar", { name: "AI analysis progress" })).toBeVisible();
    await expect(page.getByText(/^Stage \d of 7/)).toBeVisible({ timeout: 30_000 });

    const ready = page.getByRole("status").filter({ has: page.getByRole("link", { name: "Open analysis" }) });
    await expect(ready).toBeVisible({ timeout: 60_000 });
    await expect(toast(page, "AI analysis ready")).toBeVisible();
    await ready.getByRole("link", { name: "Open analysis" }).click();

    await expect(page).toHaveURL(/\/fighter\/videos\/v-[^/]+$/);
    videoId = new URL(page.url()).pathname.split("/").pop()!;
    await expectPageReady(page, title);
    await expect(page.getByRole("region", { name: `Player: ${title}` })).toBeVisible();
    await expect(findingsPanel(page).getByRole("article").first()).toBeVisible();
});

test("the coach confirms, corrects and rejects findings and writes a review", async ({ page, signInAs }) => {
    test.skip(!videoId, "Needs the video uploaded by the previous step.");
    await signInAs("coach");
    await page.goto(`/coach/video-analysis/${videoId}`);
    await expectPageReady(page, title);

    const findings = findingsPanel(page).getByRole("article");
    expect(await findings.count(), "the generated analysis has at least three findings").toBeGreaterThanOrEqual(3);
    const [first, second, third] = [findings.nth(0), findings.nth(1), findings.nth(2)];

    // Confirm the first finding; the button turns into a disabled "Confirmed".
    await first.getByRole("button", { name: "Confirm", exact: true }).click();
    await expect(first.getByText("Human verified")).toBeVisible();
    await expect(first.getByRole("button", { name: "Confirmed" })).toBeDisabled();

    // Correct the second: label + note.
    await second.getByRole("button", { name: "Correct", exact: true }).click();
    const correct = page.getByRole("dialog", { name: "Review AI finding" });
    await expect(correct).toBeVisible();
    await expect(correct.getByRole("radio", { name: /^Correct/ })).toBeChecked();
    await correct.getByRole("button", { name: "Save correction" }).click();
    await expect(correct.getByText("Choose the correct label.")).toBeVisible();
    const labels = correct.getByRole("group", { name: /^Correct label/ }).getByRole("radio");
    const correctedLabel = ((await labels.first().getAttribute("value")) ?? "").trim();
    expect(correctedLabel).not.toBe("");
    await checkHidden(labels.first());
    await correct.getByRole("textbox", { name: /^Note/ }).fill(correctionNote);
    await correct.getByRole("button", { name: "Save correction" }).click();
    await expect(correct).toBeHidden();
    await expect(second.getByText("Human corrected")).toBeVisible();
    await expect(second.getByText(correctionNote)).toBeVisible();

    // Reject the third: the note is required.
    await third.getByRole("button", { name: "Reject", exact: true }).click();
    const reject = page.getByRole("dialog", { name: "Review AI finding" });
    await reject.getByRole("button", { name: "Reject", exact: true }).click();
    await expect(reject.getByText("Explain why this is wrong — it helps retrain the model.")).toBeVisible();
    await expect(reject.getByRole("textbox", { name: /^Note/ })).toHaveAttribute("aria-invalid", "true");
    await reject.getByRole("textbox", { name: /^Note/ }).fill(rejectionNote);
    await reject.getByRole("button", { name: "Reject", exact: true }).click();
    await expect(reject).toBeHidden();
    await expect(third.getByText("Rejected by reviewer")).toBeVisible();

    // The overall coach review.
    await openTab(page, /Coach review/);
    const reviewPanel = page.getByRole("tabpanel", { name: /Coach review/ });
    await checkHidden(reviewPanel.getByRole("radio", { name: /^4 of 5/ }));
    await reviewPanel.getByRole("textbox", { name: /^Summary for the fighter/ }).fill(reviewSummary);
    await reviewPanel.getByRole("button", { name: "Save coach review" }).click();
    await expect(toast(page, "Coach review saved")).toBeVisible();
    await expect(reviewPanel.getByRole("region", { name: "Current review" }).getByText(reviewSummary)).toBeVisible();

    // The decisions survive a reload (they were saved, not only applied optimistically).
    await page.reload();
    await expectPageReady(page, title);
    await expect(findingsPanel(page).getByText("Human verified").first()).toBeVisible();
    await expect(findingsPanel(page).getByText("Human corrected").first()).toBeVisible();
});

test("the fighter sees the human decisions and the coach review read-only", async ({ page, signInAs }) => {
    test.skip(!videoId, "Needs the video uploaded by the previous step.");
    await signInAs(USERS.minh);
    await page.goto(`/fighter/videos/${videoId}`);
    await expectPageReady(page, title);

    const panel = findingsPanel(page);
    await expect(panel.getByText("Human verified").first()).toBeVisible();
    await expect(panel.getByText("Human corrected").first()).toBeVisible();
    await expect(panel.getByText(correctionNote)).toBeVisible();
    // Fighters can't review.
    await expect(panel.getByRole("button", { name: /^(Confirm|Correct|Reject)$/ })).toHaveCount(0);

    await openTab(page, /Coach review/);
    const reviewPanel = page.getByRole("tabpanel", { name: /Coach review/ });
    await expect(reviewPanel.getByRole("region", { name: "Coach review" }).getByText(reviewSummary)).toBeVisible();
    await expect(reviewPanel.getByRole("textbox")).toHaveCount(0);
    await expect(reviewPanel.getByRole("button", { name: /coach review/i })).toHaveCount(0);
});

test("the player and timeline work from the keyboard", async ({ page, signInAs }) => {
    test.skip(!videoId, "Needs the video uploaded by the previous step.");
    await signInAs(USERS.minh);
    await page.goto(`/fighter/videos/${videoId}`);
    await expectPageReady(page, title);

    const player = page.getByRole("region", { name: `Player: ${title}` });
    const stage = player.getByRole("application");
    await stage.focus();
    await expect(player.getByRole("button", { name: "Play" })).toBeVisible();
    await page.keyboard.press("Space");
    await expect(player.getByRole("button", { name: "Pause" })).toBeVisible();
    await page.keyboard.press("Space");
    await expect(player.getByRole("button", { name: "Play" })).toBeVisible();

    // Timeline markers are real buttons with names that say what and when.
    const markers = page.getByRole("button", { name: /^AI finding at \d+:\d{2}/ });
    await expect(markers.first()).toBeVisible();
    const strikes = page.getByRole("button", { name: /^(Jab|Cross|Lead hook|Rear hook|Hook|Uppercut|Lead uppercut|Rear uppercut|.+ kick|Knee|Elbow).* at \d+:\d{2}, \d+% confidence/ });
    await expect(strikes.first()).toBeVisible();
    await markers.first().focus();
    await expect(markers.first()).toBeFocused();
});
