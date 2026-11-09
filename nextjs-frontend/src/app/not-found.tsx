import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { LogoMark } from "@/components/brand/logo";
import { buttonClasses } from "@/components/ui/button";
import { getTranslator } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
    const { t } = await getTranslator();
    return { title: t("ux.notFound.metaTitle") };
}

export default async function NotFound() {
    const { t } = await getTranslator();
    return (
        <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
            <LogoMark className="size-12" />
            <p className="mt-8 text-sm font-semibold tracking-[0.12em] text-fg-subtle uppercase">404</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-fg">{t("ux.notFound.rootTitle")}</h1>
            <p className="mt-2 max-w-md text-[15px] text-fg-muted">{t("ux.notFound.rootDescription")}</p>
            <Link href="/" className={buttonClasses({ className: "mt-8" })}>
                <ArrowLeft aria-hidden />
                {t("ux.notFound.rootBack")}
            </Link>
        </main>
    );
}
