"use client";

import { useMemo, type ReactNode } from "react";

import { BarChart } from "@/components/charts/bar-chart";
import { ChartFigure } from "@/components/charts/chart-figure";
import { CHART_SERIES, TECHNIQUE_COLOR } from "@/components/charts/colors";
import { HorizontalBars } from "@/components/charts/horizontal-bars";
import { MetricTile } from "@/components/domain/metric-tile";
import { useT } from "@/components/i18n/locale-provider";
import { AIGeneratedBadge } from "@/components/domain/status-badges";
import { Card, CardHeader } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/progress";
import { Tabs } from "@/components/ui/tabs";
import { STRIKE_TYPES, techniqueLabel } from "@/lib/domain/labels";
import type { AIAnalysis, BodyActivity } from "@/lib/domain/types";
import { formatClock, formatNumber, formatPercent } from "@/lib/format";
import type { MessageKey } from "@/lib/i18n/translate";
import { average, cn, round } from "@/lib/utils";
import { confidencePct } from "./video-copy";

const BODY_LABELS: Record<keyof BodyActivity, MessageKey> = {
    hands: "screens.video.metrics.body.hands" as MessageKey,
    legs: "screens.video.metrics.body.legs" as MessageKey,
    head: "screens.video.metrics.body.head" as MessageKey,
    shoulders: "screens.video.metrics.body.shoulders" as MessageKey,
    hips: "screens.video.metrics.body.hips" as MessageKey,
};

const SEGMENT_SEC = 30;

function Explainer({ children }: { children: ReactNode }) {
    return <p className="text-[13px] text-pretty text-fg-muted">{children}</p>;
}

function TileGrid({ children, className }: { children: ReactNode; className?: string }) {
    return <div className={cn("grid grid-cols-2 gap-2 sm:grid-cols-3", className)}>{children}</div>;
}

/** Performance metrics computed from the detections, grouped by what a coach asks about. */
export function MetricsPanel({ analysis, className }: { analysis: AIAnalysis; className?: string }) {
    const t = useT();
    const { metrics, detections } = analysis;
    const total = detections.length;

    const countItems = useMemo(
        () =>
            [...STRIKE_TYPES]
                .sort((a, b) => metrics.strikeCounts[b] - metrics.strikeCounts[a])
                .map((type) => ({
                    label: techniqueLabel(t, type),
                    value: metrics.strikeCounts[type],
                    color: TECHNIQUE_COLOR[type],
                    hint: total > 0 ? t("screens.video.metrics.shareOfStrikes", { pct: Math.round((metrics.strikeCounts[type] / total) * 100) }) : undefined,
                })),
        [metrics.strikeCounts, total, t],
    );

    const speedItems = STRIKE_TYPES.filter((type) => metrics.strikeCounts[type] > 0).map((type) => ({
        label: techniqueLabel(t, type),
        value: metrics.avgPeakSpeed[type],
        color: TECHNIQUE_COLOR[type],
        hint: t("screens.video.metrics.detectedCount", { n: metrics.strikeCounts[type] }),
    }));

    const segments = useMemo(() => {
        const count = Math.max(1, Math.ceil(analysis.durationMs / (SEGMENT_SEC * 1000)));
        return Array.from({ length: count }, (_, i) => {
            const punches = detections.filter((d) => d.type !== "kick" && d.peakMs >= i * SEGMENT_SEC * 1000 && d.peakMs < (i + 1) * SEGMENT_SEC * 1000);
            return { label: formatClock(i * SEGMENT_SEC), value: punches.length > 0 ? round(average(punches.map((d) => d.peakSpeed)), 1) : null };
        });
    }, [analysis.durationMs, detections]);

    const byType = (field: "accelerationProxy" | "hipRotationDeg") =>
        STRIKE_TYPES.filter((type) => metrics.strikeCounts[type] > 0).map((type) => ({
            type,
            value: round(average(detections.filter((d) => d.type === type).map((d) => d[field])), 1),
        }));

    const bodyItems = (Object.keys(BODY_LABELS) as (keyof BodyActivity)[])
        .map((key) => ({ label: t(BODY_LABELS[key]), value: metrics.bodyActivity[key], color: CHART_SERIES[0] }))
        .sort((a, b) => b.value - a.value);

    const uptime = metrics.guard.uptimePct;

    const items = [
        {
            id: "overview",
            label: t("screens.video.metrics.overview"),
            content: (
                <div className="flex flex-col gap-4 pt-4">
                    <Explainer>{t("screens.video.metrics.overviewDesc")}</Explainer>
                    <TileGrid className="sm:grid-cols-4">
                        <MetricTile label={t("screens.video.metrics.strikesPerMin")} value={formatNumber(metrics.strikesPerMin, 1)} hint={t("screens.video.metrics.strikesCount", { n: total })} />
                        <MetricTile label={t("screens.video.metrics.combinations")} value={metrics.combinations} hint={t("screens.video.metrics.combinationsHint")} />
                        <MetricTile label={t("screens.video.trackingQuality")} value={formatPercent(analysis.trackingQuality * 100)} hint={t("screens.video.metrics.trackingHint")} />
                        <MetricTile
                            label={t("screens.video.detectionConfidence")}
                            value={analysis.confidenceAvailable === false ? t("screens.video.unavailable") : confidencePct(t, analysis.overallConfidence)}
                            hint={analysis.confidenceAvailable === false ? t("screens.video.metrics.notCalibrated") : t("screens.video.metrics.meanOfDetections")}
                        />
                    </TileGrid>
                    <ChartFigure
                        title={t("screens.video.metrics.strikesDetected")}
                        description={t("screens.video.metrics.strikesDetectedDesc")}
                        table={{ columns: [t("screens.video.metrics.colStrike"), t("screens.video.metrics.colCount"), t("screens.video.metrics.colShare")], rows: countItems.map((i) => [i.label, i.value, i.hint ?? "—"]) }}
                    >
                        <HorizontalBars items={countItems} ariaLabel={t("screens.video.metrics.strikesByType")} />
                    </ChartFigure>
                </div>
            ),
        },
        {
            id: "speed",
            label: t("screens.video.metrics.speed"),
            content: (
                <div className="flex flex-col gap-4 pt-4">
                    <Explainer>{t("screens.video.metrics.speedDesc")}</Explainer>
                    <ChartFigure
                        title={t("screens.video.metrics.avgPeakSpeed")}
                        description={t("screens.video.metrics.avgPeakSpeedDesc")}
                        table={{ columns: [t("screens.video.metrics.colStrike"), t("screens.video.metrics.colAvgPeakSpeed"), t("screens.video.metrics.colDetected")], rows: speedItems.map((i) => [i.label, i.value, i.hint]) }}
                    >
                        <HorizontalBars items={speedItems} ariaLabel={t("screens.video.metrics.avgPeakSpeedByType")} valueSuffix=" m/s" decimals={1} />
                    </ChartFigure>
                    <ChartFigure
                        title={t("screens.video.metrics.punchSpeed")}
                        description={t("screens.video.metrics.punchSpeedDesc", { sec: SEGMENT_SEC })}
                        table={{ columns: [t("screens.video.metrics.colSegment"), t("screens.video.metrics.colAvgPunchSpeed")], rows: segments.map((s) => [s.label, s.value ?? "—"]) }}
                    >
                        <BarChart
                            ariaLabel={t("screens.video.metrics.punchSpeedChart", { sec: SEGMENT_SEC })}
                            labels={segments.map((s) => s.label)}
                            series={[{ id: "speed", label: t("screens.video.metrics.punchSpeedSeries"), color: CHART_SERIES[0], values: segments.map((s) => s.value) }]}
                            height={200}
                            decimals={1}
                        />
                    </ChartFigure>
                    <div>
                        <p className="mb-2 text-sm font-medium text-fg">{t("screens.video.metrics.accelerationProxy")}</p>
                        <TileGrid className="sm:grid-cols-4">
                            {byType("accelerationProxy").map(({ type, value }) => (
                                <MetricTile key={type} label={techniqueLabel(t, type)} value={formatNumber(value, 1)} unit="/ 10" />
                            ))}
                        </TileGrid>
                    </div>
                </div>
            ),
        },
        {
            id: "mechanics",
            label: t("screens.video.metrics.mechanics"),
            content: (
                <div className="flex flex-col gap-4 pt-4">
                    <Explainer>{t("screens.video.metrics.mechanicsDesc")}</Explainer>
                    <TileGrid>
                        <MetricTile label={t("screens.video.metrics.punchExtension")} value={`${formatNumber(metrics.avgPunchExtensionDeg, 1)}°`} hint={t("screens.video.metrics.punchExtensionHint")} />
                        <MetricTile
                            label={t("screens.video.metrics.kickChamber")}
                            value={metrics.strikeCounts.kick > 0 ? `${formatNumber(metrics.avgKickChamberDeg, 1)}°` : "—"}
                            hint={metrics.strikeCounts.kick > 0 ? t("screens.video.metrics.lowerTighter") : t("screens.video.metrics.noKicks")}
                        />
                        <MetricTile label={t("screens.video.metrics.hipRotation")} value={`${formatNumber(metrics.avgHipRotationDeg, 1)}°`} hint={t("screens.video.metrics.allStrikes")} />
                    </TileGrid>
                    <ChartFigure
                        title={t("screens.video.metrics.hipByStrike")}
                        description={t("screens.video.metrics.hipByStrikeDesc")}
                        table={{ columns: [t("screens.video.metrics.colStrike"), t("screens.video.metrics.colAvgHip")], rows: byType("hipRotationDeg").map((r) => [techniqueLabel(t, r.type), r.value]) }}
                    >
                        <HorizontalBars
                            items={byType("hipRotationDeg").map(({ type, value }) => ({ label: techniqueLabel(t, type), value, color: TECHNIQUE_COLOR[type] }))}
                            ariaLabel={t("screens.video.metrics.hipByType")}
                            valueSuffix="°"
                            decimals={1}
                        />
                    </ChartFigure>
                </div>
            ),
        },
        {
            id: "defense",
            label: t("screens.video.metrics.defense"),
            content: (
                <div className="flex flex-col gap-4 pt-4">
                    <Explainer>{t("screens.video.metrics.defenseDesc")}</Explainer>
                    <ProgressBar
                        value={uptime}
                        label={t("screens.video.metrics.guardUptime")}
                        showLabel
                        valueText={t("screens.video.metrics.ofActiveTime", { pct: formatNumber(uptime, 1) })}
                        tone={uptime >= 84 ? "success" : uptime >= 80 ? "primary" : "warning"}
                    />
                    <TileGrid>
                        <MetricTile label={t("screens.video.metrics.guardDrops")} value={metrics.guard.drops} hint={t("screens.video.metrics.possibleDrops")} />
                        <MetricTile label={t("screens.video.metrics.guardRecovery")} value={formatNumber(metrics.guard.avgRecoveryMs)} unit="ms" hint={t("screens.video.metrics.average")} />
                        <MetricTile label={t("screens.video.metrics.headMovement")} value={formatNumber(metrics.headMovement.movesPerMin, 1)} unit={t("screens.video.metrics.perMin")} />
                        <MetricTile label={t("screens.video.metrics.slips")} value={metrics.headMovement.slips} />
                        <MetricTile label={t("screens.video.metrics.rolls")} value={metrics.headMovement.rolls} />
                        <MetricTile label={t("screens.video.metrics.centreLine")} value={formatPercent(metrics.headMovement.centerlineExposurePct)} hint={t("screens.video.metrics.lowerSafer")} />
                    </TileGrid>
                </div>
            ),
        },
        {
            id: "footwork",
            label: t("screens.video.metrics.footwork"),
            content: (
                <div className="flex flex-col gap-4 pt-4">
                    <Explainer>{t("screens.video.metrics.footworkDesc")}</Explainer>
                    <TileGrid>
                        <MetricTile label={t("screens.video.metrics.distance")} value={formatNumber(metrics.footwork.distanceM, 1)} unit="m" />
                        <MetricTile label={t("screens.video.metrics.pivots")} value={metrics.footwork.pivots} />
                        <MetricTile label={t("screens.video.metrics.stanceWidth")} value={`${formatNumber(metrics.footwork.stanceWidthRatio, 2)}×`} hint={t("screens.video.metrics.shoulderWidth")} />
                        <MetricTile label={t("screens.video.metrics.balance")} value={metrics.footwork.balanceScore} unit="/ 100" />
                        {metrics.relativeDistance !== null && (
                            <MetricTile label={t("screens.video.metrics.targetDistance")} value={formatNumber(metrics.relativeDistance, 2)} unit={t("screens.video.metrics.bodyLengths")} />
                        )}
                    </TileGrid>
                </div>
            ),
        },
        {
            id: "body",
            label: t("screens.video.metrics.bodyMovement"),
            content: (
                <div className="flex flex-col gap-4 pt-4">
                    <Explainer>{t("screens.video.metrics.bodyMovementDesc")}</Explainer>
                    <ChartFigure
                        title={t("screens.video.metrics.bodyShare")}
                        table={{ columns: [t("screens.video.metrics.colRegion"), t("screens.video.metrics.colSharePct")], rows: bodyItems.map((i) => [i.label, `${i.value}%`]) }}
                    >
                        <HorizontalBars items={bodyItems} ariaLabel={t("screens.video.metrics.bodyShareAria")} valueSuffix="%" max={100} />
                    </ChartFigure>
                </div>
            ),
        },
    ];

    return (
        <Card className={cn("min-w-0", className)}>
            <CardHeader title={t("screens.video.metrics.title")} description={t("screens.video.metrics.description")} action={<AIGeneratedBadge size="sm" label={t("screens.video.metrics.aiDerived")} />} />
            <div className="px-5 pb-5">
                <Tabs items={items} label={t("screens.video.metrics.groups")} />
            </div>
        </Card>
    );
}
