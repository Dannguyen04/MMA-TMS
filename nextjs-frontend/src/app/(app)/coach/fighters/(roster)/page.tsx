import { CalendarPlus, LayoutGrid, SearchX, ShieldCheck, Table2, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { CLEARANCE_PRIORITY, HEALTH_PRIORITY } from "@/components/dashboard/dashboard-utils";
import { loadRoster, type RosterEntry } from "@/components/dashboard/roster-data";
import { RosterGrid, RosterTable } from "@/components/dashboard/roster-views";
import { PERFORMANCE_TRENDS, TREND_ORDER } from "@/components/performance/trend-badge";
import { ViewToggle } from "@/components/training/view-toggle";
import { ButtonLink, buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FilterBar, type FilterDefinition } from "@/components/ui/filter-bar";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/states";
import { Pagination } from "@/components/ui/table";
import { requireRole } from "@/lib/auth/session";
import { HEALTH_STATUS_LABELS, TRAINING_LEVEL_LABELS, WEIGHT_CLASS_ORDER, healthStatusLabel, trainingLevelLabel, weightClassLabel } from "@/lib/domain/labels";
import type { HealthStatus, TrainingLevel } from "@/lib/domain/types";
import { getTranslator } from "@/lib/i18n/server";
import { plural } from "@/lib/i18n/translate";
import { hrefWith, matchesSearch, paginate, parseEnum, parseSortDirection, sortItems, type SortDirection } from "@/lib/query";
import { routes } from "@/lib/routes";
import { getSettings } from "@/lib/services/admin";
import { platformFeatureAvailable } from "@/lib/services/platform-features";
import { param } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
    const { t } = await getTranslator();
    return { title: t("training.roster.metaTitle") };
}

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
    // Fighters without a known record sort last.
    record: (entry) => (entry.fighter.record ? entry.fighter.record.wins - entry.fighter.record.losses : Number.NEGATIVE_INFINITY),
    health: (entry) => HEALTH_PRIORITY[entry.fighter.healthStatus],
    clearance: (entry) => CLEARANCE_PRIORITY[entry.clearanceState] * 1000 + Math.min(999, Math.max(0, entry.daysRemaining ?? 999)),
    overall: (entry) => entry.performance?.overall ?? null,
    trend: (entry) => (entry.performance && entry.hasComparison ? TREND_ORDER[entry.performance.trend] : null),
    next: (entry) => entry.nextSession?.scheduledAt ?? null,
};

export default async function CoachFightersPage({ searchParams }: PageProps<"/coach/fighters">) {
    const { t, locale } = await getTranslator();
    const user = await requireRole("coach");
    const params = await searchParams;
    const now = new Date().toISOString();
    const pathname = routes.coach.fighters;
    const showPerformance = platformFeatureAvailable("performance");

    const view = parseEnum(param(params.view), VIEWS) ?? "grid";
    const trend = showPerformance ? parseEnum(param(params.trend), PERFORMANCE_TRENDS) : undefined;
    const sort: SortKey = view === "table" ? (parseEnum(param(params.sort), SORT_KEYS) ?? "name") : "name";
    const direction: SortDirection = view === "table" ? parseSortDirection(param(params.dir), "asc") : "asc";

    const search = param(params.q);
    const weightClass = parseEnum(param(params.class), WEIGHT_CLASS_ORDER);
    const healthStatus = parseEnum(param(params.health), HEALTH_STATUSES);
    const level = parseEnum(param(params.level), LEVELS);

    // One unfiltered roster read; filters apply in memory so the counts and weight-class options share it.
    const [roster, settings] = await Promise.all([loadRoster(user, now, { performance: showPerformance }), getSettings()]);
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
        { type: "search", name: "q", label: t("training.roster.searchLabel"), placeholder: t("training.roster.searchPlaceholder") },
        {
            type: "select",
            name: "class",
            label: t("training.roster.weightClassLabel"),
            allLabel: t("training.roster.allWeightClasses"),
            options: WEIGHT_CLASS_ORDER.filter((wc) => allFighters.some((fighter) => fighter.weightClass === wc)).map((wc) => ({
                value: wc,
                label: weightClassLabel(wc, locale),
            })),
        },
        {
            type: "select",
            name: "health",
            label: t("training.roster.healthStatusLabel"),
            allLabel: t("training.roster.allHealthStatuses"),
            options: HEALTH_STATUSES.map((status) => ({ value: status, label: healthStatusLabel(status, locale) })),
        },
        { type: "select", name: "level", label: t("training.roster.levelLabel"), allLabel: t("training.roster.allLevels"), options: LEVELS.map((lvl) => ({ value: lvl, label: trainingLevelLabel(lvl, locale) })) },
    ];
    if (showPerformance) {
        filters.push({ type: "select", name: "trend", label: t("training.roster.trendLabel"), allLabel: t("training.roster.allTrends"), options: PERFORMANCE_TRENDS.map((value) => ({ value, label: t(`screens.roster.trend.${value}`) })) });
    }
    const clearFiltersHref = hrefWith(pathname, params, Object.fromEntries([...FILTER_KEYS, "page"].map((key) => [key, null])));

    return (
        <>
            <PageHeader
                title={t("training.roster.title")}
                description={t("screens.roster.description", {
                    count: plural(t, "training.roster.fightersCount", allFighters.length),
                    performance: showPerformance ? t("training.roster.performanceText") : "",
                })}
                actions={
                    <>
                        <ButtonLink href={routes.coach.clearance} variant="secondary">
                            <ShieldCheck aria-hidden />
                            {t("training.roster.medicalClearanceAction")}
                        </ButtonLink>
                        <ButtonLink href={routes.coach.newSession}>
                            <CalendarPlus aria-hidden />
                            {t("training.roster.scheduleSessionAction")}
                        </ButtonLink>
                    </>
                }
            />

            {allFighters.length === 0 ? (
                <EmptyState
                    icon={<Users />}
                    title={t("training.roster.emptyTitle")}
                    description={t("training.roster.emptyDesc")}
                />
            ) : (
                <div className="flex flex-col gap-4">
                    <FilterBar filters={filters} />
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <p aria-live="polite" className="text-sm text-fg-muted">
                            {page.total === allFighters.length
                                ? t("training.roster.allFightersCount", { count: plural(t, "training.roster.fightersCount", page.total) })
                                : t("training.roster.matchingFightersCount", { total: page.total, count: plural(t, "training.roster.fightersCount", allFighters.length) })}
                        </p>
                        <div>
                            <ViewToggle
                                label={t("training.roster.viewLabel")}
                                active={view}
                                defaultValue="grid"
                                pathname={pathname}
                                searchParams={params}
                                reset={["page", "sort", "dir"]}
                                options={[
                                    { value: "grid", label: t("training.roster.viewCards"), icon: LayoutGrid },
                                    { value: "table", label: t("training.roster.viewTable"), icon: Table2 },
                                ]}
                            />
                        </div>
                    </div>

                    {page.total === 0 ? (
                        <EmptyState
                            icon={<SearchX />}
                            title={t("training.roster.noMatchingTitle")}
                            description={t("training.roster.noMatchingDesc")}
                            action={
                                <Link href={clearFiltersHref} className={buttonClasses({ variant: "secondary" })}>
                                    {t("training.roster.clearFilters")}
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
                                showPerformance={showPerformance}
                                locale={locale}
                            />
                            <Pagination {...page} pathname={pathname} searchParams={params} itemLabel={t("training.roster.itemLabel")} locale={locale} />
                        </Card>
                    ) : (
                        <>
                            <RosterGrid entries={page.items} now={now} warningDays={settings.clearanceExpiryWarningDays} showPerformance={showPerformance} locale={locale} />
                            {page.pageCount > 1 && (
                                <Card className="min-w-0 overflow-hidden [&>nav]:border-t-0">
                                    <Pagination {...page} pathname={pathname} searchParams={params} itemLabel={t("training.roster.itemLabel")} locale={locale} />
                                </Card>
                            )}
                        </>
                    )}
                </div>
            )}
        </>
    );
}
