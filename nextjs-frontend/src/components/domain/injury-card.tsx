import Link from "next/link";

import { DescriptionList, type DescriptionItem } from "@/components/ui/description-list";
import { BODY_REGION_LABELS, INJURY_MECHANISM_LABELS, INJURY_TYPE_LABELS } from "@/lib/domain/labels";
import type { Injury } from "@/lib/domain/types";
import { daysBetween, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { describeDaysUntil } from "./domain-format";
import { InjurySeverityBadge, InjuryStatusBadge } from "./status-badges";

export interface InjuryCardProps {
    injury: Injury;
    /** Server time (ISO) used for days to expected return. */
    now: string;
    /** Makes the whole card a link to the injury. */
    href?: string;
    headingLevel?: 2 | 3;
    className?: string;
}

/** Injury summary: what and where, severity + status, key dates and mechanism. */
export function InjuryCard({ injury, now, href, headingLevel = 3, className }: InjuryCardProps) {
    const Heading = headingLevel === 2 ? "h2" : "h3";
    const title = `${INJURY_TYPE_LABELS[injury.type]} — ${BODY_REGION_LABELS[injury.bodyRegion]}`;

    const items: DescriptionItem[] = [
        { label: "Occurred", value: <time dateTime={injury.occurredAt}>{formatDate(injury.occurredAt)}</time> },
        { label: "Diagnosed", value: <time dateTime={injury.diagnosedAt}>{formatDate(injury.diagnosedAt)}</time> },
        { label: "Mechanism", value: INJURY_MECHANISM_LABELS[injury.mechanism] },
        { label: injury.resolvedAt ? "Resolved" : "Expected return", value: <ReturnValue injury={injury} now={now} /> },
    ];

    return (
        <article
            className={cn(
                "relative flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 shadow-card",
                href && "transition-colors hover:border-border-strong hover:bg-surface-muted/40",
                className,
            )}
        >
            <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
                <Heading className="min-w-0 text-[15px] leading-6 font-semibold text-fg">
                    {href ? (
                        <Link href={href} className="rounded-sm after:absolute after:inset-0 after:rounded-xl after:content-[''] hover:underline">
                            {title}
                        </Link>
                    ) : (
                        title
                    )}
                </Heading>
                <div className="flex flex-wrap gap-1.5">
                    <InjurySeverityBadge severity={injury.severity} size="sm" />
                    <InjuryStatusBadge status={injury.status} size="sm" />
                </div>
            </div>
            <p className="line-clamp-2 text-sm text-pretty text-fg-muted">{injury.description}</p>
            <DescriptionList items={items} className="gap-y-3" />
        </article>
    );
}

function ReturnValue({ injury, now }: { injury: Injury; now: string }) {
    if (injury.resolvedAt) {
        return <time dateTime={injury.resolvedAt}>{formatDate(injury.resolvedAt)}</time>;
    }
    if (!injury.expectedReturnAt) {
        return <span className="font-normal text-fg-muted">To be assessed</span>;
    }
    const days = daysBetween(now, injury.expectedReturnAt);
    return (
        <span className="flex flex-col gap-0.5">
            <time dateTime={injury.expectedReturnAt}>{formatDate(injury.expectedReturnAt)}</time>
            <span className="text-[13px] font-normal text-fg-muted">
                {days < 0 ? `Target passed ${describeDaysUntil(days)}` : `Return ${describeDaysUntil(days)}`}
            </span>
        </span>
    );
}
