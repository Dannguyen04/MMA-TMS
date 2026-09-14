import { Users } from "lucide-react";

import { CHART_SERIES } from "@/components/charts/colors";
import { Sparkline } from "@/components/charts/sparkline";
import { FighterIdentity } from "@/components/domain/fighter-identity";
import { FighterStatusBadges } from "@/components/domain/status-badges";
import { DeltaText } from "@/components/performance/delta-text";
import { changeDelta, SCORE_NOISE_POINTS } from "@/components/performance/performance-format";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { formatNumber, formatTime } from "@/lib/format";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { CardLink } from "./card-link";
import { relativeDay } from "./dashboard-utils";
import type { RosterEntry } from "./roster-data";

const COLUMNS = "md:grid-cols-[minmax(0,1.45fr)_minmax(0,1.15fr)_minmax(0,9.5rem)_minmax(0,1.2fr)]";

export interface RosterGlanceProps {
    entries: RosterEntry[];
    /** Server time (ISO). */
    now: string;
    className?: string;
}

/** Compact roster rows: identity, clearance and health, overall score trend and next session. */
export function RosterGlance({ entries, now, className }: RosterGlanceProps) {
    return (
        <Card className={cn("min-w-0", className)}>
            <CardHeader
                title="Roster at a glance"
                description="Clearance, health, score trend and next session"
                icon={<Users />}
                action={<CardLink href={routes.coach.fighters}>All fighters</CardLink>}
            />
            {entries.length === 0 ? (
                <EmptyState compact icon={<Users />} title="No fighters assigned yet" description="Fighters assigned to you appear here." />
            ) : (
                <>
                    <div
                        aria-hidden
                        className={cn(
                            "hidden gap-4 border-y border-border bg-surface-muted/60 px-5 py-2 text-xs font-semibold tracking-wide text-fg-muted md:grid",
                            COLUMNS,
                        )}
                    >
                        <span>Fighter</span>
                        <span>Clearance &amp; health</span>
                        <span>Overall score</span>
                        <span>Next session</span>
                    </div>
                    <ul className="flex flex-col divide-y divide-border border-t border-border md:border-t-0">
                        {entries.map((entry) => (
                            <GlanceRow key={entry.fighter.id} entry={entry} now={now} />
                        ))}
                    </ul>
                </>
            )}
        </Card>
    );
}

function GlanceRow({ entry, now }: { entry: RosterEntry; now: string }) {
    const { fighter, performance, overallSeries, nextSession } = entry;

    return (
        <li className={cn("grid grid-cols-1 items-center gap-x-4 gap-y-2.5 px-5 py-3 sm:grid-cols-2", COLUMNS)}>
            <FighterIdentity fighter={fighter} size="sm" href={routes.coach.fighter(fighter.id)} className="sm:col-span-2 md:col-span-1" />
            <div className="flex flex-wrap gap-1.5">
                <span className="sr-only">Clearance and health: </span>
                <FighterStatusBadges healthStatus={fighter.healthStatus} clearanceState={entry.clearanceState} size="sm" />
            </div>
            <div className="flex min-w-0 items-center gap-2.5">
                {performance ? (
                    <>
                        <p className="shrink-0 leading-tight">
                            <span className="sr-only">Overall score </span>
                            <span className="text-[15px] font-semibold text-fg tabular-nums">{formatNumber(performance.overall, 1)}</span>
                            {entry.hasComparison && (
                                <DeltaText
                                    delta={changeDelta(performance.overallDelta, { decimals: 1, neutralWithin: SCORE_NOISE_POINTS })}
                                    className="block"
                                />
                            )}
                        </p>
                        {overallSeries.length >= 2 && (
                            <Sparkline
                                values={overallSeries}
                                color={CHART_SERIES[0]}
                                width={64}
                                height={24}
                                className="shrink-0"
                                ariaLabel={`${fighter.name}'s overall score over ${overallSeries.length} weeks, from ${formatNumber(overallSeries[0], 1)} to ${formatNumber(overallSeries[overallSeries.length - 1], 1)}`}
                            />
                        )}
                    </>
                ) : (
                    <span className="text-xs text-fg-subtle">No scored weeks yet</span>
                )}
            </div>
            <p className="min-w-0 text-[13px] leading-snug sm:col-span-2 md:col-span-1">
                <span className="sr-only">Next session: </span>
                {nextSession ? (
                    <>
                        <span className="block font-medium text-fg">
                            {relativeDay(nextSession.scheduledAt, now)} · <time dateTime={nextSession.scheduledAt}>{formatTime(nextSession.scheduledAt)}</time>
                        </span>
                        <span className="block truncate text-fg-muted">{nextSession.title}</span>
                    </>
                ) : (
                    <span className="text-fg-subtle">Nothing scheduled</span>
                )}
            </p>
        </li>
    );
}
