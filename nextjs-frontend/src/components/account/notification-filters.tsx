import type { LucideIcon } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";

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
        <nav aria-label={label} className={cn("scrollbar-thin -mx-1 min-w-0 overflow-x-auto px-1 py-0.5", className)}>
            <ul className="flex w-max gap-2 sm:w-auto sm:flex-wrap">
                {items.map((item) => {
                    const Icon = item.icon;
                    return (
                        <li key={item.href}>
                            <Link
                                href={item.href}
                                scroll={false}
                                aria-current={item.active ? "page" : undefined}
                                className={cn(
                                    "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium whitespace-nowrap transition-colors",
                                    item.active
                                        ? "border-primary bg-primary-soft text-primary-soft-fg"
                                        : "border-border bg-surface text-fg-muted hover:border-border-strong hover:text-fg",
                                    !item.active && item.count === 0 && "text-fg-subtle",
                                )}
                            >
                                {Icon && <Icon aria-hidden className="size-3.5" />}
                                {item.label}
                                <span className="text-[11px] tabular-nums">{item.count}</span>
                            </Link>
                        </li>
                    );
                })}
            </ul>
        </nav>
    );
}
