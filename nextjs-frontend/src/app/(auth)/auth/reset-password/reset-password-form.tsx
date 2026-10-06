"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { FormMessage } from "@/components/ui/form";
import { NewPasswordFields } from "@/components/ui/password-input";
import { SubmitButton } from "@/components/ui/submit-button";
import { useActionForm } from "@/components/ui/use-action-form";
import { resetPasswordAction } from "@/lib/actions/auth";
import { routes } from "@/lib/routes";

/** Chooses the password for the account a recovery link was sent to: a first one for an approved applicant, or a new one. */
export function ResetPasswordForm({ tokenHash }: { tokenHash: string }) {
    const form = useActionForm(resetPasswordAction, { id: "reset-password" });

    return (
        <form {...form.formProps} className="mt-8 space-y-5">
            <input type="hidden" name="tokenHash" value={tokenHash} />
            <FormMessage {...form.message} />
            <NewPasswordFields form={form} />
            <SubmitButton size="lg" className="w-full" pending={form.pending} pendingLabel="Saving password…">
                Save password
            </SubmitButton>
            <Link href={routes.login} className="flex items-center justify-center gap-1.5 text-sm font-medium text-fg-muted hover:text-fg">
                <ArrowLeft aria-hidden className="size-4" />
                Back to sign in
            </Link>
        </form>
    );
}
