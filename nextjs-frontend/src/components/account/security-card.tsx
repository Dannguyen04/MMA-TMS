"use client";

import { KeyRound, Lock, LogOut, MonitorSmartphone, ShieldCheck } from "lucide-react";

import { useLocale, useT } from "@/components/i18n/locale-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { signOut } from "@/lib/actions/auth";
import { formatDateTime, formatRelative } from "@/lib/format";
import { PasswordResetButton } from "./password-reset-button";

/** Password is owned by the identity provider; the user can request a reset email or sign out here. */
export function SecurityCard({ lastActiveAt, now }: { lastActiveAt: string | null; now: string }) {
    const t = useT();
    const locale = useLocale();

    return (
        <Card className="min-w-0">
            <CardHeader title={t("account.security.title")} icon={<ShieldCheck />} />
            <CardContent className="flex flex-col divide-y divide-border">
                <section aria-labelledby="security-password" className="flex flex-col gap-3 pb-4">
                    <div>
                        <h3 id="security-password" className="flex items-center gap-1.5 text-sm font-medium text-fg">
                            <KeyRound aria-hidden className="size-3.5 text-fg-subtle" />
                            {t("account.security.password")}
                        </h3>
                        <p className="mt-1 text-[13px] text-pretty text-fg-muted">
                            {t("account.security.passwordDesc")}
                        </p>
                    </div>
                    <div
                        aria-hidden
                        className="flex h-9 items-center gap-2 rounded-lg border border-dashed border-border-strong bg-surface-muted px-3 text-sm text-fg-subtle"
                    >
                        <Lock className="size-3.5 shrink-0" />
                        <span className="tracking-[0.2em]">••••••••</span>
                        <span className="ml-auto truncate text-xs">{t("account.security.managedExternally")}</span>
                    </div>
                    <div>
                        <PasswordResetButton />
                    </div>
                </section>
                <section aria-labelledby="security-session" className="flex flex-col gap-3 pt-4">
                    <div>
                        <h3 id="security-session" className="flex items-center gap-1.5 text-sm font-medium text-fg">
                            <MonitorSmartphone aria-hidden className="size-3.5 text-fg-subtle" />
                            {t("account.security.thisDevice")}
                        </h3>
                        <p className="mt-1 text-[13px] text-fg-muted">
                            {t("account.security.signedIn")}
                            {lastActiveAt && (
                                <>
                                    {t("account.security.lastActive")}
                                    <time dateTime={lastActiveAt} title={formatDateTime(lastActiveAt, locale)}>
                                        {formatRelative(lastActiveAt, now, locale)}
                                    </time>
                                </>
                            )}
                            {t("account.security.signOutNote")}
                        </p>
                    </div>
                    <form action={signOut}>
                        <Button type="submit" variant="danger-soft" size="sm">
                            <LogOut aria-hidden />
                            {t("account.security.signOut")}
                        </Button>
                    </form>
                </section>
            </CardContent>
        </Card>
    );
}
