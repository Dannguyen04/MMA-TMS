#!/usr/bin/env node
// T-039: Script đo tính khả thi của việc AI xem video hiệp đấu trong lúc nghỉ giữa hiệp (<= 40s)
// Template chép cấu trúc từ: docs/archive/ai/gemini-punch-eval-20261027/gemini-punch-eval.mjs
// Sử dụng plain Node ESM, built-in modules và global fetch, không cài thêm dependency.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "../../..");
const PW_ROOT = path.resolve(REPO_ROOT, "python-worker");

// --- 1. Tham số dòng lệnh & kiểm tra môi trường ---
const rawArgs = process.argv.slice(2);
const isDryRun = rawArgs.includes("--dry-run");
const positionalArgs = rawArgs.filter((a) => a !== "--dry-run");
const outDirArg = positionalArgs[0];

if (!outDirArg) {
    console.error("Cách dùng: node python-worker/scripts/eval/live_round_feasibility.mjs [--dry-run] <outDir>");
    process.exit(1);
}

const outDir = path.resolve(process.cwd(), outDirArg);

// Tiêu chí nghiệm thu 2: Thiếu GEMINI_API_KEY mà không có --dry-run thì thoát mã khác 0 và báo rõ, không gọi mạng.
const KEY = process.env.GEMINI_API_KEY;
const MODEL = process.env.GEMINI_MODEL || "gemini-3.8-flash";

if (!isDryRun) {
    if (!KEY || !KEY.trim()) {
        console.error("LỖI: Biến môi trường GEMINI_API_KEY chưa được đặt. Vui lòng đặt GEMINI_API_KEY hoặc sử dụng cờ --dry-run.");
        process.exit(1);
    }
}

// --- 2. Định nghĩa Ca & Cấu hình ---
const CASES = {
    V6: {
        title: "V6 (trận thật, 2 võ sĩ)",
        url: "https://www.youtube.com/watch?v=cQW-h8yGbRc",
        fps: 23.976023976023978,
        window: [36500, 38000],
        expectedLabels: 85,
        localVideoPath: path.join(PW_ROOT, "test_results/external/boxingvi_original_20261006/rgb/cQW-h8yGbRc.mp4"),
        localTruthPath: path.join(PW_ROOT, "test_results/external/boxe_ml/96f3a7d0716040682381fb63f80afac96f74cfa6/clean_annotation_data/V6.csv"),
        remoteTruthUrl: "https://raw.githubusercontent.com/leonardosm14/boxe.ml/96f3a7d0716040682381fb63f80afac96f74cfa6/dataset/clean_annotation_data/V6.csv",
    },
    V10: {
        title: "V10 (trận thật, 2 võ sĩ)",
        url: "https://www.youtube.com/watch?v=OfZFdwW322E",
        fps: 25.0,
        window: [4000, 5500],
        expectedLabels: 39,
        localVideoPath: path.join(PW_ROOT, "test_results/external/boxingvi_original_20261006/rgb/OfZFdwW322E.mp4"),
        localTruthPath: path.join(PW_ROOT, "test_results/external/boxe_ml/96f3a7d0716040682381fb63f80afac96f74cfa6/clean_annotation_data/V10.csv"),
        remoteTruthUrl: "https://raw.githubusercontent.com/leonardosm14/boxe.ml/96f3a7d0716040682381fb63f80afac96f74cfa6/dataset/clean_annotation_data/V10.csv",
    },
};

const CONFIGS = {
    L1: {
        desc: "URL YouTube, 30 s đầu của đoạn, 1 fps, LOW",
        type: "YOUTUBE",
        length: "30s",
        fps: 1,
        resolution: "MEDIA_RESOLUTION_LOW",
    },
    L2: {
        desc: "URL YouTube, cả đoạn (~63 s), 1 fps, LOW",
        type: "YOUTUBE",
        length: "full",
        fps: 1,
        resolution: "MEDIA_RESOLUTION_LOW",
    },
    L3: {
        desc: "URL YouTube, cả đoạn, 5 fps, LOW",
        type: "YOUTUBE",
        length: "full",
        fps: 5,
        resolution: "MEDIA_RESOLUTION_LOW",
    },
    L4: {
        desc: "File cục bộ qua Files API, cả đoạn, 1 fps, LOW",
        type: "FILES_API",
        length: "full",
        fps: 1,
        resolution: "MEDIA_RESOLUTION_LOW",
    },
};

const REPETITIONS = 3;

// --- 3. Đọc nhãn BoxingVI (csvTruth) ---
function parseCsvTruth(csvText, fps, window) {
    const rows = csvText.trim().split(/\r?\n/).slice(1).map((l) => l.split(","));
    return rows
        .map(([s, e, c]) => ({ s: Number(s), e: Number(e), c: c ? c.trim() : "" }))
        .filter((r) => !window || !(Math.max(r.s, r.e) < window[0] || Math.min(r.s, r.e) >= window[1]))
        .map((r) => ({
            start: r.s / fps,
            end: r.e / fps,
            label: r.c,
            startFrame: r.s,
            endFrame: r.e,
        }));
}

async function loadTruth(caseKey, caseDef, targetOutDir) {
    // 1. Kiểm tra file cục bộ theo python-worker/evaluate_punch_recall.py dòng 538–565
    if (existsSync(caseDef.localTruthPath)) {
        const text = readFileSync(caseDef.localTruthPath, "utf8");
        return { text, origin: `cục bộ: ${caseDef.localTruthPath}` };
    }
    // 2. Kiểm tra nếu đã tải vào <outDir>/labels/<caseKey>.csv
    const labelsDir = path.join(targetOutDir, "labels");
    const cachedPath = path.join(labelsDir, `${caseKey}.csv`);
    if (existsSync(cachedPath)) {
        const text = readFileSync(cachedPath, "utf8");
        return { text, origin: `đã lưu: ${cachedPath}` };
    }
    // 3. Tải từ GitHub commit ghim cố định vào <outDir>/labels/
    mkdirSync(labelsDir, { recursive: true });
    const res = await fetch(caseDef.remoteTruthUrl);
    if (!res.ok) {
        throw new Error(`Không thể tải nhãn từ ${caseDef.remoteTruthUrl} (HTTP ${res.status})`);
    }
    const text = await res.text();
    writeFileSync(cachedPath, text, "utf8");
    return { text, origin: `tải từ GitHub về: ${cachedPath}` };
}

// --- 4. Prompt & Schema (structured output) ---
const PROMPT = `Bạn đóng vai trò trợ lý góc đài boxing. Hãy xem đoạn video của một hiệp đấu và phân tích:
1. Ước lượng số cú đấm (jab, cross, hook, uppercut) của từng võ sĩ (phân biệt theo góc 'red'/'blue' hoặc vị trí đầu đoạn 'left'/'right').
2. Tối đa 3 nhận xét ngắn gọn, thực tế về đối thủ (thói quen ra đòn, sơ hở, cự ly, nhịp độ).
3. Tối đa 3 lời dặn cho hiệp sau, mỗi lời dặn một hành động, tối đa 120 ký tự.
Trả về định dạng JSON theo đúng schema được chỉ định.`;

const SCHEMA = {
    type: "OBJECT",
    properties: {
        boxers: {
            type: "ARRAY",
            description: "Ước lượng số cú đấm của từng võ sĩ (theo góc red/blue hoặc vị trí left/right)",
            items: {
                type: "OBJECT",
                properties: {
                    boxer: { type: "STRING", description: "red, blue, left, hoặc right" },
                    estimated_punches: { type: "INTEGER", description: "Số cú đấm ước lượng" },
                },
                required: ["boxer", "estimated_punches"],
            },
        },
        opponent_observations: {
            type: "ARRAY",
            description: "Tối đa 3 nhận xét về đối thủ",
            items: { type: "STRING" },
        },
        next_round_advice: {
            type: "ARRAY",
            description: "Tối đa 3 lời dặn cho hiệp sau, mỗi lời dặn một hành động, tối đa 120 ký tự",
            items: { type: "STRING" },
        },
    },
    required: ["boxers", "opponent_observations", "next_round_advice"],
};

function extractPunches(parsed) {
    if (!parsed) return 0;
    if (Array.isArray(parsed.boxers)) {
        return parsed.boxers.reduce((sum, b) => {
            const count = Number(b.estimated_punches ?? b.punch_count ?? 0);
            return sum + (Number.isFinite(count) ? count : 0);
        }, 0);
    }
    return 0;
}

// --- 5. Files API Upload (cho L4) ---
async function uploadToFilesApi(filePath, apiKey) {
    const fileBuffer = readFileSync(filePath);
    const fileName = path.basename(filePath);
    const uploadStart = Date.now();

    const initRes = await fetch("https://generativelanguage.googleapis.com/upload/v1beta/files", {
        method: "POST",
        headers: {
            "x-goog-api-key": apiKey,
            "X-Goog-Upload-Protocol": "resumable",
            "X-Goog-Upload-Command": "start",
            "X-Goog-Upload-Header-Content-Length": String(fileBuffer.length),
            "X-Goog-Upload-Header-Content-Type": "video/mp4",
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ file: { display_name: fileName } }),
    });

    if (!initRes.ok) {
        const errText = await initRes.text();
        throw new Error(`Files API init failed HTTP ${initRes.status}: ${errText}`);
    }

    const uploadUrl = initRes.headers.get("x-goog-upload-url");
    if (!uploadUrl) {
        throw new Error("Missing x-goog-upload-url in Files API init response");
    }

    const uploadRes = await fetch(uploadUrl, {
        method: "POST",
        headers: {
            "Content-Length": String(fileBuffer.length),
            "X-Goog-Upload-Offset": "0",
            "X-Goog-Upload-Command": "upload, finalize",
        },
        body: fileBuffer,
    });

    if (!uploadRes.ok) {
        const errText = await uploadRes.text();
        throw new Error(`Files API upload failed HTTP ${uploadRes.status}: ${errText}`);
    }

    const fileInfo = await uploadRes.json();
    let fileObj = fileInfo.file;

    while (fileObj?.state === "PROCESSING") {
        await new Promise((r) => setTimeout(r, 2000));
        const checkRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/${fileObj.name}`, {
            headers: { "x-goog-api-key": apiKey },
        });
        if (!checkRes.ok) break;
        fileObj = await checkRes.json();
    }

    if (fileObj?.state !== "ACTIVE") {
        throw new Error(`File is not ACTIVE, state: ${fileObj?.state}`);
    }

    const uploadMs = Date.now() - uploadStart;
    return { fileUri: fileObj.uri, fileName: fileObj.name, uploadMs };
}

// --- 6. Gọi Gemini generateContent (thử lại 1 lần khi 5xx) ---
async function callGemini({ fileUri, mimeType, videoMetadata, apiKey, model }) {
    const body = {
        contents: [
            {
                parts: [
                    {
                        file_data: { file_uri: fileUri, mime_type: mimeType },
                        video_metadata: videoMetadata,
                    },
                    { text: PROMPT },
                ],
            },
        ],
        generationConfig: {
            responseMimeType: "application/json",
            responseSchema: SCHEMA,
            mediaResolution: "MEDIA_RESOLUTION_LOW",
            maxOutputTokens: 2048,
        },
    };

    let attempts = 0;
    let lastError = null;
    let lastStatus = null;
    let generateMs = 0;
    let resultJson = null;

    for (let attempt = 1; attempt <= 2; attempt++) {
        attempts = attempt;
        const start = Date.now();
        try {
            const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
                method: "POST",
                headers: {
                    "content-type": "application/json",
                    "x-goog-api-key": apiKey,
                },
                body: JSON.stringify(body),
                signal: AbortSignal.timeout(600_000),
            });
            generateMs = Date.now() - start;
            lastStatus = res.status;
            const text = await res.text();
            let json = {};
            try {
                json = JSON.parse(text);
            } catch {
                json = { rawText: text };
            }

            if (res.ok) {
                resultJson = json;
                lastError = null;
                break;
            }

            lastError = json.error?.message || `HTTP ${res.status}`;
            if (res.status >= 500 && attempt < 2) {
                console.log(`    [RETRY] HTTP ${res.status} (lần ${attempt}), chờ 5s rồi thử lại...`);
                await new Promise((r) => setTimeout(r, 5000));
                continue;
            }
            break;
        } catch (err) {
            generateMs = Date.now() - start;
            lastError = err.message || String(err);
            if (attempt < 2) {
                console.log(`    [RETRY] Kết nối lỗi (lần ${attempt}): ${lastError}, chờ 5s rồi thử lại...`);
                await new Promise((r) => setTimeout(r, 5000));
                continue;
            }
            break;
        }
    }

    return {
        generateMs,
        status: lastStatus,
        attempts,
        retries: attempts - 1,
        error: lastError,
        response: resultJson,
    };
}

// --- 7. Tính percentile ---
function percentile(arr, p) {
    if (!arr.length) return null;
    const sorted = [...arr].sort((a, b) => a - b);
    const index = (p / 100) * (sorted.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index - lower;
    return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

// --- 8. Hàm chính ---
async function main() {
    mkdirSync(outDir, { recursive: true });

    // Tải và chuẩn bị nhãn
    const loadedTruth = {};
    for (const [caseKey, caseDef] of Object.entries(CASES)) {
        const { text, origin } = await loadTruth(caseKey, caseDef, outDir);
        const allTruth = parseCsvTruth(text, caseDef.fps, caseDef.window);
        loadedTruth[caseKey] = {
            all: allTruth,
            origin,
        };
    }

    // Xây dựng kế hoạch gọi (4 cấu hình × 2 ca × 3 lần = 24 mục)
    const plan = [];
    for (const [caseKey, caseDef] of Object.entries(CASES)) {
        const caseTruth = loadedTruth[caseKey].all;
        const startSecFull = caseDef.window[0] / caseDef.fps;
        const endSecFull = caseDef.window[1] / caseDef.fps;

        for (const [cfgKey, cfg] of Object.entries(CONFIGS)) {
            const is30s = cfg.length === "30s";
            const startSec = startSecFull;
            const endSec = is30s ? startSecFull + 30.0 : endSecFull;
            const clipDurationSec = endSec - startSec;

            // Lọc số nhãn trong đoạn clip được gửi cho Gemini
            const clipTruth = caseTruth.filter((g) => !(Math.max(g.start, g.end) < startSec || Math.min(g.start, g.end) >= endSec));

            // Kiểm tra file cho L4
            let status = "READY";
            let sourcePathOrUrl = caseDef.url;
            if (cfg.type === "FILES_API") {
                sourcePathOrUrl = caseDef.localVideoPath;
                if (!existsSync(caseDef.localVideoPath)) {
                    status = "SKIPPED_NO_LOCAL_FILE";
                }
            }

            for (let rep = 1; rep <= REPETITIONS; rep++) {
                plan.push({
                    caseKey,
                    caseTitle: caseDef.title,
                    cfgKey,
                    cfgDesc: cfg.desc,
                    rep,
                    type: cfg.type,
                    fps: cfg.fps,
                    resolution: cfg.resolution,
                    startSec: Number(startSec.toFixed(2)),
                    endSec: Number(endSec.toFixed(2)),
                    clipDurationSec: Number(clipDurationSec.toFixed(2)),
                    source: sourcePathOrUrl,
                    clipLabelsCount: clipTruth.length,
                    caseTotalLabels: caseTruth.length,
                    status,
                });
            }
        }
    }

    // --- Chế độ DRY-RUN ---
    if (isDryRun) {
        console.log("================================================================================");
        console.log(" T-039: KẾ HOẠCH ĐO LIVE ROUND FEASIBILITY (--dry-run)");
        console.log("================================================================================");
        console.log(`Thư mục kết quả: ${outDir}`);
        console.log("");
        console.log("1. THÔNG TIN NHÃN DỮ LIỆU:");
        for (const [caseKey, caseDef] of Object.entries(CASES)) {
            const count = loadedTruth[caseKey].all.length;
            const win = caseDef.window;
            console.log(`  - Ca ${caseKey} (${caseDef.title}): khung [${win[0]}, ${win[1]}) -> ${count} nhãn (kỳ vọng: ${caseDef.expectedLabels}, nguồn: ${loadedTruth[caseKey].origin})`);
        }
        console.log("");
        console.log("2. KẾ HOẠCH CÁC LẦN GỌI (4 cấu hình × 2 ca × 3 lần = 24 lần gọi):");
        console.log(
            "STT".padEnd(4) +
            "Ca".padEnd(5) +
            "Cấu hình".padEnd(10) +
            "Lần".padEnd(5) +
            "Độ dài".padEnd(8) +
            "FPS".padEnd(5) +
            "Offset (s)".padEnd(20) +
            "Nhãn".padEnd(6) +
            "Trạng thái".padEnd(24) +
            "Nguồn"
        );
        console.log("-".repeat(120));

        let index = 1;
        for (const item of plan) {
            const offsetStr = `${item.startSec.toFixed(2)}s - ${item.endSec.toFixed(2)}s`;
            const durationStr = `${item.clipDurationSec.toFixed(1)}s`;
            console.log(
                String(index++).padEnd(4) +
                item.caseKey.padEnd(5) +
                item.cfgKey.padEnd(10) +
                `${item.rep}/${REPETITIONS}`.padEnd(5) +
                durationStr.padEnd(8) +
                String(item.fps).padEnd(5) +
                offsetStr.padEnd(20) +
                String(item.clipLabelsCount).padEnd(6) +
                item.status.padEnd(24) +
                item.source
            );
        }

        console.log("-".repeat(120));
        const readyCount = plan.filter((p) => p.status === "READY").length;
        const skippedCount = plan.filter((p) => p.status === "SKIPPED_NO_LOCAL_FILE").length;

        console.log("");
        console.log("3. TỔNG KẾT DRY-RUN:");
        console.log(`  - Tổng số ca: ${Object.keys(CASES).length} (V6, V10)`);
        console.log(`  - Số nhãn V6 trong [36500, 38000): ${loadedTruth.V6.all.length} (khớp T-022)`);
        console.log(`  - Số nhãn V10 trong [4000, 5500): ${loadedTruth.V10.all.length} (khớp T-022)`);
        console.log(`  - Tổng số lần gọi dự kiến: ${plan.length} (${readyCount} READY, ${skippedCount} SKIPPED_NO_LOCAL_FILE)`);
        console.log("  - Chế độ --dry-run: Hoàn thành kiểm tra kế hoạch, không gọi Gemini API.");

        const dryRunSummary = {
            dryRun: true,
            ranAt: new Date().toISOString(),
            cases: {
                V6: { expectedLabels: 85, labelsFound: loadedTruth.V6.all.length, window: CASES.V6.window },
                V10: { expectedLabels: 39, labelsFound: loadedTruth.V10.all.length, window: CASES.V10.window },
            },
            totalPlanned: plan.length,
            readyCount,
            skippedCount,
            plan,
        };
        writeFileSync(path.join(outDir, "summary.json"), JSON.stringify(dryRunSummary, null, 2), "utf8");
        return;
    }

    // --- Chạy THẬT với Gemini API (chỉ chạy khi có GEMINI_API_KEY) ---
    console.log("================================================================================");
    console.log(` T-039: BẮT ĐẦU ĐO LIVE ROUND FEASIBILITY (Model: ${MODEL})`);
    console.log("================================================================================");

    const results = [];
    for (let i = 0; i < plan.length; i++) {
        const item = plan[i];
        console.log(`[${i + 1}/${plan.length}] ${item.caseKey} | ${item.cfgKey} | Lần ${item.rep}/${REPETITIONS} (${item.status})`);

        if (item.status === "SKIPPED_NO_LOCAL_FILE") {
            results.push({
                ...item,
                status: "SKIPPED_NO_LOCAL_FILE",
                upload_ms: null,
                generate_ms: null,
                total_ms: null,
                http_status: null,
                retries: 0,
                error: "Không có file mp4 cục bộ trên máy",
            });
            continue;
        }

        let uploadMs = 0;
        let fileUri = item.source;
        let mimeType = "video/*";
        let uploadedFileName = null;

        if (item.type === "FILES_API") {
            try {
                console.log(`    Tải file lên Files API: ${item.source}...`);
                const up = await uploadToFilesApi(item.source, KEY);
                uploadMs = up.uploadMs;
                fileUri = up.fileUri;
                uploadedFileName = up.fileName;
                mimeType = "video/mp4";
                console.log(`    Tải xong trong ${uploadMs} ms (URI: ${fileUri})`);
            } catch (err) {
                results.push({
                    ...item,
                    status: "FAILED_UPLOAD",
                    upload_ms: null,
                    generate_ms: null,
                    total_ms: null,
                    http_status: null,
                    retries: 0,
                    error: `Upload thất bại: ${err.message}`,
                });
                continue;
            }
        }

        const videoMetadata = {
            fps: item.fps,
            start_offset: `${item.startSec.toFixed(2)}s`,
            end_offset: `${item.endSec.toFixed(2)}s`,
            startOffset: `${item.startSec.toFixed(2)}s`,
            endOffset: `${item.endSec.toFixed(2)}s`,
        };

        const callRes = await callGemini({
            fileUri,
            mimeType,
            videoMetadata,
            apiKey: KEY,
            model: MODEL,
        });

        // Xóa file tạm trên Files API nếu đã tải lên
        if (uploadedFileName) {
            fetch(`https://generativelanguage.googleapis.com/v1beta/${uploadedFileName}`, {
                method: "DELETE",
                headers: { "x-goog-api-key": KEY },
            }).catch(() => {});
        }

        const totalMs = (uploadMs || 0) + (callRes.generateMs || 0);

        if (callRes.error || !callRes.response) {
            results.push({
                ...item,
                status: "FAILED",
                upload_ms: uploadMs || null,
                generate_ms: callRes.generateMs,
                total_ms: totalMs,
                http_status: callRes.status,
                retries: callRes.retries,
                error: callRes.error,
            });
            console.log(`    LỖI: HTTP ${callRes.status} - ${callRes.error}`);
            continue;
        }

        // Trích xuất kết quả structured output
        let parsedOutput = null;
        let rawText = "";
        try {
            rawText = callRes.response.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
            parsedOutput = JSON.parse(rawText);
        } catch (e) {
            parsedOutput = { parseError: e.message, rawText };
        }

        const predictedPunches = extractPunches(parsedOutput);
        const relativeError = item.clipLabelsCount > 0
            ? Math.abs(predictedPunches - item.clipLabelsCount) / item.clipLabelsCount
            : null;

        results.push({
            ...item,
            status: "SUCCESS",
            upload_ms: uploadMs || null,
            generate_ms: callRes.generateMs,
            total_ms: totalMs,
            http_status: callRes.status,
            retries: callRes.retries,
            usageMetadata: callRes.response.usageMetadata,
            predicted_punches: predictedPunches,
            clip_labels: item.clipLabelsCount,
            relative_error: relativeError,
            boxers: parsedOutput?.boxers || [],
            opponent_observations: parsedOutput?.opponent_observations || [],
            next_round_advice: parsedOutput?.next_round_advice || [],
            raw_text: rawText,
        });

        console.log(`    THÀNH CÔNG: generate: ${callRes.generateMs}ms, total: ${totalMs}ms | dự đoán: ${predictedPunches} / nhãn: ${item.clipLabelsCount} (sai số: ${(relativeError * 100).toFixed(1)}%)`);
    }

    // --- Tổng hợp và in bảng thống kê theo cấu hình ---
    const summaryByConfig = {};
    for (const cfgKey of Object.keys(CONFIGS)) {
        const cfgResults = results.filter((r) => r.cfgKey === cfgKey);
        const successResults = cfgResults.filter((r) => r.status === "SUCCESS");
        const failedResults = cfgResults.filter((r) => r.status === "FAILED" || r.status === "FAILED_UPLOAD");
        const totals = successResults.map((r) => r.total_ms);
        const errors = successResults.map((r) => r.relative_error).filter((e) => e !== null);

        summaryByConfig[cfgKey] = {
            desc: CONFIGS[cfgKey].desc,
            totalRuns: cfgResults.length,
            successRuns: successResults.length,
            failedRuns: failedResults.length,
            skippedRuns: cfgResults.filter((r) => r.status === "SKIPPED_NO_LOCAL_FILE").length,
            p50_total_ms: percentile(totals, 50),
            p90_total_ms: percentile(totals, 90),
            median_relative_error: percentile(errors, 50),
            sample_advice: successResults[0]?.next_round_advice || [],
            sample_observations: successResults[0]?.opponent_observations || [],
        };
    }

    console.log("");
    console.log("================================================================================");
    console.log(" BẢNG TỔNG HỢP KẾT QUẢ ĐO THEO CẤU HÌNH");
    console.log("================================================================================");
    console.log(
        "Mã".padEnd(6) +
        "Số lần".padEnd(10) +
        "Thành công".padEnd(12) +
        "Lỗi".padEnd(8) +
        "p50 total (ms)".padEnd(16) +
        "p90 total (ms)".padEnd(16) +
        "Sai số trung vị"
    );
    console.log("-".repeat(85));
    for (const [cfgKey, s] of Object.entries(summaryByConfig)) {
        const p50 = s.p50_total_ms !== null ? `${Math.round(s.p50_total_ms)} ms` : "N/A";
        const p90 = s.p90_total_ms !== null ? `${Math.round(s.p90_total_ms)} ms` : "N/A";
        const err = s.median_relative_error !== null ? `${(s.median_relative_error * 100).toFixed(1)}%` : "N/A";
        console.log(
            cfgKey.padEnd(6) +
            String(s.totalRuns).padEnd(10) +
            String(s.successRuns).padEnd(12) +
            String(s.failedRuns).padEnd(8) +
            p50.padEnd(16) +
            p90.padEnd(16) +
            err
        );
    }
    console.log("-".repeat(85));

    const finalReport = {
        model: MODEL,
        ranAt: new Date().toISOString(),
        summaryByConfig,
        results,
    };

    writeFileSync(path.join(outDir, "summary.json"), JSON.stringify(finalReport, null, 2), "utf8");
    console.log(`Đã ghi toàn bộ kết quả vào: ${path.join(outDir, "summary.json")}`);
}

main().catch((err) => {
    console.error("LỖI KHÔNG XỬ LÝ ĐƯỢC:", err);
    process.exit(1);
});
