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
            <a href="#main" className="fixed top-2 left-2 z-[70] -translate-y-20 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-fg focus:translate-y-0">{t("doctor.nav.skip")}</a>
            <WorkspaceSidebar role="doctor" showRecords={showRecords} counts={{
                doctorBlocked: counts.blocked,
                doctorReviews: counts.reviews,
                doctorAlerts: counts.alerts,
            }} footer={
                <div className="workspace-rail-tools">
                    <Link href={routes.profile} className="workspace-rail-profile" title={t("doctor.nav.profile")}>
                        <span aria-hidden className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-hover text-xs font-semibold tracking-tight text-fg-muted ring-1 ring-border">{doctor.initials}</span>
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
                <span aria-hidden className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-hover text-xs font-semibold tracking-tight text-fg-muted ring-1 ring-border">{doctor.initials}</span>
            </header>
            <main id="main" tabIndex={-1} className="mx-auto w-full min-w-0 max-w-[1440px] px-4 pt-6 pb-24 focus:outline-none sm:px-6 md:pb-12 lg:px-8 lg:pt-8 print:max-w-none print:p-0">
                {children}
            </main>
        </div>
    );
}
