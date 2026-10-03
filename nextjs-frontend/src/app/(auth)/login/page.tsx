import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { FlashToast } from "@/components/medical/flash-toast";
import type { ToastInput } from "@/components/ui/toast";
import type { SignInNotice } from "@/lib/actions/auth";
import { isDemoAuthEnabled } from "@/lib/auth/constants";
import { getSessionAccount, homePath } from "@/lib/auth/session";
import { routes, safeRedirectPath } from "@/lib/routes";
import { param } from "@/lib/utils";
import { DemoAccounts } from "./demo-accounts";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

/** Toasts after a recovery link set a new password (`resetPasswordAction`) or a registration needs confirming. */
const SIGN_IN_NOTICES: Record<SignInNotice, ToastInput> = {
    "password-updated": { title: "Password updated", description: "Sign in with your new password." },
    "activation-ready": { title: "Password set", description: "Sign in to activate your fighter account." },
    "confirm-email": { title: "Check your email", description: "Confirm your address from the link we sent, then sign in to apply." },
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
    const account = await getSessionAccount();
    if (account) redirect(homePath(account));

    const query = await searchParams;
    const next = safeRedirectPath(param(query.next));

    return (
        <div>
            <FlashToast notice={SIGN_IN_NOTICES[param(query.notice) as SignInNotice] ?? null} cleanHref={routes.login} />
            <h1 className="text-2xl font-semibold tracking-tight text-fg">Sign in</h1>
            <p className="mt-1.5 text-[15px] text-fg-muted">Welcome back. Use your academy account to continue.</p>
            <LoginForm next={next} />
            <p className="mt-6 text-center text-sm text-fg-muted">
                New to the academy?{" "}
                <Link href={routes.register} className="font-medium text-primary-soft-fg hover:underline">
                    Apply to train as a fighter
                </Link>
            </p>
            {isDemoAuthEnabled() && <DemoAccounts next={next} />}
        </div>
    );
}
