import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { LogoMark } from "@/components/brand/logo";
import { buttonClasses } from "@/components/ui/button";

export const metadata: Metadata = { title: "Page not found" };

export default function NotFound() {
    return (
        <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
            <LogoMark className="size-12" />
            <p className="mt-8 text-sm font-semibold tracking-[0.12em] text-fg-subtle uppercase">404</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-fg">This page isn&apos;t in the octagon</h1>
            <p className="mt-2 max-w-md text-[15px] text-fg-muted">
                The page may have moved, or you may not have access to it. Records you aren&apos;t assigned to are hidden.
            </p>
            <Link href="/" className={buttonClasses({ className: "mt-8" })}>
                <ArrowLeft aria-hidden />
                Back to my dashboard
            </Link>
        </main>
    );
}
