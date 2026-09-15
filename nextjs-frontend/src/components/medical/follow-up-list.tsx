import { CalendarCheck2 } from "lucide-react";
import Link from "next/link";

import { capitalize, describeDaysUntil } from "@/components/domain/domain-format";
import { DateBlock } from "@/components/domain/session-list-item";
import { EmptyState } from "@/components/ui/states";
import { EXAMINATION_TYPE_LABELS } from "@/lib/domain/labels";
import { pluralize } from "@/lib/format";
import { routes } from "@/lib/routes";
import type { FollowUp } from "@/lib/services/medical";
import { cn } from "@/lib/utils";
import { FOLLOW_UP_SOON_DAYS } from "./patient-cells";

/** Link to start the follow-up examination for a fighter, continuing the same kind of examination. */
export function followUpExaminationHref(followUp: Pick<FollowUp, "fighter" | "examination">): string {
    const type = followUp.examination.type === "baseline" || followUp.examination.type === "pre_fight" ? "routine" : followUp.examination.type;
    return `${routes.doctor.newExamination}?fighter=${followUp.fighter.id}&type=${type}`;
}

/** Upcoming and overdue follow-up examinations, soonest first. */
export function FollowUpList({ followUps, className }: { followUps: FollowUp[]; className?: string }) {
    if (followUps.length === 0) {
        return (
            <EmptyState
                compact
                icon={<CalendarCheck2 />}
                title="No follow-ups scheduled"
                description="Follow-up dates set on examinations appear here."
                className={className}
            />
        );
    }

    return (
        <ul className={cn("flex flex-col divide-y divide-border", className)}>
            {followUps.map((followUp) => {
                const overdue = followUp.daysUntil < 0;
                const soon = !overdue && followUp.daysUntil <= FOLLOW_UP_SOON_DAYS;
                return (
                    <li key={followUp.examination.id} className="relative flex items-center gap-3 px-5 py-3 transition-colors hover:bg-surface-muted/50">
                        <DateBlock date={followUp.date} highlighted={followUp.daysUntil === 0} />
                        <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-fg">
                                <Link
                                    href={followUpExaminationHref(followUp)}
                                    className="rounded-sm after:absolute after:inset-0 after:content-[''] hover:underline"
                                >
                                    {followUp.fighter.name}
                                    <span className="sr-only">: start follow-up examination</span>
                                </Link>
                            </p>
                            <p className="truncate text-[13px] text-fg-muted">After {EXAMINATION_TYPE_LABELS[followUp.examination.type].toLowerCase()}</p>
                        </div>
                        <span
                            className={cn(
                                "shrink-0 text-right text-[13px]",
                                overdue ? "font-medium text-danger-fg" : soon ? "font-medium text-warning-fg" : "text-fg-muted",
                            )}
                        >
                            {overdue ? `Overdue by ${pluralize(-followUp.daysUntil, "day")}` : capitalize(describeDaysUntil(followUp.daysUntil))}
                        </span>
                    </li>
                );
            })}
        </ul>
    );
}
