import Link from "next/link";

import { Logo } from "@/components/brand/logo";
import { buttonClasses } from "@/components/ui/button";

export function LandingHeader({ primaryHref, primaryLabel }: { primaryHref: string; primaryLabel: string }) {
    return (
        <header className="relative z-30 mx-auto flex w-full max-w-[90rem] items-center justify-between px-5 py-5 sm:px-8 lg:px-12">
            <Link href="/" aria-label="MMA-TMS home" className="rounded-lg focus-visible:outline-white">
                <Logo />
            </Link>
            <nav aria-label="Landing navigation" className="flex items-center gap-2 sm:gap-3">
                <Link href="#system" className="hidden rounded-lg px-3 py-2 text-sm font-medium text-nav-fg transition-colors hover:text-white sm:inline-flex">
                    The system
                </Link>
                <Link
                    href={primaryHref}
                    className={buttonClasses({
                        variant: "secondary",
                        size: "sm",
                        className: "border-white/15 bg-white/8 text-white shadow-none backdrop-blur-md hover:bg-white/14 hover:text-white",
                    })}
                >
                    {primaryLabel}
                </Link>
            </nav>
        </header>
    );
}
