"use client";

import { useDemoCopy, useLocale } from "@/components/i18n/locale-provider";
import { CalendarClock, History, ListChecks } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { MetricTile } from "@/components/domain/metric-tile";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { Pagination } from "@/components/ui/table";
import type { TrainingSession } from "@/lib/domain/types";
import { formatMinutes, formatNumber } from "@/lib/format";
import { paginate, type SearchParams } from "@/lib/query";
import { average, sum } from "@/lib/utils";
import { SessionTable, type TrainingAudience } from "./session-table";
import { planAdherence, rpeLabel } from "./training-utils";

const PAST_PAGE_SIZE = 10;
const UPCOMING_SHOWN = 5;

export interface PlanSessionsCardProps {
    sessions: TrainingSession[];
    audience: TrainingAudience;
    now: string;
    pathname: string;
    searchParams: SearchParams;
    /** Where the full upcoming schedule lives (the fighter's schedule or the coach calendar). */
    upcomingHref: string;
    emptyAction?: ReactNode;
}

/** A plan's sessions: everything upcoming, then past sessions (newest first, paginated). */
export function PlanSessionsCard({ sessions, audience, now, pathname, searchParams, upcomingHref, emptyAction }: PlanSessionsCardProps) {
    const copy = useDemoCopy();
    const locale = useLocale();
    const upcoming = sessions.filter((s) => (s.status === "scheduled" || s.status === "in_progress") && s.scheduledAt >= now);
    const past = sessions.filter((s) => !upcoming.includes(s)).sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt));
    const page = paginate(past, typeof searchParams.page === "string" ? searchParams.page : undefined, PAST_PAGE_SIZE);

    return (
        <Card className="overflow-hidden">
            <CardHeader title={copy("Sessions in this plan")} description={copy("{n} upcoming · {past} past", { n: upcoming.length, past: past.length })} icon={<ListChecks />} />
            {sessions.length === 0 ? (
                <CardContent>
                    <EmptyState
                        compact
                        icon={<CalendarClock />}
                        title={copy("No sessions scheduled in this plan")}
                        description={audience === "coach" ? copy("Schedule the first session to start tracking adherence.") : copy("Your coach hasn't scheduled sessions for this plan yet.")}
                        action={emptyAction}
                    />
                </CardContent>
            ) : (
                <>
                    <div className="border-t border-border">
                        <h3 className="flex items-center gap-2 px-5 pt-4 pb-2 text-sm font-semibold text-fg">
                            <CalendarClock aria-hidden className="size-4 text-fg-subtle" />
                            {copy("Upcoming")} <span className="font-normal text-fg-muted">({upcoming.length})</span>
                        </h3>
                        {upcoming.length === 0 ? (
                            <p className="px-5 pb-4 text-sm text-fg-muted">{copy("Nothing scheduled ahead in this plan.")} </p>
                        ) : (
                            <>
                                <SessionTable locale={locale} sessions={upcoming.slice(0, UPCOMING_SHOWN)} audience={audience} caption={copy("Upcoming sessions in this plan")} stackOnMobile />
                                {upcoming.length > UPCOMING_SHOWN && (
                                    <p className="border-t border-border px-5 py-3 text-[13px] text-fg-muted">
                                        {copy("Showing the next {shown} of {total}.", { shown: UPCOMING_SHOWN, total: upcoming.length })}{" "}
                                        <Link href={upcomingHref} className="font-medium text-primary-soft-fg hover:underline">
                                            {audience === "fighter" ? copy("Open your schedule") : copy("Open the calendar")}
                                        </Link>
                                    </p>
                                )}
                            </>
                        )}
                    </div>
                    <div className="border-t border-border">
                        <h3 className="flex items-center gap-2 px-5 pt-4 pb-2 text-sm font-semibold text-fg">
                            <History aria-hidden className="size-4 text-fg-subtle" />
                            {copy("Past sessions")} <span className="font-normal text-fg-muted">({past.length})</span>
                        </h3>
                        {past.length === 0 ? (
                            <p className="px-5 pb-4 text-sm text-fg-muted">{copy("No past sessions yet.")} </p>
                        ) : (
                            <>
                                <SessionTable locale={locale} sessions={page.items} audience={audience} caption={copy("Past sessions in this plan")} showVideo stackOnMobile />
                                <Pagination locale={locale}
                                    page={page.page}
                                    pageCount={page.pageCount}
                                    total={page.total}
                                    pageSize={page.pageSize}
                                    pathname={pathname}
                                    searchParams={searchParams}
                                    itemLabel={copy("past sessions")}
                                />
                            </>
                        )}
                    </div>
                </>
            )}
        </Card>
    );
}

/** Totals for a plan so far: completion, training time, average RPE and coach rating. */
export function PlanStatsCard({ sessions, now }: { sessions: TrainingSession[]; now: string }) {
    const copy = useDemoCopy();
    const adherence = planAdherence(sessions, now);
    const completed = sessions.filter((s) => s.status === "completed" && s.result);
    const minutes = sum(completed.map((s) => s.result?.actualDurationMin ?? 0));
    // Averages count only the sessions that have the value, so a result without a rating doesn't read as zero.
    const rpes = completed.flatMap((s) => (s.result?.rpe == null ? [] : [s.result.rpe]));
    const ratings = completed.flatMap((s) => (s.result?.coachRating == null ? [] : [s.result.coachRating]));
    const avgRpe = average(rpes);
    const avgRating = average(ratings);

    return (
        <Card>
            <CardHeader title={copy("So far")} description={copy("Sessions due up to today")} />
            <CardContent className="grid grid-cols-2 gap-3">
                <MetricTile
                    label={copy("Completed")}
                    value={adherence ? `${adherence.completed}/${adherence.due}` : "—"}
                    hint={adherence ? copy("{n}% of due sessions", { n: Math.round(adherence.pct) }) : copy("Nothing due yet")}
                />
                <MetricTile label={copy("Training time")} value={formatMinutes(minutes)} />
                <MetricTile label={copy("Average RPE")} value={rpes.length ? formatNumber(avgRpe, 1) : "—"} hint={rpes.length ? rpeLabel(avgRpe) : undefined} />
                <MetricTile label={copy("Coach rating")} value={ratings.length ? formatNumber(avgRating, 1) : "—"} unit={ratings.length ? "/ 5" : undefined} />
            </CardContent>
        </Card>
    );
}
