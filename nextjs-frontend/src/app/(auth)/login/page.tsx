import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { isDemoAuthEnabled } from "@/lib/auth/constants";
import { getCurrentUser } from "@/lib/auth/session";
import { dashboardPath, safeRedirectPath } from "@/lib/routes";
import { param } from "@/lib/utils";
import { DemoAccounts } from "./demo-accounts";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
    const user = await getCurrentUser();
    if (user) redirect(dashboardPath(user.role));

    const next = safeRedirectPath(param((await searchParams).next));

    return (
        <div>
            <h1 className="text-2xl font-semibold tracking-tight text-fg">Sign in</h1>
            <p className="mt-1.5 text-[15px] text-fg-muted">Welcome back. Use your academy account to continue.</p>
            <LoginForm next={next} />
            {isDemoAuthEnabled() && <DemoAccounts next={next} />}
        </div>
    );
}
