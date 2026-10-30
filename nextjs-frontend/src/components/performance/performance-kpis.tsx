import { Activity, Crosshair, Gauge, Trophy } from "lucide-react";

import { StatCard } from "@/components/ui/stat-card";
import { TONE_TEXT } from "@/components/ui/tone";
import { techniqueLabel } from "@/lib/domain/labels";
import type { Technique } from "@/lib/domain/types";
import { formatDelta, formatNumber } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";
import { createTranslator } from "@/lib/i18n/translate";
import type { PerformanceSummary } from "@/lib/services/performance";
import { cn } from "@/lib/utils";
import { comparisonLabel, scoreDelta } from "./performance-format";
import { TREND_META, trendLabel } from "./trend-badge";

export interface PerformanceKpisProps {
    summary: PerformanceSummary;
    techniqueHref?: (technique: Technique) => string;
    locale: Locale;
}

/** Headline row: overall score, strongest technique, focus area and overall trend. */
export function PerformanceKpis({ summary, techniqueHref, locale }: PerformanceKpisProps) {
    const t = createTranslator(locale);
    const { latest, strongest, weakest, deltas, comparisonWeeks, trend } = summary;
    const hasComparison = comparisonWeeks > 0;
    const trendMeta = TREND_META[trend];
    const TrendIcon = trendMeta.icon;

    return (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
                label={t("screens.performance.kpi.overall")}
                value={formatNumber(summary.overall, 1)}
                unit="/ 100"
                icon={<Gauge aria-hidden />}
                delta={scoreDelta(summary.overallDelta, comparisonWeeks, locale)}
                hint={hasComparison ? undefined : t("screens.performance.noEarlierWeek")}
                locale={locale}
            />
            <StatCard
                label={t("screens.performance.kpi.strongest")}
                value={techniqueLabel(t, strongest)}
                icon={<Trophy aria-hidden />}
                delta={scoreDelta(deltas[strongest], comparisonWeeks, locale)}
                hint={t("screens.performance.kpi.score", { score: latest.scores[strongest] })}
                href={techniqueHref?.(strongest)}
                locale={locale}
            />
            <StatCard
                label={t("screens.performance.focusArea")}
                value={techniqueLabel(t, weakest)}
                icon={<Crosshair aria-hidden />}
                delta={scoreDelta(deltas[weakest], comparisonWeeks, locale)}
                hint={t("screens.performance.kpi.score", { score: latest.scores[weakest] })}
                href={techniqueHref?.(weakest)}
                locale={locale}
            />
            <StatCard
                label={t("screens.performance.trend")}
                icon={<Activity aria-hidden />}
                value={
                    hasComparison ? (
                        <span className="inline-flex items-center gap-2">
                            <TrendIcon aria-hidden className={cn("size-6 shrink-0", TONE_TEXT[trendMeta.tone])} />
                            {trendLabel(trend, locale)}
                        </span>
                    ) : (
                        <span className="text-fg-muted">{t("screens.performance.tooEarly")}</span>
                    )
                }
                hint={
                    hasComparison
                        ? t("screens.performance.kpi.overallChange", {
                              delta: formatDelta(summary.overallDelta, 1),
                              comparison: comparisonLabel(comparisonWeeks, locale),
                          })
                        : t("screens.performance.kpi.trendNeedsWeek")
                }
                locale={locale}
            />
        </div>
    );
}
