import { ArrowRight } from "lucide-react";

import { formatMeasure } from "@/components/domain/domain-format";
import type { FighterIdentityData } from "@/components/domain/fighter-identity";
import { FighterIdentity } from "@/components/domain/fighter-identity";
import { GoalStatusBadge } from "@/components/domain/status-badges";
import { TechniqueChip } from "@/components/domain/technique-chip";
import { ProgressBar } from "@/components/ui/progress";
import { SortableTH, TBody, TD, TH, THead, TR, Table } from "@/components/ui/table";
import { goalProgressPct } from "@/lib/domain/rules";
import type { Goal } from "@/lib/domain/types";
import { daysBetween, formatDate, pluralize } from "@/lib/format";
import type { SearchParams, SortDirection } from "@/lib/query";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { GoalActions } from "./goal-actions";

export type GoalFighter = FighterIdentityData & { id: string };

export interface GoalsTableProps {
    goals: Goal[];
    fighters: Record<string, GoalFighter>;
    now: string;
    pathname: string;
    searchParams: SearchParams;
    sort?: string;
    direction: SortDirection;
}

function isOpen(goal: Goal): boolean {
    return goal.status === "on_track" || goal.status === "at_risk";
}

function DueText({ goal, now }: { goal: Goal; now: string }) {
    const days = daysBetween(now, goal.dueDate);
    return (
        <span className="flex flex-col">
            <time dateTime={goal.dueDate} className="whitespace-nowrap text-fg">
                {formatDate(goal.dueDate)}
            </time>
            {isOpen(goal) && (
                <span className={cn("text-xs whitespace-nowrap", days < 0 ? "font-medium text-warning-fg" : "text-fg-muted")}>
                    {days < 0 ? `${pluralize(-days, "day")} overdue` : days === 0 ? "Due today" : `${pluralize(days, "day")} left`}
                </span>
            )}
        </span>
    );
}

/** Resets table-cell padding and display so a row can become a stacked card below `md`. */
const STACKED_CELL = "max-md:block max-md:p-0 max-md:first:pl-0 max-md:last:pr-0";

/**
 * Cross-roster goal list: a sortable table on wider screens that restacks each row into a card on phones.
 * One row per goal, so each goal's actions (and their dialogs) are mounted once.
 */
export function GoalsTable({ goals, fighters, now, pathname, searchParams, sort, direction }: GoalsTableProps) {
    const sortProps = { pathname, searchParams, activeSort: sort, direction };

    return (
        <Table caption="Goals across your roster" className="max-md:block">
            <THead className="max-md:hidden">
                <tr>
                    <SortableTH label="Fighter" sortKey="fighter" {...sortProps} />
                    <SortableTH label="Goal" sortKey="goal" {...sortProps} />
                    <SortableTH label="Progress" sortKey="progress" {...sortProps} />
                    <SortableTH label="Status" sortKey="status" {...sortProps} />
                    <SortableTH label="Due" sortKey="due" {...sortProps} />
                    <TH className="text-right">
                        <span className="sr-only">Actions</span>
                    </TH>
                </tr>
            </THead>
            <TBody className="max-md:block">
                {goals.map((goal) => {
                    const fighter = fighters[goal.fighterId];
                    const progress = goalProgressPct(goal);
                    return (
                        <TR key={goal.id} className="max-md:grid max-md:grid-cols-[minmax(0,1fr)_auto] max-md:items-center max-md:gap-3 max-md:px-4 max-md:py-4">
                            <TD className={cn(STACKED_CELL, "min-w-44 max-md:col-start-1 max-md:row-start-1 max-md:min-w-0")}>
                                {fighter ? (
                                    <FighterIdentity fighter={fighter} size="sm" showMeta={false} href={routes.coach.fighterGoals(fighter.id)} />
                                ) : (
                                    <span className="text-fg-muted">Unknown fighter</span>
                                )}
                            </TD>
                            <TD className={cn(STACKED_CELL, "min-w-64 max-md:col-span-2 max-md:row-start-2 max-md:min-w-0")}>
                                <p className="font-medium text-fg">{goal.title}</p>
                                <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-fg-muted">
                                    <span>
                                        {goal.metricLabel}
                                        {goal.lowerIsBetter && <span className="text-fg-subtle"> · lower is better</span>}
                                    </span>
                                    {goal.technique && <TechniqueChip technique={goal.technique} size="sm" />}
                                </p>
                            </TD>
                            <TD className={cn(STACKED_CELL, "w-48 min-w-44 max-md:col-span-2 max-md:row-start-3 max-md:w-auto max-md:min-w-0")}>
                                <p className="mb-1 flex items-baseline justify-between gap-2 text-[13px] whitespace-nowrap">
                                    <span>
                                        <span className="font-medium text-fg">{formatMeasure(goal.current, goal.unit)}</span>
                                        <ArrowRight aria-hidden className="mx-1 inline size-3 text-fg-subtle" />
                                        <span className="sr-only">target</span>
                                        <span className="text-fg-muted">{formatMeasure(goal.target, goal.unit)}</span>
                                    </span>
                                    <span className="text-xs text-fg-muted">{progress}%</span>
                                </p>
                                <ProgressBar value={progress} size="sm" label={`Progress to target for ${goal.title}`} valueText={`${progress}%`} hideValue />
                            </TD>
                            <TD className={cn(STACKED_CELL, "max-md:col-start-2 max-md:row-start-1 max-md:justify-self-end")}>
                                <GoalStatusBadge status={goal.status} size="sm" />
                            </TD>
                            <TD className={cn(STACKED_CELL, "max-md:col-start-1 max-md:row-start-4 max-md:text-[13px]")}>
                                <DueText goal={goal} now={now} />
                            </TD>
                            <TD className={cn(STACKED_CELL, "text-right max-md:col-start-2 max-md:row-start-4")}>
                                <GoalActions goal={goal} fighterName={fighter?.name ?? "the fighter"} now={now} variant="icons" />
                            </TD>
                        </TR>
                    );
                })}
            </TBody>
        </Table>
    );
}
