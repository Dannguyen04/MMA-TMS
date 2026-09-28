import {
    Activity,
    BrainCircuit,
    CalendarDays,
    ChartLine,
    Cpu,
    Film,
    HeartPulse,
    KeyRound,
    LayoutDashboard,
    Megaphone,
    Radar,
    ScanLine,
    ScrollText,
    Settings,
    ShieldCheck,
    Stethoscope,
    Users,
    Video,
    type LucideIcon,
} from "lucide-react";

import type { Role } from "@/lib/domain/types";
import { routes } from "@/lib/routes";

export type NavBadgeKey = "notifications" | "reviewQueue" | "newAlerts" | "failedJobs";

/** Screen-reader suffix read after a nav badge count ("3 failed"). */
export const BADGE_LABELS: Record<NavBadgeKey, string> = {
    notifications: "unread",
    reviewQueue: "awaiting review",
    newAlerts: "new",
    failedJobs: "failed",
};

/** A page inside a hub, shown as a route tab above that page's header. */
export interface NavTab {
    label: string;
    href: string;
}

export interface NavItem {
    label: string;
    /** Compact label for the mobile bottom bar; defaults to `label`. */
    shortLabel?: string;
    /** Where the link goes. For a hub, this is its first tab. */
    href: string;
    icon: LucideIcon;
    badge?: NavBadgeKey;
    /** Highlight only on an exact path match. */
    exact?: boolean;
    /** Makes the item a hub: the link stays current on every tab and on the pages under them. */
    tabs?: NavTab[];
}

export interface NavSection {
    label?: string;
    items: NavItem[];
}

/**
 * Role-based information architecture. Fighters, coaches and doctors get a handful of hubs, each
 * answering one kind of question; related pages sit behind the hub's tabs. Admin keeps its sections.
 */
export const NAVIGATION: Record<Role, NavSection[]> = {
    fighter: [
        {
            items: [
                { label: "Today", href: routes.fighter.dashboard, icon: LayoutDashboard },
                {
                    label: "Training",
                    href: routes.fighter.schedule,
                    icon: CalendarDays,
                    tabs: [
                        { label: "Schedule", href: routes.fighter.schedule },
                        { label: "Plans", href: routes.fighter.training },
                        { label: "History", href: routes.fighter.history },
                    ],
                },
                { label: "Film", href: routes.fighter.videos, icon: Video },
                {
                    label: "Progress",
                    href: routes.fighter.performance,
                    icon: ChartLine,
                    tabs: [
                        { label: "Performance", href: routes.fighter.performance },
                        { label: "Goals", href: routes.fighter.goals },
                    ],
                },
                { label: "Health", href: routes.fighter.health, icon: HeartPulse },
            ],
        },
    ],
    coach: [
        {
            items: [
                { label: "Today", href: routes.coach.dashboard, icon: LayoutDashboard },
                {
                    label: "Roster",
                    href: routes.coach.fighters,
                    icon: Users,
                    tabs: [
                        { label: "Fighters", href: routes.coach.fighters },
                        { label: "Performance", href: routes.coach.performance },
                        { label: "Goals", href: routes.coach.goals },
                    ],
                },
                {
                    label: "Training",
                    href: routes.coach.sessions,
                    icon: CalendarDays,
                    tabs: [
                        { label: "Sessions", href: routes.coach.sessions },
                        { label: "Plans", href: routes.coach.plans },
                    ],
                },
                { label: "Film room", shortLabel: "Film", href: routes.coach.videoAnalysis, icon: ScanLine, badge: "reviewQueue" },
                { label: "Clearance", href: routes.coach.clearance, icon: ShieldCheck },
            ],
        },
    ],
    doctor: [
        {
            items: [
                { label: "Triage", href: routes.doctor.dashboard, icon: Activity },
                {
                    label: "Patients",
                    href: routes.doctor.fighters,
                    icon: Users,
                    tabs: [
                        { label: "Fighters", href: routes.doctor.fighters },
                        { label: "Records", href: routes.doctor.records },
                    ],
                },
                {
                    label: "Clinical",
                    href: routes.doctor.examinations,
                    icon: Stethoscope,
                    tabs: [
                        { label: "Examinations", href: routes.doctor.examinations },
                        { label: "Injuries", href: routes.doctor.injuries },
                        { label: "Recovery", href: routes.doctor.recovery },
                        { label: "Clearance", href: routes.doctor.clearance },
                    ],
                },
                { label: "Observations", href: routes.doctor.aiAlerts, icon: Radar, badge: "newAlerts" },
            ],
        },
    ],
    admin: [
        { items: [{ label: "Dashboard", href: routes.admin.dashboard, icon: LayoutDashboard }] },
        {
            label: "Access",
            items: [
                { label: "Users", href: routes.admin.users, icon: Users },
                { label: "Roles & permissions", shortLabel: "Roles", href: routes.admin.roles, icon: KeyRound },
            ],
        },
        {
            label: "AI platform",
            items: [
                { label: "Videos", href: routes.admin.videos, icon: Film },
                { label: "AI jobs", href: routes.admin.aiJobs, icon: Cpu, badge: "failedJobs" },
                { label: "AI models", shortLabel: "Models", href: routes.admin.aiModels, icon: BrainCircuit },
            ],
        },
        {
            label: "Operations",
            items: [
                { label: "Audit logs", shortLabel: "Audit", href: routes.admin.auditLogs, icon: ScrollText },
                { label: "Broadcasts", href: routes.admin.notifications, icon: Megaphone },
                { label: "System settings", shortLabel: "Settings", href: routes.admin.settings, icon: Settings },
            ],
        },
    ],
};

/**
 * Destinations for the mobile bottom bar. Roles built on hubs show every hub; admin picks its four
 * most-used pages.
 */
export function mobilePrimaryItems(role: Role): NavItem[] {
    const items = NAVIGATION[role].flatMap((section) => section.items);
    if (role !== "admin") return items;
    const admin = [routes.admin.dashboard, routes.admin.users, routes.admin.aiJobs, routes.admin.auditLogs];
    return admin.map((href) => items.find((item) => item.href === href)).filter((item): item is NavItem => Boolean(item));
}

function matchesPath(href: string, pathname: string): boolean {
    return pathname === href || pathname.startsWith(`${href}/`);
}

export function isNavItemActive(item: Pick<NavItem, "href" | "exact" | "tabs">, pathname: string): boolean {
    if (item.tabs) return matchesPath(item.href, pathname) || item.tabs.some((tab) => matchesPath(tab.href, pathname));
    if (item.exact) return pathname === item.href;
    return matchesPath(item.href, pathname);
}

/** The hub the current page belongs to, if any. */
export function hubForPath(role: Role, pathname: string): NavItem | null {
    for (const section of NAVIGATION[role]) {
        for (const item of section.items) {
            if (item.tabs && isNavItemActive(item, pathname)) return item;
        }
    }
    return null;
}

/**
 * Tabs to show above the page, only on a hub's own tab pages. Detail pages under a tab (a plan, a session,
 * a fighter profile) keep their back link instead, so they never stack a second row of tabs.
 */
export function hubTabsFor(role: Role, pathname: string): { label: string; tabs: NavTab[] } | null {
    const hub = hubForPath(role, pathname);
    if (!hub?.tabs || !hub.tabs.some((tab) => tab.href === pathname)) return null;
    return { label: hub.label, tabs: hub.tabs };
}
