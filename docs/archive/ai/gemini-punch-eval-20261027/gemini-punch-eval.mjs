// Experiment: can Gemini count punches on the clips the current detector was scored on?
// Read-only on repo data; writes results to the scratchpad. Usage: GEMINI_API_KEY=... node gemini-punch-eval.mjs <outDir> [case...]
import { spawnSync } from "node:child_process";
import { readFileSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";

const OUT = process.argv[2];
const ONLY = process.argv.slice(3);
const KEY = process.env.GEMINI_API_KEY;
const MODEL = process.env.GEMINI_MODEL || "gemini-3.8-flash";
const PW = "D:/test/ai/python-worker";
const BOXE = `${PW}/test_results/external/boxe_ml/96f3a7d0716040682381fb63f80afac96f74cfa6`;

function csvTruth(file, fps, window) {
    const rows = readFileSync(file, "utf8").trim().split(/\r?\n/).slice(1).map((l) => l.split(","));
    return rows
        .map(([s, e, c]) => ({ s: Number(s), e: Number(e), c }))
        .filter((r) => !window || !(Math.max(r.s, r.e) < window[0] || Math.min(r.s, r.e) >= window[1]))
        .map((r) => ({ start: r.s / fps, end: r.e / fps, label: r.c }));
}

const vid01 = JSON.parse(readFileSync(`${PW}/ground_truth/gt_01_cross_heavybag.json`, "utf8"))
    .events.filter((e) => /PUNCH/i.test(e.label) && e.evaluation_scope !== "OUT_OF_SCOPE")
    .map((e) => ({ start: e.start_time, end: e.end_time, label: e.type }));

const CASES = {
    vid01: {
        title: "vid_01 bao cát (1 người)",
        source: { file: `${PW}/validation_videos/vid_01_cross_heavybag.mp4` },
        who: "the single athlete hitting the heavy bag",
        truth: vid01,
        offset: 0,
        detector: "5/5, 0 dư (T-012)",
    },
    adam: {
        title: "Adam đánh bóng (1 người)",
        source: { file: `${BOXE}/adam.mp4` },
        who: "the single athlete shadow boxing",
        truth: csvTruth(`${BOXE}/adam_gt.csv`, 30, null),
        offset: 0,
        detector: "8/18, 3 dư (T-012)",
    },
    v6: {
        title: "BoxingVI V6 trận thật, đoạn 63 giây (2 võ sĩ)",
        source: { url: "https://www.youtube.com/watch?v=cQW-h8yGbRc", startSec: 36500 / 23.976023976, endSec: 38000 / 23.976023976 },
        who: "both boxers (count punches thrown by either boxer)",
        truth: csvTruth(`${BOXE}/clean_annotation_data/V6.csv`, 23.976023976, [36500, 38000]),
        offset: 36500 / 23.976023976,
        detector: "0/85 (T-022 baseline)",
    },
};

const PROMPT = (who, clipSeconds) => `You are annotating punches in a boxing/MMA video for evaluation.
Count every punch thrown by ${who}. A punch is a jab, cross, hook or uppercut that is fully thrown (extended toward the target), whether it lands or not.
Do not count feints, guard adjustments, kicks, clinch pushes or the referee.
For each punch give "t": the time of maximum extension in seconds from the start of THIS clip (decimal, 0.1 s precision${clipSeconds ? `, between 0 and ${clipSeconds.toFixed(1)}` : ""}), "hand": left or right, "type": jab, cross, hook, uppercut or unknown.
List punches in time order. Be exhaustive but do not invent punches you cannot see.`;

const SCHEMA = {
    type: "OBJECT",
    properties: {
        punches: {
            type: "ARRAY",
            items: {
                type: "OBJECT",
                properties: {
                    t: { type: "NUMBER" },
                    hand: { type: "STRING", enum: ["left", "right"] },
                    type: { type: "STRING", enum: ["jab", "cross", "hook", "uppercut", "unknown"] },
                },
                required: ["t", "hand", "type"],
            },
        },
    },
    required: ["punches"],
};

async function ask(c) {
    const part = c.source.file
        ? { inline_data: { mime_type: "video/mp4", data: readFileSync(c.source.file).toString("base64") } }
        : { file_data: { file_uri: c.source.url, mime_type: "video/*" } };
    const meta = { fps: 10 };
    if (c.source.startSec !== undefined) {
        meta.start_offset = `${c.source.startSec.toFixed(2)}s`;
        meta.end_offset = `${c.source.endSec.toFixed(2)}s`;
    }
    const clip = c.source.startSec !== undefined ? c.source.endSec - c.source.startSec : null;
    const body = {
        contents: [{ parts: [{ ...part, video_metadata: meta }, { text: PROMPT(c.who, clip) }] }],
        generationConfig: { responseMimeType: "application/json", responseSchema: SCHEMA, mediaResolution: "MEDIA_RESOLUTION_LOW", maxOutputTokens: 32768 },
    };
    for (let attempt = 1; attempt <= 3; attempt++) {
        const started = Date.now();
        // curl instead of fetch: Node's fetch gives up after 300 s waiting for headers.
        const bodyFile = path.join(OUT, `gemini-body-${process.pid}.json`);
        writeFileSync(bodyFile, JSON.stringify(body));
        const out = spawnSync("curl", [
            "-s", "--max-time", "600", "-w", "\n%{http_code}",
            "-H", "content-type: application/json", "-H", `x-goog-api-key: ${KEY}`,
            "--data-binary", `@${bodyFile}`,
            `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
        ], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
        unlinkSync(bodyFile);
        const nl = out.stdout.lastIndexOf("\n");
        const res = { status: Number(out.stdout.slice(nl + 1)) };
        res.ok = res.status >= 200 && res.status < 300;
        let json = {};
        try { json = JSON.parse(out.stdout.slice(0, nl)); } catch { json = { error: { status: `curl exit ${out.status}` } }; }
        const seconds = (Date.now() - started) / 1000;
        if (res.ok) {
            const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
            return { punches: JSON.parse(text).punches ?? [], seconds, usage: json.usageMetadata };
        }
        console.log(`  ${c.title}: HTTP ${res.status} ${json.error?.status} (attempt ${attempt})`);
        if (res.status && res.status < 500) throw new Error(json.error?.message);
        await new Promise((r) => setTimeout(r, 5000));
    }
    throw new Error("gave up after 3 attempts");
}

/** One-to-one: each prediction claims the unclaimed truth interval (± tol) whose centre is nearest. */
function score(truth, preds, tol) {
    const used = new Set();
    let tp = 0;
    const sorted = [...preds].sort((a, b) => a.t - b.t);
    for (const p of sorted) {
        let best = -1;
        let bestD = Infinity;
        truth.forEach((g, i) => {
            if (used.has(i) || p.t < g.start - tol || p.t > g.end + tol) return;
            const d = Math.abs(p.t - (g.start + g.end) / 2);
            if (d < bestD) [best, bestD] = [i, d];
        });
        if (best >= 0) {
            used.add(best);
            tp++;
        }
    }
    return { tp, fp: preds.length - tp, fn: truth.length - tp, recall: tp / truth.length, precision: preds.length ? tp / preds.length : 0 };
}

const report = { model: MODEL, ranAt: new Date().toISOString(), cases: {} };
for (const [id, c] of Object.entries(CASES)) {
    if (ONLY.length && !ONLY.includes(id)) continue;
    const truth = c.truth.map((g) => ({ ...g, start: g.start - c.offset, end: g.end - c.offset }));
    try {
        const r = await ask(c);
        const strict = score(truth, r.punches, 3 / 24);
        const loose = score(truth, r.punches, 0.5);
        report.cases[id] = { title: c.title, truth: truth.length, predicted: r.punches.length, strict, loose, detector: c.detector, seconds: r.seconds, videoTokens: r.usage?.promptTokensDetails?.find((d) => d.modality === "VIDEO")?.tokenCount, punches: r.punches };
        console.log(`${c.title}: nhãn ${truth.length}, Gemini ${r.punches.length} | khớp ±3 khung: ${strict.tp} (recall ${(strict.recall * 100).toFixed(0)}%, precision ${(strict.precision * 100).toFixed(0)}%) | khớp ±0,5s: ${loose.tp} (recall ${(loose.recall * 100).toFixed(0)}%, precision ${(loose.precision * 100).toFixed(0)}%) | detector: ${c.detector} | ${r.seconds.toFixed(0)}s`);
    } catch (e) {
        report.cases[id] = { title: c.title, error: String(e.message || e) };
        console.log(`${c.title}: LỖI ${e.message}`);
    }
}
writeFileSync(path.join(OUT, "gemini-punch-eval.json"), JSON.stringify(report, null, 2));
