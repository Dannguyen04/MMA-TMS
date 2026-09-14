import Link from "next/link";
import type { ReactNode } from "react";

import { LogoMark, Logo } from "@/components/brand/logo";
import type { ThemePreference } from "@/lib/auth/constants";
import { ROLE_LABELS } from "@/lib/domain/labels";
import type { Notification, User } from "@/lib/domain/types";
import { dashboardPath } from "@/lib/routes";
import { MobileBottomBar, MobileNavDrawer } from "./mobile-nav";
import { NotificationBell } from "./notification-bell";
import { SidebarNav, type NavCounts } from "./sidebar-nav";
import { UserMenu } from "./user-menu";

export interface AppShellProps {
    user: User;
    theme: ThemePreference;
    counts: NavCounts;
    notifications: { unread: number; latest: Notification[] };
    now: string;
    children: ReactNode;
}

export function AppShell({ user, theme, counts, notifications, now, children }: AppShellProps) {
    const shellUser = { name: user.name, email: user.email, title: user.title, role: user.role };

    return (
        <div className="min-h-dvh">
            <a
                href="#main"
                className="fixed top-2 left-2 z-[70] -translate-y-20 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-fg focus:translate-y-0"
            >
                Skip to content
            </a>

            {/* Desktop sidebar */}
            <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-nav-border bg-nav-bg px-3 py-4 lg:flex">
                <Link href={dashboardPath(user.role)} className="mb-2 rounded-lg px-2 py-1 focus-visible:outline-nav-accent">
                    <Logo />
                </Link>
                <p className="mb-5 px-2 text-xs font-medium text-nav-fg/70">{ROLE_LABELS[user.role]} workspace</p>
                <div className="scrollbar-thin flex min-h-0 flex-1 flex-col overflow-y-auto py-1 pr-1 pl-3">
                    <SidebarNav role={user.role} counts={counts} />
                </div>
            </aside>

            <div className="lg:pl-64">
                <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-border bg-surface/90 px-3 backdrop-blur sm:px-5">
                    <MobileNavDrawer role={user.role} counts={counts} />
                    <Link href={dashboardPath(user.role)} className="flex items-center gap-2 lg:hidden" aria-label="Dashboard">
                        <LogoMark className="size-7" />
                        <span className="text-sm font-semibold tracking-tight max-sm:hidden">MMA-TMS</span>
                    </Link>
                    <div className="ml-auto flex items-center gap-1">
                        <NotificationBell unread={notifications.unread} latest={notifications.latest} now={now} />
                        <span aria-hidden className="mx-1 h-6 w-px bg-border" />
                        <UserMenu user={shellUser} theme={theme} />
                    </div>
                </header>

                <main id="main" tabIndex={-1} className="mx-auto w-full max-w-[1440px] px-4 pt-6 pb-24 focus:outline-none sm:px-6 md:pb-12 lg:px-8 lg:pt-8">
                    {children}
                </main>
            </div>

            <MobileBottomBar role={user.role} counts={counts} />
        </div>
    );
}
