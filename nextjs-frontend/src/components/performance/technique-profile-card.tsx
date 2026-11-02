import { ChartFigure } from "@/components/charts/chart-figure";
import { CHART_MUTED, CHART_SERIES } from "@/components/charts/colors";
import { RadarChart, type RadarSeries } from "@/components/charts/radar-chart";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { techniqueLabel, TECHNIQUES } from "@/lib/domain/labels";
import type { PerformanceMetric } from "@/lib/domain/types";
import { formatDelta } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";
import { createTranslator } from "@/lib/i18n/translate";
import { COMPARISON_WEEKS, nameInText, weekLabel } from "./performance-format";

export interface TechniqueProfileCardProps {
    /** Complete weeks, oldest first; the last one is the reporting week. */
    weeks: PerformanceMetric[];
    heading: "h2" | "h3";
    locale: Locale;
}

/** Octagon radar of the eight technique scores: the reporting week against four weeks earlier. */
export function TechniqueProfileCard({ weeks, heading, locale }: TechniqueProfileCardProps) {
    const t = createTranslator(locale);
    const latest = weeks[weeks.length - 1];
    const earlier = weeks.length > COMPARISON_WEEKS ? weeks[weeks.length - 1 - COMPARISON_WEEKS] : null;
    const latestLabel = t("screens.performance.weekOf", { date: weekLabel(latest.weekStart, locale) });
    const earlierLabel = earlier ? t("screens.performance.weekOf", { date: weekLabel(earlier.weekStart, locale) }) : null;

    const series: RadarSeries[] = [
        { id: "latest", label: latestLabel, color: CHART_SERIES[0], values: TECHNIQUES.map((technique) => latest.scores[technique]) },
    ];
    if (earlier && earlierLabel) {
        series.push({ id: "earlier", label: earlierLabel, color: CHART_MUTED, values: TECHNIQUES.map((technique) => earlier.scores[technique]) });
    }

    return (
        <Card className="h-full min-w-0">
            <CardHeader
                as={heading}
                title={t("screens.performance.profile.title")}
                description={earlier ? t("screens.performance.profile.descCompare") : t("screens.performance.latestCompleteWeek")}
            />
            <CardContent>
                <ChartFigure
                    tableCaption={t("screens.performance.profile.caption")}
                    table={{
                        columns: earlierLabel
                            ? [t("screens.performance.technique"), latestLabel, earlierLabel, t("screens.performance.change")]
                            : [t("screens.performance.technique"), latestLabel],
                        rows: TECHNIQUES.map((technique) =>
                            earlier
                                ? [
                                      techniqueLabel(t, technique),
                                      latest.scores[technique],
                                      earlier.scores[technique],
                                      formatDelta(latest.scores[technique] - earlier.scores[technique]),
                                  ]
                                : [techniqueLabel(t, technique), latest.scores[technique]],
                        ),
                    }}
                >
                    <RadarChart
                        ariaLabel={
                            earlier && earlierLabel
                                ? t("screens.performance.profile.aria", { latest: nameInText(latestLabel, locale), earlier: nameInText(earlierLabel, locale) })
                                : t("screens.performance.profile.ariaSingle", { latest: nameInText(latestLabel, locale) })
                        }
                        axes={TECHNIQUES.map((technique) => ({ key: technique, label: techniqueLabel(t, technique) }))}
                        series={series}
                        size={300}
                    />
                </ChartFigure>
            </CardContent>
        </Card>
    );
}
