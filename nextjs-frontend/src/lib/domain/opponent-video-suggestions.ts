import { z } from "zod";

import { MAX_OBSERVATIONS } from "./opponent-analysis-form";
import type { OpponentObservation } from "./round-advice";

/** Public YouTube links only: Gemini reads them directly, so no footage is stored by the app. */
const YOUTUBE_URL = /^https:\/\/(www\.|m\.)?(youtube\.com\/(watch\?v=|shorts\/)|youtu\.be\/)[A-Za-z0-9_-]{6,}/;

export function isSupportedVideoUrl(url: string): boolean {
    return YOUTUBE_URL.test(url.trim());
}

const TIME = /^(\d{1,2}:)?\d{1,2}:\d{2}$/;

export const videoSuggestionSchema = z.object({
    kind: z.enum(["STRENGTH", "OPENING", "HABIT"]),
    text: z.string().trim().min(1).max(300),
    time: z.string().trim().regex(TIME),
    confidence: z.enum(["ONCE", "REPEATED"]),
});
export type VideoSuggestion = z.infer<typeof videoSuggestionSchema>;

/** Keeps the well-formed suggestions from the model reply, at most the observation limit. */
export function parseVideoSuggestions(raw: unknown): VideoSuggestion[] {
    const list = z.object({ observations: z.array(z.unknown()) }).safeParse(raw);
    if (!list.success) return [];
    return list.data.observations
        .map((item) => videoSuggestionSchema.safeParse(item))
        .filter((r) => r.success)
        .map((r) => r.data)
        .slice(0, MAX_OBSERVATIONS);
}

export function timeToSeconds(time: string): number {
    return time.split(":").reduce((total, part) => total * 60 + Number(part), 0);
}

/** Link that opens the video at the observed moment. */
export function videoUrlAt(url: string, time: string): string {
    const clean = url.trim().replace(/([?&])t=\d+s?(&|$)/, "$1").replace(/[?&]$/, "");
    return `${clean}${clean.includes("?") ? "&" : "?"}t=${timeToSeconds(time)}s`;
}

/** An accepted suggestion becomes an ordinary observation; the evidence points back to the video moment. */
export function suggestionToObservation(s: VideoSuggestion, url: string, id: string, note: string): OpponentObservation {
    return {
        id,
        kind: s.kind,
        text: s.text,
        confidence: s.confidence,
        evidenceUrl: videoUrlAt(url, s.time),
        evidenceTime: s.time,
        evidenceNote: note,
    };
}
