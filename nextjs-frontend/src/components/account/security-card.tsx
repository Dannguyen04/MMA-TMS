import { KeyRound, Lock, LogOut, MonitorSmartphone, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { signOut } from "@/lib/actions/auth";
import { formatDateTime, formatRelative } from "@/lib/format";
import { PasswordResetButton } from "./password-reset-button";

/** Password is owned by the identity provider; the user can request a reset email or sign out here. */
export function SecurityCard({ lastActiveAt, now }: { lastActiveAt: string | null; now: string }) {
    return (
        <Card className="min-w-0">
            <CardHeader title="Sign-in & security" icon={<ShieldCheck />} />
            <CardContent className="flex flex-col divide-y divide-border">
                <section aria-labelledby="security-password" className="flex flex-col gap-3 pb-4">
                    <div>
                        <h3 id="security-password" className="flex items-center gap-1.5 text-sm font-medium text-fg">
                            <KeyRound aria-hidden className="size-3.5 text-fg-subtle" />
                            Password
                        </h3>
                        <p className="mt-1 text-[13px] text-pretty text-fg-muted">
                            Your password is managed by the academy&apos;s identity provider, so it can&apos;t be changed on this page. We can email
                            you a secure link to set a new one.
                        </p>
                    </div>
                    <div
                        aria-hidden
                        className="flex h-9 items-center gap-2 rounded-lg border border-dashed border-border-strong bg-surface-muted px-3 text-sm text-fg-subtle"
                    >
                        <Lock className="size-3.5 shrink-0" />
                        <span className="tracking-[0.2em]">••••••••</span>
                        <span className="ml-auto truncate text-xs">Managed externally</span>
                    </div>
                    <div>
                        <PasswordResetButton />
                    </div>
                </section>
                <section aria-labelledby="security-session" className="flex flex-col gap-3 pt-4">
                    <div>
                        <h3 id="security-session" className="flex items-center gap-1.5 text-sm font-medium text-fg">
                            <MonitorSmartphone aria-hidden className="size-3.5 text-fg-subtle" />
                            This device
                        </h3>
                        <p className="mt-1 text-[13px] text-fg-muted">
                            Signed in
                            {lastActiveAt && (
                                <>
                                    {" · last active "}
                                    <time dateTime={lastActiveAt} title={formatDateTime(lastActiveAt)}>
                                        {formatRelative(lastActiveAt, now)}
                                    </time>
                                </>
                            )}
                            . Sign out when you use a shared gym computer.
                        </p>
                    </div>
                    <form action={signOut}>
                        <Button type="submit" variant="danger-soft" size="sm">
                            <LogOut aria-hidden />
                            Sign out
                        </Button>
                    </form>
                </section>
            </CardContent>
        </Card>
    );
}
