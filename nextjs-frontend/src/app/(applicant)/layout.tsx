import { LogOut } from "lucide-react";

import { Logo } from "@/components/brand/logo";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import { NotificationBell } from "@/components/layout/notification-bell";
import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/actions/auth";
import { requireApplicant } from "@/lib/auth/session";
import { getTranslator } from "@/lib/i18n/server";
import { getNotificationBell } from "@/lib/services/notifications";

/** A self-registered applicant's area: just their application, until their fighter account is activated. */
export default async function ApplicantLayout({ children }: { children: React.ReactNode }) {
    const [applicant, { t }] = await Promise.all([requireApplicant(), getTranslator()]);
    // Applicants hear about their assessment and the academy's decision.
    const bell = await getNotificationBell({ id: applicant.id, role: "applicant" });

    return (
        <div className="min-h-dvh bg-bg">
            <header className="border-b border-border bg-surface">
                <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
                    <span className="inline-flex rounded-xl bg-nav-bg px-3 py-2">
                        <Logo />
                    </span>
                    <div className="flex min-w-0 items-center gap-2">
                        <span className="hidden truncate text-sm text-fg-muted sm:inline">{applicant.email}</span>
                        <LanguageSwitcher className="w-36" />
                        {bell && <NotificationBell bell={bell} now={new Date().toISOString()} />}
                        <form action={signOut}>
                            <Button type="submit" variant="ghost" size="sm">
                                <LogOut aria-hidden />
                                {t("shell.signOut")}
                            </Button>
                        </form>
                    </div>
                </div>
            </header>
            <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">{children}</main>
        </div>
    );
}
