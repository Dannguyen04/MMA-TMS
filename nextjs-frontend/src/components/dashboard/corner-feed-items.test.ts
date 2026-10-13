import { describe, expect, it } from "vitest";

import type { AIFeedback, AIFinding, CoachFeedback, Fighter, Video } from "@/lib/domain/types";
import type { VideoLibraryItem } from "@/lib/services/videos";
import { cornerFeedItems, headlineFinding } from "./corner-feed-items";

type Ranked = Pick<AIFinding, "review" | "confidence" | "impact"> & { id: string };

function finding(id: string, impact: AIFinding["impact"], confidence: number, decision: AIFeedback["decision"] | null = null): Ranked {
    const review = decision ? ({ decision, reviewerId: "c-1", reviewerName: "Coach", reviewedAt: "2026-10-01T00:00:00Z", note: null, correctedLabel: null } satisfies AIFeedback) : null;
    return { id, impact, confidence, review };
}

describe("headlineFinding", () => {
    it("leads with what a coach verified", () => {
        expect(headlineFinding([finding("ai", "concern", 0.95), finding("coach", "strength", 0.7, "confirmed")])?.id).toBe("coach");
    });

    it("never leads with a finding the coach rejected", () => {
        expect(headlineFinding([finding("rejected", "concern", 0.99, "rejected"), finding("ai", "improvement", 0.8)])?.id).toBe("ai");
        expect(headlineFinding([finding("rejected", "concern", 0.99, "rejected")])).toBeNull();
    });

    it("prefers confident AI output, then what to work on, then the most confident", () => {
        expect(headlineFinding([finding("low", "concern", 0.4), finding("ok", "strength", 0.7)])?.id).toBe("ok");
        expect(headlineFinding([finding("strength", "strength", 0.9), finding("concern", "concern", 0.7)])?.id).toBe("concern");
        expect(headlineFinding([finding("a", "improvement", 0.7), finding("b", "improvement", 0.85)])?.id).toBe("b");
    });

    it("is null without findings", () => {
        expect(headlineFinding([])).toBeNull();
    });
});

function feedback(id: string, createdAt: string, videoId: string | null = null): CoachFeedback {
    return { id, fighterId: "f-1", coachId: "c-1", sessionId: null, videoId, kind: "note", body: "", techniques: [], createdAt };
}

function video(id: string, uploadedAt: string): VideoLibraryItem {
    return { video: { id, uploadedAt } as Video, fighter: { id: "f-1" } as Fighter, job: null, analysis: null };
}

describe("cornerFeedItems", () => {
    it("merges feedback and uploads newest first, up to the limit", () => {
        const items = cornerFeedItems(
            [feedback("a", "2026-09-20T10:00:00Z"), feedback("b", "2026-09-25T10:00:00Z")],
            [video("v1", "2026-09-24T10:00:00Z"), video("v2", "2026-09-10T10:00:00Z")],
        );
        expect(items.map((item) => item.id)).toEqual(["feedback-b", "video-v1", "feedback-a"]);
    });

    it("leaves out an upload the coach already wrote feedback about", () => {
        const items = cornerFeedItems([feedback("a", "2026-09-20T10:00:00Z", "v1")], [video("v1", "2026-09-24T10:00:00Z"), video("v2", "2026-09-10T10:00:00Z")]);
        expect(items.map((item) => item.id)).toEqual(["feedback-a", "video-v2"]);
    });

    it("is empty when there is nothing from the corner yet", () => {
        expect(cornerFeedItems([], [])).toEqual([]);
    });
});
