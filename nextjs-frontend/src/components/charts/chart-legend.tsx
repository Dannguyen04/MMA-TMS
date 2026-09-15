import { cn } from "@/lib/utils";

interface LegendItem {
    id: string;
    label: string;
    color: string;
}

/**
 * Series legend. The swatch mirrors the mark (a line key for lines, a square for bars and
 * fills); the label always uses text tokens, never the series colour.
 */
export function ChartLegend({ items, marker, className }: { items: LegendItem[]; marker: "line" | "square"; className?: string }) {
    return (
        <ul className={cn("flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-fg-muted", className)}>
            {items.map((item) => (
                <li key={item.id} className="inline-flex items-center gap-1.5">
                    <span
                        aria-hidden
                        className={cn("shrink-0", marker === "line" ? "h-0.5 w-3 rounded-full" : "size-2.5 rounded-[3px]")}
                        style={{ backgroundColor: item.color }}
                    />
                    {item.label}
                </li>
            ))}
        </ul>
    );
}
