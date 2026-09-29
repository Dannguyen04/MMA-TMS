import { describe, expect, it } from "vitest";

import type { CoachFeedback, Fighter, Video } from "@/lib/domain/types";
import type { VideoLibraryItem } from "@/lib/services/videos";
import { cornerFeedItems } from "./corner-feed-items";

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
