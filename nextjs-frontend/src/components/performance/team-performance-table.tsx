import { TECHNIQUE_COLOR } from "@/components/charts/colors";
import { FighterIdentity, type FighterIdentityData } from "@/components/domain/fighter-identity";
import { SortableTH, TBody, TD, TH, THead, TR, Table } from "@/components/ui/table";
import { techniqueLabel, TECHNIQUES } from "@/lib/domain/labels";
import type { Technique } from "@/lib/domain/types";
import { formatNumber } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";
import { createTranslator, type Translator } from "@/lib/i18n/translate";
import type { SearchParams, SortDirection } from "@/lib/query";
import { routes } from "@/lib/routes";
import type { TeamPerformanceRow } from "@/lib/services/performance";
import { DeltaText } from "./delta-text";
import { changeDelta, SCORE_NOISE_POINTS, techniqueShortLabel } from "./performance-format";
import { TrendBadge } from "./trend-badge";

export interface TeamTableRow extends TeamPerformanceRow {
    fighter: FighterIdentityData & { id: string };
    /** False when there is no earlier week to compare with, so deltas mean nothing yet. */
    hasComparison: boolean;
}

export interface TeamPerformanceTableProps {
    rows: TeamTableRow[];
    pathname: string;
    searchParams: SearchParams;
    sort: string;
    direction: SortDirection;
    locale: Locale;
}

/** Roster performance: identity, overall with change, trend, the eight technique scores and training volume. */
export function TeamPerformanceTable({ rows, pathname, searchParams, sort, direction, locale }: TeamPerformanceTableProps) {
    const t = createTranslator(locale);
    const sortProps = { pathname, searchParams, activeSort: sort, direction };

    return (
        <Table caption={t("screens.performance.team.tableCaption")}>
            <THead>
                <tr>
                    <SortableTH label={t("screens.performance.fighter")} sortKey="fighter" {...sortProps} />
                    <SortableTH label={t("screens.performance.team.overall")} sortKey="overall" {...sortProps} />
                    <SortableTH label={t("screens.performance.trend")} sortKey="trend" {...sortProps} />
                    <TH>{t("screens.performance.techniqueScores")}</TH>
                    <SortableTH label={t("screens.performance.minutes")} sortKey="minutes" align="right" className="text-right" {...sortProps} />
                    <SortableTH label={t("screens.performance.sessions")} sortKey="sessions" align="right" className="text-right" {...sortProps} />
                </tr>
            </THead>
            <TBody>
                {rows.map((row) => (
                    <TR key={row.fighterId}>
                        <TD className="min-w-44">
                            <FighterIdentity fighter={row.fighter} size="sm" href={routes.coach.fighterPerformance(row.fighterId)} showMeta={false} />
                        </TD>
                        <TD className="whitespace-nowrap">
                            <span className="text-[15px] font-semibold text-fg">{formatNumber(row.overall, 1)}</span>
                            {row.hasComparison && (
                                <DeltaText delta={changeDelta(row.overallDelta, { decimals: 1, neutralWithin: SCORE_NOISE_POINTS })} className="ml-1.5" locale={locale} />
                            )}
                        </TD>
                        <TD>
                            {row.hasComparison ? (
                                <TrendBadge trend={row.trend} size="sm" locale={locale} />
                            ) : (
                                <span className="text-xs text-fg-subtle">{t("screens.performance.tooEarly")}</span>
                            )}
                        </TD>
                        <TD>
                            <TechniqueScores scores={row.scores} t={t} />
                        </TD>
                        <TD className="text-right">{formatNumber(row.trainingMinutes)}</TD>
                        <TD className="text-right">{row.sessionsCompleted}</TD>
                    </TR>
                ))}
            </TBody>
        </Table>
    );
}

/** All eight technique scores as labelled mini bars: short label, value and a bar in the technique's colour. */
function TechniqueScores({ scores, t }: { scores: Record<Technique, number>; t: Translator }) {
    return (
        <ul aria-label={t("screens.performance.techniqueScores")} className="relative grid min-w-72 grid-cols-4 gap-x-3 gap-y-2 2xl:grid-cols-8">
            {TECHNIQUES.map((technique) => (
                <li key={technique} className="flex min-w-0 flex-col gap-1">
                    <span className="flex items-baseline justify-between gap-1 text-[11px] leading-none">
                        <span aria-hidden className="truncate text-fg-muted">
                            {techniqueShortLabel(t, technique)}
                        </span>
                        <span className="sr-only">{`${techniqueLabel(t, technique)}: `}</span>
                        <span className="font-medium text-fg">{scores[technique]}</span>
                    </span>
                    <span aria-hidden className="h-1 overflow-hidden rounded-full bg-surface-hover">
                        <span className="block h-full rounded-full" style={{ width: `${scores[technique]}%`, backgroundColor: TECHNIQUE_COLOR[technique] }} />
                    </span>
                </li>
            ))}
        </ul>
    );
}
