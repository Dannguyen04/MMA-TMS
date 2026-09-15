import { CalendarClock, History, ListChecks } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { MetricTile } from "@/components/domain/metric-tile";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { Pagination } from "@/components/ui/table";
import type { TrainingSession } from "@/lib/domain/types";
import { formatMinutes, formatNumber, formatPercent } from "@/lib/format";
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
    const upcoming = sessions.filter((s) => (s.status === "scheduled" || s.status === "in_progress") && s.scheduledAt >= now);
    const past = sessions.filter((s) => !upcoming.includes(s)).sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt));
    const page = paginate(past, typeof searchParams.page === "string" ? searchParams.page : undefined, PAST_PAGE_SIZE);

    return (
        <Card className="overflow-hidden">
            <CardHeader title="Sessions in this plan" description={`${upcoming.length} upcoming · ${past.length} past`} icon={<ListChecks />} />
            {sessions.length === 0 ? (
                <CardContent>
                    <EmptyState
                        compact
                        icon={<CalendarClock />}
                        title="No sessions scheduled in this plan"
                        description={audience === "coach" ? "Schedule the first session to start tracking adherence." : "Your coach hasn't scheduled sessions for this plan yet."}
                        action={emptyAction}
                    />
                </CardContent>
            ) : (
                <>
                    <div className="border-t border-border">
                        <h3 className="flex items-center gap-2 px-5 pt-4 pb-2 text-sm font-semibold text-fg">
                            <CalendarClock aria-hidden className="size-4 text-fg-subtle" />
                            Upcoming
                            <span className="font-normal text-fg-muted">({upcoming.length})</span>
                        </h3>
                        {upcoming.length === 0 ? (
                            <p className="px-5 pb-4 text-sm text-fg-muted">Nothing scheduled ahead in this plan.</p>
                        ) : (
                            <>
                                <SessionTable sessions={upcoming.slice(0, UPCOMING_SHOWN)} audience={audience} caption="Upcoming sessions in this plan" stackOnMobile />
                                {upcoming.length > UPCOMING_SHOWN && (
                                    <p className="border-t border-border px-5 py-3 text-[13px] text-fg-muted">
                                        Showing the next {UPCOMING_SHOWN} of {upcoming.length}.{" "}
                                        <Link href={upcomingHref} className="font-medium text-primary-soft-fg hover:underline">
                                            {audience === "fighter" ? "Open your schedule" : "Open the calendar"}
                                        </Link>
                                    </p>
                                )}
                            </>
                        )}
                    </div>
                    <div className="border-t border-border">
                        <h3 className="flex items-center gap-2 px-5 pt-4 pb-2 text-sm font-semibold text-fg">
                            <History aria-hidden className="size-4 text-fg-subtle" />
                            Past sessions
                            <span className="font-normal text-fg-muted">({past.length})</span>
                        </h3>
                        {past.length === 0 ? (
                            <p className="px-5 pb-4 text-sm text-fg-muted">No past sessions yet.</p>
                        ) : (
                            <>
                                <SessionTable sessions={page.items} audience={audience} caption="Past sessions in this plan" showVideo stackOnMobile />
                                <Pagination
                                    page={page.page}
                                    pageCount={page.pageCount}
                                    total={page.total}
                                    pageSize={page.pageSize}
                                    pathname={pathname}
                                    searchParams={searchParams}
                                    itemLabel="past sessions"
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
    const adherence = planAdherence(sessions, now);
    const completed = sessions.filter((s) => s.status === "completed" && s.result);
    const minutes = sum(completed.map((s) => s.result?.actualDurationMin ?? 0));
    const avgRpe = average(completed.map((s) => s.result?.rpe ?? 0));
    const avgRating = average(completed.map((s) => s.result?.coachRating ?? 0));

    return (
        <Card>
            <CardHeader title="So far" description="Sessions due up to today" />
            <CardContent className="grid grid-cols-2 gap-3">
                <MetricTile
                    label="Completed"
                    value={adherence ? `${adherence.completed}/${adherence.due}` : "—"}
                    hint={adherence ? `${formatPercent(adherence.pct)} of due sessions` : "Nothing due yet"}
                />
                <MetricTile label="Training time" value={formatMinutes(minutes)} />
                <MetricTile label="Average RPE" value={completed.length ? formatNumber(avgRpe, 1) : "—"} hint={completed.length ? rpeLabel(avgRpe) : undefined} />
                <MetricTile label="Coach rating" value={completed.length ? formatNumber(avgRating, 1) : "—"} unit={completed.length ? "/ 5" : undefined} />
            </CardContent>
        </Card>
    );
}
