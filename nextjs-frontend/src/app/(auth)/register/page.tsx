import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getSessionAccount, homePath } from "@/lib/auth/session";
import { getTranslator } from "@/lib/i18n/server";
import { EmailCodeForm } from "./email-code-form";

export async function generateMetadata(): Promise<Metadata> {
    const { t } = await getTranslator();
    return { title: t("auth.applyMetaTitle") };
}

/** Where people apply to train as fighters, and where applicants come back to their application, with an email code. */
export default async function RegisterPage() {
    const account = await getSessionAccount();
    if (account) redirect(homePath(account));

    const { t } = await getTranslator();

    return (
        <div>
            <h1 className="text-2xl font-semibold tracking-tight text-fg">{t("auth.applyTitle")}</h1>
            <p className="mt-1.5 text-[15px] text-fg-muted">
                {t("auth.applyDescription")}
            </p>
            <EmailCodeForm />
        </div>
    );
}
