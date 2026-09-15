import Link from "next/link";

import { describeDaysUntil } from "@/components/domain/domain-format";
import { FighterIdentity } from "@/components/domain/fighter-identity";
import { InjuryCard } from "@/components/domain/injury-card";
import { InjurySeverityBadge, InjuryStatusBadge } from "@/components/domain/status-badges";
import { Avatar } from "@/components/ui/avatar";
import { ProgressBar } from "@/components/ui/progress";
import { SortableTH, Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { BODY_REGION_LABELS, INJURY_TYPE_LABELS } from "@/lib/domain/labels";
import type { Fighter, Injury } from "@/lib/domain/types";
import { daysBetween, formatDate } from "@/lib/format";
import type { SearchParams, SortDirection } from "@/lib/query";
import { routes } from "@/lib/routes";

export interface InjuryPlanSummary {
    id: string;
    progressPct: number;
    /** 1-based number of the current phase, or null when none is current. */
    currentPhase: number | null;
    phaseCount: number;
    completed: boolean;
}

export interface InjuryRow {
    injury: Injury;
    fighter: Fighter;
    plan: InjuryPlanSummary | null;
}

export interface InjuryListProps {
    rows: InjuryRow[];
    now: string;
    pathname: string;
    searchParams: SearchParams;
    sort: string;
    direction: SortDirection;
}

/** Sortable injury table on md+ and stacked injury cards on small screens. */
export function InjuryList({ rows, now, pathname, searchParams, sort, direction }: InjuryListProps) {
    const sortable = { pathname, searchParams, activeSort: sort, direction };
    return (
        <>
            <div className="hidden md:block">
                <Table caption="Injuries of your assigned fighters">
                    <THead>
                        <tr>
                            <SortableTH label="Fighter" sortKey="fighter" {...sortable} />
                            <SortableTH label="Injury" sortKey="injury" {...sortable} />
                            <SortableTH label="Severity" sortKey="severity" {...sortable} />
                            <SortableTH label="Status" sortKey="status" {...sortable} />
                            <SortableTH label="Occurred" sortKey="occurred" {...sortable} />
                            <SortableTH label="Expected return" sortKey="return" {...sortable} />
                            <TH>Recovery plan</TH>
                        </tr>
                    </THead>
                    <TBody>
                        {rows.map(({ injury, fighter, plan }) => (
                            <TR key={injury.id}>
                                <TD>
                                    <FighterIdentity fighter={fighter} size="sm" showMeta={false} href={routes.doctor.fighter(fighter.id)} />
                                </TD>
                                <TD className="min-w-48">
                                    <Link href={routes.doctor.injury(injury.id)} className="font-medium text-fg hover:underline">
                                        {INJURY_TYPE_LABELS[injury.type]}
                                    </Link>
                                    <p className="text-[13px] text-fg-muted">{BODY_REGION_LABELS[injury.bodyRegion]}</p>
                                </TD>
                                <TD>
                                    <InjurySeverityBadge severity={injury.severity} size="sm" />
                                </TD>
                                <TD>
                                    <InjuryStatusBadge status={injury.status} size="sm" />
                                </TD>
                                <TD className="whitespace-nowrap">
                                    <time dateTime={injury.occurredAt}>{formatDate(injury.occurredAt)}</time>
                                    <p className="text-[13px] text-fg-muted">{describeDaysUntil(daysBetween(now, injury.occurredAt))}</p>
                                </TD>
                                <TD className="whitespace-nowrap">
                                    <ReturnCell injury={injury} now={now} />
                                </TD>
                                <TD className="relative min-w-40">
                                    <PlanCell plan={plan} injury={injury} />
                                </TD>
                            </TR>
                        ))}
                    </TBody>
                </Table>
            </div>

            <ul aria-label="Injuries" className="flex flex-col gap-5 pb-4 md:hidden">
                {rows.map(({ injury, fighter, plan }) => (
                    <li key={injury.id} className="flex flex-col gap-2">
                        <p className="flex min-w-0 items-center gap-2 text-[13px] font-medium text-fg-muted">
                            <Avatar name={fighter.name} shape="octagon" size="xs" />
                            <span className="truncate">{fighter.name}</span>
                        </p>
                        <InjuryCard injury={injury} now={now} href={routes.doctor.injury(injury.id)} />
                        {plan && <PlanProgress plan={plan} className="px-1" />}
                    </li>
                ))}
            </ul>
        </>
    );
}

function PlanProgress({ plan, className }: { plan: InjuryPlanSummary; className?: string }) {
    const phaseText = plan.completed ? "Plan completed" : plan.currentPhase ? `Phase ${plan.currentPhase} of ${plan.phaseCount}` : "Recovery plan";
    return (
        <div className={className}>
            <p className="mb-1 flex items-center justify-between gap-2 text-xs text-fg-muted">
                <span>{phaseText}</span>
                <span className="font-medium text-fg tabular-nums">{plan.progressPct}%</span>
            </p>
            <ProgressBar
                value={plan.progressPct}
                size="sm"
                hideValue
                tone={plan.completed ? "success" : "info"}
                label="Recovery plan progress"
                valueText={`${plan.progressPct}%, ${phaseText.toLowerCase()}`}
            />
        </div>
    );
}

function ReturnCell({ injury, now }: { injury: Injury; now: string }) {
    if (injury.resolvedAt) {
        return (
            <>
                <span className="text-fg-muted">Resolved</span>
                <p className="text-[13px] text-fg-muted">
                    <time dateTime={injury.resolvedAt}>{formatDate(injury.resolvedAt)}</time>
                </p>
            </>
        );
    }
    if (!injury.expectedReturnAt) return <span className="text-fg-muted">To be assessed</span>;
    const days = daysBetween(now, injury.expectedReturnAt);
    return (
        <>
            <time dateTime={injury.expectedReturnAt}>{formatDate(injury.expectedReturnAt)}</time>
            <p className={days < 0 ? "text-[13px] font-medium text-warning-fg" : "text-[13px] text-fg-muted"}>
                {days < 0 ? `Target passed ${describeDaysUntil(days)}` : describeDaysUntil(days)}
            </p>
        </>
    );
}

function PlanCell({ plan, injury }: { plan: InjuryPlanSummary | null; injury: Injury }) {
    if (!plan) {
        return <span className="text-[13px] text-fg-subtle">{injury.status === "resolved" ? "No plan" : "No plan yet"}</span>;
    }
    return (
        <Link href={routes.doctor.recoveryPlan(plan.id)} className="block rounded-md hover:[&_p]:text-fg">
            <span className="sr-only">Open recovery plan: </span>
            <PlanProgress plan={plan} />
        </Link>
    );
}
