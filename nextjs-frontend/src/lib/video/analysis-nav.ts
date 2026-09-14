import { TECHNIQUE_LABELS } from "@/lib/domain/labels";
import type { AIFinding, Detection, MovementEvent, StrikeType } from "@/lib/domain/types";

/** Pure helpers for moving around an analysis by time (player, timeline, moment panel). */

/** A detection counts as "at the playhead" slightly before it starts and while the limb returns. */
const LEAD_IN_MS = 120;
const FOLLOW_THROUGH_MS = 220;

/** A copy sorted by start time. */
export function byStart<T extends { startMs: number }>(items: T[]): T[] {
    return [...items].sort((a, b) => a.startMs - b.startMs);
}

/** The detection under the playhead, if any. `detections` must be sorted by start time. */
export function detectionAt(detections: Detection[], timeMs: number): Detection | null {
    let lo = 0;
    let hi = detections.length - 1;
    let found = -1;
    while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (detections[mid].startMs - LEAD_IN_MS <= timeMs) {
            found = mid;
            lo = mid + 1;
        } else hi = mid - 1;
    }
    for (let i = found; i >= 0 && i >= found - 1; i--) {
        const d = detections[i];
        if (timeMs >= d.startMs - LEAD_IN_MS && timeMs <= d.endMs + FOLLOW_THROUGH_MS) return d;
    }
    return null;
}

/** First detection whose peak is after the playhead. */
export function nextDetection(detections: Detection[], timeMs: number): Detection | null {
    return detections.find((d) => d.peakMs > timeMs + 40) ?? null;
}

/** Last detection whose peak is before the playhead. */
export function previousDetection(detections: Detection[], timeMs: number): Detection | null {
    for (let i = detections.length - 1; i >= 0; i--) {
        if (detections[i].peakMs < timeMs - 40) return detections[i];
    }
    return null;
}

/** Movement events active at the playhead. */
export function eventsAt(events: MovementEvent[], timeMs: number): MovementEvent[] {
    return events.filter((e) => e.startMs <= timeMs && timeMs <= Math.max(e.endMs, e.startMs + 150));
}

/** Findings that cite a detection as evidence. */
export function findingsCiting(findings: AIFinding[], detectionId: string): AIFinding[] {
    return findings.filter((f) => f.detectionIds.includes(detectionId));
}

/** AI wording for a strike: an observation, never a verdict. */
export function strikeObservation(type: StrikeType): string {
    return `Possible ${TECHNIQUE_LABELS[type].toLowerCase()}`;
}

/** The label a human settled on, or the AI's label when unreviewed. */
export function reviewedStrikeLabel(detection: Pick<Detection, "type" | "review">): string {
    if (detection.review?.decision === "corrected" && detection.review.correctedLabel) return detection.review.correctedLabel;
    return TECHNIQUE_LABELS[detection.type];
}
