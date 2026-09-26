import type { CoachFeedback } from "@/lib/domain/types";
import type { VideoLibraryItem } from "@/lib/services/videos";

/** Pure merge for the fighter's "From your corner" feed. Safe for Server and Client Components. */

export type CornerFeedItem =
    | { kind: "feedback"; id: string; at: string; feedback: CoachFeedback }
    | { kind: "video"; id: string; at: string; item: VideoLibraryItem };

export const CORNER_FEED_LIMIT = 3;

/**
 * Coach feedback and the fighter's own uploads, newest first. An upload the coach has already written
 * feedback about is left out: the feedback links to it and says more.
 */
export function cornerFeedItems(feedback: CoachFeedback[], videos: VideoLibraryItem[], limit = CORNER_FEED_LIMIT): CornerFeedItem[] {
    const discussed = new Set(feedback.flatMap((entry) => (entry.videoId ? [entry.videoId] : [])));
    const items: CornerFeedItem[] = [
        ...feedback.map((entry) => ({ kind: "feedback" as const, id: `feedback-${entry.id}`, at: entry.createdAt, feedback: entry })),
        ...videos
            .filter((item) => !discussed.has(item.video.id))
            .map((item) => ({ kind: "video" as const, id: `video-${item.video.id}`, at: item.video.uploadedAt, item })),
    ];
    return items.sort((a, b) => Date.parse(b.at) - Date.parse(a.at)).slice(0, limit);
}
