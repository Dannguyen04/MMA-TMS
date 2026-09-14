"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

import { cn } from "@/lib/utils";

export interface TabNavItem {
    href: string;
    label: string;
    count?: number;
    /** Match the full path only (use for the index tab). */
    exact?: boolean;
}

/** Route-based tabs for sub-pages (e.g. a fighter profile). Uses aria-current, not the tab role. */
export function TabNav({ items, label, className }: { items: TabNavItem[]; label: string; className?: string }) {
    const pathname = usePathname();
    return (
        <nav aria-label={label} className={cn("scrollbar-thin -mx-1 overflow-x-auto border-b border-border", className)}>
            <ul className="flex min-w-max gap-1 px-1">
                {items.map((item) => {
                    const active = item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
                    return (
                        <li key={item.href}>
                            <Link
                                href={item.href}
                                aria-current={active ? "page" : undefined}
                                className={cn(
                                    "relative inline-flex h-10 items-center gap-2 px-3 text-sm font-medium transition-colors",
                                    "after:absolute after:inset-x-2 after:-bottom-px after:h-0.5 after:rounded-full",
                                    active ? "text-fg after:bg-primary" : "text-fg-muted hover:text-fg",
                                )}
                            >
                                {item.label}
                                {item.count !== undefined && (
                                    <span className="rounded-full bg-surface-hover px-1.5 text-[11px] leading-5 text-fg-muted tabular-nums">
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

export interface TabItem {
    id: string;
    label: ReactNode;
    content: ReactNode;
}

/** In-page tabs with the WAI-ARIA tabs pattern (arrow keys move between tabs). */
export function Tabs({
    items,
    defaultTab,
    label,
    className,
    listClassName,
    onChange,
}: {
    items: TabItem[];
    defaultTab?: string;
    label: string;
    className?: string;
    listClassName?: string;
    onChange?: (id: string) => void;
}) {
    const [active, setActive] = useState(defaultTab ?? items[0]?.id);
    const baseId = useId();
    const refs = useRef<(HTMLButtonElement | null)[]>([]);

    const select = (index: number) => {
        const item = items[index];
        if (!item) return;
        setActive(item.id);
        onChange?.(item.id);
        refs.current[index]?.focus();
    };

    const onKeyDown = (event: KeyboardEvent, index: number) => {
        const last = items.length - 1;
        if (event.key === "ArrowRight") select(index === last ? 0 : index + 1);
        else if (event.key === "ArrowLeft") select(index === 0 ? last : index - 1);
        else if (event.key === "Home") select(0);
        else if (event.key === "End") select(last);
        else return;
        event.preventDefault();
    };

    return (
        <div className={className}>
            <div role="tablist" aria-label={label} className={cn("scrollbar-thin flex gap-1 overflow-x-auto border-b border-border", listClassName)}>
                {items.map((item, index) => {
                    const selected = item.id === active;
                    return (
                        <button
                            key={item.id}
                            ref={(el) => {
                                refs.current[index] = el;
                            }}
                            type="button"
                            role="tab"
                            id={`${baseId}-tab-${item.id}`}
                            aria-selected={selected}
                            aria-controls={`${baseId}-panel-${item.id}`}
                            tabIndex={selected ? 0 : -1}
                            onClick={() => select(index)}
                            onKeyDown={(event) => onKeyDown(event, index)}
                            className={cn(
                                "relative inline-flex h-10 shrink-0 items-center gap-2 px-3 text-sm font-medium whitespace-nowrap transition-colors",
                                "after:absolute after:inset-x-2 after:-bottom-px after:h-0.5 after:rounded-full",
                                selected ? "text-fg after:bg-primary" : "text-fg-muted hover:text-fg",
                            )}
                        >
                            {item.label}
                        </button>
                    );
                })}
            </div>
            {items.map((item) => (
                <div
                    key={item.id}
                    role="tabpanel"
                    id={`${baseId}-panel-${item.id}`}
                    aria-labelledby={`${baseId}-tab-${item.id}`}
                    hidden={item.id !== active}
                    tabIndex={0}
                    className="focus-visible:outline-offset-4"
                >
                    {item.id === active && item.content}
                </div>
            ))}
        </div>
    );
}
