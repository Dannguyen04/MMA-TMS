import type { LucideIcon } from "lucide-react";
import Link from "next/link";

import { hrefWith, type SearchParams } from "@/lib/query";
import { cn } from "@/lib/utils";

export interface ViewOption {
    value: string;
    label: string;
    icon: LucideIcon;
}

export interface ViewToggleProps {
    label: string;
    options: ViewOption[];
    active: string;
    /** The option that is used when ?view= is absent (its link drops the param). */
    defaultValue: string;
    pathname: string;
    searchParams: SearchParams;
    /** Params to drop when switching, e.g. pagination or sorting that only applies to one view. */
    reset?: string[];
}

/** Segmented link control for ?view=. Uses aria-current so it reads as navigation, not a form control. */
export function ViewToggle({ label, options, active, defaultValue, pathname, searchParams, reset = [] }: ViewToggleProps) {
    return (
        <nav aria-label={label}>
            <ul className="inline-flex rounded-lg border border-border bg-surface-muted p-0.5">
                {options.map((option) => {
                    const selected = option.value === active;
                    const Icon = option.icon;
                    const updates: Record<string, string | null> = { view: option.value === defaultValue ? null : option.value };
                    reset.forEach((key) => (updates[key] = null));
                    return (
                        <li key={option.value}>
                            <Link
                                href={hrefWith(pathname, searchParams, updates)}
                                scroll={false}
                                aria-current={selected ? "page" : undefined}
                                className={cn(
                                    "inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-[13px] font-medium transition-colors [&_svg]:size-4",
                                    selected ? "bg-surface text-fg shadow-card ring-1 ring-border" : "text-fg-muted hover:text-fg",
                                )}
                            >
                                <Icon aria-hidden />
                                {option.label}
                            </Link>
                        </li>
                    );
                })}
            </ul>
        </nav>
    );
}
