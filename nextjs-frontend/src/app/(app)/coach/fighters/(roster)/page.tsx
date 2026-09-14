import { CalendarPlus, LayoutGrid, SearchX, ShieldCheck, Table2, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { CLEARANCE_PRIORITY, HEALTH_PRIORITY } from "@/components/dashboard/dashboard-utils";
import { loadRoster, type RosterEntry } from "@/components/dashboard/roster-data";
import { RosterGrid, RosterTable } from "@/components/dashboard/roster-views";
import { PERFORMANCE_TRENDS, TREND_META, TREND_ORDER } from "@/components/performance/trend-badge";
import { ViewToggle } from "@/components/training/view-toggle";
import { ButtonLink, buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FilterBar, type FilterDefinition } from "@/components/ui/filter-bar";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/states";
import { Pagination } from "@/components/ui/table";
import { requireRole } from "@/lib/auth/session";
import { HEALTH_STATUS_LABELS, TRAINING_LEVEL_LABELS, WEIGHT_CLASS_LABELS, WEIGHT_CLASS_ORDER } from "@/lib/domain/labels";
import type { HealthStatus, TrainingLevel } from "@/lib/domain/types";
import { pluralize } from "@/lib/format";
import { hrefWith, matchesSearch, paginate, parseEnum, parseSortDirection, sortItems, type SortDirection } from "@/lib/query";
import { routes } from "@/lib/routes";
import { getSettings } from "@/lib/services/admin";
import { param } from "@/lib/utils";

export const metadata: Metadata = { title: "Fighters" };

const VIEWS = ["grid", "table"] as const;
const SORT_KEYS = ["name", "weight", "record", "health", "clearance", "overall", "trend", "next"] as const;
type SortKey = (typeof SORT_KEYS)[number];
const HEALTH_STATUSES = Object.keys(HEALTH_STATUS_LABELS) as HealthStatus[];
const LEVELS = Object.keys(TRAINING_LEVEL_LABELS) as TrainingLevel[];
const FILTER_KEYS = ["q", "class", "health", "level", "trend"] as const;
const PAGE_SIZE = 12;

const SORT_ACCESSORS: Record<SortKey, (entry: RosterEntry) => string | number | null> = {
    name: (entry) => entry.fighter.name,
    weight: (entry) => WEIGHT_CLASS_ORDER.indexOf(entry.fighter.weightClass),
    record: (entry) => entry.fighter.record.wins - entry.fighter.record.losses,
    health: (entry) => HEALTH_PRIORITY[entry.fighter.healthStatus],
    clearance: (entry) => CLEARANCE_PRIORITY[entry.clearanceState] * 1000 + Math.min(999, Math.max(0, entry.daysRemaining ?? 999)),
    overall: (entry) => entry.performance?.overall ?? null,
    trend: (entry) => (entry.performance && entry.hasComparison ? TREND_ORDER[entry.performance.trend] : null),
    next: (entry) => entry.nextSession?.scheduledAt ?? null,
};

export default async function CoachFightersPage({ searchParams }: PageProps<"/coach/fighters">) {
    const user = await requireRole("coach");
    const params = await searchParams;
    const now = new Date().toISOString();
    const pathname = routes.coach.fighters;

    const view = parseEnum(param(params.view), VIEWS) ?? "grid";
    const trend = parseEnum(param(params.trend), PERFORMANCE_TRENDS);
    const sort: SortKey = view === "table" ? (parseEnum(param(params.sort), SORT_KEYS) ?? "name") : "name";
    const direction: SortDirection = view === "table" ? parseSortDirection(param(params.dir), "asc") : "asc";

    const search = param(params.q);
    const weightClass = parseEnum(param(params.class), WEIGHT_CLASS_ORDER);
    const healthStatus = parseEnum(param(params.health), HEALTH_STATUSES);
    const level = parseEnum(param(params.level), LEVELS);

    // One unfiltered roster read; filters apply in memory so the counts and weight-class options share it.
    const [roster, settings] = await Promise.all([loadRoster(user, now), getSettings()]);
    const allFighters = roster.map((entry) => entry.fighter);
    const matching = roster.filter(({ fighter, hasComparison, performance }) => {
        if (weightClass && fighter.weightClass !== weightClass) return false;
        if (healthStatus && fighter.healthStatus !== healthStatus) return false;
        if (level && fighter.level !== level) return false;
        if (trend && !(hasComparison && performance?.trend === trend)) return false;
        return matchesSearch(search, fighter.name, fighter.nickname, fighter.primaryDiscipline, fighter.nationality);
    });
    const page = paginate(sortItems(matching, SORT_ACCESSORS[sort], direction), param(params.page), PAGE_SIZE);

    const filters: FilterDefinition[] = [
        { type: "search", name: "q", label: "Search fighters", placeholder: "Search fighters" },
        {
            type: "select",
            name: "class",
            label: "Weight class",
            allLabel: "All weight classes",
            options: WEIGHT_CLASS_ORDER.filter((weightClass) => allFighters.some((fighter) => fighter.weightClass === weightClass)).map((weightClass) => ({
                value: weightClass,
                label: WEIGHT_CLASS_LABELS[weightClass],
            })),
        },
        {
            type: "select",
            name: "health",
            label: "Health status",
            allLabel: "All health statuses",
            options: HEALTH_STATUSES.map((status) => ({ value: status, label: HEALTH_STATUS_LABELS[status] })),
        },
        { type: "select", name: "level", label: "Level", allLabel: "All levels", options: LEVELS.map((level) => ({ value: level, label: TRAINING_LEVEL_LABELS[level] })) },
        { type: "select", name: "trend", label: "Trend", allLabel: "All trends", options: PERFORMANCE_TRENDS.map((value) => ({ value, label: TREND_META[value].label })) },
    ];
    const clearFiltersHref = hrefWith(pathname, params, Object.fromEntries([...FILTER_KEYS, "page"].map((key) => [key, null])));

    return (
        <>
            <PageHeader
                title="Fighters"
                description={`Your roster of ${pluralize(allFighters.length, "fighter")} — health, Medical Clearance, performance and what's next.`}
                actions={
                    <>
                        <ButtonLink href={routes.coach.clearance} variant="secondary">
                            <ShieldCheck aria-hidden />
                            Medical Clearance
                        </ButtonLink>
                        <ButtonLink href={routes.coach.newSession}>
                            <CalendarPlus aria-hidden />
                            Schedule session
                        </ButtonLink>
                    </>
                }
            />

            {allFighters.length === 0 ? (
                <EmptyState
                    icon={<Users />}
                    title="No fighters assigned to you yet"
                    description="When an administrator assigns fighters to you, they appear here with their health, Medical Clearance and performance."
                />
            ) : (
                <div className="flex flex-col gap-4">
                    <FilterBar filters={filters} />
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <p aria-live="polite" className="text-sm text-fg-muted">
                            {page.total === allFighters.length
                                ? `All ${pluralize(page.total, "fighter")}`
                                : `${page.total} of ${pluralize(allFighters.length, "fighter")} match the filters`}
                        </p>
                        <div>
                            <ViewToggle
                                label="Roster view"
                                active={view}
                                defaultValue="grid"
                                pathname={pathname}
                                searchParams={params}
                                reset={["page", "sort", "dir"]}
                                options={[
                                    { value: "grid", label: "Cards", icon: LayoutGrid },
                                    { value: "table", label: "Table", icon: Table2 },
                                ]}
                            />
                        </div>
                    </div>

                    {page.total === 0 ? (
                        <EmptyState
                            icon={<SearchX />}
                            title="No fighters match these filters"
                            description="Try a different search or clear the filters to see your whole roster."
                            action={
                                <Link href={clearFiltersHref} className={buttonClasses({ variant: "secondary" })}>
                                    Clear filters
                                </Link>
                            }
                        />
                    ) : view === "table" ? (
                        <Card className="min-w-0 overflow-hidden">
                            <RosterTable
                                entries={page.items}
                                now={now}
                                warningDays={settings.clearanceExpiryWarningDays}
                                pathname={pathname}
                                searchParams={params}
                                sort={sort}
                                direction={direction}
                            />
                            <Pagination {...page} pathname={pathname} searchParams={params} itemLabel="fighters" />
                        </Card>
                    ) : (
                        <>
                            <RosterGrid entries={page.items} now={now} warningDays={settings.clearanceExpiryWarningDays} />
                            {page.pageCount > 1 && (
                                <Card className="min-w-0 overflow-hidden [&>nav]:border-t-0">
                                    <Pagination {...page} pathname={pathname} searchParams={params} itemLabel="fighters" />
                                </Card>
                            )}
                        </>
                    )}
                </div>
            )}
        </>
    );
}
