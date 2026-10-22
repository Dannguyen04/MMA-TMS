import type { Metadata } from "next";

import { getTranslator } from "@/lib/i18n/server";
import { ForgotPasswordForm } from "./forgot-password-form";

export async function generateMetadata(): Promise<Metadata> {
    const { t } = await getTranslator();
    return { title: t("auth.forgotMetaTitle") };
}

export default async function ForgotPasswordPage() {
    const { t } = await getTranslator();
    return (
        <div>
            <h1 className="text-2xl font-semibold tracking-tight text-fg">{t("auth.forgotTitle")}</h1>
            <p className="mt-1.5 text-[15px] text-fg-muted">
                {t("auth.forgotDescription")}
            </p>
            <ForgotPasswordForm />
            <p className="mt-6 text-center text-sm text-fg-muted">
                Approved to train and setting up your fighter account? Use the set-up email from the academy, or ask them to resend it.
            </p>
        </div>
    );
}
