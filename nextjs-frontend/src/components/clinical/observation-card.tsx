import { Bandage, UserCheck } from "lucide-react";
import Link from "next/link";

import { ConfidenceMeter } from "@/components/domain/confidence-meter";
import { FighterIdentity, type FighterIdentityData } from "@/components/domain/fighter-identity";
import { AIGeneratedBadge, AlertStatusBadge } from "@/components/domain/status-badges";
import { Badge } from "@/components/ui/badge";
import { BODY_REGION_LABELS, TRAINING_TYPE_LABELS } from "@/lib/domain/labels";
import type { AbnormalMovementAlert } from "@/lib/domain/types";
import { formatDate, formatRelative } from "@/lib/format";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { DOCTOR_DECISION_META } from "./clinical-badges";
import { describeMetricComparison } from "./clinical-copy";
import type { ObservationSource } from "./observation-summary";

export interface ObservationCardProps {
    alert: AbnormalMovementAlert;
    fighter: FighterIdentityData;
    source: ObservationSource | null;
    now: string;
    className?: string;
}

/** One AI movement observation in the review list. The whole card opens the observation. */
export function ObservationCard({ alert, fighter, source, now, className }: ObservationCardProps) {
    const review = alert.doctorReview;
    const decision = review ? DOCTOR_DECISION_META[review.decision] : null;

    return (
        <article
            className={cn(
                "relative flex flex-col gap-4 rounded-xl border bg-surface p-4 shadow-card transition-colors hover:border-border-strong sm:p-5",
                alert.status === "new" ? "border-ai-border" : "border-border",
                className,
            )}
        >
            <div className="flex flex-wrap items-start justify-between gap-3">
                <FighterIdentity fighter={fighter} size="sm" />
                <div className="flex flex-wrap items-center gap-1.5">
                    <AIGeneratedBadge size="sm" label="AI observation" />
                    <AlertStatusBadge status={alert.status} size="sm" />
                </div>
            </div>

            <div className="min-w-0">
                <p className="text-xs font-semibold tracking-wide text-fg-subtle uppercase">{BODY_REGION_LABELS[alert.bodyRegion]}</p>
                <h3 className="mt-0.5 text-[15px] leading-snug font-semibold text-pretty text-fg">
                    <Link
                        href={routes.doctor.aiAlert(alert.id)}
                        className="rounded-sm after:absolute after:inset-0 after:rounded-xl after:content-[''] hover:underline"
                    >
                        {alert.pattern}
                    </Link>
                </h3>
            </div>

            <dl className="grid grid-cols-1 gap-x-8 gap-y-3 text-[13px] md:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
                <div className="min-w-0">
                    <dt className="text-fg-muted">{alert.metric.label}</dt>
                    <dd className="mt-0.5 font-semibold text-fg">{describeMetricComparison(alert.metric)}</dd>
                </div>
                <div className="min-w-0">
                    <dt className="text-fg-muted">AI confidence</dt>
                    <dd className="mt-1">
                        <ConfidenceMeter confidence={alert.confidence} label={`AI confidence for this observation`} />
                    </dd>
                </div>
            </dl>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-border pt-3 text-[13px] text-fg-muted">
                <span>
                    Detected <time dateTime={alert.detectedAt}>{formatRelative(alert.detectedAt, now)}</time>
                </span>
                <span>
                    {source ? (
                        <>
                            {TRAINING_TYPE_LABELS[source.trainingType]} video ·{" "}
                            <time dateTime={source.uploadedAt}>{formatDate(source.uploadedAt)}</time>
                        </>
                    ) : (
                        "Footage no longer available"
                    )}
                </span>
                {alert.linkedInjuryId && (
                    <Badge tone="neutral" size="sm" icon={Bandage}>
                        Linked to an injury record
                    </Badge>
                )}
            </div>

            {review && decision && (
                <p className="flex min-w-0 items-start gap-2 rounded-lg bg-surface-muted px-3 py-2 text-[13px]">
                    <UserCheck aria-hidden className="mt-0.5 size-3.5 shrink-0 text-fg-muted" />
                    <span className="min-w-0">
                        <span className="font-medium text-fg">{decision.label}</span>
                        <span className="text-fg-muted">
                            {" "}
                            by {review.reviewerName} · <time dateTime={review.reviewedAt}>{formatDate(review.reviewedAt)}</time>
                        </span>
                        <span className="mt-0.5 line-clamp-1 block text-fg-muted">{review.note}</span>
                    </span>
                </p>
            )}
        </article>
    );
}
