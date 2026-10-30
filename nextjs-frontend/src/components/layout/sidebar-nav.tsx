"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import type { Role } from "@/lib/domain/types";
import { useT } from "@/components/i18n/locale-provider";
import { navLabel } from "@/lib/i18n/translate";
import { cn } from "@/lib/utils";
import { BADGE_LABELS, NAVIGATION, isNavItemActive, type NavBadgeKey, type NavItem, type NavSection } from "./navigation";

export type NavCounts = Partial<Record<NavBadgeKey, number>>;

function NavLink({ item, counts, onNavigate }: { item: NavItem; counts: NavCounts; onNavigate?: () => void }) {
    const pathname = usePathname();
    const active = isNavItemActive(item, pathname);
    const count = item.badge ? (counts[item.badge] ?? 0) : 0;
    const Icon = item.icon;
    const t = useT();

    return (
        <Link
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
                "group relative flex min-h-10 items-center gap-3 rounded-lg px-3 py-2 font-display text-[16px] leading-5 font-semibold tracking-[0.01em] transition-colors",
                active ? "bg-rail-active-bg text-rail-fg-strong" : "text-rail-fg hover:bg-rail-active-bg/70 hover:text-rail-fg-strong",
            )}
        >
            {active && <span aria-hidden className="absolute top-2.5 bottom-2.5 left-1 w-1 -skew-x-[14deg] bg-rail-accent" />}
            <Icon aria-hidden className={cn("size-[18px] shrink-0", active ? "text-rail-fg-strong" : "text-rail-muted group-hover:text-rail-fg-strong")} />
            <span className="min-w-0 text-pretty">{navLabel(t, item.label)}</span>
            {count > 0 && (
                <span
                    className={cn(
                        "ml-auto min-w-5 rounded-full px-1.5 text-center font-sans text-[11px] leading-5 font-semibold tabular-nums",
                        item.badge === "failedJobs" ? "bg-danger-solid text-white" : "bg-primary-soft text-primary-soft-fg",
                    )}
                >
                    {count}
                    {item.badge && <span className="sr-only"> {t(BADGE_LABELS[item.badge])}</span>}
                </span>
            )}
        </Link>
    );
}

/**
 * Icons are components and can't cross the server boundary, so the nav config is read here by role.
 * Notifications, profile and preferences live in the header (bell and account menu), not here.
 */
export function SidebarNav({ role, counts, onNavigate }: { role: Role; counts: NavCounts; onNavigate?: () => void }) {
    const sections: NavSection[] = NAVIGATION[role];
    const t = useT();
    return (
        <nav aria-label={t("shell.mainNav")} className="flex flex-1 flex-col gap-5">
            {sections.map((section, index) => (
                <div key={section.label ?? index}>
                    {section.label && (
                        <p className="mb-1.5 px-3 font-display text-[12px] font-bold tracking-[0.12em] text-rail-muted uppercase">{navLabel(t, section.label)}</p>
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
        </nav>
    );
}
