import puppeteer from "puppeteer";
import https from "https";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const BASE_URL = "http://localhost:3000";
const API_URL = "http://localhost:3001";
const SAMPLE_VIDEO_PATH =
    "C:\\Users\\DAN\\Downloads\\YTSave_Shorts_How-to-throw-a-cross-shorts-boxing-dazn-_Media_DWYzO2NJmCQ_001_1080p.mp4";
const SCREENSHOT_DIR = "d:/test/ai/test_results";

if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

let passed = 0;
let failed = 0;

function assert(condition, message) {
    if (condition) {
        console.log(`  ✅ [PASS] ${message}`);
        passed++;
    } else {
        console.error(`  ❌ [FAIL] ${message}`);
        failed++;
    }
}

async function run() {
    console.log("==================================================");
    console.log("🥋 TOÀN BỘ TEST SUITE HỆ THỐNG MARTIAL ARTS TRACKER");
    console.log("==================================================\n");

    // ─────────────────────────────────────────────
    // 1. KIỂM TRA DỊCH VỤ CƠ SỞ (INFRASTRUCTURE)
    // ─────────────────────────────────────────────
    console.log(
        "📦 1. KIỂM TRA INFRASTRUCTURE (REDIS, DB, WORKER, API, FRONTEND)",
    );

    // Test Redis via Python check
    try {
        const redisCheck = execSync(
            '& "d:\\test\\ai\\python-worker\\.venv\\Scripts\\python.exe" -c "import redis; r = redis.Redis(); print(r.ping())"',
            { encoding: "utf8", shell: "powershell.exe" },
        ).trim();
        assert(
            redisCheck === "True",
            "Redis Server port 6379 đang hoạt động bình thường",
        );
    } catch (e) {
        assert(false, `Redis Server lỗi: ${e.message}`);
    }

    // Test NestJS API Health / Root
    try {
        const res = await fetch(`${API_URL}/jobs`);
        assert(
            res.status === 200,
            `NestJS API (port 3001) đang lắng nghe (status: ${res.status})`,
        );
        const jobs = await res.json();
        assert(
            Array.isArray(jobs),
            `GET /jobs trả về danh sách array (${jobs.length} jobs hiện tại)`,
        );
    } catch (e) {
        assert(false, `NestJS API lỗi: ${e.message}`);
    }

    // Test Next.js Frontend
    try {
        const res = await fetch(`${BASE_URL}`);
        assert(
            res.status === 200,
            `Next.js Frontend (port 3000) đang phục vụ (status: ${res.status})`,
        );
    } catch (e) {
        assert(false, `Next.js Frontend lỗi: ${e.message}`);
    }

    // ─────────────────────────────────────────────
    // 2. KIỂM TRA NESTJS API ENDPOINTS
    // ─────────────────────────────────────────────
    console.log("\n🚀 2. KIỂM TRA CHI TIẾT TỪNG API ENDPOINT (NESTJS)");
    let createdJobId = null;

    // Validation Test: POST /jobs with empty body -> 400 Bad Request
    try {
        const res = await fetch(`${API_URL}/jobs`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({}),
        });
        assert(
            res.status === 400,
            `POST /jobs không có videoUrl bị từ chối với status 400 Validation Error (status: ${res.status})`,
        );
    } catch (e) {
        assert(false, `Validation POST /jobs lỗi: ${e.message}`);
    }

    // POST /jobs valid creation
    try {
        const testVideoUrl =
            "https://wskisxkpbhisnqfpjqrm.supabase.co/storage/v1/object/public/videos/uploads/test_video.mp4";
        const res = await fetch(`${API_URL}/jobs`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                videoUrl: testVideoUrl,
                userId: "test-suite",
            }),
        });
        assert(
            res.status === 201,
            `POST /jobs tạo job mới thành công với status 201`,
        );
        const body = await res.json();
        assert(!!body.jobId, `Job ID được tạo hợp lệ: ${body.jobId}`);
        assert(body.status === "PENDING", `Trạng thái ban đầu là PENDING`);
        createdJobId = body.jobId;
    } catch (e) {
        assert(false, `POST /jobs lỗi: ${e.message}`);
    }

    // GET /jobs/:id
    if (createdJobId) {
        try {
            const res = await fetch(`${API_URL}/jobs/${createdJobId}`);
            assert(
                res.status === 200,
                `GET /jobs/${createdJobId} trả về status 200`,
            );
            const job = await res.json();
            assert(
                job.id === createdJobId,
                `Thông tin job trả về đúng ID (${job.id})`,
            );
            assert(
                job.userId === "test-suite",
                `Thông tin userId trùng khớp (${job.userId})`,
            );
        } catch (e) {
            assert(false, `GET /jobs/:id lỗi: ${e.message}`);
        }

        // Security Test: PATCH /jobs/:id/status KHÔNG CÓ token -> 401 Unauthorized
        try {
            const res = await fetch(`${API_URL}/jobs/${createdJobId}/status`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: "PROCESSING" }),
            });
            assert(
                res.status === 401,
                `Bảo mật API: PATCH /jobs/:id/status không có token bị từ chối 401 Unauthorized (status: ${res.status})`,
            );
        } catch (e) {
            assert(
                false,
                `Security test PATCH /jobs/:id/status lỗi: ${e.message}`,
            );
        }

        // PATCH /jobs/:id/status CÓ worker secret token -> 200 OK
        try {
            const res = await fetch(`${API_URL}/jobs/${createdJobId}/status`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    "x-worker-secret": "mma-tms-worker-local-secret-2026",
                },
                body: JSON.stringify({ status: "PROCESSING" }),
            });
            assert(
                res.status === 200,
                `PATCH /jobs/:id/status với Worker Secret Token cập nhật thành công (status: 200)`,
            );
            const updated = await res.json();
            assert(
                updated.status === "PROCESSING",
                `Trạng thái được cập nhật thành PROCESSING trong DB`,
            );
        } catch (e) {
            assert(false, `PATCH /jobs/:id/status lỗi: ${e.message}`);
        }
    }

    // ─────────────────────────────────────────────
    // 3. KIỂM TRA PYTHON WORKER & AI / COMPUTER VISION
    // ─────────────────────────────────────────────
    console.log(
        "\n🧠 3. KIỂM TRA PYTHON WORKER & COMPUTER VISION (YOLOv8-POSE, KICK ANALYZER)",
    );
    try {
        const testMathOutput = execSync(
            '& "d:\\test\\ai\\python-worker\\.venv\\Scripts\\python.exe" test_pose_math.py',
            {
                cwd: "d:\\test\\ai\\python-worker",
                encoding: "utf8",
                shell: "powershell.exe",
            },
        );
        const mathPassed = testMathOutput.includes("27/27 tests passed");
        assert(
            mathPassed,
            "Unit test toán học & State Machine KickAnalyzer (27/27 tests PASS)",
        );
    } catch (e) {
        assert(false, `Test pose math thất bại: ${e.message}`);
    }

    // Kiểm tra inference trực tiếp YOLOv8-pose trên video mẫu
    try {
        console.log(
            "  ⏳ Đang chạy thử nghiệm YOLOv8-Pose + KickAnalyzer trên 60 frames video mẫu...",
        );
        const sampleRunOutput = execSync(
            `& "d:\\test\\ai\\python-worker\\.venv\\Scripts\\python.exe" -c "from process_video import process_video; res = process_video(r'${SAMPLE_VIDEO_PATH}', model_name='yolov8n-pose', max_frames=60, verbose=False); print('FPS:', res['meta']['fps']); print('TOTAL_PROCESSED:', len(res['frames'])); print('HAS_SUMMARY:', 'summary' in res)"`,
            {
                cwd: "d:\\test\\ai\\python-worker",
                encoding: "utf8",
                shell: "powershell.exe",
            },
        );
        assert(
            sampleRunOutput.includes("FPS: 60.0"),
            "Trích xuất metadata video chính xác (FPS 60.0)",
        );
        assert(
            sampleRunOutput.includes("TOTAL_PROCESSED: 60"),
            "YOLOv8-Pose xử lý thành công 60 frames liên tục",
        );
        assert(
            sampleRunOutput.includes("HAS_SUMMARY: True"),
            "KickAnalyzer tổng hợp kết quả JSON hợp lệ",
        );
    } catch (e) {
        assert(false, `Thử nghiệm YOLOv8-Pose thất bại: ${e.message}`);
    }

    // ─────────────────────────────────────────────
    // 3.5 KIỂM TRA PHASE 1 MVP STANDALONE APP (VITE+REACT)
    // ─────────────────────────────────────────────
    console.log(
        "\n🥊 3.5 KIỂM TRA STANDALONE REACT MVP (MARTIAL-ARTS-TRACKER)",
    );
    try {
        const buildOutput = execSync("npm.cmd run build", {
            cwd: "d:\\test\\ai\\martial-arts-tracker",
            encoding: "utf8",
        });
        assert(
            buildOutput.includes("built in"),
            "Ứng dụng Vite+React Standalone build thành công (MediaPipe browser-based tracker)",
        );
    } catch (e) {
        assert(false, `Build standalone app thất bại: ${e.message}`);
    }

    // ─────────────────────────────────────────────
    // 4. KIỂM TRA BROWSER AUTOMATION VÀ CÁC TRANG WEB (PUPPETEER E2E)
    // ─────────────────────────────────────────────
    console.log(
        "\n🌐 4. KIỂM TRA GIAO DIỆN VÀ TÍNH NĂNG NGƯỜI DÙNG (PUPPETEER E2E)",
    );

    const browser = await puppeteer.launch({
        headless: "new",
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    // 4.1 Trang chủ /
    console.log("  📍 Kiểm tra Trang Chủ (http://localhost:3000)...");
    try {
        await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle0" });
        const title = await page.title();
        assert(title.length > 0, `Trang chủ tải thành công: "${title}"`);

        // Kiểm tra các link dẫn tới /live và /analysis
        const liveLink = await page.$('a[href="/live"]');
        const analysisLink = await page.$('a[href="/analysis"]');
        assert(
            !!liveLink,
            "Trang chủ có nút điều hướng tới /live (Camera Realtime)",
        );
        assert(
            !!analysisLink,
            "Trang chủ có nút điều hướng tới /analysis (Upload Video)",
        );

        await page.screenshot({ path: `${SCREENSHOT_DIR}/1_homepage.png` });
        console.log(`    📸 Đã chụp: ${SCREENSHOT_DIR}/1_homepage.png`);
    } catch (e) {
        assert(false, `Lỗi kiểm tra Trang Chủ: ${e.message}`);
    }

    // 4.2 Trang /live
    console.log(
        "  📍 Kiểm tra Trang Live Camera (http://localhost:3000/live)...",
    );
    try {
        await page.goto(`${BASE_URL}/live`, { waitUntil: "networkidle0" });
        const liveContent = await page.content();
        assert(
            liveContent.includes("Webcam") ||
                liveContent.includes("Camera") ||
                liveContent.includes("video") ||
                liveContent.includes("Trực tiếp"),
            "Trang /live chứa thành phần video/webcam camera",
        );

        await page.screenshot({ path: `${SCREENSHOT_DIR}/2_live_page.png` });
        console.log(`    📸 Đã chụp: ${SCREENSHOT_DIR}/2_live_page.png`);
    } catch (e) {
        assert(false, `Lỗi kiểm tra Trang Live: ${e.message}`);
    }

    // 4.3 Trang /analysis và Quy trình Upload Full E2E
    console.log(
        "  📍 Kiểm tra Trang Upload Video (http://localhost:3000/analysis)...",
    );
    try {
        await page.goto(`${BASE_URL}/analysis`, { waitUntil: "networkidle0" });
        await page.screenshot({
            path: `${SCREENSHOT_DIR}/3_analysis_page.png`,
        });

        const fileInput = await page.$("input[type=file]");
        assert(!!fileInput, "Input upload file video hiển thị đầy đủ");

        console.log(`    📤 Đang chọn video: ${SAMPLE_VIDEO_PATH}...`);
        await fileInput.uploadFile(SAMPLE_VIDEO_PATH);
        await new Promise((r) => setTimeout(r, 600));

        await page.screenshot({
            path: `${SCREENSHOT_DIR}/4_file_selected.png`,
        });

        const btn = await page.$("button");
        const btnText = await page.evaluate((el) => el.innerText, btn);
        assert(
            btnText.includes("Bắt đầu phân tích"),
            `Nút hành động sẵn sàng: "${btnText}"`,
        );

        console.log("    🚀 Bấm nút 'Bắt đầu phân tích'...");
        await btn.click();

        // Theo dõi quá trình xử lý: Uploading -> Queued -> Processing -> Chuyển trang
        console.log(
            "    ⏳ Đang chờ pipeline (Supabase Upload -> BullMQ Queue -> YOLOv8-Pose Worker -> DB Update)...",
        );

        // Đợi tối đa 120s để xử lý video 10s
        await page.waitForFunction(
            () =>
                window.location.pathname.startsWith("/analysis/") &&
                window.location.pathname !== "/analysis",
            { timeout: 120000, polling: 1000 },
        );

        const currentUrl = page.url();
        assert(
            currentUrl.includes("/analysis/"),
            `Hệ thống tự động chuyển hướng sang trang kết quả: ${currentUrl}`,
        );

        await new Promise((r) => setTimeout(r, 2000));
        await page.screenshot({
            path: `${SCREENSHOT_DIR}/5_analysis_result.png`,
        });
        console.log(
            `    📸 Đã chụp kết quả: ${SCREENSHOT_DIR}/5_analysis_result.png`,
        );

        // Kiểm tra các thành phần trên trang kết quả
        const videoEl = await page.$("video");
        const canvasEl = await page.$("canvas");
        const pageText = await page.evaluate(() => document.body.innerText);

        assert(
            !!videoEl,
            "Trang kết quả có video player phát video đã phân tích",
        );
        assert(
            !!canvasEl,
            "Trang kết quả có canvas overlay vẽ khung xương (skeleton landmarks)",
        );
        assert(
            pageText.includes("Điểm") ||
                pageText.includes("Score") ||
                pageText.includes("Kết quả") ||
                pageText.includes("cú đá"),
            "Trang kết quả hiển thị bảng điểm và thông số kỹ thuật cú đá",
        );
    } catch (e) {
        assert(false, `Lỗi luồng Upload & Phân tích E2E: ${e.message}`);
        await page.screenshot({
            path: `${SCREENSHOT_DIR}/5_analysis_error.png`,
        });
    }

    await browser.close();

    // ─────────────────────────────────────────────
    // 5. TỔNG KẾT
    // ─────────────────────────────────────────────
    console.log("\n==================================================");
    console.log(`🎉 TỔNG KẾT BÁO CÁO KIỂM THỬ TOÀN DIỆN:`);
    console.log(`  Tổng số bài test: ${passed + failed}`);
    console.log(`  ✅ Thành công (PASS): ${passed}`);
    console.log(`  ❌ Thất bại (FAIL):  ${failed}`);
    console.log(
        `  Tỷ lệ thành công:    ${((passed / (passed + failed)) * 100).toFixed(1)}%`,
    );
    console.log("==================================================");

    if (failed === 0) {
        process.exit(0);
    } else {
        process.exit(1);
    }
}

run();
