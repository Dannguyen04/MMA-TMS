import { LinkIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Callout } from "@/components/training/callout";
import { buttonClasses } from "@/components/ui/button";
import { getTranslator } from "@/lib/i18n/server";
import { routes } from "@/lib/routes";
import { param } from "@/lib/utils";
import { ResetPasswordForm } from "./reset-password-form";

export async function generateMetadata(): Promise<Metadata> {
    const { t } = await getTranslator();
    return { title: t("auth.resetMetaTitle") };
}

/**
 * Where the recovery email lands: `?token_hash=` proves the link came from the auth service. The same email sets an
 * approved applicant's first password and resets a forgotten one, so the page speaks to both.
 */
export default async function ResetPasswordPage({ searchParams }: PageProps<"/auth/reset-password">) {
    const [query, { t }] = await Promise.all([searchParams, getTranslator()]);
    const tokenHash = param(query.token_hash)?.trim() ?? "";

    return (
        <div>
            <h1 className="text-2xl font-semibold tracking-tight text-fg">{t("auth.resetTitle")}</h1>
            <p className="mt-1.5 text-[15px] text-fg-muted">
                {t("auth.resetDescription")}
            </p>
            {tokenHash ? (
                <ResetPasswordForm tokenHash={tokenHash} />
            ) : (
                <Callout
                    tone="warning"
                    icon={LinkIcon}
                    title={t("auth.linkIncompleteTitle")}
                    className="mt-8"
                    action={
                        <Link href={routes.forgotPassword} className={buttonClasses({ variant: "secondary", size: "sm" })}>
                            {t("auth.requestNewLink")}
                        </Link>
                    }
                >
                    {t("auth.linkIncompleteBody")}
                </Callout>
            )}
        </div>
    );
}
