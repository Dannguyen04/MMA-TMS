"use client";

import { Check, PenLine, UserX } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { AIFindingCard } from "@/components/domain/ai-finding-card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { SubmitButton } from "@/components/ui/submit-button";
import { AI_REVIEW_TERMS, isNeedsReview } from "@/lib/domain/ai-review";
import type { AIFinding, ReviewDecision } from "@/lib/domain/types";
import { cn } from "@/lib/utils";
import { usePlaybackStore } from "./playback-store";
import { useReview } from "./review-context";
import { ReviewDialog } from "./review-dialog";

export type FindingFilter = "all" | "unreviewed" | "low_confidence" | "reviewed";

const FILTERS: { id: FindingFilter; label: string; match: (finding: AIFinding) => boolean }[] = [
    { id: "all", label: "All", match: () => true },
    { id: "unreviewed", label: AI_REVIEW_TERMS.unreviewed, match: (f) => f.review === null },
    { id: "low_confidence", label: AI_REVIEW_TERMS.lowConfidence, match: isNeedsReview },
    { id: "reviewed", label: "Reviewed", match: (f) => f.review !== null },
];

export function matchesFindingFilter(finding: AIFinding, filter: FindingFilter): boolean {
    return (FILTERS.find((f) => f.id === filter)?.match ?? (() => true))(finding);
}

export interface FindingsPanelProps {
    findings: AIFinding[];
    now: string;
    filter: FindingFilter;
    onFilterChange: (filter: FindingFilter) => void;
    /** Finding to scroll to and highlight (e.g. chosen from the timeline). */
    highlightedId: string | null;
}

/** AI findings with evidence, filters and — for coaches — confirm / correct / reject. */
export function FindingsPanel({ findings, now, filter, onFilterChange, highlightedId }: FindingsPanelProps) {
    const store = usePlaybackStore();
    const review = useReview();
    const filtersRef = useRef<HTMLDivElement>(null);
    const listRef = useRef<HTMLUListElement>(null);
    const [dialog, setDialog] = useState<{ finding: AIFinding; decision: ReviewDecision } | null>(null);
    const visible = findings.filter((finding) => matchesFindingFilter(finding, filter));

    useEffect(() => {
        if (!highlightedId) return;
        listRef.current?.querySelector(`[data-finding="${highlightedId}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }, [highlightedId, filter]);

    const seek = (ms: number) => {
        store.pause();
        store.seek(ms);
    };

    /**
     * Confirm turns into a disabled "Confirmed" button, which would drop keyboard focus. Move focus first:
     * to the finding's heading, or — when the confirmed finding leaves the current filter — to its neighbour.
     */
    const confirm = async (formData: FormData, findingId: string, headingId: string) => {
        const staysVisible = filter === "all" || filter === "reviewed";
        if (staysVisible) {
            document.getElementById(headingId)?.focus();
        } else {
            const item = listRef.current?.querySelector(`[data-finding="${findingId}"]`);
            const neighbour = (item?.nextElementSibling ?? item?.previousElementSibling)?.querySelector<HTMLElement>("[tabindex='-1']");
            (neighbour ?? filtersRef.current?.querySelector<HTMLElement>("button"))?.focus();
        }
        await review.submitFindingReview(formData);
    };

    return (
        <div className="flex flex-col gap-3 pt-3">
            <div ref={filtersRef} role="group" aria-label="Filter findings" className="flex flex-wrap gap-1.5">
                {FILTERS.map((option) => {
                    const count = findings.filter(option.match).length;
                    const selected = filter === option.id;
                    return (
                        <button
                            key={option.id}
                            type="button"
                            aria-pressed={selected}
                            onClick={() => onFilterChange(option.id)}
                            className={cn(
                                "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors",
                                selected ? "border-primary bg-primary-soft text-primary-soft-fg" : "border-border bg-surface text-fg-muted hover:text-fg",
                            )}
                        >
                            {option.label}
                            <span className={cn("rounded-full px-1.5 text-[11px] tabular-nums", selected ? "bg-surface/70" : "bg-surface-hover")}>{count}</span>
                        </button>
                    );
                })}
            </div>

            {visible.length === 0 ? (
                <EmptyState
                    compact
                    title={findings.length === 0 ? "No findings for this clip" : "No findings match this filter"}
                    description={findings.length === 0 ? "The AI didn't produce findings for this footage." : "Try another filter to see the rest."}
                    action={
                        findings.length > 0 && (
                            <Button variant="secondary" size="sm" onClick={() => onFilterChange("all")}>
                                Show all findings
                            </Button>
                        )
                    }
                />
            ) : (
                <ul ref={listRef} className="flex flex-col gap-3">
                    {visible.map((finding) => (
                        <li key={finding.id} data-finding={finding.id} className="scroll-mt-4">
                            <AIFindingCard
                                finding={finding}
                                now={now}
                                onSeek={seek}
                                className={cn(finding.id === highlightedId && "ring-2 ring-primary")}
                                actions={
                                    review.canReview
                                        ? (headingId) => (
                                              <>
                                                  <form action={(formData) => confirm(formData, finding.id, headingId)}>
                                                      <input type="hidden" name="analysisId" value={review.analysisId} />
                                                      <input type="hidden" name="findingId" value={finding.id} />
                                                      <input type="hidden" name="decision" value="confirmed" />
                                                      <SubmitButton size="sm" variant="secondary" disabled={finding.review?.decision === "confirmed"} aria-describedby={headingId}>
                                                          <Check aria-hidden />
                                                          {finding.review?.decision === "confirmed" ? "Confirmed" : "Confirm"}
                                                      </SubmitButton>
                                                  </form>
                                                  <Button size="sm" variant="ghost" onClick={() => setDialog({ finding, decision: "corrected" })} aria-describedby={headingId}>
                                                      <PenLine aria-hidden />
                                                      Correct
                                                  </Button>
                                                  <Button size="sm" variant="ghost" onClick={() => setDialog({ finding, decision: "rejected" })} aria-describedby={headingId}>
                                                      <UserX aria-hidden />
                                                      Reject
                                                  </Button>
                                              </>
                                          )
                                        : undefined
                                }
                            />
                        </li>
                    ))}
                </ul>
            )}

            {dialog && (
                <ReviewDialog
                    key={`${dialog.finding.id}-${dialog.decision}`}
                    open
                    onClose={() => setDialog(null)}
                    target={{ kind: "finding", finding: dialog.finding }}
                    initialDecision={dialog.decision}
                />
            )}
        </div>
    );
}
