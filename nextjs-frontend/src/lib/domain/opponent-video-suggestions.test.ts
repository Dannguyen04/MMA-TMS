import { describe, expect, it } from "vitest";

import { buildOpponentAnalysisInput } from "./opponent-analysis-form";
import {
    isSupportedVideoUrl,
    parseVideoSuggestions,
    suggestionToObservation,
    timeToSeconds,
    videoUrlAt,
} from "./opponent-video-suggestions";

describe("isSupportedVideoUrl", () => {
    it("accepts public YouTube links and rejects others", () => {
        expect(isSupportedVideoUrl("https://www.youtube.com/watch?v=dKw5POIXlsI")).toBe(true);
        expect(isSupportedVideoUrl("https://youtu.be/dKw5POIXlsI")).toBe(true);
        expect(isSupportedVideoUrl("https://www.youtube.com/shorts/abcdef123")).toBe(true);
        expect(isSupportedVideoUrl("http://www.youtube.com/watch?v=dKw5POIXlsI")).toBe(false);
        expect(isSupportedVideoUrl("https://vimeo.com/123456")).toBe(false);
        expect(isSupportedVideoUrl("https://www.youtube.com.evil.test/watch?v=x")).toBe(false);
    });
});

describe("parseVideoSuggestions", () => {
    it("keeps well-formed items, drops bad ones, caps at 6", () => {
        const good = { kind: "OPENING", text: "Hạ tay phải sau jab", time: "01:53", confidence: "REPEATED" };
        const raw = {
            observations: [
                good,
                { ...good, kind: "INJURY" },
                { ...good, time: "về cuối hiệp" },
                { ...good, text: "" },
                ...Array.from({ length: 8 }, () => good),
            ],
        };
        const parsed = parseVideoSuggestions(raw);
        expect(parsed).toHaveLength(6);
        expect(parsed[0]).toEqual(good);
    });

    it("returns nothing for a reply without the expected shape", () => {
        expect(parseVideoSuggestions(null)).toEqual([]);
        expect(parseVideoSuggestions({ items: [] })).toEqual([]);
    });
});

describe("video links", () => {
    it("converts mm:ss and h:mm:ss to seconds", () => {
        expect(timeToSeconds("01:53")).toBe(113);
        expect(timeToSeconds("1:02:03")).toBe(3723);
    });

    it("opens the video at the observed moment, replacing an existing t=", () => {
        expect(videoUrlAt("https://www.youtube.com/watch?v=abc123", "01:53")).toBe("https://www.youtube.com/watch?v=abc123&t=113s");
        expect(videoUrlAt("https://youtu.be/abc123?t=20", "00:10")).toBe("https://youtu.be/abc123?t=10s");
    });

    it("turns an accepted suggestion into an observation the save helper accepts", () => {
        const o = suggestionToObservation(
            { kind: "OPENING", text: "Hạ tay phải sau jab", time: "01:53", confidence: "REPEATED" },
            "https://www.youtube.com/watch?v=abc123",
            "obs-5",
            "AI gợi ý từ video",
        );
        expect(o).toMatchObject({ id: "obs-5", evidenceTime: "01:53", evidenceUrl: "https://www.youtube.com/watch?v=abc123&t=113s" });
        const saved = buildOpponentAnalysisInput({ observations: [o], tactics: [] }, { observations: [], tactics: [] }, 3);
        expect(saved.success).toBe(true);
        if (saved.success) expect(saved.data.observations[0]?.evidenceTime).toBe("01:53");
    });
});
