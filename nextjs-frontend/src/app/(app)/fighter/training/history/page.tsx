import { CalendarCheck2, CalendarDays, CalendarX2, Gauge, History, Timer } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ButtonLink } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { FilterBar } from "@/components/ui/filter-bar";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard, type StatDelta } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/states";
import { Pagination } from "@/components/ui/table";
import { SessionTable } from "@/components/training/session-table";
import { MinutesChart } from "@/components/training/training-charts";
import { SESSION_SORT_KEYS, fromTrainingProgress, rpeLabel, sortSessions, withinDayRange } from "@/components/training/training-utils";
import { requireFighterAccess } from "@/lib/auth/access";
import { requireRole } from "@/lib/auth/session";
import { SESSION_STATUS_LABELS, TRAINING_TYPE_LABELS } from "@/lib/domain/labels";
import type { SessionStatus, TrainingSession, TrainingType } from "@/lib/domain/types";
import { dayKey, formatDelta, formatMinutes, formatNumber } from "@/lib/format";
import { paginate, parseEnum, parseSortDirection } from "@/lib/query";
import { routes } from "@/lib/routes";
import { getSessionHistory, getTrainingProgress } from "@/lib/services/training";
import { average, param, sum } from "@/lib/utils";

export const metadata: Metadata = { title: "Training history" };

const DAY_MS = 86_400_000;
const WINDOW_DAYS = 30;
const HISTORY_STATUSES: SessionStatus[] = ["completed", "missed", "cancelled"];
const TRAINING_TYPES = Object.keys(TRAINING_TYPE_LABELS) as TrainingType[];

interface WindowStats {
    completed: number;
    missed: number;
    minutes: number;
    avgRpe: number | null;
}

function windowStats(sessions: TrainingSession[]): WindowStats {
    const completed = sessions.filter((s) => s.status === "completed");
    const rpes = completed.flatMap((s) => (s.result ? [s.result.rpe] : []));
    return {
        completed: completed.length,
        missed: sessions.filter((s) => s.status === "missed").length,
        minutes: sum(completed.map((s) => s.result?.actualDurationMin ?? s.durationMin)),
        avgRpe: rpes.length > 0 ? average(rpes) : null,
    };
}

function countDelta(current: number, previous: number, higherIsBetter: boolean): StatDelta {
    const diff = current - previous;
    return {
        value: formatDelta(diff),
        direction: diff > 0 ? "up" : diff < 0 ? "down" : "flat",
        sentiment: diff === 0 ? "neutral" : diff > 0 === higherIsBetter ? "good" : "bad",
        label: "vs previous 30 days",
    };
}

function minutesDelta(current: number, previous: number): StatDelta {
    const diff = current - previous;
    return {
        value: diff === 0 ? "0" : `${diff > 0 ? "+" : "−"}${formatMinutes(Math.abs(diff))}`,
        direction: diff > 0 ? "up" : diff < 0 ? "down" : "flat",
        sentiment: "neutral",
        label: "vs previous 30 days",
    };
}

export default async function FighterHistoryPage({ searchParams }: PageProps<"/fighter/training/history">) {
    const user = await requireRole("fighter");
    if (!user.profileId) notFound();
    const fighter = await requireFighterAccess(user, user.profileId);
    const params = await searchParams;

    const nowMs = new Date().getTime();
    const [history, progress] = await Promise.all([getSessionHistory(fighter.id), getTrainingProgress(fighter.id, 8)]);

    const windowStart = new Date(nowMs - WINDOW_DAYS * DAY_MS).toISOString();
    const previousStart = new Date(nowMs - 2 * WINDOW_DAYS * DAY_MS).toISOString();
    const current = windowStats(history.filter((s) => s.scheduledAt >= windowStart));
    const previous = windowStats(history.filter((s) => s.scheduledAt >= previousStart && s.scheduledAt < windowStart));

    const type = parseEnum(param(params.type), TRAINING_TYPES);
    const status = parseEnum(param(params.status), HISTORY_STATUSES);
    const from = param(params.from);
    const to = param(params.to);
    const sort = parseEnum(param(params.sort), SESSION_SORT_KEYS) ?? "date";
    const dir = parseSortDirection(param(params.dir), param(params.sort) ? "asc" : "desc");
    const hasFilters = Boolean(type || status || from || to);

    const filtered = history.filter(
        (s) => (!type || s.type === type) && (!status || s.status === status) && withinDayRange(dayKey(s.scheduledAt), from, to),
    );
    const page = paginate(sortSessions(filtered, sort, dir), param(params.page), 10);
    const pathname = routes.fighter.history;

    return (
        <>
            <PageHeader
                title="Training history"
                description="Every session you've completed, missed or had cancelled — with your RPE and your coach's rating."
                actions={
                    <ButtonLink href={routes.fighter.schedule} variant="secondary">
                        <CalendarDays aria-hidden />
                        Schedule
                    </ButtonLink>
                }
            />

            <div className="flex flex-col gap-6">
                <section aria-labelledby="last-30-heading">
                    <h2 id="last-30-heading" className="sr-only">
                        Last 30 days
                    </h2>
                    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                        <StatCard
                            label="Completed · 30 days"
                            value={current.completed}
                            unit="sessions"
                            icon={<CalendarCheck2 />}
                            delta={countDelta(current.completed, previous.completed, true)}
                        />
                        <StatCard
                            label="Missed · 30 days"
                            value={current.missed}
                            unit="sessions"
                            icon={<CalendarX2 />}
                            delta={countDelta(current.missed, previous.missed, false)}
                        />
                        <StatCard
                            label="Training time · 30 days"
                            value={formatMinutes(current.minutes)}
                            icon={<Timer />}
                            delta={minutesDelta(current.minutes, previous.minutes)}
                        />
                        <StatCard
                            label="Average RPE · 30 days"
                            value={current.avgRpe === null ? "—" : formatNumber(current.avgRpe, 1)}
                            icon={<Gauge />}
                            hint={current.avgRpe === null ? "No completed sessions" : rpeLabel(current.avgRpe)}
                        />
                    </div>
                </section>

                <MinutesChart weeks={fromTrainingProgress(progress)} />

                <Card className="overflow-hidden">
                    <CardHeader
                        title="Past sessions"
                        description={hasFilters ? `${filtered.length} of ${history.length} sessions match` : `${history.length} sessions`}
                        icon={<History />}
                    />
                    <div className="px-5 pb-4">
                        <FilterBar
                            filters={[
                                { type: "select", name: "type", label: "Types", options: TRAINING_TYPES.map((value) => ({ value, label: TRAINING_TYPE_LABELS[value] })) },
                                {
                                    type: "select",
                                    name: "status",
                                    label: "Statuses",
                                    options: HISTORY_STATUSES.map((value) => ({ value, label: SESSION_STATUS_LABELS[value] })),
                                },
                                { type: "date", name: "from", label: "From" },
                                { type: "date", name: "to", label: "To" },
                            ]}
                        />
                    </div>
                    {page.total === 0 ? (
                        <div className="border-t border-border px-5 py-6">
                            {hasFilters ? (
                                <EmptyState
                                    compact
                                    title="No sessions match these filters"
                                    description="Try a different type, status or date range."
                                    action={
                                        <ButtonLink href={pathname} variant="secondary" size="sm">
                                            Clear filters
                                        </ButtonLink>
                                    }
                                />
                            ) : (
                                <EmptyState
                                    compact
                                    icon={<History />}
                                    title="No past sessions yet"
                                    description="Sessions show up here after they've happened."
                                    action={
                                        <ButtonLink href={routes.fighter.schedule} variant="secondary" size="sm">
                                            View schedule
                                        </ButtonLink>
                                    }
                                />
                            )}
                        </div>
                    ) : (
                        <div className="border-t border-border">
                            <SessionTable
                                sessions={page.items}
                                audience="fighter"
                                caption="Past training sessions"
                                showVideo
                                stackOnMobile
                                sort={{ pathname, searchParams: params, sort, dir }}
                            />
                            <Pagination
                                page={page.page}
                                pageCount={page.pageCount}
                                total={page.total}
                                pageSize={page.pageSize}
                                pathname={pathname}
                                searchParams={params}
                                itemLabel="sessions"
                            />
                        </div>
                    )}
                </Card>
            </div>
        </>
    );
}
