import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { getSessionAccount, homePath } from "@/lib/auth/session";
import { getTranslator } from "@/lib/i18n/server";
import { routes } from "@/lib/routes";

export async function generateMetadata(): Promise<Metadata> {
    const { t } = await getTranslator();
    return { title: t("auth.joinMetaTitle") };
}

/** The academy only trains fighters a coach has already added. There is no public application. */
export default async function RegisterPage() {
    const account = await getSessionAccount();
    if (account) redirect(homePath(account));

    const { t } = await getTranslator();

    return (
        <div>
            <h1 className="text-2xl font-semibold tracking-tight text-fg">{t("auth.joinTitle")}</h1>
            <p className="mt-1.5 text-[15px] text-fg-muted">{t("auth.joinDescription")}</p>
            <p className="mt-6 text-sm">
                <Link href={routes.login} className="font-medium text-primary-soft-fg hover:underline">
                    {t("auth.backToSignIn")}
                </Link>
            </p>
        </div>
    );
}
