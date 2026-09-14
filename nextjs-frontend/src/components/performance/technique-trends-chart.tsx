"use client";

import { useState } from "react";

import { ChartFigure } from "@/components/charts/chart-figure";
import { TECHNIQUE_COLOR } from "@/components/charts/colors";
import { LineChart } from "@/components/charts/line-chart";
import { TECHNIQUE_LABELS, TECHNIQUES } from "@/lib/domain/labels";
import type { Technique } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

const DEFAULT_SERIES: Technique[] = ["jab", "cross", "hook", "kick"];

export interface TechniqueTrendsChartProps {
    /** Week labels, oldest first. */
    labels: string[];
    /** Weekly scores per technique, aligned with `labels`. */
    scores: Record<Technique, number[]>;
    initial?: Technique[];
}

/** Weekly technique scores with toggles to choose which techniques are drawn (at least one stays on). */
export function TechniqueTrendsChart({ labels, scores, initial = DEFAULT_SERIES }: TechniqueTrendsChartProps) {
    const [selected, setSelected] = useState<Technique[]>(initial);

    const toggle = (technique: Technique) => {
        setSelected((current) => {
            if (!current.includes(technique)) return TECHNIQUES.filter((t) => t === technique || current.includes(t));
            return current.length === 1 ? current : current.filter((t) => t !== technique);
        });
    };

    const series = selected.map((technique) => ({
        id: technique,
        label: TECHNIQUE_LABELS[technique],
        color: TECHNIQUE_COLOR[technique],
        values: scores[technique],
    }));

    return (
        <div className="flex flex-col gap-4">
            <div role="group" aria-label="Techniques shown in the chart" className="flex flex-wrap gap-1.5">
                {TECHNIQUES.map((technique) => {
                    const on = selected.includes(technique);
                    return (
                        <button
                            key={technique}
                            type="button"
                            aria-pressed={on}
                            onClick={() => toggle(technique)}
                            className={cn(
                                "inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[13px] font-medium transition-colors",
                                on ? "border-border-strong bg-surface-hover text-fg" : "border-border bg-surface text-fg-muted hover:text-fg",
                            )}
                        >
                            <span
                                aria-hidden
                                className="size-2.5 shrink-0 rounded-[3px] border-2"
                                style={{ borderColor: TECHNIQUE_COLOR[technique], backgroundColor: on ? TECHNIQUE_COLOR[technique] : "transparent" }}
                            />
                            {TECHNIQUE_LABELS[technique]}
                        </button>
                    );
                })}
            </div>
            <ChartFigure
                tableCaption="Weekly technique scores"
                table={{
                    columns: ["Week", ...selected.map((technique) => TECHNIQUE_LABELS[technique])],
                    rows: labels.map((label, index) => [label, ...selected.map((technique) => scores[technique][index])]),
                }}
            >
                <LineChart
                    ariaLabel={`Weekly scores for ${series.map((s) => s.label).join(", ")}`}
                    labels={labels}
                    series={series}
                    height={260}
                    highlightLast
                />
            </ChartFigure>
        </div>
    );
}
