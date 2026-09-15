"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Logo } from "@/components/brand/logo";
import { ROLE_LABELS } from "@/lib/domain/labels";
import type { Role } from "@/lib/domain/types";
import { cn } from "@/lib/utils";
import { BADGE_LABELS, MOBILE_PRIMARY, NAVIGATION, isNavItemActive, type NavItem } from "./navigation";
import { SidebarNav, type NavCounts } from "./sidebar-nav";

/** Hamburger + slide-in navigation drawer for small and medium screens. */
export function MobileNavDrawer({ role, counts }: { role: Role; counts: NavCounts }) {
    const [open, setOpen] = useState(false);
    const dialogRef = useRef<HTMLDialogElement>(null);
    const pathname = usePathname();
    const [lastPath, setLastPath] = useState(pathname);

    if (pathname !== lastPath) {
        setLastPath(pathname);
        setOpen(false);
    }

    useEffect(() => {
        const dialog = dialogRef.current;
        if (!dialog) return;
        if (open && !dialog.open) dialog.showModal();
        if (!open && dialog.open) dialog.close();
    }, [open]);

    return (
        <>
            <button
                type="button"
                onClick={() => setOpen(true)}
                className="inline-flex size-9 items-center justify-center rounded-lg text-fg-muted hover:bg-surface-hover hover:text-fg lg:hidden"
                aria-label="Open navigation"
                aria-expanded={open}
            >
                <Menu aria-hidden className="size-5" />
            </button>
            <dialog
                ref={dialogRef}
                aria-label="Navigation"
                onCancel={(event) => {
                    event.preventDefault();
                    setOpen(false);
                }}
                onClick={(event) => {
                    if (event.target === event.currentTarget) setOpen(false);
                }}
                className="m-0 h-dvh max-h-dvh w-[min(20rem,86vw)] max-w-none border-0 bg-nav-bg p-0 text-nav-fg shadow-dialog lg:hidden"
            >
                {open && (
                    <div className="flex h-full flex-col px-3 py-4">
                        <div className="mb-5 flex items-center justify-between px-2">
                            <Logo />
                            <button
                                type="button"
                                onClick={() => setOpen(false)}
                                className="inline-flex size-9 items-center justify-center rounded-lg text-nav-fg hover:bg-nav-surface hover:text-white"
                                aria-label="Close navigation"
                            >
                                <X aria-hidden className="size-5" />
                            </button>
                        </div>
                        <p className="mb-4 px-3 text-xs font-medium text-nav-fg/70">{ROLE_LABELS[role]} workspace</p>
                        <div className="scrollbar-thin flex min-h-0 flex-1 flex-col overflow-y-auto py-1 pr-1 pl-3">
                            <SidebarNav role={role} counts={counts} onNavigate={() => setOpen(false)} />
                        </div>
                    </div>
                )}
            </dialog>
        </>
    );
}

/** Thumb-reachable bar with the role's four primary destinations. */
export function MobileBottomBar({ role, counts }: { role: Role; counts: NavCounts }) {
    const pathname = usePathname();
    const items = MOBILE_PRIMARY[role]
        .map((href) => NAVIGATION[role].flatMap((s) => s.items).find((i) => i.href === href))
        .filter((item): item is NavItem => Boolean(item));

    return (
        <nav
            aria-label="Primary"
            className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
        >
            <ul className="grid grid-cols-4">
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
                                    "relative flex h-14 flex-col items-center justify-center gap-1 text-[11px] font-medium",
                                    active ? "text-primary-soft-fg" : "text-fg-muted",
                                )}
                            >
                                {active && <span aria-hidden className="absolute top-0 h-0.5 w-8 rounded-b-full bg-primary" />}
                                <span className="relative">
                                    <Icon aria-hidden className="size-5" />
                                </span>
                                <span className="max-w-full truncate px-1">{item.shortLabel ?? item.label}</span>
                                {count > 0 && item.badge && (
                                    <span className="absolute top-1.5 left-1/2 ml-1.5 min-w-4 rounded-full bg-danger-solid px-1 text-center text-[10px] leading-4 text-white">
                                        <span className="sr-only"> </span>
                                        {count}
                                        <span className="sr-only"> {BADGE_LABELS[item.badge]}</span>
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
