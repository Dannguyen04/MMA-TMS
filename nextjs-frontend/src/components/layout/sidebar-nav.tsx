"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import type { Role } from "@/lib/domain/types";
import { cn } from "@/lib/utils";
import { ACCOUNT_NAVIGATION, BADGE_LABELS, NAVIGATION, isNavItemActive, type NavBadgeKey, type NavItem, type NavSection } from "./navigation";

export type NavCounts = Partial<Record<NavBadgeKey, number>>;

function NavLink({ item, counts, onNavigate }: { item: NavItem; counts: NavCounts; onNavigate?: () => void }) {
    const pathname = usePathname();
    const active = isNavItemActive(item, pathname);
    const count = item.badge ? (counts[item.badge] ?? 0) : 0;
    const Icon = item.icon;

    return (
        <Link
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
                "group relative flex min-h-9 items-center gap-3 rounded-lg px-3 py-2 text-sm leading-5 font-medium transition-colors",
                "focus-visible:outline-nav-accent",
                active ? "bg-nav-surface text-nav-fg-active" : "text-nav-fg hover:bg-nav-surface/60 hover:text-nav-fg-active",
            )}
        >
            {active && <span aria-hidden className="absolute top-2 bottom-2 -left-3 w-[3px] rounded-r-full bg-nav-accent" />}
            <Icon aria-hidden className={cn("size-[18px] shrink-0", active ? "text-nav-accent" : "text-nav-fg/80 group-hover:text-nav-fg-active")} />
            <span className="min-w-0 text-pretty">{item.label}</span>
            {count > 0 && (
                <span
                    className={cn(
                        "ml-auto min-w-5 rounded-full px-1.5 text-center text-[11px] leading-5 font-semibold tabular-nums",
                        item.badge === "failedJobs" ? "bg-danger-solid text-white" : "bg-nav-accent/20 text-nav-fg-active",
                    )}
                >
                    {count}
                    {item.badge && <span className="sr-only"> {BADGE_LABELS[item.badge]}</span>}
                </span>
            )}
        </Link>
    );
}

/** Icons are components and can't cross the server boundary, so the nav config is read here by role. */
export function SidebarNav({ role, counts, onNavigate }: { role: Role; counts: NavCounts; onNavigate?: () => void }) {
    const sections: NavSection[] = NAVIGATION[role];
    const accountItems: NavItem[] = ACCOUNT_NAVIGATION;
    return (
        <nav aria-label="Main" className="flex flex-1 flex-col gap-5">
            {sections.map((section, index) => (
                <div key={section.label ?? index}>
                    {section.label && (
                        <p className="mb-1.5 px-3 text-[11px] font-semibold tracking-[0.08em] text-nav-fg/75 uppercase">{section.label}</p>
                    )}
                    <ul className="flex flex-col gap-0.5">
                        {section.items.map((item) => (
                            <li key={item.href}>
                                <NavLink item={item} counts={counts} onNavigate={onNavigate} />
                            </li>
                        ))}
                    </ul>
                </div>
            ))}
            <div className="mt-auto border-t border-nav-border pt-4">
                <p className="mb-1.5 px-3 text-[11px] font-semibold tracking-[0.08em] text-nav-fg/75 uppercase">Account</p>
                <ul className="flex flex-col gap-0.5">
                    {accountItems.map((item) => (
                        <li key={item.href}>
                            <NavLink item={item} counts={counts} onNavigate={onNavigate} />
                        </li>
                    ))}
                </ul>
            </div>
        </nav>
    );
}
