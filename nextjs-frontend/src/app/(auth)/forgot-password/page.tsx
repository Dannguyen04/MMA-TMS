import type { Metadata } from "next";

import { ForgotPasswordForm } from "./forgot-password-form";

export const metadata: Metadata = { title: "Reset password" };

export default function ForgotPasswordPage() {
    return (
        <div>
            <h1 className="text-2xl font-semibold tracking-tight text-fg">Reset your password</h1>
            <p className="mt-1.5 text-[15px] text-fg-muted">
                Enter the email you use for the academy. We&apos;ll send a link to choose a new password.
            </p>
            <ForgotPasswordForm />
        </div>
    );
}
