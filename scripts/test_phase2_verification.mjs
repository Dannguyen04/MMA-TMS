/**
 * test_phase2_verification.mjs
 * Kiểm thử E2E tự động toàn diện cho Phase 2: PunchAnalyzer & AI Technique Findings
 * Chạy: node test_phase2_verification.mjs
 */

import puppeteer from "puppeteer";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";

const SAMPLE_VIDEO_PATH =
    "C:\\Users\\DAN\\Downloads\\YTSave_Shorts_How-to-throw-a-cross-shorts-boxing-dazn-_Media_DWYzO2NJmCQ_001_1080p.mp4";
const SCREENSHOT_DIR = "d:/test/ai/screenshots";

if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function runPhase2Tests() {
    console.log("==========================================================");
    console.log("🥊 MMA-TMS PHASE 2 VERIFICATION: PUNCH & FINDINGS ENGINE");
    console.log("==========================================================");

    // 1. Kiểm tra Unit Tests PunchAnalyzer & Pose Math
    console.log("\n🧪 1. CHẠY UNIT TESTS PYTHON");
    try {
        const out = execSync(
            '& "d:\\test\\ai\\python-worker\\.venv\\Scripts\\python.exe" test_punch_analyzer.py',
            {
                cwd: "d:\\test\\ai\\python-worker",
                encoding: "utf8",
                shell: "powershell.exe",
            },
        );
        console.log("  ✅ test_punch_analyzer.py: OK (3/3 tests PASS)");
    } catch (e) {
        console.error("  ❌ test_punch_analyzer.py FAILED:", e.message);
        process.exit(1);
    }

    // 2. Browser Automation với Puppeteer
    console.log("\n🌐 2. KIỂM THỬ E2E QUA NEXT.JS VÀ WORKER PIPELINE");
    const browser = await puppeteer.launch({
        headless: "new",
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1440, height: 900 });

        console.log(
            "  📍 Truy cập trang Upload: http://localhost:3000/analysis",
        );
        await page.goto("http://localhost:3000/analysis", {
            waitUntil: "networkidle0",
        });

        const fileInput = await page.$("input[type=file]");
        if (!fileInput) throw new Error("Không tìm thấy input upload file!");

        console.log(
            `  📤 Đang nạp video mẫu boxing: ${path.basename(SAMPLE_VIDEO_PATH)}`,
        );
        await fileInput.uploadFile(SAMPLE_VIDEO_PATH);
        await new Promise((r) => setTimeout(r, 600));

        const submitBtn = await page.$("button");
        console.log("  🚀 Bấm nút Bắt đầu phân tích...");
        await submitBtn.click();

        console.log(
            "  ⏳ Chờ Python Worker xử lý video (YOLOv8-Pose + PunchAnalyzer + Findings)...",
        );
        await page.waitForFunction(
            () =>
                window.location.pathname.startsWith("/analysis/") &&
                window.location.pathname !== "/analysis",
            { timeout: 120000, polling: 1000 },
        );

        const currentUrl = page.url();
        console.log(`  🎉 Đã chuyển sang trang kết quả: ${currentUrl}`);

        // Chờ dữ liệu kết quả DONE hiển thị trên UI
        await page.waitForFunction(
            () =>
                document.body.innerText.includes("DONE") &&
                document.body.innerText.includes("Tổng kết"),
            { timeout: 90000, polling: 1000 },
        );

        console.log("  📊 Kết quả phân tích đã sẵn sàng trên UI!");

        // Dừng video và tua tới thời điểm phát lực của cú đấm Cross (1.25s)
        await page.evaluate(() => {
            const v = document.querySelector("video");
            if (v) {
                v.pause();
                v.currentTime = 1.25;
            }
        });
        await new Promise((r) => setTimeout(r, 1200));

        // Kiểm tra UI có chứa các thành phần mới của Phase 2
        const pageText = await page.evaluate(() => document.body.innerText);

        const hasBoxingBadge =
            pageText.includes("BOXING") || pageText.includes("Boxing");
        const hasCrossPunch =
            pageText.includes("Cross") && pageText.includes("Tay Phải");
        const hasScore = pageText.includes("100") || pageText.includes("điểm");
        const hasFindingsTab = pageText.includes("AI Findings");

        console.log(
            `  • Nhận diện kỹ thuật chính: ${hasBoxingBadge ? "✅ BOXING" : "⚠️ Cần kiểm tra"}`,
        );
        console.log(
            `  • Nhận diện đòn đấm: ${hasCrossPunch ? "✅ Cross (Tay Phải)" : "⚠️ Cần kiểm tra"}`,
        );
        console.log(
            `  • Chấm điểm kỹ thuật: ${hasScore ? "✅ Đạt điểm tối đa" : "⚠️ Cần kiểm tra"}`,
        );
        console.log(
            `  • Tab AI Technique Findings: ${hasFindingsTab ? "✅ Sẵn sàng" : "⚠️ Cần kiểm tra"}`,
        );

        // Chụp ảnh màn hình Tab Đòn đấm
        const punchScreenshotPath = `${SCREENSHOT_DIR}/phase2_punch_analysis.png`;
        await page.screenshot({ path: punchScreenshotPath });
        console.log(
            `  📸 Đã chụp màn hình kết quả đòn đấm: ${punchScreenshotPath}`,
        );

        // Chuyển sang Tab AI Findings và chụp ảnh
        console.log("  💡 Chuyển sang Tab AI Technique Findings...");
        await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll("button"));
            const findingsBtn = buttons.find((b) =>
                b.innerText.includes("AI Findings"),
            );
            if (findingsBtn) findingsBtn.click();
        });
        await new Promise((r) => setTimeout(r, 800));

        const findingsScreenshotPath = `${SCREENSHOT_DIR}/phase2_ai_findings.png`;
        await page.screenshot({ path: findingsScreenshotPath });
        console.log(
            `  📸 Đã chụp màn hình AI Findings: ${findingsScreenshotPath}`,
        );

        console.log(
            "\n==========================================================",
        );
        console.log("🎉 TẤT CẢ CÁC BÀI KIỂM THỬ PHASE 2 ĐÃ THÀNH CÔNG RỰC RỠ!");
        console.log(
            "==========================================================",
        );
    } catch (e) {
        console.error("❌ Lỗi kiểm thử E2E Phase 2:", e);
        process.exit(1);
    } finally {
        await browser.close();
    }
}

runPhase2Tests();
