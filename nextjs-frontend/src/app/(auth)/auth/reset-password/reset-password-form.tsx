"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { Field, FormMessage } from "@/components/ui/form";
import { PasswordInput } from "@/components/ui/password-input";
import { SubmitButton } from "@/components/ui/submit-button";
import { useActionForm } from "@/components/ui/use-action-form";
import { resetPasswordAction } from "@/lib/actions/auth";
import { routes } from "@/lib/routes";

const PASSWORD_HINT = "8 to 128 characters. A few unrelated words make a strong password.";

/** Chooses a new password for the account a recovery link was sent to. */
export function ResetPasswordForm({ tokenHash }: { tokenHash: string }) {
    const form = useActionForm(resetPasswordAction, { id: "reset-password" });
    const newPassword = form.control("newPassword", { id: "newPassword", required: true, hint: PASSWORD_HINT });
    const confirmPassword = form.control("confirmPassword", { id: "confirmPassword", required: true });

    return (
        <form {...form.formProps} className="mt-8 space-y-5">
            <input type="hidden" name="tokenHash" value={tokenHash} />
            <FormMessage {...form.message} />
            <Field label="New password" htmlFor={newPassword.id} required hint={PASSWORD_HINT} error={form.error("newPassword")}>
                <PasswordInput {...newPassword} autoComplete="new-password" minLength={8} maxLength={128} />
            </Field>
            <Field label="Confirm new password" htmlFor={confirmPassword.id} required error={form.error("confirmPassword")}>
                <PasswordInput {...confirmPassword} autoComplete="new-password" maxLength={128} />
            </Field>
            <SubmitButton size="lg" className="w-full" pending={form.pending} pendingLabel="Saving password…">
                Set new password
            </SubmitButton>
            <Link href={routes.login} className="flex items-center justify-center gap-1.5 text-sm font-medium text-fg-muted hover:text-fg">
                <ArrowLeft aria-hidden className="size-4" />
                Back to sign in
            </Link>
        </form>
    );
}
