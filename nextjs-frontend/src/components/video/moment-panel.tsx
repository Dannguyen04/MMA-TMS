"use client";

import { ArrowRight, ChevronLeft, ChevronRight, CircleCheck, CircleX, Crosshair, Gauge, Sparkles, UserCheck, type LucideIcon } from "lucide-react";
import { memo, useId, useMemo, useState, type ReactNode } from "react";

import { AIGeneratedBadge, ReviewStateBadge } from "@/components/domain/status-badges";
import { ConfidenceMeter } from "@/components/domain/confidence-meter";
import { MetricTile } from "@/components/domain/metric-tile";
import { TechniqueChip } from "@/components/domain/technique-chip";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/submit-button";
import { FINDING_IMPACT_LABELS, LIMB_LABELS, MOVEMENT_EVENT_LABELS, REVIEW_DECISION_LABELS } from "@/lib/domain/labels";
import type { AIAnalysis, AIFinding, Detection, MovementEvent } from "@/lib/domain/types";
import { formatNumber, formatTimestamp } from "@/lib/format";
import { cn } from "@/lib/utils";
import { byStart, detectionAt, eventsAt, findingsCiting, nextDetection, previousDetection, strikeObservation } from "@/lib/video/analysis-nav";
import { usePlayback, usePlaybackStore } from "./playback-store";
import { useReview } from "./review-context";
import { ReviewDialog } from "./review-dialog";

export interface MomentPanelProps {
    analysis: AIAnalysis;
    findings: AIFinding[];
    onSelectFinding: (findingId: string) => void;
    className?: string;
}

/**
 * "At this moment": the detection under the playhead, its metrics, the findings that cite it and
 * the human decision — the evidence chain from video to review in one place.
 */
export function MomentPanel({ analysis, findings, onSelectFinding, className }: MomentPanelProps) {
    const store = usePlaybackStore();
    const detections = useMemo(() => byStart(analysis.detections), [analysis.detections]);
    const detectionId = usePlayback((s) => detectionAt(detections, s.timeMs)?.id ?? null);
    const playing = usePlayback((s) => s.playing);
    const detection = detectionId ? (detections.find((d) => d.id === detectionId) ?? null) : null;

    const jump = (direction: "previous" | "next") => {
        const { timeMs } = store.getSnapshot();
        const target = direction === "next" ? nextDetection(detections, timeMs) : previousDetection(detections, timeMs);
        if (target) {
            store.pause();
            store.seek(target.peakMs);
        }
    };

    return (
        <Card className={cn("min-w-0", className)}>
            <div className="flex items-center justify-between gap-3 px-4 pt-3.5 pb-2">
                <h2 className="text-[15px] font-semibold text-fg">At this moment</h2>
                <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon-sm" onClick={() => jump("previous")} aria-label="Previous detection">
                        <ChevronLeft />
                    </Button>
                    <PlayheadClock />
                    <Button variant="ghost" size="icon-sm" onClick={() => jump("next")} aria-label="Next detection">
                        <ChevronRight />
                    </Button>
                </div>
            </div>
            <p aria-live="polite" className="sr-only">
                {playing ? "" : detection ? `${strikeObservation(detection.type)} at ${formatTimestamp(detection.peakMs)}, ${Math.round(detection.confidence * 100)}% confidence.` : "No strike at the playhead."}
            </p>
            <div className="px-4 pb-4">
                {detection ? (
                    <DetectionMoment key={detection.id} detection={detection} analysis={analysis} findings={findings} onSelectFinding={onSelectFinding} />
                ) : (
                    <NoStrikeMoment events={analysis.movementEvents} onJump={jump} />
                )}
            </div>
        </Card>
    );
}

/** The only part of the panel that follows the playhead every 100 ms. */
function PlayheadClock() {
    const tenth = usePlayback((s) => Math.round(s.timeMs / 100));
    return <span className="min-w-14 text-center text-sm font-medium text-fg tabular-nums">{formatTimestamp(tenth * 100)}</span>;
}

function NoStrikeMoment({ events, onJump }: { events: MovementEvent[]; onJump: (direction: "previous" | "next") => void }) {
    const eventId = usePlayback((s) => eventsAt(events, s.timeMs)[0]?.id ?? null);
    const event = eventId ? (events.find((e) => e.id === eventId) ?? null) : null;
    return (
        <div className="rounded-lg border border-dashed border-border px-3 py-4 text-center">
            <p className="text-sm font-medium text-fg">No strike at the playhead</p>
            <p className="mt-1 text-[13px] text-fg-muted">
                {event ? (
                    <>
                        <span className="font-medium text-fg">{MOVEMENT_EVENT_LABELS[event.type]}</span> · {event.detail}
                    </>
                ) : (
                    "Play the clip or pick a marker on the timeline to see what the AI detected."
                )}
            </p>
            <div className="mt-3 flex justify-center gap-2">
                <Button variant="secondary" size="sm" onClick={() => onJump("previous")}>
                    <ChevronLeft aria-hidden />
                    Previous strike
                </Button>
                <Button variant="secondary" size="sm" onClick={() => onJump("next")}>
                    Next strike
                    <ChevronRight aria-hidden />
                </Button>
            </div>
        </div>
    );
}

const DetectionMoment = memo(function DetectionMoment({
    detection,
    analysis,
    findings,
    onSelectFinding,
}: {
    detection: Detection;
    analysis: AIAnalysis;
    findings: AIFinding[];
    onSelectFinding: (findingId: string) => void;
}) {
    const review = useReview();
    const titleId = useId();
    const [dialogOpen, setDialogOpen] = useState(false);
    const cited = findingsCiting(findings, detection.id);
    const combination = detection.combinationId ? analysis.combinations.find((c) => c.id === detection.combinationId) : null;
    const isKick = detection.type === "kick";

    return (
        <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
                <TechniqueChip technique={detection.type} />
                <p id={titleId} tabIndex={-1} className="text-base font-semibold text-fg">
                    {strikeObservation(detection.type)}
                </p>
                <span className="text-[13px] text-fg-muted">{LIMB_LABELS[detection.limb]}</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
                <AIGeneratedBadge size="sm" label="AI detection" />
                <ReviewStateBadge review={detection.review} confidence={detection.confidence} size="sm" />
            </div>
            <ConfidenceMeter confidence={detection.confidence} label={`AI confidence for this ${detection.type}`} />

            <div className="grid grid-cols-2 gap-2">
                <MetricTile label="Peak speed (est.)" value={formatNumber(detection.peakSpeed, 1)} unit="m/s" />
                <MetricTile label="Acceleration proxy" value={formatNumber(detection.accelerationProxy, 1)} unit="/ 10" />
                <MetricTile label={isKick ? "Knee extension at peak" : "Elbow angle at peak"} value={`${detection.jointAngleDeg}°`} />
                <MetricTile label="Hip rotation at peak" value={`${detection.hipRotationDeg}°`} />
                <div className="col-span-2 flex items-center justify-between gap-2 rounded-lg bg-surface-muted px-3 py-2 text-[13px]">
                    <span className="text-fg-muted">Guard maintained</span>
                    {detection.guardMaintained ? (
                        <span className="inline-flex items-center gap-1 font-medium text-success-fg">
                            <CircleCheck aria-hidden className="size-4" />
                            Yes
                        </span>
                    ) : (
                        <span className="inline-flex items-center gap-1 font-medium text-warning-fg">
                            <CircleX aria-hidden className="size-4" />
                            No — guard appears to drop
                        </span>
                    )}
                </div>
            </div>
            {combination && (
                <p className="text-[13px] text-fg-muted">
                    Part of combination <span className="font-medium text-fg">{combination.label}</span>
                </p>
            )}

            <div>
                <h3 className="mb-2 text-xs font-semibold tracking-wide text-fg-subtle uppercase">Evidence chain</h3>
                <ol className="flex flex-col gap-2">
                    <ChainStep icon={Crosshair} label="Detection" done>
                        {strikeObservation(detection.type)} at {formatTimestamp(detection.peakMs)}
                    </ChainStep>
                    <ChainStep icon={Gauge} label="Metrics" done>
                        {formatNumber(detection.peakSpeed, 1)} m/s · {detection.jointAngleDeg}° · {detection.guardMaintained ? "guard kept" : "guard dropped"}
                    </ChainStep>
                    <ChainStep icon={Sparkles} label="Findings" done={cited.length > 0}>
                        {cited.length === 0 ? (
                            <span className="text-fg-muted">No finding cites this strike.</span>
                        ) : (
                            <ul className="mt-1 flex flex-col gap-1">
                                {cited.map((finding) => (
                                    <li key={finding.id}>
                                        <button
                                            type="button"
                                            onClick={() => onSelectFinding(finding.id)}
                                            className="group flex w-full items-start gap-2 rounded-md px-1.5 py-1 text-left hover:bg-surface-hover"
                                        >
                                            <span className="min-w-0 flex-1">
                                                <span className="block text-[13px] font-medium text-fg group-hover:underline">{finding.title}</span>
                                                <span className="text-xs text-fg-muted">{FINDING_IMPACT_LABELS[finding.impact]}</span>
                                            </span>
                                            <ArrowRight aria-hidden className="mt-0.5 size-3.5 shrink-0 text-fg-subtle" />
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </ChainStep>
                    <ChainStep icon={UserCheck} label="Human review" done={detection.review !== null} last>
                        {detection.review ? (
                            <>
                                {REVIEW_DECISION_LABELS[detection.review.decision]} by {detection.review.reviewerName}
                                {detection.review.correctedLabel && <> → “{detection.review.correctedLabel}”</>}
                                {detection.review.note && <span className="block text-fg-muted">“{detection.review.note}”</span>}
                            </>
                        ) : (
                            <span className="text-fg-muted">Not reviewed yet</span>
                        )}
                    </ChainStep>
                </ol>
            </div>

            {review.canReview && (
                <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
                    <form
                        action={async (formData) => {
                            // The button turns into a disabled "Confirmed"; keep keyboard focus on this detection.
                            document.getElementById(titleId)?.focus();
                            await review.submitDetectionReview(formData);
                        }}
                    >
                        <input type="hidden" name="analysisId" value={review.analysisId} />
                        <input type="hidden" name="detectionId" value={detection.id} />
                        <input type="hidden" name="decision" value="confirmed" />
                        <SubmitButton size="sm" variant="secondary" disabled={detection.review?.decision === "confirmed"}>
                            <CircleCheck aria-hidden />
                            {detection.review?.decision === "confirmed" ? "Confirmed" : "Confirm detection"}
                        </SubmitButton>
                    </form>
                    <Button size="sm" variant="ghost" onClick={() => setDialogOpen(true)}>
                        Correct or reject…
                    </Button>
                </div>
            )}
            {dialogOpen && <ReviewDialog open onClose={() => setDialogOpen(false)} target={{ kind: "detection", detection }} initialDecision="corrected" />}
        </div>
    );
});

function ChainStep({ icon: Icon, label, done, last = false, children }: { icon: LucideIcon; label: string; done: boolean; last?: boolean; children: ReactNode }) {
    return (
        <li className="relative flex gap-2.5">
            {!last && <span aria-hidden className="absolute top-6 bottom-[-8px] left-[11px] w-px bg-border" />}
            <span
                aria-hidden
                className={cn(
                    "relative flex size-6 shrink-0 items-center justify-center rounded-full ring-1",
                    done ? "bg-primary-soft text-primary-soft-fg ring-primary/25" : "bg-surface-muted text-fg-subtle ring-border",
                )}
            >
                <Icon className="size-3.5" />
            </span>
            <div className="min-w-0 flex-1 pt-0.5 text-[13px] text-fg">
                <p className="text-[11px] font-semibold tracking-wide text-fg-subtle uppercase">{label}</p>
                {children}
            </div>
        </li>
    );
}
