import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { FlashToast } from "@/components/medical/flash-toast";
import type { ToastInput } from "@/components/ui/toast";
import type { SignInNotice } from "@/lib/actions/auth";
import { isDemoAuthEnabled } from "@/lib/auth/constants";
import { getSessionAccount, homePath } from "@/lib/auth/session";
import { parseEnum } from "@/lib/query";
import { routes, safeRedirectPath } from "@/lib/routes";
import { param } from "@/lib/utils";
import { DemoAccounts } from "./demo-accounts";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

/** Toasts after a recovery link set a password (`resetPasswordAction`), after "forgot password" or for an approved applicant. */
const SIGN_IN_NOTICES: Record<SignInNotice, ToastInput> = {
    "password-updated": { title: "Password updated", description: "Sign in with your new password." },
    "activation-ready": { title: "Password set", description: "Sign in to activate your fighter account." },
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
    const account = await getSessionAccount();
    if (account) redirect(homePath(account));

    const query = await searchParams;
    const next = safeRedirectPath(param(query.next));
    // Only known notices: a crafted `?notice=constructor` must not reach the prototype.
    const notice = parseEnum(param(query.notice), Object.keys(SIGN_IN_NOTICES) as SignInNotice[]);

    return (
        <div>
            <FlashToast notice={notice ? SIGN_IN_NOTICES[notice] : null} cleanHref={routes.login} />
            <h1 className="text-2xl font-semibold tracking-tight text-fg">Sign in</h1>
            <p className="mt-1.5 text-[15px] text-fg-muted">Welcome back. Use your academy account to continue.</p>
            <LoginForm next={next} />
            <p className="mt-6 text-center text-sm text-fg-muted">
                Applying to train, or waiting for a decision?{" "}
                <Link href={routes.register} className="font-medium text-primary-soft-fg hover:underline">
                    Continue with an email code
                </Link>
            </p>
            {isDemoAuthEnabled() && <DemoAccounts next={next} />}
        </div>
    );
}
