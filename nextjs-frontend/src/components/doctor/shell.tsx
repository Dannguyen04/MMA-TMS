"use client";

import { BellRing, LogOut, Moon, Sun } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { LogoMark } from "@/components/brand/logo";
import { useT } from "@/components/i18n/locale-provider";
import { WorkspaceSidebar } from "@/components/layout/sidebar-nav";
import { useThemePreference } from "@/components/layout/theme-switcher";
import { signOut } from "@/lib/actions/auth";
import type { ThemePreference } from "@/lib/auth/constants";
import { routes } from "@/lib/routes";

export interface ShellCounts {
    reviews: number;
    alerts: number;
    blocked: number;
}

export interface DoctorShellProps {
    doctor: { name: string; role: string; initials: string };
    theme: ThemePreference;
    counts: ShellCounts;
    showRecords: boolean;
    bell: { unread: number; href: string } | null;
    children: ReactNode;
}

export function DoctorShell({ doctor, theme, counts, showRecords, bell, children }: DoctorShellProps) {
    const t = useT();
    const [current, choose] = useThemePreference(theme);
    const dark = current === "dark" || (current === "system" && typeof window !== "undefined" && matchMedia("(prefers-color-scheme: dark)").matches);

    return (
        <div className="workspace-frame">
            <a href="#main" className="yt-skip">{t("doctor.nav.skip")}</a>
            <WorkspaceSidebar role="doctor" showRecords={showRecords} counts={{
                doctorBlocked: counts.blocked,
                doctorReviews: counts.reviews,
                doctorAlerts: counts.alerts,
            }} footer={
                <div className="workspace-rail-tools">
                    <Link href={routes.profile} className="workspace-rail-profile" title={t("doctor.nav.profile")}>
                        <span className="yt-avatar" aria-hidden>{doctor.initials}</span>
                        <span className="workspace-rail-profile-copy">
                            <strong>{doctor.name}</strong>
                            <small>{doctor.role}</small>
                        </span>
                        <span className="sr-only">{t("doctor.nav.profile")}</span>
                    </Link>
                    <div className="workspace-rail-actions">
                        <button type="button" role="switch" aria-checked={dark} className="workspace-rail-icon"
                            onClick={() => choose(dark ? "light" : "dark")}
                            aria-label={t("doctor.nav.theme")}
                            title={t("doctor.nav.themeOn", { mode: dark ? t("doctor.nav.dark") : t("doctor.nav.light") })}
                        >
                            {dark ? <Moon aria-hidden /> : <Sun aria-hidden />}
                        </button>
                        {bell && (
                            <Link href={bell.href} className="workspace-rail-icon"
                                aria-label={bell.unread > 0 ? t("doctor.nav.notificationsUnread", { n: bell.unread }) : t("doctor.nav.notifications")}
                                title={t("doctor.nav.notifications")}
                            >
                                <BellRing aria-hidden />
                                {bell.unread > 0 && <span className="workspace-rail-dot" aria-hidden>{bell.unread > 9 ? "9+" : bell.unread}</span>}
                            </Link>
                        )}
                        <form action={signOut}>
                            <button type="submit" className="workspace-rail-icon" aria-label={t("shell.signOut")} title={t("shell.signOut")}>
                                <LogOut aria-hidden />
                            </button>
                        </form>
                    </div>
                </div>
            } />
            <header className="workspace-topbar sticky top-0 z-20 flex h-14 items-center justify-between border-b border-border bg-surface pr-4 lg:hidden">
                <Link href={routes.doctor.dashboard} aria-label={t("doctor.brandHome")} className="flex items-center gap-2">
                    <LogoMark className="size-7" />
                    <span className="font-display font-bold">MMA-TMS</span>
                </Link>
                <span className="yt-avatar" aria-hidden>{doctor.initials}</span>
            </header>
            <main id="main" tabIndex={-1} className="yt-main mx-auto">
                {children}
            </main>
        </div>
    );
}
