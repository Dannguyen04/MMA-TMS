import { CalendarClock, SearchX, Target, TriangleAlert, Trophy } from "lucide-react";
import type { Metadata } from "next";

import { GoalsTable, type GoalFighter } from "@/components/performance/goals-table";
import { NewGoalButton } from "@/components/performance/new-goal-button";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FilterBar } from "@/components/ui/filter-bar";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/states";
import { Pagination } from "@/components/ui/table";
import { accessibleFighterIds } from "@/lib/auth/access";
import { requireRole } from "@/lib/auth/session";
import { GOAL_STATUS_LABELS, TECHNIQUE_LABELS, TECHNIQUES } from "@/lib/domain/labels";
import { goalProgressPct } from "@/lib/domain/rules";
import type { Goal, GoalStatus } from "@/lib/domain/types";
import { daysBetween, formatNumber } from "@/lib/format";
import { hrefWith, paginate, parseEnum, parseSortDirection, sortItems } from "@/lib/query";
import { routes } from "@/lib/routes";
import { listGoals } from "@/lib/services/goals";
import { listFighters } from "@/lib/services/people";
import { param } from "@/lib/utils";

export const metadata: Metadata = { title: "Goals" };

const GOAL_STATUSES: GoalStatus[] = ["at_risk", "on_track", "achieved", "missed"];
const SORT_KEYS = ["fighter", "goal", "progress", "status", "due"] as const;
type SortKey = (typeof SORT_KEYS)[number];
const PAGE_SIZE = 10;
/** Open goals due within this many days count as "due soon". */
const DUE_SOON_DAYS = 14;

function isOpen(goal: Goal): boolean {
    return goal.status === "on_track" || goal.status === "at_risk";
}

export default async function CoachGoalsPage({ searchParams }: PageProps<"/coach/goals">) {
    const user = await requireRole("coach");
    const params = await searchParams;
    const now = new Date().toISOString();

    const [fighters, goals] = await Promise.all([listFighters(user), listGoals({ fighterIds: accessibleFighterIds(user) })]);
    const fightersById: Record<string, GoalFighter> = Object.fromEntries(fighters.map((fighter) => [fighter.id, fighter]));
    const fighterOptions = fighters.map((fighter) => ({ id: fighter.id, name: fighter.name }));

    const fighterFilter = parseEnum(
        param(params.fighter),
        fighters.map((fighter) => fighter.id),
    );
    const statusFilter = parseEnum(param(params.status), GOAL_STATUSES);
    const techniqueFilter = parseEnum(param(params.technique), TECHNIQUES);
    const sort = parseEnum(param(params.sort), SORT_KEYS);
    const direction = parseSortDirection(param(params.dir));

    const filtered = goals.filter(
        (goal) =>
            (!fighterFilter || goal.fighterId === fighterFilter) &&
            (!statusFilter || goal.status === statusFilter) &&
            (!techniqueFilter || goal.technique === techniqueFilter),
    );
    const sortAccessors: Record<SortKey, (goal: Goal) => string | number> = {
        fighter: (goal) => fightersById[goal.fighterId]?.name ?? "",
        goal: (goal) => goal.title,
        progress: (goal) => goalProgressPct(goal),
        status: (goal) => GOAL_STATUSES.indexOf(goal.status),
        due: (goal) => goal.dueDate,
    };
    // Without an explicit sort, keep the service's urgency order (at risk first, then by due date).
    const sorted = sort ? sortItems(filtered, sortAccessors[sort], direction) : filtered;
    const page = paginate(sorted, param(params.page), PAGE_SIZE);

    const open = goals.filter(isOpen);
    const atRisk = open.filter((goal) => goal.status === "at_risk").length;
    const achieved = goals.filter((goal) => goal.status === "achieved").length;
    const dueSoon = open.filter((goal) => {
        const days = daysBetween(now, goal.dueDate);
        return days >= 0 && days <= DUE_SOON_DAYS;
    }).length;
    const pathname = routes.coach.goals;

    return (
        <>
            <PageHeader
                title="Goals"
                description="Measurable targets across your roster. Log progress as you measure it — fighters see every check-in."
                actions={goals.length > 0 && <NewGoalButton now={now} fighters={fighterOptions} />}
            />

            {goals.length === 0 ? (
                <EmptyState
                    icon={<Target />}
                    title="No goals across your roster yet"
                    description="Turn a focus area from Team performance into a target with a due date. Fighters are notified and follow progress on their Goals page."
                    action={<NewGoalButton now={now} fighters={fighterOptions} />}
                />
            ) : (
                <div className="flex flex-col gap-6">
                    <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
                        <StatCard label="In progress" value={formatNumber(open.length)} icon={<Target aria-hidden />} hint="On track or at risk" />
                        <StatCard
                            label="At risk"
                            value={formatNumber(atRisk)}
                            icon={<TriangleAlert aria-hidden />}
                            href={hrefWith(pathname, {}, { status: "at_risk" })}
                            hint={atRisk > 0 ? "Projected to miss the target" : "Nothing projected to miss"}
                        />
                        <StatCard label={`Due in ${DUE_SOON_DAYS} days`} value={formatNumber(dueSoon)} icon={<CalendarClock aria-hidden />} hint="Goals still in progress" />
                        <StatCard label="Achieved" value={formatNumber(achieved)} icon={<Trophy aria-hidden />} href={hrefWith(pathname, {}, { status: "achieved" })} hint="Target reached" />
                    </div>

                    <FilterBar
                        filters={[
                            { type: "select", name: "fighter", label: "Fighter", allLabel: "All fighters", options: fighterOptions.map((f) => ({ value: f.id, label: f.name })) },
                            {
                                type: "select",
                                name: "status",
                                label: "Status",
                                allLabel: "All statuses",
                                options: GOAL_STATUSES.map((status) => ({ value: status, label: GOAL_STATUS_LABELS[status] })),
                            },
                            {
                                type: "select",
                                name: "technique",
                                label: "Technique",
                                allLabel: "All techniques",
                                options: TECHNIQUES.map((technique) => ({ value: technique, label: TECHNIQUE_LABELS[technique] })),
                            },
                        ]}
                    />

                    <Card className="overflow-hidden">
                        {page.total === 0 ? (
                            <EmptyState
                                compact
                                className="py-12"
                                icon={<SearchX />}
                                title="No goals match these filters"
                                description="Try another fighter, status or technique."
                                action={
                                    <ButtonLink href={pathname} variant="secondary" size="sm">
                                        Clear filters
                                    </ButtonLink>
                                }
                            />
                        ) : (
                            <>
                                <GoalsTable goals={page.items} fighters={fightersById} now={now} pathname={pathname} searchParams={params} sort={sort} direction={direction} />
                                <Pagination page={page.page} pageCount={page.pageCount} total={page.total} pageSize={page.pageSize} pathname={pathname} searchParams={params} itemLabel="goals" />
                            </>
                        )}
                    </Card>
                </div>
            )}
        </>
    );
}
