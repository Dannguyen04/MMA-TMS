import Link from "next/link";
import type { ReactNode } from "react";

import { LogoMark } from "@/components/brand/logo";
import type { ThemePreference } from "@/lib/auth/constants";
import type { Locale } from "@/lib/i18n/config";
import { createTranslator } from "@/lib/i18n/translate";
import type { User } from "@/lib/domain/types";
import { dashboardPath } from "@/lib/routes";
import type { NotificationBellData } from "@/lib/services/notifications";
import { MobileBottomBar } from "./mobile-nav";
import { HubTabs } from "./hub-tabs";
import { NotificationBell } from "./notification-bell";
import { WorkspaceSidebar, type NavCounts } from "./sidebar-nav";
import { UserMenu } from "./user-menu";

export interface AppShellProps {
    user: User;
    theme: ThemePreference;
    locale: Locale;
    counts: NavCounts;
    /** Null when the notification service doesn't answer, which leaves the bell out. */
    notifications: NotificationBellData | null;
    now: string;
    children: ReactNode;
}

export function AppShell({ user, theme, locale, counts, notifications, now, children }: AppShellProps) {
    const t = createTranslator(locale);
    const shellUser = { name: user.name, email: user.email, title: user.title, role: user.role };

    return (
        <div className="workspace-frame">
            <a
                href="#main"
                className="fixed top-2 left-2 z-[70] -translate-y-20 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-fg focus:translate-y-0"
            >
                {t("shell.skipToContent")}
            </a>

            <WorkspaceSidebar role={user.role} counts={counts} />

            <div className="min-w-0">
                <header className="workspace-topbar sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-border bg-surface pr-3 sm:pr-5 lg:px-8">
                    <Link href={dashboardPath(user.role)} className="flex items-center gap-2 lg:hidden" aria-label={t("shell.home")}>
                        <LogoMark className="size-7" />
                        <span className="font-display text-[17px] font-extrabold tracking-[0.01em] italic max-sm:hidden">MMA-TMS</span>
                    </Link>
                    <div className="ml-auto flex items-center gap-1">
                        {notifications && (
                            <>
                                <NotificationBell bell={notifications} now={now} />
                                <span aria-hidden className="mx-1 h-6 w-px bg-border" />
                            </>
                        )}
                        <UserMenu user={shellUser} theme={theme} />
                    </div>
                </header>

                <main id="main" tabIndex={-1} className="mx-auto w-full min-w-0 max-w-[1440px] px-4 pt-6 pb-24 focus:outline-none sm:px-6 md:pb-12 lg:px-8 lg:pt-8">
                    <HubTabs role={user.role} />
                    {children}
                </main>
            </div>

            <MobileBottomBar role={user.role} counts={counts} />
        </div>
    );
}
