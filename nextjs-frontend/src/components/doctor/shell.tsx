"use client";

import {
    Activity,
    Bandage,
    BellRing,
    ClipboardList,
    FolderHeart,
    HeartPulse,
    History,
    LogOut,
    Menu,
    MessageSquareText,
    Moon,
    PanelLeftClose,
    PanelLeftOpen,
    Radar,
    ShieldCheck,
    Sun,
    Users,
    X,
    type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";

import { useThemePreference } from "@/components/layout/theme-switcher";
import { signOut } from "@/lib/actions/auth";
import type { ThemePreference } from "@/lib/auth/constants";
import { routes } from "@/lib/routes";

export interface ShellCounts {
    reviews: number;
    alerts: number;
    blocked: number;
}

type NavItem = { href: string; label: string; icon: LucideIcon; badge?: keyof ShellCounts; also?: string[] };
const BADGE_SR: Record<keyof ShellCounts, string> = { blocked: "võ sĩ bị chặn", reviews: "yêu cầu đang mở", alerts: "cảnh báo mới" };

function navGroups(showRecords: boolean): { group: string; items: NavItem[] }[] {
    return [
        {
            group: "Hằng ngày",
            items: [
                { href: routes.doctor.dashboard, label: "Hôm nay", icon: Activity },
                { href: routes.doctor.fighters, label: "Võ sĩ", icon: Users, badge: "blocked" },
                { href: routes.doctor.reviewRequests, label: "Yêu cầu xem xét", icon: MessageSquareText, badge: "reviews" },
                { href: routes.doctor.aiAlerts, label: "Quan sát AI", icon: Radar, badge: "alerts" },
            ],
        },
        {
            group: "Hồ sơ y tế",
            items: [
                { href: routes.doctor.examinations, label: "Phiếu khám", icon: ClipboardList },
                { href: routes.doctor.injuries, label: "Chấn thương", icon: Bandage },
                { href: routes.doctor.recovery, label: "Kế hoạch phục hồi", icon: HeartPulse },
                { href: routes.doctor.clearance, label: "Giấy phép", icon: ShieldCheck },
                { href: routes.doctor.history, label: "Lịch sử y tế", icon: History },
                ...(showRecords ? [{ href: routes.doctor.records, label: "Bệnh án", icon: FolderHeart }] : []),
            ],
        },
    ];
}

export interface DoctorShellProps {
    doctor: { name: string; role: string; initials: string };
    theme: ThemePreference;
    counts: ShellCounts;
    showRecords: boolean;
    /** Số thông báo chưa đọc và trang thông báo (dịch vụ thông báo sẵn có); null khi dịch vụ không trả lời. */
    bell: { unread: number; href: string } | null;
    children: ReactNode;
}

function subscribeRail(cb: () => void) {
    addEventListener("yt-rail", cb);
    addEventListener("storage", cb);
    return () => {
        removeEventListener("yt-rail", cb);
        removeEventListener("storage", cb);
    };
}

export function DoctorShell({ doctor, theme, counts, showRecords, bell, children }: DoctorShellProps) {
    const path = usePathname();
    const collapsed = useSyncExternalStore(subscribeRail, () => localStorage.getItem("yt-rail") === "1", () => false);
    const [drawerAt, setDrawerAt] = useState<string | null>(null);
    const drawer = drawerAt === path;
    const setDrawer = (open: boolean) => setDrawerAt(open ? path : null);
    const [current, choose] = useThemePreference(theme);
    const dark = current === "dark" || (current === "system" && typeof window !== "undefined" && matchMedia("(prefers-color-scheme: dark)").matches);

    useEffect(() => {
        if (!drawer) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") setDrawerAt(null);
        };
        addEventListener("keydown", onKey);
        return () => removeEventListener("keydown", onKey);
    }, [drawer]);
    const toggleRail = () => {
        localStorage.setItem("yt-rail", collapsed ? "0" : "1");
        dispatchEvent(new Event("yt-rail"));
    };
    const active = (href: string) => path === href || path.startsWith(`${href}/`);

    return (
        <div className="yt-app" data-collapsed={collapsed} data-drawer={drawer} data-dev={process.env.NODE_ENV === "development" ? "true" : undefined}>
            <a href="#main" className="yt-skip">
                Bỏ qua điều hướng
            </a>
            <header className="yt-topbar">
                <button type="button" className="yt-iconbtn" aria-label="Mở menu" aria-expanded={drawer} aria-controls="yt-side" onClick={() => setDrawer(true)}>
                    <Menu aria-hidden />
                </button>
                <Link href={routes.doctor.dashboard} className="yt-brand-sm">
                    MMA-TMS<span>Y tế</span>
                </Link>
                <span className="yt-avatar" aria-hidden>
                    {doctor.initials}
                </span>
            </header>
            <div className="yt-scrim" aria-hidden onClick={() => setDrawer(false)} />
            <aside id="yt-side" className="yt-side" aria-label="Điều hướng chính">
                <div className="yt-side-top">
                    <Link href={routes.doctor.dashboard} className="yt-brand" aria-label="MMA-TMS · Y tế, về Hôm nay">
                        <span className="yt-mark" aria-hidden>
                            <svg viewBox="0 0 24 24">
                                <path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z" />
                            </svg>
                        </span>
                        <span className="yt-brand-text">
                            MMA-TMS<b>· Y tế</b>
                        </span>
                    </Link>
                    <button type="button" className="yt-iconbtn yt-close" aria-label="Đóng menu" onClick={() => setDrawer(false)}>
                        <X aria-hidden />
                    </button>
                </div>
                <nav className="yt-nav">
                    {navGroups(showRecords).map((g) => (
                        <div key={g.group} className="yt-navgroup">
                            <p className="yt-navlabel">{g.group}</p>
                            <ul>
                                {g.items.map((it, i) => {
                                    const n = it.badge ? counts[it.badge] : 0;
                                    const on = active(it.href);
                                    return (
                                        <li key={it.href} style={{ ["--i" as string]: i }}>
                                            <Link href={it.href} aria-current={on ? "page" : undefined} className="yt-navlink" title={it.label}>
                                                <it.icon aria-hidden />
                                                <span className="yt-navtext">{it.label}</span>
                                                {n > 0 && it.badge && (
                                                    <span className="yt-badge" data-k={it.badge}>
                                                        {n}
                                                        <span className="sr-only"> {BADGE_SR[it.badge]}</span>
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
                <div className="yt-side-foot">
                    <button
                        type="button"
                        role="switch"
                        aria-checked={dark}
                        className="yt-theme"
                        onClick={() => choose(dark ? "light" : "dark")}
                        aria-label="Chuyển giao diện sáng/tối"
                        title={dark ? "Chuyển giao diện sáng/tối · đang dùng giao diện tối" : "Chuyển giao diện sáng/tối · đang dùng giao diện sáng"}
                        data-tip="Chuyển giao diện sáng/tối"
                    >
                        <span className="yt-theme-opt" data-on={!dark} aria-hidden>
                            <Sun />
                            <span className="yt-theme-text">Sáng</span>
                        </span>
                        <span className="yt-theme-opt" data-on={dark} aria-hidden>
                            <Moon />
                            <span className="yt-theme-text">Tối</span>
                        </span>
                    </button>
                    <Link href={routes.profile} className="yt-me" title="Hồ sơ của tôi">
                        <span className="yt-avatar" aria-hidden>
                            {doctor.initials}
                        </span>
                        <span className="yt-me-text">
                            <b>{doctor.name}</b>
                            <small>{doctor.role}</small>
                        </span>
                    </Link>
                    <div className="yt-foot-actions">
                        <button
                            type="button"
                            className="yt-iconbtn yt-railbtn"
                            onClick={toggleRail}
                            aria-label={collapsed ? "Mở rộng thanh bên" : "Thu gọn thanh bên"}
                            title={collapsed ? "Mở rộng" : "Thu gọn"}
                        >
                            {collapsed ? <PanelLeftOpen aria-hidden /> : <PanelLeftClose aria-hidden />}
                        </button>
                        {bell && (
                            <Link href={bell.href} className="yt-iconbtn yt-bell" aria-label={bell.unread > 0 ? `Thông báo: ${bell.unread} chưa đọc` : "Thông báo"} title="Thông báo">
                                <BellRing aria-hidden />
                                {bell.unread > 0 && <span className="yt-bell-dot">{bell.unread > 9 ? "9+" : bell.unread}</span>}
                            </Link>
                        )}
                        <form action={signOut} className="yt-signout">
                            <button type="submit" className="yt-iconbtn" aria-label="Đăng xuất" title="Đăng xuất">
                                <LogOut aria-hidden />
                            </button>
                        </form>
                    </div>
                </div>
            </aside>
            <main id="main" tabIndex={-1} className="yt-main">
                {children}
            </main>
        </div>
    );
}
