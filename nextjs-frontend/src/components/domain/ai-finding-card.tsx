import {
    ArrowRight,
    ChevronRight,
    CircleArrowUp,
    Lightbulb,
    PenLine,
    Play,
    TrendingUp,
    TriangleAlert,
    UserCheck,
    UserX,
    type LucideIcon,
} from "lucide-react";
import { useId, type ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { TONE_TEXT, type Tone } from "@/components/ui/tone";
import { FINDING_CATEGORY_LABELS, FINDING_IMPACT_LABELS, REVIEW_DECISION_LABELS } from "@/lib/domain/labels";
import { AI_REVIEW_TERMS, isNeedsReview } from "@/lib/domain/ai-review";
import type { AIFeedback, AIFinding, FindingImpact, ReviewDecision } from "@/lib/domain/types";
import { formatConfidence, formatDateTime, formatRelative, formatTimestamp, pluralize } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ConfidenceMeter } from "./confidence-meter";
import { formatMeasure } from "./domain-format";
import { AIGeneratedBadge, ReviewStateBadge } from "./status-badges";

const IMPACT_META: Record<FindingImpact, { icon: LucideIcon; tone: Tone }> = {
    strength: { icon: TrendingUp, tone: "success" },
    improvement: { icon: CircleArrowUp, tone: "info" },
    concern: { icon: TriangleAlert, tone: "warning" },
};

const DECISION_META: Record<ReviewDecision, { icon: LucideIcon; tone: Tone }> = {
    confirmed: { icon: UserCheck, tone: "success" },
    corrected: { icon: PenLine, tone: "info" },
    rejected: { icon: UserX, tone: "neutral" },
};

export interface AIFindingCardProps {
    finding: AIFinding;
    /** Server time (ISO) used for the review's relative time. */
    now: string;
    /** When provided, timestamps become buttons that seek the video (client parents only). */
    onSeek?: (ms: number) => void;
    /** Review controls, e.g. Confirm / Correct / Reject buttons. As a function it receives the heading id, so controls can name the finding they act on. */
    actions?: ReactNode | ((headingId: string) => ReactNode);
    headingLevel?: 2 | 3;
    className?: string;
}

/**
 * One AI finding with its evidence chain (video → timeline → detections → metric → finding →
 * review) and, when reviewed, the human decision shown distinctly from the AI output.
 * Its only hook is useId, so it renders in Server and Client Component parents alike.
 */
export function AIFindingCard({ finding, now, onSeek, actions, headingLevel = 3, className }: AIFindingCardProps) {
    const headingId = useId();
    const Heading = headingLevel === 2 ? "h2" : "h3";
    const impact = IMPACT_META[finding.impact];
    const rejected = finding.review?.decision === "rejected";
    const controls = typeof actions === "function" ? actions(headingId) : actions;

    return (
        <article aria-labelledby={headingId} className={cn("flex flex-col gap-3.5 rounded-xl border border-border bg-surface p-4 shadow-card", className)}>
            <div className="flex flex-wrap items-center gap-1.5">
                <Badge tone={impact.tone} icon={impact.icon} size="sm">
                    {FINDING_IMPACT_LABELS[finding.impact]}
                </Badge>
                <Badge tone="neutral" variant="outline" size="sm">
                    {FINDING_CATEGORY_LABELS[finding.category]}
                </Badge>
                <span className="ml-auto flex flex-wrap gap-1.5">
                    <AIGeneratedBadge size="sm" />
                    <ReviewStateBadge review={finding.review} confidence={finding.confidence} size="sm" />
                </span>
            </div>

            <div>
                <Heading id={headingId} tabIndex={-1} className={cn("text-[15px] leading-6 font-semibold", rejected ? "text-fg-muted" : "text-fg")}>
                    {finding.title}
                </Heading>
                <p className="mt-1 text-sm text-pretty text-fg-muted">{finding.description}</p>
            </div>

            <ConfidenceMeter confidence={finding.confidence} label={`AI confidence for ${finding.title}`} />

            {finding.metric && (
                <p className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 rounded-lg bg-surface-muted px-3 py-2 text-[13px]">
                    <span className="text-fg-muted">{finding.metric.label}</span>
                    <span className="font-semibold text-fg">{formatMeasure(finding.metric.value, finding.metric.unit)}</span>
                    {finding.metric.reference && <span className="text-fg-subtle">Reference: {finding.metric.reference}</span>}
                </p>
            )}

            <p className="flex gap-2 text-sm">
                <Lightbulb aria-hidden className="mt-0.5 size-4 shrink-0 text-fg-subtle" />
                <span className="text-pretty text-fg">
                    <span className="font-medium">Recommendation: </span>
                    {finding.recommendation}
                </span>
            </p>

            {(finding.timestampsMs.length > 0 || finding.detectionIds.length > 0) && (
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-[13px]">
                    {finding.timestampsMs.length > 0 && (
                        <>
                            <span className="text-fg-muted">Moments</span>
                            <ul aria-label="Moments in the video" className="flex flex-wrap gap-1.5">
                                {finding.timestampsMs.map((ms, index) => (
                                    <li key={`${ms}-${index}`}>
                                        {onSeek ? (
                                            <button
                                                type="button"
                                                onClick={() => onSeek(ms)}
                                                aria-label={`Seek video to ${formatTimestamp(ms)}`}
                                                className="inline-flex h-8 items-center gap-1 rounded-md border border-border bg-surface px-2 text-xs font-medium text-fg transition-colors hover:bg-surface-hover"
                                            >
                                                <Play aria-hidden className="size-3" />
                                                {formatTimestamp(ms)}
                                            </button>
                                        ) : (
                                            <span className="inline-flex h-6 items-center rounded-md bg-surface-muted px-2 text-xs font-medium text-fg">
                                                {formatTimestamp(ms)}
                                            </span>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        </>
                    )}
                    {finding.detectionIds.length > 0 && (
                        <span className="text-fg-muted">{pluralize(finding.detectionIds.length, "linked detection")}</span>
                    )}
                </div>
            )}

            <Provenance finding={finding} />

            {finding.review && <HumanReview review={finding.review} aiLabel={FINDING_CATEGORY_LABELS[finding.category]} now={now} />}

            {controls && <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">{controls}</div>}
        </article>
    );
}

function Provenance({ finding }: { finding: AIFinding }) {
    const [firstMs] = finding.timestampsMs;
    const extraMoments = finding.timestampsMs.length - 1;
    const steps: { step: string; value: string }[] = [
        { step: "Video", value: "Source clip" },
        {
            step: "Timeline",
            value: firstMs === undefined ? "Whole clip" : `${formatTimestamp(firstMs)}${extraMoments > 0 ? ` +${extraMoments}` : ""}`,
        },
        {
            step: "Detection",
            value: finding.detectionIds.length > 0 ? pluralize(finding.detectionIds.length, "detection") : "None linked",
        },
        {
            step: "Metric",
            value: finding.metric ? `${finding.metric.label} ${formatMeasure(finding.metric.value, finding.metric.unit)}` : "No metric",
        },
        { step: "Finding", value: `${formatConfidence(finding.confidence)} confidence` },
        { step: "Review", value: reviewSummary(finding.review, finding.confidence) },
    ];

    return (
        <div className="rounded-lg border border-dashed border-border px-3 py-2">
            <p className="text-[11px] font-semibold tracking-wide text-fg-subtle uppercase" aria-hidden>
                Provenance
            </p>
            <ol aria-label="Provenance" className="mt-1 flex flex-wrap items-center gap-x-1 gap-y-1.5">
                {steps.map((item, index) => (
                    <li key={item.step} className="flex items-center gap-1">
                        {index > 0 && <ChevronRight aria-hidden className="size-3 shrink-0 text-fg-subtle" />}
                        <span className="flex flex-col leading-tight">
                            <span className="text-[10px] tracking-wide text-fg-subtle uppercase">
                                {item.step}
                                <span className="sr-only">: </span>
                            </span>
                            <span className="text-xs font-medium text-fg">{item.value}</span>
                        </span>
                    </li>
                ))}
            </ol>
        </div>
    );
}

function reviewSummary(review: AIFeedback | null, confidence: number): string {
    if (review) return REVIEW_DECISION_LABELS[review.decision];
    return isNeedsReview({ review, confidence }) ? AI_REVIEW_TERMS.needsReview : AI_REVIEW_TERMS.unreviewed;
}

function HumanReview({ review, aiLabel, now }: { review: AIFeedback; aiLabel: string; now: string }) {
    const decision = DECISION_META[review.decision];
    const DecisionIcon = decision.icon;

    return (
        <div className="rounded-lg border border-border bg-surface-muted px-3 py-2.5 text-[13px]">
            <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <DecisionIcon aria-hidden className={cn("size-4 shrink-0", TONE_TEXT[decision.tone])} />
                <span className="font-medium text-fg">
                    {REVIEW_DECISION_LABELS[review.decision]} by {review.reviewerName}
                </span>
                <time dateTime={review.reviewedAt} title={formatDateTime(review.reviewedAt)} className="text-fg-muted">
                    {formatRelative(review.reviewedAt, now)}
                </time>
            </p>
            {review.decision === "corrected" && review.correctedLabel && (
                <p className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <span className="text-fg-muted">AI said:</span>
                    <span className="text-fg-muted line-through decoration-fg-subtle">{aiLabel}</span>
                    <ArrowRight aria-hidden className="size-3.5 text-fg-subtle" />
                    <span className="text-fg-muted">Coach:</span>
                    <span className="font-semibold text-fg">{review.correctedLabel}</span>
                </p>
            )}
            {review.note && <p className="mt-1.5 text-pretty text-fg">“{review.note}”</p>}
        </div>
    );
}
