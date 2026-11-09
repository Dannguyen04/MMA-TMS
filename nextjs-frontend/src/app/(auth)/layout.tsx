import { Activity, HeartPulse, ScanLine, ShieldCheck } from "lucide-react";

import { Logo } from "@/components/brand/logo";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import { getTranslator } from "@/lib/i18n/server";

const HIGHLIGHTS = [
    { icon: ScanLine, key: "video" },
    { icon: Activity, key: "performance" },
    { icon: HeartPulse, key: "medicine" },
] as const;

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
    const { t } = await getTranslator();
    return (
        <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
            <aside className="relative hidden overflow-hidden bg-nav-bg px-12 py-10 text-nav-fg lg:flex lg:flex-col">
                {/* Full-bleed hero photo, faded into the nav colour so the copy on top stays readable. */}
                {/* eslint-disable-next-line @next/next/no-img-element -- decorative background photo */}
                <img
                    src="/mma-hero.jpg"
                    alt=""
                    aria-hidden
                    className="pointer-events-none absolute inset-0 size-full object-cover object-top opacity-60 blur-[2px]"
                />
                <div aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-t from-nav-bg via-nav-bg/80 to-nav-bg/20" />
                <OctagonPattern />
                <div className="relative">
                    <Logo />
                </div>
                <div className="relative mt-auto max-w-md">
                    <p className="text-xs font-semibold tracking-[0.12em] text-nav-accent uppercase">{t("screens.misc.auth.academy")}</p>
                    <p className="mt-3 text-[34px] leading-tight font-semibold tracking-tight text-balance text-white">
                        {t("auth.slogan")}
                    </p>
                    <p className="mt-3 text-[15px] text-nav-fg">{t("screens.misc.auth.systemName")}</p>
                    <ul className="mt-10 space-y-6">
                        {HIGHLIGHTS.map(({ icon: Icon, key }) => (
                            <li key={key} className="flex gap-4">
                                <span className="octagon flex size-10 shrink-0 items-center justify-center bg-nav-surface text-nav-accent">
                                    <Icon aria-hidden className="size-[18px]" />
                                </span>
                                <span>
                                    <span className="block text-sm font-semibold text-white">{t(`auth.highlight.${key}.title`)}</span>
                                    <span className="mt-0.5 block text-sm text-nav-fg">{t(`auth.highlight.${key}.text`)}</span>
                                </span>
                            </li>
                        ))}
                    </ul>
                </div>
                <p className="relative mt-12 flex items-center gap-2 text-xs text-nav-fg/70">
                    <ShieldCheck aria-hidden className="size-3.5" />
                    {t("auth.privacy")}
                </p>
            </aside>
            <main className="flex flex-col px-5 py-8 sm:px-10">
                <div className="mb-6 flex justify-end">
                    <LanguageSwitcher className="w-56" />
                </div>
                <div className="mb-10 lg:hidden">
                    <span className="inline-flex rounded-xl bg-nav-bg px-3 py-2">
                        <Logo />
                    </span>
                </div>
                <div className="m-auto w-full max-w-[26rem]">{children}</div>
            </main>
        </div>
    );
}

/** Faint nested octagons evoking the cage, drawn as a background ornament. */
function OctagonPattern() {
    const octagon = (size: number) => {
        const c = size * 0.2929;
        return `M${c},0 L${size - c},0 L${size},${c} L${size},${size - c} L${size - c},${size} L${c},${size} L0,${size - c} L0,${c} Z`;
    };
    return (
        <svg aria-hidden className="pointer-events-none absolute -top-40 -right-56 size-[720px] opacity-[0.07]" viewBox="0 0 720 720">
            {[720, 600, 480, 360, 240].map((size) => (
                <path
                    key={size}
                    d={octagon(size)}
                    transform={`translate(${(720 - size) / 2} ${(720 - size) / 2})`}
                    fill="none"
                    stroke="white"
                    strokeWidth="2"
                />
            ))}
        </svg>
    );
}
