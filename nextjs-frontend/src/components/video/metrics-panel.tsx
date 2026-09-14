"use client";

import { useMemo, type ReactNode } from "react";

import { BarChart } from "@/components/charts/bar-chart";
import { ChartFigure } from "@/components/charts/chart-figure";
import { CHART_SERIES, TECHNIQUE_COLOR } from "@/components/charts/colors";
import { HorizontalBars } from "@/components/charts/horizontal-bars";
import { MetricTile } from "@/components/domain/metric-tile";
import { AIGeneratedBadge } from "@/components/domain/status-badges";
import { Card, CardHeader } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/progress";
import { Tabs } from "@/components/ui/tabs";
import { STRIKE_TYPES, TECHNIQUE_LABELS } from "@/lib/domain/labels";
import type { AIAnalysis, BodyActivity } from "@/lib/domain/types";
import { formatClock, formatConfidence, formatNumber, formatPercent } from "@/lib/format";
import { average, cn, round } from "@/lib/utils";

const BODY_LABELS: Record<keyof BodyActivity, string> = {
    hands: "Hands",
    legs: "Legs & feet",
    head: "Head",
    shoulders: "Shoulders",
    hips: "Hips",
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
    const { metrics, detections } = analysis;
    const total = detections.length;

    const countItems = useMemo(
        () =>
            [...STRIKE_TYPES]
                .sort((a, b) => metrics.strikeCounts[b] - metrics.strikeCounts[a])
                .map((type) => ({
                    label: TECHNIQUE_LABELS[type],
                    value: metrics.strikeCounts[type],
                    color: TECHNIQUE_COLOR[type],
                    hint: total > 0 ? `${Math.round((metrics.strikeCounts[type] / total) * 100)}% of strikes` : undefined,
                })),
        [metrics.strikeCounts, total],
    );

    const speedItems = STRIKE_TYPES.filter((type) => metrics.strikeCounts[type] > 0).map((type) => ({
        label: TECHNIQUE_LABELS[type],
        value: metrics.avgPeakSpeed[type],
        color: TECHNIQUE_COLOR[type],
        hint: `${metrics.strikeCounts[type]} detected`,
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
        .map((key) => ({ label: BODY_LABELS[key], value: metrics.bodyActivity[key], color: CHART_SERIES[0] }))
        .sort((a, b) => b.value - a.value);

    const uptime = metrics.guard.uptimePct;

    const items = [
        {
            id: "overview",
            label: "Overview",
            content: (
                <div className="flex flex-col gap-4 pt-4">
                    <Explainer>How much happened in the clip and how reliably the fighter was tracked.</Explainer>
                    <TileGrid className="sm:grid-cols-4">
                        <MetricTile label="Strikes per minute" value={formatNumber(metrics.strikesPerMin, 1)} hint={`${total} strikes`} />
                        <MetricTile label="Combinations" value={metrics.combinations} hint="2+ strikes in a row" />
                        <MetricTile label="Tracking quality" value={formatPercent(analysis.trackingQuality * 100)} hint="frames with the fighter" />
                        <MetricTile label="Overall confidence" value={formatConfidence(analysis.overallConfidence)} hint="mean of detections" />
                    </TileGrid>
                    <ChartFigure
                        title="Strikes detected"
                        description="Count by strike type, most frequent first."
                        table={{ columns: ["Strike", "Count", "Share"], rows: countItems.map((i) => [i.label, i.value, i.hint ?? "—"]) }}
                    >
                        <HorizontalBars items={countItems} ariaLabel="Strikes detected by type" />
                    </ChartFigure>
                </div>
            ),
        },
        {
            id: "speed",
            label: "Speed & power",
            content: (
                <div className="flex flex-col gap-4 pt-4">
                    <Explainer>Estimated peak speed of the striking hand or foot, and how sharply it accelerated. Useful for trends, not lab-grade values.</Explainer>
                    <ChartFigure
                        title="Average peak speed"
                        description="Metres per second at the fastest frame of each strike."
                        table={{ columns: ["Strike", "Average peak speed (m/s)", "Detected"], rows: speedItems.map((i) => [i.label, i.value, i.hint]) }}
                    >
                        <HorizontalBars items={speedItems} ariaLabel="Average peak speed by strike type" valueSuffix=" m/s" decimals={1} />
                    </ChartFigure>
                    <ChartFigure
                        title="Punch speed across the clip (m/s)"
                        description={`Average punch peak speed per ${SEGMENT_SEC}-second segment — a drop late in the clip suggests fatigue.`}
                        table={{ columns: ["Segment start", "Average punch speed (m/s)"], rows: segments.map((s) => [s.label, s.value ?? "—"]) }}
                    >
                        <BarChart
                            ariaLabel="Average punch peak speed per 30-second segment"
                            labels={segments.map((s) => s.label)}
                            series={[{ id: "speed", label: "Punch speed", color: CHART_SERIES[0], values: segments.map((s) => s.value) }]}
                            height={200}
                            decimals={1}
                        />
                    </ChartFigure>
                    <div>
                        <p className="mb-2 text-sm font-medium text-fg">Acceleration proxy (0–10)</p>
                        <TileGrid className="sm:grid-cols-4">
                            {byType("accelerationProxy").map(({ type, value }) => (
                                <MetricTile key={type} label={TECHNIQUE_LABELS[type]} value={formatNumber(value, 1)} unit="/ 10" />
                            ))}
                        </TileGrid>
                    </div>
                </div>
            ),
        },
        {
            id: "mechanics",
            label: "Mechanics",
            content: (
                <div className="flex flex-col gap-4 pt-4">
                    <Explainer>Joint angles at the moment of impact, averaged across strikes. Straighter punches reach further; a tighter kick chamber hides the kick longer.</Explainer>
                    <TileGrid>
                        <MetricTile label="Punch extension" value={`${formatNumber(metrics.avgPunchExtensionDeg, 1)}°`} hint="target 155–175°" />
                        <MetricTile label="Kick chamber" value={metrics.strikeCounts.kick > 0 ? `${formatNumber(metrics.avgKickChamberDeg, 1)}°` : "—"} hint={metrics.strikeCounts.kick > 0 ? "lower is tighter" : "no kicks detected"} />
                        <MetricTile label="Hip rotation" value={`${formatNumber(metrics.avgHipRotationDeg, 1)}°`} hint="all strikes" />
                    </TileGrid>
                    <ChartFigure
                        title="Hip rotation by strike (°)"
                        description="Rear-hand punches and kicks should turn the hips the most."
                        table={{ columns: ["Strike", "Average hip rotation (°)"], rows: byType("hipRotationDeg").map((r) => [TECHNIQUE_LABELS[r.type], r.value]) }}
                    >
                        <HorizontalBars
                            items={byType("hipRotationDeg").map(({ type, value }) => ({ label: TECHNIQUE_LABELS[type], value, color: TECHNIQUE_COLOR[type] }))}
                            ariaLabel="Average hip rotation by strike type"
                            valueSuffix="°"
                            decimals={1}
                        />
                    </ChartFigure>
                </div>
            ),
        },
        {
            id: "defense",
            label: "Defense",
            content: (
                <div className="flex flex-col gap-4 pt-4">
                    <Explainer>How consistently the hands protected the chin, and how often the head moved off the centre line.</Explainer>
                    <ProgressBar
                        value={uptime}
                        label="Guard uptime"
                        showLabel
                        valueText={`${formatNumber(uptime, 1)}% of active time`}
                        tone={uptime >= 84 ? "success" : uptime >= 80 ? "primary" : "warning"}
                    />
                    <TileGrid>
                        <MetricTile label="Guard drops" value={metrics.guard.drops} hint="possible drops" />
                        <MetricTile label="Guard recovery" value={formatNumber(metrics.guard.avgRecoveryMs)} unit="ms" hint="average" />
                        <MetricTile label="Head movement" value={formatNumber(metrics.headMovement.movesPerMin, 1)} unit="/min" />
                        <MetricTile label="Slips" value={metrics.headMovement.slips} />
                        <MetricTile label="Rolls" value={metrics.headMovement.rolls} />
                        <MetricTile label="Centre-line exposure" value={formatPercent(metrics.headMovement.centerlineExposurePct)} hint="lower is safer" />
                    </TileGrid>
                </div>
            ),
        },
        {
            id: "footwork",
            label: "Footwork",
            content: (
                <div className="flex flex-col gap-4 pt-4">
                    <Explainer>Distance covered, angle changes and how stable the base stayed while striking.</Explainer>
                    <TileGrid>
                        <MetricTile label="Distance covered" value={formatNumber(metrics.footwork.distanceM, 1)} unit="m" />
                        <MetricTile label="Pivots" value={metrics.footwork.pivots} />
                        <MetricTile label="Stance width" value={`${formatNumber(metrics.footwork.stanceWidthRatio, 2)}×`} hint="shoulder width" />
                        <MetricTile label="Balance score" value={metrics.footwork.balanceScore} unit="/ 100" />
                        {metrics.relativeDistance !== null && (
                            <MetricTile label="Distance to target" value={formatNumber(metrics.relativeDistance, 2)} unit="body lengths" />
                        )}
                    </TileGrid>
                </div>
            ),
        },
        {
            id: "body",
            label: "Body movement",
            content: (
                <div className="flex flex-col gap-4 pt-4">
                    <Explainer>Share of total movement by body region — shows whether the work came from the hands, legs or the whole body.</Explainer>
                    <ChartFigure title="Movement share by body region" table={{ columns: ["Body region", "Share (%)"], rows: bodyItems.map((i) => [i.label, `${i.value}%`]) }}>
                        <HorizontalBars items={bodyItems} ariaLabel="Share of movement by body region" valueSuffix="%" max={100} />
                    </ChartFigure>
                </div>
            ),
        },
    ];

    return (
        <Card className={cn("min-w-0", className)}>
            <CardHeader title="Performance metrics" description="Computed from the detections above. Estimates to track progress, not lab measurements." action={<AIGeneratedBadge size="sm" label="AI-derived" />} />
            <div className="px-5 pb-5">
                <Tabs items={items} label="Metric groups" />
            </div>
        </Card>
    );
}
