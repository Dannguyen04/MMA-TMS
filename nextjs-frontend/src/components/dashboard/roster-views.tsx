import { CalendarClock } from "lucide-react";

import { CHART_SERIES } from "@/components/charts/colors";
import { Sparkline } from "@/components/charts/sparkline";
import { ClearanceCell, ClearanceValidity } from "@/components/domain/clearance-validity";
import { FighterCard } from "@/components/domain/fighter-card";
import { FighterIdentity } from "@/components/domain/fighter-identity";
import { HealthStatusBadge } from "@/components/domain/status-badges";
import { DeltaText } from "@/components/performance/delta-text";
import { changeDelta, SCORE_NOISE_POINTS } from "@/components/performance/performance-format";
import { TrendBadge } from "@/components/performance/trend-badge";
import { SortableTH, TBody, TD, THead, TR, Table } from "@/components/ui/table";
import { WEIGHT_CLASS_LABELS } from "@/lib/domain/labels";
import { clearanceExpiresSoon } from "@/lib/domain/rules";
import { formatNumber, formatTime } from "@/lib/format";
import type { SearchParams, SortDirection } from "@/lib/query";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { recordText, relativeDay } from "./dashboard-utils";
import type { RosterEntry } from "./roster-data";

function ScoreSparkline({ entry, width }: { entry: RosterEntry; width: number }) {
    const { overallSeries: values, fighter } = entry;
    if (values.length < 2) return null;
    return (
        <Sparkline
            values={values}
            color={CHART_SERIES[0]}
            width={width}
            height={28}
            className="shrink-0"
            ariaLabel={`${fighter.name}'s overall score over ${values.length} weeks, from ${formatNumber(values[0], 1)} to ${formatNumber(values[values.length - 1], 1)}`}
        />
    );
}

function NextSessionText({ entry, now, narrow = false, className }: { entry: RosterEntry; now: string; narrow?: boolean; className?: string }) {
    const session = entry.nextSession;
    if (!session) return <span className={cn("text-fg-subtle", className)}>Nothing scheduled</span>;
    return (
        <span className={cn("min-w-0", className)}>
            <span className="font-medium text-fg">
                {relativeDay(session.scheduledAt, now)} · <time dateTime={session.scheduledAt}>{formatTime(session.scheduledAt)}</time>
            </span>
            <span className={cn("block truncate text-fg-muted", narrow && "max-w-40")}>{session.title}</span>
        </span>
    );
}

/* ─── Grid ────────────────────────────────────────────────────────────────── */

export function RosterGrid({ entries, now, warningDays }: { entries: RosterEntry[]; now: string; warningDays: number }) {
    return (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {entries.map((entry) => (
                <li key={entry.fighter.id} className="min-w-0">
                    <FighterCard
                        fighter={entry.fighter}
                        clearanceState={entry.clearanceState}
                        now={now}
                        href={routes.coach.fighter(entry.fighter.id)}
                        className="h-full"
                    >
                        <RosterCardDetails entry={entry} now={now} warningDays={warningDays} />
                    </FighterCard>
                </li>
            ))}
        </ul>
    );
}

function RosterCardDetails({ entry, now, warningDays }: { entry: RosterEntry; now: string; warningDays: number }) {
    const { performance, clearance, clearanceState } = entry;

    return (
        <div className="flex flex-col gap-3 border-t border-border pt-3">
            <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-xs text-fg-muted">Overall score</p>
                    {performance ? (
                        <p className="mt-0.5 flex flex-wrap items-baseline gap-x-1.5">
                            <span className="text-lg leading-tight font-semibold text-fg">{formatNumber(performance.overall, 1)}</span>
                            {entry.hasComparison && <DeltaText delta={changeDelta(performance.overallDelta, { decimals: 1, neutralWithin: SCORE_NOISE_POINTS })} />}
                        </p>
                    ) : (
                        <p className="mt-0.5 text-sm text-fg-subtle">No scored weeks yet</p>
                    )}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <ScoreSparkline entry={entry} width={88} />
                    {performance && entry.hasComparison && <TrendBadge trend={performance.trend} size="sm" />}
                </div>
            </div>
            <p className="flex items-start gap-2 text-[13px] leading-snug">
                <CalendarClock aria-hidden className="mt-0.5 size-3.5 shrink-0 text-fg-subtle" />
                <span className="sr-only">Next session: </span>
                <NextSessionText entry={entry} now={now} />
            </p>
            {clearanceExpiresSoon(clearance, warningDays, now) && (
                <ClearanceValidity clearance={clearance} state={clearanceState} now={now} warningDays={warningDays} variant="inline" />
            )}
        </div>
    );
}

/* ─── Table ───────────────────────────────────────────────────────────────── */

export interface RosterTableProps {
    entries: RosterEntry[];
    now: string;
    warningDays: number;
    pathname: string;
    searchParams: SearchParams;
    sort: string;
    direction: SortDirection;
}

export function RosterTable({ entries, now, warningDays, pathname, searchParams, sort, direction }: RosterTableProps) {
    const sortProps = { pathname, searchParams, activeSort: sort, direction };

    return (
        <Table caption="Fighters on your roster">
            <THead>
                <tr>
                    <SortableTH label="Fighter" sortKey="name" {...sortProps} />
                    <SortableTH label="Weight class" sortKey="weight" {...sortProps} />
                    <SortableTH label="Record" sortKey="record" {...sortProps} />
                    <SortableTH label="Health" sortKey="health" {...sortProps} />
                    <SortableTH label="Clearance" sortKey="clearance" {...sortProps} />
                    <SortableTH label="Overall" sortKey="overall" {...sortProps} />
                    <SortableTH label="Trend" sortKey="trend" {...sortProps} />
                    <SortableTH label="Next session" sortKey="next" {...sortProps} />
                </tr>
            </THead>
            <TBody>
                {entries.map((entry) => {
                    const { fighter, performance, clearance, clearanceState } = entry;
                    return (
                        // Positioned cells keep screen-reader-only text inside the table's scroll container on narrow screens.
                        <TR key={fighter.id} className="[&>td]:relative">
                            <TD className="min-w-44">
                                <FighterIdentity fighter={fighter} size="sm" href={routes.coach.fighter(fighter.id)} showMeta={false} />
                            </TD>
                            <TD className="whitespace-nowrap text-fg-muted">{WEIGHT_CLASS_LABELS[fighter.weightClass]}</TD>
                            <TD className="whitespace-nowrap">
                                <span aria-hidden>{recordText(fighter)}</span>
                                <span className="sr-only">
                                    {fighter.record.wins} wins, {fighter.record.losses} losses, {fighter.record.draws} draws
                                </span>
                            </TD>
                            <TD>
                                <HealthStatusBadge status={fighter.healthStatus} size="sm" />
                            </TD>
                            <TD className="min-w-44">
                                <ClearanceCell clearance={clearance} state={clearanceState} now={now} warningDays={warningDays} />
                            </TD>
                            <TD className="whitespace-nowrap">
                                {performance ? (
                                    <span className="inline-flex items-center gap-2">
                                        <span className="font-semibold text-fg">{formatNumber(performance.overall, 1)}</span>
                                        {entry.hasComparison && (
                                            <DeltaText delta={changeDelta(performance.overallDelta, { decimals: 1, neutralWithin: SCORE_NOISE_POINTS })} />
                                        )}
                                    </span>
                                ) : (
                                    <span className="text-xs text-fg-subtle">No data yet</span>
                                )}
                            </TD>
                            <TD>
                                {performance && entry.hasComparison ? <TrendBadge trend={performance.trend} size="sm" /> : <span className="text-xs text-fg-subtle">Too early</span>}
                            </TD>
                            <TD className="text-[13px] leading-snug">
                                <NextSessionText entry={entry} now={now} narrow className="block" />
                            </TD>
                        </TR>
                    );
                })}
            </TBody>
        </Table>
    );
}
