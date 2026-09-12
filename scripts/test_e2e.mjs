import puppeteer from "puppeteer";

(async () => {
    console.log("🚀 Khởi chạy trình duyệt...");
    const browser = await puppeteer.launch({ headless: "new" });
    const page = await browser.newPage();

    console.log("🌐 Mở trang web http://localhost:3000/analysis...");
    await page.goto("http://localhost:3000/analysis", {
        waitUntil: "networkidle0",
    });

    // Chụp ảnh màn hình ban đầu
    await page.screenshot({ path: "d:/test/ai/screenshot_1_analysis.png" });

    console.log("📂 Tìm phần tử input file...");
    const inputUploadHandle = await page.$("input[type=file]");
    if (!inputUploadHandle) {
        console.error("Không tìm thấy input file upload!");
        await browser.close();
        return;
    }

    const videoPath =
        "C:\\Users\\DAN\\Downloads\\YTSave_Shorts_How-to-throw-a-cross-shorts-boxing-dazn-_Media_DWYzO2NJmCQ_001_1080p.mp4";

    console.log(`📤 Đang chọn file: ${videoPath}`);
    await inputUploadHandle.uploadFile(videoPath);

    await new Promise((r) => setTimeout(r, 500));
    await page.screenshot({ path: "d:/test/ai/screenshot_2_selected.png" });

    console.log("Bấm nút Upload...");
    const buttons = await page.$$("button");
    for (const btn of buttons) {
        const text = await page.evaluate((el) => el.innerText, btn);
        if (text.includes("Bắt đầu phân tích")) {
            await btn.click();
            break;
        }
    }

    console.log("⏳ Đợi hệ thống upload và xử lý...");
    await new Promise((r) => setTimeout(r, 2000));
    await page.screenshot({ path: "d:/test/ai/screenshot_3_uploading.png" });

    console.log("Đợi xử lý hoàn tất...");
    try {
        await page.waitForNavigation({
            timeout: 60000,
            waitUntil: "networkidle0",
        });
        console.log("✅ Chuyển trang thành công!");
        await page.screenshot({ path: "d:/test/ai/screenshot_4_result.png" });
    } catch (e) {
        console.log("⚠️ Hết thời gian chờ hoặc có lỗi:", e.message);
        await page.screenshot({ path: "d:/test/ai/screenshot_4_error.png" });
    }

    console.log("📸 Đã chụp lại màn hình!");
    await browser.close();
})();
