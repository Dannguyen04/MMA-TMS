import { ChevronRight } from "lucide-react";
import Link from "next/link";

import { TECHNIQUE_COLOR } from "@/components/charts/colors";
import { Sparkline } from "@/components/charts/sparkline";
import { TechniqueChip } from "@/components/domain/technique-chip";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { TECHNIQUE_LABELS, TECHNIQUES } from "@/lib/domain/labels";
import type { PerformanceMetric, Technique } from "@/lib/domain/types";
import { pluralize } from "@/lib/format";
import type { PerformanceSummary } from "@/lib/services/performance";
import { cn } from "@/lib/utils";
import { DeltaText } from "./delta-text";
import { comparisonLabel, scoreDelta } from "./performance-format";

export interface TechniqueScoresCardProps {
    summary: PerformanceSummary;
    /** Complete weeks, oldest first. */
    weeks: PerformanceMetric[];
    heading: "h2" | "h3";
    techniqueHref?: (technique: Technique) => string;
}

/** Eight score tiles: latest score, change vs the comparison average and a weekly sparkline. */
export function TechniqueScoresCard({ summary, weeks, heading, techniqueHref }: TechniqueScoresCardProps) {
    const description =
        summary.comparisonWeeks > 0
            ? `Latest complete week · change ${comparisonLabel(summary.comparisonWeeks)}`
            : "Latest complete week · changes appear after another complete week";

    return (
        <Card className="min-w-0">
            <CardHeader as={heading} title="Technique scores" description={description} />
            <CardContent>
                <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                    {TECHNIQUES.map((technique) => (
                        <li key={technique} className="@container min-w-0">
                            <TechniqueTile
                                technique={technique}
                                score={summary.latest.scores[technique]}
                                change={summary.deltas[technique]}
                                comparisonWeeks={summary.comparisonWeeks}
                                history={weeks.map((week) => week.scores[technique])}
                                href={techniqueHref?.(technique)}
                                isStrongest={technique === summary.strongest}
                                isFocus={technique === summary.weakest}
                            />
                        </li>
                    ))}
                </ul>
            </CardContent>
        </Card>
    );
}

interface TechniqueTileProps {
    technique: Technique;
    score: number;
    change: number;
    comparisonWeeks: number;
    history: number[];
    href?: string;
    isStrongest: boolean;
    isFocus: boolean;
}

function TechniqueTile({ technique, score, change, comparisonWeeks, history, href, isStrongest, isFocus }: TechniqueTileProps) {
    const delta = scoreDelta(change, comparisonWeeks);
    const label = TECHNIQUE_LABELS[technique];
    const tag = isStrongest ? "Strongest" : isFocus ? "Focus area" : null;

    const body = (
        <>
            <div className="min-w-0">
                <div className="flex min-w-0 pr-5">
                    <TechniqueChip technique={technique} size="sm" className="min-w-0" />
                </div>
                {href && (
                    <ChevronRight aria-hidden className="absolute top-3.5 right-3 size-4 text-fg-subtle transition-transform group-hover:translate-x-0.5" />
                )}
                <p className="mt-2.5 flex items-baseline gap-1.5">
                    <span className="text-2xl leading-none font-semibold tracking-tight text-fg">{score}</span>
                    <span className="sr-only">out of 100</span>
                    {delta && <DeltaText delta={{ ...delta, label: undefined }} />}
                </p>
                <p className="mt-1 h-4 truncate text-[11px] font-medium tracking-wide text-fg-subtle uppercase">{tag}</p>
            </div>
            <div className="shrink-0 pt-2 @min-[15rem]:pt-0">
                {history.length >= 2 ? (
                    <Sparkline
                        values={history}
                        color={TECHNIQUE_COLOR[technique]}
                        width={96}
                        height={32}
                        ariaLabel={`${label} score over ${pluralize(history.length, "week")}, from ${history[0]} to ${history[history.length - 1]}`}
                        className="block"
                    />
                ) : (
                    <p className="flex h-8 items-center text-xs text-fg-subtle">Trend after 2 weeks</p>
                )}
            </div>
        </>
    );

    const classes =
        "relative flex h-full flex-col rounded-lg border border-border bg-surface p-3 @min-[15rem]:flex-row @min-[15rem]:items-end @min-[15rem]:justify-between @min-[15rem]:gap-3";

    return href ? (
        <Link
            href={href}
            aria-label={`${label}: score ${score}${delta ? `, ${delta.value} ${delta.label ?? ""}` : ""}. View technique detail`}
            className={cn(classes, "group transition-colors hover:border-border-strong hover:shadow-card")}
        >
            {body}
        </Link>
    ) : (
        <div className={classes}>{body}</div>
    );
}
