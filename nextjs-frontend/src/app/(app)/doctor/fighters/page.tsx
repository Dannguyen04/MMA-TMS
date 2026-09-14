import { ClipboardPlus, SearchX, Users } from "lucide-react";
import type { Metadata } from "next";

import { ClearanceCell } from "@/components/domain/clearance-validity";
import { FighterIdentity } from "@/components/domain/fighter-identity";
import { CLEARANCE_STATE_META, HealthStatusBadge } from "@/components/domain/status-badges";
import { ActiveInjuryCell, FollowUpCell } from "@/components/medical/patient-cells";
import { PatientCard } from "@/components/medical/patient-card";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FilterBar } from "@/components/ui/filter-bar";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/states";
import { Pagination, SortableTH, Table, TBody, TD, THead, TR } from "@/components/ui/table";
import { accessibleFighterIds } from "@/lib/auth/access";
import { requireRole } from "@/lib/auth/session";
import { EXAMINATION_TYPE_LABELS, HEALTH_STATUS_LABELS, WEIGHT_CLASS_LABELS, WEIGHT_CLASS_ORDER } from "@/lib/domain/labels";
import { clearanceDaysRemaining, type ClearanceState } from "@/lib/domain/rules";
import type { HealthStatus, WeightClass } from "@/lib/domain/types";
import { formatDate } from "@/lib/format";
import { paginate, parseEnum, parseSortDirection, sortItems } from "@/lib/query";
import { routes } from "@/lib/routes";
import { getSettings } from "@/lib/services/admin";
import { getFighterHealthSummary, type FighterHealthSummary } from "@/lib/services/medical";
import { listFighters } from "@/lib/services/people";
import { param } from "@/lib/utils";

export const metadata: Metadata = { title: "Fighters" };

const PAGE_SIZE = 10;

const HEALTH_STATUSES = Object.keys(HEALTH_STATUS_LABELS) as HealthStatus[];
const CLEARANCE_STATES: ClearanceState[] = ["full", "restricted", "not_cleared", "expired", "none"];

/** Most restrictive first, so an ascending sort puts the fighters who need care on top. */
const HEALTH_RANK: Record<HealthStatus, number> = { not_cleared: 0, injured: 1, recovery: 2, monitoring: 3, healthy: 4 };
const CLEARANCE_RANK: Record<ClearanceState, number> = { not_cleared: 0, expired: 1, none: 2, restricted: 3, full: 4 };

const SORTS = ["name", "health", "clearance", "injuries", "lastExam", "followUp"] as const;
type SortKey = (typeof SORTS)[number];

function sortAccessor(key: SortKey, now: string): (summary: FighterHealthSummary) => string | number | null {
    switch (key) {
        case "name":
            return (s) => s.fighter.name;
        case "health":
            return (s) => HEALTH_RANK[s.fighter.healthStatus];
        case "clearance":
            // Group by state, then soonest to lapse first within a state.
            return (s) => CLEARANCE_RANK[s.clearanceState] * 10_000 + Math.min(9_999, (s.clearance && clearanceDaysRemaining(s.clearance, now)) ?? 9_999);
        case "injuries":
            return (s) => s.activeInjuries.length;
        case "lastExam":
            return (s) => s.latestExamination?.date ?? null;
        case "followUp":
            return (s) => s.nextFollowUp?.date ?? null;
    }
}

export default async function DoctorFightersPage({ searchParams }: PageProps<"/doctor/fighters">) {
    const user = await requireRole("doctor");
    const params = await searchParams;
    const now = new Date().toISOString();

    const search = param(params.q);
    const health = parseEnum(param(params.health), HEALTH_STATUSES);
    const clearance = parseEnum(param(params.clearance), CLEARANCE_STATES);
    const weightClass = parseEnum(param(params.weight), WEIGHT_CLASS_ORDER as WeightClass[]);
    const sort = parseEnum(param(params.sort), SORTS) ?? "name";
    const dir = parseSortDirection(param(params.dir));
    const hasFilters = Boolean(search || health || clearance || weightClass);

    // Doctors are always scoped to their assigned fighters, so every summary loads alongside the filtered list.
    const scope = accessibleFighterIds(user);
    const [fighters, settings, loaded] = await Promise.all([
        listFighters(user, { search, healthStatus: health, weightClass }),
        getSettings(),
        Promise.all((scope === "all" ? [] : scope).map((fighterId) => getFighterHealthSummary(fighterId, now))),
    ]);
    const summaryById = new Map(loaded.flatMap((summary) => (summary ? [[summary.fighter.id, summary] as const] : [])));
    const summaries = fighters
        .flatMap((fighter) => summaryById.get(fighter.id) ?? [])
        .filter((summary) => !clearance || summary.clearanceState === clearance);
    const page = paginate(sortItems(summaries, sortAccessor(sort, now), dir), param(params.page), PAGE_SIZE);
    const assignedCount = summaryById.size;
    const warningDays = settings.clearanceExpiryWarningDays;
    const pathname = routes.doctor.fighters;
    const sortProps = { pathname, searchParams: params, activeSort: sort, direction: dir };

    return (
        <>
            <PageHeader
                title="Fighters"
                description="Your assigned fighters with their health status, Medical Clearance and upcoming follow-ups."
                actions={
                    <ButtonLink href={routes.doctor.newExamination}>
                        <ClipboardPlus aria-hidden />
                        New examination
                    </ButtonLink>
                }
            />

            <div className="flex flex-col gap-4">
                <FilterBar
                    filters={[
                        { type: "search", name: "q", label: "Search fighters", placeholder: "Search name, discipline or nationality" },
                        {
                            type: "select",
                            name: "health",
                            label: "Health status",
                            allLabel: "All health statuses",
                            options: HEALTH_STATUSES.map((value) => ({ value, label: HEALTH_STATUS_LABELS[value] })),
                        },
                        {
                            type: "select",
                            name: "clearance",
                            label: "Clearance",
                            allLabel: "All clearance states",
                            options: CLEARANCE_STATES.map((value) => ({ value, label: CLEARANCE_STATE_META[value].label })),
                        },
                        {
                            type: "select",
                            name: "weight",
                            label: "Weight class",
                            allLabel: "All weight classes",
                            options: WEIGHT_CLASS_ORDER.map((value) => ({ value, label: WEIGHT_CLASS_LABELS[value] })),
                        },
                    ]}
                />

                {page.total === 0 ? (
                    hasFilters && assignedCount > 0 ? (
                        <EmptyState
                            icon={<SearchX />}
                            title="No fighters match these filters"
                            description={`None of your ${assignedCount} assigned fighters match. Try a different search or clear the filters.`}
                            action={
                                <ButtonLink href={pathname} variant="secondary">
                                    Clear filters
                                </ButtonLink>
                            }
                        />
                    ) : (
                        <EmptyState
                            icon={<Users />}
                            title="No fighters assigned to you yet"
                            description="An administrator assigns fighters to sports doctors. Once assigned, their health and clearance appear here."
                        />
                    )
                ) : (
                    <>
                        <Card className="hidden overflow-hidden md:block">
                            <Table caption="Assigned fighters">
                                <THead>
                                    <tr>
                                        <SortableTH label="Fighter" sortKey="name" {...sortProps} />
                                        <SortableTH label="Health" sortKey="health" {...sortProps} />
                                        <SortableTH label="Medical Clearance" sortKey="clearance" {...sortProps} />
                                        <SortableTH label="Active injuries" sortKey="injuries" {...sortProps} />
                                        <SortableTH label="Last examination" sortKey="lastExam" {...sortProps} />
                                        <SortableTH label="Next follow-up" sortKey="followUp" {...sortProps} />
                                    </tr>
                                </THead>
                                <TBody>
                                    {page.items.map((summary) => (
                                        <TR key={summary.fighter.id}>
                                            <TD className="min-w-56">
                                                <FighterIdentity fighter={summary.fighter} size="sm" href={routes.doctor.fighter(summary.fighter.id)} />
                                            </TD>
                                            <TD>
                                                <HealthStatusBadge status={summary.fighter.healthStatus} size="sm" />
                                            </TD>
                                            <TD className="min-w-48">
                                                <ClearanceCell
                                                    clearance={summary.clearance}
                                                    state={summary.clearanceState}
                                                    now={now}
                                                    warningDays={warningDays}
                                                />
                                            </TD>
                                            <TD className="min-w-44">
                                                <ActiveInjuryCell injuries={summary.activeInjuries} />
                                            </TD>
                                            <TD className="min-w-36">
                                                {summary.latestExamination ? (
                                                    <span className="flex flex-col gap-0.5 text-[13px]">
                                                        <time dateTime={summary.latestExamination.date}>{formatDate(summary.latestExamination.date)}</time>
                                                        <span className="text-fg-muted">{EXAMINATION_TYPE_LABELS[summary.latestExamination.type]}</span>
                                                    </span>
                                                ) : (
                                                    <span className="text-[13px] text-fg-muted">None recorded</span>
                                                )}
                                            </TD>
                                            <TD className="min-w-36">
                                                <FollowUpCell followUp={summary.nextFollowUp} />
                                            </TD>
                                        </TR>
                                    ))}
                                </TBody>
                            </Table>
                            <Pagination {...page} pathname={pathname} searchParams={params} itemLabel="fighters" />
                        </Card>

                        <div className="flex flex-col gap-3 md:hidden">
                            <ul className="grid grid-cols-1 gap-3">
                                {page.items.map((summary) => (
                                    <li key={summary.fighter.id} className="min-w-0">
                                        <PatientCard summary={summary} href={routes.doctor.fighter(summary.fighter.id)} now={now} warningDays={warningDays} />
                                    </li>
                                ))}
                            </ul>
                            <Card className="overflow-hidden [&>nav]:border-t-0">
                                <Pagination {...page} pathname={pathname} searchParams={params} itemLabel="fighters" />
                            </Card>
                        </div>
                    </>
                )}
            </div>
        </>
    );
}
