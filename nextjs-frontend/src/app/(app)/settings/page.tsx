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
import { routes } from "@/lib/routes";
import { listNotifications } from "@/lib/services/notifications";

export const metadata: Metadata = { title: "Preferences" };

const SECTIONS = [
    { id: "appearance", label: "Appearance", icon: Palette },
    { id: "notifications", label: "Notifications", icon: Bell },
    { id: "regional", label: "Language & region", icon: Globe },
    { id: "accessibility", label: "Accessibility", icon: Accessibility },
] as const;

export default async function SettingsPage() {
    const user = await requireUser();
    const now = new Date().toISOString();
    const [store, notifications] = await Promise.all([cookies(), listNotifications(user.id)]);
    const theme = parseTheme(store.get(THEME_COOKIE)?.value);
    const categories = preferenceCategories(user.role, [...new Set(notifications.map((n) => n.category))]);

    return (
        <>
            <PageHeader
                title="Preferences"
                description="Choose how MMA-TMS looks, what it tells you about, and how dates and times read."
                actions={
                    <ButtonLink href={routes.profile} variant="secondary">
                        <UserRound aria-hidden />
                        Profile
                    </ButtonLink>
                }
            />
            <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[13rem_minmax(0,1fr)]">
                <nav aria-label="Preference sections" className="hidden lg:sticky lg:top-20 lg:block">
                    <ul className="flex flex-col gap-0.5">
                        {SECTIONS.map(({ id, label, icon: Icon }) => (
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
                        <CardHeader title="Appearance" icon={<Palette />} description="Light, dark, or match your device." />
                        <CardContent>
                            <AppearanceSettings initial={theme} />
                        </CardContent>
                    </Card>

                    <Card id="notifications" className="scroll-mt-20 overflow-hidden">
                        <CardHeader
                            title="Notifications"
                            icon={<Bell />}
                            description="Choose which updates alert you in the app and which also arrive by email."
                        />
                        <div className="border-t border-border">
                            <NotificationPreferences userId={user.id} role={user.role} email={user.email} categories={categories} />
                        </div>
                    </Card>

                    <Card id="regional" className="scroll-mt-20">
                        <CardHeader title="Language & region" icon={<Globe />} description="Dates and times always use academy time." />
                        <CardContent>
                            <RegionalSettings now={now} />
                        </CardContent>
                    </Card>

                    <Card id="accessibility" className="scroll-mt-20">
                        <CardHeader title="Accessibility" icon={<Accessibility />} description="Motion and keyboard support." />
                        <CardContent>
                            <AccessibilitySettings />
                        </CardContent>
                    </Card>
                </div>
            </div>
        </>
    );
}
