"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useT } from "@/components/i18n/locale-provider";
import { navLabel } from "@/lib/i18n/translate";
import type { Role } from "@/lib/domain/types";
import { cn } from "@/lib/utils";
import { BADGE_LABELS, isNavItemActive, mobilePrimaryItems } from "./navigation";
import type { NavCounts } from "./sidebar-nav";

const GRID_COLS: Record<number, string> = { 4: "grid-cols-4", 5: "grid-cols-5", 6: "grid-cols-6" };

/** Thumb-reachable bar with the role's hubs (admin: its four most-used pages). */
export function MobileBottomBar({ role, counts }: { role: Role; counts: NavCounts }) {
    const pathname = usePathname();
    const items = mobilePrimaryItems(role);
    const t = useT();

    return (
        <nav
            aria-label={t("shell.primaryNav")}
            className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
        >
            <ul className={cn("grid", GRID_COLS[items.length] ?? "grid-cols-4")}>
                {items.map((item) => {
                    const active = isNavItemActive(item, pathname);
                    const count = item.badge ? (counts[item.badge] ?? 0) : 0;
                    const Icon = item.icon;
                    return (
                        <li key={item.href}>
                            <Link
                                href={item.href}
                                aria-current={active ? "page" : undefined}
                                className={cn(
                                    "relative flex h-14 flex-col items-center justify-center gap-1 font-display text-[13px] font-semibold tracking-[0.01em]",
                                    active ? "text-fg" : "text-fg-muted",
                                )}
                            >
                                {active && <span aria-hidden className="absolute top-0 h-[3px] w-8 -skew-x-12 bg-corner-red" />}
                                <span className="relative">
                                    <Icon aria-hidden className="size-5" />
                                </span>
                                <span className="max-w-full truncate px-1">{navLabel(t, item.shortLabel ?? item.label)}</span>
                                {count > 0 && item.badge && (
                                    <span className="absolute top-1.5 left-1/2 ml-1.5 min-w-4 rounded-full bg-danger-solid px-1 text-center text-[10px] leading-4 text-white">
                                        <span className="sr-only"> </span>
                                        {count}
                                        <span className="sr-only"> {t(BADGE_LABELS[item.badge])}</span>
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
