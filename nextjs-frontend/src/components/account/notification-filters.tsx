import type { LucideIcon } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";
import { SegmentMotion } from "@/components/ui/segment-motion";

export interface FilterLink {
    href: string;
    label: string;
    count: number;
    active: boolean;
    icon?: LucideIcon;
}

/** Category chips. Wrap on wide screens, scroll sideways on phones. */
export function CategoryChips({ items, label, className }: { items: FilterLink[]; label: string; className?: string }) {
    return (
        <SegmentMotion aria-label={label} className={cn("scrollbar-thin min-w-0 overflow-x-auto", className)}>
            <ul className="flex w-max gap-1 sm:w-auto sm:flex-wrap">
                {items.map((item) => {
                    const Icon = item.icon;
                    return (
                        <li key={item.href}>
                            <Link
                                href={item.href}
                                scroll={false}
                                aria-current={item.active ? "page" : undefined}
                                className="inline-flex items-center gap-1.5"
                            >
                                {Icon && <Icon aria-hidden className="size-3.5" />}
                                {item.label}
                                <span className="segmented-count px-1.5 text-[11px] tabular-nums">{item.count}</span>
                            </Link>
                        </li>
                    );
                })}
            </ul>
        </SegmentMotion>
    );
}
