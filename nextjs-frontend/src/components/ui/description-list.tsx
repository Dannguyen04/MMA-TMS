import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export interface DescriptionItem {
    label: string;
    value: ReactNode;
    /** Spans the full row (long text). */
    wide?: boolean;
}

/** Key facts in a label/value grid. */
export function DescriptionList({ items, columns = 2, className }: { items: DescriptionItem[]; columns?: 1 | 2 | 3; className?: string }) {
    return (
        <dl
            className={cn(
                "grid gap-x-6 gap-y-4",
                columns === 2 && "sm:grid-cols-2",
                columns === 3 && "sm:grid-cols-2 lg:grid-cols-3",
                className,
            )}
        >
            {items.map((item) => (
                <div key={item.label} className={cn("min-w-0", item.wide && "sm:col-span-full")}>
                    <dt className="text-[13px] text-fg-muted">{item.label}</dt>
                    <dd className="mt-0.5 text-sm font-medium break-words text-fg">{item.value}</dd>
                </div>
            ))}
        </dl>
    );
}
