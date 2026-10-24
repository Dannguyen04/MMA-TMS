import { Accessibility, Bell, Globe, Palette, UserRound } from "lucide-react";
import type { Metadata } from "next";
import { cookies } from "next/headers";

import { AccessibilitySettings } from "@/components/account/accessibility-settings";
import { AppearanceSettings } from "@/components/account/appearance-settings";
import { preferenceCategories } from "@/components/account/notification-preference-meta";
import { NotificationPreferences } from "@/components/account/notification-preferences";
import { RegionalSettings } from "@/components/account/regional-settings";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { THEME_COOKIE, parseTheme } from "@/lib/auth/constants";
import { requireUser } from "@/lib/auth/session";
import { getTranslator } from "@/lib/i18n/server";
import { routes } from "@/lib/routes";

export async function generateMetadata(): Promise<Metadata> {
    const { t } = await getTranslator();
    return { title: t("account.preferences.title") };
}

export default async function SettingsPage() {
    const [user, { t, locale }] = await Promise.all([requireUser(), getTranslator()]);
    const now = new Date().toISOString();
    const store = await cookies();
    const theme = parseTheme(store.get(THEME_COOKIE)?.value);
    const categories = preferenceCategories(user.role);

    const sections = [
        { id: "appearance", label: t("account.preferences.nav.appearance"), icon: Palette },
        { id: "notifications", label: t("account.preferences.nav.notifications"), icon: Bell },
        { id: "regional", label: t("account.preferences.nav.regional"), icon: Globe },
        { id: "accessibility", label: t("account.preferences.nav.accessibility"), icon: Accessibility },
    ] as const;

    return (
        <>
            <PageHeader
                title={t("account.preferences.title")}
                description={t("account.preferences.description")}
                actions={
                    <ButtonLink href={routes.profile} variant="secondary">
                        <UserRound aria-hidden />
                        {t("account.preferences.profileButton")}
                    </ButtonLink>
                }
            />
            <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[13rem_minmax(0,1fr)]">
                <nav aria-label={t("account.preferences.sectionsNav")} className="hidden lg:sticky lg:top-20 lg:block">
                    <ul className="flex flex-col gap-0.5">
                        {sections.map(({ id, label, icon: Icon }) => (
                            <li key={id}>
                                <a
                                    href={`#${id}`}
                                    className="flex h-9 items-center gap-2.5 rounded-lg px-3 text-sm text-fg-muted transition-colors hover:bg-surface-hover hover:text-fg"
                                >
                                    <Icon aria-hidden className="size-4 text-fg-subtle" />
                                    {label}
                                </a>
                            </li>
                        ))}
                    </ul>
                </nav>

                <div className="flex min-w-0 max-w-4xl flex-col gap-6">
                    <Card id="appearance" className="scroll-mt-20">
                        <CardHeader title={t("account.appearance.title")} icon={<Palette />} description={t("account.appearance.description")} />
                        <CardContent>
                            <AppearanceSettings initial={theme} />
                        </CardContent>
                    </Card>

                    <Card id="notifications" className="scroll-mt-20 overflow-hidden">
                        <CardHeader
                            title={t("account.notifications.title")}
                            icon={<Bell />}
                            description={t("account.notifications.description")}
                        />
                        <div className="border-t border-border">
                            <NotificationPreferences userId={user.id} role={user.role} email={user.email} categories={categories} />
                        </div>
                    </Card>

                    <Card id="regional" className="scroll-mt-20">
                        <CardHeader title={t("account.regional.title")} icon={<Globe />} description={t("account.regional.description")} />
                        <CardContent>
                            <RegionalSettings now={now} locale={locale} />
                        </CardContent>
                    </Card>

                    <Card id="accessibility" className="scroll-mt-20">
                        <CardHeader title={t("account.a11y.title")} icon={<Accessibility />} description={t("account.a11y.description")} />
                        <CardContent>
                            <AccessibilitySettings />
                        </CardContent>
                    </Card>
                </div>
            </div>
        </>
    );
}
