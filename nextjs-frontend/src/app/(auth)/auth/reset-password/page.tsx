import { LinkIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Callout } from "@/components/training/callout";
import { buttonClasses } from "@/components/ui/button";
import { routes } from "@/lib/routes";
import { param } from "@/lib/utils";
import { ResetPasswordForm } from "./reset-password-form";

export const metadata: Metadata = { title: "Choose a new password" };

/** Where the recovery email lands: `?token_hash=` proves the link came from the auth service. */
export default async function ResetPasswordPage({ searchParams }: PageProps<"/auth/reset-password">) {
    const tokenHash = param((await searchParams).token_hash)?.trim() ?? "";

    return (
        <div>
            <h1 className="text-2xl font-semibold tracking-tight text-fg">Choose a new password</h1>
            <p className="mt-1.5 text-[15px] text-fg-muted">Set the password you&apos;ll use to sign in to the academy.</p>
            {tokenHash ? (
                <ResetPasswordForm tokenHash={tokenHash} />
            ) : (
                <Callout
                    tone="warning"
                    icon={LinkIcon}
                    title="This link is incomplete"
                    className="mt-8"
                    action={
                        <Link href={routes.forgotPassword} className={buttonClasses({ variant: "secondary", size: "sm" })}>
                            Request a new link
                        </Link>
                    }
                >
                    Open the link from the email again, or request a new one.
                </Callout>
            )}
        </div>
    );
}
