"use client";

import { Menu, PanelLeftClose, PanelLeftOpen, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState, useSyncExternalStore, type ReactNode } from "react";

import { LogoMark } from "@/components/brand/logo";
import { useT } from "@/components/i18n/locale-provider";
import { navLabel } from "@/lib/i18n/translate";
import { dashboardPath, routes } from "@/lib/routes";
import { BADGE_LABELS, WORKSPACE_NAVIGATION, isNavItemActive, type NavBadgeKey, type WorkspaceRole } from "./navigation";

export type NavCounts = Partial<Record<NavBadgeKey, number>>;

interface WorkspaceSidebarProps {
    role: WorkspaceRole;
    counts?: NavCounts;
    showRecords?: boolean;
    footer?: ReactNode;
}

// Retain the existing sidebar preference saved by the medical workspace.
const COLLAPSE_KEY = "yt-rail";
function subscribeToSidebar(callback: () => void) {
    window.addEventListener(COLLAPSE_KEY, callback);
    window.addEventListener("storage", callback);
    return () => {
        window.removeEventListener(COLLAPSE_KEY, callback);
        window.removeEventListener("storage", callback);
    };
}

function SidebarContents({ role, counts, showRecords, footer, collapsed, onNavigate, control }: WorkspaceSidebarProps & {
    collapsed?: boolean;
    onNavigate?: () => void;
    control?: ReactNode;
}) {
    const pathname = usePathname();
    const t = useT();
    const sections = WORKSPACE_NAVIGATION[role];
    const home = role === "applicant" ? routes.apply : dashboardPath(role);
    const workspace = t("shell.workspace", { role: t(`role.${role}`) });

    return (
        <>
            <div className="workspace-rail-brand">
                <Link href={home} aria-label={t("shell.home")} className="workspace-rail-home" onClick={onNavigate}>
                    <LogoMark />
                    <span className="workspace-rail-wordmark">MMA-TMS</span>
                </Link>
                {onNavigate && control}
            </div>
            <p className="workspace-rail-caption">{workspace}</p>
            <nav className="workspace-rail-nav" aria-label={t("shell.mainNav")}>
                {sections.map((section, index) => (
                    <div key={section.message ?? section.label ?? index}>
                        {(section.message || section.label) && (
                            <p className="workspace-rail-group">{section.message ? t(section.message) : navLabel(t, section.label ?? "")}</p>
                        )}
                        <ul>
                            {section.items.filter((item) => !item.requiresRecords || showRecords).map((item) => {
                                const label = item.message ? t(item.message) : navLabel(t, item.label);
                                const count = item.badge ? counts?.[item.badge] ?? 0 : 0;
                                const Icon = item.icon;
                                return (
                                    <li key={item.href}>
                                        <Link
                                            href={item.href}
                                            className="workspace-rail-link"
                                            aria-current={isNavItemActive(item, pathname) ? "page" : undefined}
                                            title={collapsed ? label : undefined}
                                            onClick={onNavigate}
                                        >
                                            <Icon aria-hidden />
                                            <span className={collapsed ? "sr-only" : "workspace-rail-label"}>{label}</span>
                                            {count > 0 && item.badge && (
                                                <span className="workspace-rail-badge" data-tone={item.badge}>
                                                    {count}
                                                    <span className="sr-only"> {t(BADGE_LABELS[item.badge])}</span>
                                                </span>
                                            )}
                                        </Link>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                ))}
            </nav>
            {(footer || !onNavigate) && (
                <div className="workspace-rail-footer">
                    {footer}
                    {!onNavigate && control}
                </div>
            )}
        </>
    );
}

export function WorkspaceSidebar(props: WorkspaceSidebarProps) {
    const t = useT();
    const pathname = usePathname();
    const dialogId = useId();
    const dialogRef = useRef<HTMLDialogElement>(null);
    const [open, setOpen] = useState(false);
    const collapsed = useSyncExternalStore(subscribeToSidebar, () => localStorage.getItem(COLLAPSE_KEY) === "1", () => false);
    const collapseLabel = collapsed ? t("doctor.nav.expand") : t("doctor.nav.collapse");
    const close = () => dialogRef.current?.close();

    useEffect(() => { dialogRef.current?.close(); }, [pathname]);
    useEffect(() => {
        const desktop = matchMedia("(min-width: 1024px)");
        const closeOnDesktop = () => { if (desktop.matches) dialogRef.current?.close(); };
        desktop.addEventListener("change", closeOnDesktop);
        return () => desktop.removeEventListener("change", closeOnDesktop);
    }, []);

    return (
        <>
            <aside className="workspace-rail workspace-rail-desktop" data-role={props.role} data-collapsed={collapsed}>
                <SidebarContents {...props} collapsed={collapsed} control={
                    <button type="button" className="workspace-rail-icon workspace-rail-collapse" title={collapseLabel} aria-label={collapseLabel} onClick={() => {
                        localStorage.setItem(COLLAPSE_KEY, collapsed ? "0" : "1");
                        window.dispatchEvent(new Event(COLLAPSE_KEY));
                    }}>
                        {collapsed ? <PanelLeftOpen aria-hidden /> : <PanelLeftClose aria-hidden />}
                    </button>
                } />
            </aside>
            <button type="button" className="workspace-rail-trigger" aria-label={t("shell.openNav")} aria-expanded={open} aria-controls={dialogId} onClick={() => {
                dialogRef.current?.showModal();
                setOpen(true);
            }}>
                <Menu aria-hidden />
            </button>
            <dialog
                id={dialogId}
                ref={dialogRef}
                className="workspace-rail workspace-rail-drawer"
                data-role={props.role}
                aria-label={t("shell.navigation")}
                onClose={() => setOpen(false)}
                onClick={(event) => { if (event.target === event.currentTarget) close(); }}
            >
                {open && <div className="workspace-rail-inner">
                    <SidebarContents {...props} onNavigate={close} control={
                        <button type="button" className="workspace-rail-icon" aria-label={t("shell.closeNav")} onClick={close}>
                            <X aria-hidden />
                        </button>
                    } />
                </div>}
            </dialog>
        </>
    );
}
