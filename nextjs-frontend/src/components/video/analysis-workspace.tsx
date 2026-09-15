"use client";

import { TriangleAlert } from "lucide-react";
import { useOptimistic, useState, type ReactNode } from "react";

import { Card } from "@/components/ui/card";
import { Tabs } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import type { ActionState } from "@/lib/actions/state";
import { reviewDetectionAction, reviewFindingAction } from "@/lib/actions/video";
import type { AIAnalysis, AIFeedback, AIJob, ReviewDecision, Stance, Video } from "@/lib/domain/types";
import { AnalysisTimeline, type TimelineObservation } from "./analysis-timeline";
import { CoachReviewPanel } from "./coach-review-panel";
import { DetectionsPanel } from "./detections-panel";
import { FindingsPanel, matchesFindingFilter, type FindingFilter } from "./findings-panel";
import { MetricsPanel } from "./metrics-panel";
import { MomentPanel } from "./moment-panel";
import { createPlaybackStore, PlaybackProvider } from "./playback-store";
import { PosePlayer } from "./pose-player";
import { ProvenanceCard } from "./provenance-card";
import { ReviewContext, type ReviewContextValue } from "./review-context";

type SideTab = "findings" | "detections" | "review";

interface ReviewUpdate {
    kind: "finding" | "detection";
    id: string;
    review: AIFeedback;
}

const DECISIONS: ReviewDecision[] = ["confirmed", "corrected", "rejected"];

function applyReview(analysis: AIAnalysis, update: ReviewUpdate): AIAnalysis {
    if (update.kind === "finding") {
        return { ...analysis, findings: analysis.findings.map((f) => (f.id === update.id ? { ...f, review: update.review } : f)) };
    }
    return { ...analysis, detections: analysis.detections.map((d) => (d.id === update.id ? { ...d, review: update.review } : d)) };
}

function feedbackFromForm(formData: FormData, viewer: { id: string; name: string }): AIFeedback {
    const decisionValue = String(formData.get("decision"));
    const decision = DECISIONS.find((d) => d === decisionValue) ?? "confirmed";
    const note = String(formData.get("note") ?? "").trim();
    const label = String(formData.get("correctedLabel") ?? "").trim();
    return {
        decision,
        reviewerId: viewer.id,
        reviewerName: viewer.name,
        reviewedAt: new Date().toISOString(),
        note: note || null,
        correctedLabel: decision === "corrected" ? label || null : null,
    };
}

export interface AnalysisWorkspaceProps {
    analysis: AIAnalysis;
    video: Pick<Video, "id" | "title" | "sourceUrl" | "cameraAngle" | "fileName" | "resolution">;
    job: AIJob | null;
    stance: Stance;
    viewer: { id: string; name: string };
    /** Coaches with ai_findings:review. Fighters and doctors see review results read-only. */
    canReview: boolean;
    /** AI movement observations for the timeline (sports doctors only). */
    observations?: TimelineObservation[];
    /** Playhead position on load, from `?t=`. */
    initialMs: number;
    now: string;
    /** AI summary and notices. Shown above the workspace on wide screens and below the player on smaller ones. */
    summary: ReactNode;
}

/**
 * The analysis workspace: Video → Timeline → Detection → Metric → AI finding → Human review.
 * Player, timeline and panels share one playhead; reviews apply optimistically.
 */
export function AnalysisWorkspace({ analysis, video, job, stance, viewer, canReview, observations, initialMs, now, summary }: AnalysisWorkspaceProps) {
    const toast = useToast();
    const [store] = useState(() => createPlaybackStore(analysis.durationMs, initialMs));
    const [current, addOptimistic] = useOptimistic(analysis, applyReview);
    const [tab, setTab] = useState<SideTab>("findings");
    const [tabsVersion, setTabsVersion] = useState(0);
    const [filter, setFilter] = useState<FindingFilter>("all");
    const [highlightedFinding, setHighlightedFinding] = useState<string | null>(null);

    const report = (result: ActionState<unknown>) => {
        if (result.status === "success") toast({ title: "Review saved", description: result.message });
        else toast({ tone: "error", title: "Review not saved", description: result.message ?? "Try again." });
    };

    const review: ReviewContextValue = {
        canReview,
        analysisId: analysis.id,
        submitFindingReview: async (formData, options) => {
            addOptimistic({ kind: "finding", id: String(formData.get("findingId")), review: feedbackFromForm(formData, viewer) });
            const result = await reviewFindingAction({ status: "idle" }, formData);
            if (options?.report !== false) report(result);
            return result;
        },
        submitDetectionReview: async (formData, options) => {
            addOptimistic({ kind: "detection", id: String(formData.get("detectionId")), review: feedbackFromForm(formData, viewer) });
            const result = await reviewDetectionAction({ status: "idle" }, formData);
            if (options?.report !== false) report(result);
            return result;
        },
    };

    const selectFinding = (findingId: string) => {
        setHighlightedFinding(findingId);
        const finding = current.findings.find((f) => f.id === findingId);
        if (finding && !matchesFindingFilter(finding, filter)) setFilter("all");
        if (tab !== "findings") {
            setTab("findings");
            setTabsVersion((v) => v + 1);
        }
    };

    const unreviewedFindings = current.findings.filter((f) => f.review === null).length;

    return (
        <ReviewContext.Provider value={review}>
            <PlaybackProvider store={store}>
                {/* Below xl the player comes first so the footage is on screen before the summary text. */}
                <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(340px,400px)]">
                    <div className="min-w-0 xl:col-span-2 xl:row-start-1">{summary}</div>
                    <div className="order-first min-w-0 xl:order-none xl:col-start-1 xl:row-start-2">
                        <PosePlayer analysis={current} stance={stance} cameraAngle={video.cameraAngle} sourceUrl={video.sourceUrl} title={video.title} />
                    </div>
                    <div className="min-w-0 xl:col-start-1 xl:row-start-3">
                        <AnalysisTimeline analysis={current} findings={current.findings} observations={observations} onSelectFinding={selectFinding} />
                    </div>
                    <aside
                        aria-label="Analysis details"
                        className="scrollbar-thin flex min-w-0 flex-col gap-4 xl:sticky xl:top-20 xl:col-start-2 xl:row-span-3 xl:row-start-2 xl:max-h-[calc(100dvh-6rem)] xl:self-start xl:overflow-y-auto xl:pb-1"
                    >
                        <MomentPanel analysis={current} findings={current.findings} onSelectFinding={selectFinding} />
                        <Card className="min-w-0 px-4 pb-4">
                            <Tabs
                                key={tabsVersion}
                                label="Findings, detections and coach review"
                                defaultTab={tab}
                                onChange={(id) => setTab(id as SideTab)}
                                items={[
                                    {
                                        id: "findings",
                                        label: (
                                            <>
                                                Findings
                                                <TabCount value={current.findings.length} attention={canReview ? unreviewedFindings : 0} />
                                            </>
                                        ),
                                        content: (
                                            <FindingsPanel
                                                findings={current.findings}
                                                now={now}
                                                filter={filter}
                                                onFilterChange={setFilter}
                                                highlightedId={highlightedFinding}
                                            />
                                        ),
                                    },
                                    {
                                        id: "detections",
                                        label: (
                                            <>
                                                Detections
                                                <TabCount value={current.detections.length} />
                                            </>
                                        ),
                                        content: <DetectionsPanel detections={current.detections} />,
                                    },
                                    {
                                        id: "review",
                                        label: (
                                            <>
                                                <span className="sm:hidden">Review</span>
                                                <span className="max-sm:hidden">Coach review</span>
                                            </>
                                        ),
                                        content: <CoachReviewPanel analysisId={current.id} review={current.coachReview} findings={current.findings} canReview={canReview} now={now} />,
                                    },
                                ]}
                            />
                        </Card>
                        <ProvenanceCard analysis={current} job={job} video={video} />
                    </aside>
                    <div className="min-w-0 xl:col-start-1 xl:row-start-4">
                        <MetricsPanel analysis={current} />
                    </div>
                </div>
            </PlaybackProvider>
        </ReviewContext.Provider>
    );
}

/** Count pill; for reviewers it shows how many items still need a decision instead. */
function TabCount({ value, attention = 0 }: { value: number; attention?: number }) {
    if (attention > 0) {
        return (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-warning-soft px-1.5 text-[11px] leading-5 font-medium text-warning-fg tabular-nums ring-1 ring-warning-border ring-inset">
                <TriangleAlert aria-hidden className="size-3" />
                {attention}
                <span className="sr-only"> of {value} still to review</span>
            </span>
        );
    }
    return <span className="rounded-full bg-surface-hover px-1.5 text-[11px] leading-5 text-fg-muted tabular-nums">{value}</span>;
}
