import { LinkIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { unstable_rethrow } from "next/navigation";
import type { ReactNode } from "react";

import { TermHint } from "@/components/domain/term-hint";
import { Callout } from "@/components/training/callout";
import { buttonClasses } from "@/components/ui/button";
import { getSessionAccount } from "@/lib/auth/session";
import { awaitsFighterActivation } from "@/lib/domain/admissions";
import { routes } from "@/lib/routes";
import { listOwnApplications } from "@/lib/services/admissions";
import { param } from "@/lib/utils";
import { ResetPasswordForm } from "./reset-password-form";

export const metadata: Metadata = { title: "Set your password" };

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

const COPY: Record<PasswordContext, { title: string; lead: ReactNode; field: string; submit: string }> = {
    activation: {
        title: "Set your password",
        lead: (
            <>
                Set your password to activate your fighter account. From now on you sign in with your email and this password. <TermHint term="activation" />
            </>
        ),
        field: "Password",
        submit: "Set password",
    },
    reset: {
        title: "Choose a new password",
        lead: "Choose a new password for your academy account.",
        field: "New password",
        submit: "Save password",
    },
    unknown: {
        title: "Set your password",
        lead: "Approved by the academy? Set the password that activates your fighter account. Already have an account? Choose its new password here.",
        field: "Password",
        submit: "Set password",
    },
};

function ResetLink() {
    return (
        <Link href={routes.forgotPassword} className="font-medium text-primary-soft-fg hover:underline">
            Request a new reset link
        </Link>
    );
}

/** How to get a working link: approved applicants ask the academy; existing accounts request one themselves. */
function NewLinkHelp({ context }: { context: PasswordContext }) {
    if (context === "activation") return <p>Ask the academy to resend your set-up email, then open the new link.</p>;
    if (context === "reset") {
        return (
            <p>
                <ResetLink /> and open it from your email.
            </p>
        );
    }
    return (
        <ul className="flex flex-col gap-1">
            <li>New fighter? Ask the academy to resend your set-up email.</li>
            <li>
                Already have an account? <ResetLink />.
            </li>
        </ul>
    );
}

/**
 * Where the recovery email lands: `?token_hash=` proves the link came from the auth service. The same email sets an
 * approved applicant's first password and resets a forgotten one, so the page says which it is when it can tell.
 */
export default async function ResetPasswordPage({ searchParams }: PageProps<"/auth/reset-password">) {
    const [query, context] = await Promise.all([searchParams, passwordContext()]);
    const tokenHash = param(query.token_hash)?.trim() ?? "";
    const copy = COPY[context];
    const back = context === "activation" ? { href: routes.apply, label: "Back to your application" } : { href: routes.login, label: "Back to sign in" };

    return (
        <div>
            <h1 className="text-2xl font-semibold tracking-tight text-fg">{copy.title}</h1>
            <p className="mt-1.5 text-[15px] text-fg-muted">{copy.lead}</p>
            {tokenHash ? (
                <ResetPasswordForm tokenHash={tokenHash} fieldLabel={copy.field} submitLabel={copy.submit} back={back} help={<NewLinkHelp context={context} />} />
            ) : (
                <Callout
                    tone="warning"
                    icon={LinkIcon}
                    title="This link is incomplete"
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
                        <p>Open the link from the email again. If it still doesn&apos;t work:</p>
                        <NewLinkHelp context={context} />
                    </div>
                </Callout>
            )}
        </div>
    );
}
