import puppeteer from "puppeteer";

(async () => {
    const browser = await puppeteer.launch({ headless: "new" });
    const page = await browser.newPage();

    page.on("console", (msg) => console.log("PAGE LOG:", msg.text()));
    page.on("pageerror", (error) => console.log("PAGE ERROR:", error.message));
    page.on("response", (response) => {
        if (response.status() >= 400) {
            console.log("HTTP ERROR:", response.status(), response.url());
        }
    });

    await page.goto("http://localhost:3000/analysis", {
        waitUntil: "networkidle0",
    });

    const inputUploadHandle = await page.$("input[type=file]");
    const videoPath =
        "C:\\Users\\DAN\\Downloads\\YTSave_Shorts_How-to-throw-a-cross-shorts-boxing-dazn-_Media_DWYzO2NJmCQ_001_1080p.mp4";
    await inputUploadHandle.uploadFile(videoPath);

    await new Promise((r) => setTimeout(r, 500));

    const buttons = await page.$$("button");
    for (const btn of buttons) {
        const text = await page.evaluate((el) => el.innerText, btn);
        if (text.includes("Bắt đầu phân tích")) {
            await btn.click();
            break;
        }
    }

    await new Promise((r) => setTimeout(r, 5000));
    const html = await page.evaluate(() => document.body.innerText);
    console.log("---TEXT AFTER 5s---");
    console.log(html);

    await browser.close();
})();
