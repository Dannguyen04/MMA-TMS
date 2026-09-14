import { CalendarClock, HeartPulse, ListChecks } from "lucide-react";

import { CardLink } from "@/components/dashboard/card-link";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { HEALTH_STATUS_DESCRIPTIONS } from "@/lib/domain/labels";
import type { ClearanceState } from "@/lib/domain/rules";
import type { HealthStatus } from "@/lib/domain/types";
import { daysBetween, formatDate, pluralize } from "@/lib/format";
import { cn } from "@/lib/utils";
import { describeDaysUntil } from "./domain-format";
import { FighterStatusBadges } from "./status-badges";

export interface HealthSummaryCardProps {
    healthStatus: HealthStatus;
    clearanceState: ClearanceState;
    /** Number of restrictions on the current clearance. */
    restrictionsCount: number;
    /** Next medical follow-up (examination), if one is scheduled. */
    nextFollowUpDate?: string | null;
    /** Server time (ISO) used for days to the follow-up. */
    now: string;
    /** Link to the fuller health view. */
    href?: string;
    className?: string;
}

/** Non-clinical health snapshot for coaches and fighters: clearance and health status, restrictions and follow-up. */
export function HealthSummaryCard({
    healthStatus,
    clearanceState,
    restrictionsCount,
    nextFollowUpDate,
    now,
    href,
    className,
}: HealthSummaryCardProps) {
    // "Not Cleared" and "No clearance" already mean no training can be planned, so a "None" row would mislead.
    const showRestrictions = (clearanceState !== "not_cleared" && clearanceState !== "none") || restrictionsCount > 0;

    return (
        <Card className={className}>
            <CardHeader
                title="Health & Medical Clearance"
                icon={<HeartPulse />}
                action={
                    href && (
                        <CardLink href={href} srContext="about health and Medical Clearance">
                            Details
                        </CardLink>
                    )
                }
            />
            <CardContent className="flex flex-col gap-3">
                <div>
                    <FighterStatusBadges healthStatus={healthStatus} clearanceState={clearanceState} />
                    <p className="mt-1.5 text-sm text-fg-muted">{HEALTH_STATUS_DESCRIPTIONS[healthStatus]}</p>
                </div>
                {(showRestrictions || nextFollowUpDate) && (
                    <ul className="flex flex-col divide-y divide-border rounded-lg border border-border text-[13px]">
                        {showRestrictions && (
                            <li className="flex items-center justify-between gap-3 px-3 py-2">
                                <span className="inline-flex items-center gap-1.5 text-fg-muted">
                                    <ListChecks aria-hidden className="size-3.5 text-fg-subtle" />
                                    Restrictions
                                </span>
                                <span className={cn("font-medium", restrictionsCount > 0 ? "text-fg" : "text-fg-muted")}>
                                    {restrictionsCount > 0 ? pluralize(restrictionsCount, "restriction") : "None"}
                                </span>
                            </li>
                        )}
                        {nextFollowUpDate && (
                            <li className="flex items-center justify-between gap-3 px-3 py-2">
                                <span className="inline-flex items-center gap-1.5 text-fg-muted">
                                    <CalendarClock aria-hidden className="size-3.5 text-fg-subtle" />
                                    Next follow-up
                                </span>
                                <span className="text-right font-medium text-fg">
                                    <time dateTime={nextFollowUpDate}>{formatDate(nextFollowUpDate)}</time>
                                    <span className="block text-xs font-normal text-fg-muted">{describeDaysUntil(daysBetween(now, nextFollowUpDate))}</span>
                                </span>
                            </li>
                        )}
                    </ul>
                )}
            </CardContent>
        </Card>
    );
}
