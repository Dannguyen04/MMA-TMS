import { CalendarClock, TriangleAlert } from "lucide-react";

import { capitalize, describeDaysUntil } from "@/components/domain/domain-format";
import { InjuryStatusBadge } from "@/components/domain/status-badges";
import { BODY_REGION_LABELS, INJURY_TYPE_LABELS } from "@/lib/domain/labels";
import type { Injury } from "@/lib/domain/types";
import { formatDate, pluralize } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Follow-ups due within this many days are emphasised. */
export const FOLLOW_UP_SOON_DAYS = 7;

export interface FollowUpCellProps {
    followUp: { date: string; daysUntil: number } | null;
    className?: string;
}

/** Next follow-up: date and distance, with overdue and due-soon emphasis. */
export function FollowUpCell({ followUp, className }: FollowUpCellProps) {
    if (!followUp) return <span className={cn("text-[13px] text-fg-muted", className)}>None scheduled</span>;
    const { date, daysUntil } = followUp;
    const overdue = daysUntil < 0;
    const soon = !overdue && daysUntil <= FOLLOW_UP_SOON_DAYS;
    return (
        <span className={cn("flex flex-col gap-0.5 text-[13px]", className)}>
            <time dateTime={date} className="text-fg">
                {formatDate(date)}
            </time>
            <span
                className={cn(
                    "inline-flex items-center gap-1",
                    overdue ? "font-medium text-danger-fg" : soon ? "font-medium text-warning-fg" : "text-fg-muted",
                )}
            >
                {overdue ? <TriangleAlert aria-hidden className="size-3.5" /> : soon && <CalendarClock aria-hidden className="size-3.5" />}
                {overdue ? `Overdue by ${pluralize(-daysUntil, "day")}` : capitalize(describeDaysUntil(daysUntil))}
            </span>
        </span>
    );
}

/** Most recent open injury with its status, plus how many more are open. */
export function ActiveInjuryCell({ injuries, className }: { injuries: Injury[]; className?: string }) {
    const [first, ...rest] = injuries;
    if (!first) return <span className={cn("text-[13px] text-fg-muted", className)}>None</span>;
    return (
        <span className={cn("flex min-w-0 flex-col items-start gap-1 text-[13px]", className)}>
            <span className="text-fg">
                {INJURY_TYPE_LABELS[first.type]} — {BODY_REGION_LABELS[first.bodyRegion].toLowerCase()}
            </span>
            <span className="flex flex-wrap items-center gap-1.5">
                <InjuryStatusBadge status={first.status} size="sm" />
                {rest.length > 0 && <span className="text-xs text-fg-muted">+{pluralize(rest.length, "more", "more")}</span>}
            </span>
        </span>
    );
}
