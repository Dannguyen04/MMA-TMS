import { TECHNIQUE_COLOR } from "@/components/charts/colors";
import { FighterIdentity, type FighterIdentityData } from "@/components/domain/fighter-identity";
import { SortableTH, TBody, TD, TH, THead, TR, Table } from "@/components/ui/table";
import { TECHNIQUE_LABELS, TECHNIQUES } from "@/lib/domain/labels";
import type { Technique } from "@/lib/domain/types";
import { formatNumber } from "@/lib/format";
import type { SearchParams, SortDirection } from "@/lib/query";
import { routes } from "@/lib/routes";
import type { TeamPerformanceRow } from "@/lib/services/performance";
import { DeltaText } from "./delta-text";
import { changeDelta, SCORE_NOISE_POINTS, TECHNIQUE_SHORT_LABELS } from "./performance-format";
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
}

/** Roster performance: identity, overall with change, trend, the eight technique scores and training volume. */
export function TeamPerformanceTable({ rows, pathname, searchParams, sort, direction }: TeamPerformanceTableProps) {
    const sortProps = { pathname, searchParams, activeSort: sort, direction };

    return (
        <Table caption="Team performance for the latest complete week">
            <THead>
                <tr>
                    <SortableTH label="Fighter" sortKey="fighter" {...sortProps} />
                    <SortableTH label="Overall" sortKey="overall" {...sortProps} />
                    <SortableTH label="Trend" sortKey="trend" {...sortProps} />
                    <TH>Technique scores</TH>
                    <SortableTH label="Minutes" sortKey="minutes" align="right" className="text-right" {...sortProps} />
                    <SortableTH label="Sessions" sortKey="sessions" align="right" className="text-right" {...sortProps} />
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
                            {row.hasComparison && <DeltaText delta={changeDelta(row.overallDelta, { decimals: 1, neutralWithin: SCORE_NOISE_POINTS })} className="ml-1.5" />}
                        </TD>
                        <TD>{row.hasComparison ? <TrendBadge trend={row.trend} size="sm" /> : <span className="text-xs text-fg-subtle">Too early</span>}</TD>
                        <TD>
                            <TechniqueScores scores={row.scores} />
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
function TechniqueScores({ scores }: { scores: Record<Technique, number> }) {
    return (
        <ul aria-label="Technique scores" className="relative grid min-w-72 grid-cols-4 gap-x-3 gap-y-2 2xl:grid-cols-8">
            {TECHNIQUES.map((technique) => (
                <li key={technique} className="flex min-w-0 flex-col gap-1">
                    <span className="flex items-baseline justify-between gap-1 text-[11px] leading-none">
                        <span aria-hidden className="truncate text-fg-muted">
                            {TECHNIQUE_SHORT_LABELS[technique]}
                        </span>
                        <span className="sr-only">{`${TECHNIQUE_LABELS[technique]}: `}</span>
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
