import { ChevronRight, Dumbbell, ServerCog, Stethoscope, Swords } from "lucide-react";

import { signInAsDemo } from "@/lib/actions/auth";
import { DEMO_PASSWORD, isDemoAuthEnabled } from "@/lib/auth/constants";
import { getTranslator } from "@/lib/i18n/server";
import { cn } from "@/lib/utils";

const ACCOUNTS: { role: Parameters<typeof signInAsDemo>[0]; name: string; icon: typeof Swords }[] = [
    { role: "fighter", name: "Minh Trần", icon: Swords },
    { role: "coach", name: "Rafael Costa", icon: Dumbbell },
    { role: "doctor", name: "Dr. Thu Lê", icon: Stethoscope },
    { role: "admin", name: "Nora Whitfield", icon: ServerCog },
];

/** Demo environment helper: one-click sign-in for each role while the auth service is mocked. */
export async function DemoAccounts({ next }: { next: string | null }) {
    const { t } = await getTranslator();
    return (
        <section aria-labelledby="demo-accounts" className="mt-10">
            <div className="flex items-center gap-3">
                <span className="h-px flex-1 bg-border" />
                <h2 id="demo-accounts" className="text-xs font-semibold tracking-[0.08em] text-fg-subtle uppercase">
                    {t("auth.demoAccounts")}
                </h2>
                <span className="h-px flex-1 bg-border" />
            </div>
            <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                {ACCOUNTS.map(({ role, name, icon: Icon }) => (
                    <li key={role}>
                        <form action={signInAsDemo.bind(null, role, next)}>
                            <button
                                type="submit"
                                className="group flex w-full items-center gap-3 rounded-xl border border-border bg-surface p-3 text-left shadow-card transition-colors hover:border-border-strong hover:bg-surface-muted"
                            >
                                {/* Fighters are octagons; staff are circles. */}
                                <span
                                    className={cn(
                                        "flex size-9 shrink-0 items-center justify-center bg-nav-bg text-nav-accent",
                                        role === "fighter" ? "octagon" : "rounded-full",
                                    )}
                                >
                                    <Icon aria-hidden className="size-4" />
                                </span>
                                <span className="min-w-0 flex-1">
                                    <span className="block truncate text-sm font-semibold text-fg">{name}</span>
                                    <span className="block truncate text-xs text-fg-muted">{t(`auth.demo.${role}`)}</span>
                                </span>
                                <ChevronRight aria-hidden className="size-4 text-fg-subtle transition-transform group-hover:translate-x-0.5" />
                                <span className="sr-only">{t("auth.demoSignInAs", { role: t(`auth.demo.${role}`) })}</span>
                            </button>
                        </form>
                    </li>
                ))}
            </ul>
            {isDemoAuthEnabled() && (
                <p className="mt-3 text-center text-xs text-fg-subtle">
                    {t("auth.demoPassword")} <code className="rounded bg-surface-hover px-1 py-0.5 font-mono text-fg-muted">{DEMO_PASSWORD}</code>
                </p>
            )}
        </section>
    );
}
