import type { LucideIcon } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";
import { SegmentMotion } from "./segment-motion";

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
        <SegmentMotion aria-label={label} className={cn("scrollbar-thin w-fit overflow-x-auto", className)}>
            <ul className="flex min-w-max gap-1">
                {items.map((item) => {
                    const Icon = item.icon;
                    return (
                        <li key={item.href}>
                            <Link
                                href={item.href}
                                scroll={false}
                                aria-current={item.active ? "page" : undefined}
                                data-selected={item.active ? "true" : "false"}
                                className="segmented-link inline-flex items-center gap-1.5"
                            >
                                {Icon && <Icon aria-hidden className="size-3.5" style={{ color: "currentColor" }} />}
                                {item.label}
                                {item.count !== undefined && (
                                    <span
                                        className="segmented-count px-1.5 text-[11px] leading-5 tabular-nums"
                                    >
                                        {item.count}
                                    </span>
                                )}
                            </Link>
                        </li>
                    );
                })}
            </ul>
        </SegmentMotion>
    );
}
