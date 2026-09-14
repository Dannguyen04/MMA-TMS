import { cn } from "@/lib/utils";
import { CHART_SERIES } from "./colors";
import { formatChartValue } from "./ticks";

export interface HorizontalBarItem {
    label: string;
    value: number;
    /** Bar colour; defaults to the first series colour. */
    color?: string;
    /** Secondary context shown beside the label, e.g. "14 detections". */
    hint?: string;
}

export interface HorizontalBarsProps {
    /** Items in display order — pass them ranked. */
    items: HorizontalBarItem[];
    ariaLabel: string;
    valueSuffix?: string;
    decimals?: number;
    /** Value that fills the full track. Defaults to the largest item. */
    max?: number;
    className?: string;
}

/**
 * Ranked horizontal bars in plain HTML: label above, a thin bar with a rounded data end and
 * the value at the bar's tip. Server-compatible; every value is visible text in a list.
 */
export function HorizontalBars({ items, ariaLabel, valueSuffix = "", decimals = 0, max, className }: HorizontalBarsProps) {
    const scaleMax = max ?? Math.max(0, ...items.map((item) => item.value));

    return (
        <ul aria-label={ariaLabel} className={cn("flex flex-col gap-3", className)}>
            {items.map((item, index) => {
                const ratio = scaleMax > 0 ? Number(Math.min(1, Math.max(0, item.value / scaleMax)).toFixed(4)) : 0;
                return (
                    <li key={`${item.label}-${index}`} className="flex flex-col gap-1.5">
                        <div className="flex items-baseline justify-between gap-3">
                            <span className="min-w-0 text-[13px] text-fg">{item.label}</span>
                            {item.hint && <span className="shrink-0 text-xs text-fg-subtle">{item.hint}</span>}
                        </div>
                        <div className="flex items-center gap-2">
                            <span
                                aria-hidden
                                className="block h-2.5 shrink-0 rounded-r-[4px]"
                                style={{ width: `calc((100% - 5rem) * ${ratio})`, backgroundColor: item.color ?? CHART_SERIES[0] }}
                            />
                            <span className="text-[13px] font-medium whitespace-nowrap text-fg">
                                {formatChartValue(item.value, { decimals, suffix: valueSuffix })}
                            </span>
                        </div>
                    </li>
                );
            })}
        </ul>
    );
}
