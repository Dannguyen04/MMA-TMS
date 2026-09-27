import Link from "next/link";

import { Logo } from "@/components/brand/logo";
import { buttonClasses } from "@/components/ui/button";
import { CHAPTER_NAV } from "./landing-data";

export function LandingHeader({ primaryHref, primaryLabel }: { primaryHref: string; primaryLabel: string }) {
    return (
        <header data-landing-header className="landing-header fixed inset-x-0 top-0 z-40">
            <div className="mx-auto flex w-full max-w-[90rem] items-center justify-between px-5 py-4 sm:px-8 lg:px-12">
                <Link href="/" aria-label="MMA-TMS home" className="rounded-lg focus-visible:outline-white">
                    <Logo />
                </Link>
                <nav aria-label="Landing navigation" className="flex items-center gap-1 sm:gap-2">
                    {CHAPTER_NAV.slice(0, 4).map((chapter) => (
                        <Link key={chapter.id} href={`#${chapter.id}`} className="hidden rounded-lg px-3 py-2 text-sm font-medium text-nav-fg transition-colors hover:text-white lg:inline-flex">
                            {chapter.label}
                        </Link>
                    ))}
                    <Link
                        href={primaryHref}
                        className={buttonClasses({
                            variant: "secondary",
                            size: "sm",
                            className: "ml-2 border-white/15 bg-white/8 text-white shadow-none backdrop-blur-md hover:bg-white/14 hover:text-white",
                        })}
                    >
                        {primaryLabel}
                    </Link>
                </nav>
            </div>
        </header>
    );
}
