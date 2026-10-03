import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { FlashToast } from "@/components/medical/flash-toast";
import type { ToastInput } from "@/components/ui/toast";
import type { PasswordNotice } from "@/lib/actions/auth";
import { isDemoAuthEnabled } from "@/lib/auth/constants";
import { getCurrentUser } from "@/lib/auth/session";
import { dashboardPath, routes, safeRedirectPath } from "@/lib/routes";
import { param } from "@/lib/utils";
import { DemoAccounts } from "./demo-accounts";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

/** Toasts after a recovery link set a new password (`resetPasswordAction`). */
const PASSWORD_NOTICES: Record<PasswordNotice, ToastInput> = {
    "password-updated": { title: "Password updated", description: "Sign in with your new password." },
    "activation-ready": { title: "Password set", description: "Sign in to activate your fighter account." },
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
    const user = await getCurrentUser();
    if (user) redirect(dashboardPath(user.role));

    const query = await searchParams;
    const next = safeRedirectPath(param(query.next));

    return (
        <div>
            <FlashToast notice={PASSWORD_NOTICES[param(query.notice) as PasswordNotice] ?? null} cleanHref={routes.login} />
            <h1 className="text-2xl font-semibold tracking-tight text-fg">Sign in</h1>
            <p className="mt-1.5 text-[15px] text-fg-muted">Welcome back. Use your academy account to continue.</p>
            <LoginForm next={next} />
            {isDemoAuthEnabled() && <DemoAccounts next={next} />}
        </div>
    );
}
