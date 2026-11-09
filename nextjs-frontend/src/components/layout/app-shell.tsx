import Link from "next/link";
import type { ReactNode } from "react";

import { LogoMark, Logo } from "@/components/brand/logo";
import type { ThemePreference } from "@/lib/auth/constants";
import type { Locale } from "@/lib/i18n/config";
import { createTranslator } from "@/lib/i18n/translate";
import type { User } from "@/lib/domain/types";
import { dashboardPath } from "@/lib/routes";
import type { NotificationBellData } from "@/lib/services/notifications";
import { MobileBottomBar, MobileNavDrawer } from "./mobile-nav";
import { HubTabs } from "./hub-tabs";
import { NotificationBell } from "./notification-bell";
import { QuickJump } from "./quick-jump";
import { SidebarNav, type NavCounts } from "./sidebar-nav";
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
        <div className="min-h-dvh">
            <a
                href="#main"
                className="fixed top-2 left-2 z-[70] -translate-y-20 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-fg focus:translate-y-0"
            >
                {t("shell.skipToContent")}
            </a>

            {/* Desktop sidebar */}
            <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-rail-border bg-rail-bg px-3 py-4 lg:flex print:hidden">
                <Link href={dashboardPath(user.role)} className="mb-2 rounded-lg px-2 py-1">
                    <Logo ground="rail" />
                </Link>
                <p className="mb-5 px-2 font-display text-[13px] font-bold tracking-[0.1em] text-rail-muted uppercase">{t("shell.workspace", { role: t(`role.${user.role}`) })}</p>
                <div className="scrollbar-thin flex min-h-0 flex-1 flex-col overflow-y-auto py-1 pr-1 pl-3">
                    <SidebarNav role={user.role} counts={counts} />
                </div>
            </aside>

            <div className="lg:pl-64 print:pl-0">
                <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-border bg-surface/90 px-3 backdrop-blur sm:px-5 print:hidden">
                    <MobileNavDrawer role={user.role} counts={counts} />
                    <Link href={dashboardPath(user.role)} className="flex items-center gap-2 lg:hidden" aria-label={t("shell.home")}>
                        <LogoMark className="size-7" />
                        <span className="font-display text-[17px] font-extrabold tracking-[0.01em] italic max-sm:hidden">MMA-TMS</span>
                    </Link>
                    <div className="ml-auto flex items-center gap-1">
                        <QuickJump role={user.role} />
                        {notifications && (
                            <>
                                <NotificationBell bell={notifications} now={now} />
                                <span aria-hidden className="mx-1 h-6 w-px bg-border" />
                            </>
                        )}
                        <UserMenu user={shellUser} theme={theme} />
                    </div>
                </header>

                <main id="main" tabIndex={-1} className="mx-auto w-full max-w-[1440px] px-4 pt-6 pb-24 focus:outline-none sm:px-6 md:pb-12 lg:px-8 lg:pt-8 print:max-w-none print:p-0">
                    <HubTabs role={user.role} />
                    {children}
                </main>
            </div>

            <div className="print:hidden">
                <MobileBottomBar role={user.role} counts={counts} />
            </div>
        </div>
    );
}
