import { cookies } from "next/headers";

import { AppShell } from "@/components/layout/app-shell";
import type { NavCounts } from "@/components/layout/sidebar-nav";
import { THEME_COOKIE, parseTheme } from "@/lib/auth/constants";
import { requireUser } from "@/lib/auth/session";
import type { User } from "@/lib/domain/types";
import { getLocale } from "@/lib/i18n/server";
import { routes } from "@/lib/routes";
import { doctorShellCounts } from "@/lib/services/doctor-board";
import { medicalFeatureAvailable } from "@/lib/services/medical-features";
import { getNotificationBell } from "@/lib/services/notifications";
import { getNavBadgeCounts } from "@/lib/services/shell";

/** Nav badges; the doctor's come from the triage board (blocked fighters, open reviews, new AI alerts). */
async function navCounts(user: User): Promise<NavCounts> {
    const counts = await getNavBadgeCounts(user);
    if (user.role !== "doctor") return counts;
    const board = await doctorShellCounts(user);
    return { ...counts, blockedFighters: board.blocked, openReviews: board.reviews, newAlerts: board.alerts };
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
    const user = await requireUser();
    const [store, locale, counts, notifications] = await Promise.all([
        cookies(),
        getLocale(),
        navCounts(user),
        getNotificationBell({ id: user.id, role: user.role }),
    ]);
    const theme = parseTheme(store.get(THEME_COOKIE)?.value);
    // Every role, the doctor included, shares one shell: same rail, header, colours and type.
    const hiddenNav = user.role === "doctor" && !medicalFeatureAvailable("medicalRecord") ? [routes.doctor.records] : [];

    return (
        <AppShell
            user={user}
            theme={theme}
            locale={locale}
            counts={counts}
            notifications={notifications}
            now={new Date().toISOString()}
            hiddenNav={hiddenNav}
        >
            {children}
        </AppShell>
    );
}
