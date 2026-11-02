import { LinkIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { unstable_rethrow } from "next/navigation";

import { TermHint } from "@/components/domain/term-hint";
import { Callout } from "@/components/training/callout";
import { buttonClasses } from "@/components/ui/button";
import { getSessionAccount } from "@/lib/auth/session";
import { awaitsFighterActivation } from "@/lib/domain/admissions";
import { getTranslator } from "@/lib/i18n/server";
import type { MessageKey, Translator } from "@/lib/i18n/translate";
import { routes } from "@/lib/routes";
import { listOwnApplications } from "@/lib/services/admissions";
import { param } from "@/lib/utils";
import { ResetPasswordForm } from "./reset-password-form";

export async function generateMetadata(): Promise<Metadata> {
    const { t } = await getTranslator();
    return { title: t("auth.resetMetaTitle") };
}

/**
 * Who opened the link, as far as this browser can tell: an approved applicant setting their first password, an
 * academy member choosing a new one, or someone signed out, who could be either.
 */
type PasswordContext = "activation" | "reset" | "unknown";

/**
 * The auth service sends one recovery email for both purposes, so the page works out which one it can. It only picks
 * the wording; the service still decides what the new password unlocks. A read that fails falls back to wording that
 * fits both, so the link keeps working.
 */
async function passwordContext(): Promise<PasswordContext> {
    try {
        const account = await getSessionAccount();
        if (!account) return "unknown";
        if (account.kind === "user") return "reset";
        return awaitsFighterActivation(await listOwnApplications(account.applicant)) ? "activation" : "unknown";
    } catch (error) {
        unstable_rethrow(error);
        return "unknown";
    }
}

const COPY: Record<PasswordContext, { title: MessageKey; lead: MessageKey; field: MessageKey; submit: MessageKey }> = {
    activation: { title: "auth.resetTitle", lead: "auth.reset.activationLead", field: "auth.password", submit: "auth.reset.setPassword" },
    reset: { title: "auth.reset.newTitle", lead: "auth.reset.newLead", field: "auth.newPassword", submit: "auth.savePassword" },
    unknown: { title: "auth.resetTitle", lead: "auth.reset.unknownLead", field: "auth.password", submit: "auth.reset.setPassword" },
};

function ResetLink({ t }: { t: Translator }) {
    return (
        <Link href={routes.forgotPassword} className="font-medium text-primary-soft-fg hover:underline">
            {t("auth.reset.requestResetLink")}
        </Link>
    );
}

/** How to get a working link: approved applicants ask the academy; existing accounts request one themselves. */
function NewLinkHelp({ context, t }: { context: PasswordContext; t: Translator }) {
    if (context === "activation") return <p>{t("auth.reset.askResend")}</p>;
    if (context === "reset") {
        return (
            <p>
                <ResetLink t={t} /> {t("auth.reset.openFromEmail")}
            </p>
        );
    }
    return (
        <ul className="flex flex-col gap-1">
            <li>{t("auth.reset.newFighter")}</li>
            <li>
                {t("auth.reset.haveAccount")} <ResetLink t={t} />.
            </li>
        </ul>
    );
}

/**
 * Where the recovery email lands: `?token_hash=` proves the link came from the auth service. The same email sets an
 * approved applicant's first password and resets a forgotten one, so the page says which it is when it can tell.
 */
export default async function ResetPasswordPage({ searchParams }: PageProps<"/auth/reset-password">) {
    const [query, context, { t }] = await Promise.all([searchParams, passwordContext(), getTranslator()]);
    const tokenHash = param(query.token_hash)?.trim() ?? "";
    const copy = COPY[context];
    const back =
        context === "activation" ? { href: routes.apply, label: t("auth.reset.backToApplication") } : { href: routes.login, label: t("auth.backToSignIn") };

    return (
        <div>
            <h1 className="text-2xl font-semibold tracking-tight text-fg">{t(copy.title)}</h1>
            <p className="mt-1.5 text-[15px] text-fg-muted">
                {t(copy.lead)}
                {context === "activation" && (
                    <>
                        {" "}
                        <TermHint term="activation" />
                    </>
                )}
            </p>
            {tokenHash ? (
                <ResetPasswordForm tokenHash={tokenHash} fieldLabel={t(copy.field)} submitLabel={t(copy.submit)} back={back} help={<NewLinkHelp context={context} t={t} />} />
            ) : (
                <Callout
                    tone="warning"
                    icon={LinkIcon}
                    title={t("auth.linkIncompleteTitle")}
                    className="mt-8"
                    action={
                        context === "activation" && (
                            <Link href={back.href} className={buttonClasses({ variant: "secondary", size: "sm" })}>
                                {back.label}
                            </Link>
                        )
                    }
                >
                    <div className="flex flex-col gap-1">
                        <p>{t("auth.reset.openAgain")}</p>
                        <NewLinkHelp context={context} t={t} />
                    </div>
                </Callout>
            )}
        </div>
    );
}
