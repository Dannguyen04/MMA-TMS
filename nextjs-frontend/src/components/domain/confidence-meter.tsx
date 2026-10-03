import { TriangleAlert } from "lucide-react";

import { confidenceBand, LOW_CONFIDENCE_THRESHOLD, type ConfidenceBand } from "@/lib/domain/rules";
import { formatConfidence } from "@/lib/format";
import { clamp, cn } from "@/lib/utils";

const BAND_LABELS: Record<ConfidenceBand, string> = {
    high: "High",
    medium: "Medium",
    low: "Low – needs review",
};

export interface ConfidenceMeterProps {
    /** Model confidence, 0–1; null when the model gave none. */
    confidence: number | null;
    /** Accessible name. */
    label?: string;
    /** Review threshold, 0–1. Defaults to the platform low-confidence threshold. */
    lowThreshold?: number;
    className?: string;
}

/** Horizontal 0–100% meter with the band label and a tick at the review threshold. */
export function ConfidenceMeter({ confidence, label = "AI confidence", lowThreshold = LOW_CONFIDENCE_THRESHOLD, className }: ConfidenceMeterProps) {
    // A model that gave no confidence gets no meter: a number is never shown in its place.
    if (confidence === null) return <p className={cn("text-[13px] text-fg-muted", className)}>Not reported by the model</p>;
    const value = clamp(confidence, 0, 1);
    const band = confidenceBand(value, lowThreshold);
    const isLow = band === "low";
    const pct = Math.round(value * 100);
    const thresholdPct = Math.round(clamp(lowThreshold, 0, 1) * 100);

    return (
        <div className={cn("flex items-center gap-3", className)}>
            <div
                role="progressbar"
                aria-label={label}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={pct}
                aria-valuetext={`${formatConfidence(value)}, ${BAND_LABELS[band].toLowerCase()} (review threshold ${thresholdPct}%)`}
                className="relative h-2 min-w-16 flex-1 rounded-full bg-surface-hover"
            >
                <div
                    className={cn("h-full rounded-full transition-[width] duration-500", isLow ? "bg-warning-solid" : "bg-ai-solid")}
                    style={{ width: `${pct}%` }}
                />
                <span
                    aria-hidden
                    className="absolute -top-1 h-4 w-0.5 -translate-x-1/2 rounded-full bg-fg-muted ring-1 ring-surface"
                    style={{ left: `${thresholdPct}%` }}
                />
            </div>
            <p aria-hidden className="flex shrink-0 items-center gap-1.5 text-[13px] whitespace-nowrap">
                <span className="font-semibold text-fg">{formatConfidence(value)}</span>
                <span className={cn("inline-flex items-center gap-1", isLow ? "font-medium text-warning-fg" : "text-fg-muted")}>
                    {isLow && <TriangleAlert className="size-3.5" />}
                    {BAND_LABELS[band]}
                </span>
            </p>
        </div>
    );
}
