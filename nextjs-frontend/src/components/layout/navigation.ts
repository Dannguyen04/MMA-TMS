import {
    Activity,
    Bandage,
    CalendarDays,
    ClipboardList,
    Cpu,
    Dumbbell,
    FolderHeart,
    HeartPulse,
    History,
    LayoutDashboard,
    MessageSquareText,
    Radar,
    Scale,
    ScanLine,
    Settings,
    ShieldCheck,
    Swords,
    Users,
    Video,
    type LucideIcon,
} from "lucide-react";

import type { Role } from "@/lib/domain/types";
import type { MessageKey } from "@/lib/i18n/translate";
import { routes } from "@/lib/routes";

export type NavBadgeKey = "notifications" | "reviewQueue" | "newAlerts" | "failedJobs" | "blockedFighters" | "openReviews";

/** Screen-reader suffix read after a nav badge count ("3 failed"). */
export const BADGE_LABELS: Record<NavBadgeKey, MessageKey> = {
    notifications: "shell.badge.notifications",
    reviewQueue: "shell.badge.reviewQueue",
    newAlerts: "shell.badge.newAlerts",
    failedJobs: "shell.badge.failedJobs",
    blockedFighters: "shell.badge.blockedFighters",
    openReviews: "shell.badge.openReviews",
};

/** Badges that report something blocking (solid red), as opposed to a count of work waiting. */
export const URGENT_BADGES: readonly NavBadgeKey[] = ["failedJobs", "blockedFighters"];

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
 * Role-based information architecture. Every role gets a handful of hubs, each answering one kind of question;
 * related pages sit behind the hub's tabs.
 */
export const NAVIGATION: Record<Role, NavSection[]> = {
    fighter: [
        {
            items: [
                { label: "Today", href: routes.fighter.dashboard, icon: LayoutDashboard },
                { label: "Bout", href: routes.fighter.bout, icon: Scale },
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
                { label: "Health", href: routes.fighter.health, icon: HeartPulse },
            ],
        },
    ],
    coach: [
        {
            items: [
                { label: "Today", href: routes.coach.dashboard, icon: LayoutDashboard },
                {
                    label: "Bouts",
                    href: routes.coach.bouts,
                    icon: Swords,
                    tabs: [
                        { label: "Upcoming", href: routes.coach.bouts },
                        { label: "Suspensions", href: routes.coach.suspensions },
                        { label: "Readiness", href: routes.coach.readiness },
                    ],
                },
                { label: "Roster", href: routes.coach.fighters, icon: Users },
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
    // The doctor workspace keeps its own two groups (daily work, then the medical file), drawn by the shared shell.
    doctor: [
        {
            label: "Daily",
            items: [
                { label: "Today", href: routes.doctor.dashboard, icon: Activity },
                { label: "Fighters", href: routes.doctor.fighters, icon: Users, badge: "blockedFighters" },
                { label: "Review requests", shortLabel: "Reviews", href: routes.doctor.reviewRequests, icon: MessageSquareText, badge: "openReviews" },
                { label: "AI observations", shortLabel: "AI", href: routes.doctor.aiAlerts, icon: Radar, badge: "newAlerts" },
            ],
        },
        {
            label: "Medical",
            items: [
                { label: "Examinations", href: routes.doctor.examinations, icon: ClipboardList },
                { label: "Injuries", href: routes.doctor.injuries, icon: Bandage },
                { label: "Recovery plans", href: routes.doctor.recovery, icon: HeartPulse },
                { label: "Clearances", href: routes.doctor.clearance, icon: ShieldCheck },
                { label: "Medical history", href: routes.doctor.history, icon: History },
                { label: "Medical records", href: routes.doctor.records, icon: FolderHeart },
            ],
        },
    ],
    admin: [
        {
            items: [
                { label: "Today", href: routes.admin.dashboard, icon: LayoutDashboard },
                {
                    label: "People",
                    href: routes.admin.users,
                    icon: Users,
                    tabs: [
                        { label: "Users", href: routes.admin.users },
                        { label: "Roles & permissions", href: routes.admin.roles },
                    ],
                },
                { label: "Training", href: routes.admin.exercises, icon: Dumbbell },
                {
                    label: "AI platform",
                    shortLabel: "AI",
                    // Jobs lead: failures are what an administrator comes here for, and the hub carries their count.
                    href: routes.admin.aiJobs,
                    icon: Cpu,
                    badge: "failedJobs",
                    tabs: [
                        { label: "AI jobs", href: routes.admin.aiJobs },
                        { label: "Videos", href: routes.admin.videos },
                    ],
                },
                {
                    label: "System",
                    href: routes.admin.auditLogs,
                    icon: Settings,
                    tabs: [
                        { label: "Audit logs", href: routes.admin.auditLogs },
                        { label: "Broadcasts", href: routes.admin.notifications },
                        { label: "Settings", href: routes.admin.settings },
                    ],
                },
            ],
        },
    ],
};

/** The admin hubs the mobile bottom bar shows; Training stays in the menu. Admissions is frozen (T-001). */
const ADMIN_MOBILE_HUBS: readonly string[] = [routes.admin.dashboard, routes.admin.users, routes.admin.aiJobs, routes.admin.auditLogs];

/** The doctor's daily pages; the medical file stays in the menu. */
const DOCTOR_MOBILE_HUBS: readonly string[] = [routes.doctor.dashboard, routes.doctor.fighters, routes.doctor.reviewRequests, routes.doctor.aiAlerts];

/** The role's sections without the destinations this deployment hides (e.g. medical records in API mode). */
export function navSectionsFor(role: Role, hidden: readonly string[] = []): NavSection[] {
    if (hidden.length === 0) return NAVIGATION[role];
    return NAVIGATION[role]
        .map((section) => ({ ...section, items: section.items.filter((item) => !hidden.includes(item.href)) }))
        .filter((section) => section.items.length > 0);
}

/** Destinations for the mobile bottom bar: every hub, or for admin and doctor the four above. */
export function mobilePrimaryItems(role: Role): NavItem[] {
    const items = NAVIGATION[role].flatMap((section) => section.items);
    if (role === "admin") return items.filter((item) => ADMIN_MOBILE_HUBS.includes(item.href));
    if (role === "doctor") return items.filter((item) => DOCTOR_MOBILE_HUBS.includes(item.href));
    return items;
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
