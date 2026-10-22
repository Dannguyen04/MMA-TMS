import { isLowConfidence } from "@/lib/domain/rules";
import type { AIFinding, CoachFeedback, FindingImpact } from "@/lib/domain/types";
import type { VideoLibraryItem } from "@/lib/services/videos";

/** Pure helpers for the fighter's "From your corner" feed and the AI lead on Today. Safe for Server and Client Components. */

/** What to work on comes before what already works. */
const IMPACT_ORDER: Record<FindingImpact, number> = { concern: 0, improvement: 1, strength: 2 };

/** Coach-verified first, then confident AI output, then what still needs a human check. */
function trustRank(finding: Pick<AIFinding, "review" | "confidence">): number {
    if (finding.review) return 0;
    return isLowConfidence(finding.confidence) ? 2 : 1;
}

/**
 * The one finding the fighter's Today leads with: never one a coach rejected; human-verified ahead of AI-only,
 * confident ahead of low-confidence, what to work on ahead of strengths, then the most confident. Null when
 * nothing is left to show.
 */
export function headlineFinding<T extends Pick<AIFinding, "review" | "confidence" | "impact">>(findings: readonly T[]): T | null {
    const shown = findings.filter((finding) => finding.review?.decision !== "rejected");
    const ranked = [...shown].sort(
        (a, b) => trustRank(a) - trustRank(b) || IMPACT_ORDER[a.impact] - IMPACT_ORDER[b.impact] || b.confidence - a.confidence,
    );
    return ranked[0] ?? null;
}

export type CornerFeedItem =
    | { kind: "feedback"; id: string; at: string; feedback: CoachFeedback }
    | { kind: "video"; id: string; at: string; item: VideoLibraryItem };

const CORNER_FEED_LIMIT = 3;

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
