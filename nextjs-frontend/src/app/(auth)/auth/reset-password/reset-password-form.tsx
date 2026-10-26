"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { useT } from "@/components/i18n/locale-provider";
import { FormMessage } from "@/components/ui/form";
import { NewPasswordFields } from "@/components/ui/password-input";
import { SubmitButton } from "@/components/ui/submit-button";
import { useActionForm } from "@/components/ui/use-action-form";
import { resetPasswordAction } from "@/lib/actions/auth";

export interface ResetPasswordFormProps {
    tokenHash: string;
    /** "Password" for a first password, "New password" when replacing one. */
    fieldLabel: string;
    submitLabel: string;
    back: { href: string; label: string };
    /** How to get a working link, shown when the link itself was refused. */
    help: ReactNode;
}

/** Chooses the password for the account a recovery link was sent to: a first one for an approved applicant, or a new one. */
export function ResetPasswordForm({ tokenHash, fieldLabel, submitLabel, back, help }: ResetPasswordFormProps) {
    const t = useT();
    const form = useActionForm(resetPasswordAction, { id: "reset-password" });
    // A refusal without a field to fix is about the link (expired, used) or the service: say how to get a new link.
    const linkRefused = form.state.status === "error" && !form.state.fieldErrors;

    return (
        <form {...form.formProps} className="mt-8 space-y-5">
            <input type="hidden" name="tokenHash" value={tokenHash} />
            <FormMessage {...form.message} />
            {linkRefused && <div className="rounded-lg bg-surface-muted px-3.5 py-3 text-sm text-fg-muted">{help}</div>}
            <NewPasswordFields form={form} label={fieldLabel} />
            <SubmitButton size="lg" className="w-full" pending={form.pending} pendingLabel={t("auth.savingPasswordPending")}>
                {submitLabel}
            </SubmitButton>
            <Link href={back.href} className="flex items-center justify-center gap-1.5 text-sm font-medium text-fg-muted hover:text-fg">
                <ArrowLeft aria-hidden className="size-4" />
                {back.label}
            </Link>
        </form>
    );
}
