"use client";

import { PenLine } from "lucide-react";
import { useId, useMemo, useState } from "react";

import { ReviewStateBadge } from "@/components/domain/status-badges";
import { Button } from "@/components/ui/button";
import { Checkbox, Select } from "@/components/ui/form";
import { EmptyState } from "@/components/ui/states";
import { LIMB_LABELS, STRIKE_TYPES, TECHNIQUE_LABELS } from "@/lib/domain/labels";
import { AI_REVIEW_TERMS, isNeedsReview } from "@/lib/domain/ai-review";
import { isLowConfidence, LOW_CONFIDENCE_THRESHOLD } from "@/lib/domain/rules";
import type { Detection, StrikeType } from "@/lib/domain/types";
import { formatConfidence, formatTimestamp, pluralize } from "@/lib/format";
import { cn } from "@/lib/utils";
import { byStart, detectionAt, reviewedStrikeLabel, strikeObservation } from "@/lib/video/analysis-nav";
import { StrikeShape } from "./analysis-timeline";
import { usePlayback, usePlaybackStore } from "./playback-store";
import { useReview } from "./review-context";
import { ReviewDialog } from "./review-dialog";

const PAGE = 30;

/** Every strike the model detected, with confidence and review state. Select a row to jump to it. */
export function DetectionsPanel({ detections }: { detections: Detection[] }) {
    const store = usePlaybackStore();
    const review = useReview();
    const baseId = useId();
    const [lowOnly, setLowOnly] = useState(false);
    const [type, setType] = useState<StrikeType | "">("");
    const [limit, setLimit] = useState(PAGE);
    const [reviewing, setReviewing] = useState<Detection | null>(null);

    const sorted = useMemo(() => byStart(detections), [detections]);
    const activeId = usePlayback((s) => detectionAt(sorted, s.timeMs)?.id ?? null);
    // "Low confidence" means still unreviewed and below the threshold, matching the queue, badges and summary counts.
    const lowCount = sorted.filter(isNeedsReview).length;
    const filtered = sorted.filter((d) => (!lowOnly || isNeedsReview(d)) && (!type || d.type === type));
    const shown = filtered.slice(0, limit);

    return (
        <div className="flex flex-col gap-3 pt-3">
            <div className="flex flex-wrap items-center gap-3">
                <Checkbox
                    id={`${baseId}-low`}
                    checked={lowOnly}
                    onChange={(event) => {
                        setLowOnly(event.target.checked);
                        setLimit(PAGE);
                    }}
                    label={`${AI_REVIEW_TERMS.lowConfidence} only (${lowCount})`}
                />
                <div className="ml-auto w-36">
                    <label htmlFor={`${baseId}-type`} className="sr-only">
                        Strike type
                    </label>
                    <Select
                        id={`${baseId}-type`}
                        value={type}
                        onChange={(event) => {
                            setType(event.target.value as StrikeType | "");
                            setLimit(PAGE);
                        }}
                    >
                        <option value="">All strikes</option>
                        {STRIKE_TYPES.map((strike) => (
                            <option key={strike} value={strike}>
                                {TECHNIQUE_LABELS[strike]}
                            </option>
                        ))}
                    </Select>
                </div>
            </div>
            <p className="text-xs text-fg-muted" aria-live="polite">
                Showing {Math.min(limit, filtered.length)} of {pluralize(filtered.length, "detection")}
            </p>

            {filtered.length === 0 ? (
                <EmptyState
                    compact
                    title="No detections match"
                    description={
                        lowOnly
                            ? `No unreviewed detections of this type are below the ${Math.round(LOW_CONFIDENCE_THRESHOLD * 100)}% review threshold.`
                            : "The AI detected no strikes of this type."
                    }
                    action={
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                                setLowOnly(false);
                                setType("");
                            }}
                        >
                            Clear filters
                        </Button>
                    }
                />
            ) : (
                <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
                    {shown.map((detection) => {
                        const needsReview = isNeedsReview(detection);
                        return (
                            <li key={detection.id} className={cn("flex items-center gap-2 pr-2", detection.id === activeId ? "bg-primary-soft" : "bg-surface")}>
                                <button
                                    type="button"
                                    onClick={() => {
                                        store.pause();
                                        store.seek(detection.peakMs);
                                    }}
                                    className="flex min-w-0 flex-1 items-center gap-2.5 px-3 py-2 text-left hover:bg-surface-hover/60"
                                    aria-label={`${strikeObservation(detection.type)} at ${formatTimestamp(detection.peakMs)}, ${LIMB_LABELS[detection.limb]}, ${formatConfidence(detection.confidence)} confidence`}
                                >
                                    <span className="w-12 shrink-0 text-xs text-fg-muted tabular-nums">{formatTimestamp(detection.peakMs)}</span>
                                    <StrikeShape type={detection.type} hollow={needsReview} className="size-3.5 shrink-0" />
                                    <span className="min-w-0 flex-1">
                                        <span className={cn("block truncate text-[13px] font-medium", detection.review?.decision === "rejected" ? "text-fg-muted line-through" : "text-fg")}>
                                            {reviewedStrikeLabel(detection)}
                                        </span>
                                        <span className="block truncate text-xs text-fg-muted">
                                            {LIMB_LABELS[detection.limb]} · {formatConfidence(detection.confidence)}
                                        </span>
                                    </span>
                                    <ReviewStateBadge review={detection.review} confidence={detection.confidence} size="sm" className="max-sm:hidden" />
                                </button>
                                {review.canReview && (
                                    <Button variant="ghost" size="icon-sm" onClick={() => setReviewing(detection)} aria-label={`Review ${detection.type} at ${formatTimestamp(detection.peakMs)}`}>
                                        <PenLine />
                                    </Button>
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}
            {filtered.length > limit && (
                <Button variant="secondary" size="sm" className="self-center" onClick={() => setLimit((current) => current + PAGE)}>
                    Show {Math.min(PAGE, filtered.length - limit)} more
                </Button>
            )}
            {reviewing && (
                <ReviewDialog
                    key={reviewing.id}
                    open
                    onClose={() => setReviewing(null)}
                    target={{ kind: "detection", detection: reviewing }}
                    initialDecision={reviewing.review?.decision ?? (isLowConfidence(reviewing.confidence) ? "corrected" : "confirmed")}
                />
            )}
        </div>
    );
}
