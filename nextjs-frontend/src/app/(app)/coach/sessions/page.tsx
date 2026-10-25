import { getDemoCopy, getLocale } from "@/lib/i18n/server";
import { CalendarDays, CalendarPlus, ClipboardCheck, List } from "lucide-react";
import type { Metadata } from "next";
import type { ReactNode } from "react";

import type { FighterIdentityData } from "@/components/domain/fighter-identity";
import { SessionListItem } from "@/components/domain/session-list-item";
import { WeekAgenda } from "@/components/domain/week-agenda";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { FilterBar, type FilterDefinition } from "@/components/ui/filter-bar";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/states";
import { Pagination } from "@/components/ui/table";
import { SessionTable } from "@/components/training/session-table";
import { getCoachNames, identitiesById } from "@/components/training/training-data";
import { SESSION_SORT_KEYS, describeWeekOffset, parseWeekOffset, sortSessions, weekStartKey, withinDayRange } from "@/components/training/training-utils";
import { ViewToggle } from "@/components/training/view-toggle";
import { WeekNav, weekRangeLabel } from "@/components/training/week-nav";
import { WeekSummary } from "@/components/training/week-summary";
import { accessibleFighterIds, canAccessFighter } from "@/lib/auth/access";
import { requireRole } from "@/lib/auth/session";
import { SESSION_STATUS_LABELS, TRAINING_TYPE_LABELS } from "@/lib/domain/labels";
import type { SessionStatus, TrainingSession, TrainingType } from "@/lib/domain/types";
import { dayKey } from "@/lib/format";
import { hrefWith, paginate, parseEnum, parseSortDirection } from "@/lib/query";
import { routes } from "@/lib/routes";
import { listFighters } from "@/lib/services/people";
import { getWeekAgenda, listSessions } from "@/lib/services/training";
import { param } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> { const copy = await getDemoCopy(); return { title: copy("Sessions") }; }

const VIEWS = ["week", "list"] as const;
const STATUSES = Object.keys(SESSION_STATUS_LABELS) as SessionStatus[];
const TRAINING_TYPES = Object.keys(TRAINING_TYPE_LABELS) as TrainingType[];
const AWAITING_LIMIT = 6;
const LIST_PAGE_SIZE = 15;

type Params = Awaited<PageProps<"/coach/sessions">["searchParams"]>;
type Scope = string[] | "all";

export default async function CoachSessionsPage({ searchParams }: PageProps<"/coach/sessions">) {
    const copy = await getDemoCopy();
    const user = await requireRole("coach");
    const params = await searchParams;
    const now = new Date().toISOString();

    const view = parseEnum(param(params.view), VIEWS) ?? "week";
    const requestedFighter = param(params.fighter);
    const fighterId = requestedFighter && canAccessFighter(user, requestedFighter) ? requestedFighter : undefined;
    const scope: Scope = fighterId ? [fighterId] : accessibleFighterIds(user);
    const pathname = routes.coach.sessions;

    // The fighter list and the view's own reads run in one stage: the scope comes from record access, not the list.
    const [fighters, data] = await Promise.all([
        listFighters(user),
        view === "week" ? loadWeek(params, scope, now) : loadList(params, scope),
    ]);
    const fightersById = identitiesById(fighters);
    const fighterNames = Object.fromEntries(fighters.map((f) => [f.id, f.name]));
    const fighterName = fighterId ? fighterNames[fighterId] : undefined;

    const scheduleButton = (
        <ButtonLink href={hrefWith(routes.coach.newSession, {}, { fighter: fighterId })}>
            <CalendarPlus aria-hidden />
            {copy("Schedule session")} </ButtonLink>
    );

    const fighterFilter: FilterDefinition = {
        type: "select",
        name: "fighter",
        label: copy("Fighters"),
        options: fighters.map((f) => ({ value: f.id, label: f.name })),
    };

    return (
        <>
            <PageHeader title={copy("Sessions")} description={copy("Every training session across your roster — plan the week, then record results.")} actions={scheduleButton} />

            <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
                    <ViewToggle
                        label={copy("Session view")}
                        active={view}
                        defaultValue="week"
                        pathname={pathname}
                        searchParams={params}
                        reset={["page", "sort", "dir", "type", "status", copy("from"), copy("to"), "week"]}
                        options={[
                            { value: "week", label: copy("Week"), icon: CalendarDays },
                            { value: "list", label: copy("List"), icon: List },
                        ]}
                    />
                    <FilterBar
                        className="min-w-0 flex-1"
                        filters={
                            view === "week"
                                ? [fighterFilter]
                                : [
                                      fighterFilter,
                                      { type: "select", name: "type", label: copy("Types"), options: TRAINING_TYPES.map((value) => ({ value, label: copy(TRAINING_TYPE_LABELS[value]) })) },
                                      { type: "select", name: "status", label: copy("Statuses"), options: STATUSES.map((value) => ({ value, label: copy(SESSION_STATUS_LABELS[value]) })) },
                                      { type: "date", name: copy("from"), label: copy("From") },
                                      { type: "date", name: copy("to"), label: copy("To") },
                                  ]
                        }
                    />
                </div>

                {data.view === "week" ? (
                    <WeekView data={data} params={params} now={now} fightersById={fightersById} fighterName={fighterName} />
                ) : (
                    <ListView data={data} params={params} fightersById={fightersById} fighterNames={fighterNames} scheduleButton={scheduleButton} />
                )}
            </div>
        </>
    );
}

interface WeekData {
    view: "week";
    offset: number;
    startKey: string;
    weekStartIso: string;
    weekSessions: TrainingSession[];
    awaiting: TrainingSession[];
    coachNames: Record<string, string>;
}

async function loadWeek(params: Params, scope: Scope, now: string): Promise<WeekData> {
    const offset = parseWeekOffset(param(params.week));
    const startKey = weekStartKey(now, offset);
    const weekStartIso = `${startKey}T12:00:00.000Z`;
    const [agenda, awaiting, coachNames] = await Promise.all([
        getWeekAgenda(scope, weekStartIso, 7),
        listSessions({ fighterIds: scope, status: ["scheduled", "in_progress"], to: now, order: "desc" }),
        getCoachNames(),
    ]);
    return { view: "week", offset, startKey, weekStartIso, weekSessions: agenda.flatMap((day) => day.sessions), awaiting, coachNames };
}

async function WeekView({
    data,
    params,
    now,
    fightersById,
    fighterName,
}: {
    data: WeekData;
    params: Params;
    now: string;
    fightersById: Record<string, FighterIdentityData>;
    fighterName?: string;
}) {
    const copy = await getDemoCopy();
    const locale = await getLocale();
    const { offset, startKey, weekStartIso, weekSessions, awaiting, coachNames } = data;

    return (
        <div className="flex flex-col gap-6">
            <Card>
                <CardHeader
                    title={weekRangeLabel(startKey, locale)}
                    description={`${describeWeekOffset(offset, locale)} · ${copy("{n} sessions", { n: weekSessions.filter((s) => s.status !== "cancelled").length })} · ${fighterName ?? copy("Whole roster")}`}
                    icon={<CalendarDays />}
                    action={<WeekNav locale={locale} pathname={routes.coach.sessions} searchParams={params} offset={offset} startKey={startKey} />}
                    className="flex-wrap"
                />
                <CardContent>
                    <WeekAgenda locale={locale}
                        sessions={weekSessions}
                        startDate={weekStartIso}
                        now={now}
                        getHref={(session) => routes.coach.session(session.id)}
                        fightersById={fightersById}
                    />
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
                <Card className="min-w-0 overflow-hidden lg:col-span-2">
                    <CardHeader
                        title={copy("Awaiting results")}
                        description={
                            awaiting.length === 0
                                ? copy("Every past session has a result")
                                : copy("{n} sessions awaiting results", { n: awaiting.length })
                        }
                        icon={<ClipboardCheck />}
                    />
                    {awaiting.length === 0 ? (
                        <CardContent>
                            <EmptyState
                                compact
                                icon={<ClipboardCheck />}
                                title={copy("All caught up")}
                                description={copy("Results keep adherence and training load accurate for fighters and doctors.")}
                            />
                        </CardContent>
                    ) : (
                        <ul className="divide-y divide-border border-t border-border">
                            {awaiting.slice(0, AWAITING_LIMIT).map((session) => (
                                <li key={session.id}>
                                    <SessionListItem locale={locale}
                                        session={session}
                                        href={routes.coach.session(session.id)}
                                        fighter={fightersById[session.fighterId]}
                                        coachName={session.coachId ? coachNames[session.coachId] : undefined}
                                    />
                                </li>
                            ))}
                        </ul>
                    )}
                </Card>
                <WeekSummary locale={locale} sessions={weekSessions} description={fighterName ? `${fighterName} · ${weekRangeLabel(startKey, locale)}` : `${copy("Whole roster")} · ${weekRangeLabel(startKey, locale)}`} />
            </div>
        </div>
    );
}

interface ListData {
    view: "list";
    /** Sessions matching every filter, before sorting and pagination. */
    sessions: TrainingSession[];
    hasFilters: boolean;
}

async function loadList(params: Params, scope: Scope): Promise<ListData> {
    const type = parseEnum(param(params.type), TRAINING_TYPES);
    const status = parseEnum(param(params.status), STATUSES);
    const from = param(params.from);
    const to = param(params.to);
    const sessions = await listSessions({ fighterIds: scope, type, status });
    return {
        view: "list",
        sessions: sessions.filter((s) => withinDayRange(dayKey(s.scheduledAt), from, to)),
        hasFilters: Boolean(param(params.fighter) || type || status || from || to),
    };
}

async function ListView({
    data,
    params,
    fightersById,
    fighterNames,
    scheduleButton,
}: {
    data: ListData;
    params: Params;
    fightersById: Record<string, FighterIdentityData>;
    fighterNames: Record<string, string>;
    scheduleButton: ReactNode;
}) {
    const copy = await getDemoCopy();
    const locale = await getLocale();
    const { sessions, hasFilters } = data;
    const sort = parseEnum(param(params.sort), SESSION_SORT_KEYS) ?? "date";
    const dir = parseSortDirection(param(params.dir), param(params.sort) ? "asc" : "desc");
    const page = paginate(sortSessions(sessions, sort, dir, fighterNames), param(params.page), LIST_PAGE_SIZE);
    const pathname = routes.coach.sessions;

    return (
        <Card className="overflow-hidden">
            <CardHeader title={copy("All sessions")} description={copy("{n} sessions", { n: sessions.length })} icon={<List />} />
            {page.total === 0 ? (
                <CardContent>
                    {hasFilters ? (
                        <EmptyState
                            compact
                            title={copy("No sessions match these filters")}
                            description={copy("Try another fighter, type, status or date range.")}
                            action={
                                <ButtonLink href={`${pathname}?view=list`} variant="secondary" size="sm">
                                    {copy("Clear filters")} </ButtonLink>
                            }
                        />
                    ) : (
                        <EmptyState compact title={copy("No sessions yet")} description={copy("Schedule a session for a fighter on your roster.")} action={scheduleButton} />
                    )}
                </CardContent>
            ) : (
                <div className="border-t border-border">
                    <SessionTable locale={locale}
                        sessions={page.items}
                        audience="coach"
                        caption={copy("Training sessions across your roster")}
                        fightersById={fightersById}
                        showFighter
                        showVideo
                        stackOnMobile
                        sort={{ pathname, searchParams: params, sort, dir }}
                    />
                    <Pagination locale={locale}
                        page={page.page}
                        pageCount={page.pageCount}
                        total={page.total}
                        pageSize={page.pageSize}
                        pathname={pathname}
                        searchParams={params}
                        itemLabel={copy("sessions")}
                    />
                </div>
            )}
        </Card>
    );
}
