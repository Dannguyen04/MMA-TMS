import type { LucideIcon } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";

export interface SegmentedLinkItem {
    href: string;
    label: string;
    /** Items in the segment, shown in a pill after the label. */
    count?: number;
    icon?: LucideIcon;
    active: boolean;
}

export interface SegmentedLinksProps {
    /** Accessible name of the navigation, e.g. "Filter jobs by status". */
    label: string;
    items: SegmentedLinkItem[];
    className?: string;
}

/**
 * URL-driven segmented filter. Each segment is a link (the filter lives in the URL); the active one
 * carries aria-current. Scrolls sideways instead of wrapping on narrow screens.
 */
export function SegmentedLinks({ label, items, className }: SegmentedLinksProps) {
    return (
        <nav aria-label={label} className={cn("scrollbar-thin -mx-1 max-w-full overflow-x-auto px-1 pb-1", className)}>
            <ul className="inline-flex min-w-max gap-1 rounded-xl border border-border bg-surface p-1 shadow-card">
                {items.map((item) => {
                    const Icon = item.icon;
                    return (
                        <li key={item.href}>
                            <Link
                                href={item.href}
                                scroll={false}
                                aria-current={item.active ? "page" : undefined}
                                className={cn(
                                    "inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium whitespace-nowrap transition-colors",
                                    item.active ? "bg-fg text-fg-inverse" : "text-fg-muted hover:bg-surface-hover hover:text-fg",
                                )}
                            >
                                {Icon && <Icon aria-hidden className="size-3.5" />}
                                {item.label}
                                {item.count !== undefined && (
                                    <span
                                        className={cn(
                                            "rounded-full px-1.5 text-[11px] leading-5 tabular-nums",
                                            item.active ? "bg-fg-inverse/20 text-fg-inverse" : "bg-surface-hover text-fg-muted",
                                        )}
                                    >
                                        {item.count}
                                    </span>
                                )}
                            </Link>
                        </li>
                    );
                })}
            </ul>
        </nav>
    );
}
