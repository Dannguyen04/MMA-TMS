import { Activity, Crosshair, Gauge, Trophy } from "lucide-react";

import { StatCard } from "@/components/ui/stat-card";
import { TONE_TEXT } from "@/components/ui/tone";
import { TECHNIQUE_LABELS } from "@/lib/domain/labels";
import type { Technique } from "@/lib/domain/types";
import { formatDelta, formatNumber } from "@/lib/format";
import type { PerformanceSummary } from "@/lib/services/performance";
import { cn } from "@/lib/utils";
import { comparisonLabel, scoreDelta } from "./performance-format";
import { TREND_META } from "./trend-badge";

export interface PerformanceKpisProps {
    summary: PerformanceSummary;
    techniqueHref?: (technique: Technique) => string;
}

/** Headline row: overall score, strongest technique, focus area and overall trend. */
export function PerformanceKpis({ summary, techniqueHref }: PerformanceKpisProps) {
    const { latest, strongest, weakest, deltas, comparisonWeeks, trend } = summary;
    const hasComparison = comparisonWeeks > 0;
    const trendMeta = TREND_META[trend];
    const TrendIcon = trendMeta.icon;

    return (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
                label="Overall score"
                value={formatNumber(summary.overall, 1)}
                unit="/ 100"
                icon={<Gauge aria-hidden />}
                delta={scoreDelta(summary.overallDelta, comparisonWeeks)}
                hint={hasComparison ? undefined : "No earlier week to compare yet"}
            />
            <StatCard
                label="Strongest technique"
                value={TECHNIQUE_LABELS[strongest]}
                icon={<Trophy aria-hidden />}
                delta={scoreDelta(deltas[strongest], comparisonWeeks)}
                hint={`Score ${latest.scores[strongest]}`}
                href={techniqueHref?.(strongest)}
            />
            <StatCard
                label="Focus area"
                value={TECHNIQUE_LABELS[weakest]}
                icon={<Crosshair aria-hidden />}
                delta={scoreDelta(deltas[weakest], comparisonWeeks)}
                hint={`Score ${latest.scores[weakest]}`}
                href={techniqueHref?.(weakest)}
            />
            <StatCard
                label="Trend"
                icon={<Activity aria-hidden />}
                value={
                    hasComparison ? (
                        <span className="inline-flex items-center gap-2">
                            <TrendIcon aria-hidden className={cn("size-6 shrink-0", TONE_TEXT[trendMeta.tone])} />
                            {trendMeta.label}
                        </span>
                    ) : (
                        <span className="text-fg-muted">Too early</span>
                    )
                }
                hint={
                    hasComparison
                        ? `Overall ${formatDelta(summary.overallDelta, 1)} pts ${comparisonLabel(comparisonWeeks)}`
                        : "A trend needs at least one earlier complete week"
                }
            />
        </div>
    );
}
