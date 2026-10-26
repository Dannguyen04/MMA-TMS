import { ClipboardList, LayoutGrid, Plus, Rows3 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { FighterIdentity } from "@/components/domain/fighter-identity";
import { PlanCard } from "@/components/domain/plan-card";
import { PlanDates } from "@/components/domain/plan-schedule";
import { PlanStatusBadge } from "@/components/domain/status-badges";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FilterBar } from "@/components/ui/filter-bar";
import { PageHeader } from "@/components/ui/page-header";
import { ProgressBar } from "@/components/ui/progress";
import { EmptyState } from "@/components/ui/states";
import { Pagination, SortableTH, TBody, TD, THead, TR, Table } from "@/components/ui/table";
import { getCoachNames, identitiesById } from "@/components/training/training-data";
import { planAdherencePct } from "@/components/training/training-utils";
import { ViewToggle } from "@/components/training/view-toggle";
import { accessibleFighterIds } from "@/lib/auth/access";
import { requireRole } from "@/lib/auth/session";
import { PLAN_STATUS_LABELS, planStatusLabel, TRAINING_PHASE_LABELS, trainingPhaseLabel } from "@/lib/domain/labels";
import type { PlanStatus, TrainingPhase, TrainingPlan } from "@/lib/domain/types";
import { formatPercent } from "@/lib/format";
import { getTranslator } from "@/lib/i18n/server";
import { plural } from "@/lib/i18n/translate";
import { paginate, parseEnum, parseSortDirection, sortItems } from "@/lib/query";
import { routes } from "@/lib/routes";
import { listFighters } from "@/lib/services/people";
import { listPlans, listSessions } from "@/lib/services/training";
import { groupBy, param } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
    const { t } = await getTranslator();
    return { title: t("training.coachPlans.title") };
}

const STATUSES = Object.keys(PLAN_STATUS_LABELS) as PlanStatus[];
const PHASES = Object.keys(TRAINING_PHASE_LABELS) as TrainingPhase[];
const SORT_KEYS = ["title", "fighter", "status", "phase", "start", "adherence"] as const;
const VIEWS = ["grid", "table"] as const;

export default async function CoachPlansPage({ searchParams }: PageProps<"/coach/training-plans">) {
    const { t, locale } = await getTranslator();
    const user = await requireRole("coach");
    const params = await searchParams;
    const scope = accessibleFighterIds(user);
    const now = new Date().toISOString();

    const search = param(params.q);
    const fighterId = param(params.fighter);
    const status = parseEnum(param(params.status), STATUSES);
    const phase = parseEnum(param(params.phase), PHASES);
    const view = parseEnum(param(params.view), VIEWS) ?? "grid";
    const sort = parseEnum(param(params.sort), SORT_KEYS);
    const dir = parseSortDirection(param(params.dir));

    const [plans, fighters, sessions, coachNames] = await Promise.all([
        listPlans({ fighterIds: scope, status, search }),
        listFighters(user),
        listSessions({ fighterIds: scope }),
        getCoachNames(),
    ]);

    const fightersById = identitiesById(fighters);
    const sessionsByPlan = groupBy(
        sessions.filter((s) => s.planId !== null),
        (s) => s.planId ?? "",
    );
    const adherence = (plan: TrainingPlan) => planAdherencePct(sessionsByPlan[plan.id] ?? [], now);

    const filtered = plans.filter((plan) => (!fighterId || plan.fighterId === fighterId) && (!phase || plan.phase === phase));
    const sorted = sort
        ? sortItems(
              filtered,
              (plan) =>
                  ({
                      title: plan.title,
                      fighter: fightersById[plan.fighterId]?.name ?? "",
                      status: STATUSES.indexOf(plan.status),
                      phase: TRAINING_PHASE_LABELS[plan.phase],
                      start: plan.startDate,
                      adherence: adherence(plan) ?? null,
                  })[sort],
              dir,
          )
        : filtered;
    const page = paginate(sorted, param(params.page), view === "grid" ? 12 : 10);
    const hasFilters = Boolean(search || fighterId || status || phase);
    const pathname = routes.coach.plans;
    const activeCount = plans.filter((plan) => plan.status === "active").length;

    const newPlanButton = (
        <ButtonLink href={routes.coach.newPlan}>
            <Plus aria-hidden />
            {t("training.coachPlans.newPlan")}
        </ButtonLink>
    );

    return (
        <>
            <PageHeader
                title={t("training.coachPlans.title")}
                description={t("training.coachPlans.description", { count: plural(t, "training.coachPlans.activePlansCount", activeCount) })}
                actions={newPlanButton}
            />

            <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
                    <FilterBar
                        filters={[
                            { type: "search", name: "q", label: t("training.coachPlans.searchLabel"), placeholder: t("training.coachPlans.searchPlaceholder") },
                            { type: "select", name: "fighter", label: t("training.coachPlans.filterFighters"), options: fighters.map((f) => ({ value: f.id, label: f.name })) },
                            { type: "select", name: "status", label: t("training.coachPlans.filterStatuses"), options: STATUSES.map((value) => ({ value, label: planStatusLabel(t, value) })) },
                            { type: "select", name: "phase", label: t("training.coachPlans.filterPhases"), options: PHASES.map((value) => ({ value, label: trainingPhaseLabel(t, value) })) },
                        ]}
                    />
                    <ViewToggle
                        label={t("training.coachPlans.viewLayout")}
                        active={view}
                        defaultValue="grid"
                        pathname={pathname}
                        searchParams={params}
                        reset={["page"]}
                        options={[
                            { value: "grid", label: t("training.coachPlans.viewCards"), icon: LayoutGrid },
                            { value: "table", label: t("training.coachPlans.viewTable"), icon: Rows3 },
                        ]}
                    />
                </div>

                <p className="text-sm text-fg-muted" aria-live="polite">
                    {hasFilters
                        ? t("training.coachPlans.showingMatching", { count: plural(t, "training.coachPlans.plansCount", filtered.length) })
                        : t("training.coachPlans.showingAll", { count: plural(t, "training.coachPlans.plansCount", filtered.length) })}
                </p>

                {page.total === 0 ? (
                    hasFilters ? (
                        <EmptyState
                            icon={<ClipboardList />}
                            title={t("training.coachPlans.noMatchingTitle")}
                            description={t("training.coachPlans.noMatchingDesc")}
                            action={
                                <ButtonLink href={view === "grid" ? pathname : `${pathname}?view=table`} variant="secondary">
                                    {t("training.coachPlans.clearFilters")}
                                </ButtonLink>
                            }
                        />
                    ) : (
                        <EmptyState
                            icon={<ClipboardList />}
                            title={t("training.coachPlans.noPlansTitle")}
                            description={t("training.coachPlans.noPlansDesc")}
                            action={newPlanButton}
                        />
                    )
                ) : view === "grid" ? (
                    <div>
                        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                            {page.items.map((plan) => (
                                <li key={plan.id} className="min-w-0">
                                    <PlanCard
                                        plan={plan}
                                        now={now}
                                        fighter={fightersById[plan.fighterId]}
                                        showObjective
                                        coachName={coachNames[plan.coachId]}
                                        adherencePct={adherence(plan)}
                                        href={routes.coach.plan(plan.id)}
                                        className="h-full"
                                    />
                                </li>
                            ))}
                        </ul>
                        {page.pageCount > 1 && (
                            <div className="mt-4 overflow-hidden rounded-xl border border-border bg-surface">
                                <Pagination
                                    locale={locale}
                                    page={page.page}
                                    pageCount={page.pageCount}
                                    total={page.total}
                                    pageSize={page.pageSize}
                                    pathname={pathname}
                                    searchParams={params}
                                    itemLabel={t("training.coachPlans.itemLabel")}
                                />
                            </div>
                        )}
                    </div>
                ) : (
                    <Card className="overflow-hidden">
                        <Table caption={t("training.coachPlans.tableCaption")} className="relative">
                            <THead>
                                <tr>
                                    {(
                                        [
                                            ["title", t("training.coachPlans.thPlan")],
                                            ["fighter", t("training.coachPlans.thFighter")],
                                            ["status", t("training.coachPlans.thStatus")],
                                            ["phase", t("training.coachPlans.thPhase")],
                                            ["start", t("training.coachPlans.thDates")],
                                            ["adherence", t("training.coachPlans.thAdherence")],
                                        ] as const
                                    ).map(([key, label]) => (
                                        <SortableTH
                                            key={key}
                                            label={label}
                                            sortKey={key}
                                            pathname={pathname}
                                            searchParams={params}
                                            activeSort={sort}
                                            direction={dir}
                                        />
                                    ))}
                                </tr>
                            </THead>
                            <TBody>
                                {page.items.map((plan) => {
                                    const pct = adherence(plan);
                                    const fighter = fightersById[plan.fighterId];
                                    return (
                                        <TR key={plan.id}>
                                            <TD className="min-w-56">
                                                <Link href={routes.coach.plan(plan.id)} className="rounded-sm font-medium text-fg hover:underline">
                                                    {plan.title}
                                                </Link>
                                                <p className="text-xs text-fg-muted">
                                                    {plan.weeklySessionTarget !== null &&
                                                        t("training.coachPlans.targetSessionsAWeek", { count: plural(t, "training.sessionsCount", plan.weeklySessionTarget) })}
                                                    {t("training.plan.coach")}{" "}
                                                    {coachNames[plan.coachId] ?? "—"}
                                                </p>
                                            </TD>
                                            <TD className="min-w-44">{fighter && <FighterIdentity fighter={fighter} size="sm" showMeta={false} />}</TD>
                                            <TD>
                                                <PlanStatusBadge locale={locale} status={plan.status} size="sm" />
                                            </TD>
                                            <TD className="whitespace-nowrap text-fg-muted">{trainingPhaseLabel(t, plan.phase)}</TD>
                                            <TD className="whitespace-nowrap">
                                                <PlanDates plan={plan} short />
                                            </TD>
                                            <TD className="min-w-36">
                                                {pct === undefined ? (
                                                    <span className="text-fg-subtle">—</span>
                                                ) : (
                                                    <ProgressBar value={pct} label={t("training.coachPlans.adherenceAria", { title: plan.title })} valueText={formatPercent(pct)} size="sm" />
                                                )}
                                            </TD>
                                        </TR>
                                    );
                                })}
                            </TBody>
                        </Table>
                        <Pagination
                            locale={locale}
                            page={page.page}
                            pageCount={page.pageCount}
                            total={page.total}
                            pageSize={page.pageSize}
                            pathname={pathname}
                            searchParams={params}
                            itemLabel={t("training.coachPlans.itemLabel")}
                        />
                    </Card>
                )}
            </div>
        </>
    );
}
