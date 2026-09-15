import { clamp, cn } from "@/lib/utils";

export interface ThresholdBandsProps {
    /** Detection (discard) threshold, 0–100. */
    confidencePct: number;
    /** Low-confidence review threshold, 0–100. */
    lowConfidencePct: number;
    className?: string;
}

/**
 * Explains what two confidence thresholds do to model output: discarded, kept but flagged
 * "Needs review", and kept. Every band is labelled in text, not only by colour.
 */
export function ThresholdBands({ confidencePct, lowConfidencePct, className }: ThresholdBandsProps) {
    const low = clamp(Math.min(confidencePct, lowConfidencePct), 0, 100);
    const high = clamp(Math.max(confidencePct, lowConfidencePct), 0, 100);
    const bands = [
        { key: "discarded", label: "Discarded", range: `0–${low}%`, width: low, fill: "bg-neutral-solid/40", text: "text-neutral-fg" },
        { key: "review", label: "Needs review", range: `${low}–${high}%`, width: high - low, fill: "bg-warning-solid", text: "text-warning-fg" },
        { key: "kept", label: "Shown", range: `${high}–100%`, width: 100 - high, fill: "bg-success-solid", text: "text-success-fg" },
    ];

    return (
        <div className={cn("flex flex-col gap-2", className)}>
            <div aria-hidden className="flex h-3 gap-0.5 overflow-hidden rounded-full">
                {bands.map((band) =>
                    band.width > 0 ? <span key={band.key} className={cn("h-full", band.fill)} style={{ width: `${band.width}%` }} /> : null,
                )}
            </div>
            <ul className="grid grid-cols-1 gap-2 text-[13px] sm:grid-cols-3">
                {bands.map((band) => (
                    <li key={band.key} className="flex min-w-0 items-center gap-2">
                        <span aria-hidden className={cn("size-2.5 shrink-0 rounded-sm ring-1 ring-border ring-inset", band.fill)} />
                        <span className={cn("font-medium", band.text)}>{band.label}</span>
                        <span className="text-fg-muted tabular-nums">{band.range}</span>
                    </li>
                ))}
            </ul>
        </div>
    );
}
