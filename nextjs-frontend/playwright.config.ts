import { defineConfig, devices } from "@playwright/test";

/**
 * Bộ E2E chỉ chạy với stack thật đã khởi động và dữ liệu kiểm thử cô lập.
 * Không tự mở dev server, không bật demo mode và không chèn cookie xác thực.
 */

const isCI = Boolean(process.env.CI);
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:13000";
if (!process.env.E2E_PASSWORD) throw new Error("E2E_PASSWORD must be configured before running real Playwright tests.");

export default defineConfig({
    testDir: "e2e",
    fullyParallel: false,
    workers: 1,
    forbidOnly: isCI,
    retries: isCI ? 2 : 0,
    reporter: isCI ? [["list"], ["html", { open: "never" }]] : "list",
    timeout: 90_000,
    expect: { timeout: 15_000 },
    use: {
        baseURL,
        trace: "retain-on-failure",
        screenshot: "only-on-failure",
        navigationTimeout: 60_000,
        actionTimeout: 20_000,
        locale: "en-US",
        timezoneId: "Asia/Ho_Chi_Minh",
    },
    projects: [
        {
            name: "desktop",
            use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
        },
        {
            name: "mobile",
            use: { ...devices["Pixel 7"] },
            grep: /@mobile/,
        },
    ],
    webServer: undefined,
});
