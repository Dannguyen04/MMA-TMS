import { Bandage, Plus, SearchX } from "lucide-react";
import type { Metadata } from "next";

import { BODY_REGION_GROUPS } from "@/components/clinical/clinical-copy";
import { InjuryList, type InjuryRow } from "@/components/clinical/injury-list";
import { InjuryOverview } from "@/components/clinical/injury-overview";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FilterBar } from "@/components/ui/filter-bar";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/states";
import { Pagination } from "@/components/ui/table";
import { accessibleFighterIds } from "@/lib/auth/access";
import { requireRole } from "@/lib/auth/session";
import { BODY_REGION_LABELS, INJURY_SEVERITY_LABELS, INJURY_STATUS_LABELS, INJURY_TYPE_LABELS } from "@/lib/domain/labels";
import { recoveryProgressPct } from "@/lib/domain/rules";
import type { BodyRegion, InjurySeverity, InjuryStatus, InjuryType, RecoveryPlan } from "@/lib/domain/types";
import { hrefWith, paginate, parseEnum, parseSortDirection, sortItems } from "@/lib/query";
import { routes } from "@/lib/routes";
import { listInjuries, listRecoveryPlans } from "@/lib/services/medical";
import { listFighters } from "@/lib/services/people";
import { param } from "@/lib/utils";

export const metadata: Metadata = { title: "Injuries" };

const PATH = routes.doctor.injuries;
const PAGE_SIZE = 10;
const TYPES = Object.keys(INJURY_TYPE_LABELS) as InjuryType[];
const SEVERITIES = Object.keys(INJURY_SEVERITY_LABELS) as InjurySeverity[];
const STATUSES = Object.keys(INJURY_STATUS_LABELS) as InjuryStatus[];
const REGIONS = Object.keys(BODY_REGION_LABELS) as BodyRegion[];
const SORT_KEYS = ["fighter", "injury", "severity", "status", "occurred", "return"] as const;
const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

const SEVERITY_RANK: Record<InjurySeverity, number> = { minor: 0, moderate: 1, severe: 2 };
const STATUS_RANK: Record<InjuryStatus, number> = { active: 0, recovering: 1, resolved: 2 };

export default async function DoctorInjuriesPage({ searchParams }: PageProps<"/doctor/injuries">) {
    const user = await requireRole("doctor");
    const params = await searchParams;
    const now = new Date().toISOString();
    const scope = accessibleFighterIds(user);

    const dateParam = (value: string | undefined) => (value && DATE_KEY.test(value) ? value : undefined);
    const filter = {
        search: param(params.q)?.trim() || undefined,
        fighterId: param(params.fighter),
        type: parseEnum(param(params.type), TYPES),
        severity: parseEnum(param(params.severity), SEVERITIES),
        status: parseEnum(param(params.status), STATUSES),
        bodyRegion: parseEnum(param(params.region), REGIONS),
        from: dateParam(param(params.from)),
        to: dateParam(param(params.to)),
    };
    const fighterScope = filter.fighterId && (scope === "all" || scope.includes(filter.fighterId)) ? [filter.fighterId] : scope;

    const [fighters, allInjuries, filtered, plans] = await Promise.all([
        listFighters(user),
        listInjuries({ fighterIds: scope }),
        listInjuries({
            fighterIds: fighterScope,
            search: filter.search,
            type: filter.type,
            severity: filter.severity,
            status: filter.status,
            bodyRegion: filter.bodyRegion,
            from: filter.from,
            to: filter.to,
        }),
        listRecoveryPlans({ fighterIds: scope }),
    ]);

    const fightersById = new Map(fighters.map((fighter) => [fighter.id, fighter]));
    const planByInjury = latestPlanByInjury(plans);

    const rows: InjuryRow[] = filtered.flatMap((injury) => {
        const fighter = fightersById.get(injury.fighterId);
        if (!fighter) return [];
        const plan = planByInjury.get(injury.id);
        const currentIndex = plan ? plan.phases.findIndex((phase) => phase.status === "current") : -1;
        return [
            {
                injury,
                fighter,
                plan: plan
                    ? {
                          id: plan.id,
                          progressPct: recoveryProgressPct(plan),
                          currentPhase: currentIndex === -1 ? null : currentIndex + 1,
                          phaseCount: plan.phases.length,
                          completed: plan.status === "completed",
                      }
                    : null,
            },
        ];
    });

    const sort = parseEnum(param(params.sort), SORT_KEYS) ?? "occurred";
    const direction = parseSortDirection(param(params.dir), sort === "occurred" ? "desc" : "asc");
    const sorted = sortItems(rows, (row) => sortValue(row, sort), direction);
    const page = paginate(sorted, param(params.page), PAGE_SIZE);

    const hasFilters = Object.values(filter).some(Boolean);
    const newInjuryAction = (
        <ButtonLink href={routes.doctor.newInjury}>
            <Plus aria-hidden />
            Record injury
        </ButtonLink>
    );

    return (
        <>
            <PageHeader
                title="Injuries"
                description="Injury records for your assigned fighters. Treatments, recovery plans and Medical Clearance are managed from each record."
                actions={newInjuryAction}
            />

            <div className="flex flex-col gap-6">
                <InjuryOverview
                    injuries={allInjuries}
                    fightersById={fightersById}
                    now={now}
                    statusHref={(status) => hrefWith(PATH, {}, { status })}
                />

                <section aria-labelledby="injury-records-heading" className="flex flex-col gap-4">
                    <h2 id="injury-records-heading" className="sr-only">
                        Injury records
                    </h2>
                    <FilterBar
                        filters={[
                            { type: "search", name: "q", label: "Search injuries", placeholder: "Search fighter, injury or notes" },
                            {
                                type: "select",
                                name: "fighter",
                                label: "Fighter",
                                allLabel: "All fighters",
                                options: fighters.map((fighter) => ({ value: fighter.id, label: fighter.name })),
                            },
                            {
                                type: "select",
                                name: "type",
                                label: "Injury type",
                                allLabel: "All injury types",
                                options: TYPES.map((value) => ({ value, label: INJURY_TYPE_LABELS[value] })),
                            },
                            {
                                type: "select",
                                name: "severity",
                                label: "Severity",
                                allLabel: "All severities",
                                options: SEVERITIES.map((value) => ({ value, label: INJURY_SEVERITY_LABELS[value] })),
                            },
                            {
                                type: "select",
                                name: "status",
                                label: "Status",
                                allLabel: "All statuses",
                                options: STATUSES.map((value) => ({ value, label: INJURY_STATUS_LABELS[value] })),
                            },
                            {
                                type: "select",
                                name: "region",
                                label: "Body region",
                                allLabel: "All body regions",
                                options: BODY_REGION_GROUPS.flatMap((group) => group.regions).map((value) => ({
                                    value,
                                    label: BODY_REGION_LABELS[value],
                                })),
                            },
                            { type: "date", name: "from", label: "Occurred from" },
                            { type: "date", name: "to", label: "Occurred to" },
                        ]}
                    />

                    <Card className="min-w-0 overflow-hidden max-md:rounded-none max-md:border-0 max-md:bg-transparent max-md:shadow-none">
                        {page.total === 0 ? (
                            hasFilters ? (
                                <EmptyState
                                    compact
                                    icon={<SearchX />}
                                    title="No injuries match these filters"
                                    description="Try a wider date range or fewer filters."
                                    action={
                                        <ButtonLink href={PATH} variant="secondary">
                                            Clear filters
                                        </ButtonLink>
                                    }
                                    className="py-12"
                                />
                            ) : (
                                <EmptyState
                                    compact
                                    icon={<Bandage />}
                                    title="No injuries recorded"
                                    description="When one of your fighters is injured, record it here to plan treatment, recovery and Medical Clearance."
                                    action={newInjuryAction}
                                    className="py-12"
                                />
                            )
                        ) : (
                            <>
                                <InjuryList rows={page.items} now={now} pathname={PATH} searchParams={params} sort={sort} direction={direction} />
                                <Pagination
                                    page={page.page}
                                    pageCount={page.pageCount}
                                    total={page.total}
                                    pageSize={page.pageSize}
                                    pathname={PATH}
                                    searchParams={params}
                                    itemLabel="injuries"
                                />
                            </>
                        )}
                    </Card>
                </section>
            </div>
        </>
    );
}

/** The active plan for each injury, otherwise its most recently started plan. */
function latestPlanByInjury(plans: RecoveryPlan[]): Map<string, RecoveryPlan> {
    const byInjury = new Map<string, RecoveryPlan>();
    for (const plan of plans) {
        const existing = byInjury.get(plan.injuryId);
        if (!existing || (existing.status !== "active" && (plan.status === "active" || plan.startDate > existing.startDate))) {
            byInjury.set(plan.injuryId, plan);
        }
    }
    return byInjury;
}

function sortValue(row: InjuryRow, sort: (typeof SORT_KEYS)[number]): string | number | null {
    switch (sort) {
        case "fighter":
            return row.fighter.name;
        case "injury":
            return `${INJURY_TYPE_LABELS[row.injury.type]} ${BODY_REGION_LABELS[row.injury.bodyRegion]}`;
        case "severity":
            return SEVERITY_RANK[row.injury.severity];
        case "status":
            return STATUS_RANK[row.injury.status];
        case "occurred":
            return row.injury.occurredAt;
        case "return":
            return row.injury.resolvedAt ?? row.injury.expectedReturnAt;
    }
}
