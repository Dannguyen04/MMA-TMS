import {
    Bandage,
    Bell,
    BrainCircuit,
    CalendarDays,
    ChartLine,
    ClipboardList,
    Cpu,
    FileText,
    Film,
    HeartPulse,
    History,
    KeyRound,
    LayoutDashboard,
    Megaphone,
    Radar,
    RefreshCw,
    ScanLine,
    ScrollText,
    Settings,
    ShieldCheck,
    SlidersHorizontal,
    Stethoscope,
    Target,
    UserRound,
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

export interface NavItem {
    label: string;
    /** Compact label for the mobile bottom bar; defaults to `label`. */
    shortLabel?: string;
    href: string;
    icon: LucideIcon;
    badge?: NavBadgeKey;
    /** Highlight only on an exact path match. */
    exact?: boolean;
}

export interface NavSection {
    label?: string;
    items: NavItem[];
}

/**
 * Role-based information architecture. Each role only sees the areas it is responsible for.
 */
export const NAVIGATION: Record<Role, NavSection[]> = {
    fighter: [
        { items: [{ label: "Dashboard", href: routes.fighter.dashboard, icon: LayoutDashboard }] },
        {
            label: "Training",
            items: [
                { label: "Schedule", href: routes.fighter.schedule, icon: CalendarDays },
                { label: "Training plans", shortLabel: "Plans", href: routes.fighter.training, icon: ClipboardList, exact: true },
                { label: "History", href: routes.fighter.history, icon: History },
            ],
        },
        {
            label: "Analysis",
            items: [
                { label: "Videos", href: routes.fighter.videos, icon: Video },
                { label: "Performance", href: routes.fighter.performance, icon: ChartLine },
                { label: "Goals", href: routes.fighter.goals, icon: Target },
            ],
        },
        { label: "Health", items: [{ label: "Health & Medical Clearance", shortLabel: "Health", href: routes.fighter.health, icon: HeartPulse }] },
    ],
    coach: [
        { items: [{ label: "Dashboard", href: routes.coach.dashboard, icon: LayoutDashboard }] },
        {
            label: "Athletes",
            items: [
                { label: "Fighters", href: routes.coach.fighters, icon: Users },
                { label: "Performance", href: routes.coach.performance, icon: ChartLine },
                { label: "Goals", href: routes.coach.goals, icon: Target },
            ],
        },
        {
            label: "Training",
            items: [
                { label: "Training plans", shortLabel: "Plans", href: routes.coach.plans, icon: ClipboardList },
                { label: "Sessions", href: routes.coach.sessions, icon: CalendarDays },
            ],
        },
        {
            label: "Analysis",
            items: [{ label: "Video analysis", shortLabel: "Video", href: routes.coach.videoAnalysis, icon: ScanLine, badge: "reviewQueue" }],
        },
        { label: "Health", items: [{ label: "Medical Clearance", shortLabel: "Clearance", href: routes.coach.clearance, icon: ShieldCheck }] },
    ],
    doctor: [
        { items: [{ label: "Dashboard", href: routes.doctor.dashboard, icon: LayoutDashboard }] },
        {
            label: "Patients",
            items: [
                { label: "Fighters", href: routes.doctor.fighters, icon: Users },
                { label: "Medical records", shortLabel: "Records", href: routes.doctor.records, icon: FileText },
            ],
        },
        {
            label: "Clinical",
            items: [
                { label: "Examinations", href: routes.doctor.examinations, icon: Stethoscope },
                { label: "Injuries", href: routes.doctor.injuries, icon: Bandage },
                { label: "Recovery", href: routes.doctor.recovery, icon: RefreshCw },
                { label: "Medical Clearance", shortLabel: "Clearance", href: routes.doctor.clearance, icon: ShieldCheck },
            ],
        },
        { items: [{ label: "AI observations", shortLabel: "Observations", href: routes.doctor.aiAlerts, icon: Radar, badge: "newAlerts" }] },
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

export const ACCOUNT_NAVIGATION: NavItem[] = [
    { label: "Notifications", href: routes.notifications, icon: Bell, badge: "notifications" },
    { label: "Profile", href: routes.profile, icon: UserRound },
    { label: "Preferences", href: routes.settings, icon: SlidersHorizontal },
];

/** Four most-used destinations per role for the mobile bottom bar. */
export const MOBILE_PRIMARY: Record<Role, string[]> = {
    fighter: [routes.fighter.dashboard, routes.fighter.schedule, routes.fighter.videos, routes.fighter.health],
    coach: [routes.coach.dashboard, routes.coach.fighters, routes.coach.sessions, routes.coach.videoAnalysis],
    doctor: [routes.doctor.dashboard, routes.doctor.fighters, routes.doctor.injuries, routes.doctor.aiAlerts],
    admin: [routes.admin.dashboard, routes.admin.users, routes.admin.aiJobs, routes.admin.auditLogs],
};

export function isNavItemActive(item: Pick<NavItem, "href" | "exact">, pathname: string): boolean {
    if (item.exact) return pathname === item.href;
    return pathname === item.href || pathname.startsWith(`${item.href}/`);
}
