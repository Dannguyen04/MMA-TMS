import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getSessionAccount, homePath } from "@/lib/auth/session";
import { EmailCodeForm } from "./email-code-form";

export const metadata: Metadata = { title: "Apply to train" };

/** Where people apply to train as fighters, and where applicants come back to their application, with an email code. */
export default async function RegisterPage() {
    const account = await getSessionAccount();
    if (account) redirect(homePath(account));

    return (
        <div>
            <h1 className="text-2xl font-semibold tracking-tight text-fg">Apply to train</h1>
            <p className="mt-1.5 text-[15px] text-fg-muted">
                Enter your email and we&apos;ll send you a code, then tell us about yourself. A coach assesses every applicant before the academy decides.
                Already applied? Use the same email to continue.
            </p>
            <EmailCodeForm />
        </div>
    );
}
