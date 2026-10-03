import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getSessionAccount, homePath } from "@/lib/auth/session";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = { title: "Apply to train" };

/** Self-registration for people who want to train at the academy as fighters. */
export default async function RegisterPage() {
    const account = await getSessionAccount();
    if (account) redirect(homePath(account));

    return (
        <div>
            <h1 className="text-2xl font-semibold tracking-tight text-fg">Apply to train</h1>
            <p className="mt-1.5 text-[15px] text-fg-muted">
                Create an account, then tell us about yourself. A coach assesses every applicant before the academy decides.
            </p>
            <RegisterForm />
        </div>
    );
}
