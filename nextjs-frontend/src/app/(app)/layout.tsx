import { cookies } from "next/headers";

import { DoctorFrame } from "@/components/doctor/doctor-frame";
import { AppShell } from "@/components/layout/app-shell";
import { THEME_COOKIE, parseTheme } from "@/lib/auth/constants";
import { requireUser } from "@/lib/auth/session";
import { getLocale } from "@/lib/i18n/server";
import { getNotificationBell } from "@/lib/services/notifications";
import { getNavBadgeCounts } from "@/lib/services/shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
    const user = await requireUser();
    const [store, locale, counts, notifications] = await Promise.all([
        cookies(),
        getLocale(),
        getNavBadgeCounts(user),
        getNotificationBell({ id: user.id, role: user.role }),
    ]);
    const theme = parseTheme(store.get(THEME_COOKIE)?.value);

    // Bác sĩ dùng khung riêng (thanh bên dọc, tiếng Việt); mọi vai trò khác giữ AppShell như cũ.
    if (user.role === "doctor") {
        return (
            <DoctorFrame user={user} theme={theme} notifications={notifications}>
                {children}
            </DoctorFrame>
        );
    }

    return (
        <AppShell
            user={user}
            theme={theme}
            locale={locale}
            counts={counts}
            notifications={notifications}
            now={new Date().toISOString()}
        >
            {children}
        </AppShell>
    );
}
