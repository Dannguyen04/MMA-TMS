import { ClearanceCell } from "@/components/domain/clearance-validity";
import { FighterIdentity } from "@/components/domain/fighter-identity";
import { HealthStatusBadge } from "@/components/domain/status-badges";
import { EXAMINATION_TYPE_LABELS } from "@/lib/domain/labels";
import { formatDate } from "@/lib/format";
import type { FighterHealthSummary } from "@/lib/services/medical";
import { cn } from "@/lib/utils";
import { ActiveInjuryCell, FollowUpCell } from "./patient-cells";

export interface PatientCardProps {
    summary: FighterHealthSummary;
    href: string;
    /** Server time (ISO). */
    now: string;
    warningDays?: number;
    className?: string;
}

/** Stacked patient summary for small screens: identity, health, clearance, injury, follow-up and last exam. */
export function PatientCard({ summary, href, now, warningDays, className }: PatientCardProps) {
    const { fighter, latestExamination } = summary;
    return (
        <article className={cn("relative rounded-xl border border-border bg-surface p-4 shadow-card", className)}>
            <div className="flex items-start justify-between gap-3">
                <FighterIdentity fighter={fighter} size="sm" href={href} stretchedLink />
                <HealthStatusBadge status={fighter.healthStatus} size="sm" className="shrink-0" />
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
                <div className="min-w-0">
                    <dt className="mb-1 text-xs text-fg-muted">Medical Clearance</dt>
                    <dd>
                        <ClearanceCell clearance={summary.clearance} state={summary.clearanceState} now={now} warningDays={warningDays} />
                    </dd>
                </div>
                <div className="min-w-0">
                    <dt className="mb-1 text-xs text-fg-muted">Next follow-up</dt>
                    <dd>
                        <FollowUpCell followUp={summary.nextFollowUp} />
                    </dd>
                </div>
                <div className="min-w-0">
                    <dt className="mb-1 text-xs text-fg-muted">Active injury</dt>
                    <dd>
                        <ActiveInjuryCell injuries={summary.activeInjuries} />
                    </dd>
                </div>
                <div className="min-w-0">
                    <dt className="mb-1 text-xs text-fg-muted">Last examination</dt>
                    <dd className="text-[13px]">
                        {latestExamination ? (
                            <span className="flex flex-col gap-0.5">
                                <time dateTime={latestExamination.date} className="text-fg">
                                    {formatDate(latestExamination.date)}
                                </time>
                                <span className="text-fg-muted">{EXAMINATION_TYPE_LABELS[latestExamination.type]}</span>
                            </span>
                        ) : (
                            <span className="text-fg-muted">None recorded</span>
                        )}
                    </dd>
                </div>
            </dl>
        </article>
    );
}
