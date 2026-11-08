import Link from "next/link";

import { Logo } from "@/components/brand/logo";
import { getTranslator } from "@/lib/i18n/server";
import { CHAPTER_NAV } from "./landing-data";

export async function LandingHeader({ primaryHref, primaryLabel }: { primaryHref: string; primaryLabel: string }) {
    const { t } = await getTranslator();
    return (
        <header data-landing-header className="landing-header fixed inset-x-0 top-0 z-40">
            <div className="mx-auto flex w-full max-w-[90rem] items-center justify-between px-5 py-4 sm:px-8 lg:px-12">
                <Link href="/" aria-label={t("landing.header.homeAria")} className="rounded-lg focus-visible:outline-white">
                    <Logo />
                </Link>
                <nav aria-label={t("landing.header.navAria")} className="flex items-center gap-1 sm:gap-2">
                    {CHAPTER_NAV.slice(0, 4).map((chapter) => (
                        <Link key={chapter.id} href={`#${chapter.id}`} className="hidden rounded-lg px-3 py-2 text-sm font-medium text-nav-fg transition-colors hover:text-nav-fg-active lg:inline-flex">
                            {t(chapter.labelKey)}
                        </Link>
                    ))}
                    <Link href={primaryHref} className="landing-header-cta ml-2">
                        {primaryLabel}
                    </Link>
                </nav>
            </div>
        </header>
    );
}
