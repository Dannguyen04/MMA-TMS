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
import { weightClassLabel } from "@/lib/domain/labels";
import { clearanceExpiresSoon } from "@/lib/domain/rules";
import { formatNumber, formatTime } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";
import { createTranslator, type Translator } from "@/lib/i18n/translate";
import type { SearchParams, SortDirection } from "@/lib/query";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { recordSpoken, recordText, relativeDayText } from "./dashboard-utils";
import type { RosterEntry } from "./roster-data";

function ScoreSparkline({ entry, width, t }: { entry: RosterEntry; width: number; t: Translator }) {
    const { overallSeries: values, fighter } = entry;
    if (values.length < 2) return null;
    return (
        <Sparkline
            values={values}
            color={CHART_SERIES[0]}
            width={width}
            height={28}
            className="shrink-0"
            ariaLabel={t("screens.roster.sparklineLabel", { name: fighter.name, n: values.length, from: formatNumber(values[0], 1), to: formatNumber(values[values.length - 1], 1) })}
        />
    );
}

function NextSessionText({ entry, now, t, locale, narrow = false, className }: { entry: RosterEntry; now: string; t: Translator; locale: Locale; narrow?: boolean; className?: string }) {
    const session = entry.nextSession;
    if (!session) return <span className={cn("text-fg-subtle", className)}>{t("screens.roster.nothingScheduled")}</span>;
    return (
        <span className={cn("min-w-0", className)}>
            <span className="font-medium text-fg">
                {relativeDayText(t, session.scheduledAt, now)} · <time dateTime={session.scheduledAt}>{formatTime(session.scheduledAt, locale)}</time>
            </span>
            <span className={cn("block truncate text-fg-muted", narrow && "max-w-40")}>{session.title}</span>
        </span>
    );
}

/* ─── Grid ────────────────────────────────────────────────────────────────── */

export function RosterGrid({
    entries,
    now,
    warningDays,
    showPerformance,
    locale = "en",
}: {
    entries: RosterEntry[];
    now: string;
    warningDays: number;
    showPerformance: boolean;
    /** The viewer's language; English when omitted. */
    locale?: Locale;
}) {
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
                        locale={locale}
                    >
                        <RosterCardDetails entry={entry} now={now} warningDays={warningDays} showPerformance={showPerformance} locale={locale} />
                    </FighterCard>
                </li>
            ))}
        </ul>
    );
}

function RosterCardDetails({ entry, now, warningDays, showPerformance, locale }: { entry: RosterEntry; now: string; warningDays: number; showPerformance: boolean; locale: Locale }) {
    const t = createTranslator(locale);
    const { performance, clearance, clearanceState } = entry;

    return (
        <div className="flex flex-col gap-3 border-t border-border pt-3">
            {showPerformance && (
                <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                        <p className="text-xs text-fg-muted">{t("screens.roster.overallScore")}</p>
                        {performance ? (
                            <p className="mt-0.5 flex flex-wrap items-baseline gap-x-1.5">
                                <span className="text-lg leading-tight font-semibold text-fg">{formatNumber(performance.overall, 1)}</span>
                                {entry.hasComparison && <DeltaText delta={changeDelta(performance.overallDelta, { decimals: 1, neutralWithin: SCORE_NOISE_POINTS })} locale={locale} />}
                            </p>
                        ) : (
                            <p className="mt-0.5 text-sm text-fg-subtle">{t("screens.roster.noScoredWeeks")}</p>
                        )}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                        <ScoreSparkline entry={entry} width={88} t={t} />
                        {performance && entry.hasComparison && <TrendBadge trend={performance.trend} size="sm" locale={locale} />}
                    </div>
                </div>
            )}
            <p className="flex items-start gap-2 text-[13px] leading-snug">
                <CalendarClock aria-hidden className="mt-0.5 size-3.5 shrink-0 text-fg-subtle" />
                <span className="sr-only">{t("screens.roster.nextSessionSr")}</span>
                <NextSessionText entry={entry} now={now} t={t} locale={locale} />
            </p>
            {clearanceExpiresSoon(clearance, warningDays, now) && (
                <ClearanceValidity locale={locale} clearance={clearance} state={clearanceState} now={now} warningDays={warningDays} variant="inline" />
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
    /** Overall score and trend columns; off while the performance service isn't available. */
    showPerformance: boolean;
    /** The viewer's language; English when omitted. */
    locale?: Locale;
}

export function RosterTable({ entries, now, warningDays, pathname, searchParams, sort, direction, showPerformance, locale = "en" }: RosterTableProps) {
    const t = createTranslator(locale);
    const sortProps = { pathname, searchParams, activeSort: sort, direction };

    return (
        <Table caption={t("screens.roster.table.caption")}>
            <THead>
                <tr>
                    <SortableTH label={t("screens.roster.table.fighter")} sortKey="name" {...sortProps} />
                    <SortableTH label={t("screens.roster.table.weightClass")} sortKey="weight" {...sortProps} />
                    <SortableTH label={t("screens.roster.table.record")} sortKey="record" {...sortProps} />
                    <SortableTH label={t("screens.roster.table.health")} sortKey="health" {...sortProps} />
                    <SortableTH label={t("screens.roster.table.clearance")} sortKey="clearance" {...sortProps} />
                    {showPerformance && (
                        <>
                            <SortableTH label={t("screens.roster.table.overall")} sortKey="overall" {...sortProps} />
                            <SortableTH label={t("screens.roster.table.trend")} sortKey="trend" {...sortProps} />
                        </>
                    )}
                    <SortableTH label={t("screens.roster.table.nextSession")} sortKey="next" {...sortProps} />
                </tr>
            </THead>
            <TBody>
                {entries.map((entry) => {
                    const { fighter, performance, clearance, clearanceState } = entry;
                    return (
                        // Positioned cells keep screen-reader-only text inside the table's scroll container on narrow screens.
                        <TR key={fighter.id} className="[&>td]:relative">
                            <TD className="min-w-44">
                                <FighterIdentity fighter={fighter} size="sm" href={routes.coach.fighter(fighter.id)} showMeta={false} locale={locale} />
                            </TD>
                            <TD className="whitespace-nowrap text-fg-muted">{weightClassLabel(fighter.weightClass, locale)}</TD>
                            <TD className="whitespace-nowrap">
                                {fighter.record ? (
                                    <>
                                        <span aria-hidden>{recordText(fighter)}</span>
                                        <span className="sr-only">{recordSpoken(fighter, t)}</span>
                                    </>
                                ) : (
                                    <span className="text-fg-subtle">{t("screens.roster.notRecorded")}</span>
                                )}
                            </TD>
                            <TD>
                                <HealthStatusBadge status={fighter.healthStatus} size="sm" locale={locale} />
                            </TD>
                            <TD className="min-w-44">
                                <ClearanceCell locale={locale} clearance={clearance} state={clearanceState} now={now} warningDays={warningDays} />
                            </TD>
                            {showPerformance && (
                                <>
                                    <TD className="whitespace-nowrap">
                                        {performance ? (
                                            <span className="inline-flex items-center gap-2">
                                                <span className="font-semibold text-fg">{formatNumber(performance.overall, 1)}</span>
                                                {entry.hasComparison && (
                                                    <DeltaText delta={changeDelta(performance.overallDelta, { decimals: 1, neutralWithin: SCORE_NOISE_POINTS })} locale={locale} />
                                                )}
                                            </span>
                                        ) : (
                                            <span className="text-xs text-fg-subtle">{t("screens.roster.table.noData")}</span>
                                        )}
                                    </TD>
                                    <TD>
                                        {performance && entry.hasComparison ? <TrendBadge trend={performance.trend} size="sm" locale={locale} /> : <span className="text-xs text-fg-subtle">{t("screens.roster.table.tooEarly")}</span>}
                                    </TD>
                                </>
                            )}
                            <TD className="text-[13px] leading-snug">
                                <NextSessionText entry={entry} now={now} t={t} locale={locale} narrow className="block" />
                            </TD>
                        </TR>
                    );
                })}
            </TBody>
        </Table>
    );
}
