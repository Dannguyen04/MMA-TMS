import { cookies } from "next/headers";

import { AppShell } from "@/components/layout/app-shell";
import { THEME_COOKIE, parseTheme } from "@/lib/auth/constants";
import { requireUser } from "@/lib/auth/session";
import { getNotificationSummary } from "@/lib/services/notifications";
import { getNavBadgeCounts } from "@/lib/services/shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
    const user = await requireUser();
    const [store, counts, notifications] = await Promise.all([
        cookies(),
        getNavBadgeCounts(user),
        getNotificationSummary(user.id),
    ]);
    const theme = parseTheme(store.get(THEME_COOKIE)?.value);

    return (
        <AppShell
            user={user}
            theme={theme}
            counts={counts}
            notifications={notifications}
            now={new Date().toISOString()}
        >
            {children}
        </AppShell>
    );
}
