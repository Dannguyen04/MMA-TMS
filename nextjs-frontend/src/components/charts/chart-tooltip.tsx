import { cn } from "@/lib/utils";

export interface TooltipRow {
    id: string;
    label: string;
    /** Pre-formatted value. */
    value: string;
    /** Series colour for the key; omit for summary rows such as a total. */
    color?: string;
}

export interface TooltipPlacement {
    top: number;
    left?: number;
    right?: number;
    maxWidth: number;
}

/**
 * Places a tooltip beside an x position: to the right in the left half of the chart and to
 * the left in the right half, so it never covers the hovered position or leaves the container.
 */
export function besidePlacement(anchorX: number, containerWidth: number, top: number, offset = 12): TooltipPlacement {
    if (anchorX > containerWidth / 2) {
        return { top, right: Math.round(containerWidth - anchorX + offset), maxWidth: Math.max(96, Math.floor(anchorX - offset)) };
    }
    return { top, left: Math.round(anchorX + offset), maxWidth: Math.max(96, Math.floor(containerWidth - anchorX - offset)) };
}

/**
 * Hover/focus readout. Values lead (strong) and series names follow (muted); rows are keyed
 * with a short stroke of the series colour. Hidden from assistive tech — charts announce the
 * same content through their live region and table view.
 */
export function ChartTooltip({ title, rows, placement }: { title: string; rows: TooltipRow[]; placement: TooltipPlacement }) {
    return (
        <div
            aria-hidden
            className="pointer-events-none absolute z-10 w-max rounded-lg border border-border bg-surface px-3 py-2 text-xs shadow-popover"
            style={{ top: placement.top, left: placement.left, right: placement.right, maxWidth: placement.maxWidth }}
        >
            <p className="mb-1.5 font-medium text-fg-muted">{title}</p>
            <div className="grid grid-cols-[0.75rem_auto_minmax(0,1fr)] items-center gap-x-2 gap-y-1">
                {rows.map((row) => (
                    <div key={row.id} className="contents">
                        <span
                            className={cn("h-0.5 w-3 rounded-full", !row.color && "invisible")}
                            style={row.color ? { backgroundColor: row.color } : undefined}
                        />
                        <span className="text-right font-semibold text-fg tabular-nums">{row.value}</span>
                        <span className="break-words text-fg-muted">{row.label}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
