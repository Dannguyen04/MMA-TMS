import "server-only";

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { isSupportedVideoUrl, parseVideoSuggestions, type VideoSuggestion } from "@/lib/domain/opponent-video-suggestions";

/**
 * Drafts opponent observations from a public fight video with Gemini (T-033).
 * The key stays on the server. Results are cached on disk per video, opponent and model,
 * because one analysis takes one to three minutes; the coach reviews every suggestion.
 */

const API = "https://generativelanguage.googleapis.com/v1beta/models";
const DEFAULT_MODEL = "gemini-3.8-flash";
const TIMEOUT_MS = 240_000;
const CACHE_DIR = path.join(tmpdir(), "fight-camp-opponent-video-ai");

export type VideoSuggestionsResult =
    | { ok: true; suggestions: VideoSuggestion[]; analyzedAt: string; cached: boolean; model: string }
    | { ok: false; error: "NOT_CONFIGURED" | "UNSUPPORTED_URL" | "TIMEOUT" | "QUOTA" | "UPSTREAM" | "EMPTY" };

const PROMPT = (who: string) => `Bạn hỗ trợ huấn luyện viên võ thuật phân tích đối thủ từ video thi đấu.
Đối thủ cần phân tích: ${who}.
Liệt kê tối đa 6 quan sát về ĐỐI THỦ, chỉ những gì thấy rõ trong video:
- kind: STRENGTH (điểm mạnh nguy hiểm), OPENING (sơ hở có thể khai thác), HABIT (thói quen lặp lại).
- text: một câu tiếng Việt cụ thể về hành vi, tối đa 140 ký tự, ví dụ "Hạ tay phải sau khi tung đòn đá thấp".
- time: mốc thời gian mm:ss trong video nơi thấy rõ nhất.
- confidence: REPEATED nếu thấy từ 2 lần trở lên, ONCE nếu chỉ 1 lần.
Không đoán ngoài video, không nhận xét sức khoẻ hay chấn thương, không đưa lời khuyên chiến thuật.`;

const RESPONSE_SCHEMA = {
    type: "OBJECT",
    properties: {
        observations: {
            type: "ARRAY",
            maxItems: 6,
            items: {
                type: "OBJECT",
                properties: {
                    kind: { type: "STRING", enum: ["STRENGTH", "OPENING", "HABIT"] },
                    text: { type: "STRING" },
                    time: { type: "STRING" },
                    confidence: { type: "STRING", enum: ["ONCE", "REPEATED"] },
                },
                required: ["kind", "text", "time", "confidence"],
            },
        },
    },
    required: ["observations"],
};

function cacheFile(url: string, who: string, model: string): string {
    const hash = createHash("sha256").update(`${model}\n${url.trim()}\n${who.trim().toLowerCase()}`).digest("hex").slice(0, 32);
    return path.join(CACHE_DIR, `${hash}.json`);
}

async function readCache(file: string): Promise<{ suggestions: VideoSuggestion[]; analyzedAt: string } | null> {
    try {
        const data = JSON.parse(await readFile(file, "utf8")) as { suggestions: unknown; analyzedAt: string };
        const suggestions = parseVideoSuggestions({ observations: data.suggestions });
        return suggestions.length > 0 ? { suggestions, analyzedAt: data.analyzedAt } : null;
    } catch {
        return null;
    }
}

export async function suggestObservationsFromVideo(url: string, who: string): Promise<VideoSuggestionsResult> {
    const key = process.env.GEMINI_API_KEY;
    const model = process.env.GEMINI_OPPONENT_MODEL || DEFAULT_MODEL;
    if (!key) return { ok: false, error: "NOT_CONFIGURED" };
    if (!isSupportedVideoUrl(url) || !/^gemini-[A-Za-z0-9._-]+$/.test(model)) return { ok: false, error: "UNSUPPORTED_URL" };

    const file = cacheFile(url, who, model);
    const cached = await readCache(file);
    if (cached) return { ok: true, ...cached, cached: true, model };

    const deadline = AbortSignal.timeout(TIMEOUT_MS);
    const call = () =>
        fetch(`${API}/${model}:generateContent`, {
            method: "POST",
            headers: { "content-type": "application/json", "x-goog-api-key": key },
            body: JSON.stringify({
                contents: [{ parts: [{ file_data: { file_uri: url.trim(), mime_type: "video/*" } }, { text: PROMPT(who.trim()) }] }],
                generationConfig: {
                    responseMimeType: "application/json",
                    responseSchema: RESPONSE_SCHEMA,
                    mediaResolution: "MEDIA_RESOLUTION_LOW",
                    maxOutputTokens: 2048,
                },
            }),
            signal: deadline,
            cache: "no-store",
        });

    let response: Response;
    try {
        response = await call();
        // The free tier answers 500/503 under load; one retry inside the same deadline usually clears it.
        if (response.status >= 500) {
            console.warn(`[opponent-video-ai] ${model} HTTP ${response.status}, retrying once`);
            await new Promise((resolve) => setTimeout(resolve, 3000));
            response = await call();
        }
    } catch (error: unknown) {
        return { ok: false, error: error instanceof Error && error.name === "TimeoutError" ? "TIMEOUT" : "UPSTREAM" };
    }
    if (!response.ok) {
        const detail = (await response.json().catch(() => null)) as { error?: { status?: string; message?: string } } | null;
        console.warn(`[opponent-video-ai] ${model} HTTP ${response.status} ${detail?.error?.status ?? ""}: ${detail?.error?.message?.slice(0, 200) ?? ""}`);
        return { ok: false, error: response.status === 429 ? "QUOTA" : "UPSTREAM" };
    }

    const body = (await response.json().catch(() => null)) as { candidates?: { content?: { parts?: { text?: string }[] } }[] } | null;
    const text = body?.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    let parsed: unknown = null;
    try {
        parsed = JSON.parse(text);
    } catch {
        parsed = null;
    }
    const suggestions = parseVideoSuggestions(parsed);
    if (suggestions.length === 0) return { ok: false, error: "EMPTY" };

    const analyzedAt = new Date().toISOString();
    try {
        await mkdir(CACHE_DIR, { recursive: true });
        await writeFile(file, JSON.stringify({ suggestions, analyzedAt, model }), "utf8");
    } catch {
        // A cache miss next time only costs another call.
    }
    return { ok: true, suggestions, analyzedAt, cached: false, model };
}
