import { Radar } from "lucide-react";
import Link from "next/link";

import { AlertStatusBadge, ConfidenceBadge } from "@/components/domain/status-badges";
import { EmptyState } from "@/components/ui/states";
import { BODY_REGION_LABELS } from "@/lib/domain/labels";
import type { AbnormalMovementAlert } from "@/lib/domain/types";
import { formatDateTime, formatRelative } from "@/lib/format";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";

export interface AIObservationListProps {
    observations: { alert: AbnormalMovementAlert; fighterName?: string }[];
    /** Server time (ISO). */
    now: string;
    emptyTitle?: string;
    className?: string;
}

/**
 * AI movement observations as a compact list. Visually in the AI tone and worded as
 * observations — supporting information for review, never a diagnosis.
 */
export function AIObservationList({ observations, now, emptyTitle = "No open AI observations", className }: AIObservationListProps) {
    if (observations.length === 0) {
        return (
            <EmptyState
                compact
                icon={<Radar />}
                title={emptyTitle}
                description="Observations from analysed training footage appear here for clinical review."
                className={className}
            />
        );
    }

    return (
        <ul className={cn("flex flex-col gap-2", className)}>
            {observations.map(({ alert, fighterName }) => (
                <li
                    key={alert.id}
                    className="relative rounded-lg border border-ai-border/70 bg-ai-soft/40 px-3 py-2.5 transition-colors hover:bg-ai-soft/70"
                >
                    <p className="text-sm font-medium text-pretty text-fg">
                        <Link href={routes.doctor.aiAlert(alert.id)} className="rounded-sm after:absolute after:inset-0 after:content-[''] hover:underline">
                            {alert.pattern}
                        </Link>
                    </p>
                    <p className="mt-0.5 text-[13px] text-fg-muted">
                        {fighterName && <span className="font-medium text-fg">{fighterName} · </span>}
                        {BODY_REGION_LABELS[alert.bodyRegion]} ·{" "}
                        <time dateTime={alert.detectedAt} title={formatDateTime(alert.detectedAt)}>
                            {formatRelative(alert.detectedAt, now)}
                        </time>
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <AlertStatusBadge status={alert.status} size="sm" />
                        <ConfidenceBadge confidence={alert.confidence} size="sm" />
                    </div>
                </li>
            ))}
        </ul>
    );
}
